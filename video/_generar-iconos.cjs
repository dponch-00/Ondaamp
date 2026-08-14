// Genera los iconos PNG de OndaVideo sin dependencias externas.
// Mismo truco que el generador de OndaAmp: PNG a mano (firma + IHDR + IDAT + IEND).
// Dibujo: fondo oscuro redondeado + botón de reproducción rojo con triángulo blanco.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const TABLA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(tipo, datos) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([len, cuerpo, crc]);
}
function png(ancho, alto, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;   // 8 bits por canal
  ihdr[9] = 6;   // RGBA
  const filas = Buffer.alloc(alto * (ancho * 4 + 1));
  for (let y = 0; y < alto; y++) {
    filas[y * (ancho * 4 + 1)] = 0;   // filtro "none"
    rgba.copy(filas, y * (ancho * 4 + 1) + 1, y * ancho * 4, (y + 1) * ancho * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(filas, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* `margen` deja espacio seguro para los iconos "maskable" de Android. */
function dibujar(tam, margen) {
  const px = Buffer.alloc(tam * tam * 4);
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= tam || y >= tam || a <= 0) return;
    const i = (y * tam + x) * 4;
    const ia = a / 255, inv = 1 - ia;
    px[i]   = Math.round(px[i]   * inv + r * ia);
    px[i+1] = Math.round(px[i+1] * inv + g * ia);
    px[i+2] = Math.round(px[i+2] * inv + b * ia);
    px[i+3] = Math.max(px[i+3], a);
  };
  const m = Math.round(tam * margen);
  const lado = tam - m * 2;
  const radio = lado * 0.22;

  // Fondo oscuro con esquinas redondeadas y degradado sutil (familia OndaAmp)
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const lx = x - m, ly = y - m;
      if (lx < 0 || ly < 0 || lx >= lado || ly >= lado) continue;
      const dx = Math.min(lx, lado - 1 - lx), dy = Math.min(ly, lado - 1 - ly);
      let a = 255;
      if (dx < radio && dy < radio) {
        const d = Math.hypot(radio - dx, radio - dy);
        if (d > radio) continue;
        if (d > radio - 1.5) a = Math.round(255 * (radio - d) / 1.5);
      }
      const t = ly / lado;
      set(x, y, Math.round(24 + t * -8), Math.round(26 + t * -8), Math.round(31 + t * -9), a);
    }
  }

  // Botón de reproducción: rectángulo rojo redondeado, como una pantalla de cine
  const bw = Math.round(lado * 0.66), bh = Math.round(lado * 0.46);
  const bx = Math.round(m + (lado - bw) / 2), by = Math.round(m + (lado - bh) / 2);
  const rBtn = bh * 0.30;
  for (let y = by; y < by + bh; y++) {
    for (let x = bx; x < bx + bw; x++) {
      const dx = Math.min(x - bx, bx + bw - 1 - x), dy = Math.min(y - by, by + bh - 1 - y);
      let a = 255;
      if (dx < rBtn && dy < rBtn) {
        const d = Math.hypot(rBtn - dx, rBtn - dy);
        if (d > rBtn) continue;
        if (d > rBtn - 1.5) a = Math.round(255 * (rBtn - d) / 1.5);
      }
      // Rojo con leve degradado vertical para que no sea plano
      const t = (y - by) / bh;
      set(x, y, Math.round(255 - t * 25), Math.round(61 - t * 14), Math.round(61 - t * 14), a);
    }
  }

  // Triángulo blanco de "play", apuntando a la derecha, con bordes suavizados
  const tx = bx + bw * 0.395, ty = by + bh * 0.5;      // vértice izquierdo-centro
  const th = bh * 0.52, tw = th * 0.92;                // alto y ancho del triángulo
  for (let y = Math.floor(ty - th/2); y <= Math.ceil(ty + th/2); y++) {
    for (let x = Math.floor(tx); x <= Math.ceil(tx + tw); x++) {
      // Distancia dentro del triángulo: ancho permitido decrece con |y - centro|
      const fy = Math.abs(y - ty) / (th / 2);          // 0 en el centro, 1 en la punta
      const anchoAqui = tw * (1 - fy);
      const dentro = (x - tx) >= 0 && (x - tx) <= anchoAqui;
      if (!dentro) continue;
      const bordes = Math.min(x - tx, anchoAqui - (x - tx), (1 - fy) * th / 2);
      const a = Math.max(0, Math.min(255, Math.round(bordes * 220)));
      set(x, y, 255, 255, 255, a);
    }
  }
  return px;
}

const dir = __dirname;
const salidas = [
  ["ondavideo-192.png", 192, 0.06],
  ["ondavideo-512.png", 512, 0.06],
  ["ondavideo-maskable-512.png", 512, 0.14],   // más margen: Android recorta
];
for (const [nombre, tam, margen] of salidas) {
  fs.writeFileSync(path.join(dir, nombre), png(tam, tam, dibujar(tam, margen)));
  console.log("escrito", nombre, tam + "x" + tam);
}
