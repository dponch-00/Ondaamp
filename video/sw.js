/* Service worker de OndaVideo.
   Guarda en caché el "esqueleto" de la app (HTML, iconos, manifiesto) para que
   abra sin internet. Las películas NUNCA pasan por aquí: llegan en directo del
   servidor de casa (/media/…) y no se guardan en el teléfono. */
const VERSION = "ondavideo-v1.0";
const ESENCIALES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./ondavideo-192.png",
  "./ondavideo-512.png",
  "./ondavideo-maskable-512.png",
];

self.addEventListener("install", e=>{
  e.waitUntil((async ()=>{
    const c = await caches.open(VERSION);
    // De a uno: que un icono ausente no impida instalar la app
    await Promise.all(ESENCIALES.map(u=> c.add(u).catch(()=>{})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e=>{
  e.waitUntil((async ()=>{
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n=> n !== VERSION && n.startsWith("ondavideo")).map(n=> caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e=>{
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;              // nada externo
  if (url.pathname.includes("/media/") || url.pathname.includes("/api/")) return;  // el cine va en directo

  // Red primero para el HTML (una versión nueva se ve al momento),
  // con la caché como respaldo cuando no hay conexión.
  const esDocumento = req.mode === "navigate" ||
                      (req.headers.get("accept")||"").includes("text/html");
  if (esDocumento){
    e.respondWith((async ()=>{
      try{
        const red = await fetch(req);
        const c = await caches.open(VERSION);
        c.put("./index.html", red.clone());
        return red;
      }catch(err){
        return (await caches.match("./index.html")) ||
               (await caches.match("./")) ||
               new Response("Sin conexión y sin copia guardada", {status:503});
      }
    })());
    return;
  }

  // El resto (iconos, manifiesto): caché primero, es contenido estable.
  e.respondWith((async ()=>{
    const hit = await caches.match(req);
    if (hit) return hit;
    try{
      const red = await fetch(req);
      if (red.ok){ const c = await caches.open(VERSION); c.put(req, red.clone()); }
      return red;
    }catch(err){
      return new Response("", {status:504});
    }
  })());
});
