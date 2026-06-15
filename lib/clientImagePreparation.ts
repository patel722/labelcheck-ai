"use client";

import type { ImagePreparationSummary } from "./schemas";

const MAX_LONG_EDGE = 2400;
const TARGET_BYTES = 3 * 1024 * 1024;
const JPEG_QUALITY = 0.9;

export type PreparedImage = {
  file: File;
  previewUrl: string;
  summary: ImagePreparationSummary;
};

function isSupportedMimeType(type: string): type is "image/png" | "image/jpeg" | "image/webp" {
  return type === "image/png" || type === "image/jpeg" || type === "image/webp";
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image could not be encoded."))), type, quality);
  });
}

function rotatedSize(width: number, height: number, rotationDegrees: number) {
  return rotationDegrees === 90 || rotationDegrees === 270
    ? { width: height, height: width }
    : { width, height };
}

export async function prepareImageFile(file: File, rotationDegrees: 0 | 90 | 180 | 270 = 0): Promise<PreparedImage> {
  if (!isSupportedMimeType(file.type)) {
    throw new Error("Unsupported image type. Upload PNG, JPEG, or WebP.");
  }

  const warnings: string[] = [];
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  const oriented = rotatedSize(originalWidth, originalHeight, rotationDegrees);
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(oriented.width, oriented.height));
  const submittedWidth = Math.max(1, Math.round(oriented.width * scale));
  const submittedHeight = Math.max(1, Math.round(oriented.height * scale));
  const shouldReencode = rotationDegrees !== 0 || scale < 1 || file.size > TARGET_BYTES;
  let submitted = file;

  if (shouldReencode) {
    const canvas = document.createElement("canvas");
    canvas.width = submittedWidth;
    canvas.height = submittedHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser could not prepare a canvas for image compression.");

    context.save();
    if (rotationDegrees === 90) {
      context.translate(canvas.width, 0);
      context.rotate(Math.PI / 2);
    } else if (rotationDegrees === 180) {
      context.translate(canvas.width, canvas.height);
      context.rotate(Math.PI);
    } else if (rotationDegrees === 270) {
      context.translate(0, canvas.height);
      context.rotate((3 * Math.PI) / 2);
    }

    const drawWidth = rotationDegrees === 90 || rotationDegrees === 270 ? submittedHeight : submittedWidth;
    const drawHeight = rotationDegrees === 90 || rotationDegrees === 270 ? submittedWidth : submittedHeight;
    context.drawImage(bitmap, 0, 0, drawWidth, drawHeight);
    context.restore();

    const outputType = file.type === "image/png" && file.size <= TARGET_BYTES ? "image/png" : "image/jpeg";
    const blob = await canvasBlob(canvas, outputType, outputType === "image/jpeg" ? JPEG_QUALITY : undefined);
    submitted = new File([blob], file.name, { type: outputType, lastModified: file.lastModified });

    if (scale < 1) warnings.push(`Long edge was reduced to ${MAX_LONG_EDGE}px for upload.`);
    if (file.type !== outputType) warnings.push("Image was re-encoded as JPEG to reduce upload size.");
    if (submitted.size > TARGET_BYTES) warnings.push("Prepared image is still above the 3 MB target but under the server cap.");
  }

  bitmap.close();

  const summary: ImagePreparationSummary = {
    originalBytes: file.size,
    submittedBytes: submitted.size,
    originalWidth,
    originalHeight,
    submittedWidth,
    submittedHeight,
    originalMimeType: file.type,
    submittedMimeType: submitted.type,
    rotationDegrees,
    compressed: submitted.size !== file.size || submitted.type !== file.type || rotationDegrees !== 0,
    warnings,
  };

  return {
    file: submitted,
    previewUrl: URL.createObjectURL(submitted),
    summary,
  };
}
