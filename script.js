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

  // 1) load image
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode().catch(() => {/* ignore */});

  // 2) clamp cols & pick font
  const cols       = Math.max(10, Math.min(10000,
                         parseInt(colsInput.value, 10) || 100));
  const fontFamily = fontSelect.value || "monospace";

  // 3) generate raw ASCII + drop trailing spaces
  const { ascii }    = imageToAsciiFromImageElement(img, cols);
  const trimmedAscii = ascii.replace(/ +$/gm, "");
  lastAsciiText      = trimmedAscii;
  downloadTxtBtn.disabled = false;
  downloadPngBtn.disabled = false;

  // 4) compute a “previewSize” so that, at base, cols × charWidth ≤ 95% container
  const containerW     = asciiOutput.parentElement.clientWidth * 0.95;
  const baseSize       = 10; // matches your default pre font-size
  const baseMetrics    = measureGlyphMetrics(fontFamily, baseSize);
  const idealSize      = (containerW * baseSize) /
                         (cols * baseMetrics.glyphWidth);
  const previewSize    = Math.max(1, Math.min(14, Math.floor(idealSize)));

  // 5) apply text-preview styles
  asciiOutput.style.display        = "inline-block";
  asciiOutput.style.whiteSpace     = "pre";
  asciiOutput.style.transformOrigin= "top left";
  asciiOutput.style.fontFamily     = `${fontFamily}, monospace`;
  asciiOutput.style.fontSize       = `${previewSize}px`;
  asciiOutput.style.lineHeight     = `${previewSize}px`;
  asciiOutput.style.transform      = "";       // reset any old scale

  // 6) set the text
  asciiOutput.textContent = trimmedAscii;

  // 7) now measure and scale horizontally if still too wide
  const smallMetrics = measureGlyphMetrics(fontFamily, previewSize);
  const asciiW       = cols * smallMetrics.glyphWidth;
  const scale        = Math.min(1, containerW / asciiW);
  asciiOutput.style.transform = `scale(${scale})`;

  // 8) finally render your full-res PNG in the canvas (unchanged)
  const lines = trimmedAscii.split("\n").filter(l => l.length);
  const { glyphWidth, glyphHeight } = smallMetrics;
  const cssW = Math.max(1, Math.max(...lines.map(l => l.length)) * glyphWidth);
  const cssH = Math.max(1, lines.length * glyphHeight);
  const dpr  = window.devicePixelRatio || 1;

  asciiCanvas.width  = Math.round(cssW * dpr);
  asciiCanvas.height = Math.round(cssH * dpr);
  asciiCanvas.style.width  = `${cssW}px`;
  asciiCanvas.style.height = `${cssH}px`;

  const ctx = asciiCanvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle = "black";
  ctx.fillRect(0,0,cssW,cssH);
  ctx.font = `${previewSize}px ${fontFamily}`;
  ctx.textBaseline = "top";
  ctx.fillStyle = "white";

  lines.forEach((line, y) => {
    const w    = Math.ceil(ctx.measureText(line).width);
    const xOff = Math.round((cssW - w) / 2);
    const yOff = y * glyphHeight;
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
