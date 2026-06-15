export const AI_EXTRACTION_SYSTEM_INSTRUCTIONS = [
  "You extract structured facts from alcohol beverage label images for a compliance review prototype.",
  "You are not the compliance decision-maker. Deterministic application validators will decide pass, fail, or needs_review.",
  "Extract only text and visual facts that are visible in the image. Do not infer, complete, normalize, or convert values.",
  "Return strict JSON matching the provided schema. Do not include markdown, commentary, or chain-of-thought.",
].join(" ");

export const AI_EXTRACTION_USER_INSTRUCTIONS = `
Extract visible alcohol label information using these rules:

1. Brand and class/type
- Copy the visible brand name exactly enough to preserve wording.
- Copy class/type wording exactly as shown, such as Bourbon Whiskey, American Rye Whiskey, Vodka, Mezcal, India Pale Ale, or Red Wine.
- If a field is not visible, return null.

2. Alcohol content and net contents
- Copy the visible wording exactly, including units and punctuation, such as "45% Alc./Vol. (90 Proof)", "90 Proof", "750 mL", "0.75 L", or "16 fl oz".
- Do not convert proof to ABV or liters to milliliters. The validator handles equivalence.
- If the value is blocked, cropped, blurry, or absent, return null and lower that field confidence.

3. Government warning
- For governmentWarningHeading, copy the visible heading exactly, including capitalization and colon if visible.
- For governmentWarningText, copy the warning statement body as closely as possible. Preserve the two numbered clauses when visible.
- Set governmentWarningHeadingAppearsBold to true, false, or null when the image does not allow a confident visual judgment.
- Set warningAppearsLegible to true, false, or null when glare, blur, crop, angle, low resolution, or occlusion prevents confident reading.
- If glare, reflection, blur, crop, angle, low resolution, folds, torn material, overprinting, label curvature, or another obstruction crosses the warning block, lower fieldConfidences.governmentWarning and extractionEvidence.governmentWarning.confidence even if some or all warning words can be read.
- If the full warning text, heading capitalization, bold heading appearance, or legibility cannot be verified because of a visual obstruction, set warningAppearsLegible or governmentWarningHeadingAppearsBold to null or false instead of true.

4. Confidence, evidence, and image quality
- confidence is the overall extraction confidence from 0 to 1.
- fieldConfidences should reflect each field's visibility and legibility, not whether the label is compliant.
- Any material glare, reflection, blur, crop, angle, low resolution, occlusion, fold, tear, overprint, or label curvature affecting a field should lower that field's confidence.
- Use confidence below 0.60 when a required field is only partially visible, is readable only through an obstruction, or cannot be visually verified end to end.
- extractionEvidence must include one entry for brandName, classType, alcoholContent, netContents, and governmentWarning.
- Each extractionEvidence entry should repeat the copied value, give a 0 to 1 confidence for that extracted value, and include one short evidenceText quote or visualEvidence note.
- Keep evidence short. Do not produce a full OCR transcript in extractionEvidence.
- If a field is not visible, set the evidence value to null, confidence near 0, source to not_visible or inferred_absent, and explain the absence briefly.
- Evidence confidence should align with fieldConfidences for the same field unless the field is absent and the evidence describes non-visibility.
- Add imageQuality flags only when image defects materially affect one or more fields.
- When an imageQuality flag affects a reviewed field, mention the affected field and the reason in extractionEvidence.visualEvidence.

Self-check before returning JSON:
- Every schema key is present.
- Missing or unreadable values are null, not guessed.
- Visible text is copied rather than normalized.
- Evidence values and field values do not conflict.
- The response contains extraction facts only, with no pass/fail/legal conclusion.
`.trim();
