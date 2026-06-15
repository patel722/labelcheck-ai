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
              governmentWarningHeading: "GOVERNMENT WARNING",
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
