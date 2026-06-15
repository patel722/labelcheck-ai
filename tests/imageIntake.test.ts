import { describe, expect, it } from "vitest";
import { validateImageBuffer } from "@/lib/imageIntake";

const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

function fakeJpeg(width = 1, height = 1): Buffer {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}

function fakeWebp(width = 1, height = 1): Buffer {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(22, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

describe("image intake validation", () => {
  it("accepts PNG, JPEG, and WebP images", () => {
    expect(validateImageBuffer(validPng, "image/png").mimeType).toBe("image/png");
    expect(validateImageBuffer(fakeJpeg(), "image/jpeg").mimeType).toBe("image/jpeg");
    expect(validateImageBuffer(fakeWebp(), "image/webp").mimeType).toBe("image/webp");
  });

  it("rejects spoofed MIME types", () => {
    expect(() => validateImageBuffer(Buffer.from("<svg></svg>"), "image/png")).toThrow("validated as PNG");
    expect(() => validateImageBuffer(validPng, "image/jpeg")).toThrow("does not match");
  });

  it("rejects excessive dimensions", () => {
    expect(() => validateImageBuffer(fakeJpeg(6000, 6000), "image/jpeg")).toThrow("25 megapixels");
  });
});
