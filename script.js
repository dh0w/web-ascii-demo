const CHARSET        = "@#%*+=-:. ";
const fileInput      = document.getElementById("fileInput");
const fileLabel      = document.getElementById("fileLabel");
const convertBtn     = document.getElementById("convertBtn");
const asciiOutput    = document.getElementById("asciiOutput");
const previewWrapper = document.getElementById("previewWrapper");
const resolutionSlider = document.getElementById("resolutionSlider");
const resolutionValue = document.getElementById("resolutionValue");
const downloadTxtBtn = document.getElementById("downloadTxtBtn");
const downloadPngBtn = document.getElementById("downloadPngBtn");
const asciiCanvas    = document.getElementById("asciiCanvas");
const copyButton     = document.getElementById("copyButton");

let lastAsciiText    = "";
let lastAsciiMetrics = null;

// Copy button (placeholder for now)
copyButton.addEventListener("click", () => {
  // Placeholder - will be implemented later
  alert("Coming soon!");
});

// Update slider value display
resolutionSlider.addEventListener("input", (e) => {
  const value = parseInt(e.target.value);
  const percentage = Math.round(((value - 50) / (1000 - 50)) * 100);
  resolutionValue.textContent = percentage + "%";
});

// Update file input label
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    fileLabel.textContent = e.target.files[0].name;
    fileLabel.classList.add("has-file");
  } else {
    fileLabel.textContent = "Choose an image file";
    fileLabel.classList.remove("has-file");
  }
});

function measureGlyphWidth(fontFamily, fontSizePx) {
  const cvs = document.createElement("canvas");
  const ctx = cvs.getContext("2d");
  ctx.font = `${fontSizePx}px ${fontFamily}`;
  return Math.ceil(ctx.measureText("@").width);
}

function imageToAsciiFromImageElement(img, cols) {
  const testW  = measureGlyphWidth("monospace", 10);
  const aspect = testW / 10;
  const rows   = Math.max(
    1,
    Math.round(cols * aspect * (img.naturalHeight / img.naturalWidth) * 0.95)
  );

  const tmp = document.createElement("canvas");
  tmp.width  = cols;
  tmp.height = rows;
  const tctx = tmp.getContext("2d");
  
  tctx.fillStyle = "white";
  tctx.fillRect(0, 0, cols, rows);
  tctx.drawImage(img, 0, 0, cols, rows);

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

async function convertSelectedFile() {
  const file = fileInput.files[0];
  if (!file) {
    alert("Please select an image first.");
    return;
  }

  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode().catch(() => {});

  const cols = parseInt(resolutionSlider.value, 10);
  const fontFamily = "monospace";

  const { ascii, rows } = imageToAsciiFromImageElement(img, cols);
  const trimmedAscii = ascii.replace(/ +$/gm, "");
  lastAsciiText = trimmedAscii;
  downloadTxtBtn.disabled = false;
  downloadPngBtn.disabled = false;

  const defaultFS = 10;
  const glyphW = measureGlyphWidth(fontFamily, defaultFS);
  const asciiW = cols * glyphW;
  const asciiH = rows * defaultFS;
  const container = asciiOutput.parentElement;
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const scale = Math.min(cw / asciiW, ch / asciiH);

  asciiOutput.style.cssText = `
    font-family: ${fontFamily}, monospace;
    font-size: ${defaultFS}px;
    line-height: ${defaultFS}px;
    white-space: pre;
    transform-origin: center center;
    transform: scale(${scale});
  `;
  asciiOutput.textContent = trimmedAscii;

  const lines = trimmedAscii.split("\n").filter(l => l);
  if (!lines.length) {
    asciiCanvas.width = asciiCanvas.height = 1;
    lastAsciiMetrics = { cssW:1, cssH:1, dpr:window.devicePixelRatio||1 };
    return;
  }

  const maxLen = Math.max(...lines.map(l => l.length));
  const paddedLines = lines.map(line => line.padEnd(maxLen, ' '));
  
  const tmpCanvas = document.createElement("canvas");
  const tmpCtx = tmpCanvas.getContext("2d");
  tmpCtx.font = `${defaultFS}px ${fontFamily}`;
  const cssW = Math.ceil(tmpCtx.measureText(paddedLines[0]).width);
  const cssH = paddedLines.length * defaultFS;
  const dpr = window.devicePixelRatio || 1;

  asciiCanvas.width  = Math.round(cssW * dpr);
  asciiCanvas.height = Math.round(cssH * dpr);
  asciiCanvas.style.width  = `${cssW}px`;
  asciiCanvas.style.height = `${cssH}px`;

  const ctx = asciiCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.font = `${defaultFS}px ${fontFamily}`;
  ctx.textBaseline = "top";
  ctx.fillStyle = "black";

  paddedLines.forEach((line, y) => {
    const yOff = y * defaultFS;
    ctx.fillText(line, 0, yOff);
  });

  lastAsciiMetrics = { cssWidth: cssW, cssHeight: cssH, dpr };
}

convertBtn.addEventListener("click", () =>
  convertSelectedFile().catch(e => alert("Conversion error: " + e.message))
);

downloadTxtBtn.addEventListener("click", () => {
  if (!lastAsciiText) return;
  const blob = new Blob([lastAsciiText], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ascii.txt";
  a.click();
});

downloadPngBtn.addEventListener("click", () => {
  if (!lastAsciiMetrics) return;
  const url = asciiCanvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = "ascii.png";
  a.click();
});

asciiOutput.textContent = "";