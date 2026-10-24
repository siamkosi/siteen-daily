export const PHOTO_MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const PHOTO_MAX_STORED_BYTES = 5 * 1024 * 1024;
export const PHOTO_PRINT_EDGE = 2560;
export const PHOTO_PREVIEW_EDGE = 640;
export type PreparedPhoto = {
  image: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
  sourceBytes: number;
};

function encode(
  source: ImageBitmap,
  longest: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, longest / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error(
      "เบราว์เซอร์นี้ปรับขนาดรูปไม่ได้ กรุณาใช้ Chrome หรือ Edge รุ่นปัจจุบัน",
    );
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const width = canvas.width,
    height = canvas.height;
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        canvas.width = 1;
        canvas.height = 1;
        if (!blob || blob.type !== "image/jpeg")
          reject(new Error("ปรับขนาดรูปไม่สำเร็จ"));
        else resolve({ blob, width, height });
      },
      "image/jpeg",
      quality,
    ),
  );
}

// One decoded image at a time; normalize EXIF orientation and never upscale.
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    !file.size ||
    file.size > PHOTO_MAX_INPUT_BYTES
  )
    throw new Error("รองรับ JPG, PNG, WebP ขนาดไม่เกิน 20 MB ต่อรูปก่อนย่อ");
  let source: ImageBitmap;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      `อ่านรูป “${file.name}” ไม่สำเร็จ กรุณาตรวจว่าไฟล์รูปไม่เสีย`,
    );
  }
  try {
    if (
      !source.width ||
      !source.height ||
      source.width * source.height > 40_000_000
    )
      throw new Error(
        "รูปมีความละเอียดเกิน 40 ล้านพิกเซล กรุณาปรับขนาดก่อนเลือก",
      );
    let image = await encode(source, PHOTO_PRINT_EDGE, 0.9);
    if (image.blob.size > PHOTO_MAX_STORED_BYTES)
      image = await encode(source, PHOTO_PRINT_EDGE, 0.86);
    if (image.blob.size > PHOTO_MAX_STORED_BYTES)
      throw new Error("รูปหลังปรับขนาดยังเกิน 5 MB กรุณาเลือกไฟล์ขนาดเล็กลง");
    const preview = await encode(source, PHOTO_PREVIEW_EDGE, 0.78);
    return {
      image: image.blob,
      thumbnail: preview.blob,
      width: image.width,
      height: image.height,
      sourceBytes: file.size,
    };
  } finally {
    source.close();
  }
}

export function photoDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("อ่านรูปที่ปรับขนาดแล้วไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });
}
