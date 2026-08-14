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
- **Karaoke** 🎤: la letra corriendo con la canción, resaltando el verso que suena
- **13 skins** de la Colección OndaAmp, con importador de skins clásicos `.wsz`
- **Funciona sin conexión** una vez instalada

## Servidor de casa

Para oír en el móvil toda la biblioteca del PC sin copiar nada. En el PC, dentro
de esta carpeta:

```bash
node servidor-media.cjs
```

Lee `F:\Flac Music` por omisión; para otra carpeta, pásala como argumento
(`node servidor-media.cjs "D:\Mi musica"`). Al arrancar te dice la dirección.

Al arrancar dibuja además un **código QR** con su dirección, y lo publica en
`/qr` como página (más nítida que la de la terminal). Hay dos formas de usarlo:

- **Desde la app instalada**: pulsa 🏠 y se abre el escáner. Apuntas al código
  del PC y se conecta sola. Necesita cámara, así que solo funciona en la app
  instalada (https); si tu navegador no trae lector de QR, cae al teclado.
- **Con la cámara del móvil**: escaneas el código y el navegador abre la app
  servida por el PC. Así la página y la música comparten origen y no hay nada
  que configurar — es el camino más seguro.

> Si usas la app instalada, reproducir depende de que tu navegador permita el
> acceso a la red local (Chrome 142 lo pide como permiso). Si no funciona, usa
> la segunda forma.

⚠️ **Windows bloquea las conexiones entrantes** mientras no exista una regla, y
no avisa: el servidor responde en el propio PC pero el móvil no llega. Una vez,
en PowerShell **como administrador**:

```powershell
New-NetFirewallRule -DisplayName "OndaAmp servidor de casa" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
```

Los archivos se sirven **con soporte de rangos**, así que puedes arrastrar la
barra de progreso en un FLAC de 40 MB sin esperar a que se descargue. Las
etiquetas y la carátula se leen pidiendo solo los primeros kilobytes de cada
pista, no el archivo entero.

> El servidor **solo lee** y solo escucha en tu red local: nada se sube a
> ningún sitio y nada sale de casa. Necesita el PC encendido y estar en la misma
> WiFi. La música no se copia al teléfono; si quieres oírla fuera de casa, añádela
> como siempre con ➕ o 📁.

## Karaoke

El botón 🎤 abre la letra a pantalla completa, con el verso que suena resaltado
y centrado. Tocar cualquier verso salta a ese momento de la canción.

Las letras se buscan por tres vías, en este orden: dentro del propio archivo
(etiqueta `LYRICS` de FLAC o `USLT` de MP3), en lo guardado de búsquedas
anteriores, y por último en [LRCLIB](https://lrclib.net), una base pública y
gratuita de letras sincronizadas.

> Esa última vía es **la única parte de OndaAmp que habla con un servidor**, y
> por eso no se hace sola: la primera vez aparece un cartel que enseña
> exactamente qué se va a enviar —título, artista, álbum y duración— antes de
> enviarlo. Ni el archivo ni tu biblioteca salen del dispositivo. La letra se
> guarda localmente para no volver a pedirla. Puedes marcar "buscar sola" si
> prefieres no confirmar cada canción.

Las letras en japonés se muestran tal cual: sin un diccionario de kanji no hay
forma de transcribirlas, y media transcripción sería peor que ninguna. La
lectura latina sí aparece en los versos escritos solo en kana.

## Privacidad

No hay analítica ni cuentas. La música que añades se guarda en el almacén
privado del propio navegador (OPFS), en tu dispositivo. Alojar la app en GitHub
Pages solo sirve para poder instalarla: el archivo se descarga una vez y después
funciona sin internet. La única petición externa posible es la búsqueda de
letras, y siempre bajo tu autorización (ver arriba).

## Estructura

| Archivo | Para qué |
|---|---|
| `index.html` | La aplicación completa |
| `manifest.webmanifest` | Metadatos para instalarla |
| `sw.js` | Service worker: hace que funcione sin conexión |
| `icon-*.png` | Iconos de la app |
| `servir.cjs` | Servidor local para pruebas (`node servir.cjs`) |
| `servidor-media.cjs` | Servidor de casa: publica tu carpeta de música en la red local |
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

En **Ajustes ⚙ → Apariencia** eliges entre las trece skins de la **Colección OndaAmp**:
Original, Studio Rack 1978, Neon Broadcast, Cassette Club '86, Polar FM, Noir Gold,
Hoshi Drive, Quantum Field Lab, Event Horizon, Glasswave y las tres de la familia
neón — Outrun Sunset, Tokyo Rain y Aurora Boreal. Son obra propia y van en CSS puro,
así que no engordan la descarga ni se pixelan en pantallas de alta densidad.

Los skins clásicos de Winamp **no se incluyen** por ser artwork de terceros, pero la
app trae un importador: con **＋ Importar skin .wsz** cargas los tuyos y se guardan
solo en tu dispositivo.

> El diseño móvil es una app de pantalla completa —biblioteca, pantalla de
> reproducción y ajustes—, no la rejilla de paneles del escritorio. Las skins
> aportan aquí su paleta, tipografía y controles; las rejillas propias de cada
> skin son exclusivas de la versión de escritorio.
