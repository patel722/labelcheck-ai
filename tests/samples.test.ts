import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sampleCases } from "@/lib/samples";
import { extractionEvidenceFields } from "@/lib/schemas";

const stagedLabels = [
  "Valid Label",
  "ABV Mismatch",
  "Warning Heading Fail",
  "Low Confidence / Glare",
  "Missing Warning",
  "Class Type Needs Review",
];

describe("realistic sample label library", () => {
  it("includes eight natural product names with deployed image paths", () => {
    expect(sampleCases).toHaveLength(8);

    for (const sample of sampleCases) {
      expect(stagedLabels).not.toContain(sample.name);
      expect(sample.name).not.toMatch(/mismatch|fail|missing|low confidence|needs review/i);
      expect(sample.imagePath).toMatch(/^\/samples\/.+\.png$/);
      expect(existsSync(join(process.cwd(), "public", sample.imagePath))).toBe(true);
      expect(sample.expectedFields.brandName).toBeTruthy();
      expect(sample.expectedFields.alcoholContent).toBeTruthy();
      expect(sample.expectedFields.netContents).toBeTruthy();
      expect(sample.demoExtraction.confidence).toBeGreaterThan(0);
    }
  });

  it("includes extraction evidence for every reviewed field", () => {
    for (const sample of sampleCases) {
      for (const field of extractionEvidenceFields) {
        const evidence = sample.demoExtraction.extractionEvidence?.[field];
        expect(evidence, `${sample.id} ${field}`).toBeTruthy();
        expect(evidence?.confidence).toBeGreaterThanOrEqual(0);
        expect(evidence?.confidence).toBeLessThanOrEqual(1);
        expect(evidence?.evidenceText || evidence?.visualEvidence || evidence?.value).toBeTruthy();
      }
    }
  });
});
