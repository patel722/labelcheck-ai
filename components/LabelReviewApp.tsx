"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileJson,
  FlaskConical,
  Info,
  ListChecks,
  Loader2,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { SampleSelector } from "@/components/SampleSelector";
import type { ApiReviewResult, AppMode, BatchSummary, JobStatus, ReviewJob } from "@/lib/batchTypes";
import { prepareImageFile, type PreparedImage } from "@/lib/clientImagePreparation";
import { parseExpectedFieldsCsv, type ExpectedFieldsCsvRow } from "@/lib/csvExpectedFields";
import { findSampleCase, sampleCases, type SampleCase } from "@/lib/samples";
import type {
  ApplicationFields,
  ExtractionEvidenceField,
  ImagePreparationSummary,
  ReviewResult,
  ReviewStatus,
} from "@/lib/schemas";

const initialFields: ApplicationFields = {
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
};

const batchLimit = 5;

const statusLabels: Record<ReviewStatus, string> = {
  pass: "Pass",
  needs_review: "Needs Review",
  fail: "Fail",
};

const jobStatusLabels: Record<JobStatus, string> = {
  needs_input: "Needs Input",
  ready: "Ready",
  compressing: "Preparing",
  queued: "Queued",
  reviewing: "Reviewing",
  complete: "Complete",
  failed: "Failed",
  cancelled: "Cancelled",
};

const statusDescriptions: Record<ReviewStatus, string> = {
  pass: "Extracted values match the expected application fields and required warning checks.",
  needs_review: "One or more values are ambiguous, low confidence, or require human verification.",
  fail: "One or more fields are missing, mismatched, or violate a strict requirement.",
};

const checkEvidenceFields: Record<string, ExtractionEvidenceField> = {
  "Brand Name": "brandName",
  "Class/Type": "classType",
  "Alcohol Content": "alcoholContent",
  "Net Contents": "netContents",
  "Government Warning": "governmentWarning",
};

const evidenceSourceLabels = {
  text: "visible text",
  visual: "visual cue",
  inferred_absent: "absence inferred",
  not_visible: "not visible",
} as const;

function statusIcon(status: ReviewStatus) {
  if (status === "pass") return <CheckCircle2 aria-hidden="true" />;
  if (status === "fail") return <XCircle aria-hidden="true" />;
  return <AlertTriangle aria-hidden="true" />;
}

function modeLabel(mode?: ReviewResult["mode"]): string {
  if (mode === "ai") return "AI mode";
  if (mode === "demo") return "Demo mode";
  return "Human review fallback";
}

function formatConfidence(confidence?: number): string {
  if (typeof confidence !== "number") return "Not provided";
  return `${Math.round(confidence * 100)}%`;
}

function formatBytes(bytes?: number): string {
  if (typeof bytes !== "number") return "Not available";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function nextRotation(current: 0 | 90 | 180 | 270, direction: "left" | "right"): 0 | 90 | 180 | 270 {
  const values = [0, 90, 180, 270] as const;
  const index = values.indexOf(current);
  return values[(index + (direction === "right" ? 1 : 3)) % values.length];
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function applicationFieldsComplete(fields: ApplicationFields): boolean {
  return Boolean(fields.brandName.trim() && fields.alcoholContent.trim() && fields.netContents.trim());
}

function batchSummary(jobs: ReviewJob[]): BatchSummary {
  return jobs.reduce(
    (summary, job) => {
      summary.total += 1;
      if (job.status === "complete" && job.result) {
        summary.completed += 1;
        if (job.result.overallStatus === "pass") summary.pass += 1;
        if (job.result.overallStatus === "needs_review") summary.needsReview += 1;
        if (job.result.overallStatus === "fail") summary.fail += 1;
      }
      if (job.status === "failed") summary.failed += 1;
      return summary;
    },
    { total: 0, completed: 0, pass: 0, needsReview: 0, fail: 0, failed: 0 },
  );
}

function makeCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
}

function jobMetaLabel(job: ReviewJob): string {
  if (job.source === "sample") return "preloaded fields · demo sample";
  if (job.fieldSource === "csv") return "CSV fields · upload";
  return "manual fields · upload";
}

function extractionEvidenceForCheck(result: ApiReviewResult, field: string) {
  const evidenceField = checkEvidenceFields[field];
  return evidenceField ? result.extracted.extractionEvidence?.[evidenceField] : undefined;
}

function extractionEvidenceCsvCells(result: ApiReviewResult, field: string): string[] {
  const evidence = extractionEvidenceForCheck(result, field);
  if (!evidence) return ["", "", ""];
  return [
    formatConfidence(evidence.confidence),
    evidenceSourceLabels[evidence.source],
    evidence.evidenceText ?? evidence.visualEvidence ?? evidence.value ?? "",
  ];
}

function resultExportPayload(
  result: ApiReviewResult,
  expectedFields: ApplicationFields,
  imagePreparation?: ImagePreparationSummary,
  sample?: SampleCase,
) {
  return {
    sampleId: sample?.id,
    sampleName: sample?.name,
    sampleImagePath: sample?.imagePath,
    expectedFields,
    extractedFields: result.extracted,
    checks: result.checks,
    overallStatus: result.overallStatus,
    processingMs: result.processingMs,
    mode: result.mode,
    provider: result.provider ?? result.mode,
    imagePreparation,
    imageQuality: result.extracted.imageQuality ?? [],
    notes: result.warnings ?? result.extracted.notes ?? [],
    limitations: [
      "Prototype recommendation only.",
      "AI extraction assists field reading; deterministic validators produce the review result.",
      "This is not an official legal determination.",
    ],
  };
}

async function postReview(fields: ApplicationFields, options: { file?: File; sampleId?: string }) {
  const formData = new FormData();
  formData.set("brandName", fields.brandName);
  formData.set("classType", fields.classType ?? "");
  formData.set("alcoholContent", fields.alcoholContent);
  formData.set("netContents", fields.netContents);
  if (options.sampleId) formData.set("sampleId", options.sampleId);
  if (options.file) formData.set("labelImage", options.file);

  const response = await fetch("/api/analyze", { method: "POST", body: formData });
  const data = (await response.json()) as ApiReviewResult & { error?: string; detail?: string };
  if (!response.ok) throw new Error(data.detail ? `${data.error} ${data.detail}` : data.error);
  return data;
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  return <span className={`job-status job-status-${status}`}>{jobStatusLabels[status]}</span>;
}

export function LabelReviewApp() {
  const [mode, setMode] = useState<AppMode>("single");
  const [fields, setFields] = useState<ApplicationFields>(initialFields);
  const [selectedSampleId, setSelectedSampleId] = useState("");
  const [singlePrepared, setSinglePrepared] = useState<PreparedImage | null>(null);
  const [singleOriginalFile, setSingleOriginalFile] = useState<File | null>(null);
  const [singleRotation, setSingleRotation] = useState<0 | 90 | 180 | 270>(0);
  const [result, setResult] = useState<ApiReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [jobs, setJobs] = useState<ReviewJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [batchErrors, setBatchErrors] = useState<string[]>([]);
  const [csvStatus, setCsvStatus] = useState<string>("No CSV imported.");
  const [liveMessage, setLiveMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const selectedSample = useMemo(
    () => sampleCases.find((sample) => sample.id === selectedSampleId),
    [selectedSampleId],
  );
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId],
  );
  const selectedJobSample = useMemo(() => findSampleCase(selectedJob?.sampleId), [selectedJob?.sampleId]);
  const activeResult = mode === "single" ? result : selectedJob?.result ?? null;
  const activeFields = mode === "single" ? fields : selectedJob?.expectedFields ?? fields;
  const activeImagePreparation = mode === "single" ? singlePrepared?.summary : selectedJob?.imagePreparation;
  const activeSample = mode === "single" ? selectedSample : selectedJobSample;
  const summary = useMemo(() => batchSummary(jobs), [jobs]);

  function updateField(name: keyof ApplicationFields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  function updateJobField(jobId: string, name: keyof ApplicationFields, value: string) {
    setJobs((current) =>
      current.map((job) => {
        if (job.id !== jobId) return job;
        const expectedFields = { ...job.expectedFields, [name]: value };
        return {
          ...job,
          expectedFields,
          fieldSource: job.fieldSource === "sample" ? "sample" : "manual",
          status: applicationFieldsComplete(expectedFields) && job.status === "needs_input" ? "ready" : job.status,
          error: applicationFieldsComplete(expectedFields) && job.status === "needs_input" ? undefined : job.error,
        };
      }),
    );
  }

  async function prepareSingleFile(file: File, rotationDegrees: 0 | 90 | 180 | 270) {
    if (singlePrepared?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(singlePrepared.previewUrl);
    const prepared = await prepareImageFile(file, rotationDegrees);
    setSinglePrepared(prepared);
    setSingleRotation(rotationDegrees);
  }

  function handleSampleChange(sampleId: string) {
    const sample = sampleCases.find((item) => item.id === sampleId);
    setSelectedSampleId(sampleId);
    setResult(null);
    setError(null);

    if (sample) {
      setFields(sample.expectedFields);
      setSinglePrepared(null);
      setSingleOriginalFile(null);
      setSingleRotation(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedSampleId("");
    setResult(null);
    setError(null);
    setSingleOriginalFile(nextFile);
    setSingleRotation(0);
    setSinglePrepared(null);

    if (!nextFile) return;
    try {
      setLiveMessage("Preparing selected image.");
      await prepareSingleFile(nextFile, 0);
      setLiveMessage("Image prepared for review.");
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : "Image could not be prepared.");
    }
  }

  async function rotateSingle(direction: "left" | "right") {
    if (!singleOriginalFile) return;
    try {
      const rotation = nextRotation(singleRotation, direction);
      await prepareSingleFile(singleOriginalFile, rotation);
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : "Image could not be rotated.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await postReview(fields, {
        file: singlePrepared?.file,
        sampleId: selectedSampleId || undefined,
      });
      setResult(data);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review the label.");
    } finally {
      setLoading(false);
    }
  }

  function buildUploadJob(file: File): ReviewJob {
    const expectedFields = applicationFieldsComplete(fields) ? fields : initialFields;
    return {
      id: newId("job"),
      rowId: file.name,
      fileName: file.name,
      source: "upload",
      originalFile: file,
      previewUrl: "",
      rotationDegrees: 0,
      expectedFields,
      fieldSource: "manual",
      status: applicationFieldsComplete(expectedFields) ? "compressing" : "needs_input",
      error: applicationFieldsComplete(expectedFields) ? undefined : "Complete expected fields or import a CSV row for this image.",
      createdAt: Date.now(),
    };
  }

  async function handleBatchFiles(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (!selectedFiles.length) return;
    setBatchErrors([]);

    const remaining = batchLimit - jobs.length;
    const acceptedFiles = selectedFiles.slice(0, Math.max(0, remaining));
    const errors: string[] = [];
    if (selectedFiles.length > remaining) errors.push(`Only ${remaining} more label image(s) can be added. Batch limit is ${batchLimit}.`);
    if (remaining <= 0) errors.push(`Batch is already at the ${batchLimit}-label limit.`);

    const createdJobs = acceptedFiles.map(buildUploadJob);
    setJobs((current) => [...current, ...createdJobs]);
    setSelectedJobId((current) => current ?? createdJobs[0]?.id ?? null);
    setLiveMessage(`${createdJobs.length} label image(s) added to the queue.`);

    for (const job of createdJobs) {
      try {
        const prepared = await prepareImageFile(job.originalFile as File, 0);
        setJobs((current) =>
          current.map((item) =>
            item.id === job.id
              ? {
                  ...item,
                  preparedFile: prepared.file,
                  previewUrl: prepared.previewUrl,
                  imagePreparation: prepared.summary,
                  status: applicationFieldsComplete(item.expectedFields) ? "ready" : "needs_input",
                  error: applicationFieldsComplete(item.expectedFields)
                    ? undefined
                    : "Complete expected fields or import a CSV row for this image.",
                }
              : item,
          ),
        );
      } catch (prepareError) {
        setJobs((current) =>
          current.map((item) =>
            item.id === job.id
              ? {
                  ...item,
                  status: "failed",
                  error: prepareError instanceof Error ? prepareError.message : "Image could not be prepared.",
                }
              : item,
          ),
        );
      }
    }

    setBatchErrors(errors);
    if (batchFileInputRef.current) batchFileInputRef.current.value = "";
  }

  function addSampleBatch() {
    const remaining = batchLimit - jobs.length;
    const samplesToAdd = sampleCases.slice(0, Math.max(0, remaining));
    const newJobs: ReviewJob[] = samplesToAdd.map((sample) => ({
      id: newId("sample"),
      rowId: sample.id,
      fileName: sample.name,
      source: "sample",
      sampleId: sample.id,
      previewUrl: sample.imagePath,
      rotationDegrees: 0,
      expectedFields: sample.expectedFields,
      fieldSource: "sample",
      status: "ready",
      createdAt: Date.now(),
    }));
    setJobs((current) => [...current, ...newJobs]);
    setSelectedJobId((current) => current ?? newJobs[0]?.id ?? null);
    setBatchErrors(remaining <= 0 ? [`Batch is already at the ${batchLimit}-label limit.`] : []);
    setLiveMessage(`${newJobs.length} sample label(s) added to the batch queue.`);
  }

  function applyCsvRows(rows: ExpectedFieldsCsvRow[]) {
    const errors: string[] = [];
    const rowMap = new Map(rows.map((row) => [row.fileName, row]));
    const jobFileCounts = new Map<string, number>();
    for (const job of jobs.filter((item) => item.source === "upload")) {
      jobFileCounts.set(job.fileName, (jobFileCounts.get(job.fileName) ?? 0) + 1);
    }
    for (const [fileName, count] of jobFileCounts) {
      if (count > 1) errors.push(`Uploaded filename "${fileName}" appears ${count} times; CSV matching requires unique filenames.`);
    }
    for (const row of rows) {
      if (!jobFileCounts.has(row.fileName)) errors.push(`CSV row ${row.rowNumber}: no uploaded image named "${row.fileName}".`);
    }

    setJobs((current) =>
      current.map((job) => {
        if (job.source !== "upload") return job;
        const row = rowMap.get(job.fileName);
        if (!row) {
          return {
            ...job,
            status: job.status === "failed" ? job.status : "needs_input",
            error: `No CSV row matched "${job.fileName}".`,
          };
        }
        return {
          ...job,
          rowId: row.rowId,
          expectedFields: row.fields,
          fieldSource: "csv",
          status: job.status === "failed" ? job.status : job.preparedFile ? "ready" : "compressing",
          error: job.status === "failed" ? job.error : undefined,
        };
      }),
    );

    setBatchErrors(errors);
    setCsvStatus(errors.length ? "CSV imported with mapping issues." : `${rows.length} CSV row(s) mapped to uploaded images.`);
    setLiveMessage("Expected-field CSV processed.");
  }

  async function handleCsvImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 128 * 1024) {
      setBatchErrors(["CSV is too large. Keep expected-field CSV files under 128 KB."]);
      return;
    }
    const parsed = parseExpectedFieldsCsv(await file.text());
    if (parsed.errors.length) {
      setBatchErrors(parsed.errors);
      setCsvStatus("CSV import failed.");
    } else {
      applyCsvRows(parsed.rows);
    }
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  async function rotateJob(jobId: string, direction: "left" | "right") {
    const job = jobs.find((item) => item.id === jobId);
    if (!job?.originalFile) return;
    const rotation = nextRotation(job.rotationDegrees, direction);
    setJobs((current) => current.map((item) => (item.id === jobId ? { ...item, status: "compressing", error: undefined } : item)));
    try {
      const prepared = await prepareImageFile(job.originalFile, rotation);
      setJobs((current) =>
        current.map((item) =>
          item.id === jobId
            ? {
                ...item,
                preparedFile: prepared.file,
                previewUrl: prepared.previewUrl,
                imagePreparation: prepared.summary,
                rotationDegrees: rotation,
                status: applicationFieldsComplete(item.expectedFields) ? "ready" : "needs_input",
              }
            : item,
        ),
      );
    } catch (prepareError) {
      setJobs((current) =>
        current.map((item) =>
          item.id === jobId
            ? {
                ...item,
                status: "failed",
                error: prepareError instanceof Error ? prepareError.message : "Image could not be rotated.",
              }
            : item,
        ),
      );
    }
  }

  function removeJob(jobId: string) {
    const job = jobs.find((item) => item.id === jobId);
    if (job?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(job.previewUrl);
    const remaining = jobs.filter((item) => item.id !== jobId);
    setJobs(remaining);
    setSelectedJobId((current) => (current === jobId ? remaining[0]?.id ?? null : current));
  }

  async function runBatch() {
    const runnable = jobs.filter((job) => job.status === "ready" && applicationFieldsComplete(job.expectedFields));
    if (!runnable.length) {
      setBatchErrors(["No ready labels are available for batch review."]);
      return;
    }
    setBatchErrors([]);
    setJobs((current) =>
      current.map((job) => (runnable.some((item) => item.id === job.id) ? { ...job, status: "queued", result: undefined, error: undefined } : job)),
    );
    setLiveMessage(`${runnable.length} label review(s) queued.`);

    let cursor = 0;
    async function worker() {
      while (cursor < runnable.length) {
        const job = runnable[cursor++];
        setJobs((current) => current.map((item) => (item.id === job.id ? { ...item, status: "reviewing", startedAt: Date.now() } : item)));
        try {
          const review = await postReview(job.expectedFields, {
            file: job.preparedFile,
            sampleId: job.sampleId,
          });
          setJobs((current) =>
            current.map((item) =>
              item.id === job.id
                ? { ...item, status: "complete", result: review, completedAt: Date.now(), error: undefined }
                : item,
            ),
          );
          setLiveMessage(`${job.fileName} review complete.`);
        } catch (reviewError) {
          setJobs((current) =>
            current.map((item) =>
              item.id === job.id
                ? {
                    ...item,
                    status: "failed",
                    completedAt: Date.now(),
                    error: reviewError instanceof Error ? reviewError.message : "Review failed.",
                  }
                : item,
            ),
          );
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(2, runnable.length) }, () => worker()));
  }

  function exportSelectedJson() {
    if (!activeResult) return;
    downloadBlob(
      `labelcheck-report-${new Date().toISOString()}.json`,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          ...resultExportPayload(activeResult, activeFields, activeImagePreparation, activeSample),
        },
        null,
        2,
      ),
      "application/json",
    );
  }

  function exportSelectedCsv() {
    if (!activeResult) return;
    const rows = [
      ["Field", "Expected", "Found", "Status", "Confidence", "Evidence Confidence", "Evidence Source", "Evidence", "Reason"],
      ...activeResult.checks.map((check) => [
        check.field,
        check.expected,
        check.found ?? "",
        check.status,
        formatConfidence(check.confidence),
        ...extractionEvidenceCsvCells(activeResult, check.field),
        check.reason,
      ]),
    ];
    downloadBlob(`labelcheck-summary-${new Date().toISOString()}.csv`, makeCsv(rows), "text/csv");
  }

  function exportBatchJson() {
    const completed = jobs.filter((job) => job.result);
    downloadBlob(
      `labelcheck-batch-${new Date().toISOString()}.json`,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          summary,
          items: completed.map((job) => ({
            rowId: job.rowId,
            fileName: job.fileName,
            sampleId: job.sampleId,
            sampleName: findSampleCase(job.sampleId)?.name,
            fieldSource: job.fieldSource,
            imagePreparation: job.imagePreparation,
            result: job.result
              ? resultExportPayload(job.result, job.expectedFields, job.imagePreparation, findSampleCase(job.sampleId))
              : undefined,
          })),
          failed: jobs.filter((job) => job.status === "failed").map((job) => ({ rowId: job.rowId, fileName: job.fileName, error: job.error })),
        },
        null,
        2,
      ),
      "application/json",
    );
  }

  function exportBatchCsv() {
    const rows = [
      [
        "rowId",
        "fileName",
        "overallStatus",
        "field",
        "expected",
        "found",
        "status",
        "confidence",
        "evidenceConfidence",
        "evidenceSource",
        "evidence",
        "reason",
      ],
      ...jobs.flatMap((job) => {
        const jobResult = job.result;
        return jobResult
          ? jobResult.checks.map((check) => [
              job.rowId,
              job.fileName,
              jobResult.overallStatus,
              check.field,
              check.expected,
              check.found ?? "",
              check.status,
              formatConfidence(check.confidence),
              ...extractionEvidenceCsvCells(jobResult, check.field),
              check.reason,
            ])
          : [[job.rowId, job.fileName, job.status, "", "", "", job.status, "", "", "", "", job.error ?? ""]];
      }),
    ];
    downloadBlob(`labelcheck-batch-${new Date().toISOString()}.csv`, makeCsv(rows), "text/csv");
  }

  return (
    <main className="app-shell">
      <section className="masthead" aria-labelledby="page-title">
        <div>
          <div className="brand-lockup">
            <ShieldCheck aria-hidden="true" />
            <span>LabelCheck AI</span>
          </div>
          <h1 id="page-title">LabelCheck AI</h1>
          <p>AI-assisted alcohol label verification prototype</p>
        </div>
        <div className="prototype-note">
          <Info aria-hidden="true" />
          <p>
            Prototype only. Uploaded labels are processed for analysis and are not stored by this
            application. AI assists extraction; deterministic rules produce review recommendations.
            This is not an official legal determination.
          </p>
        </div>
      </section>

      <div className="mode-switch-row">
        <div className="mode-switch" role="tablist" aria-label="Review mode">
          <button type="button" className={mode === "single" ? "active" : ""} onClick={() => setMode("single")}>
            Single
          </button>
          <button type="button" className={mode === "batch" ? "active" : ""} onClick={() => setMode("batch")}>
            Batch
          </button>
        </div>
      </div>

      {mode === "single" ? (
        <form className="workspace-grid" onSubmit={handleSubmit}>
          <section className="panel input-panel" aria-labelledby="fields-heading">
            <div className="section-heading">
              <div>
                <h2 id="fields-heading">Application Fields</h2>
                <p>Enter the expected application values for comparison.</p>
              </div>
            </div>
            <FieldEditor fields={fields} onChange={updateField} />
            <div className="sample-strip">
              <SampleSelector selectedSampleId={selectedSampleId} onSelect={handleSampleChange} />
            </div>

            <section className="upload-box" aria-labelledby="upload-heading">
              <div>
                <h3 id="upload-heading">Label Image</h3>
                <p>Upload one label image, or choose a fictional sample label.</p>
                <p className="fine-print">
                  Prototype note: upload the primary label image. A production workflow could extend this to front/back or multi-panel label sets.
                </p>
              </div>
              <label className="file-drop">
                <Upload aria-hidden="true" />
                <span>{singleOriginalFile ? singleOriginalFile.name : selectedSample ? selectedSample.name : "Choose label image"}</span>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
              </label>
              <ImagePreview src={singlePrepared?.previewUrl ?? selectedSample?.imagePath ?? null} />
              {singleOriginalFile ? (
                <ImagePrepControls
                  summary={singlePrepared?.summary}
                  onRotateLeft={() => rotateSingle("left")}
                  onRotateRight={() => rotateSingle("right")}
                />
              ) : null}
            </section>

            <button className="primary-action" type="submit" disabled={loading}>
              {loading ? <Loader2 aria-hidden="true" className="spin" /> : <FlaskConical aria-hidden="true" />}
              {loading ? "Reviewing Label" : "Review Label"}
            </button>
            <ProviderBoundary />
          </section>
          <ResultPanel
            result={result}
            error={error}
            mode={result?.mode}
            detailsOpen={detailsOpen}
            onDetailsToggle={setDetailsOpen}
            onExportJson={exportSelectedJson}
            onExportCsv={exportSelectedCsv}
            imagePreparation={singlePrepared?.summary}
            sample={selectedSample}
            expectedFields={activeFields}
          />
        </form>
      ) : (
        <section className="workspace-grid batch-workspace" aria-label="Batch label review workspace">
          <div className="panel input-panel">
            <div className="section-heading">
              <div>
                <h2>Batch Queue</h2>
                <p>Add up to five labels, import expected fields, then review with visible progress.</p>
              </div>
            </div>
            <FieldEditor fields={fields} onChange={updateField} />
            <div className="batch-actions">
              <label className="file-drop compact-drop">
                <Upload aria-hidden="true" />
                <span>Add label images</span>
                <input ref={batchFileInputRef} type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={handleBatchFiles} />
              </label>
              <label className="file-drop compact-drop">
                <ListChecks aria-hidden="true" />
                <span>Import expected fields CSV</span>
                <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleCsvImport} />
              </label>
              <button type="button" className="secondary-action" onClick={addSampleBatch} disabled={jobs.length >= batchLimit}>
                Add sample batch
              </button>
            </div>
            <p className="csv-status">{csvStatus}</p>
            {batchErrors.length ? <MessageList tone="error" messages={batchErrors} /> : null}
            <BatchSummaryCards summary={summary} />
            <div className="queue-list" aria-label="Batch review queue">
              {jobs.length ? (
                jobs.map((job) => (
                  <article
                    key={job.id}
                    className={`queue-row ${selectedJob?.id === job.id ? "selected" : ""}`}
                    aria-current={selectedJob?.id === job.id ? "true" : undefined}
                  >
                    <button type="button" className="queue-select" onClick={() => setSelectedJobId(job.id)}>
                      <ImagePreview src={job.previewUrl || null} compact />
                      <span>
                        <strong>{job.fileName}</strong>
                        <small>{jobMetaLabel(job)}</small>
                      </span>
                    </button>
                    <JobStatusBadge status={job.status} />
                    <button type="button" className="text-button" onClick={() => removeJob(job.id)}>
                      Remove
                    </button>
                  </article>
                ))
              ) : (
                <div className="empty-preview">No labels queued</div>
              )}
            </div>
            <button className="primary-action" type="button" onClick={runBatch} disabled={!jobs.some((job) => job.status === "ready")}>
              <FlaskConical aria-hidden="true" />
              Review Ready Queue
            </button>
            <div className="export-actions">
              <button type="button" onClick={exportBatchJson} disabled={!jobs.some((job) => job.result)}>
                <FileJson aria-hidden="true" />
                Export all JSON
              </button>
              <button type="button" onClick={exportBatchCsv} disabled={!jobs.length}>
                <Download aria-hidden="true" />
                Export all CSV
              </button>
            </div>
            <ProviderBoundary />
          </div>

          <div className="panel result-panel" aria-busy={selectedJob?.status === "reviewing"}>
            {selectedJob ? (
              <>
                <div className="section-heading">
                  <div>
                    <h2>Selected Label</h2>
                    <p>{selectedJob.fileName}</p>
                  </div>
                  <JobStatusBadge status={selectedJob.status} />
                </div>
                <FieldEditor fields={selectedJob.expectedFields} onChange={(name, value) => updateJobField(selectedJob.id, name, value)} compact />
                {selectedJob.source === "upload" ? (
                  <ImagePrepControls
                    summary={selectedJob.imagePreparation}
                    onRotateLeft={() => rotateJob(selectedJob.id, "left")}
                    onRotateRight={() => rotateJob(selectedJob.id, "right")}
                  />
                ) : null}
                {selectedJob.error ? <MessageList tone="error" messages={[selectedJob.error]} /> : null}
                <ResultPanel
                  result={selectedJob.result ?? null}
                  error={null}
                  mode={selectedJob.result?.mode}
                  detailsOpen={detailsOpen}
                  onDetailsToggle={setDetailsOpen}
                  onExportJson={exportSelectedJson}
                  onExportCsv={exportSelectedCsv}
                  imagePreparation={selectedJob.imagePreparation}
                  sample={selectedJobSample}
                  expectedFields={selectedJob.expectedFields}
                  embedded
                />
              </>
            ) : (
              <div className="empty-result">
                <ShieldCheck aria-hidden="true" />
                <h3>No label selected</h3>
                <p>Add labels to the queue, then select one to review its details.</p>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="sr-only" aria-live="polite">{liveMessage}</div>
    </main>
  );
}

function FieldEditor({
  fields,
  onChange,
  compact = false,
}: {
  fields: ApplicationFields;
  onChange: (name: keyof ApplicationFields, value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "form-grid compact-form" : "form-grid"}>
      <label>
        <span>Brand name</span>
        <input value={fields.brandName} onChange={(event) => onChange("brandName", event.target.value)} placeholder="OLD TOM DISTILLERY" required />
      </label>
      <label>
        <span>Class/type</span>
        <input value={fields.classType ?? ""} onChange={(event) => onChange("classType", event.target.value)} placeholder="Kentucky Straight Bourbon Whiskey" />
      </label>
      <label>
        <span>Alcohol content</span>
        <input value={fields.alcoholContent} onChange={(event) => onChange("alcoholContent", event.target.value)} placeholder="45% Alc./Vol. (90 Proof)" required />
      </label>
      <label>
        <span>Net contents</span>
        <input value={fields.netContents} onChange={(event) => onChange("netContents", event.target.value)} placeholder="750 mL" required />
      </label>
    </div>
  );
}

function ImagePreview({ src, compact = false }: { src: string | null; compact?: boolean }) {
  if (!src) return <div className={compact ? "queue-thumb empty-preview" : "empty-preview"}>No label selected</div>;
  return (
    <div className={compact ? "queue-thumb image-preview" : "image-preview"}>
      <img src={src} alt="Selected alcohol label preview" />
    </div>
  );
}

function ImagePrepControls({
  summary,
  onRotateLeft,
  onRotateRight,
}: {
  summary?: ImagePreparationSummary;
  onRotateLeft: () => void;
  onRotateRight: () => void;
}) {
  return (
    <div className="image-prep">
      <div>
        <strong>Image preparation</strong>
        <span>
          {formatBytes(summary?.originalBytes)} to {formatBytes(summary?.submittedBytes)}
          {summary?.submittedWidth && summary?.submittedHeight ? ` · ${summary.submittedWidth}x${summary.submittedHeight}` : ""}
        </span>
      </div>
      <div className="rotate-actions">
        <button type="button" onClick={onRotateLeft} title="Rotate left">
          <RotateCcw aria-hidden="true" />
          <span>Left</span>
        </button>
        <button type="button" onClick={onRotateRight} title="Rotate right">
          <RotateCw aria-hidden="true" />
          <span>Right</span>
        </button>
      </div>
      {summary?.warnings.length ? <MessageList tone="info" messages={summary.warnings} /> : null}
    </div>
  );
}

function BatchSummaryCards({ summary }: { summary: ReturnType<typeof batchSummary> }) {
  return (
    <div className="summary-grid">
      <SummaryCard label="Total" value={summary.total} />
      <SummaryCard label="Complete" value={summary.completed} />
      <SummaryCard label="Pass" value={summary.pass} tone="pass" />
      <SummaryCard label="Needs Review" value={summary.needsReview} tone="review" />
      <SummaryCard label="Fail" value={summary.fail} tone="fail" />
      <SummaryCard label="Process Failed" value={summary.failed} tone="fail" />
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "pass" | "review" | "fail" }) {
  return (
    <div className={`summary-card ${tone ? `summary-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MessageList({ tone, messages }: { tone: "error" | "info"; messages: string[] }) {
  return (
    <div className={tone === "error" ? "error-box message-list" : "review-notes message-list"} role={tone === "error" ? "alert" : "status"}>
      {tone === "error" ? <AlertTriangle aria-hidden="true" /> : <Info aria-hidden="true" />}
      <ul>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

function ProviderBoundary() {
  return (
    <div className="provider-boundary">
      <Info aria-hidden="true" />
      <p>
        Custom uploads use server-side OpenAI Vision when configured. Sample labels use repeatable local demo extraction. If extraction is unavailable,
        the app routes the review to <strong>Needs Review</strong> instead of making a final automated call.
      </p>
    </div>
  );
}

function ResultPanel({
  result,
  error,
  mode,
  detailsOpen,
  onDetailsToggle,
  onExportJson,
  onExportCsv,
  imagePreparation,
  sample,
  expectedFields,
  embedded = false,
}: {
  result: ApiReviewResult | null;
  error: string | null;
  mode?: ReviewResult["mode"];
  detailsOpen: boolean;
  onDetailsToggle: (open: boolean) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  imagePreparation?: ImagePreparationSummary;
  sample?: SampleCase;
  expectedFields: ApplicationFields;
  embedded?: boolean;
}) {
  return (
    <section className={embedded ? "result-contents" : "panel result-panel"} aria-labelledby={embedded ? undefined : "result-heading"}>
      {!embedded ? (
        <div className="section-heading">
          <div>
            <h2 id="result-heading">Review Result</h2>
            <p>Recommendation produced by deterministic validation rules.</p>
          </div>
          {result ? (
            <div className={`mode-pill mode-${mode}`}>
              {modeLabel(mode)}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="error-box" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {result ? (
        <>
          <div className={`recommendation status-${result.overallStatus}`}>
            <div>{statusIcon(result.overallStatus)}</div>
            <div>
              <span>Recommendation</span>
              <strong>{statusLabels[result.overallStatus]}</strong>
              <p>{statusDescriptions[result.overallStatus]}</p>
            </div>
            <dl>
              <div>
                <dt>Processing time</dt>
                <dd>{result.processingMs} ms</dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{result.provider ?? result.mode}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>{modeLabel(result.mode)}</dd>
              </div>
            </dl>
          </div>

          {result.warnings?.length ? <MessageList tone="info" messages={result.warnings} /> : null}

          <div className="checks-list" aria-label="Field-level compliance review report">
            {result.checks.map((check) => {
              const evidence = extractionEvidenceForCheck(result, check.field);
              const evidenceNote =
                evidence?.evidenceText ?? evidence?.visualEvidence ?? evidence?.value ?? "No extraction evidence note returned.";

              return (
                <article className="check-row" key={check.field}>
                  <div className={`check-status status-${check.status}`}>
                    {statusIcon(check.status)}
                    <span>{statusLabels[check.status]}</span>
                  </div>
                  <div className="check-main">
                    <div className="check-title">
                      <h3>{check.field}</h3>
                      <span>Confidence: {formatConfidence(check.confidence)}</span>
                    </div>
                    <dl className="field-values">
                      <div>
                        <dt>Expected</dt>
                        <dd>{check.expected}</dd>
                      </div>
                      <div>
                        <dt>Found</dt>
                        <dd>{check.found || "Not found"}</dd>
                      </div>
                    </dl>
                    <p>{check.reason}</p>
                    {evidence ? (
                      <div className="extraction-evidence">
                        <div>
                          <span>Extraction evidence</span>
                          <strong>
                            Evidence confidence: {formatConfidence(evidence.confidence)} ·{" "}
                            {evidenceSourceLabels[evidence.source]}
                          </strong>
                        </div>
                        <p>{evidenceNote}</p>
                        {evidence.visualEvidence && evidence.visualEvidence !== evidenceNote ? (
                          <p className="visual-evidence">{evidence.visualEvidence}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="export-actions">
            <button type="button" onClick={onExportJson}>
              <FileJson aria-hidden="true" />
              Export JSON report
            </button>
            <button type="button" onClick={onExportCsv}>
              <Download aria-hidden="true" />
              Export CSV summary
            </button>
          </div>

          <details className="debug-panel" open={detailsOpen} onToggle={(event) => onDetailsToggle(event.currentTarget.open)}>
            <summary>
              <span>Details/debug panel</span>
              <ChevronDown aria-hidden="true" />
            </summary>
            <div className="debug-grid">
              <section>
                <h3>Run metadata</h3>
                <pre>{JSON.stringify({ mode: result.mode, provider: result.provider ?? result.mode, processingMs: result.processingMs, overallStatus: result.overallStatus, sampleId: sample?.id, sampleName: sample?.name }, null, 2)}</pre>
              </section>
              {sample ? (
                <section>
                  <h3>Sample context</h3>
                  <pre>{JSON.stringify({ sampleId: sample.id, sampleName: sample.name, imagePath: sample.imagePath, description: sample.description }, null, 2)}</pre>
                </section>
              ) : null}
              <section>
                <h3>Expected fields</h3>
                <pre>{JSON.stringify(expectedFields, null, 2)}</pre>
              </section>
              <section>
                <h3>Image preparation</h3>
                <pre>{JSON.stringify(imagePreparation ?? {}, null, 2)}</pre>
              </section>
              <section>
                <h3>Raw extracted text</h3>
                <pre>{result.extracted.rawText || "No raw text returned."}</pre>
              </section>
              <section>
                <h3>Structured extraction JSON</h3>
                <pre>{JSON.stringify(result.extracted, null, 2)}</pre>
              </section>
              <section>
                <h3>Normalized values</h3>
                <pre>{JSON.stringify(result.checks.map((check) => ({ field: check.field, normalizedExpected: check.normalizedExpected, normalizedFound: check.normalizedFound })), null, 2)}</pre>
              </section>
              <section>
                <h3>Warnings/errors</h3>
                <pre>{JSON.stringify(result.warnings ?? result.extracted.notes ?? [], null, 2)}</pre>
              </section>
            </div>
          </details>
        </>
      ) : (
        <div className="empty-result">
          <ShieldCheck aria-hidden="true" />
          <h3>No review yet</h3>
          <p>Complete the expected fields, add a label image or sample, then run Review Label.</p>
        </div>
      )}
    </section>
  );
}
