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

/** Measure glyph size (monospace) at a given font size in px */
function measureGlyphMetrics(fontFamily, fontSizePx) {
  const cvs = document.createElement("canvas");
  const ctx = cvs.getContext("2d");
  ctx.font = `${fontSizePx}px ${fontFamily}`;
  const m = ctx.measureText("@");
  return {
    glyphWidth:  Math.ceil(m.width),
    glyphHeight: Math.ceil(fontSizePx)
  };
}

/** Convert the image element into ASCII string + grid dimensions */
function imageToAsciiFromImageElement(img, cols) {
  // Estimate rows by sampling a quick small font to get char aspect
  const test   = measureGlyphMetrics(fontSelect.value, 10);
  const aspect = test.glyphWidth / test.glyphHeight;
  const rows   = Math.max(1, Math.round(cols * aspect * (img.naturalHeight / img.naturalWidth)));

  // Draw into tiny offscreen canvas
  const tmp = document.createElement("canvas");
  tmp.width  = cols;
  tmp.height = rows;
  const tctx = tmp.getContext("2d");
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(img, 0, 0, cols, rows);

  const data = tctx.getImageData(0, 0, cols, rows).data;
  let ascii = "";

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i    = (y * cols + x) * 4;
      const r    = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const idx  = Math.floor((gray / 255) * (CHARSET.length - 1));
      ascii += CHARSET[CHARSET.length - 1 - idx];
    }
    ascii += "\n";
  }

  return { ascii, cols, rows };
}

async function convertSelectedFile() {
  const file = fileInput.files[0];
  if (!file) {
    alert("Please choose an image file.");
    return;
  }

  // 1) load & decode
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode().catch(() => { /* ignore decode warnings */ });

  // 2) clamp cols & choose font
  const cols       = Math.max(10, Math.min(600, parseInt(colsInput.value, 10) || 100));
  const fontFamily = fontSelect.value || "monospace";

  // 3) generate ASCII text
  const { ascii }       = imageToAsciiFromImageElement(img, cols);
  const trimmedAscii    = ascii.replace(/ +$/gm, "");  // drop trailing spaces
  lastAsciiText         = trimmedAscii;
  downloadTxtBtn.disabled = false;
  downloadPngBtn.disabled = false;

  // 4) AUTO-SHRINK PREVIEW:
  //    compute a font-size that keeps cols × charWidth ≤ 95% container width
  const containerWidth = asciiOutput.parentElement.clientWidth;
  const baseSize       = 10; // matches your default CSS pre font-size
  const baseMetrics    = measureGlyphMetrics(fontFamily, baseSize);
  const scaleFactor    = Math.min(1, (containerWidth * 0.95) / (cols * baseMetrics.glyphWidth));
  const previewSize    = Math.max(4, Math.floor(baseSize * scaleFactor));

  asciiOutput.style
    .cssText = `
      display: inline-block;
      font-family: ${fontFamily}, monospace;
      font-size: ${previewSize}px;
      line-height: ${previewSize}px;
      white-space: pre;
    `;

  // 5) update the on-page text
  asciiOutput.textContent = trimmedAscii;

  // 6) RENDER TO CANVAS FOR PNG (unchanged, still uses full resolution):
  const lines       = trimmedAscii.split("\n").filter(l => l);
  const { glyphWidth, glyphHeight } = measureGlyphMetrics(fontFamily, previewSize);
  const maxLen      = Math.max(...lines.map(l => l.length));
  const cssW        = maxLen * glyphWidth;
  const cssH        = lines.length * glyphHeight;
  const dpr         = window.devicePixelRatio || 1;

  asciiCanvas.width  = Math.round(cssW * dpr);
  asciiCanvas.height = Math.round(cssH * dpr);
  asciiCanvas.style.width  = `${cssW}px`;
  asciiCanvas.style.height = `${cssH}px`;

  const ctx = asciiCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle   = "black";
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.font        = `${previewSize}px ${fontFamily}`;
  ctx.textBaseline = "top";
  ctx.fillStyle   = "white";

  lines.forEach((line, y) => {
    const w      = Math.ceil(ctx.measureText(line).width);
    const xOff   = Math.round((cssW - w) / 2);
    const yOff   = y * glyphHeight;
    ctx.fillText(line, xOff, yOff);
  });

  lastAsciiMetrics = { cssW, cssH, dpr };
}

// TXT download
downloadTxtBtn.addEventListener("click", () => {
  if (!lastAsciiText) return;
  const blob = new Blob([lastAsciiText], { type: "text/plain" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = "ascii.txt";
  a.click();
});

// PNG download
downloadPngBtn.addEventListener("click", () => {
  if (!lastAsciiMetrics) return;
  const url = asciiCanvas.toDataURL("image/png");
  const a   = document.createElement("a");
  a.href    = url;
  a.download= "ascii.png";
  a.click();
});

// wire up convert button
convertBtn.addEventListener("click", () => {
  convertSelectedFile().catch(e => {
    console.error(e);
    alert("Conversion error: " + e.message);
  });
});

// Hide the <pre> on load if empty
asciiOutput.textContent = "";
