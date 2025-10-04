// ASCII converter — robust measurement-based aspect fix
const CHARSET = "@#%*+=-:. "; // dark -> light
const fileInput = document.getElementById("fileInput");
const convertBtn = document.getElementById("convertBtn");
const asciiOutput = document.getElementById("asciiOutput");
const colsInput = document.getElementById("colsInput");
const fontSelect = document.getElementById("fontSelect");
const downloadBtn = document.getElementById("downloadBtn");

let lastAsciiText = "";

function measureGlyph(fontFamily, testFontSize = 120, char = "@") {
  // create a temporary high-res canvas to measure glyph bounding box
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
      const v = data[i]; // red channel since drawn white-on-black
      if (v > 10) { // threshold to detect anti-aliased pixels
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) {
    // fallback to measureText width & approximated height
    const w = Math.ceil(ctx.measureText(char).width);
    return { glyphWidth: w, glyphHeight: testFontSize };
  }
  const glyphWidth = maxX - minX + 1;
  const glyphHeight = maxY - minY + 1;
  return { glyphWidth, glyphHeight };
}

function imageToAsciiFromImageElement(imgElement, cols, fontFamily) {
  // 1) measure glyph metrics at a large font size to get precise ratio
  const measurement = measureGlyph(fontFamily, 140, "@");
  const glyphW = measurement.glyphWidth;
  const glyphH = measurement.glyphHeight;
  const glyphAspect = glyphW / glyphH; // width / height

  // 2) compute rows based on exact formula:
  // rows = cols * (glyphW / glyphH) * (imgHeight / imgWidth)
  const imgW = imgElement.naturalWidth;
  const imgH = imgElement.naturalHeight;
  let rows = Math.max(1, Math.round(cols * glyphAspect * (imgH / imgW)));

  // 3) draw resized image into a canvas of size cols x rows
  const cvs = document.createElement("canvas");
  cvs.width = cols;
  cvs.height = rows;
  const ctx = cvs.getContext("2d");
  ctx.drawImage(imgElement, 0, 0, cols, rows);

  // 4) sample pixels and map to CHARSET
  const imageData = ctx.getImageData(0, 0, cols, rows).data;
  let ascii = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = imageData[i], g = imageData[i + 1], b = imageData[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      // map grayscale to a char (dark to light)
      const idx = Math.floor((gray / 255) * (CHARSET.length - 1));
      const ch = CHARSET[CHARSET.length - 1 - idx];
      ascii += ch;
    }
    ascii += "\n";
  }

  // 5) set CSS font-size and line-height for <pre> so it visually matches measured glyphs
  // choose a comfortable display font size (in px) and scale glyph metrics
  const displayFontSize = 10; // px — change to taste
  const scaleFactor = displayFontSize / 140; // we measured at 140 px
  const displayGlyphW = Math.max(1, Math.round(glyphW * scaleFactor));
  const displayGlyphH = Math.max(1, Math.round(glyphH * scaleFactor));

  // apply styles so the DOM <pre> matches measured glyph cell size
  asciiOutput.style.fontFamily = fontFamily;
  asciiOutput.style.fontSize = `${displayFontSize}px`;
  asciiOutput.style.lineHeight = `${displayGlyphH}px`; // line-height = glyph height (px)
  // letter-spacing set so chars align more tightly (fine tune to taste)
  asciiOutput.style.letterSpacing = `0px`;

  // store for download
  lastAsciiText = ascii;

  return ascii;
}

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

  // generate ascii
  const ascii = imageToAsciiFromImageElement(img, cols, fontFamily);

  asciiOutput.textContent = ascii;
  downloadBtn.disabled = false;
}

convertBtn.addEventListener("click", () => {
  convertSelectedFile().catch(err => {
    console.error(err);
    alert("Conversion error: " + (err && err.message ? err.message : err));
  });
});

downloadBtn.addEventListener("click", () => {
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
