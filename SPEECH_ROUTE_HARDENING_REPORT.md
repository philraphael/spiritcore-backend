# Speech Route Hardening Report

## Scope

- Hardened `POST /v1/speech`.
- Did not change frontend voice UX.
- Did not re-enable auto mic.
- Did not modify database schema.
- Did not add Runway.

## Validations Added

- `text` must be a string.
- `text` is trimmed before synthesis.
- Empty trimmed text is rejected with `400 BAD_REQUEST`.
- Text longer than 1200 characters is rejected with `400 BAD_REQUEST`.
- `voice` is required and normalized to lowercase.
- `voice` must be in the allowlist.
- Optional `format` must be a string and currently must be `mp3`.
- Optional `model` must be a string and currently must be `tts-1`.

Invalid requests return before the TTS provider is called.

## Max Length

- Maximum speech text length: 1200 characters.
- Over-limit text is rejected rather than truncated so callers can make explicit text-only fallback decisions.

## Allowed Voices

- `alloy`
- `ash`
- `ballad`
- `coral`
- `echo`
- `fable`
- `nova`
- `onyx`
- `sage`
- `shimmer`

## Rate-Limit Status

- Added route-specific speech rate protection using the existing `@fastify/rate-limit` integration.
- Speech route limit is capped at 20 requests per configured rate-limit window, while still respecting a lower configured adapter limit if present.
- No new complex rate-limit system was added.

## Fallback Behavior

- If the current adapter cannot provide speech, the route returns structured `503 SPEECH_UNAVAILABLE`.
- If the provider fails during synthesis, the route returns structured `502 SPEECH_PROVIDER_ERROR`.
- Provider failures are warning-logged without exposing secrets or raw provider internals to the client.
- Frontend callers can treat non-OK responses as text-only fallback conditions.

## Diagnostics Result

Endpoint diagnostics now verifies:

- Valid speech request returns audio, or is skipped when provider config is unavailable.
- Empty text returns expected `400`.
- Invalid voice returns expected `400`.
- Over-limit text returns expected `400`.

Latest elevated `npm test` result:

- Endpoint diagnostics: 34 passed, 0 skipped, 0 failed.
- Schema diagnostics: passed.
- Initial sandbox run hit `spawn EPERM` when endpoint diagnostics attempted to spawn the local server; rerun with approved escalation passed.
