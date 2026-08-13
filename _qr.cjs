/* Generador de códigos QR mínimo, sin dependencias.
   Solo lo justo para una URL corta: modo byte, corrección de errores nivel L y
   versiones 1 a 4 (hasta 78 caracteres), que cubre de sobra un
   http://192.168.100.6:8080. Existe para que no haya que teclear la dirección
   en el teléfono: se escanea y listo.

   Referencia: ISO/IEC 18004. Las versiones 1-4 con nivel L tienen un solo
   bloque de corrección, así que no hace falta intercalar bloques —que es la
   parte más enrevesada del formato— y el código se queda en algo legible. */

// Codewords de datos y de corrección por versión, nivel L, un solo bloque
const CAP = { 1:{datos:19, ecc:7}, 2:{datos:34, ecc:10}, 3:{datos:55, ecc:15}, 4:{datos:80, ecc:20} };
// Centros de los patrones de alineación (además de los de posición)
const ALINEACION = { 1:[], 2:[6,18], 3:[6,22], 4:[6,26] };

/* ---------- Aritmética en GF(256), polinomio 0x11D ---------- */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(function tablas(){
  let x = 1;
  for (let i=0;i<255;i++){
    EXP[i] = x; LOG[x] = i;
    x <<= 1; if (x & 0x100) x ^= 0x11D;
  }
  for (let i=255;i<512;i++) EXP[i] = EXP[i-255];
})();
const mul = (a,b) => (a===0||b===0) ? 0 : EXP[LOG[a]+LOG[b]];

/* Coeficiente de mayor grado primero, que es como lo espera corregir().
   Multiplicar por (x + alfa^i): desplazar (mismo índice, grado+1) y sumar el
   producto en el siguiente. Invertir estos dos términos deja el polinomio del
   revés y la corrección de errores sale mal sin que nada avise. */
function polGenerador(n){
  let g = [1];
  for (let i=0;i<n;i++){
    const nuevo = new Array(g.length+1).fill(0);
    for (let j=0;j<g.length;j++){
      nuevo[j]   ^= g[j];
      nuevo[j+1] ^= mul(g[j], EXP[i]);
    }
    g = nuevo;
  }
  return g;
}
function corregir(datos, nEcc){
  const gen = polGenerador(nEcc);
  const resto = new Array(nEcc).fill(0);
  for (const b of datos){
    const factor = b ^ resto[0];
    resto.shift(); resto.push(0);
    for (let i=0;i<nEcc;i++) resto[i] ^= mul(gen[i+1], factor);
  }
  return resto;
}

/* ---------- Datos ---------- */
function codificar(texto, version){
  const bytes = Array.from(Buffer.from(texto, "utf8"));
  const { datos: capDatos } = CAP[version];
  const bits = [];
  const meter = (valor, n) => { for (let i=n-1;i>=0;i--) bits.push((valor>>i)&1); };
  meter(0b0100, 4);          // modo byte
  meter(bytes.length, 8);    // contador (8 bits en versiones 1-9)
  bytes.forEach(b => meter(b, 8));
  const tope = capDatos * 8;
  for (let i=0; i<4 && bits.length<tope; i++) bits.push(0);   // terminador
  while (bits.length % 8) bits.push(0);
  const palabras = [];
  for (let i=0;i<bits.length;i+=8){
    let v = 0; for (let j=0;j<8;j++) v = (v<<1) | bits[i+j];
    palabras.push(v);
  }
  const relleno = [0xEC, 0x11];
  for (let i=0; palabras.length < capDatos; i++) palabras.push(relleno[i%2]);
  return palabras.concat(corregir(palabras, CAP[version].ecc));
}

/* ---------- Matriz ---------- */
function nuevaMatriz(lado){
  return { lado,
    m: Array.from({length:lado}, ()=> new Array(lado).fill(null)),   // null = libre
    reservado: Array.from({length:lado}, ()=> new Array(lado).fill(false)) };
}
function ponerFijo(M, x, y, v){ M.m[y][x] = v; M.reservado[y][x] = true; }

function patronPosicion(M, cx, cy){
  for (let dy=-1; dy<=7; dy++) for (let dx=-1; dx<=7; dx++){
    const x = cx+dx, y = cy+dy;
    if (x<0 || y<0 || x>=M.lado || y>=M.lado) continue;
    const borde = dx===0||dx===6||dy===0||dy===6;
    const centro = dx>=2&&dx<=4&&dy>=2&&dy<=4;
    ponerFijo(M, x, y, (borde||centro) ? 1 : 0);
  }
}
function patronAlineacion(M, cx, cy){
  for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++){
    const anillo = Math.max(Math.abs(dx), Math.abs(dy));
    ponerFijo(M, cx+dx, cy+dy, anillo===1 ? 0 : 1);
  }
}
function armazon(M, version){
  patronPosicion(M, 0, 0);
  patronPosicion(M, M.lado-7, 0);
  patronPosicion(M, 0, M.lado-7);
  for (let i=8; i<M.lado-8; i++){          // temporización
    const v = i%2===0 ? 1 : 0;
    ponerFijo(M, i, 6, v); ponerFijo(M, 6, i, v);
  }
  const cen = ALINEACION[version];
  for (const cy of cen) for (const cx of cen){
    // No se pisan los patrones de posición
    if ((cx<=8&&cy<=8) || (cx>=M.lado-9&&cy<=8) || (cx<=8&&cy>=M.lado-9)) continue;
    patronAlineacion(M, cx, cy);
  }
  ponerFijo(M, 8, M.lado-8, 1);            // módulo oscuro, siempre
  // Se reservan las casillas del formato; el valor llega después
  for (let i=0;i<9;i++){
    if (!M.reservado[i][8]) { M.m[i][8] = 0; M.reservado[i][8] = true; }
    if (!M.reservado[8][i]) { M.m[8][i] = 0; M.reservado[8][i] = true; }
  }
  for (let i=0;i<8;i++){
    if (!M.reservado[M.lado-1-i][8]) { M.m[M.lado-1-i][8] = 0; M.reservado[M.lado-1-i][8] = true; }
    if (!M.reservado[8][M.lado-1-i]) { M.m[8][M.lado-1-i] = 0; M.reservado[8][M.lado-1-i] = true; }
  }
}
/* Zigzag desde abajo a la derecha, en columnas de dos, saltando la columna 6 */
function volcarDatos(M, palabras){
  const bits = [];
  palabras.forEach(v => { for (let i=7;i>=0;i--) bits.push((v>>i)&1); });
  let n = 0, subiendo = true;
  for (let col = M.lado-1; col > 0; col -= 2){
    if (col === 6) col--;                       // la columna de temporización
    for (let k = 0; k < M.lado; k++){
      const y = subiendo ? M.lado-1-k : k;
      for (const x of [col, col-1]){
        if (M.reservado[y][x]) continue;
        M.m[y][x] = n < bits.length ? bits[n] : 0;
        n++;
      }
    }
    subiendo = !subiendo;
  }
}
const MASCARAS = [
  (x,y)=> (x+y)%2===0,
  (x,y)=> y%2===0,
  (x,y)=> x%3===0,
  (x,y)=> (x+y)%3===0,
  (x,y)=> (Math.floor(y/2)+Math.floor(x/3))%2===0,
  (x,y)=> ((x*y)%2 + (x*y)%3)===0,
  (x,y)=> (((x*y)%2 + (x*y)%3)%2)===0,
  (x,y)=> (((x+y)%2 + (x*y)%3)%2)===0,
];
function aplicarMascara(M, idx){
  const f = MASCARAS[idx];
  const s = { lado:M.lado, m:M.m.map(f2=>f2.slice()), reservado:M.reservado };
  for (let y=0;y<M.lado;y++) for (let x=0;x<M.lado;x++)
    if (!M.reservado[y][x] && f(x,y)) s.m[y][x] ^= 1;
  return s;
}
/* Información de formato: nivel L (01) + máscara, con BCH y XOR 0x5412 */
function ponerFormato(M, mascara){
  let v = (0b01 << 3) | mascara;
  let resto = v << 10;
  for (let i=4;i>=0;i--) if (resto & (1<<(i+10))) resto ^= 0b10100110111 << i;
  const bits = ((v<<10) | resto) ^ 0b101010000010010;
  const leer = i => (bits >> i) & 1;
  for (let i=0;i<=5;i++)  M.m[8][i] = leer(i);
  M.m[8][7] = leer(6); M.m[8][8] = leer(7); M.m[7][8] = leer(8);
  for (let i=9;i<=14;i++) M.m[14-i][8] = leer(i);
  for (let i=0;i<=7;i++)  M.m[M.lado-1-i][8] = leer(i);
  for (let i=8;i<=14;i++) M.m[8][M.lado-15+i] = leer(i);
  M.m[M.lado-8][8] = 1;                       // módulo oscuro
}
/* Penalización estándar: se elige la máscara que menos "grumos" deja, porque
   un QR con zonas uniformes grandes se lee peor. */
function penalizar(M){
  const L = M.lado, g = M.m; let p = 0;
  const rachas = (leer)=>{
    for (let a=0;a<L;a++){
      let ant = -1, n = 0;
      for (let b=0;b<L;b++){
        const v = leer(a,b);
        if (v===ant) n++; else { if (n>=5) p += 3 + (n-5); ant = v; n = 1; }
      }
      if (n>=5) p += 3 + (n-5);
    }
  };
  rachas((a,b)=> g[a][b]);
  rachas((a,b)=> g[b][a]);
  for (let y=0;y<L-1;y++) for (let x=0;x<L-1;x++){
    const s = g[y][x]+g[y][x+1]+g[y+1][x]+g[y+1][x+1];
    if (s===0 || s===4) p += 3;
  }
  let oscuros = 0;
  for (let y=0;y<L;y++) for (let x=0;x<L;x++) oscuros += g[y][x];
  const pct = oscuros*100/(L*L);
  p += Math.floor(Math.abs(pct-50)/5)*10;
  return p;
}

/* Devuelve una matriz de 0/1 lista para pintar */
function generar(texto){
  const largo = Buffer.from(texto, "utf8").length;
  const version = [1,2,3,4].find(v => largo <= CAP[v].datos - 2);
  if (!version) throw new Error("texto demasiado largo para este generador");
  const palabras = codificar(texto, version);
  const lado = 17 + 4*version;
  const base = nuevaMatriz(lado);
  armazon(base, version);
  volcarDatos(base, palabras);
  let mejor = null, mejorP = Infinity;
  for (let i=0;i<8;i++){
    const cand = aplicarMascara(base, i);
    ponerFormato(cand, i);
    const p = penalizar(cand);
    if (p < mejorP){ mejorP = p; mejor = cand; }
  }
  return mejor.m;
}

/* Pinta con bloques dobles: en una terminal los caracteres son más altos que
   anchos, así que un módulo son dos columnas o saldría aplastado e ilegible.
   El margen de 4 módulos (zona tranquila) es obligatorio para que se lea. */
function aTerminal(texto, margen = 2){
  const m = generar(texto);
  const L = m.length;
  const OSCURO = "  ", CLARO = "██";   // invertido: fondo claro, módulo oscuro
  const linea = n => CLARO.repeat(n);
  const salida = [];
  for (let i=0;i<margen;i++) salida.push(linea(L + margen*2));
  for (let y=0;y<L;y++){
    let s = linea(margen);
    for (let x=0;x<L;x++) s += m[y][x] ? OSCURO : CLARO;
    salida.push(s + linea(margen));
  }
  for (let i=0;i<margen;i++) salida.push(linea(L + margen*2));
  return salida.join("\n");
}

module.exports = { generar, aTerminal, __polGenerador: polGenerador };
