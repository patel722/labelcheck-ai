import { describe, expect, it, vi } from "vitest";
import { POST as ANALYZE_POST } from "@/app/api/analyze/route";
import { POST as REVIEW_POST } from "@/app/api/review/route";

type ReviewRouteBody = {
  overallStatus?: string;
  mode?: string;
  provider?: string;
  checks?: Array<{ status: string }>;
  warnings?: string[];
  error?: string;
  detail?: string;
};

const validPngBytes = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64"),
);

function fakeJpeg(width = 1, height = 1): Buffer {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}

function filePart(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function formData(fields: Record<string, string>, file?: File): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  if (file) form.set("labelImage", file);
  return form;
}

async function postReview(
  form: FormData,
  handler: typeof REVIEW_POST = REVIEW_POST,
): Promise<{ status: number; body: ReviewRouteBody }> {
  const response = await handler(
    new Request("http://localhost/api/analyze", {
      method: "POST",
      body: form,
    }),
  );
  return {
    status: response.status,
    body: (await response.json()) as ReviewRouteBody,
  };
}

const requiredFields = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
};

describe("review API route", () => {
  it("returns a deterministic demo review for samples", async () => {
    const result = await postReview(
      formData({
        ...requiredFields,
        sampleId: "old-tom-distillery-bourbon",
      }),
      ANALYZE_POST,
    );

    expect(result.status).toBe(200);
    expect(result.body.overallStatus).toBe("pass");
    expect(result.body.mode).toBe("demo");
    expect(result.body.provider).toBe("demo");
    expect(result.body.checks).toHaveLength(5);
  });

  it("routes custom uploads to human review when no AI key is configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const result = await postReview(
      formData(
        requiredFields,
        new File([validPngBytes], "label.png", { type: "image/png" }),
      ),
    );
    vi.unstubAllEnvs();

    expect(result.status).toBe(200);
    expect(result.body.overallStatus).toBe("needs_review");
    expect(result.body.mode).toBe("manual");
    expect(result.body.provider).toBe("manual");
    expect(result.body.checks?.every((check: { status: string }) => check.status === "needs_review")).toBe(
      true,
    );
    expect(result.body.warnings?.join(" ")).toContain("AI mode was unavailable");
  });

  it("rejects SVG uploads for the live upload path", async () => {
    const result = await postReview(
      formData(
        requiredFields,
        new File(["<svg><script>alert(1)</script></svg>"], "label.svg", { type: "image/svg+xml" }),
      ),
    );

    expect(result.status).toBe(400);
    expect(result.body.error).toContain("Unsupported image type");
  });

  it("rejects missing required fields", async () => {
    const result = await postReview(
      formData({
        brandName: "",
        alcoholContent: "",
        netContents: "",
      }),
    );

    expect(result.status).toBe(400);
    expect(result.body.error).toContain("required application fields");
  });

  it("rejects requests with no image and no sample", async () => {
    const result = await postReview(formData(requiredFields));

    expect(result.status).toBe(400);
    expect(result.body.error).toContain("Upload a label image");
  });

  it("rejects spoofed SVG bytes declared as PNG", async () => {
    const result = await postReview(
      formData(
        requiredFields,
        new File(["<svg><script>alert(1)</script></svg>"], "label.png", { type: "image/png" }),
      ),
    );

    expect(result.status).toBe(400);
    expect(result.body.error).toContain("validated as PNG");
  });

  it.each([
    {
      name: "zero-byte image",
      file: new File([], "empty.png", { type: "image/png" }),
      error: "Image is empty",
    },
    {
      name: "malformed image",
      file: new File([filePart(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))], "malformed.png", {
        type: "image/png",
      }),
      error: "Image dimensions",
    },
    {
      name: "oversized image",
      file: new File([filePart(Buffer.concat([Buffer.from(validPngBytes), Buffer.alloc(8 * 1024 * 1024)]))], "large.png", {
        type: "image/png",
      }),
      error: "too large",
    },
    {
      name: "excessive dimensions",
      file: new File([filePart(fakeJpeg(6000, 6000))], "huge.jpg", { type: "image/jpeg" }),
      error: "25 megapixels",
    },
  ])("rejects $name before provider forwarding", async ({ file, error }) => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const providerFetch = vi.fn();
    vi.stubGlobal("fetch", providerFetch);

    const result = await postReview(formData(requiredFields, file));
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();

    expect(result.status).toBe(400);
    expect(result.body.error).toContain(error);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("uses the sample fixture when both sampleId and file are provided", async () => {
    const result = await postReview(
      formData(
        {
          ...requiredFields,
          sampleId: "old-tom-distillery-bourbon",
        },
        new File([validPngBytes], "label.png", { type: "image/png" }),
      ),
    );

    expect(result.status).toBe(200);
    expect(result.body.provider).toBe("demo");
    expect(result.body.overallStatus).toBe("pass");
  });

  it("returns a friendly error for an unknown sample", async () => {
    const result = await postReview(
      formData({
        ...requiredFields,
        sampleId: "unknown-sample",
      }),
    );

    expect(result.status).toBe(400);
    expect(result.body.error).toContain("Sample label");
  });

  it("returns OpenAI structured extraction results when the provider succeeds", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              brandName: "OLD TOM DISTILLERY",
              classType: "Kentucky Straight Bourbon Whiskey",
              alcoholContent: "90 Proof",
              netContents: "750 mL",
              governmentWarningHeading: "GOVERNMENT WARNING:",
              governmentWarningText:
                "(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
              governmentWarningHeadingAppearsBold: true,
              warningAppearsLegible: true,
              rawText: "OLD TOM DISTILLERY 90 Proof 750 mL GOVERNMENT WARNING...",
              confidence: 0.95,
              imageQuality: [],
              fieldConfidences: {
                brandName: 0.95,
                classType: 0.95,
                alcoholContent: 0.95,
                netContents: 0.95,
                governmentWarning: 0.95,
              },
              extractionEvidence: {
                brandName: {
                  value: "OLD TOM DISTILLERY",
                  confidence: 0.95,
                  evidenceText: "OLD TOM DISTILLERY",
                  visualEvidence: null,
                  source: "text",
                },
                classType: {
                  value: "Kentucky Straight Bourbon Whiskey",
                  confidence: 0.95,
                  evidenceText: "Kentucky Straight Bourbon Whiskey",
                  visualEvidence: null,
                  source: "text",
                },
                alcoholContent: {
                  value: "90 Proof",
                  confidence: 0.95,
                  evidenceText: "90 Proof",
                  visualEvidence: null,
                  source: "text",
                },
                netContents: {
                  value: "750 mL",
                  confidence: 0.95,
                  evidenceText: "750 mL",
                  visualEvidence: null,
                  source: "text",
                },
                governmentWarning: {
                  value: "GOVERNMENT WARNING: (1) According to the Surgeon General...",
                  confidence: 0.95,
                  evidenceText: "GOVERNMENT WARNING: (1) According to the Surgeon General...",
                  visualEvidence: null,
                  source: "text",
                },
              },
              notes: [],
            }),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await postReview(
      formData(requiredFields, new File([validPngBytes], "label.png", { type: "image/png" })),
    );
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();

    expect(result.status).toBe(200);
    expect(result.body.provider).toBe("openai");
    expect(result.body.overallStatus).toBe("pass");
  });

  it("routes provider failures to human review without leaking provider details", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("provider exploded", { status: 500 })));

    const result = await postReview(
      formData(requiredFields, new File([validPngBytes], "label.png", { type: "image/png" })),
    );
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();

    expect(result.status).toBe(200);
    expect(result.body.provider).toBe("openai");
    expect(result.body.overallStatus).toBe("needs_review");
    expect(JSON.stringify(result.body)).not.toContain("provider exploded");
  });

  it("classifies provider quota failures without leaking raw provider details", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: "insufficient_quota", message: "no balance left" } }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const result = await postReview(
      formData(requiredFields, new File([validPngBytes], "label.png", { type: "image/png" })),
    );
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();

    expect(result.status).toBe(200);
    expect(result.body.provider).toBe("openai");
    expect(result.body.overallStatus).toBe("needs_review");
    expect(result.body.warnings?.join(" ")).toContain("quota or billing credits");
    expect(JSON.stringify(result.body)).not.toContain("no balance left");
  });
});
