# 🎧 OndaAmp

Reproductor de música local con ecualizador, restauración de audio y auto-máster. Un solo archivo HTML, sin dependencias, sin servidores: **tu música nunca sale de tu dispositivo.**

Esta es la versión **PWA**, instalable en Android desde el navegador.

👉 **[Abrir OndaAmp](https://dponch-00.github.io/Ondaamp/)** · en Chrome para Android verás la opción de instalarla.

## Qué hace

- **Reproduce** MP3, FLAC, WAV, OGG, Opus, M4A y AAC
- **Ecualizador** de 10 bandas con presets, y un botón **✨ Mejora** que analiza cada canción y corrige su balance tonal automáticamente
- **Restauración de audio**: reductor de ruido por sustracción espectral (para el *hiss* de cintas viejas), quita-clics de vinilo, filtro de rumble, refuerzo de graves psicoacústico, realce de aire y crossfeed para auriculares
- **Biblioteca** agrupable por álbum, artista o carpeta, con búsqueda y carátulas
- **Enlace entre canciones**: encadena el disco sin huecos, o con fundido de 2 a 8 segundos
- **10 skins** de la Colección OndaAmp, con importador de skins clásicos `.wsz`
- **Funciona sin conexión** una vez instalada

## Privacidad

No hay analítica, ni cuentas, ni peticiones a servidores externos. La música que añades se guarda en el almacén privado del propio navegador (OPFS), en tu dispositivo. Alojar la app en GitHub Pages solo sirve para poder instalarla: el archivo se descarga una vez y después funciona sin internet.

## Estructura

| Archivo | Para qué |
|---|---|
| `index.html` | La aplicación completa |
| `manifest.webmanifest` | Metadatos para instalarla |
| `sw.js` | Service worker: hace que funcione sin conexión |
| `icon-*.png` | Iconos de la app |
| `servir.cjs` | Servidor local para pruebas (`node servir.cjs`) |
| `_generar-iconos.cjs` | Genera los iconos por código, sin dependencias |
| `LEEME-telefono.md` | Guía de instalación en Android |

## Enlace entre canciones

El selector **ENLACE**, junto a aleatorio y repetir, decide cómo empalma una
canción con la siguiente:

| Opción | Para qué |
|---|---|
| **Sin pausa** (por omisión) | Discos pensados para sonar de corrido — *The Dark Side of the Moon*, *Abbey Road*, cualquier mezcla continua |
| **Con pausa** | El comportamiento clásico: cada pista carga cuando termina la anterior |
| **Fundido 2 / 4 / 8 s** | Solapa el final con el principio, al estilo de una emisora |

Mientras suena una pista, la siguiente ya se está cargando en un segundo motor
de audio; al llegar el final solo hay que cruzar dos ganancias, y eso el
navegador lo hace con precisión de muestra. «Sin pausa» aplica aun así un cruce
de 60 ms: arrancar un `<audio>` tiene unos milisegundos de imprecisión, y ese
cruce mínimo tapa por igual un hueco o un solape sin oírse como fundido.

> Con archivos MP3 puede quedar un resto de silencio: el propio formato añade
> unas milésimas de relleno al principio y al final de cada pista, y eso está
> dentro del archivo. En FLAC, WAV o M4A el empalme es limpio.

## Skins

En **Ajustes ⚙ → Apariencia** eliges entre las diez skins de la **Colección OndaAmp**:
Original, Studio Rack 1978, Neon Broadcast, Cassette Club '86, Polar FM, Noir Gold,
Hoshi Drive, Quantum Field Lab, Event Horizon y Glasswave. Son obra propia y van en
CSS puro, así que no engordan la descarga ni se pixelan en pantallas de alta densidad.

Los skins clásicos de Winamp **no se incluyen** por ser artwork de terceros, pero la
app trae un importador: con **＋ Importar skin .wsz** cargas los tuyos y se guardan
solo en tu dispositivo.

> El diseño móvil es una app de pantalla completa —biblioteca, pantalla de
> reproducción y ajustes—, no la rejilla de paneles del escritorio. Las skins
> aportan aquí su paleta, tipografía y controles; las rejillas propias de cada
> skin son exclusivas de la versión de escritorio.
