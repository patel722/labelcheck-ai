import { extractedLabelSchema, type ExtractedLabel } from "../schemas";
import {
  AI_EXTRACTION_SYSTEM_INSTRUCTIONS,
  AI_EXTRACTION_USER_INSTRUCTIONS,
} from "../aiExtractionGuidelines";

export class OpenAIVisionExtractionError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "OpenAIVisionExtractionError";
  }
}

const extractionEvidenceItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidenceText: { type: ["string", "null"] },
    visualEvidence: { type: ["string", "null"] },
    source: {
      type: "string",
      enum: ["text", "visual", "inferred_absent", "not_visible"],
    },
  },
  required: ["value", "confidence", "evidenceText", "visualEvidence", "source"],
};

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    brandName: { type: ["string", "null"] },
    classType: { type: ["string", "null"] },
    alcoholContent: { type: ["string", "null"] },
    netContents: { type: ["string", "null"] },
    governmentWarningText: { type: ["string", "null"] },
    governmentWarningHeading: { type: ["string", "null"] },
    governmentWarningHeadingAppearsBold: { type: ["boolean", "null"] },
    warningAppearsLegible: { type: ["boolean", "null"] },
    rawText: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    imageQuality: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["glare", "blur", "angle", "crop", "low_resolution", "occlusion"],
          },
          severity: {
            type: "string",
            enum: ["minor", "moderate", "severe"],
          },
          affectedFields: {
            type: "array",
            items: {
              type: "string",
              enum: ["brand", "class_type", "alcohol_content", "net_contents", "government_warning"],
            },
          },
          note: { type: "string" },
        },
        required: ["type", "severity", "affectedFields", "note"],
      },
    },
    fieldConfidences: {
      type: "object",
      additionalProperties: false,
      properties: {
        brandName: { type: ["number", "null"], minimum: 0, maximum: 1 },
        classType: { type: ["number", "null"], minimum: 0, maximum: 1 },
        alcoholContent: { type: ["number", "null"], minimum: 0, maximum: 1 },
        netContents: { type: ["number", "null"], minimum: 0, maximum: 1 },
        governmentWarning: { type: ["number", "null"], minimum: 0, maximum: 1 },
      },
      required: ["brandName", "classType", "alcoholContent", "netContents", "governmentWarning"],
    },
    extractionEvidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        brandName: extractionEvidenceItemSchema,
        classType: extractionEvidenceItemSchema,
        alcoholContent: extractionEvidenceItemSchema,
        netContents: extractionEvidenceItemSchema,
        governmentWarning: extractionEvidenceItemSchema,
      },
      required: ["brandName", "classType", "alcoholContent", "netContents", "governmentWarning"],
    },
    notes: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "brandName",
    "classType",
    "alcoholContent",
    "netContents",
    "governmentWarningText",
    "governmentWarningHeading",
    "governmentWarningHeadingAppearsBold",
    "warningAppearsLegible",
    "rawText",
    "confidence",
    "imageQuality",
    "fieldConfidences",
    "extractionEvidence",
    "notes",
  ],
};

function compactNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compactNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== null)
        .map(([key, entryValue]) => [key, compactNulls(entryValue)]),
    );
  }
  return value;
}

function extractOutputText(response: Record<string, unknown>): string | undefined {
  if (typeof response.output_text === "string") return response.output_text;

  const output = response.output;
  if (!Array.isArray(output)) return undefined;

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") continue;
      const candidate = contentItem as { text?: unknown; type?: unknown };
      if (typeof candidate.text === "string") return candidate.text;
    }
  }

  return undefined;
}

function imageDetail(): "low" | "high" | "original" {
  const configured = String(process.env.OPENAI_IMAGE_DETAIL ?? "");
  if (configured === "low" || configured === "high" || configured === "original") return configured;
  return "high";
}

function timeoutMs(): number {
  const parsed = Number(process.env.OPENAI_TIMEOUT_MS ?? 20000);
  if (!Number.isFinite(parsed) || parsed < 1000) return 20000;
  return Math.min(parsed, 60000);
}

export async function extractWithOpenAIVision({
  image,
  mimeType,
}: {
  image: Buffer;
  mimeType: string;
}): Promise<ExtractedLabel> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const model = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
  const detail = imageDetail();
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const dataUrl = `data:${mimeType};base64,${image.toString("base64")}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1600,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: AI_EXTRACTION_SYSTEM_INSTRUCTIONS,
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: AI_EXTRACTION_USER_INSTRUCTIONS,
              },
              {
                type: "input_image",
                image_url: dataUrl,
                detail,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "ExtractedLabel",
            strict: true,
            schema: extractionSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      let code: string | undefined;
      try {
        const body = (await response.json()) as { error?: { code?: unknown; type?: unknown } };
        code =
          typeof body.error?.code === "string"
            ? body.error.code
            : typeof body.error?.type === "string"
              ? body.error.type
              : undefined;
      } catch {
        code = undefined;
      }
      throw new OpenAIVisionExtractionError("OpenAI extraction request was not accepted.", response.status, code);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const outputText = extractOutputText(data);
    if (!outputText) throw new Error("OpenAI response did not include structured output text.");

    const parsed = JSON.parse(outputText) as unknown;
    return extractedLabelSchema.parse(compactNulls(parsed));
  } finally {
    clearTimeout(timeout);
  }
}
