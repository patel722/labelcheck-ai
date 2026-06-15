import type { ExtractedLabel } from "../schemas";
import { findSampleCase } from "../samples";

export class DemoSampleNotFoundError extends Error {
  constructor(sampleId: string) {
    super(`Sample label "${sampleId}" was not found.`);
    this.name = "DemoSampleNotFoundError";
  }
}

export function getDemoExtraction(sampleId: string): ExtractedLabel {
  const sample = findSampleCase(sampleId);
  if (!sample) throw new DemoSampleNotFoundError(sampleId);

  return {
    ...sample.demoExtraction,
    fieldConfidences: sample.demoExtraction.fieldConfidences
      ? { ...sample.demoExtraction.fieldConfidences }
      : undefined,
    imageQuality: sample.demoExtraction.imageQuality?.map((flag) => ({
      ...flag,
      affectedFields: [...flag.affectedFields],
    })),
    extractionEvidence: sample.demoExtraction.extractionEvidence
      ? Object.fromEntries(
          Object.entries(sample.demoExtraction.extractionEvidence).map(([field, item]) => [
            field,
            { ...item },
          ]),
        )
      : undefined,
    notes: sample.demoExtraction.notes ? [...sample.demoExtraction.notes] : undefined,
  };
}

export function getManualFallbackExtraction(notes?: string[]): ExtractedLabel {
  return {
    confidence: 0.15,
    rawText: "",
    fieldConfidences: {
      brandName: 0,
      classType: 0,
      alcoholContent: 0,
      netContents: 0,
      governmentWarning: 0,
    },
    notes:
      notes ??
      [
        "No AI provider key was available for this custom upload.",
        "Use a sample label in demo mode or configure OPENAI_API_KEY for live extraction.",
      ],
  };
}
