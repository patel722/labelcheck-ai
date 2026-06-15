import { describe, expect, it } from "vitest";
import type { ApplicationFields, ExtractedLabel } from "@/lib/schemas";
import { sampleCases } from "@/lib/samples";
import {
  aggregateStatus,
  reviewLabel,
  validateAlcoholContent,
  validateBrandName,
  validateClassType,
  validateGovernmentWarning,
  validateNetContents,
} from "@/lib/validators";
import { GOVERNMENT_WARNING_BODY, GOVERNMENT_WARNING_HEADING } from "@/lib/warningText";

const baseApplication: ApplicationFields = {
  brandName: "Stone’s Throw",
  classType: "Red Wine",
  alcoholContent: "45% ABV",
  netContents: "750 mL",
};

function warningExtraction(overrides: Partial<ExtractedLabel> = {}): ExtractedLabel {
  return {
    brandName: "Stone's Throw",
    classType: "Red Wine",
    alcoholContent: "90 Proof",
    netContents: "0.75 L",
    governmentWarningHeading: GOVERNMENT_WARNING_HEADING,
    governmentWarningText: GOVERNMENT_WARNING_BODY,
    governmentWarningHeadingAppearsBold: true,
    warningAppearsLegible: true,
    confidence: 0.96,
    fieldConfidences: {
      brandName: 0.95,
      classType: 0.94,
      alcoholContent: 0.95,
      netContents: 0.95,
      governmentWarning: 0.95,
    },
    ...overrides,
  };
}

describe("deterministic validators", () => {
  it("does not fail STONE'S THROW vs Stone’s Throw", () => {
    const result = validateBrandName(baseApplication, warningExtraction({ brandName: "STONE'S THROW" }));
    expect(result.status).toBe("pass");
  });

  it("fails Stone’s Throw vs a materially different brand", () => {
    const result = validateBrandName(baseApplication, warningExtraction({ brandName: "RIVERBEND CELLARS" }));
    expect(result.status).toBe("fail");
  });

  it("passes 45% ABV vs 90 Proof", () => {
    const result = validateAlcoholContent(baseApplication, warningExtraction({ alcoholContent: "90 Proof" }));
    expect(result.status).toBe("pass");
  });

  it("passes 47% ABV vs 94 Proof", () => {
    const result = validateAlcoholContent(
      { ...baseApplication, alcoholContent: "47% ABV" },
      warningExtraction({ alcoholContent: "94 Proof" }),
    );
    expect(result.status).toBe("pass");
  });

  it("passes 40% Alc./Vol. vs 80 Proof", () => {
    const result = validateAlcoholContent(
      { ...baseApplication, alcoholContent: "40% Alc./Vol." },
      warningExtraction({ alcoholContent: "80 Proof" }),
    );
    expect(result.status).toBe("pass");
  });

  it("passes normalized class/type values", () => {
    const result = validateClassType(baseApplication, warningExtraction({ classType: "red wine" }));
    expect(result.status).toBe("pass");
  });

  it("routes Hard Apple Cider vs Apple Cider to review", () => {
    const result = validateClassType(
      { ...baseApplication, classType: "Hard Apple Cider" },
      warningExtraction({ classType: "Apple Cider" }),
    );
    expect(result.status).toBe("needs_review");
  });

  it("passes 750 ML vs 750 mL", () => {
    const result = validateNetContents(baseApplication, warningExtraction({ netContents: "750 ML" }));
    expect(result.status).toBe("pass");
  });

  it("passes 0.75 L vs 750 mL", () => {
    const result = validateNetContents(baseApplication, warningExtraction({ netContents: "0.75 L" }));
    expect(result.status).toBe("pass");
  });

  it("passes equivalent fluid-ounce net contents", () => {
    const result = validateNetContents(
      { ...baseApplication, netContents: "12 fl oz" },
      warningExtraction({ netContents: "12 FL OZ" }),
    );
    expect(result.status).toBe("pass");
  });

  it("passes 1 L vs 1000 mL", () => {
    const result = validateNetContents(
      { ...baseApplication, netContents: "1000 mL" },
      warningExtraction({ netContents: "1 L" }),
    );
    expect(result.status).toBe("pass");
  });

  it("fails an ABV mismatch", () => {
    const result = validateAlcoholContent(baseApplication, warningExtraction({ alcoholContent: "40% ABV" }));
    expect(result.status).toBe("fail");
  });

  it("fails 13.5% Alc./Vol. vs 12.0% Alc./Vol.", () => {
    const result = validateAlcoholContent(
      { ...baseApplication, alcoholContent: "13.5% Alc./Vol." },
      warningExtraction({ alcoholContent: "12.0% Alc./Vol." }),
    );
    expect(result.status).toBe("fail");
  });

  it("passes alcohol content at the tolerance boundary", () => {
    const result = validateAlcoholContent(baseApplication, warningExtraction({ alcoholContent: "45.25% ABV" }));
    expect(result.status).toBe("pass");
  });

  it("routes unparsable expected alcohol content to review", () => {
    const result = validateAlcoholContent(
      { ...baseApplication, alcoholContent: "see label" },
      warningExtraction({ alcoholContent: "45% ABV" }),
    );
    expect(result.status).toBe("needs_review");
  });

  it("routes low-confidence equivalent fields to review", () => {
    const result = validateNetContents(
      baseApplication,
      warningExtraction({
        netContents: "750 mL",
        fieldConfidences: { netContents: 0.4 },
      }),
    );
    expect(result.status).toBe("needs_review");
  });

  it("fails a missing warning", () => {
    const result = validateGovernmentWarning(
      warningExtraction({
        governmentWarningHeading: undefined,
        governmentWarningText: undefined,
      }),
    );
    expect(result.status).toBe("fail");
  });

  it("passes exact government warning text and all-caps heading with a colon", () => {
    const result = validateGovernmentWarning(warningExtraction({ governmentWarningHeading: "GOVERNMENT WARNING:" }));
    expect(result.status).toBe("pass");
  });

  it("fails title-case Government Warning heading", () => {
    const result = validateGovernmentWarning(
      warningExtraction({
        governmentWarningHeading: "Government Warning:",
      }),
    );
    expect(result.status).toBe("fail");
    expect(result.reason).toContain("GOVERNMENT WARNING");
  });

  it("fails altered government warning body", () => {
    const result = validateGovernmentWarning(
      warningExtraction({
        governmentWarningText: "Pregnant people should not drink. Alcohol may impair driving.",
      }),
    );
    expect(result.status).toBe("fail");
  });

  it("fails non-bold warning extraction", () => {
    expect(validateGovernmentWarning(warningExtraction({ governmentWarningHeadingAppearsBold: false })).status).toBe(
      "fail",
    );
  });

  it("routes low-confidence or illegible warning extraction to review", () => {
    expect(
      validateGovernmentWarning(
        warningExtraction({
          warningAppearsLegible: false,
          fieldConfidences: { governmentWarning: 0.48 },
        }),
      ).status,
    ).toBe("needs_review");
  });

  it("routes warning extraction to review when image quality materially affects the warning block", () => {
    const result = validateGovernmentWarning(
      warningExtraction({
        imageQuality: [
          {
            type: "glare",
            severity: "moderate",
            affectedFields: ["government_warning"],
            note: "Glare crosses the government warning block.",
          },
        ],
      }),
    );

    expect(result.status).toBe("needs_review");
    expect(result.reason).toContain("Image quality may affect this field");
  });

  it("passes exact government warning text", () => {
    const result = validateGovernmentWarning(warningExtraction());
    expect(result.status).toBe("pass");
  });

  it("routes low confidence warning and bold uncertainty to needs_review", () => {
    const result = validateGovernmentWarning(
      warningExtraction({
        governmentWarningHeadingAppearsBold: null,
        warningAppearsLegible: null,
        fieldConfidences: {
          governmentWarning: 0.45,
        },
      }),
    );
    expect(result.status).toBe("needs_review");
  });

  it("routes missing fields affected by image quality to review", () => {
    const result = validateBrandName(
      baseApplication,
      warningExtraction({
        brandName: undefined,
        imageQuality: [
          {
            type: "glare",
            severity: "moderate",
            affectedFields: ["brand"],
            note: "Brand block is washed out.",
          },
        ],
      }),
    );
    expect(result.status).toBe("needs_review");
    expect(result.reason).toContain("Image quality");
  });

  it("aggregates overall status with fail taking precedence", () => {
    expect(
      aggregateStatus([
        { field: "Brand", expected: "A", status: "pass", reason: "ok" },
        { field: "ABV", expected: "45%", status: "needs_review", reason: "close" },
      ]),
    ).toBe("needs_review");

    expect(
      aggregateStatus([
        { field: "Brand", expected: "A", status: "pass", reason: "ok" },
        { field: "Warning", expected: "Required", status: "fail", reason: "missing" },
      ]),
    ).toBe("fail");
  });

  it.each(sampleCases)("validates sample fixture $name as $expectedOverallStatus", (sample) => {
    const result = reviewLabel(sample.expectedFields, sample.demoExtraction, 1, "demo");

    expect(result.overallStatus).toBe(sample.expectedOverallStatus);
    expect(result.checks.map((check) => check.field)).toEqual([
      "Brand Name",
      "Class/Type",
      "Alcohol Content",
      "Net Contents",
      "Government Warning",
    ]);
    for (const check of result.checks) {
      expect(check.reason.length).toBeGreaterThan(10);
    }
  });
});
