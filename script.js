const CHARSET        = "@#%*+=-:. ";
const fileInput      = document.getElementById("fileInput");
const convertBtn     = document.getElementById("convertBtn");
const asciiOutput    = document.getElementById("asciiOutput");
const colsInput      = document.getElementById("colsInput");
const fontSelect     = document.getElementById("fontSelect");
const downloadTxtBtn = document.getElementById("downloadTxtBtn");
const downloadPngBtn = document.getElementById("downloadPngBtn");
const asciiCanvas    = document.getElementById("asciiCanvas");

let lastAsciiText    = "";
let lastAsciiMetrics = null;

/** Measure pixel‐width of “@” at a given font‐size */
function measureGlyphWidth(fontFamily, fontSizePx) {
  const cvs = document.createElement("canvas");
  const ctx = cvs.getContext("2d");
  ctx.font = `${fontSizePx}px ${fontFamily}`;
  return Math.ceil(ctx.measureText("@").width);
}

/** 
 * Downsample the image to cols×rows, then for each pixel:
 * - if alpha < 255 → space
 * - else map luminance → a CHARSET character 
 */
/**
 * Downsample the image to cols×rows, then for each pixel:
 * - if alpha === 0 → space
 * - else map luminance → a CHARSET character 
 */
function imageToAsciiFromImageElement(img, cols) {
  // estimate rows so the ASCII grid preserves aspect
  const testW  = measureGlyphWidth(fontSelect.value, 10);
  const aspect = testW / 10;
  const rows   = Math.max(
    1,
    Math.round(cols * aspect * (img.naturalHeight / img.naturalWidth))
  );

  // draw tiny offscreen canvas
  const tmp = document.createElement("canvas");
  tmp.width  = cols;
  tmp.height = rows;
  const tctx = tmp.getContext("2d");
  tctx.drawImage(img, 0, 0, cols, rows);

  const data = tctx.getImageData(0, 0, cols, rows).data;
  let ascii = "";

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const a = data[i + 3];

      // ←── UPDATED LINE ──→
      // Only pixels with alpha *exactly* 0 become blank.
      if (a === 0) {
        ascii += " ";
      } else {
        const r    = data[i],
              g    = data[i + 1],
              b    = data[i + 2],
              gray = 0.299 * r + 0.587 * g + 0.114 * b,
              idx  = Math.floor((gray / 255) * (CHARSET.length - 1));
        ascii += CHARSET[CHARSET.length - 1 - idx];
      }
    }
    ascii += "\n";
  }

  return { ascii, cols, rows };
}


async function convertSelectedFile() {
  const file = fileInput.files[0];
  if (!file) {
    alert("Please pick an image.");
    return;
  }

  // load image
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode().catch(() => {});

  // clamp columns [1…1000], default 250
  const cols       = Math.max(1, Math.min(1000, parseInt(colsInput.value, 10) || 250));
  const fontFamily = fontSelect.value || "monospace";

  // generate & trim ASCII
  const { ascii, rows } = imageToAsciiFromImageElement(img, cols);
  const trimmedAscii    = ascii.replace(/ +$/gm, "");
  lastAsciiText         = trimmedAscii;
  downloadTxtBtn.disabled = false;
  downloadPngBtn.disabled = false;

  // — scale & center preview in its fixed .preview box —
  const defaultFS = 10;  // must match your style.css
  const glyphW    = measureGlyphWidth(fontFamily, defaultFS);
  const asciiW    = cols * glyphW;
  const asciiH    = rows * defaultFS;
  const container = asciiOutput.parentElement;
  const cw        = container.clientWidth;
  const ch        = container.clientHeight;
  const scale     = Math.min(cw / asciiW, ch / asciiH);

  asciiOutput.style.cssText = `
    font-family: ${fontFamily}, monospace;
    font-size: ${defaultFS}px;
    line-height: ${defaultFS}px;
    white-space: pre;
    transform-origin: center top;
    transform: scale(${scale});
  `;
  asciiOutput.textContent = trimmedAscii;

  // — render full-res PNG (unchanged) —
  const lines = trimmedAscii.split("\n").filter(l => l);
  if (!lines.length) {
    asciiCanvas.width = asciiCanvas.height = 1;
    lastAsciiMetrics = { cssW:1, cssH:1, dpr:window.devicePixelRatio||1 };
    return;
  }

  const maxLen = Math.max(...lines.map(l => l.length));
  const cssW   = maxLen * glyphW;
  const cssH   = lines.length * defaultFS;
  const dpr    = window.devicePixelRatio || 1;

  asciiCanvas.width  = Math.round(cssW * dpr);
  asciiCanvas.height = Math.round(cssH * dpr);
  asciiCanvas.style.width  = `${cssW}px`;
  asciiCanvas.style.height = `${cssH}px`;

  const ctx = asciiCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.font         = `${defaultFS}px ${fontFamily}`;
  ctx.textBaseline = "top";
  ctx.fillStyle    = "white";

  lines.forEach((line, y) => {
    const w    = Math.ceil(ctx.measureText(line).width);
    const xOff = Math.round((cssW - w) / 2);
    const yOff = y * defaultFS;
    ctx.fillText(line, xOff, yOff);
  });

  lastAsciiMetrics = { cssWidth: cssW, cssHeight: cssH, dpr };
}

// wire up buttons
convertBtn.addEventListener("click", () =>
  convertSelectedFile().catch(e => alert("Conversion error: " + e.message))
);

downloadTxtBtn.addEventListener("click", () => {
  if (!lastAsciiText) return;
  const blob = new Blob([lastAsciiText], { type: "text/plain" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = "ascii.txt";
  a.click();
});

downloadPngBtn.addEventListener("click", () => {
  if (!lastAsciiMetrics) return;
  const url = asciiCanvas.toDataURL("image/png");
  const a   = document.createElement("a");
  a.href    = url;
  a.download= "ascii.png";
  a.click();
});

// hide empty preview on startup
asciiOutput.textContent = "";
