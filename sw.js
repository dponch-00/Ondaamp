/* Service worker de OndaAmp.
   Guarda en caché el "esqueleto" de la app (HTML, iconos, manifiesto) para que
   abra sin internet. La música NUNCA pasa por aquí: vive en OPFS, el almacén
   privado del navegador, y se lee directamente. */
const VERSION = "ondaamp-v2.6";
const ESENCIALES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
];

self.addEventListener("install", e=>{
  e.waitUntil((async ()=>{
    const c = await caches.open(VERSION);
    // addAll falla entero si un recurso falla; se añaden de a uno para que un
    // icono ausente no impida instalar la app.
    await Promise.all(ESENCIALES.map(u=> c.add(u).catch(()=>{})));
    await self.skipWaiting();
  })());
});

// La app pide tomar el control de inmediato al pulsar "Actualizar ahora".
self.addEventListener("message", e=>{
  if (e.data && e.data.tipo === "saltar-espera") self.skipWaiting();
});

self.addEventListener("activate", e=>{
  e.waitUntil((async ()=>{
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n=> n !== VERSION).map(n=> caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e=>{
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // nada externo

  // version.json NUNCA se guarda en caché: es justo el archivo que sirve para
  // detectar si hay una versión nueva, así que debe leerse siempre de la red.
  if (url.pathname.endsWith("version.json")){
    e.respondWith(fetch(req, {cache:"no-store"}).catch(()=>
      new Response('{"version":"?"}', {headers:{"Content-Type":"application/json"}})));
    return;
  }

  // Red primero para el HTML (así una versión nueva se ve al momento),
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
