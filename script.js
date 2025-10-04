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
  ctx.font = `${testFontSize}px ${fontFamily}`;
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
  const glyphW = measurement.glyphWidth;
  const glyphH = measurement.glyphHeight;
  const glyphAspect = glyphW / glyphH;

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
  lastAsciiMetrics = { cols, rows, glyphW, glyphH, fontFamily };

  // dynamically scale <pre> font size to fit width (max ~90% of container)
  const containerWidth = asciiOutput.parentElement.clientWidth;
  const maxFontSize = Math.floor(containerWidth / cols);
  const displayFontSize = Math.min(14, maxFontSize); // cap at 14px
  const scaleFactor = displayFontSize / 140;
  const displayGlyphH = Math.max(1, Math.round(glyphH * scaleFactor));

  asciiOutput.style.fontFamily = fontFamily;
  asciiOutput.style.fontSize = `${displayFontSize}px`;
  asciiOutput.style.lineHeight = `${displayGlyphH}px`;
  asciiOutput.style.letterSpacing = "0px";

  return { ascii, cols, rows, glyphW: displayGlyphH, glyphH: displayGlyphH };
}

// handle file conversion
async function convertSelectedFile() {
  const file = fileInput.files[0];
  if (!file) {
    alert("Please choose an image file.");
    return;
  }

  const cols = Math.max(10, Math.min(600, parseInt(colsInput.value, 10) || 100));
  const fontFamily = fontSelect.value;

  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();

  const { ascii, cols: c, rows: r, glyphW, glyphH } = imageToAsciiFromImageElement(img, cols, fontFamily);

  asciiOutput.textContent = ascii;
  downloadTxtBtn.disabled = false;
  downloadPngBtn.disabled = false;

  // render ASCII to canvas for PNG
  const lines = ascii.split("\n");
  const maxLineLength = Math.max(...lines.map(line => line.length));

  // set canvas size based on longest line and number of rows
  asciiCanvas.width = maxLineLength * glyphW;
  asciiCanvas.height = lines.length * glyphH;

  const ctx = asciiCanvas.getContext("2d");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, asciiCanvas.width, asciiCanvas.height);

  ctx.fillStyle = "white";
  ctx.font = `${glyphH}px ${fontFamily}`;
  ctx.textBaseline = "top";

  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    // center each line horizontally
    const xOffset = Math.floor((asciiCanvas.width - line.length * glyphW) / 2);
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

// PNG download
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
