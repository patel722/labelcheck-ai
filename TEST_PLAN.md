# TEST_PLAN.md

## Required Commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Validator Coverage

- Brand normalization: smart quotes, straight apostrophes, punctuation, case, whitespace, and clearly different brands.
- Alcohol content: ABV/proof equivalence, `Alc./Vol.` parsing, tolerance boundaries, and clear mismatches.
- Net contents: `mL`, `ML`, liters, and fluid ounces.
- Government warning: exact text, all-caps heading with colon, title-case heading failure, missing warning failure, bold uncertainty, and legibility/low-confidence review routing.
- Class/type: exact match, close but not exact review routing, and clearly different values.
- Overall aggregation: any fail wins; otherwise any needs-review wins; otherwise pass.

## Realistic Sample Fixture Coverage

Each sample in `lib/samples.ts` is tested by running deterministic validators against its fixture extraction. The suite also verifies that every sample includes extraction evidence for Brand Name, Class/Type, Alcohol Content, Net Contents, and Government Warning.

| Sample | Expected Result |
|---|---|
| Old Tom Distillery Bourbon | Pass |
| Stone’s Throw Rye | Pass |
| Riverbend Cellars Red Wine | Fail |
| Harbor Light Brewing IPA | Fail |
| Copper Ridge Vodka | Fail |
| Mesa Verde Mezcal | Needs Review |
| North Fork Cidery | Needs Review |
| Silver Pine Gin | Pass |

## API Coverage

- `/api/analyze` supports sample/demo mode without an API key.
- `/api/review` remains available for backward compatibility.
- Unknown sample IDs return a friendly client error.
- Custom uploads route to AI mode only when `OPENAI_API_KEY` is configured.
- Custom uploads without a provider key return a `needs_review` fallback.
- Unsupported, spoofed, empty, malformed, oversized, or excessive-dimension images are rejected before provider forwarding.

## Manual Browser QA

1. Open `http://localhost:3000`.
2. Select each sample from the Single-mode selector and confirm the expected fields populate.
3. Confirm each selected sample shows a raster image preview.
4. Click `Review Label` and verify the result matches the table above.
5. Switch to Batch mode, click `Add sample batch`, then run `Review Ready Queue`.
6. Export JSON and CSV reports and confirm sample metadata is included in JSON exports.
7. Upload a custom image with no `OPENAI_API_KEY` and confirm the app fails gracefully to `Needs Review`.
