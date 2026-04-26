# Premium Spiritkin Generation Readiness Map

Date: 2026-04-26

Premium self-serve Spiritkin generation is not enabled.

## What exists now

- SpiritCore orchestrator and identity/safety/memory/world/session foundations.
- Spiritkin media domain model and requirement profiles.
- Runway provider integration with staging execution gates.
- Runway auth/status diagnostics.
- Source reference planning and multi-source category rules.
- Source still ingest into APPROVED/source_stills with metadata.
- Approved generated asset ingest into APPROVED with metadata.
- Motion-pack planning and sequence composition planning.
- Premium starter pack profile and disabled readiness boundary.
- Diagnostics proving planning routes do not generate, promote, update manifests, or write ACTIVE.

## Missing before self-serve generation

- User-facing Spiritkin creation form.
- Canon prompt builder that uses identityGovernor-style descriptors.
- Safety moderation for names, bios, visual concepts, prompts, and references.
- Entitlement and purchase checks for SpiritCore premium vs Spiritkin premium.
- Server-side Runway key execution without transient test credentials.
- Budget/credit controls by user, account, pack, and retry.
- Queue system with status polling and failure recovery.
- Auto-review/scoring helper for identity drift, artifacts, source fit, prompt compliance, and state completion.
- Human/admin review mode for exceptions.
- Storage registry linkage from user account to source stills, approved assets, sequences, and ACTIVE runtime assets.
- Partial starter pack activation rules.
- Async expansion pack generation.
- User-facing status messages for queued, generating, review, approved, failed, and blocked.
- Support/admin review tools for refunds, retries, blocked prompts, and failed provider jobs.

## Server-side Runway key model

Future production execution must use server-side environment credentials and budget checks. User clients must never send, store, or see provider keys. Transient key paths are staging-only and must not become production flows.

## Budget and retry rules

- Start with low-cost source still and single-motion tests.
- Stop retries after repeated provider failure or review rejection on the same source/prompt combination.
- Require a better source category before attempting larger motion states.
- Track credits by provider job, user, entity, pack, and asset type.
- Require explicit admin exception review for budget overruns.

## Starter pack activation

A premium Spiritkin cannot be paid-ready until required starter assets are reviewed and approved:

- portrait
- hero or full_body
- icon
- presence_indicator
- room_background
- idle_video
- speaking_video
- greeting_video
- wake_visual
- profile metadata
- review status
- promotion status

Partial activation may later allow limited use, but the UI must clearly show incomplete pack state and never use review_required or rejected assets.

## Async expansion packs

Expansion packs should be separate from foundation packs:

- seasonal/decorative packs
- alternate outfit packs
- realm-specific packs
- game packs
- emotional-state packs
- premium cinematic sequences

They must not modify the canonical foundation pack without explicit review and promotion.

## Admin exception review

Admin review is required for:

- safety edge cases
- identity drift
- repeated provider failures
- budget overruns
- user disputes
- failed source still requirements
- manual promotion exceptions
