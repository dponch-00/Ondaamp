# Bitacora de OndaAmp y OndaVideo en Skynet

Este es el documento vivo de entrega entre Daniel, Codex y Claude Code para
los reproductores de Skynet. Registra el estado implementado, las razones de
las decisiones, las pruebas realizadas y lo que aun merece revision.

**Regla de mantenimiento:** todo cambio de comportamiento, interfaz, red,
cache o version en OndaAmp/OndaVideo debe actualizar este archivo en el mismo
cambio. No reemplaza los invariantes de `C:\Users\Daniel\Documents\AudioPlayer\AGENTS.md`;
los complementa con historial y estado verificable.

## 2026-08-14 · Revisión de Claude Code: entrega verificada y una trampa cerrada

**Objetivo pedido por Daniel:** revisar lo entregado por Codex, resolver los
cabos sueltos del repositorio y dejar constancia aquí.

### La entrega de Codex quedó verificada

26 comprobaciones contra la puerta real `https://127.0.0.1:8899`, todas en
verde. Lo medido, no lo declarado:

- Los cinco iconos del Home se sirven (`image/png`) y el portal los pinta con
  el emoji como respaldo.
- La separación de la recarga cumple su objetivo: `/api/refrescar` devuelve
  **62 bytes** y `/api/indice` **355 KB** con 2296 pistas. Ese contraste es
  exactamente el falso «no responde» que se estaba corrigiendo.
- Versiones sincronizadas: OndaAmp `version.json` = `sw.js` = `APP_VERSION` =
  2.18; OndaVideo `ondavideo-v1.2.1`.
- Invariantes respetados: base por carpeta de página, cachés propias, `/media/`
  y `/api/` en directo, servidor solo en 127.0.0.1, panel bloqueado tras el
  proxy.
- Reproducción real: música y película responden `206` a `Range`.

### Trampa cerrada: el HTML de OndaVideo que se elegía primero

**Comportamiento anterior.** `servidor-media.cjs` resolvía `/video/` con este
orden: `..\OndaVideo.html` primero, `video\index.html` después. Funcionaba solo
porque el primero no existía.

**El riesgo.** Bastaba que ese archivo reapareciera —restaurar la rama vieja,
una copia de seguridad, un descuido— para que el cine sirviera **en silencio**
la versión de escritorio: 1526 líneas frente a 1670, sin `#bSkynet` y sin los
arreglos de móvil de esta entrega. Nadie habría visto un error; solo una app
peor.

**Comportamiento nuevo.** Manda `video/index.html`, el que se mantiene y el
que acompaña al service worker de esa carpeta. `..\OndaVideo.html` queda como
respaldo si el primero faltara.

**Prueba realizada.** Se colocó a propósito el `OndaVideo.html` viejo en la
raíz, se reinició Skynet y se pidió `/video/` por la puerta: sirvió **1670
líneas con `bSkynet` presente**. El señuelo no secuestró el cine. Después se
retiró.

### La rama `claude/ondavideo-local-player-8525a5`, archivada

Su propio `ONDAVIDEO.md` indicaba copiar `OndaVideo.html` a
`pwa/video/index.html`: eso ya ocurrió, y desde ahí la app evolucionó hasta
1.2.1. La rama era el **origen**, no trabajo pendiente, y su documentación
describe el mundo anterior a Skynet (`http://<ip>:8080/video/`).

Se archivó como etiqueta **`ondavideo-v1-escritorio`** en el repositorio
`AudioPlayer` y se borró la rama. Nada se pierde: las 1526 líneas se recuperan
con `git show ondavideo-v1-escritorio:OndaVideo.html`. **No fusionar esa
etiqueta a master**: volvería a colocar el archivo que el arreglo de arriba
neutraliza.

### Estado del servicio

Skynet reiniciado y verificado con el cambio dentro. Servicios en marcha.

---

## Estado actual

Fecha de corte: **2026-08-14**

| Componente | Version | Entrada por Skynet | Estado |
|---|---:|---|---|
| OndaAmp | 2.18 | `/musica/` | Local + biblioteca de red `Flac Music` |
| OndaVideo | 1.2.1 | `/video/` | Biblioteca de cine y UX movil corregida |
| Servidor multimedia | sin version separada | `127.0.0.1:8080` detras del proxy | Activo como hijo de Skynet |

Skynet fue reiniciado despues de instalar 2.18. Se verifico por la puerta real
`https://127.0.0.1:8899` que `/musica/api/refrescar` y
`/musica/api/indice` responden `200`. En la prueba habia **2294 pistas** dentro
de la carpeta compartida `Flac Music`; el numero puede cambiar con el contenido
del disco.

## Cambios entregados en OndaAmp

### Integracion con Skynet

- Bajo `/musica/`, el boton de casa queda fijo arriba a la izquierda y vuelve
  a `/`. Fuera de Skynet conserva su funcion original de escanear un servidor.
- La base de red se calcula desde la carpeta de la pagina:
  `location.origin + location.pathname.replace(/[^/]*$/, "")`. Nunca usar el
  origen pelado ni escribir `8080`/`8899` en el frontend.
- Se corrigieron URLs de medios cuyos nombres contienen `#` o `?`, escapando
  esos caracteres despues de `encodeURI`. No retirar esa correccion.

### Musica local y musica de red

En Skynet se conservan juntas las tres acciones:

- `Archivos`: agrega archivos del dispositivo actual.
- `Carpeta`: agrega una carpeta del dispositivo actual.
- `Flac Music`: carga la biblioteca compartida desde la PC.

La parte de red filtra el indice por el nombre exacto **`Flac Music`**. No debe
incorporar las pistas que puedan existir en `Movies`, porque esa carpeta se
mantiene para OndaVideo. Al volver a leer la red se reemplazan solo las pistas
remotas; las pistas locales permanecen.

### Recarga confiable de Flac Music

La recarga se dividio deliberadamente en dos peticiones:

1. `GET /api/refrescar` reconstruye el indice y devuelve solo un resumen JSON.
2. `GET /api/indice` descarga el catalogo ya preparado.

La separacion evita el falso aviso "no responde ...8899" observado en celular
cuando el escaneo y un JSON grande viajaban en una misma respuesta. El frontend
conserva una compatibilidad temporal con el servidor anterior mediante
`/api/indice?refrescar=1`. Si falla una recarga, la lista ya visible no se
borra.

### Rediseño exclusivo para celular: `ONDAAMP MOVIL 2.0`

El bloque esta al final del `<style>` de `pwa/index.html` y solo se activa con
`max-width:760px`. Escritorio conserva su composicion anterior.

- Cabecera nueva con marca centrada, casa a la izquierda y ajustes a la derecha.
- Herramientas en franjas: busqueda, fuentes, vistas y utilidades.
- Biblioteca tactil con grupos tipo tarjeta y filas mas comodas.
- Minirreproductor flotante con progreso, portada y controles grandes.
- Pantalla `Reproduciendo` recompuesta alrededor de portada, titulo, progreso,
  transporte, modos y volumen.
- Ajustes convertidos en tarjetas desplazables.
- Adaptacion adicional bajo 350 px y para telefonos de poca altura.
- Soporte de `prefers-reduced-motion`.
- Los skins se conservan: el layout usa `--bg`, `--panel`, `--panel2`, `--line`,
  `--txt`, `--mut` y `--acc` en vez de imponer una paleta movil unica.

Pruebas realizadas:

- 390x844: biblioteca, desplazamiento interno, minirreproductor,
  `Reproduciendo`, reproduccion real y ajustes.
- 320x700: cero desborde horizontal, tres fuentes visibles y biblioteca con
  desplazamiento propio.
- 1280x720: sigue entrando al layout de escritorio y no muestra el
  minirreproductor movil.
- Cambio al skin `Studio Rack 1978`: el modo movil adopto su fondo, panel y
  acento ambar; la rejilla de skins permanece accesible.

## Cambios entregados en OndaVideo

Version actual: **1.2.1** (`video/sw.js`: `ondavideo-v1.2.1`).

- Se corrigieron margenes, anchos y objetivos tactiles para telefono/tablet.
- Los chips superiores tienen desplazamiento horizontal tactil sin ensanchar
  la pagina.
- Las filas de contenido usan `scroll-snap` y desplazamiento tactil.
- Se elimino el desborde lateral general sin crear un segundo contenedor de
  scroll.
- La vista de reproduccion conserva desplazamiento vertical y
  `touch-action:pan-y`; al cerrarla restaura la posicion anterior del catalogo.
- El boton `#bSkynet` aparece bajo `/video/` y vuelve a la pantalla principal;
  fuera de Skynet permanece oculto.
- El service worker deja pasar `/media/` y `/api/` y solo limpia caches cuyo
  nombre comienza por `ondavideo`.

## Servidor multimedia

Archivo: `pwa/servidor-media.cjs`.

- En Skynet escucha solo en `127.0.0.1:8080` mediante `PUENTE_CHILD=1`.
- Un proceso sirve OndaAmp y OndaVideo.
- `GET /api/refrescar` es parte del contrato de OndaAmp 2.18.
- `/api/indice` entrega carpetas, pistas, videos y subtitulos.
- `/media/<id>/<ruta>` conserva `Range`/`206`; no modificar `enviarArchivo`
  sin probar saltos dentro de audio y video.
- El panel administrativo sigue bloqueado desde la red por Skynet.
- `servidor-config.json`, scripts y metadatos Git no se sirven por HTTP.

## Service workers y versiones

Cada entrega debe mantener sincronizados:

- OndaAmp: `APP_VERSION` en `index.html`, `version.json` y `ondaamp-vX.Y` en
  `sw.js`.
- OndaVideo: texto visible de version y `ondavideo-vX.Y.Z` en `video/sw.js`.

Los service workers comparten origen bajo Skynet. Cada uno borra **solo** sus
propias caches y deja `/api/` y `/media/` en directo. El HTML usa red primero.

## Repositorios y archivos modificados

`C:\Users\Daniel\Documents\AudioPlayer\pwa` tiene su propio repositorio Git
(`github.com/dponch-00/ondaamp`). La carpeta superior `AudioPlayer` ignora
`pwa/`; por eso los cambios deben revisarse y confirmarse desde el repositorio
`pwa`.

En este corte hay cambios sin confirmar en:

- `index.html`
- `servidor-media.cjs`
- `sw.js`
- `version.json`
- `video/index.html`
- `video/sw.js`
- `CAMBIOS-SKYNET.md` (este archivo)

No descartar esos cambios como si fueran residuos: son la entrega descrita aqui.

## Verificacion minima para el siguiente agente

```powershell
cd C:\Users\Daniel\Documents\AudioPlayer\pwa
node --check servidor-media.cjs
git diff --check

# Con Skynet en marcha y una sesion valida:
# https://localhost:8899/musica/
# https://localhost:8899/video/
```

Recorrido requerido despues de tocar interfaz o red:

1. OndaAmp escritorio.
2. OndaAmp 390x844 y 320 px de ancho.
3. Las tres fuentes: Archivos, Carpeta y Flac Music.
4. Reindexar Flac Music y reproducir una pista remota.
5. Cambiar al menos a un skin oscuro distinto y uno claro.
6. Abrir/cerrar `Reproduciendo` y `Ajustes`; comprobar sus desplazamientos.
7. OndaVideo en movil: catalogo, fila horizontal, detalle/reproduccion, cerrar y
   restaurar posicion.
8. Confirmar que `/media/` responde `206` a una peticion con `Range`.

## Temas recomendados para revision de Claude Code

- Medir el costo de renderizar mas de 2000 pistas en DOM y proponer
  virtualizacion sin frameworks si realmente mejora telefonos modestos.
- Revisar todos los skins, especialmente los claros e importados, contra el
  bloque movil final y contraste AA.
- Probar la instalacion/actualizacion real de la PWA en Android y iOS para
  confirmar que 2.18 sustituye caches anteriores sin intervención confusa.
- Revisar accesibilidad de nombres, foco, controles tactiles de 44 px y orden
  de lectura en `Reproduciendo` y `Ajustes`.
- No convertir el portal web en consola administrativa; la gestion de carpetas
  sigue perteneciendo a la PC.

## Plantilla para futuras actualizaciones

Anadir una entrada al inicio de `Estado actual` o debajo de una seccion fechada
con:

1. Fecha y version.
2. Objetivo pedido por Daniel.
3. Archivos modificados.
4. Comportamiento anterior y nuevo.
5. Decisiones/invariantes afectados.
6. Pruebas exactas y viewports.
7. Estado del servicio desplegado (reiniciado o pendiente).
8. Riesgos o trabajo pendiente para el siguiente agente.
