/**
 * Client-side image compression for the face-rating uploads.
 *
 * Why: iPhone photos can be 5–20MB at native resolution. Server-side
 * resize (sharp, in analyze-face-unauth + analyze-face-full) brings them
 * down to 1024–1536px before hitting OpenAI, but uploading the full
 * original wastes bandwidth (especially on mobile), inflates Firebase
 * Storage cost, and slows the "Uploading X%" UX. We compress on-device
 * to a target that's already at or above the resolution the server uses,
 * so no fidelity is lost.
 *
 * Uses createImageBitmap with imageOrientation: 'from-image' so EXIF
 * rotation is applied during decode — no separate orientation library
 * needed (supported on all modern browsers; gracefully falls back).
 */

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_JPEG_QUALITY = 0.88;
const SKIP_THRESHOLD_BYTES = 800 * 1024; // <800KB: don't bother

export interface CompressOptions {
  /** Max width or height of the output. Default 1600. */
  maxDimension?: number;
  /** JPEG quality 0..1. Default 0.88. */
  quality?: number;
  /** If file is already ≤ this size AND within maxDimension, skip. */
  skipBelowBytes?: number;
}

/**
 * Returns a compressed File (always JPEG) or the original File if compression
 * isn't beneficial / possible. Never throws — falls back to the original on
 * any error, so the upload pipeline always gets a usable file.
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const maxDim = opts.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = opts.quality ?? DEFAULT_JPEG_QUALITY;
  const skipBelow = opts.skipBelowBytes ?? SKIP_THRESHOLD_BYTES;

  // Tiny files are not worth re-encoding.
  if (file.size < skipBelow) return file;

  if (typeof window === "undefined") return file;

  let bitmap: ImageBitmap | null = null;

  try {
    // Decode + apply EXIF orientation in one pass.
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
  } catch {
    // Fallback path for browsers without createImageBitmap support, or
    // when the format (HEIC) isn't decodable. Try via <img>.
    try {
      bitmap = await fallbackDecode(file);
    } catch {
      return file;
    }
  }

  if (!bitmap) return file;

  const { width, height } = bitmap;
  const longSide = Math.max(width, height);
  const scale = longSide > maxDim ? maxDim / longSide : 1;
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  // No downscale needed AND already a reasonable size? Skip.
  if (scale === 1 && file.size < 2.5 * 1024 * 1024) {
    bitmap.close?.();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
  if (!blob) return file;

  // Only return the compressed version if it's actually smaller.
  if (blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^/.]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/** Fallback decode via Image element. EXIF orientation NOT applied here. */
function fallbackDecode(file: File): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        const bm = await createImageBitmap(img);
        URL.revokeObjectURL(url);
        resolve(bm);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode-failed"));
    };
    img.src = url;
  });
}

export function describeCompression(orig: File, out: File): string {
  if (orig === out) return "no compression";
  const origMB = (orig.size / (1024 * 1024)).toFixed(1);
  const outKB = (out.size / 1024).toFixed(0);
  const ratio = Math.round((1 - out.size / orig.size) * 100);
  return `${origMB}MB → ${outKB}KB (${ratio}% smaller)`;
}
