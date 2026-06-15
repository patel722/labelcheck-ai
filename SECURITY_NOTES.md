# SECURITY_NOTES.md

## Prototype Privacy Posture

LabelCheck AI is a proof-of-concept. Uploaded label images are processed for analysis and are not stored by this application.

## Current Controls

- Uploaded images are handled in memory by the Next.js API route.
- Custom uploads are limited to PNG, JPEG, and WebP and capped at 8 MB.
- Server-side validation sniffs image bytes and checks dimensions before provider forwarding.
- Images over 25 megapixels are rejected to control memory and provider risk.
- Client-side preparation may resize, rotate, and compress images before upload; server validation remains authoritative.
- SVG is not accepted for live uploads; realistic bundled samples are static PNG assets.
- API keys are read server-side only.
- `.env` and `.env.local` are ignored by git.
- Cloudflare production credentials should be stored as Workers secrets, not committed in `wrangler.jsonc`.
- `wrangler.jsonc` contains only non-secret model and timeout defaults.
- The browser never receives `OPENAI_API_KEY`.
- Sample labels use repeatable local extraction profiles and do not call an external AI provider.
- Realistic sample labels are fictional synthetic PNG assets used for repeatable demonstration and tests.
- Extraction evidence is returned as short text/visual notes for reviewer traceability and is not stored server-side by this application.
- AI provider failures route to human review and do not expose raw provider errors to the browser.
- Image quality flags can route glare, blur, crop, angle, low-resolution, or occlusion cases to human review.
- Batch review is capped at five labels and runs without persistence or durable background processing.
- The app does not connect to COLA or any production federal system.

## Not Production Authorized

This prototype is not production authorized and does not provide an official legal determination. It produces a review recommendation for demonstration purposes only.

## Provider Considerations

The application does not store uploaded images, but the configured AI provider may process or retain request data according to that provider's terms, account settings, and authorized deployment path. Production deployments should use an approved environment and endpoint.

Bundled sample images are fictional and synthetically generated for product demonstration. They are not real products, approved labels, regulatory guidance, or evidence of compliance.

## Production Considerations

- Authentication and authorization
- Audit logging
- Retention policy
- Data classification
- FedRAMP-authorized services if applicable
- Human review workflow
- Model monitoring
- Prompt/version control
- Request and response redaction in logs
- Malware scanning for uploaded files
- Production image preprocessing and size controls beyond prototype resize/compression
- Provider outage handling and manual review service-level expectations
- Cloudflare Access or another authentication layer before public pilot use
