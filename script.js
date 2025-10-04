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

  // clamp columns between 10 and 600
  const cols = Math.max(10, Math.min(600, parseInt(colsInput.value, 10) || 100));
  const fontFamily = fontSelect.value || "monospace";

  // load image
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();

  // generate ASCII + metrics
  const { ascii, cols: c, rows: r, glyphW, glyphH } =
    imageToAsciiFromImageElement(img, cols, fontFamily);

  // strip trailing spaces on each line so <pre> collapses to content width
  const trimmedAscii = ascii.replace(/ +$/gm, "");

  // update the text preview
  asciiOutput.textContent = trimmedAscii;
  lastAsciiText = trimmedAscii;
  downloadTxtBtn.disabled = false;
  downloadPngBtn.disabled = false;

  // ----------------------
  // now render to canvas
  // ----------------------

  const lines = trimmedAscii.split("\n");
  // compute longest line in characters
  const maxLineLen = Math.max(...lines.map(l => l.length), 0);

  // set canvas size based on longest line + rows
  asciiCanvas.width = maxLineLen * glyphW;
  asciiCanvas.height = lines.length * glyphH;

  const ctx = asciiCanvas.getContext("2d");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, asciiCanvas.width, asciiCanvas.height);

  ctx.fillStyle = "white";
  ctx.font = `${glyphH}px ${fontFamily}`;
  ctx.textBaseline = "top";

  // draw each line centered horizontally
  for (let y = 0; y < lines.length; y++) {
    const line = lines[y] || "";
    const linePx = Math.ceil(ctx.measureText(line).width);
    const xOffset = Math.floor((asciiCanvas.width - linePx) / 2);
    ctx.fillText(line, xOffset, y * glyphH);
  }
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
