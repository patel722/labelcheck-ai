const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;

export const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type ValidatedImage = {
  image: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
};

function detectMimeType(image: Buffer): ValidatedImage["mimeType"] | undefined {
  if (
    image.length >= 8 &&
    image[0] === 0x89 &&
    image[1] === 0x50 &&
    image[2] === 0x4e &&
    image[3] === 0x47 &&
    image[4] === 0x0d &&
    image[5] === 0x0a &&
    image[6] === 0x1a &&
    image[7] === 0x0a
  ) {
    return "image/png";
  }

  if (image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    image.length >= 12 &&
    image.toString("ascii", 0, 4) === "RIFF" &&
    image.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return undefined;
}

function readPngDimensions(image: Buffer): { width: number; height: number } | undefined {
  if (image.length < 24 || image.toString("ascii", 12, 16) !== "IHDR") return undefined;
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
}

function readJpegDimensions(image: Buffer): { width: number; height: number } | undefined {
  let offset = 2;
  while (offset + 9 < image.length) {
    if (image[offset] !== 0xff) return undefined;
    const marker = image[offset + 1];
    const size = image.readUInt16BE(offset + 2);
    if (size < 2) return undefined;
    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      return { height: image.readUInt16BE(offset + 5), width: image.readUInt16BE(offset + 7) };
    }
    offset += 2 + size;
  }
  return undefined;
}

function readWebpDimensions(image: Buffer): { width: number; height: number } | undefined {
  const chunkType = image.toString("ascii", 12, 16);
  if (chunkType === "VP8X" && image.length >= 30) {
    return {
      width: 1 + image.readUIntLE(24, 3),
      height: 1 + image.readUIntLE(27, 3),
    };
  }
  if (chunkType === "VP8 " && image.length >= 30) {
    return {
      width: image.readUInt16LE(26) & 0x3fff,
      height: image.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunkType === "VP8L" && image.length >= 25) {
    const b0 = image[21];
    const b1 = image[22];
    const b2 = image[23];
    const b3 = image[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + ((b3 << 6) | (b2 >> 2) | ((b1 & 0xc0) << 6)),
    };
  }
  return undefined;
}

function dimensionsFor(image: Buffer, mimeType: ValidatedImage["mimeType"]) {
  if (mimeType === "image/png") return readPngDimensions(image);
  if (mimeType === "image/jpeg") return readJpegDimensions(image);
  return readWebpDimensions(image);
}

export function validateImageBuffer(image: Buffer, declaredMimeType: string): ValidatedImage {
  if (!image.length) throw new Error("Image is empty.");
  if (image.length > MAX_IMAGE_BYTES) throw new Error("Image is too large. Please upload a label image under 8 MB.");
  if (!SUPPORTED_IMAGE_TYPES.has(declaredMimeType)) {
    throw new Error("Unsupported image type. Upload PNG, JPEG, or WebP for custom analysis.");
  }

  const detectedMimeType = detectMimeType(image);
  if (!detectedMimeType) throw new Error("Image file could not be validated as PNG, JPEG, or WebP.");
  if (detectedMimeType !== declaredMimeType) {
    throw new Error("Image content does not match the declared file type.");
  }

  const dimensions = dimensionsFor(image, detectedMimeType);
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error("Image dimensions could not be read.");
  }
  if (dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
    throw new Error("Image dimensions are too large. Please upload an image under 25 megapixels.");
  }

  return { image, mimeType: detectedMimeType, ...dimensions };
}

export async function validateImageFile(file: File): Promise<ValidatedImage> {
  return validateImageBuffer(Buffer.from(await file.arrayBuffer()), file.type);
}
