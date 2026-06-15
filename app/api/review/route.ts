import { NextResponse } from "next/server";
import { extractLabel } from "@/lib/aiExtractor";
import { DemoSampleNotFoundError } from "@/lib/extractionProviders/demoExtractor";
import { validateImageFile } from "@/lib/imageIntake";
import { applicationFieldsSchema } from "@/lib/schemas";
import { reviewExtractionUnavailable, reviewLabel } from "@/lib/validators";

export const runtime = "nodejs";

function fieldValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const started = performance.now();

  try {
    const formData = await request.formData();
    const sampleId = fieldValue(formData, "sampleId") || undefined;
    const parsedApplication = applicationFieldsSchema.safeParse({
      brandName: fieldValue(formData, "brandName"),
      classType: fieldValue(formData, "classType") || undefined,
      alcoholContent: fieldValue(formData, "alcoholContent"),
      netContents: fieldValue(formData, "netContents"),
    });

    if (!parsedApplication.success) {
      return NextResponse.json(
        {
          error: "Please complete the required application fields.",
          issues: parsedApplication.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const file = formData.get("labelImage");
    let image: Buffer | undefined;
    let mimeType: string | undefined;

    if (file instanceof File && file.size > 0) {
      const validatedImage = await validateImageFile(file);
      image = validatedImage.image;
      mimeType = validatedImage.mimeType;
    }

    if (!sampleId && !image) {
      return NextResponse.json(
        { error: "Upload a label image or choose a sample label before reviewing." },
        { status: 400 },
      );
    }

    const extraction = await extractLabel({ image, mimeType, sampleId });
    const processingMs = Math.round(performance.now() - started);
    const review = extraction.extractionUnavailable
      ? reviewExtractionUnavailable(parsedApplication.data, extraction.extracted, processingMs, extraction.mode)
      : reviewLabel(parsedApplication.data, extraction.extracted, processingMs, extraction.mode);

    return NextResponse.json({
      ...review,
      provider: extraction.provider,
      warnings: [...(review.extracted.notes ?? []), ...extraction.warnings],
    });
  } catch (error) {
    if (error instanceof DemoSampleNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("Image")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("Unsupported image type")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "The request timed out before review completed."
        : "The request could not be completed. No uploaded image was stored.";
    return NextResponse.json(
      {
        error: "Label review failed.",
        detail: message,
      },
      { status: 500 },
    );
  }
}
