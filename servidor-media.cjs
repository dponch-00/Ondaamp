/* Servidor de casa para OndaAmp y OndaVideo.
   Publica en tu red local las carpetas que elijas —música y vídeo— y, de paso,
   las propias apps: la música en / y el cine en /video/. Sin dependencias: solo Node.

     Doble clic en "INICIAR SERVIDOR.bat"   (o: node servidor-media.cjs)

   Al arrancar abre el PANEL (http://localhost:8080/panel): ahí se eligen con
   clics las carpetas compartidas y está el código QR para conectar el móvil.

   Sirve todo por el mismo puerto, y eso es deliberado:

   · La app  →  abriendo http://<ip-del-pc>:8080 en el móvil, la página y la
     música comparten origen. Sin contenido mixto, sin CORS, sin permisos: es
     el camino que funciona hoy en cualquier navegador.
   · La música y el vídeo  →  /api/indice y /media/<id-carpeta>/<ruta>, con
     CORS abierto por si se usa la app instalada desde https.
   · OndaVideo  →  /video/ sirve la pantalla de cine. Su HTML canónico vive en
     la carpeta madre (Documents\AudioPlayer\OndaVideo.html).
   · El panel  →  SOLO responde al propio PC (localhost). Desde el móvil se ve
     la biblioteca, no el panel; nadie en la WiFi puede añadir carpetas.

   No sale de tu red: escucha en la LAN y solo lee. Nada se sube a ningún sitio. */
const http   = require("http");
const fs     = require("fs");
const path   = require("path");
const os     = require("os");
const crypto = require("crypto");

const PUERTO = Number(process.env.PORT || 8080);
/* Cuando lo arranca Puente (el hub de la casa), este servidor deja de dar la
   cara a la red: escucha solo en 127.0.0.1 y la familia entra por la puerta
   única, con contraseña. Suelto, sigue funcionando como siempre. */
const PUENTE = process.env.PUENTE_CHILD === "1";
const APP    = __dirname;
const CONFIG_RUTA = path.join(APP, "servidor-config.json");
const AUDIO  = /\.(flac|mp3|wav|ogg|oga|opus|m4a|aac|weba|webm|wma)$/i;
/* Aquella promesa se cumplió: OndaVideo ya existe y vive en /video/. Los
   subtítulos sueltos también viajan en el índice para que el cine los ofrezca. */
const VIDEO  = /\.(mp4|m4v|mkv|mov|avi|wmv|mpg|mpeg|ts)$/i;
const SUBS   = /\.(srt|vtt)$/i;

/* El panel puede tocar la configuración, así que sus órdenes llevan un token
   que solo conoce la página servida en localhost. Sin él, cualquier web
   abierta en el navegador del PC podría añadir o quitar carpetas a ciegas. */
const TOKEN = crypto.randomBytes(16).toString("hex");

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
  ".mp4":"video/mp4", ".m4v":"video/mp4", ".mkv":"video/x-matroska",
  ".mov":"video/quicktime", ".avi":"video/x-msvideo", ".wmv":"video/x-ms-wmv",
  ".mpg":"video/mpeg", ".mpeg":"video/mpeg", ".ts":"video/mp2t",
  ".srt":"application/x-subrip", ".vtt":"text/vtt; charset=utf-8",
};
const tipoDe = p => TIPOS[path.extname(p).toLowerCase()] || "application/octet-stream";

function cors(res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}
function esLocal(req){
  /* Detrás de un proxy TODAS las peticiones llegan desde 127.0.0.1, así que
     mirar la IP dejaría el panel abierto a toda la casa. Puente marca lo que
     reenvía con X-Puente: si viene de ahí, no es local por definición. */
  if (req.headers["x-puente"] || req.headers["x-forwarded-for"]) return false;
  const a = req.socket.remoteAddress || "";
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}
function json(res, codigo, datos){
  res.writeHead(codigo, {"Content-Type":TIPOS[".json"], "Cache-Control":"no-cache"});
  res.end(JSON.stringify(datos));
}

/* ---------- Configuración: qué carpetas se comparten ---------- */
let config = null;   // { proximoId, carpetas: [{id, nombre, ruta}] }

const igualRuta = (a,b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
function nombreDeRuta(ruta){
  const base = path.basename(ruta) || (/^[A-Za-z]:/.test(ruta) ? ruta.slice(0,2) : "Carpeta");
  let n = base, i = 2;
  while (config.carpetas.some(c => c.nombre === n)) n = `${base} (${i++})`;
  return n;
}
function guardarConfig(){
  try{ fs.writeFileSync(CONFIG_RUTA, JSON.stringify(config, null, 2)); }catch(e){}
}
function agregarCarpeta(rutaCruda){
  // Una ruta vacía se resolvería a la carpeta del propio servidor: fuera
  if (!rutaCruda || !String(rutaCruda).trim()) return {error:"Falta la ruta"};
  let ruta;
  try{ ruta = path.resolve(String(rutaCruda).trim()); }catch(e){ return {error:"Ruta no válida"}; }
  let st; try{ st = fs.statSync(ruta); }catch(e){ return {error:"No existe esa carpeta"}; }
  if (!st.isDirectory()) return {error:"Eso no es una carpeta"};
  if (config.carpetas.some(c => igualRuta(c.ruta, ruta))) return {error:"Esa carpeta ya está compartida"};
  const c = { id: config.proximoId++, nombre: nombreDeRuta(ruta), ruta };
  config.carpetas.push(c);
  guardarConfig();
  construirIndice();
  return {ok:true, carpeta:c};
}
function quitarCarpeta(id){
  const i = config.carpetas.findIndex(c => c.id === id);
  if (i < 0) return {error:"No encuentro esa carpeta"};
  config.carpetas.splice(i,1);
  guardarConfig();
  construirIndice();
  return {ok:true};
}
function cargarConfig(){
  try{ config = JSON.parse(fs.readFileSync(CONFIG_RUTA, "utf8")); }catch(e){ config = null; }
  if (!config || !Array.isArray(config.carpetas) || !Number.isInteger(config.proximoId)){
    config = { proximoId: 1, carpetas: [] };
  }
  // La carpeta pasada como argumento (o la clásica de siempre) entra sola
  const extra = process.argv[2] || process.env.MUSICA || (config.carpetas.length ? null : "F:\\Flac Music");
  if (extra){
    try{
      const ruta = path.resolve(extra);
      if (fs.existsSync(ruta) && !config.carpetas.some(c => igualRuta(c.ruta, ruta))){
        config.carpetas.push({ id: config.proximoId++, nombre: nombreDeRuta(ruta), ruta });
        guardarConfig();
      }
    }catch(e){}
  }
}

/* ---------- Índice ----------
   Se recorre una vez y se guarda en memoria: una biblioteca de miles de FLAC
   tarda en recorrerse y no cambia entre canción y canción. Cada pista viaja
   con el id de su carpeta: la URL es /media/<id>/<ruta-dentro-de-la-carpeta>. */
let indice = null;

function recorrer(dir, base, audio, video, subs, prof){
  if (prof > 12) return;                       // freno ante enlaces circulares
  let entradas;
  try{ entradas = fs.readdirSync(dir, {withFileTypes:true}); }catch(e){ return; }
  for (const e of entradas){
    if (e.name.startsWith(".") || e.name.startsWith("$") || e.name === "__MACOSX") continue;
    const abs = path.join(dir, e.name);
    const rel = base ? base + "/" + e.name : e.name;
    if (e.isDirectory()){ recorrer(abs, rel, audio, video, subs, prof+1); continue; }
    const esAudio = AUDIO.test(e.name), esVideo = !esAudio && VIDEO.test(e.name),
          esSub   = !esAudio && !esVideo && SUBS.test(e.name);
    if (!esAudio && !esVideo && !esSub) continue;
    let st;
    try{ st = fs.statSync(abs); }catch(e2){ continue; }
    if (esAudio) audio.push({ r: rel, t: st.size });
    /* La fecha viaja con cada vídeo: OndaVideo ordena por "añadido hace poco" */
    else if (esVideo) video.push({ r: rel, t: st.size, m: Math.round(st.mtimeMs) });
    else subs.push({ r: rel });
  }
}
function construirIndice(){
  const pistas = [], videos = [], subtitulos = [];
  for (const c of config.carpetas){
    const a = [], v = [], s = [];
    recorrer(c.ruta, "", a, v, s, 0);
    const orden = (x,y) => x.r.localeCompare(y.r, "es", {numeric:true});
    a.sort(orden); v.sort(orden); s.sort(orden);
    a.forEach(p => pistas.push({ c: c.id, r: p.r, t: p.t }));
    v.forEach(p => videos.push({ c: c.id, r: p.r, t: p.t, m: p.m }));
    s.forEach(p => subtitulos.push({ c: c.id, r: p.r }));
  }
  indice = {
    generado: Date.now(),
    carpetas: config.carpetas.map(c => ({ id: c.id, nombre: c.nombre })),
    pistas, videos, subs: subtitulos,
  };
  return indice;
}
function conteos(){
  const por = {};
  config.carpetas.forEach(c => por[c.id] = { pistas: 0, videos: 0 });
  if (indice){
    indice.pistas.forEach(p => { if (por[p.c]) por[p.c].pistas++; });
    indice.videos.forEach(p => { if (por[p.c]) por[p.c].videos++; });
  }
  return por;
}

/* Traduce /media/<id>/<ruta> a un archivo real dentro de SU carpeta, sin dejar
   escapar un ".." . Una URL vieja sin id (la app instalada de antes) se busca
   en todas las carpetas: así nada se rompe al actualizar el servidor. */
function dentroDe(raiz, rel){
  const abs = path.join(raiz, rel);
  if (abs !== raiz && !abs.startsWith(raiz + path.sep)) return {prohibido:true};
  if (!AUDIO.test(abs) && !VIDEO.test(abs) && !SUBS.test(abs)) return {noExiste:true};
  return {abs};
}
function resolverMedia(rutaUrl){
  const limpia = path.normalize(rutaUrl).replace(/^([/\\])+/, "");
  const seg = limpia.split(path.sep);
  const id = parseInt(seg[0], 10);
  const carpeta = config.carpetas.find(c => c.id === id);
  if (carpeta && String(id) === seg[0]) return dentroDe(carpeta.ruta, seg.slice(1).join(path.sep));
  let vioProhibido = false;
  for (const c of config.carpetas){
    const r = dentroDe(c.ruta, limpia);
    if (r.prohibido){ vioProhibido = true; continue; }
    if (r.abs && fs.existsSync(r.abs)) return r;
  }
  return vioProhibido ? {prohibido:true} : {noExiste:true};
}

/* Envío con soporte de rangos: es lo que permite arrastrar la barra sin
   descargar el archivo entero. Vale igual para un FLAC que para un MP4. */
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
    if (ini === null){
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

/* ---------- El panel ---------- */
function ipLocal(){
  const i = Object.values(os.networkInterfaces()).flat()
    .find(x => x && x.family === "IPv4" && !x.internal);
  return i ? i.address : null;
}
function svgQR(destino, lado){
  try{
    const m = require("./_qr.cjs").generar(destino);
    const L = m.length, q = 4, T = L + q*2;
    let celdas = "";
    for (let y=0;y<L;y++) for (let x=0;x<L;x++)
      if (m[y][x]) celdas += `<rect x="${x+q}" y="${y+q}" width="1" height="1"/>`;
    return `<svg viewBox="0 0 ${T} ${T}" width="${lado}" height="${lado}" shape-rendering="crispEdges"
             xmlns="http://www.w3.org/2000/svg"><rect width="${T}" height="${T}" fill="#fff"/>
             <g fill="#000">${celdas}</g></svg>`;
  }catch(e){ return `<p>No pude dibujar el código: ${e.message}</p>`; }
}
function paginaPanel(){
  const destino = `http://${ipLocal() || "localhost"}:${PUERTO}`;
  return `<!doctype html><html lang="es"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OndaAmp · Servidor de casa</title>
<style>
 body{margin:0;background:#0f1216;color:#e6edf5;font:15px/1.5 system-ui,"Segoe UI",sans-serif}
 main{max-width:980px;margin:0 auto;padding:26px 18px;display:grid;gap:20px}
 h1{font-size:20px;margin:0}
 h2{font-size:12.5px;letter-spacing:.14em;color:#8fa0b3;margin:0 0 12px;text-transform:uppercase}
 .mut{color:#8fa0b3;font-size:13px}
 .fila{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start}
 .tarjeta{background:#171c23;border:1px solid #2a3340;border-radius:14px;padding:18px}
 .qr{display:grid;justify-items:center;gap:10px;text-align:center}
 .dir{font:600 15px Consolas,monospace;color:#38e08c}
 ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
 li{display:flex;gap:12px;align-items:center;background:#1d242e;border:1px solid #2a3340;border-radius:10px;padding:10px 12px}
 li b{font-size:14px}
 .ruta{color:#8fa0b3;font-size:12px;word-break:break-all}
 .datos{margin-left:auto;white-space:nowrap;color:#8fa0b3;font-size:12.5px}
 button{cursor:pointer;border:1px solid #2a3340;background:#1d242e;color:#e6edf5;border-radius:9px;padding:8px 12px;font:600 13px system-ui}
 button:hover{border-color:#38e08c}
 button:disabled{opacity:.4;cursor:default}
 .peligro:hover{border-color:#ff6b6b;color:#ff6b6b}
 .primario{background:#123524;border-color:#1f7a4f;color:#9dffb0}
 #explorador{margin-top:12px;border-top:1px solid #2a3340;padding-top:12px;display:grid;gap:10px}
 #miga{font:600 13px Consolas,monospace;color:#9dffb0;word-break:break-all}
 #subcarpetas{max-height:300px;overflow:auto}
 #subcarpetas li{cursor:pointer}
 #subcarpetas li:hover{border-color:#38e08c}
</style>
<main>
 <header>
  <h1>🏠 OndaAmp · Servidor de casa</h1>
  <p class="mut">Deja abierta la ventana negra del servidor. Este panel solo existe
  en este PC: el móvil ve la música, nunca el panel.</p>
 </header>
 <div class="fila">
  <section class="tarjeta qr" style="flex:0 1 300px">
   <h2>Conectar el móvil</h2>
   ${svgQR(destino, 240)}
   <div class="dir">${destino}</div>
   <p class="mut">Apunta con la cámara normal del móvil.<br>Tenéis que estar en la misma WiFi.</p>
   <p class="mut">La música vive ahí mismo; el cine, en<br><span class="dir" style="font-size:13px">${destino}/video/</span></p>
  </section>
  <section class="tarjeta" style="flex:1 1 400px">
   <h2>Carpetas compartidas</h2>
   <ul id="lista"></ul>
   <p class="mut" id="vacio" hidden>Todavía no compartes ninguna carpeta.</p>
   <p style="margin:12px 0 0"><button class="primario" id="bAbrir">＋ Compartir otra carpeta</button></p>
   <div id="explorador" hidden>
     <div id="miga"></div>
     <ul id="subcarpetas"></ul>
     <div style="display:flex;gap:8px;flex-wrap:wrap">
       <button id="bSubir">⬆ Subir</button>
       <button class="primario" id="bCompartir">✓ Compartir esta carpeta</button>
       <button id="bCerrarExp">Cancelar</button>
     </div>
   </div>
  </section>
 </div>
</main>
<script>
const TOKEN=${JSON.stringify(TOKEN)};
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
async function j(u){
  const r=await fetch(u,{cache:"no-store"});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.error) throw new Error(d.error||("HTTP "+r.status));
  return d;
}
async function pintar(){
  const d=await j("/api/carpetas");
  const ul=$("lista"); ul.innerHTML="";
  $("vacio").hidden=!!d.carpetas.length;
  for(const c of d.carpetas){
    const li=document.createElement("li");
    li.innerHTML='<div><b>📁 '+esc(c.nombre)+'</b><div class="ruta">'+esc(c.ruta)+'</div></div>'
      +'<span class="datos">'+c.pistas+' pistas · '+c.videos+' vídeos</span>'
      +'<button class="peligro">Quitar</button>';
    li.querySelector("button").onclick=async()=>{
      if(!confirm("¿Dejar de compartir «"+c.nombre+"»?\\nNo se borra nada del disco.")) return;
      try{ await j("/api/carpetas/quitar?token="+TOKEN+"&id="+c.id); }catch(e){ alert(e.message); }
      pintar();
    };
    ul.appendChild(li);
  }
}
let rutaActual=null, rutaPadre=null;
async function explorar(ruta){
  let d;
  try{ d=await j("/api/explorar"+(ruta?("?ruta="+encodeURIComponent(ruta)):"")); }
  catch(e){ alert(e.message); return; }
  rutaActual=d.ruta||null; rutaPadre=d.padre||null;
  $("explorador").hidden=false;
  $("miga").textContent=rutaActual||"Elige un disco:";
  $("bCompartir").disabled=!rutaActual;
  $("bSubir").disabled=!rutaActual;
  const ul=$("subcarpetas"); ul.innerHTML="";
  for(const s of d.carpetas){
    const li=document.createElement("li");
    li.textContent="📁 "+s.nombre;
    li.onclick=()=>explorar(s.ruta);
    ul.appendChild(li);
  }
  if(!d.carpetas.length){
    const li=document.createElement("li");
    li.textContent="(sin subcarpetas)"; li.style.cursor="default"; li.className="mut";
    ul.appendChild(li);
  }
}
$("bAbrir").onclick=()=>explorar(null);
$("bSubir").onclick=()=>explorar(rutaPadre);       // sin padre → lista de discos
$("bCerrarExp").onclick=()=>{ $("explorador").hidden=true; };
$("bCompartir").onclick=async()=>{
  try{ await j("/api/carpetas/agregar?token="+TOKEN+"&ruta="+encodeURIComponent(rutaActual)); }
  catch(e){ alert(e.message); return; }
  $("explorador").hidden=true;
  pintar();
};
pintar().catch(e=>alert(e.message));
</script>`;
}
function unidades(){
  const out = [];
  for (let i=65;i<=90;i++){
    const d = String.fromCharCode(i) + ":\\";
    try{ if (fs.existsSync(d)) out.push({ nombre: d, ruta: d }); }catch(e){}
  }
  return out;
}

/* ---------- El servidor ---------- */
http.createServer((req,res)=>{
  if (req.method === "OPTIONS"){ cors(res); res.writeHead(204).end(); return; }
  if (req.method !== "GET" && req.method !== "HEAD"){ res.writeHead(405).end(); return; }

  const url = new URL(req.url, "http://localhost");
  let ruta = decodeURIComponent(url.pathname);

  /* Detrás de Puente, OndaVideo llega con su prefijo puesto (/video/api/...,
     /video/media/...) porque la pantalla de cine ya vive en /video/. El índice
     y los archivos son los MISMOS para música y cine, así que aquí se le quita
     ese prefijo y todo sigue por el camino de siempre. */
  if (ruta.startsWith("/video/api/") || ruta.startsWith("/video/media/")){
    ruta = ruta.slice(6);
  }

  /* — API pública, con CORS: es lo que usa la app — */
  if (ruta === "/api/indice"){
    cors(res);
    if (!indice || url.searchParams.get("refrescar")) construirIndice();
    json(res, 200, indice);
    return;
  }
  /* La recarga se separa de la descarga del indice. En algunos moviles, hacer
     ambas cosas en una unica respuesta grande a traves de Skynet terminaba en
     un error de red aunque el escaneo hubiese finalizado correctamente. */
  if (ruta === "/api/refrescar"){
    cors(res);
    construirIndice();
    json(res, 200, {ok:true, generado:indice.generado,
                    pistas:indice.pistas.length, videos:indice.videos.length});
    return;
  }
  if (ruta === "/api/salud"){
    cors(res);
    json(res, 200, {ok:true, app:"OndaAmp", carpetas:config.carpetas.length,
                    pistas: indice ? indice.pistas.length : null,
                    videos: indice ? indice.videos.length : null});
    return;
  }
  if (ruta.startsWith("/media/")){
    cors(res);
    const r = resolverMedia(ruta.slice(7));
    if (r.prohibido){ res.writeHead(403).end("Prohibido"); return; }
    if (r.noExiste || !r.abs){ res.writeHead(404).end("No encontrado"); return; }
    enviarArchivo(req, res, r.abs);
    return;
  }

  /* — OndaVideo: la pantalla de cine, por el mismo puerto — */
  if (ruta === "/video"){
    res.writeHead(302, {Location: "/video/"});
    res.end();
    return;
  }
  if (ruta === "/video/" || ruta === "/video/index.html"){
    /* El HTML canónico vive en la carpeta madre; video/index.html es la copia
       que se sube a GitHub Pages. Se sirve la que exista, con preferencia local. */
    const candidatos = [path.join(APP, "..", "OndaVideo.html"),
                        path.join(APP, "video", "index.html")];
    const html = candidatos.find(p => { try{ return fs.existsSync(p); }catch(e){ return false; } });
    if (!html){
      res.writeHead(404, {"Content-Type": TIPOS[".txt"]});
      res.end("Falta OndaVideo.html en Documents\\AudioPlayer (o pwa\\video\\index.html).");
      return;
    }
    fs.readFile(html, (err, datos)=>{
      if (err){ res.writeHead(404).end("No pude leer OndaVideo.html"); return; }
      res.writeHead(200, {"Content-Type": TIPOS[".html"], "Cache-Control":"no-cache"});
      res.end(req.method === "HEAD" ? undefined : datos);
    });
    return;
  }

  /* — Panel y su API: solo el propio PC, sin CORS — */
  if (ruta === "/panel" || ruta === "/carpetas" || ruta === "/qr"){
    if (!esLocal(req)){
      res.writeHead(403, {"Content-Type":TIPOS[".txt"]});
      res.end("El panel solo se abre en el propio PC. En este dispositivo, abre la direccion sin /panel: veras la musica.");
      return;
    }
    res.writeHead(200, {"Content-Type":TIPOS[".html"], "Cache-Control":"no-cache"});
    res.end(req.method === "HEAD" ? undefined : paginaPanel());
    return;
  }
  if (ruta === "/api/explorar" || ruta === "/api/carpetas" ||
      ruta === "/api/carpetas/agregar" || ruta === "/api/carpetas/quitar"){
    if (!esLocal(req)){ json(res, 403, {error:"Solo desde el propio PC"}); return; }

    if (ruta === "/api/carpetas"){
      if (!indice) construirIndice();
      const n = conteos();
      json(res, 200, {carpetas: config.carpetas.map(c =>
        ({id:c.id, nombre:c.nombre, ruta:c.ruta,
          pistas:n[c.id].pistas, videos:n[c.id].videos}))});
      return;
    }
    if (ruta === "/api/explorar"){
      const pedida = url.searchParams.get("ruta");
      if (!pedida){ json(res, 200, {ruta:null, padre:null, carpetas:unidades()}); return; }
      let abs;
      try{ abs = path.resolve(pedida); }catch(e){ json(res, 400, {error:"Ruta no válida"}); return; }
      let entradas;
      try{ entradas = fs.readdirSync(abs, {withFileTypes:true}); }
      catch(e){ json(res, 400, {error:"No puedo abrir esa carpeta"}); return; }
      const sub = entradas
        .filter(e => e.isDirectory() && !e.name.startsWith(".") && !e.name.startsWith("$")
                     && e.name.toLowerCase() !== "system volume information")
        .map(e => ({nombre:e.name, ruta:path.join(abs, e.name)}))
        .sort((a,b)=> a.nombre.localeCompare(b.nombre, "es", {numeric:true}));
      const esRaiz = path.parse(abs).root === abs;
      json(res, 200, {ruta:abs, padre: esRaiz ? null : path.dirname(abs), carpetas:sub});
      return;
    }
    // Las dos órdenes que cambian cosas exigen además el token del panel
    if (url.searchParams.get("token") !== TOKEN){ json(res, 403, {error:"Petición no autorizada"}); return; }
    if (ruta === "/api/carpetas/agregar"){
      const r = agregarCarpeta(url.searchParams.get("ruta") || "");
      json(res, r.error ? 400 : 200, r);
      return;
    }
    const r = quitarCarpeta(parseInt(url.searchParams.get("id"), 10));
    json(res, r.error ? 400 : 200, r);
    return;
  }

  /* — Todo lo demás: los archivos de la propia app — */
  const rel = ruta === "/" ? "index.html" : path.normalize(ruta).replace(/^([/\\])+/, "");
  const abs = path.join(APP, rel);
  if (abs !== APP && !abs.startsWith(APP + path.sep)){ res.writeHead(403).end("Prohibido"); return; }
  /* La carpeta de la app también guarda cosas que no son de la app: la
     configuración lleva las rutas de tu disco, y .git el historial entero.
     Nada de eso debe poder pedirse desde un navegador de la casa. */
  if (/(^|[/\\])\.git([/\\]|$)/i.test(rel) || /\.(cjs|json)$/i.test(rel)){
    const permitidos = ["manifest.webmanifest", "version.json"];
    if (!permitidos.includes(path.basename(rel).toLowerCase())){
      res.writeHead(404, {"Content-Type":TIPOS[".txt"]}).end("No encontrado");
      return;
    }
  }
  fs.readFile(abs, (err, datos)=>{
    if (err){ res.writeHead(404, {"Content-Type":TIPOS[".txt"]}).end("No encontrado"); return; }
    res.writeHead(200, {"Content-Type": tipoDe(abs), "Cache-Control":"no-cache"});
    res.end(req.method === "HEAD" ? undefined : datos);
  });
}).listen(PUERTO, PUENTE ? "127.0.0.1" : undefined, ()=>{
  cargarConfig();
  const t0 = Date.now();
  construirIndice();
  const n = conteos();
  console.log(`\n  Carpetas compartidas (${Date.now()-t0} ms de índice):`);
  if (!config.carpetas.length) console.log(`    (ninguna todavía: añádelas en el panel)`);
  config.carpetas.forEach(c =>
    console.log(`    📁 ${c.nombre}  ·  ${n[c.id].pistas} pistas · ${n[c.id].videos} vídeos`));

  const ips = [];
  Object.values(os.networkInterfaces()).forEach(l=> (l||[]).forEach(i=>{
    if (i.family === "IPv4" && !i.internal) ips.push(i.address);
  }));
  console.log(`\n  OndaAmp (la música):`);
  console.log(`    En este PC:      http://localhost:${PUERTO}   (panel: /panel)`);
  ips.forEach(ip=> console.log(`    En tu teléfono:  http://${ip}:${PUERTO}   (misma WiFi)`));
  console.log(`\n  OndaVideo (el cine):`);
  console.log(`    En este PC:      http://localhost:${PUERTO}/video/`);
  ips.forEach(ip=> console.log(`    En tu teléfono:  http://${ip}:${PUERTO}/video/   (misma WiFi)`));

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

  if (process.platform === "win32"){
    console.log(`\n  ── Cortafuegos ──────────────────────────────────────────`);
    console.log(`  La primera vez, Windows abre una ventana preguntando si`);
    console.log(`  permite el acceso a Node.js. Marca "Redes privadas" y pulsa`);
    console.log(`  PERMITIR ACCESO. Con eso queda hecho para siempre.`);
    console.log(`\n  Si ya no aparece, créala a mano en PowerShell COMO`);
    console.log(`  ADMINISTRADOR (botón derecho en Inicio → Terminal (Admin)):`);
    console.log(`    New-NetFirewallRule -DisplayName "OndaAmp" -Direction Inbound \``);
    console.log(`      -Protocol TCP -LocalPort ${PUERTO} -Action Allow -Profile Private`);
    console.log(`  ─────────────────────────────────────────────────────────`);
  }
  console.log(`\n  Ctrl+C para detener. Deja esta ventana abierta.\n`);

  // El panel es lo primero que hace falta ver: se abre solo
  if (process.platform === "win32" && !process.env.SIN_ABRIR){
    require("child_process").exec(`start "" "http://localhost:${PUERTO}/panel"`, ()=>{});
  }
});
