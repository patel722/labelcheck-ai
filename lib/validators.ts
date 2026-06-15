import type {
  ApplicationFields,
  CheckResult,
  ExtractedLabel,
  ImageQualityAffectedField,
  ReviewResult,
  ReviewStatus,
} from "./schemas";
import {
  formatAbv,
  formatMl,
  normalizeClassType,
  normalizeLabelName,
  parseAlcoholContent,
  parseNetContentsMl,
  similarityScore,
} from "./normalize";
import {
  GOVERNMENT_WARNING_HEADING,
  GOVERNMENT_WARNING_TEXT,
  normalizeWarningText,
} from "./warningText";

const LOW_CONFIDENCE_THRESHOLD = 0.6;
const CLOSE_MATCH_THRESHOLD = 0.82;

function canonicalWarningHeading(value?: string): string {
  return normalizeWarningText(value ?? "").replace(/:$/, "");
}

function confidenceNeedsReview(confidence?: number): boolean {
  return typeof confidence === "number" && confidence < LOW_CONFIDENCE_THRESHOLD;
}

function imageQualityReason(
  extracted: ExtractedLabel,
  affectedField: ImageQualityAffectedField,
): string | undefined {
  const flags = extracted.imageQuality?.filter((flag) => flag.affectedFields.includes(affectedField)) ?? [];
  if (!flags.length) return undefined;
  const summary = flags.map((flag) => `${flag.type.replaceAll("_", " ")} (${flag.severity})`).join(", ");
  return `Image quality may affect this field: ${summary}. Route to human review before making a final call.`;
}

function textCheck(options: {
  field: string;
  expected: string;
  found?: string;
  confidence?: number;
  normalizer: (value: string) => string;
  exactPassReason: string;
  closeReason: string;
  missingReason: string;
  mismatchReason: string;
  missingReviewReason?: string;
}): CheckResult {
  const {
    field,
    expected,
    found,
    confidence,
    normalizer,
    exactPassReason,
    closeReason,
    missingReason,
    mismatchReason,
    missingReviewReason,
  } = options;
  const normalizedExpected = normalizer(expected);
  const normalizedFound = found ? normalizer(found) : undefined;

  if (!found || !normalizedFound) {
    const lowConfidenceReason = confidenceNeedsReview(confidence)
      ? "Extraction confidence is low, so a human should verify before failing the field."
      : undefined;
    const reviewReason = missingReviewReason ?? lowConfidenceReason;
    return {
      field,
      expected,
      found,
      normalizedExpected,
      normalizedFound,
      status: reviewReason ? "needs_review" : "fail",
      reason: reviewReason ? `${missingReason} ${reviewReason}` : missingReason,
      confidence,
    };
  }

  if (normalizedExpected === normalizedFound) {
    return {
      field,
      expected,
      found,
      normalizedExpected,
      normalizedFound,
      status: confidenceNeedsReview(confidence) ? "needs_review" : "pass",
      reason: confidenceNeedsReview(confidence)
        ? `${exactPassReason} Extraction confidence is low, so a human should verify the field.`
        : exactPassReason,
      confidence,
    };
  }

  const similarity = similarityScore(normalizedExpected, normalizedFound);
  if (similarity >= CLOSE_MATCH_THRESHOLD) {
    return {
      field,
      expected,
      found,
      normalizedExpected,
      normalizedFound,
      status: "needs_review",
      reason: `${closeReason} Similarity score: ${similarity.toFixed(2)}.`,
      confidence,
    };
  }

  return {
    field,
    expected,
    found,
    normalizedExpected,
    normalizedFound,
    status: confidenceNeedsReview(confidence) ? "needs_review" : "fail",
    reason: confidenceNeedsReview(confidence)
      ? `${mismatchReason} Extraction confidence is low, so this should be reviewed before failing.`
      : mismatchReason,
    confidence,
  };
}

export function validateBrandName(application: ApplicationFields, extracted: ExtractedLabel): CheckResult {
  return textCheck({
    field: "Brand Name",
    expected: application.brandName,
    found: extracted.brandName,
    confidence: extracted.fieldConfidences?.brandName,
    normalizer: normalizeLabelName,
    exactPassReason: "Brand name matches after normalizing case, punctuation, apostrophes, and spacing.",
    closeReason: "Brand name is close but not an exact normalized match; human judgment is appropriate.",
    missingReason: "Brand name was not found on the extracted label.",
    mismatchReason: "Brand name appears materially different from the application field.",
    missingReviewReason: imageQualityReason(extracted, "brand"),
  });
}

export function validateClassType(application: ApplicationFields, extracted: ExtractedLabel): CheckResult {
  const expected = application.classType?.trim();
  if (!expected) {
    return {
      field: "Class/Type",
      expected: "Not provided",
      found: extracted.classType,
      normalizedExpected: undefined,
      normalizedFound: extracted.classType ? normalizeClassType(extracted.classType) : undefined,
      status: "needs_review",
      reason: "No expected class/type was provided in the application fields.",
      confidence: extracted.fieldConfidences?.classType,
    };
  }

  const found = extracted.classType;
  const confidence = extracted.fieldConfidences?.classType;
  const normalizedExpected = normalizeClassType(expected);
  const normalizedFound = found ? normalizeClassType(found) : undefined;

  if (found && normalizedFound && normalizedExpected !== normalizedFound) {
    const expectedTokens = new Set(normalizedExpected.split(" ").filter(Boolean));
    const foundTokens = new Set(normalizedFound.split(" ").filter(Boolean));
    const foundIsSubset = [...foundTokens].every((token) => expectedTokens.has(token));
    const expectedIsSubset = [...expectedTokens].every((token) => foundTokens.has(token));

    if (foundIsSubset || expectedIsSubset) {
      return {
        field: "Class/Type",
        expected,
        found,
        normalizedExpected,
        normalizedFound,
        status: "needs_review",
        reason: "Class/type is close but not exact; a reviewer should verify whether the label wording is acceptable.",
        confidence,
      };
    }
  }

  return textCheck({
    field: "Class/Type",
    expected,
    found,
    confidence,
    normalizer: normalizeClassType,
    exactPassReason: "Class/type matches after normalizing case, punctuation, and spacing.",
    closeReason: "Class/type is close but not exact; a reviewer should verify the label wording.",
    missingReason: "Class/type was not found on the extracted label.",
    mismatchReason: "Class/type appears materially different from the application field.",
    missingReviewReason: imageQualityReason(extracted, "class_type"),
  });
}

export function validateAlcoholContent(application: ApplicationFields, extracted: ExtractedLabel): CheckResult {
  const expectedAbv = parseAlcoholContent(application.alcoholContent);
  const foundAbv = extracted.alcoholContent ? parseAlcoholContent(extracted.alcoholContent) : null;
  const confidence = extracted.fieldConfidences?.alcoholContent;
  const qualityReason = imageQualityReason(extracted, "alcohol_content");

  if (expectedAbv === null) {
    return {
      field: "Alcohol Content",
      expected: application.alcoholContent,
      found: extracted.alcoholContent,
      normalizedExpected: undefined,
      normalizedFound: foundAbv === null ? undefined : formatAbv(foundAbv),
      status: "needs_review",
      reason: "Expected alcohol content could not be parsed confidently from the application field.",
      confidence,
    };
  }

  if (foundAbv === null) {
    const lowConfidenceReason = confidenceNeedsReview(confidence)
      ? "Extraction confidence is low, so a human should verify before failing the field."
      : undefined;
    const reviewReason = qualityReason ?? lowConfidenceReason;
    return {
      field: "Alcohol Content",
      expected: application.alcoholContent,
      found: extracted.alcoholContent,
      normalizedExpected: formatAbv(expectedAbv),
      normalizedFound: undefined,
      status: extracted.alcoholContent || reviewReason ? "needs_review" : "fail",
      reason: extracted.alcoholContent
        ? "Alcohol content was found, but the ABV/proof value could not be parsed confidently."
        : reviewReason
          ? `Alcohol content was not found on the extracted label. ${reviewReason}`
          : "Alcohol content was not found on the extracted label.",
      confidence,
    };
  }

  const difference = Math.abs(expectedAbv - foundAbv);
  if (difference <= 0.25) {
    return {
      field: "Alcohol Content",
      expected: application.alcoholContent,
      found: extracted.alcoholContent,
      normalizedExpected: formatAbv(expectedAbv),
      normalizedFound: formatAbv(foundAbv),
      status: confidenceNeedsReview(confidence) ? "needs_review" : "pass",
      reason: confidenceNeedsReview(confidence)
        ? "Alcohol content is numerically equivalent, but extraction confidence is low."
        : "Alcohol content is numerically equivalent after parsing ABV/proof values.",
      confidence,
    };
  }

  return {
    field: "Alcohol Content",
    expected: application.alcoholContent,
    found: extracted.alcoholContent,
    normalizedExpected: formatAbv(expectedAbv),
    normalizedFound: formatAbv(foundAbv),
    status: "fail",
    reason: `Alcohol content differs by ${difference.toFixed(2)} percentage points ABV.`,
    confidence,
  };
}

export function validateNetContents(application: ApplicationFields, extracted: ExtractedLabel): CheckResult {
  const expectedMl = parseNetContentsMl(application.netContents);
  const foundMl = extracted.netContents ? parseNetContentsMl(extracted.netContents) : null;
  const confidence = extracted.fieldConfidences?.netContents;
  const qualityReason = imageQualityReason(extracted, "net_contents");

  if (expectedMl === null) {
    return {
      field: "Net Contents",
      expected: application.netContents,
      found: extracted.netContents,
      normalizedExpected: undefined,
      normalizedFound: foundMl === null ? undefined : formatMl(foundMl),
      status: "needs_review",
      reason: "Expected net contents could not be parsed confidently from the application field.",
      confidence,
    };
  }

  if (foundMl === null) {
    const lowConfidenceReason = confidenceNeedsReview(confidence)
      ? "Extraction confidence is low, so a human should verify before failing the field."
      : undefined;
    const reviewReason = qualityReason ?? lowConfidenceReason;
    return {
      field: "Net Contents",
      expected: application.netContents,
      found: extracted.netContents,
      normalizedExpected: formatMl(expectedMl),
      normalizedFound: undefined,
      status: extracted.netContents || reviewReason ? "needs_review" : "fail",
      reason: extracted.netContents
        ? "Net contents were found, but the unit or quantity could not be parsed confidently."
        : reviewReason
          ? `Net contents were not found on the extracted label. ${reviewReason}`
          : "Net contents were not found on the extracted label.",
      confidence,
    };
  }

  const difference = Math.abs(expectedMl - foundMl);
  if (difference <= 1) {
    return {
      field: "Net Contents",
      expected: application.netContents,
      found: extracted.netContents,
      normalizedExpected: formatMl(expectedMl),
      normalizedFound: formatMl(foundMl),
      status: confidenceNeedsReview(confidence) ? "needs_review" : "pass",
      reason: confidenceNeedsReview(confidence)
        ? "Net contents are equivalent, but extraction confidence is low."
        : "Net contents are equivalent after normalizing metric units.",
      confidence,
    };
  }

  return {
    field: "Net Contents",
    expected: application.netContents,
    found: extracted.netContents,
    normalizedExpected: formatMl(expectedMl),
    normalizedFound: formatMl(foundMl),
    status: "fail",
    reason: `Net contents differ by ${difference.toFixed(0)} mL.`,
    confidence,
  };
}

function warningTextWithHeading(extracted: ExtractedLabel): string | undefined {
  if (!extracted.governmentWarningText && !extracted.governmentWarningHeading) return undefined;
  const text = extracted.governmentWarningText ?? "";
  if (normalizeWarningText(text).toUpperCase().startsWith(GOVERNMENT_WARNING_HEADING)) return text;
  const heading = normalizeWarningText(extracted.governmentWarningHeading ?? "");
  const headingWithColon = heading.endsWith(":") ? heading : `${heading}:`;
  return `${headingWithColon} ${text}`.trim();
}

export function validateGovernmentWarning(extracted: ExtractedLabel): CheckResult {
  const confidence = extracted.fieldConfidences?.governmentWarning;
  const found = warningTextWithHeading(extracted);
  const normalizedExpected = normalizeWarningText(GOVERNMENT_WARNING_TEXT);
  const normalizedFound = found ? normalizeWarningText(found) : undefined;
  const qualityReason = imageQualityReason(extracted, "government_warning");
  const failures: string[] = [];
  const reviewItems: string[] = [];

  if (!found || !extracted.governmentWarningText) {
    const lowConfidenceReason = confidenceNeedsReview(confidence)
      ? "Government warning extraction confidence is low."
      : undefined;
    const reviewReason = qualityReason ?? lowConfidenceReason;
    return {
      field: "Government Warning",
      expected: GOVERNMENT_WARNING_TEXT,
      found,
      normalizedExpected,
      normalizedFound,
      status: reviewReason ? "needs_review" : "fail",
      reason: reviewReason
        ? `Required government warning text was not found. ${reviewReason}`
        : "Required government warning text was not found.",
      confidence,
    };
  }

  if (canonicalWarningHeading(extracted.governmentWarningHeading) !== GOVERNMENT_WARNING_HEADING) {
    failures.push('Heading must be exactly "GOVERNMENT WARNING:" in all caps.');
  }

  if (normalizedExpected !== normalizedFound) {
    failures.push("Required warning statement text does not exactly match after whitespace normalization.");
  }

  if (extracted.governmentWarningHeadingAppearsBold === false) {
    failures.push("Heading does not appear bold.");
  } else if (extracted.governmentWarningHeadingAppearsBold !== true) {
    reviewItems.push("Bold heading formatting could not be verified from extraction.");
  }

  if (extracted.warningAppearsLegible === false) {
    reviewItems.push("Warning text legibility could not be confirmed from extraction.");
  } else if (extracted.warningAppearsLegible !== true) {
    reviewItems.push("Warning legibility could not be verified from extraction.");
  }

  if (confidenceNeedsReview(confidence)) {
    reviewItems.push("Government warning extraction confidence is low.");
  }

  const status: ReviewStatus = failures.length ? "fail" : reviewItems.length ? "needs_review" : "pass";
  const reason =
    status === "pass"
      ? "Government warning text, heading, capitalization, bold appearance, and legibility checks passed."
      : [...failures, ...reviewItems].join(" ");

  return {
    field: "Government Warning",
    expected: GOVERNMENT_WARNING_TEXT,
    found,
    normalizedExpected,
    normalizedFound,
    status,
    reason,
    confidence,
  };
}

export function aggregateStatus(checks: CheckResult[]): ReviewStatus {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "needs_review")) return "needs_review";
  return "pass";
}

export function reviewLabel(
  application: ApplicationFields,
  extracted: ExtractedLabel,
  processingMs: number,
  mode: ReviewResult["mode"],
): ReviewResult {
  const checks = [
    validateBrandName(application, extracted),
    validateClassType(application, extracted),
    validateAlcoholContent(application, extracted),
    validateNetContents(application, extracted),
    validateGovernmentWarning(extracted),
  ];

  return {
    overallStatus: aggregateStatus(checks),
    checks,
    extracted,
    processingMs,
    mode,
  };
}

export function reviewExtractionUnavailable(
  application: ApplicationFields,
  extracted: ExtractedLabel,
  processingMs: number,
  mode: ReviewResult["mode"] = "manual",
): ReviewResult {
  const reason =
    "Automated extraction was unavailable, so no final field comparison was made. Route this label to a human reviewer before making a compliance recommendation.";
  const checks: CheckResult[] = [
    {
      field: "Brand Name",
      expected: application.brandName,
      found: extracted.brandName,
      status: "needs_review",
      reason,
      confidence: extracted.fieldConfidences?.brandName,
    },
    {
      field: "Class/Type",
      expected: application.classType?.trim() || "Not provided",
      found: extracted.classType,
      status: "needs_review",
      reason,
      confidence: extracted.fieldConfidences?.classType,
    },
    {
      field: "Alcohol Content",
      expected: application.alcoholContent,
      found: extracted.alcoholContent,
      status: "needs_review",
      reason,
      confidence: extracted.fieldConfidences?.alcoholContent,
    },
    {
      field: "Net Contents",
      expected: application.netContents,
      found: extracted.netContents,
      status: "needs_review",
      reason,
      confidence: extracted.fieldConfidences?.netContents,
    },
    {
      field: "Government Warning",
      expected: GOVERNMENT_WARNING_TEXT,
      found: extracted.governmentWarningText,
      status: "needs_review",
      reason,
      confidence: extracted.fieldConfidences?.governmentWarning,
    },
  ];

  return {
    overallStatus: "needs_review",
    checks,
    extracted,
    processingMs,
    mode,
  };
}
