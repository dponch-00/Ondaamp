# 🎧 OndaAmp

Reproductor de música local con ecualizador, restauración de audio y auto-máster. Un solo archivo HTML, sin dependencias, sin servidores: **tu música nunca sale de tu dispositivo.**

Esta es la versión **PWA**, instalable en Android desde el navegador.

👉 **[Abrir OndaAmp](https://dponch-00.github.io/Ondaamp/)** · en Chrome para Android verás la opción de instalarla.

## Qué hace

- **Reproduce** MP3, FLAC, WAV, OGG, Opus, M4A y AAC
- **Ecualizador** de 10 bandas con presets, y un botón **✨ Mejora** que analiza cada canción y corrige su balance tonal automáticamente
- **Restauración de audio**: reductor de ruido por sustracción espectral (para el *hiss* de cintas viejas), quita-clics de vinilo, filtro de rumble, refuerzo de graves psicoacústico, realce de aire y crossfeed para auriculares
- **Biblioteca** agrupable por álbum, artista o carpeta, con búsqueda y carátulas
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

## Nota sobre los skins

La versión de escritorio admite skins clásicos de Winamp, que **no se incluyen aquí** por ser artwork de terceros. La app trae un importador: puedes cargar tus propios archivos `.wsz` y se guardan localmente en tu dispositivo.
