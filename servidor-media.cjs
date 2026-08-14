/* Servidor de casa para OndaAmp.
   Publica en tu red local la carpeta donde guardas la música y, de paso, la
   propia app. Sin dependencias: solo Node.

     node servidor-media.cjs
     node servidor-media.cjs "D:\\Otra carpeta"     (o la variable MUSICA)

   Sirve dos cosas por el mismo puerto, y eso es deliberado:

   · La app  →  abriendo http://<ip-del-pc>:8080 en el móvil, la página y la
     música comparten origen. Sin contenido mixto, sin CORS, sin permisos: es
     el camino que funciona hoy en cualquier navegador.
   · La música  →  /api/indice y /media/..., con cabeceras CORS abiertas por si
     prefieres usar la app instalada desde https y tu Chrome permite el acceso
     a la red local.

   No sale de tu red: escucha en la LAN y solo lee. Nada se sube a ningún sitio. */
const http = require("http");
const fs   = require("fs");
const path = require("path");
const os   = require("os");

const PUERTO  = Number(process.env.PORT || 8080);
const APP     = __dirname;
const MUSICA  = path.resolve(process.argv[2] || process.env.MUSICA || "F:\\Flac Music");
const AUDIO   = /\.(flac|mp3|wav|ogg|oga|opus|m4a|aac|weba|webm|wma)$/i;

const TIPOS = {
  ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json; charset=utf-8",
  ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon",
  ".css":"text/css; charset=utf-8", ".txt":"text/plain; charset=utf-8",
  ".flac":"audio/flac", ".mp3":"audio/mpeg", ".wav":"audio/wav",
  ".ogg":"audio/ogg", ".oga":"audio/ogg", ".opus":"audio/ogg",
  ".m4a":"audio/mp4", ".aac":"audio/aac", ".weba":"audio/webm",
  ".webm":"audio/webm", ".wma":"audio/x-ms-wma",
};
const tipoDe = p => TIPOS[path.extname(p).toLowerCase()] || "application/octet-stream";

/* Sin esto el audio que llega de otro origen entra "manchado" y
   createMediaElementSource devuelve silencio: se oiría nada con el EQ puesto. */
function cors(res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

/* ---------- Índice ----------
   Se recorre una vez y se guarda en memoria: una biblioteca de miles de FLAC
   tarda en recorrerse y no cambia entre canción y canción. /api/indice?refrescar=1
   la vuelve a leer. */
let indice = null, indiceCuando = 0;

function recorrer(dir, base, salida, prof){
  if (prof > 12) return;                       // freno ante enlaces circulares
  let entradas;
  try{ entradas = fs.readdirSync(dir, {withFileTypes:true}); }catch(e){ return; }
  for (const e of entradas){
    if (e.name.startsWith(".") || e.name === "__MACOSX") continue;
    const abs = path.join(dir, e.name);
    const rel = base ? base + "/" + e.name : e.name;
    if (e.isDirectory()){ recorrer(abs, rel, salida, prof+1); continue; }
    if (!AUDIO.test(e.name)) continue;
    let t = 0;
    try{ t = fs.statSync(abs).size; }catch(e){ continue; }
    salida.push({ r: rel, t });
  }
}
function construirIndice(){
  const pistas = [];
  recorrer(MUSICA, "", pistas, 0);
  pistas.sort((a,b)=> a.r.localeCompare(b.r, "es", {numeric:true}));
  indice = { raiz: path.basename(MUSICA), generado: Date.now(), pistas };
  indiceCuando = Date.now();
  return indice;
}

/* Traduce una ruta de la URL a un archivo real dentro de la carpeta de música,
   rechazando cualquier intento de salirse de ella con "..".
   Se distingue el intento de escaparse (403, que sí es un "no puedes") de
   pedir algo que no es una pista (404, que es un "aquí no hay nada"). */
function resolverMedia(rutaUrl){
  const limpia = path.normalize(rutaUrl).replace(/^([/\\])+/, "");
  const abs = path.join(MUSICA, limpia);
  if (abs !== MUSICA && !abs.startsWith(MUSICA + path.sep)) return {prohibido:true};
  if (!AUDIO.test(abs)) return {noExiste:true};
  return {abs};
}

/* Envío con soporte de rangos. Es lo que permite arrastrar la barra de
   progreso: sin esto el navegador tendría que descargar el FLAC entero antes
   de poder saltar a la mitad. */
function enviarArchivo(req, res, abs){
  let st;
  try{ st = fs.statSync(abs); }catch(e){ res.writeHead(404).end("No encontrado"); return; }
  const total = st.size;
  const tipo = tipoDe(abs);
  const rango = req.headers.range;
  const m = rango && /^bytes=(\d*)-(\d*)$/.exec(rango.trim());

  if (m){
    let ini = m[1] === "" ? null : parseInt(m[1], 10);
    let fin = m[2] === "" ? null : parseInt(m[2], 10);
    if (ini === null){                       // "bytes=-500": los últimos 500
      const n = fin === null ? 0 : fin;
      ini = Math.max(0, total - n); fin = total - 1;
    } else if (fin === null || fin >= total) fin = total - 1;
    if (isNaN(ini) || isNaN(fin) || ini > fin || ini >= total){
      res.writeHead(416, {"Content-Range":`bytes */${total}`}).end();
      return;
    }
    res.writeHead(206, {
      "Content-Type": tipo,
      "Content-Length": fin - ini + 1,
      "Content-Range": `bytes ${ini}-${fin}/${total}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(abs, {start:ini, end:fin}).on("error",()=>res.end()).pipe(res);
    return;
  }
  res.writeHead(200, {
    "Content-Type": tipo, "Content-Length": total,
    "Accept-Ranges": "bytes", "Cache-Control": "no-cache",
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(abs).on("error",()=>res.end()).pipe(res);
}

http.createServer((req,res)=>{
  cors(res);
  if (req.method === "OPTIONS"){ res.writeHead(204).end(); return; }
  if (req.method !== "GET" && req.method !== "HEAD"){ res.writeHead(405).end(); return; }

  const url = new URL(req.url, "http://localhost");
  const ruta = decodeURIComponent(url.pathname);

  if (ruta === "/api/indice"){
    if (!indice || url.searchParams.get("refrescar")) construirIndice();
    const cuerpo = JSON.stringify(indice);
    res.writeHead(200, {"Content-Type":TIPOS[".json"], "Cache-Control":"no-cache"});
    res.end(req.method === "HEAD" ? undefined : cuerpo);
    return;
  }
  /* Página con el código a pantalla completa. Los bloques del QR de la
     terminal dependen de la fuente y la codificación de la consola; esto se ve
     nítido siempre. Se abre en el PC y se escanea desde el móvil. */
  if (ruta === "/qr"){
    const ip = (Object.values(os.networkInterfaces()).flat()
                 .find(i=> i && i.family === "IPv4" && !i.internal) || {}).address;
    const destino = `http://${ip || "localhost"}:${PUERTO}`;
    let svg = "";
    try{
      const m = require("./_qr.cjs").generar(destino);
      const L = m.length, q = 4, T = L + q*2;
      let celdas = "";
      for (let y=0;y<L;y++) for (let x=0;x<L;x++)
        if (m[y][x]) celdas += `<rect x="${x+q}" y="${y+q}" width="1" height="1"/>`;
      svg = `<svg viewBox="0 0 ${T} ${T}" width="320" height="320" shape-rendering="crispEdges"
              xmlns="http://www.w3.org/2000/svg"><rect width="${T}" height="${T}" fill="#fff"/>
              <g fill="#000">${celdas}</g></svg>`;
    }catch(e){ svg = `<p>No pude dibujar el código: ${e.message}</p>`; }
    res.writeHead(200, {"Content-Type":TIPOS[".html"], "Cache-Control":"no-cache"});
    res.end(`<!doctype html><meta charset="utf-8"><title>OndaAmp · conectar el móvil</title>
      <body style="margin:0;min-height:100vh;display:grid;place-items:center;gap:18px;
                   background:#0f1216;color:#e6edf5;font:16px system-ui,sans-serif;text-align:center">
      <div><h1 style="font-size:19px;font-weight:600;margin-bottom:14px">Apunta la cámara del móvil</h1>
      ${svg}
      <p style="margin-top:14px;font:15px Consolas,monospace;color:#38e08c">${destino}</p>
      <p style="margin-top:6px;font-size:13px;color:#8fa0b3;max-width:34ch">
        Tenéis que estar en la misma WiFi. Si no conecta, falta la regla del
        cortafuegos que indica la terminal.</p></div></body>`);
    return;
  }
  if (ruta === "/api/salud"){
    res.writeHead(200, {"Content-Type":TIPOS[".json"]});
    res.end(JSON.stringify({ok:true, app:"OndaAmp", raiz:path.basename(MUSICA),
                            pistas: indice ? indice.pistas.length : null}));
    return;
  }
  if (ruta.startsWith("/media/")){
    const r = resolverMedia(ruta.slice(7));
    if (r.prohibido){ res.writeHead(403).end("Prohibido"); return; }
    if (r.noExiste){ res.writeHead(404).end("No encontrado"); return; }
    enviarArchivo(req, res, r.abs);
    return;
  }

  // Todo lo demás: los archivos de la propia app
  const rel = ruta === "/" ? "index.html" : path.normalize(ruta).replace(/^([/\\])+/, "");
  const abs = path.join(APP, rel);
  if (abs !== APP && !abs.startsWith(APP + path.sep)){ res.writeHead(403).end("Prohibido"); return; }
  fs.readFile(abs, (err, datos)=>{
    if (err){ res.writeHead(404, {"Content-Type":"text/plain; charset=utf-8"}).end("No encontrado"); return; }
    res.writeHead(200, {"Content-Type": tipoDe(abs), "Cache-Control":"no-cache"});
    res.end(req.method === "HEAD" ? undefined : datos);
  });
}).listen(PUERTO, ()=>{
  if (!fs.existsSync(MUSICA)){
    console.log(`\n  AVISO: no encuentro la carpeta de música:\n    ${MUSICA}`);
    console.log(`  Pásala como argumento:  node servidor-media.cjs "D:\\Mi musica"\n`);
  } else {
    const t0 = Date.now();
    construirIndice();
    console.log(`\n  Biblioteca: ${MUSICA}`);
    console.log(`  ${indice.pistas.length} pistas indexadas en ${Date.now()-t0} ms`);
  }
  const ips = [];
  Object.values(os.networkInterfaces()).forEach(l=> (l||[]).forEach(i=>{
    if (i.family === "IPv4" && !i.internal) ips.push(i.address);
  }));
  console.log(`\n  OndaAmp servido en:`);
  console.log(`    En este PC:      http://localhost:${PUERTO}`);
  ips.forEach(ip=> console.log(`    En tu teléfono:  http://${ip}:${PUERTO}   (misma WiFi)`));

  // Para no teclear nada en el móvil: se apunta la cámara y listo
  if (ips.length){
    const destino = `http://${ips[0]}:${PUERTO}`;
    try{
      const qr = require("./_qr.cjs");
      console.log(`\n  O apunta la cámara del móvil a este código:\n`);
      console.log(qr.aTerminal(destino));
      console.log(`  ${destino}`);
    }catch(e){
      console.log(`\n  (no pude dibujar el código QR: ${e.message})`);
    }
  }
  console.log(`\n  Copia la dirección tal cual: cada red usa un rango distinto.`);
  // El fallo número uno al estrenar esto: responde en el PC pero no en el
  // teléfono. Windows bloquea las conexiones entrantes mientras no exista una
  // regla, y no avisa de nada; parece que el servidor no funciona.
  if (process.platform === "win32"){
    console.log(`\n  ── Cortafuegos ──────────────────────────────────────────`);
    console.log(`  La primera vez, Windows abre una ventana preguntando si`);
    console.log(`  permite el acceso a Node.js. Marca "Redes privadas" y pulsa`);
    console.log(`  PERMITIR ACCESO. Con eso queda hecho para siempre.`);
    console.log(`\n  Ojo: esa ventana solo aparece si arrancas el servidor desde`);
    console.log(`  una terminal visible. Si lo lanzas en segundo plano, Windows`);
    console.log(`  bloquea en silencio y el móvil no conecta sin decir por qué.`);
    console.log(`\n  Si ya no aparece, créala a mano en PowerShell COMO`);
    console.log(`  ADMINISTRADOR (botón derecho en Inicio → Terminal (Admin)):`);
    console.log(`    New-NetFirewallRule -DisplayName "OndaAmp" -Direction Inbound \``);
    console.log(`      -Protocol TCP -LocalPort ${PUERTO} -Action Allow -Profile Private`);
    console.log(`  ─────────────────────────────────────────────────────────`);
  }
  console.log(`\n  Ctrl+C para detener. Deja esta ventana abierta.\n`);

  // Se abre solo la página del QR: es lo primero que hace falta ver
  if (process.platform === "win32" && !process.env.SIN_ABRIR){
    require("child_process").exec(`start "" "http://localhost:${PUERTO}/qr"`, ()=>{});
  }
});
