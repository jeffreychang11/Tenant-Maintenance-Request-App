// Downscales + re-encodes a photo entirely in the browser (Canvas API,
// no dependencies) before it ever reaches Supabase Storage, so a typical
// multi-MB phone photo lands around ~150KB instead. Falls back to the
// original file untouched if decoding/encoding fails for any reason
// (unsupported format, browser quirk, etc.) — never blocks the upload.
//
// HEIC/HEIF (the default iPhone photo format) is a special case: Canvas
// can't decode it at all outside Apple's own WebKit (no codec in Chromium
// or Firefox), so an iPhone photo would otherwise upload uncompressed AND
// show as a broken image to any landlord not on Safari/iOS. `heic-to`
// (a WASM build of libheif, dynamically imported so it only loads when a
// HEIC file is actually selected) converts it to a JPEG first, which then
// flows through the same downscale-and-recompress pipeline as any other
// photo — so the final output is always a normal, universally-viewable
// WebP/JPEG regardless of what the tenant's phone captured. Specifically
// `heic-to`, not the more popular `heic2any` — tried that first, and it
// failed to decode a real iPhone photo with "ERR_LIBHEIF format not
// supported" (its bundled libheif build is old/incomplete for HEVC-coded
// HEIC, which is what iPhones actually produce). `heic-to` tracks current
// libheif releases and decoded the same file correctly.

const MAX_DIMENSION = 1280;
const TARGET_BYTES = 150 * 1024;
const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5, 0.4, 0.3];

let webpSupported: boolean | null = null;

function supportsWebp(): boolean {
  if (webpSupported === null) {
    const canvas = document.createElement("canvas");
    webpSupported = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpSupported;
}

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  // Some browsers/OSes report HEIC files with a generic or empty MIME
  // type, so fall back to the file extension too.
  return /\.(heic|heif)$/i.test(file.name);
}

async function decodeHeic(file: File): Promise<Blob> {
  const { heicTo } = await import("heic-to");
  return heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
}

export async function compressImage(file: File): Promise<File> {
  try {
    const source: File | Blob = isHeic(file) ? await decodeHeic(file) : file;
    const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });

    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const outType = supportsWebp() ? "image/webp" : "image/jpeg";

    let best: Blob | null = null;
    for (const quality of QUALITY_STEPS) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outType, quality)
      );
      if (!blob) continue;
      best = blob;
      if (blob.size <= TARGET_BYTES) break;
    }
    if (!best) return file;

    const ext = outType === "image/webp" ? "webp" : "jpg";
    const name = file.name.replace(/\.[^.]+$/, "") + `.${ext}`;
    return new File([best], name, { type: outType, lastModified: Date.now() });
  } catch (err) {
    console.error("compressImage failed, falling back to original file", err);
    return file;
  }
}
