# ASSUMPTIONS.md

## Product Assumptions

- LabelCheck AI is a prototype review assistant, not an official legal determination engine.
- AI is used for extraction only. Deterministic validators produce `pass`, `needs_review`, or `fail`.
- Extraction evidence is used to explain what the model saw, not to override deterministic validation.
- Ambiguous, low-confidence, or image-quality-limited extraction should route to human review rather than an automated final decision.
- Material glare, reflection, crop, occlusion, or other visual obstruction over a required field should lower extraction confidence even when the model can read some text.
- The realistic sample images are fictional and synthetically generated. They are not real products, approved labels, or regulatory guidance.
- The sample UI intentionally displays natural product names instead of expected outcomes or test-case names.

## Technical Assumptions

- Demo/sample mode uses fixture extraction data from `lib/samples.ts` and does not call an external provider.
- AI mode for user-uploaded labels requires `OPENAI_API_KEY`.
- Custom uploads without an AI provider key cannot be extracted locally and should return a `needs_review` fallback.
- Uploaded images are processed in memory and are not stored by the application.
- Batch review remains client-orchestrated and capped at five labels for the take-home scope.
- `/api/analyze` is the primary analysis endpoint; `/api/review` remains as a compatibility alias.

## Production Follow-Ups

- Authentication and authorization.
- Audit logging and retention policy.
- Human review queue and reviewer comments.
- Provider endpoint authorization review for federal production use.
- Durable queueing for larger batch workflows.
- Formal OCR/image preprocessing pipeline with reviewer-visible audit controls.
