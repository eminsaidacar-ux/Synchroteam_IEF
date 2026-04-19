// Compresse une image (File ou dataURL) vers un Blob JPEG optimisé pour upload.
// Contrainte : largeur max 1600px (downscale proportionnel), qualité 70%.

export async function compressImage(source, { maxWidth = 1600, quality = 0.7 } = {}) {
  const bitmap = await toBitmap(source);
  const ratio  = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width  * ratio);
  const h = Math.round(bitmap.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);

  return await new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob failed'))),
      'image/jpeg',
      quality
    )
  );
}

async function toBitmap(source) {
  if (source instanceof Blob) return await createImageBitmap(source);
  if (typeof source === 'string') {
    const res = await fetch(source);
    const blob = await res.blob();
    return await createImageBitmap(blob);
  }
  throw new Error('Source image non supportée');
}

export function dataURLtoBlob(dataUrl) {
  const [head, body] = dataUrl.split(',');
  const mime = /data:(.*?);base64/.exec(head)?.[1] ?? 'image/jpeg';
  const bytes = atob(body);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}
