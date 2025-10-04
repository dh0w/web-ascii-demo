const CHARSET = "@#%*+=-:. ";
const output = document.getElementById('asciiOutput');
const input = document.getElementById('fileInput');
const btn = document.getElementById('convertBtn');

btn.addEventListener('click', () => {
  const file = input.files[0];
  if (!file) return alert("Please select an image first!");

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => generateASCII(img);
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

function generateASCII(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // target width controls resolution
  const width = 100;
  const aspectRatio = img.height / img.width;

  // font characters are roughly twice as tall as wide, so apply scale factor
  const adjustedHeight = Math.floor(width * aspectRatio * 0.55);

  canvas.width = width;
  canvas.height = adjustedHeight;

  ctx.drawImage(img, 0, 0, width, adjustedHeight);
  const imageData = ctx.getImageData(0, 0, width, adjustedHeight).data;

  let ascii = "";
  for (let y = 0; y < adjustedHeight; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      const charIndex = Math.floor((gray / 255) * (CHARSET.length - 1));
      ascii += CHARSET[CHARSET.length - 1 - charIndex];
    }
    ascii += "\n";
  }

  output.textContent = ascii;
}
