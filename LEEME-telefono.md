# 📱 OndaAmp en tu teléfono Android

Esta carpeta es OndaAmp empaquetado como **PWA**: una app que se instala en el teléfono, tiene su icono, se abre a pantalla completa y funciona sin internet.

## Qué cambia respecto a la versión de PC

En el teléfono no existe la API de "permisos de carpeta" que usa la versión de escritorio. Así que aquí OndaAmp usa otro modelo:

| | PC | Teléfono |
|---|---|---|
| La música | Se queda donde está; se guarda el permiso | **Se copia** a un almacén privado de la app |
| Al reabrir | Pide confirmar el acceso una vez | **Nada: la lista está lista al instante** |
| Espacio | No duplica nada | Ocupa lo que pesen las canciones copiadas |

Es un intercambio justo: ocupas espacio, pero nunca más ves un diálogo de permisos. Abajo del todo verás cuánto espacio llevas usado y cuánto hay disponible.

---

## Cómo ponerlo en el teléfono

Necesitas una dirección **https**. Android solo permite instalar apps web servidas de forma segura. La vía gratuita y estable es GitHub Pages.

### Opción A — GitHub Pages (recomendada, ~5 minutos, sin línea de comandos)

1. Crea una cuenta gratis en **github.com** si no tienes.
2. Pulsa **New repository**. Ponle de nombre `ondaamp`, márcalo **Public** y créalo.
3. En el repositorio vacío pulsa **uploading an existing file** y arrastra **estos 6 archivos** de la carpeta `pwa`:
   - `index.html`
   - `manifest.webmanifest`
   - `sw.js`
   - `icon-192.png`
   - `icon-512.png`
   - `icon-maskable-512.png`
   
   > No subas `servir.cjs`, `_generar-iconos.cjs` ni este archivo: no hacen falta.
4. Pulsa **Commit changes**.
5. Ve a **Settings → Pages**. En *Branch* elige `main` y carpeta `/ (root)`. Guarda.
6. Espera un minuto. GitHub te dará una dirección tipo `https://TUUSUARIO.github.io/ondaamp/`.
7. **Abre esa dirección en Chrome en tu Android.** Aparecerá el botón **⬇ Instalar** arriba (o usa el menú ⋮ → *Instalar aplicación*).
8. Listo: tendrás el icono de OndaAmp en tu pantalla de inicio.

> Aunque esté alojado en internet, **tu música nunca se sube a ningún sitio**. Solo se descarga la app (unos 200 KB) la primera vez; después funciona sin conexión.

### Opción B — Probarlo por WiFi antes de publicar nada

En el PC, **doble clic a `Probar en el telefono.bat`** (o desde una terminal: `node servir.cjs`).

Te dirá la dirección de tu PC en la red (algo como `http://192.168.1.X:8080`). Ábrela en el teléfono estando en la misma WiFi. **Deja la ventana negra abierta** mientras pruebas; al cerrarla, el servidor se detiene.

**Aviso importante:** por WiFi va sin cifrar, y Android reserva las funciones de app instalable para conexiones seguras. Así que por esta vía **podrás escuchar música y probar el sonido, pero no se instalará ni recordará tu biblioteca**. Sirve para ver si te convence antes de crear el repositorio.

---

## Cómo se usa en el teléfono

1. Pulsa **➕** (canciones sueltas) o **📁** (una carpeta entera con sus subcarpetas).
2. Elige la música. Verás **"Copiando al teléfono… 12/40"** mientras la guarda.
3. Ya está. Cierra la app cuando quieras: al volver a abrirla, tu biblioteca aparece sola.

Para liberar espacio, quita canciones o grupos con la **✕** de cada cabecera: la copia se borra del teléfono automáticamente.

## Detalles que conviene saber

- **Controles en la pantalla de bloqueo**: funcionan (play, pausa, siguiente) gracias a Media Session.
- **Todo el procesamiento de audio funciona**: ecualizador, reductor de ruido, auto-máster, crossfeed. El botón **✨ Mejora** sigue siendo el control diario.
- **Reproducción en segundo plano**: Android puede pausar la app si el sistema anda justo de memoria. Es una limitación de las apps web; si te resulta molesta, el siguiente paso sería empaquetarla como APK nativo.
- **Espacio**: OndaAmp pide a Android almacenamiento *persistente* para que no borre tu música al quedarse corto de espacio.
## 🔄 Actualizar la app

Como la app vive instalada en el teléfono, las novedades **no llegan solas**. El proceso es:

**1. Publicar (en el PC).** En GitHub Desktop pulsa **Push origin**. GitHub tarda 1–2 minutos en reconstruir el sitio.

**2. Actualizar (en el teléfono).** Abre OndaAmp → **⚙ Sonido** → sección **VERSIÓN**:

- Verás la versión **instalada** y la **publicada**.
- Pulsa **🔄 Buscar actualizaciones**.
- Si hay una nueva, aparece **⬇ Actualizar ahora** con un resumen de las novedades. Púlsalo y la app se recarga sola con la versión nueva.

La app también comprueba sola al abrirse (a los pocos segundos) y te avisa si hay novedades.

> **Tu música y tus ajustes no se tocan al actualizar.** Solo se renueva la app; la biblioteca, el volumen y los efectos se conservan. Está verificado.

Si alguna vez algo queda raro, cierra la app del todo (deslízala fuera de la lista de apps recientes) y vuelve a abrirla.
