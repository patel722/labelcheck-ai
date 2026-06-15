# ARCHITECTURE.md

## Runtime Shape

LabelCheck AI is a Next.js App Router application deployed to Cloudflare Workers through OpenNext.

```text
React UI
  -> POST /api/analyze
  -> extraction provider
      -> demo fixture for sampleId
      -> OpenAI Vision for configured custom uploads
      -> manual fallback when extraction is unavailable
  -> deterministic validators
  -> ReviewResult JSON
  -> field-level result cards and exports
```

## Important Files

- `app/page.tsx`: app entry point.
- `components/LabelReviewApp.tsx`: main single/batch review workflow.
- `components/SampleSelector.tsx`: natural sample selector and raster sample preview.
- `app/api/analyze/route.ts`: primary analysis endpoint.
- `app/api/review/route.ts`: shared review handler and compatibility endpoint.
- `lib/samples.ts`: single source of truth for realistic sample metadata, expected fields, and demo extraction fixtures.
- `lib/extractionProviders/demoExtractor.ts`: returns fixture extraction for sample/demo mode.
- `lib/extractionProviders/openaiVisionExtractor.ts`: optional AI extraction adapter for uploaded images.
- `lib/validators.ts`: deterministic compliance recommendation logic.
- `lib/imageIntake.ts`: server-side upload validation and MIME/dimension checks.

## Decision Boundary

AI extraction returns structured facts, per-field confidence signals, and short extraction evidence for reviewer traceability. It does not decide compliance. The validators compare extracted facts against expected application fields and known warning requirements.

The UI labels the output as a review recommendation. It does not call the result an official decision or legal determination.

## Data Handling

- Sample images are static fictional assets under `public/samples`.
- Sample/demo mode does not use external AI services.
- Uploaded images are held in memory for the request and are not persisted.
- Secrets are read only on the server or Cloudflare Worker runtime.
