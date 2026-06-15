# AI_EXTRACTION_GUIDELINES.md

LabelCheck AI uses AI vision for extraction only. The model reads the uploaded image and returns structured facts. It does not decide whether a label passes, fails, or needs review.

The runtime prompt used by the OpenAI adapter lives in `lib/aiExtractionGuidelines.ts`.

## Extraction Rules

- Extract only visible label facts.
- Do not infer, complete, normalize, or convert values.
- Return `null` for missing or unreadable fields.
- Copy alcohol content and net contents exactly as shown. For example, do not convert `90 Proof` to `45% ABV`; deterministic validators handle equivalence.
- Copy the government warning heading exactly, including capitalization and colon when visible.
- Report confidence by field based on visibility and legibility, not compliance.
- Lower confidence when glare, reflection, blur, crop, angle, low resolution, occlusion, folds, tears, overprinting, label curvature, or another obstacle affects a field.
- Use confidence below `0.60` when a required field is only partially visible, readable only through an obstruction, or cannot be visually verified end to end.
- For warning-block obstructions, set `warningAppearsLegible` or `governmentWarningHeadingAppearsBold` to `null` or `false` when the full warning text, heading capitalization, bold heading appearance, or legibility cannot be confidently verified.
- Report extraction evidence for each reviewed field: the copied value, a 0-1 confidence score for that value, a short visible-text quote or visual note, and a source label.
- Keep extraction evidence short. It is a traceability aid for reviewers, not a full OCR transcript.
- Report image quality flags only when glare, blur, angle, crop, low resolution, or occlusion materially affects extraction.
- If extraction evidence mentions glare, reflection, blur, crop, angle, low resolution, occlusion, fold, tear, overprint, label curvature, or obstruction for a field, the response should also include a matching image-quality flag and lowered field confidence.

## Self-Checks

Before returning JSON, the model is instructed to confirm:

- Every schema key is present.
- Missing or unreadable values are not guessed.
- Visible text is copied rather than normalized.
- Evidence values do not conflict with the structured field values.
- No pass/fail/legal conclusion is included.

## How Evidence Is Used

Extraction evidence is displayed beside each field-level result and included in JSON exports. It helps a reviewer understand what the model used when extracting a value. It does not override the validators: deterministic checks still compare the extracted values against the expected application fields, and low-confidence or ambiguous extractions route to human review.

For government-warning checks, a material image-quality flag on the warning block is treated as a human-review signal even when the model extracted matching text. As a defensive backstop, warning evidence that mentions glare, reflection, or another obstruction also routes to human review even if the model omitted the image-quality flag. This prevents the app from overstating certainty when the image itself is visually compromised.

## Fallback Behavior

If OpenAI extraction is unavailable because of authentication, quota/billing, model access, rate limiting, timeout, or another provider failure, the app routes the label to `needs_review`. Raw provider error details are not exposed to the browser, and uploaded images are not stored by this application.
