import type { ApplicationFields, ImagePreparationSummary, ReviewResult } from "./schemas";

export type ApiReviewResult = ReviewResult & {
  warnings?: string[];
  provider?: "openai" | "demo" | "manual";
};

export type AppMode = "single" | "batch";
export type JobStatus = "needs_input" | "ready" | "compressing" | "queued" | "reviewing" | "complete" | "failed" | "cancelled";
export type JobSource = "upload" | "sample";
export type FieldSource = "manual" | "csv" | "sample";

export type ReviewJob = {
  id: string;
  rowId: string;
  fileName: string;
  source: JobSource;
  sampleId?: string;
  originalFile?: File;
  preparedFile?: File;
  previewUrl: string;
  rotationDegrees: 0 | 90 | 180 | 270;
  expectedFields: ApplicationFields;
  fieldSource: FieldSource;
  imagePreparation?: ImagePreparationSummary;
  status: JobStatus;
  error?: string;
  result?: ApiReviewResult;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
};

export type BatchSummary = {
  total: number;
  completed: number;
  pass: number;
  needsReview: number;
  fail: number;
  failed: number;
};
