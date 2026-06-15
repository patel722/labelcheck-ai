export const GOVERNMENT_WARNING_HEADING = "GOVERNMENT WARNING";

export const GOVERNMENT_WARNING_BODY =
  "(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects.\n\n(2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

export const GOVERNMENT_WARNING_TEXT = `${GOVERNMENT_WARNING_HEADING}: ${GOVERNMENT_WARNING_BODY}`;

export function normalizeWarningText(value: string): string {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s+([:;,.])/g, "$1")
    .trim();
}
