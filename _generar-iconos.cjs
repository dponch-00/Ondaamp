// Genera los iconos PNG de la PWA sin dependencias externas.
// Escribe PNG a mano: firma + IHDR + IDAT (deflate de zlib) + IEND.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const TABLA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(tipo, datos) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([len, cuerpo, crc]);
}
function png(ancho, alto, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;   // 8 bits por canal
  ihdr[9] = 6;   // RGBA
  const filas = Buffer.alloc(alto * (ancho * 4 + 1));
  for (let y = 0; y < alto; y++) {
    filas[y * (ancho * 4 + 1)] = 0;   // filtro "none"
    rgba.copy(filas, y * (ancho * 4 + 1) + 1, y * ancho * 4, (y + 1) * ancho * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(filas, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* Dibuja el icono: fondo oscuro redondeado + barras de ecualizador verdes.
   `margen` deja espacio seguro para los iconos "maskable" de Android, que se
   recortan en círculo u otras formas según el lanzador. */
function dibujar(tam, margen) {
  const px = Buffer.alloc(tam * tam * 4);
  const set = (x, y, r, g, b, a) => {
    const i = (y * tam + x) * 4;
    // Mezcla sobre lo que ya haya (para los bordes suavizados)
    const ia = a / 255, inv = 1 - ia;
    px[i]   = Math.round(px[i]   * inv + r * ia);
    px[i+1] = Math.round(px[i+1] * inv + g * ia);
    px[i+2] = Math.round(px[i+2] * inv + b * ia);
    px[i+3] = Math.max(px[i+3], a);
  };
  const m = Math.round(tam * margen);
  const lado = tam - m * 2;
  const radio = lado * 0.22;
  // Fondo con esquinas redondeadas y degradado vertical sutil
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const lx = x - m, ly = y - m;
      if (lx < 0 || ly < 0 || lx >= lado || ly >= lado) continue;
      const dx = Math.min(lx, lado - 1 - lx), dy = Math.min(ly, lado - 1 - ly);
      let a = 255;
      if (dx < radio && dy < radio) {
        const d = Math.hypot(radio - dx, radio - dy);
        if (d > radio) continue;
        if (d > radio - 1.5) a = Math.round(255 * (radio - d) / 1.5);
      }
      const t = ly / lado;
      set(x, y, Math.round(29 + t * -8), Math.round(36 + t * -10), Math.round(46 + t * -12), a);
    }
  }
  // Barras de ecualizador, alturas tipo espectro
  const alturas = [0.34, 0.62, 0.86, 0.5, 0.72, 0.4];
  const zonaX = m + lado * 0.16, zonaW = lado * 0.68;
  const anchoBarra = zonaW / (alturas.length * 1.85);
  const base = m + lado * 0.76;
  alturas.forEach((h, i) => {
    const bx = Math.round(zonaX + i * (zonaW / alturas.length));
    const bh = Math.round(lado * 0.52 * h);
    const by = Math.round(base - bh);
    const bw = Math.round(anchoBarra);
    const rBarra = Math.max(1, Math.round(bw * 0.35));
    for (let y = by; y < base; y++) {
      for (let x = bx; x < bx + bw; x++) {
        if (x < 0 || y < 0 || x >= tam || y >= tam) continue;
        const dx = Math.min(x - bx, bx + bw - 1 - x);
        const dy = Math.min(y - by, base - 1 - y);
        let a = 255;
        if (dx < rBarra && dy < rBarra) {
          const d = Math.hypot(rBarra - dx, rBarra - dy);
          if (d > rBarra) continue;
          if (d > rBarra - 1.2) a = Math.round(255 * (rBarra - d) / 1.2);
        }
        // Verde arriba, más claro en la punta
        const prog = (base - y) / (bh || 1);
        set(x, y, Math.round(40 + prog * 40), Math.round(200 + prog * 45), Math.round(130 + prog * 30), a);
      }
    }
  });
  return px;
}

const dir = __dirname;
const salidas = [
  ["icon-192.png", 192, 0.06],
  ["icon-512.png", 512, 0.06],
  ["icon-maskable-512.png", 512, 0.14],   // más margen: Android recorta
];
for (const [nombre, tam, margen] of salidas) {
  fs.writeFileSync(path.join(dir, nombre), png(tam, tam, dibujar(tam, margen)));
  console.log("escrito", nombre, tam + "x" + tam);
}
