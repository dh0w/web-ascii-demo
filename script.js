const charset = "@#%*+=-:. ";
const input = document.getElementById("fileInput");
const output = document.getElementById("asciiOutput");

input.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();

  // Canvas setup
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const width = 120; // Adjust for output size
  const aspectRatio = img.height / img.width;
  const scale = 0.45; // Adjust vertical scaling to fix stretch
  const height = Math.floor(width * aspectRatio * scale);

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  const data = ctx.getImageData(0, 0, width, height).data;

  let ascii = "";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const c = charset[Math.floor(gray / (256 / charset.length))];
      ascii += c;
    }
    ascii += "\n";
  }

  output.textContent = ascii;
});
