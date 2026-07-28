// Servidor estático mínimo para probar la PWA en local (y para servirla a tu
// teléfono por WiFi). Sin dependencias: solo Node.
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PUERTO = process.env.PORT || 8080;
const RAIZ = __dirname;
const TIPOS = {
  ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8", ".webmanifest":"application/manifest+json; charset=utf-8",
  ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon",
  ".css":"text/css; charset=utf-8", ".txt":"text/plain; charset=utf-8",
};

http.createServer((req,res)=>{
  let ruta = decodeURIComponent(req.url.split("?")[0]);
  if (ruta === "/") ruta = "/index.html";
  const abs = path.join(RAIZ, path.normalize(ruta).replace(/^([/\\])+/, ""));
  if (!abs.startsWith(RAIZ)){ res.writeHead(403).end("Prohibido"); return; }
  fs.readFile(abs, (err, datos)=>{
    if (err){ res.writeHead(404, {"Content-Type":"text/plain"}).end("No encontrado"); return; }
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(abs).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
      // Necesarias si algún día se usa SharedArrayBuffer; inocuas ahora.
      "Cross-Origin-Opener-Policy": "same-origin",
    });
    res.end(datos);
  });
}).listen(PUERTO, ()=>{
  const ips = [];
  Object.values(os.networkInterfaces()).forEach(l=> (l||[]).forEach(i=>{
    if (i.family === "IPv4" && !i.internal) ips.push(i.address);
  }));
  console.log(`\n  OndaAmp servido en:`);
  console.log(`    En este PC:      http://localhost:${PUERTO}`);
  ips.forEach(ip=> console.log(`    En tu teléfono:  http://${ip}:${PUERTO}   (misma WiFi)`));
  console.log(`\n  Ctrl+C para detener.\n`);
});
