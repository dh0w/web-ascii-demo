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

/**
 * Measure the width (in px) of a single '@' glyph at a given font-size.
 */
function measureGlyphWidth(fontFamily, fontSizePx) {
  const cvs = document.createElement("canvas");
  const ctx = cvs.getContext("2d");
  ctx.font = `${fontSizePx}px ${fontFamily}`;
  const m = ctx.measureText("@");
  return Math.ceil(m.width);
}

/**
 * Downscale the source image to cols×rows, sample each pixel’s
 * luminance or transparency, and build the ASCII string.
 */
function imageToAsciiFromImageElement(img, cols) {
  // First pick rows so we roughly preserve aspect (using a small test font)
  const testW  = measureGlyphWidth(fontSelect.value, 10);
  const aspect = testW / 10; 
  const rows   = Math.max(
    1,
    Math.round(cols * aspect * (img.naturalHeight / img.naturalWidth))
  );

  // Draw into a tiny canvas
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
      if (a === 0) {
        // fully transparent → empty space
        ascii += " ";
      } else {
        const r    = data[i], g = data[i + 1], b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const idx  = Math.floor((gray / 255) * (CHARSET.length - 1));
        ascii += CHARSET[CHARSET.length - 1 - idx];
      }
    }
    ascii += "\n";
  }

  return { ascii, cols, rows };
}

/**
 * Main: converts fileInput → ASCII preview (scaled to fit) → full-res PNG canvas.
 */
async function convertSelectedFile() {
  const file = fileInput.files[0];
  if (!file) {
    alert("Please pick an image first.");
    return;
  }

  // load image
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode().catch(() => { /* ignore decode errors */ });

  // clamp columns between 1 and 1000
  const cols = Math.max(1, Math.min(1000, parseInt(colsInput.value, 10) || 250));
  const fontFamily = fontSelect.value || "monospace";

  // get raw ASCII
  const { ascii }    = imageToAsciiFromImageElement(img, cols);
  const trimmedAscii = ascii.replace(/ +$/gm, ""); // drop trailing blanks
  lastAsciiText      = trimmedAscii;
  downloadTxtBtn.disabled = false;
  downloadPngBtn.disabled = false;

  // ——— SCALE THE PREVIEW TO ALWAYS FILL ITS CONTAINER ———
  // CSS default font-size in style.css is 10px / line-height 10px
  const defaultFS   = 10;
  const glyphW      = measureGlyphWidth(fontFamily, defaultFS);
  const asciiWidth  = cols * glyphW;
  const containerW  = asciiOutput.parentElement.clientWidth;
  const scaleFactor = containerW / asciiWidth;

  asciiOutput.style.cssText = `
    display: inline-block;
    font-family: ${fontFamily}, monospace;
    font-size: ${defaultFS}px;
    line-height: ${defaultFS}px;
    white-space: pre;
    transform-origin: top left;
    transform: scale(${scaleFactor});
  `;

  // update preview text
  asciiOutput.textContent = trimmedAscii;

  // ——— FULL-RES PNG RENDER (unchanged) ———
  const lines = trimmedAscii.split("\n").filter(l => l);
  if (!lines.length) {
    asciiCanvas.width = asciiCanvas.height = 1;
    lastAsciiMetrics = { cssWidth: 1, cssHeight: 1, dpr: window.devicePixelRatio || 1 };
    return;
  }

  // measure glyph height == defaultFS
  const glyphH = defaultFS;
  const maxLen = Math.max(...lines.map(l => l.length));
  const cssW   = maxLen * glyphW;
  const cssH   = lines.length * glyphH;
  const dpr    = window.devicePixelRatio || 1;

  asciiCanvas.width  = Math.round(cssW * dpr);
  asciiCanvas.height = Math.round(cssH * dpr);
  asciiCanvas.style.width  = `${cssW}px`;
  asciiCanvas.style.height = `${cssH}px`;

  const ctx = asciiCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.font = `${defaultFS}px ${fontFamily}`;
  ctx.textBaseline = "top";
  ctx.fillStyle = "white";

  lines.forEach((line, y) => {
    const w    = Math.ceil(ctx.measureText(line).width);
    const xOff = Math.round((cssW - w) / 2);
    const yOff = y * glyphH;
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
