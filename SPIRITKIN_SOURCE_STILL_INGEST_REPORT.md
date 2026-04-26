# Spiritkin Source Still Ingest Report

## Summary

This phase adds a controlled ingest and registration layer for approved canonical Spiritkin source stills. It does not generate media, call Runway, promote motion assets, update manifests, or write ACTIVE assets.

## Why Larger Motion States Need More Sources

Lyra's close portrait source is reliable for close micro-motion states such as idle, speaking, listening, and small gestures. It is not enough for medium-body, seated, entry, or walking states because image-to-video has to infer body framing, posture, scene space, and motion completion from a crop that does not contain that information.

That mismatch has already caused wasted attempts:

- thinking states that feel slow or expressionless
- greeting or entry states with blur and cutout artifacts
- wider gestures that feel unfinished
- body reveal prompts that push the model beyond the source image

## Routes Added

- `POST /admin/media/source-still-ingest`
- `POST /admin/media/source-reference-registry-plan`

## Source Still Ingest

`POST /admin/media/source-still-ingest` accepts reviewed source stills for known Spiritkins and writes approved stills to:

`Spiritverse_MASTER_ASSETS/APPROVED/{entityId}/source_stills/{sourceCategory}/`

It writes sidecar metadata next to the saved still and can optionally archive the raw provider export under:

`Spiritverse_MASTER_ASSETS/ARCHIVE/raw_provider_exports/{entityId}/source_stills/{sourceCategory}/`

Supported source categories:

- `close_portrait`
- `medium_body`
- `full_body`
- `seated_or_perched`
- `realm_environment`
- `approved_motion_reference`

The filename format is:

`{entityId}_{sourceCategory}_{sourceName}_{status}_{yyyymmdd}_{shortHash}.{ext}`

The extension is preserved when the source URL ends in `png`, `jpg`, `jpeg`, or `webp`; otherwise it safely defaults to `png`.

## Registry Planning

`POST /admin/media/source-reference-registry-plan` is planning-only. It reports current sources, blocked asset types, missing required source categories, and which asset types become unblocked when a source category is added.

For Lyra, adding `medium_body` unblocks:

- `gesture_02`
- `greeting_or_entry_01`

## Waste Reduction

The route lets operators ingest the correct source still before paying for the next motion generation. Larger or body-dependent states can now remain blocked until their required source category exists.

## Premium Spiritkin Scale

Future premium user Spiritkins should receive a starter source-still kit before motion packs:

- close portrait
- medium body
- full body or realm reference
- seated/perched reference when relevant
- approved motion references for hard emotional states

This keeps premium generation governed and avoids using one close portrait as the source for every motion type.

## Next Creative Target

The next creative target is a Lyra `medium_body` canonical still. Once approved and ingested, it should unblock `gesture_02` and `greeting_or_entry_01` planning.

## Safety Confirmations

- No provider generation occurs.
- No Runway call occurs.
- No motion asset promotion occurs.
- No manifest update occurs.
- No ACTIVE write occurs.
- The staging ingest bypass is narrow and requires approved status, known Spiritkin, supported source category, HTTPS source URL, and `x-media-ingest-test=true`.
