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

// measure glyph width/height for a given font
function measureGlyph(fontFamily, testFontSize = 140, char = "@") {
  const pad = Math.ceil(testFontSize * 0.5);
  const cvs = document.createElement("canvas");
  const size = testFontSize * 4;
  cvs.width = size;
  cvs.height = size;
  const ctx = cvs.getContext("2d");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, cvs.width, cvs.height);
  ctx.fillStyle = "white";
  // quote the font family to handle multi-word names
  ctx.font = `${testFontSize}px "${fontFamily}"`;
  ctx.textBaseline = "top";
  ctx.fillText(char, pad, pad);

  const data = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
  let minX = cvs.width, minY = cvs.height, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < cvs.height; y++) {
    for (let x = 0; x < cvs.width; x++) {
      const i = (y * cvs.width + x) * 4;
      const v = data[i];
      if (v > 10) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) {
    const w = Math.ceil(ctx.measureText(char).width);
    return { glyphWidth: w, glyphHeight: testFontSize };
  }

  return { glyphWidth: maxX - minX + 1, glyphHeight: maxY - minY + 1 };
}

// generate ASCII text and compute metrics
function imageToAsciiFromImageElement(imgElement, cols, fontFamily) {
  const measurement = measureGlyph(fontFamily, 140, "@");
  const measuredGlyphW = measurement.glyphWidth;
  const measuredGlyphH = measurement.glyphHeight;
  const glyphAspect = measuredGlyphW / measuredGlyphH;

  const imgW = imgElement.naturalWidth;
  const imgH = imgElement.naturalHeight;

  // compute rows based on image aspect ratio and glyph aspect
  const rows = Math.max(1, Math.round(cols * glyphAspect * (imgH / imgW)));

  // draw resized image into small canvas
  const cvs = document.createElement("canvas");
  cvs.width = cols;
  cvs.height = rows;
  const ctx = cvs.getContext("2d");
  ctx.drawImage(imgElement, 0, 0, cols, rows);

  const imageData = ctx.getImageData(0, 0, cols, rows).data;
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
  lastAsciiMetrics = { cols, rows, measuredGlyphW, measuredGlyphH, fontFamily };

  // dynamically scale <pre> font size to fit width (max ~90% of container)
  const containerWidth = asciiOutput.parentElement.clientWidth || document.body.clientWidth;
  const maxFontSize = Math.max(6, Math.floor(containerWidth / cols));
  const displayFontSize = Math.min(14, maxFontSize); // cap at 14px
  const scaleFactor = displayFontSize / 140;
  const displayGlyphH = Math.max(1, Math.round(measuredGlyphH * scaleFactor));
  const displayGlyphW = Math.max(1, Math.round(measuredGlyphW * scaleFactor));

  asciiOutput.style.fontFamily = `"${fontFamily}", monospace`;
  asciiOutput.style.fontSize = `${displayFontSize}px`;
  asciiOutput.style.lineHeight = `${displayGlyphH}px`;
  asciiOutput.style.letterSpacing = "0px";

  return { ascii, cols, rows, glyphW: displayGlyphW, glyphH: displayGlyphH, displayFontSize };
}

// handle file conversion
async function convertSelectedFile() {
  const file = fileInput.files[0];
  if (!file) {
    alert("Please choose an image file.");
    return;
  }

  const cols = Math.max(10, Math.min(600, parseInt(colsInput.value, 10) || 100));
  const fontFamily = fontSelect.value || "monospace";

  const img = new Image();
  img.src = URL.createObjectURL(file);
  try {
    await img.decode();
  } catch (e) {
    // Some browsers may throw for certain images; continue anyway
  }

  const { ascii, cols: c, rows: r, glyphW, glyphH, displayFontSize } = imageToAsciiFromImageElement(img, cols, fontFamily);

  asciiOutput.textContent = ascii;
  downloadTxtBtn.disabled = false;
  downloadPngBtn.disabled = false;
  lastAsciiText = ascii;

  // --- NEW: render ASCII to canvas and center horizontally using measured glyph width ---
  const lines = ascii.split("\n");
  // Remove possible trailing empty line used by the generator so rows count matches visual lines
  if (lines.length && lines[lines.length - 1] === "") lines.pop();

  // compute maximum line length in characters
  const maxLineLength = Math.max(...lines.map(l => l.length), 0);

  // if there are no lines, create a minimal canvas
  if (lines.length === 0 || maxLineLength === 0) {
    asciiCanvas.width = Math.max(1, c * glyphW);
    asciiCanvas.height = Math.max(1, r * glyphH);
    const ctx = asciiCanvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, asciiCanvas.width, asciiCanvas.height);
    lastAsciiMetrics = { width: asciiCanvas.width, height: asciiCanvas.height };
    return;
  }

  // set canvas size based on longest line and number of rows
  const paddingX = Math.ceil(displayFontSize * 0.25);
  const paddingY = Math.ceil(displayFontSize * 0.25);
  asciiCanvas.width = maxLineLength * glyphW + paddingX * 2;
  asciiCanvas.height = lines.length * glyphH + paddingY * 2;

  const ctx = asciiCanvas.getContext("2d");
  // ensure crisp text on high-DPI displays
  const dpr = window.devicePixelRatio || 1;
  if (dpr !== 1) {
    // scale canvas for DPR then scale drawing operations down
    const physicalW = asciiCanvas.width * dpr;
    const physicalH = asciiCanvas.height * dpr;
    asciiCanvas.width = physicalW;
    asciiCanvas.height = physicalH;
    asciiCanvas.style.width = `${Math.round(physicalW / dpr)}px`;
    asciiCanvas.style.height = `${Math.round(physicalH / dpr)}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // draw background
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, asciiCanvas.width / (dpr || 1), asciiCanvas.height / (dpr || 1));

  // set font exactly as displayed
  ctx.fillStyle = "white";
  ctx.font = `${displayFontSize}px "${fontFamily}"`;
  ctx.textBaseline = "top";

  // draw each line centered horizontally
  for (let y = 0; y < lines.length; y++) {
    const line = lines[y] || "";
    const lineWidthPx = Math.ceil(ctx.measureText(line).width);
    const totalCanvasWidth = asciiCanvas.width / (dpr || 1);
    const xOffset = Math.round((totalCanvasWidth - lineWidthPx) / 2);
    const yPos = paddingY + y * glyphH;
    ctx.fillText(line, xOffset, yPos);
  }

  // store last metrics for PNG download if needed
  lastAsciiMetrics = { width: asciiCanvas.width / (dpr || 1), height: asciiCanvas.height / (dpr || 1) };
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

// PNG download
downloadPngBtn.addEventListener("click", () => {
  if (!lastAsciiMetrics) return;
  // ensure we export the displayed pixel size
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.round(lastAsciiMetrics.width);
  exportCanvas.height = Math.round(lastAsciiMetrics.height);
  const exportCtx = exportCanvas.getContext("2d");

  // draw background and copy from asciiCanvas (which may be high-DPI scaled)
  exportCtx.fillStyle = "black";
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  // draw the current asciiCanvas contents into exportCanvas
  // convert asciiCanvas to image and draw it scaled to export canvas
  const tmpUrl = asciiCanvas.toDataURL("image/png");
  const img = new Image();
  img.onload = () => {
    exportCtx.drawImage(img, 0, 0, exportCanvas.width, exportCanvas.height);
    const url = exportCanvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "ascii.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  img.src = tmpUrl;
});

// convert button
convertBtn.addEventListener("click", () => {
  convertSelectedFile().catch(err => {
    console.error(err);
    alert("Conversion error: " + (err && err.message ? err.message : err));
  });
});
