import { z } from "zod";

export const reviewStatuses = ["pass", "needs_review", "fail"] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

export const applicationFieldsSchema = z.object({
  brandName: z.string().trim().min(1, "Brand name is required."),
  classType: z.string().trim().optional(),
  alcoholContent: z.string().trim().min(1, "Alcohol content is required."),
  netContents: z.string().trim().min(1, "Net contents is required."),
});

export type ApplicationFields = z.infer<typeof applicationFieldsSchema>;

export const imageQualityFlagTypes = [
  "glare",
  "blur",
  "angle",
  "crop",
  "low_resolution",
  "occlusion",
] as const;
export type ImageQualityFlagType = (typeof imageQualityFlagTypes)[number];

export const imageQualitySeverities = ["minor", "moderate", "severe"] as const;
export type ImageQualitySeverity = (typeof imageQualitySeverities)[number];

export const imageQualityAffectedFields = [
  "brand",
  "class_type",
  "alcohol_content",
  "net_contents",
  "government_warning",
] as const;
export type ImageQualityAffectedField = (typeof imageQualityAffectedFields)[number];

export type ImageQualityFlag = {
  type: ImageQualityFlagType;
  severity: ImageQualitySeverity;
  affectedFields: ImageQualityAffectedField[];
  note: string;
};

export type ImagePreparationSummary = {
  originalBytes: number;
  submittedBytes: number;
  originalWidth?: number;
  originalHeight?: number;
  submittedWidth?: number;
  submittedHeight?: number;
  originalMimeType: string;
  submittedMimeType: string;
  rotationDegrees: 0 | 90 | 180 | 270;
  compressed: boolean;
  warnings: string[];
};

export const extractionEvidenceFields = [
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "governmentWarning",
] as const;
export type ExtractionEvidenceField = (typeof extractionEvidenceFields)[number];

export const extractionEvidenceSources = ["text", "visual", "inferred_absent", "not_visible"] as const;
export type ExtractionEvidenceSource = (typeof extractionEvidenceSources)[number];

export type ExtractionEvidenceItem = {
  value?: string;
  confidence: number;
  evidenceText?: string;
  visualEvidence?: string;
  source: ExtractionEvidenceSource;
};

export type ExtractedLabel = {
  brandName?: string;
  classType?: string;
  alcoholContent?: string;
  netContents?: string;
  governmentWarningText?: string;
  governmentWarningHeading?: string;
  governmentWarningHeadingAppearsBold?: boolean | null;
  warningAppearsLegible?: boolean | null;
  rawText?: string;
  confidence: number;
  imageQuality?: ImageQualityFlag[];
  fieldConfidences?: {
    brandName?: number;
    classType?: number;
    alcoholContent?: number;
    netContents?: number;
    governmentWarning?: number;
  };
  extractionEvidence?: Partial<Record<ExtractionEvidenceField, ExtractionEvidenceItem>>;
  notes?: string[];
};

export type CheckResult = {
  field: string;
  expected: string;
  found?: string;
  normalizedExpected?: string;
  normalizedFound?: string;
  status: ReviewStatus;
  reason: string;
  confidence?: number;
};

export type ReviewResult = {
  overallStatus: ReviewStatus;
  checks: CheckResult[];
  extracted: ExtractedLabel;
  processingMs: number;
  mode: "ai" | "demo" | "manual";
};

const extractionEvidenceItemSchema = z.object({
  value: z.string().trim().optional(),
  confidence: z.number().min(0).max(1),
  evidenceText: z.string().trim().optional(),
  visualEvidence: z.string().trim().optional(),
  source: z.enum(extractionEvidenceSources),
});

export const extractedLabelSchema = z.object({
  brandName: z.string().trim().optional(),
  classType: z.string().trim().optional(),
  alcoholContent: z.string().trim().optional(),
  netContents: z.string().trim().optional(),
  governmentWarningText: z.string().trim().optional(),
  governmentWarningHeading: z.string().trim().optional(),
  governmentWarningHeadingAppearsBold: z.boolean().nullable().optional(),
  warningAppearsLegible: z.boolean().nullable().optional(),
  rawText: z.string().optional(),
  confidence: z.number().min(0).max(1),
  imageQuality: z
    .array(
      z.object({
        type: z.enum(imageQualityFlagTypes),
        severity: z.enum(imageQualitySeverities),
        affectedFields: z.array(z.enum(imageQualityAffectedFields)),
        note: z.string().trim(),
      }),
    )
    .optional(),
  fieldConfidences: z
    .object({
      brandName: z.number().min(0).max(1).optional(),
      classType: z.number().min(0).max(1).optional(),
      alcoholContent: z.number().min(0).max(1).optional(),
      netContents: z.number().min(0).max(1).optional(),
      governmentWarning: z.number().min(0).max(1).optional(),
    })
    .optional(),
  extractionEvidence: z
    .object({
      brandName: extractionEvidenceItemSchema.optional(),
      classType: extractionEvidenceItemSchema.optional(),
      alcoholContent: extractionEvidenceItemSchema.optional(),
      netContents: extractionEvidenceItemSchema.optional(),
      governmentWarning: extractionEvidenceItemSchema.optional(),
    })
    .optional(),
  notes: z.array(z.string()).optional(),
}) satisfies z.ZodType<ExtractedLabel>;
