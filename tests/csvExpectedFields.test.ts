import { describe, expect, it } from "vitest";
import { parseExpectedFieldsCsv } from "@/lib/csvExpectedFields";

describe("expected-fields CSV parser", () => {
  it("parses valid CSV with quoted commas, CRLF, and BOM", () => {
    const result = parseExpectedFieldsCsv(
      "\uFEFFfileName,rowId,brandName,classType,alcoholContent,netContents\r\n" +
        '"label,one.png",A1,"Old, Tom",Bourbon,90 Proof,750 mL\r\n',
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      rowId: "A1",
      fileName: "label,one.png",
      fields: {
        brandName: "Old, Tom",
        alcoholContent: "90 Proof",
        netContents: "750 mL",
      },
    });
  });

  it("rejects missing required columns", () => {
    const result = parseExpectedFieldsCsv("fileName,brandName\nlabel.png,Old Tom\n");
    expect(result.errors.join(" ")).toContain("alcoholContent");
    expect(result.errors.join(" ")).toContain("netContents");
  });

  it("rejects duplicate file names", () => {
    const result = parseExpectedFieldsCsv(
      "fileName,brandName,alcoholContent,netContents\n" +
        "label.png,Old Tom,90 Proof,750 mL\n" +
        "label.png,Old Tom,90 Proof,750 mL\n",
    );
    expect(result.errors.join(" ")).toContain("duplicate fileName");
  });

  it("rejects blank required values", () => {
    const result = parseExpectedFieldsCsv("fileName,brandName,alcoholContent,netContents\nlabel.png,,90 Proof,\n");
    expect(result.errors.join(" ")).toContain("missing or invalid");
  });
});
