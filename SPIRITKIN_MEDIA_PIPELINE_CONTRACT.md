# Spiritkin Media Pipeline Contract

Date: 2026-04-26

This is the official SpiritCore/Spiritkins media pipeline contract. It prevents isolated one-off generation paths and keeps media production review-first, source-aware, and safe.

## Official pipeline

1. Canon identity card
2. Source still pack creation through Runway
3. Source still ingest / registry
4. Motion-pack plan
5. Source-category validation
6. Motion generation queue
7. Provider execution
8. Status polling
9. Review scoring / manual review during canon baseline
10. Approved asset ingest
11. Sequence composition planning
12. Review-space sequence execution
13. ACTIVE promotion only through explicit future promotion route
14. Runtime asset selection by SpiritCore based on session / emotion / speech state

## Permanent rules

- Runway is the production provider path for new production stills/videos unless explicitly replaced in a future provider migration.
- Voice remains separate from Runway clips.
- No audio is embedded in motion clips.
- Premium user generation remains disabled until the readiness checklist is complete.
- No motion generation is allowed for blocked source categories.
- Do not repeatedly spend credits on known-bad source/prompt combinations.
- Base packs avoid decorative effects unless they are part of a named variant pack.
- Decorative, seasonal, and special-effect visuals go into alternate packs, not foundation packs.
- Review-required, failed, rejected, or archived assets are not runtime-selectable.
- APPROVED writes do not imply ACTIVE promotion.
- ACTIVE writes and manifest updates require an explicit future promotion route.

## Source category rules

- `idle_01`, `idle_02`, `speaking_01`, `speaking_02`, `listen_01`: `close_portrait`
- `think_01`: `close_portrait` or `approved_motion_reference`
- `gesture_01`: `close_portrait` or `approved_motion_reference`
- `gesture_02`, `greeting_or_entry_01`: `medium_body`
- `sit_or_perch_01`: `seated_or_perched`
- `walk_loop_01`: `full_body` or `realm_environment`

## Motion quality rules

Every motion clip plan should include:

- `shotProfile`
- `poseVariant`
- `motionCompletionRule`
- `backgroundClarityMode`
- `timingIntent`

Required motion completion behavior:

- The action begins early.
- The readable main action occurs mid-clip.
- The motion resolves before clip end.
- No slow-motion unfinished gestures.

## Voice, wake, and speech alignment

- `/v1/speech` and the TTS adapter remain the voice authority.
- Runway clips are silent visual shells.
- Wake/session startup should later select `greeting_or_entry`, `idle`, `listen`, and `speaking` assets only after those assets are approved and promoted.
- Continuous voice and wake detection are runtime systems, not media generation systems.
- Media phases must not modify speech or wake behavior unless explicitly requested.

## Review and promotion boundary

During canon baseline production, manual/operator review is required. A future scoring helper can assist, but it cannot auto-promote. Promotion must verify:

- Canon identity consistency.
- Source reference lineage.
- Motion state fit.
- No audio/subtitles/logos/text.
- No unacceptable artifacts.
- Pack completeness rules.
- Rollback path.
- Metadata sidecar completeness.
- Manifest target.

## Premium user boundary

Premium user Spiritkin generation is disabled. Future user-created Spiritkins must first pass canon prompt building, safety moderation, budget controls, queueing, source still starter pack creation, review/scoring, approved ingest, and runtime activation rules.
