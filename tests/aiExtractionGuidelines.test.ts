import { describe, expect, it } from "vitest";
import {
  AI_EXTRACTION_SYSTEM_INSTRUCTIONS,
  AI_EXTRACTION_USER_INSTRUCTIONS,
} from "@/lib/aiExtractionGuidelines";

describe("AI extraction guidelines", () => {
  it("keeps extraction deterministic, conservative, and separate from compliance decisions", () => {
    const combined = `${AI_EXTRACTION_SYSTEM_INSTRUCTIONS}\n${AI_EXTRACTION_USER_INSTRUCTIONS}`;

    expect(combined).toContain("not the compliance decision-maker");
    expect(combined).toContain("Do not infer, complete, normalize, or convert values");
    expect(combined).toContain("Do not convert proof to ABV or liters to milliliters");
    expect(combined).toContain("Missing or unreadable values are null, not guessed");
    expect(combined).toContain("fieldConfidences");
    expect(combined).toContain("extractionEvidence");
    expect(combined).toContain("Use confidence below 0.60");
    expect(combined).toContain("glare, reflection, blur, crop, angle, low resolution, occlusion");
    expect(combined).toContain("Evidence values and field values do not conflict");
    expect(combined).toContain("imageQuality");
    expect(combined).toContain("no pass/fail/legal conclusion");
  });
});
