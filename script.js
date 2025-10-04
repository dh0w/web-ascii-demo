// script.js

const CHARSET       = "@#%*+=-:. ";  // dark → light
const fileInput     = document.getElementById("fileInput");
const convertBtn    = document.getElementById("convertBtn");
const asciiOutput   = document.getElementById("asciiOutput");
const colsInput     = document.getElementById("colsInput");
const fontSelect    = document.getElementById("fontSelect");
const downloadTxtBtn = document.getElementById("downloadTxtBtn");
const downloadPngBtn = document.getElementById("downloadPngBtn");
const asciiCanvas   = document.getElementById("asciiCanvas");

let lastAsciiText   = "";
let lastAsciiMetrics = null;

/**
 * Measure a monospace glyph in pixels for a given font size.
 * @param {string} fontFamily 
 * @param {number} fontSizePx 
 * @returns {{glyphWidth:number, glyphHeight:number}}
 */
function measureGlyphMetrics(fontFamily, fontSizePx) {
  const cvs = document.createElement("canvas");
  const ctx = cvs.getContext("2d");
  ctx.font = `${fontSizePx}px ${fontFamily}`;
  // Use "@" as representative character
  const metrics = ctx.measureText("@");
  const glyphWidth = Math.ceil(metrics.width);
  const glyphHeight = Math.ceil(fontSizePx);
  return { glyphWidth, glyphHeight };
}

/**
 * Scale the image down to `cols × rows` blocks, sample average luminance,
 * map to ASCII, and build a string.
 * @param {HTMLImageElement} imgElement 
 * @param {number} cols 
 * @returns {{ascii:string, cols:number, rows:number}}
 */
function imageToAsciiFromImageElement(imgElement, cols) {
  // Determine aspect‐correct number of rows
  // Use a temporary default font size to estimate character aspect
  const testMetrics = measureGlyphMetrics(fontSelect.value || "monospace", 10);
  const charAspect = testMetrics.glyphWidth / testMetrics.glyphHeight;
  const imgW = imgElement.naturalWidth;
  const imgH = imgElement.naturalHeight;
  const rows = Math.max(1, Math.round(cols * charAspect * (imgH / imgW)));

  // Draw into a tiny offscreen canvas
  const tmp = document.createElement("canvas");
  tmp.width  = cols;
  tmp.height = rows;
  const tctx = tmp.getContext("2d");
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(imgElement, 0, 0, cols, rows);

  const data = tctx.getImageData(0, 0, cols, rows).data;
  let ascii = "";

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const idx  = Math.floor((gray / 255) * (CHARSET.length - 1));
      ascii += CHARSET[CHARSET.length - 1 - idx];
    }
    ascii += "\n";
  }

  return { ascii, cols, rows };
}

/**
 * Main conversion routine: image → ASCII text preview → centered PNG canvas.
 */
async function convertSelectedFile() {
  const file = fileInput.files[0];
  if (!file) {
    alert("Please choose an image file.");
    return;
  }

  // clamp columns
  const cols       = Math.max(10, Math.min(600, parseInt(colsInput.value, 10) || 100));
  const fontFamily = fontSelect.value || "monospace";

  // Load image
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode().catch(() => { /* continue even if decode warning */ });

  // Generate raw ASCII + grid size
  const { ascii, cols: c, rows: r } = imageToAsciiFromImageElement(img, cols);

  // Trim trailing spaces so the <pre> preview shrink-wraps exactly
  const trimmedAscii = ascii.replace(/ +$/gm, "");
  lastAsciiText = trimmedAscii;
  asciiOutput.textContent = trimmedAscii;
  downloadTxtBtn.disabled = false;
  downloadPngBtn.disabled = false;

  // Prepare lines array
  const lines = trimmedAscii.split("\n").filter(line => line.length > 0);
  if (lines.length === 0) {
    // nothing to render
    asciiCanvas.width = asciiCanvas.height = 1;
    lastAsciiMetrics = { cssWidth: 1, cssHeight: 1, dpr: window.devicePixelRatio || 1 };
    return;
  }

  // Measure the font size actually used by the <pre> (in px)
  const computedStyle = getComputedStyle(asciiOutput);
  const displayFontSize = parseFloat(computedStyle.fontSize);

  // Measure glyph metrics at that size
  const { glyphWidth, glyphHeight } = measureGlyphMetrics(fontFamily, displayFontSize);

  // Compute target CSS-pixel dimensions
  const maxLineLen = Math.max(...lines.map(l => l.length));
  const cssWidth   = maxLineLen * glyphWidth;
  const cssHeight  = lines.length * glyphHeight;

  // Handle high-DPI
  const dpr = window.devicePixelRatio || 1;
  asciiCanvas.width  = Math.round(cssWidth  * dpr);
  asciiCanvas.height = Math.round(cssHeight * dpr);
  asciiCanvas.style.width  = `${cssWidth}px`;
  asciiCanvas.style.height = `${cssHeight}px`;

  const ctx = asciiCanvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, asciiCanvas.width, asciiCanvas.height);
  ctx.scale(dpr, dpr);

  // Fill background
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  // Draw each line centered
  ctx.font = `${displayFontSize}px ${fontFamily}`;
  ctx.fillStyle = "white";
  ctx.textBaseline = "top";

  for (let y = 0; y < lines.length; y++) {
    const line    = lines[y];
    const linePx  = Math.ceil(ctx.measureText(line).width);
    const xOffset = Math.round((cssWidth - linePx) / 2);
    const yOffset = y * glyphHeight;
    ctx.fillText(line, xOffset, yOffset);
  }

  lastAsciiMetrics = { cssWidth, cssHeight, dpr };
}

// TXT download
downloadTxtBtn.addEventListener("click", () => {
  if (!lastAsciiText) return;
  const blob = new Blob([lastAsciiText], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "ascii.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// PNG download
downloadPngBtn.addEventListener("click", () => {
  if (!lastAsciiMetrics) return;
  const url = asciiCanvas.toDataURL("image/png");
  const a   = document.createElement("a");
  a.href    = url;
  a.download= "ascii.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
});

// Convert on button click
convertBtn.addEventListener("click", () => {
  convertSelectedFile().catch(err => {
    console.error(err);
    alert("Conversion error: " + (err.message || err));
  });
});
