# LabelCheck AI

LabelCheck AI is a polished proof-of-concept for AI-assisted alcohol label verification in a TTB-style review workflow.

LabelCheck AI uses AI for extraction, not final compliance determination. The AI reads imperfect label images and returns structured fields. Deterministic validators then compare those fields against application data and known rules. Ambiguous or low-confidence cases are routed to human review.

## Problem Statement

Alcohol label review requires comparing what appears on a submitted label against expected application fields and strict warning statement requirements. A generic OCR demo is not enough because compliance review needs traceable field-level reasons, human review routing, privacy awareness, and deterministic decisioning.

## Product Approach

The app separates image interpretation from compliance decisioning:

```text
Image Upload
  -> AI/Vision Extraction
  -> Structured JSON
  -> Deterministic Validation Engine
  -> Field-Level Compliance Review Report
  -> Human Review Recommendation
```

## Features

- Expected application fields for brand name, class/type, alcohol content, and net contents
- Single label image upload
- Batch queue for up to five labels
- CSV import for expected fields matched by label filename
- Client-side image preparation with resize/compression, EXIF-aware decoding, rotation controls, and visible size metadata
- Server-side MIME/content sniffing and image dimension checks
- Server-side AI extraction when `OPENAI_API_KEY` is configured
- Demo/sample mode with repeatable local extraction profiles
- Human-review fallback when AI extraction is unavailable or not configured
- Deterministic validation statuses: `pass`, `needs_review`, `fail`
- Field-level reasons and confidence values
- Image quality flags for glare, blur, angle, crop, low resolution, and occlusion
- Expandable details/debug panel with raw text, JSON, normalized values, processing time, mode, and warnings
- Eight realistic fictional raster sample labels covering common review outcomes without exposing the expected result in the UI
- JSON report export, CSV summary export, and all-results batch export
- Unit and route tests for CSV parsing, image intake, validation, and review API behavior

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Plain CSS
- Zod
- Vitest
- Cloudflare Workers via OpenNext
- OpenAI Responses API for optional vision extraction

## Setup

```bash
npm install
```

Create an environment file:

```bash
cp .env.example .env.local
```

Add your key:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
OPENAI_IMAGE_DETAIL=high
OPENAI_TIMEOUT_MS=20000
OPENAI_BASE_URL=https://api.openai.com/v1
```

The app also reads `.env`, which is useful for local testing. Secret files are ignored by git.

Only PNG, JPEG, and WebP are accepted for live custom uploads. Bundled sample labels are realistic PNG raster images served from `public/samples`. Custom uploads are sniffed server-side to verify that declared MIME type and image bytes match.

`OPENAI_BASE_URL` defaults to `https://api.openai.com/v1`. Keep it unset for normal OpenAI API use. Set it only when using an approved compatible endpoint, such as an authorized future government endpoint.

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Tests And Checks

For full validator, API, fixture, browser, and deployment-readiness coverage, see `TEST_PLAN.md`.

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run cf:build
npm run cf:check
npm audit --omit=dev
npm audit
```

## Evaluator Quick Start

Live URL: `https://labelcheck.someshpatel.com`

Recommended deterministic demo path:

1. Open the live URL.
2. In Single mode, choose a sample label from the `Try a sample` dropdown. The expected application fields populate automatically and the sample image preview appears.
3. Click `Review Label`. Demo mode uses local fixture extraction, so this path does not require an API key or spend provider tokens.
4. Try `Old Tom Distillery Bourbon` for a clean pass, `Riverbend Cellars Red Wine` for an alcohol-content failure, and `Mesa Verde Mezcal` for a glare-driven human-review case.
5. Expand the details panel only if you want to inspect normalized values, raw extraction JSON, processing time, mode, and provider metadata.
6. Use `Export JSON report` or `Export CSV summary` to inspect the review output.

Batch demo path:

1. Switch to Batch mode.
2. Click `Add sample batch`.
3. Run `Review Ready Queue`.
4. Export all results as CSV or JSON.

Optional AI extraction path:

1. In Single mode, choose a sample from the dropdown first to populate the expected fields.
2. Click the upload control and select the matching PNG from `public/samples` in this repository. Uploading a file clears demo selection and sends the image through AI mode when `OPENAI_API_KEY` is configured.
3. Click `Review Label` and check that the result shows `AI mode`, processing time, extracted values, field-level evidence, and deterministic validation reasons.
4. If provider credentials, quota, or availability are not configured, the app routes the upload to `Needs Review` instead of making an unsupported automated comparison.

Response-time note: the assessment emphasized that reviewers need results in about five seconds. LabelCheck AI keeps deterministic validation local, sends one structured vision request for custom uploads, displays processing time in the result, and avoids long multi-step AI chains. Actual AI latency depends on provider availability, image size/quality, network conditions, and the configured model, so this prototype treats the five-second mark as an operational target rather than a guaranteed service-level objective.

## Realistic Sample Labels

Sample images are fictional and synthetically generated for demonstration. They should not be interpreted as real alcohol beverage labels, approved labels, or regulatory guidance.

The sample library is designed to exercise realistic review scenarios while keeping the UI natural. The app displays product names, not test-case labels, so evaluators can test the workflow without seeing the expected outcome in advance. Demo mode uses fixture extraction so the app works without an API key. AI mode can still analyze user-uploaded images when configured. The realistic sample labels are for product demonstration and repeatable tests.

| Sample | Beverage Type | Intended Scenario | Expected Result |
|---|---|---|---|
| Old Tom Distillery Bourbon | Bourbon | Clean compliant sample | Pass |
| Stone’s Throw Rye | Rye Whiskey | Formatting/proof equivalence | Pass |
| Riverbend Cellars Red Wine | Wine | Alcohol content mismatch | Fail |
| Harbor Light Brewing IPA | Beer | Warning heading capitalization issue | Fail |
| Copper Ridge Vodka | Vodka | Missing government warning | Fail |
| Mesa Verde Mezcal | Mezcal | Glare/low-confidence warning | Needs Review |
| North Fork Cidery | Cider | Class/type close but not exact | Needs Review |
| Silver Pine Gin | Gin | Proof and net contents equivalence | Pass |

## CSV Expected Fields

Batch CSV upload is for expected application fields only. It does not contain label images.

Required columns:

```csv
fileName,brandName,alcoholContent,netContents
label-one.png,OLD TOM DISTILLERY,45% Alc./Vol. (90 Proof),750 mL
```

Optional columns:

```csv
fileName,rowId,brandName,classType,alcoholContent,netContents
label-one.png,A1,OLD TOM DISTILLERY,Kentucky Straight Bourbon Whiskey,45% Alc./Vol. (90 Proof),750 mL
```

CSV rows are matched to uploaded images by exact `fileName` after trimming. Duplicate filenames, missing images, unsupported columns, and blank required values are shown as row-level errors before review starts.

## Deployment

The preferred deployment path for this assessment is Cloudflare Workers with OpenNext. This keeps the prototype in the same operational stack as DNS, custom domains, edge routing, and runtime secrets.

The repo can remain private on GitHub. Cloudflare's Git integration can connect to a private GitHub repository and build from it after authorization; the domain should be attached to the deployed Cloudflare Worker/Pages project, not pointed directly at the private GitHub repo.

Cloudflare files:

- `wrangler.jsonc` defines the Worker entrypoint, compatibility flags, static assets, observability, and non-secret defaults.
- `public/_headers` gives immutable caching headers for Next.js static assets.
- `.dev.vars.example` documents local Worker-preview variables without committing secrets.

CLI deploy:

```bash
npm run cf:build
npm run cf:check
npx wrangler secret put OPENAI_API_KEY
npm run cf:deploy
```

For Dashboard/Git deployments, configure `OPENAI_API_KEY` as a Cloudflare secret, keep `OPENAI_MODEL`, `OPENAI_IMAGE_DETAIL`, and `OPENAI_TIMEOUT_MS` as non-secret variables, and use the committed `wrangler.jsonc` as the deployment source of truth. The deploy script passes `--keep-vars` so dashboard-managed variables and secrets are not overwritten by local config.

For a custom domain such as `labelcheck.someshpatel.com`, add the hostname under the Cloudflare Workers/Pages custom domain or route settings after the Worker is deployed. Because the DNS zone is already in Cloudflare, this keeps DNS, TLS, and deployment routing in one control plane. This repository keeps `workers_dev` and preview URLs disabled, so the custom domain/route is configured externally in the Cloudflare dashboard.

For federal production environments, the provider endpoint and authorization boundary should be reviewed. OpenAI documents a FedRAMP API path using `gov.api.openai.com` for eligible contexts; other production candidates include Azure OpenAI Government, AWS Bedrock GovCloud, or Cloudflare Workers AI depending on agency constraints.

## Provider Decision

OpenAI is the default prototype provider because it offers the lowest implementation risk for strict image-to-JSON extraction in a short assessment window. Cloudflare Workers AI is a strong future option for lower cost and edge deployment, but JSON schema adherence and image-input behavior require more provider-specific testing. Ollama Cloud is useful for open-model experimentation, but its current cloud structured-output support is not strong enough to make it the default for a compliance-style extraction schema.

The provider choice is intentionally isolated behind `lib/aiExtractor.ts`. Deterministic validators and sample fixtures do not depend on OpenAI, so a future Cloudflare Workers AI adapter can be added without changing the compliance decision engine.

## AI Usage Explanation

AI is used only to extract visible label information into a structured schema. The model is instructed not to invent missing fields. The server route then runs deterministic validators for brand matching, class/type matching, ABV/proof equivalence, net contents equivalence, and government warning text/format checks.

The OpenAI extraction prompt is maintained in `lib/aiExtractionGuidelines.ts` and summarized in `AI_EXTRACTION_GUIDELINES.md`. It tells the model to copy visible text, return `null` for unreadable fields, avoid unit conversions, report field confidence, include short extraction evidence for each reviewed field, flag image quality issues, lower confidence when glare or obstructions affect a field, and avoid pass/fail/legal conclusions.

Extraction evidence is a reviewer-facing traceability layer. Each reviewed field can include the extracted value, a confidence score for that value, a short quote or visual cue, and the evidence source. The app displays this beside the deterministic check and includes it in JSON exports, but evidence does not make the compliance recommendation. Validators still decide whether a field passes, fails, or needs human review.

If glare, reflection, crop, angle, occlusion, folds, tears, overprinting, label curvature, or another obstacle materially affects the government warning block, the app treats that as a human-review signal. The model may still extract the warning text, but visual uncertainty should lower warning confidence and prevent the app from overstating certainty.

Sample labels use deterministic fixtures to avoid spending API tokens and to make evaluator testing reproducible. The fixture extraction data lives with the sample metadata in `lib/samples.ts`.

If AI extraction fails, times out, or is not configured for a custom upload, the app returns `needs_review` with field-level human-review reasons. It does not fail the label solely because the AI provider was unavailable.

## Security And Privacy Notes

- Uploaded images are processed in memory by this application and are not stored.
- API keys stay server-side only.
- Live custom uploads are limited to PNG, JPEG, and WebP with an 8 MB server-side cap.
- Live uploads are validated by MIME sniffing and image dimension checks before AI extraction.
- Client-side image preparation caps long-edge dimensions, compresses large images, and records upload metadata without persisting source images.
- Provider errors are not echoed verbatim to the browser.
- AI outages or missing keys route to human review rather than an automated fail.
- The app does not integrate directly with COLA or any production TTB system.
- Provider processing/retention depends on the configured AI provider and account settings.
- This prototype is not production authorized and is not an official legal determination.

## Assumptions

- Expected application fields can be entered manually or imported from CSV for batch review.
- AI extraction confidence is approximate and should not override deterministic validation rules.
- Government warning validation is intentionally strict.
- Batch review is intentionally capped at five labels for the prototype.
- Realistic sample labels use local fixtures so evaluators can test without cloud connectivity.
- Custom uploads without a configured provider cannot be extracted locally and therefore require human review.

## Limitations

- No authentication or authorization.
- No audit log.
- No persistence.
- No direct COLA integration.
- No production OCR/image preprocessing pipeline beyond client-side resize/compression and simple rotation.
- AI extraction quality depends on image quality, model selection, and provider availability.
- No local OCR fallback for arbitrary uploaded images.
- Batch processing is client-orchestrated; it is not a durable production queue.

## Future Improvements

- Durable server-side review queue for larger batch workloads
- Image preprocessing for cropping, glare reduction, and perspective correction with reviewer audit controls
- Multi-panel label review for front, back, neck, and side panels
- Human review queue and reviewer notes
- Audit logging and retention policy controls
- Provider adapters for Cloudflare Workers AI and Ollama Cloud
- FedRAMP-authorized deployment profile and model monitoring

## Future Enhancement: Multi-Panel Label Review

Production alcohol label review may need to evaluate multiple panels from the same product, including front, back, neck, or side labels. This prototype focuses on one primary label image to keep the assessment workflow fast, clear, and easy to evaluate.

The current extraction and validation boundary could be extended to accept multiple uploaded panel images, merge extracted fields into one structured label record, and run the same deterministic validators to produce a consolidated review report.

## Requirement Traceability

| Stakeholder Signal | Product Decision |
|---|---|
| Agents need results in about 5 seconds | Display processing time, keep validation local, avoid unnecessary multi-step AI calls |
| “My mother could figure out” | Simple upload + review flow, advanced details hidden by default |
| Dave says label review requires judgment | Brand matching uses normalization/fuzzy logic instead of strict string equality |
| Jenny says warning statement must be exact | Government warning validator uses strict text and heading checks |
| Marcus notes no direct COLA integration | Standalone proof-of-concept with clean API boundary |
| Marcus notes security and retention concerns | No image storage, server-side API key, prototype privacy notice |
| Peak season batch uploads | Five-label client-side batch queue with CSV/JSON exports |
| Evaluators need inspectable stretch features | Five-label batch queue, CSV expected-field import, and all-results exports |
| Poor label photos should not become automatic failures | Image quality flags route ambiguous glare, blur, crop, and occlusion cases to review |

## AI Assistance Used

This project was built with AI coding assistance. The application itself uses AI only as an extraction provider. Deterministic TypeScript validators produce the review recommendation.
