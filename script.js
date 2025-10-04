/* ASCII Image Converter — corrected rendering
   Key fixes:
   - Keep text preview and canvas glyph sizing consistent
   - Measure glyph width with measureText and derive glyph height from font size
   - Properly handle devicePixelRatio when sizing and drawing the canvas
   - Center lines horizontally using measured pixel widths (not character counts)
*/

const CHARSET = "@#%*+=-:. "; // dark -> light

const fileInput = document.getElementById("fileInput");
const convertBtn = document.getElementById("convertBtn");
const asciiOutput = document.getElementById("asciiOutput");
const colsInput = document.getElementById("colsInput");
const fontSelect = document.getElementById("fontSelect");
const downloadTxtBtn = document.getElementById("downloadTxtBtn");
const downloadPngBtn = document.getElementById("downloadPngBtn");
const asciiCanvas = document.getElementById("asciiCanvas");

let lastAsciiText = "";
let lastAsciiMetrics = null;

// Measure average glyph width (using measureText) and glyph height (approx from fontSize)
function measureGlyphMetrics(fontFamily, fontSizePx) {
  const cvs = document.createElement("canvas");
  const ctx = cvs.getContext("2d");
  ctx.font = `${fontSizePx}px ${fontFamily}`;
  const metrics = ctx.measureText("@");
  const glyphWidth = Math.ceil(metrics.width);
  // approximate glyph height as fontSize (safe for monospace drawing with textBaseline top)
  const glyphHeight = Math.ceil(fontSizePx);
  return { glyphWidth, glyphHeight };
}

// Convert image element to ASCII text and compute display glyph metrics
function imageToAsciiFromImageElement(imgElement, cols, fontFamily, displayFontSize) {
  // measure glyph using chosen font size
  const { glyphWidth, glyphHeight } = measureGlyphMetrics(fontFamily, displayFontSize);

  // compute rows based on aspect ratio and character aspect
  const imgW = imgElement.naturalWidth;
  const imgH = imgElement.naturalHeight;
  const charAspect = glyphWidth / glyphHeight;
  const rows = Math.max(1, Math.round(cols * charAspect * (imgH / imgW)));

  // draw scaled-down image to temporary canvas (cols x rows)
  const tmp = document.createElement("canvas");
  tmp.width = cols;
  tmp.height = rows;
  const tctx = tmp.getContext("2d");
  // ensure smoothing on for better resampling
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(imgElement, 0, 0, cols, rows);

  const imageData = tctx.getImageData(0, 0, cols, rows).data;
  let ascii = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = imageData[i], g = imageData[i + 1], b = imageData[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const idx = Math.floor((gray / 255) * (CHARSET.length - 1));
      const ch = CHARSET[CHARSET.length - 1 - idx];
      ascii += ch;
    }
    ascii += "\n";
  }

  lastAsciiText = ascii;
  lastAsciiMetrics = { cols, rows, glyphWidth, glyphHeight, displayFontSize, fontFamily };

  // update preview styling to match measured display size
  asciiOutput.style.fontFamily = `${fontFamily}, monospace`;
  asciiOutput.style.fontSize = `${displayFontSize}px`;
  asciiOutput.style.lineHeight = `${glyphHeight}px`;

  return { ascii, cols, rows, glyphWidth, glyphHeight };
}

// Convert selected file and render to canvas
async function convertSelectedFile() {
  const file = fileInput.files[0];
  if (!file) {
    alert("Please choose an image file.");
    return;
  }

  const cols = Math.max(10, Math.min(600, parseInt(colsInput.value, 10) || 100));
  const fontFamily = fontSelect.value || "monospace";

  // choose display font size for preview (try to fit the preview container)
  const containerWidth = asciiOutput.parentElement.clientWidth || document.body.clientWidth;
  // simple heuristic: previewFontSize such that cols * approx glyph width <= containerWidth
  // try a few font sizes from 14 downwards to find a fit
  let displayFontSize = 14;
  while (displayFontSize > 6) {
    const { glyphWidth } = measureGlyphMetrics(fontFamily, displayFontSize);
    if (glyphWidth * cols <= Math.round(containerWidth * 0.95)) break;
    displayFontSize--;
  }

  // load image
  const img = new Image();
  img.src = URL.createObjectURL(file);
  try { await img.decode(); } catch (e) { /* continue even if decode fails */ }

  const { ascii, cols: c, rows: r, glyphWidth, glyphHeight } =
    imageToAsciiFromImageElement(img, cols, fontFamily, displayFontSize);

  // show ASCII text in <pre>
  // remove trailing spaces on every row
  const trimmedAscii = ascii.replace(/ +$/gm, "");
  asciiOutput.textContent = trimmedAscii;
  lastAsciiText = trimmedAscii;

  downloadTxtBtn.disabled = false;
  downloadPngBtn.disabled = false;

  // prepare canvas for PNG rendering
  // split lines and trim final empty line if present
  const lines = ascii.split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();

  const maxLineLength = Math.max(...lines.map(l => l.length), 0);

  // compute target CSS pixel size
  const cssWidth = Math.max(1, maxLineLength * glyphWidth);
  const cssHeight = Math.max(1, lines.length * glyphHeight);

  // handle DPR correctly: set canvas physical size then scale drawing context
  const dpr = window.devicePixelRatio || 1;
  asciiCanvas.width = Math.round(cssWidth * dpr);
  asciiCanvas.height = Math.round(cssHeight * dpr);
  asciiCanvas.style.width = `${cssWidth}px`;
  asciiCanvas.style.height = `${cssHeight}px`;

  const ctx = asciiCanvas.getContext("2d");
  // reset transform and scale for DPR
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, asciiCanvas.width, asciiCanvas.height);
  ctx.scale(dpr, dpr);

  // draw background
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  // set font and draw each line horizontally centered using measured width
  ctx.fillStyle = "white";
  ctx.textBaseline = "top";
  ctx.font = `${displayFontSize}px ${fontFamily}`;

  for (let y = 0; y < lines.length; y++) {
    const line = lines[y] || "";
    const lineWidthPx = Math.ceil(ctx.measureText(line).width);
    const x = Math.round((cssWidth - lineWidthPx) / 2); // center horizontally
    const yPos = y * glyphHeight;
    ctx.fillText(line, x, yPos);
  }

  // store metrics for download
  lastAsciiMetrics = { cssWidth, cssHeight, dpr };
}

// TXT download
downloadTxtBtn.addEventListener("click", () => {
  if (!lastAsciiText) return;
  const blob = new Blob([lastAsciiText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ascii.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// PNG download (use the canvas already drawn with proper DPR handling)
downloadPngBtn.addEventListener("click", () => {
  if (!lastAsciiMetrics) return;
  const url = asciiCanvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = "ascii.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
});

// convert button
convertBtn.addEventListener("click", () => {
  convertSelectedFile().catch(err => {
    console.error(err);
    alert("Conversion error: " + (err && err.message ? err.message : err));
  });
});
