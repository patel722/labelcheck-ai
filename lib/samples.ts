import type {
  ApplicationFields,
  ExtractedLabel,
  ExtractionEvidenceItem,
  ExtractionEvidenceSource,
  ReviewStatus,
} from "./schemas";
import { GOVERNMENT_WARNING_BODY, GOVERNMENT_WARNING_HEADING, GOVERNMENT_WARNING_TEXT } from "./warningText";

export type SampleCase = {
  id: string;
  name: string;
  description: string;
  imagePath: string;
  expectedFields: ApplicationFields;
  demoExtraction: ExtractedLabel;
  expectedOverallStatus: ReviewStatus;
  expectedFailureOrReviewReason: string;
};

const highFieldConfidences = {
  brandName: 0.96,
  classType: 0.95,
  alcoholContent: 0.96,
  netContents: 0.96,
  governmentWarning: 0.95,
};

const warningEvidenceQuote = "GOVERNMENT WARNING: (1) According to the Surgeon General...";

function evidence(
  value: string | undefined,
  confidence: number,
  evidenceText?: string,
  visualEvidence?: string,
  source: ExtractionEvidenceSource = "text",
): ExtractionEvidenceItem {
  return {
    ...(value ? { value } : {}),
    confidence,
    ...(evidenceText ? { evidenceText } : {}),
    ...(visualEvidence ? { visualEvidence } : {}),
    source,
  };
}

export const sampleCases: SampleCase[] = [
  {
    id: "old-tom-distillery-bourbon",
    name: "Old Tom Distillery Bourbon",
    description: "Fictional bourbon label with a full front-label layout and warning block.",
    imagePath: "/realistic-samples/old-tom-distillery-bourbon.png",
    expectedOverallStatus: "pass",
    expectedFailureOrReviewReason: "Clean compliant sample.",
    expectedFields: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
    },
    demoExtraction: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      governmentWarningText: GOVERNMENT_WARNING_BODY,
      governmentWarningHeading: `${GOVERNMENT_WARNING_HEADING}:`,
      governmentWarningHeadingAppearsBold: true,
      warningAppearsLegible: true,
      rawText:
        "OLD TOM DISTILLERY Kentucky Straight Bourbon Whiskey 45% Alc./Vol. (90 Proof) 750 mL GOVERNMENT WARNING: (1) According to the Surgeon General...",
      confidence: 0.96,
      fieldConfidences: highFieldConfidences,
      extractionEvidence: {
        brandName: evidence("OLD TOM DISTILLERY", 0.96, "OLD TOM DISTILLERY"),
        classType: evidence("Kentucky Straight Bourbon Whiskey", 0.95, "Kentucky Straight Bourbon Whiskey"),
        alcoholContent: evidence("45% Alc./Vol. (90 Proof)", 0.96, "45% Alc./Vol. (90 Proof)"),
        netContents: evidence("750 mL", 0.96, "750 mL"),
        governmentWarning: evidence(GOVERNMENT_WARNING_TEXT, 0.95, warningEvidenceQuote),
      },
      notes: ["Clean compliant sample."],
    },
  },
  {
    id: "stones-throw-rye",
    name: "Stone’s Throw Rye",
    description: "Fictional rye whiskey label with common formatting variations.",
    imagePath: "/realistic-samples/stones-throw-rye.png",
    expectedOverallStatus: "pass",
    expectedFailureOrReviewReason: "Formatting, proof, and unit differences are equivalent after normalization.",
    expectedFields: {
      brandName: "Stone’s Throw",
      classType: "American Rye Whiskey",
      alcoholContent: "45% ABV",
      netContents: "750 mL",
    },
    demoExtraction: {
      brandName: "STONE'S THROW",
      classType: "American Rye Whiskey",
      alcoholContent: "90 Proof",
      netContents: "750 ML",
      governmentWarningText: GOVERNMENT_WARNING_BODY,
      governmentWarningHeading: `${GOVERNMENT_WARNING_HEADING}:`,
      governmentWarningHeadingAppearsBold: true,
      warningAppearsLegible: true,
      rawText:
        "STONE'S THROW American Rye Whiskey 90 Proof 750 ML GOVERNMENT WARNING: (1) According to the Surgeon General...",
      confidence: 0.94,
      fieldConfidences: highFieldConfidences,
      extractionEvidence: {
        brandName: evidence("STONE'S THROW", 0.96, "STONE'S THROW"),
        classType: evidence("American Rye Whiskey", 0.95, "American Rye Whiskey"),
        alcoholContent: evidence("90 Proof", 0.96, "90 Proof"),
        netContents: evidence("750 ML", 0.96, "750 ML"),
        governmentWarning: evidence(GOVERNMENT_WARNING_TEXT, 0.95, warningEvidenceQuote),
      },
      notes: [
        "Brand capitalization/punctuation differs, proof is equivalent to ABV, and unit capitalization differs.",
      ],
    },
  },
  {
    id: "riverbend-cellars-red-wine",
    name: "Riverbend Cellars Red Wine",
    description: "Fictional red wine label with a complete reviewable label image.",
    imagePath: "/realistic-samples/riverbend-cellars-red-wine.png",
    expectedOverallStatus: "fail",
    expectedFailureOrReviewReason: "Alcohol content on the label does not match the expected application value.",
    expectedFields: {
      brandName: "RIVERBEND CELLARS",
      classType: "Red Wine",
      alcoholContent: "13.5% Alc./Vol.",
      netContents: "750 mL",
    },
    demoExtraction: {
      brandName: "RIVERBEND CELLARS",
      classType: "Red Wine",
      alcoholContent: "12.0% Alc./Vol.",
      netContents: "750 mL",
      governmentWarningText: GOVERNMENT_WARNING_BODY,
      governmentWarningHeading: `${GOVERNMENT_WARNING_HEADING}:`,
      governmentWarningHeadingAppearsBold: true,
      warningAppearsLegible: true,
      rawText:
        "RIVERBEND CELLARS Red Wine 12.0% Alc./Vol. 750 mL GOVERNMENT WARNING: (1) According to the Surgeon General...",
      confidence: 0.95,
      fieldConfidences: highFieldConfidences,
      extractionEvidence: {
        brandName: evidence("RIVERBEND CELLARS", 0.96, "RIVERBEND CELLARS"),
        classType: evidence("Red Wine", 0.95, "Red Wine"),
        alcoholContent: evidence("12.0% Alc./Vol.", 0.96, "12.0% Alc./Vol."),
        netContents: evidence("750 mL", 0.96, "750 mL"),
        governmentWarning: evidence(GOVERNMENT_WARNING_TEXT, 0.95, warningEvidenceQuote),
      },
      notes: ["Alcohol content on label does not match expected application value."],
    },
  },
  {
    id: "harbor-light-ipa-can",
    name: "Harbor Light Brewing IPA",
    description: "Fictional beer can label with a full text panel.",
    imagePath: "/realistic-samples/harbor-light-ipa-can.png",
    expectedOverallStatus: "fail",
    expectedFailureOrReviewReason: "Warning heading capitalization does not match the required all-caps heading.",
    expectedFields: {
      brandName: "HARBOR LIGHT BREWING",
      classType: "India Pale Ale",
      alcoholContent: "6.8% ABV",
      netContents: "16 fl oz",
    },
    demoExtraction: {
      brandName: "HARBOR LIGHT BREWING",
      classType: "India Pale Ale",
      alcoholContent: "6.8% ABV",
      netContents: "16 fl oz",
      governmentWarningText: GOVERNMENT_WARNING_BODY,
      governmentWarningHeading: "Government Warning:",
      governmentWarningHeadingAppearsBold: true,
      warningAppearsLegible: true,
      rawText:
        "HARBOR LIGHT BREWING India Pale Ale 6.8% ABV 16 fl oz Government Warning: (1) According to the Surgeon General...",
      confidence: 0.93,
      fieldConfidences: highFieldConfidences,
      extractionEvidence: {
        brandName: evidence("HARBOR LIGHT BREWING", 0.96, "HARBOR LIGHT BREWING"),
        classType: evidence("India Pale Ale", 0.95, "India Pale Ale"),
        alcoholContent: evidence("6.8% ABV", 0.96, "6.8% ABV"),
        netContents: evidence("16 fl oz", 0.96, "16 fl oz"),
        governmentWarning: evidence(`Government Warning: ${GOVERNMENT_WARNING_BODY}`, 0.95, "Government Warning: (1) According..."),
      },
      notes: ["Warning text is present, but heading is title case instead of all caps."],
    },
  },
  {
    id: "copper-ridge-vodka-label",
    name: "Copper Ridge Vodka",
    description: "Fictional vodka label with a clean product panel.",
    imagePath: "/realistic-samples/copper-ridge-vodka-label.png",
    expectedOverallStatus: "fail",
    expectedFailureOrReviewReason: "No government warning was detected.",
    expectedFields: {
      brandName: "COPPER RIDGE VODKA",
      classType: "Vodka",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "1 L",
    },
    demoExtraction: {
      brandName: "COPPER RIDGE VODKA",
      classType: "Vodka",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "1 L",
      governmentWarningText: "",
      governmentWarningHeading: undefined,
      governmentWarningHeadingAppearsBold: null,
      warningAppearsLegible: null,
      rawText: "COPPER RIDGE VODKA Vodka 40% Alc./Vol. (80 Proof) 1 L",
      confidence: 0.92,
      fieldConfidences: {
        brandName: 0.96,
        classType: 0.95,
        alcoholContent: 0.95,
        netContents: 0.95,
        governmentWarning: 0.9,
      },
      extractionEvidence: {
        brandName: evidence("COPPER RIDGE VODKA", 0.96, "COPPER RIDGE VODKA"),
        classType: evidence("Vodka", 0.95, "Vodka"),
        alcoholContent: evidence("40% Alc./Vol. (80 Proof)", 0.95, "40% Alc./Vol. (80 Proof)"),
        netContents: evidence("1 L", 0.95, "1 L"),
        governmentWarning: evidence(
          undefined,
          0,
          undefined,
          "No government warning text block is visible in the sampled label image.",
          "not_visible",
        ),
      },
      notes: ["No government warning detected."],
    },
  },
  {
    id: "mesa-verde-mezcal-glare",
    name: "Mesa Verde Mezcal",
    description: "Fictional mezcal label photographed with a realistic reflective surface.",
    imagePath: "/realistic-samples/mesa-verde-mezcal-glare.png",
    expectedOverallStatus: "needs_review",
    expectedFailureOrReviewReason: "Main fields are readable, but glare/legibility makes warning verification uncertain.",
    expectedFields: {
      brandName: "MESA VERDE MEZCAL",
      classType: "Mezcal",
      alcoholContent: "42% Alc./Vol.",
      netContents: "750 mL",
    },
    demoExtraction: {
      brandName: "MESA VERDE MEZCAL",
      classType: "Mezcal",
      alcoholContent: "42% Alc./Vol.",
      netContents: "750 mL",
      governmentWarningText: GOVERNMENT_WARNING_BODY,
      governmentWarningHeading: `${GOVERNMENT_WARNING_HEADING}:`,
      governmentWarningHeadingAppearsBold: null,
      warningAppearsLegible: false,
      rawText:
        "MESA VERDE MEZCAL Mezcal 42% Alc./Vol. 750 mL GOVERNMENT WARNING: warning block partly affected by glare...",
      confidence: 0.72,
      imageQuality: [
        {
          type: "glare",
          severity: "moderate",
          affectedFields: ["government_warning"],
          note: "Glare crosses the warning block and prevents confident visual verification.",
        },
      ],
      fieldConfidences: {
        brandName: 0.94,
        classType: 0.91,
        alcoholContent: 0.9,
        netContents: 0.9,
        governmentWarning: 0.48,
      },
      extractionEvidence: {
        brandName: evidence("MESA VERDE MEZCAL", 0.94, "MESA VERDE MEZCAL"),
        classType: evidence("Mezcal", 0.91, "Mezcal"),
        alcoholContent: evidence("42% Alc./Vol.", 0.9, "42% Alc./Vol."),
        netContents: evidence("750 mL", 0.9, "750 mL"),
        governmentWarning: evidence(
          GOVERNMENT_WARNING_TEXT,
          0.48,
          "GOVERNMENT WARNING: warning block partly affected by glare",
          "Glare crosses the warning block, so the complete warning cannot be confidently verified.",
        ),
      },
      notes: ["Main fields are readable, but glare/legibility makes warning verification uncertain."],
    },
  },
  {
    id: "north-fork-cidery-label",
    name: "North Fork Cidery",
    description: "Fictional cider label with a complete warning block.",
    imagePath: "/realistic-samples/north-fork-cidery-label.png",
    expectedOverallStatus: "needs_review",
    expectedFailureOrReviewReason: "Class/type is close but not exact: expected Hard Apple Cider, found Apple Cider.",
    expectedFields: {
      brandName: "NORTH FORK CIDERY",
      classType: "Hard Apple Cider",
      alcoholContent: "7% ABV",
      netContents: "12 fl oz",
    },
    demoExtraction: {
      brandName: "NORTH FORK CIDERY",
      classType: "Apple Cider",
      alcoholContent: "7% ABV",
      netContents: "12 fl oz",
      governmentWarningText: GOVERNMENT_WARNING_BODY,
      governmentWarningHeading: `${GOVERNMENT_WARNING_HEADING}:`,
      governmentWarningHeadingAppearsBold: true,
      warningAppearsLegible: true,
      rawText:
        "NORTH FORK CIDERY Apple Cider 7% ABV 12 fl oz GOVERNMENT WARNING: (1) According to the Surgeon General...",
      confidence: 0.93,
      fieldConfidences: highFieldConfidences,
      extractionEvidence: {
        brandName: evidence("NORTH FORK CIDERY", 0.96, "NORTH FORK CIDERY"),
        classType: evidence("Apple Cider", 0.95, "Apple Cider"),
        alcoholContent: evidence("7% ABV", 0.96, "7% ABV"),
        netContents: evidence("12 fl oz", 0.96, "12 fl oz"),
        governmentWarning: evidence(GOVERNMENT_WARNING_TEXT, 0.95, warningEvidenceQuote),
      },
      notes: ["Class/type is close but not exact: expected Hard Apple Cider, found Apple Cider."],
    },
  },
  {
    id: "silver-pine-gin-label",
    name: "Silver Pine Gin",
    description: "Fictional gin label with proof and metric contents expressed differently.",
    imagePath: "/realistic-samples/silver-pine-gin-label.png",
    expectedOverallStatus: "pass",
    expectedFailureOrReviewReason: "Proof and net contents are equivalent to expected values.",
    expectedFields: {
      brandName: "SILVER PINE GIN",
      classType: "Distilled Gin",
      alcoholContent: "47% ABV",
      netContents: "750 mL",
    },
    demoExtraction: {
      brandName: "SILVER PINE GIN",
      classType: "Distilled Gin",
      alcoholContent: "94 Proof",
      netContents: "0.75 L",
      governmentWarningText: GOVERNMENT_WARNING_BODY,
      governmentWarningHeading: `${GOVERNMENT_WARNING_HEADING}:`,
      governmentWarningHeadingAppearsBold: true,
      warningAppearsLegible: true,
      rawText:
        "SILVER PINE GIN Distilled Gin 94 Proof 0.75 L GOVERNMENT WARNING: (1) According to the Surgeon General...",
      confidence: 0.95,
      fieldConfidences: highFieldConfidences,
      extractionEvidence: {
        brandName: evidence("SILVER PINE GIN", 0.96, "SILVER PINE GIN"),
        classType: evidence("Distilled Gin", 0.95, "Distilled Gin"),
        alcoholContent: evidence("94 Proof", 0.96, "94 Proof"),
        netContents: evidence("0.75 L", 0.96, "0.75 L"),
        governmentWarning: evidence(GOVERNMENT_WARNING_TEXT, 0.95, warningEvidenceQuote),
      },
      notes: ["Proof and net contents are equivalent to expected values."],
    },
  },
];

export function findSampleCase(id: string | null | undefined): SampleCase | undefined {
  return sampleCases.find((sample) => sample.id === id);
}
