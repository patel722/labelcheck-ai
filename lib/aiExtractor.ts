import type { ExtractedLabel } from "./schemas";
import { getDemoExtraction, getManualFallbackExtraction } from "./extractionProviders/demoExtractor";
import {
  extractWithOpenAIVision,
  OpenAIVisionExtractionError,
} from "./extractionProviders/openaiVisionExtractor";

export type ExtractionMode = "ai" | "demo" | "manual";

export type ExtractionInput = {
  image?: Buffer;
  mimeType?: string;
  sampleId?: string;
};

export type ExtractionOutput = {
  extracted: ExtractedLabel;
  mode: ExtractionMode;
  warnings: string[];
  provider: "openai" | "demo" | "manual";
  extractionUnavailable?: boolean;
};

function providerFailureNotes(error: unknown): { notes: string[]; warnings: string[] } {
  const genericNote = "No provider error details are shown to the browser. Route the label to human review and retry later if needed.";
  const genericWarning = "AI extraction failed or timed out. The application did not make a final automated comparison.";

  if (error instanceof OpenAIVisionExtractionError) {
    if (error.status === 401) {
      return {
        notes: ["OpenAI vision extraction was not authenticated.", genericNote],
        warnings: ["AI extraction was unavailable because the provider credentials were rejected.", "The uploaded image was not stored by this application."],
      };
    }

    if (error.status === 403 || error.status === 404 || error.code === "model_not_found") {
      return {
        notes: ["OpenAI vision extraction reached the provider, but the configured model, project, or organization was not accessible.", genericNote],
        warnings: ["AI extraction was unavailable because model or project access needs review.", "The uploaded image was not stored by this application."],
      };
    }

    if (error.status === 429) {
      const quotaOrBilling = error.code?.includes("quota") || error.code?.includes("billing");
      return {
        notes: [
          quotaOrBilling
            ? "OpenAI vision extraction reached the provider, but API quota or billing credits appear unavailable."
            : "OpenAI vision extraction reached the provider, but the request was rate limited.",
          genericNote,
        ],
        warnings: [
          quotaOrBilling
            ? "AI extraction was unavailable because API quota or billing credits appear unavailable."
            : "AI extraction was rate limited by the provider.",
          "The uploaded image was not stored by this application.",
        ],
      };
    }

    return {
      notes: [`OpenAI vision extraction was not completed. Provider status: ${error.status ?? "unknown"}.`, genericNote],
      warnings: [genericWarning, "The uploaded image was not stored by this application."],
    };
  }

  if (error instanceof Error && error.name === "AbortError") {
    return {
      notes: ["OpenAI vision extraction timed out before returning structured data.", genericNote],
      warnings: ["AI extraction timed out. The application did not make a final automated comparison.", "The uploaded image was not stored by this application."],
    };
  }

  return {
    notes: ["OpenAI vision extraction did not complete successfully.", genericNote],
    warnings: [genericWarning, "The uploaded image was not stored by this application."],
  };
}

export async function extractLabel(input: ExtractionInput): Promise<ExtractionOutput> {
  if (input.sampleId) {
    return {
      extracted: getDemoExtraction(input.sampleId),
      mode: "demo",
      provider: "demo",
      warnings: ["Demo sample used a repeatable local extraction profile; no external AI call was made."],
    };
  }

  if (process.env.OPENAI_API_KEY && input.image && input.mimeType) {
    try {
      const extracted = await extractWithOpenAIVision({
        image: input.image,
        mimeType: input.mimeType,
      });

      return {
        extracted,
        mode: "ai",
        provider: "openai",
        warnings: [],
      };
    } catch (error) {
      const failure = providerFailureNotes(error);
      return {
        extracted: getManualFallbackExtraction(failure.notes),
        mode: "manual",
        provider: "openai",
        extractionUnavailable: true,
        warnings: failure.warnings,
      };
    }
  }

  if (input.image) {
    return {
      extracted: getManualFallbackExtraction([
        "No AI provider key was configured for this custom upload.",
        "The image was not sent to an external provider. Route the label to human review or configure OPENAI_API_KEY.",
      ]),
      mode: "manual",
      provider: "manual",
      extractionUnavailable: true,
      warnings: [
        "AI mode was unavailable because no provider key was configured.",
        "The uploaded image was not sent to an external provider and was not stored by this application.",
      ],
    };
  }

  return {
    extracted: getManualFallbackExtraction(),
    mode: "manual",
    provider: "manual",
    extractionUnavailable: true,
    warnings: ["AI mode was unavailable; no uploaded image was sent to an external provider."],
  };
}
