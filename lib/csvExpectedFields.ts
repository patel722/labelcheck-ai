import { parse } from "csv-parse/sync";
import { applicationFieldsSchema, type ApplicationFields } from "./schemas";

export type ExpectedFieldsCsvRow = {
  rowId: string;
  rowNumber: number;
  fileName: string;
  fields: ApplicationFields;
};

export type ExpectedFieldsCsvResult = {
  rows: ExpectedFieldsCsvRow[];
  errors: string[];
};

const REQUIRED_COLUMNS = ["fileName", "brandName", "alcoholContent", "netContents"] as const;
const OPTIONAL_COLUMNS = ["classType", "rowId"] as const;
const KNOWN_COLUMNS = new Set<string>([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]);

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseExpectedFieldsCsv(content: string): ExpectedFieldsCsvResult {
  const errors: string[] = [];
  let records: Record<string, string>[];

  try {
    records = parse(content.replace(/^\uFEFF/, ""), {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];
  } catch (error) {
    return {
      rows: [],
      errors: [error instanceof Error ? `CSV could not be parsed: ${error.message}` : "CSV could not be parsed."],
    };
  }

  if (!records.length) {
    return { rows: [], errors: ["CSV did not include any expected-field rows."] };
  }

  const headers = Object.keys(records[0] ?? {});
  for (const column of REQUIRED_COLUMNS) {
    if (!headers.includes(column)) errors.push(`CSV is missing required column "${column}".`);
  }
  for (const column of headers) {
    if (!KNOWN_COLUMNS.has(column)) errors.push(`CSV includes unsupported column "${column}".`);
  }
  if (errors.length) return { rows: [], errors };

  const seenFileNames = new Map<string, number>();
  const rows: ExpectedFieldsCsvRow[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const fileName = clean(record.fileName);
    const rowId = clean(record.rowId) || `row-${index + 1}`;
    const parsed = applicationFieldsSchema.safeParse({
      brandName: clean(record.brandName),
      classType: clean(record.classType) || undefined,
      alcoholContent: clean(record.alcoholContent),
      netContents: clean(record.netContents),
    });

    if (!fileName) errors.push(`Row ${rowNumber}: fileName is required.`);
    if (seenFileNames.has(fileName)) {
      errors.push(`Row ${rowNumber}: duplicate fileName "${fileName}" also appears on row ${seenFileNames.get(fileName)}.`);
    } else if (fileName) {
      seenFileNames.set(fileName, rowNumber);
    }

    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => issue.path.join(".") || "field").join(", ");
      errors.push(`Row ${rowNumber}: missing or invalid expected fields (${issues}).`);
      return;
    }

    if (fileName) rows.push({ rowId, rowNumber, fileName, fields: parsed.data });
  });

  return { rows: errors.length ? [] : rows, errors };
}
