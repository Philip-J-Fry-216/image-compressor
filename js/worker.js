self.onmessage = async (e) => {
  const { file, format, quality } = e.data;

  try {
    const result = await processImage(file, format, quality);
    self.postMessage({ success: true, result });
  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};

async function processImage(file, format, quality) {
  if (format === "original" || quality === "original") {
    return {
      blob: file,
      format: file.type,
      sizeBefore: file.size,
      sizeAfter: file.size
    };
  }

  // ВАЖНО: правильная загрузка изображения в воркере
  const bitmap = await createImageBitmap(file);

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(bitmap, 0, 0);

  const blob = await canvas.convertToBlob({
    type: format,
    quality: quality / 100
  });

  return {
    blob,
    format,
    sizeBefore: file.size,
    sizeAfter: blob.size
  };
}
