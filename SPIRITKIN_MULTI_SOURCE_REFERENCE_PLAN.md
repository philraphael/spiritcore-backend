# Spiritkin Multi-Source Reference Plan

## Summary

This phase adds planning-only support for multiple canonical Spiritkin motion source references. No generation, provider call, ingest, promotion, manifest update, or ACTIVE write is performed.

## Why Close Portrait Is Not Enough

Lyra's close portrait source works for close and micro-motion states:

- `idle_01`
- `speaking_01`
- `listen_01`
- `gesture_01`

The same close portrait is unreliable for larger motion or wider framing:

- `think_01` has repeatedly felt too slow or not expressive enough.
- `greeting_or_entry_01` can create blur or cutout artifacts.
- `gesture_02` needs wider framing and clearer body information.
- body reveal and medium-shot prompts push image-to-video too far when the only source is a close portrait.

## Source Categories

The planning model supports these source categories:

- `close_portrait`
- `medium_body`
- `full_body`
- `seated_or_perched`
- `realm_environment`
- `approved_motion_reference`

## Asset-Type Mapping

- `idle_01`, `idle_02`, `speaking_01`, `speaking_02`, `listen_01`: `close_portrait`
- `think_01`: `close_portrait` or `approved_motion_reference`
- `gesture_01`: `close_portrait` or `approved_motion_reference`
- `gesture_02`: `medium_body`
- `greeting_or_entry_01`: `medium_body`
- `sit_or_perch_01`: `seated_or_perched`
- `walk_loop_01`: `full_body` or `realm_environment`

## Route

`POST /admin/media/spiritkin-source-reference-plan`

The route accepts:

- `entityId`
- `packId`
- `requestedAssetTypes`
- `availableSources`

It returns:

- required source category per asset type
- selected available source when present
- blocked asset types when the right source is missing
- recommended next source stills to create
- no-provider/no-ingest/no-ACTIVE-write flags

## Waste Reduction

This prevents spending credits on states whose source reference is not strong enough for the requested motion. Wider or body-dependent states now block at planning time until a suitable medium-body, full-body, seated, realm, or approved motion reference exists.

## Premium Spiritkin Scale

Premium user-created Spiritkins should eventually require a minimum source-reference kit before motion generation:

- close portrait for speaking/listening/idle
- medium body for greeting and wider gestures
- full body or realm reference for movement
- seated/perched still for seated presence
- approved motion reference for hard-to-describe emotional or thinking states

Premium member generation remains disabled. This phase only prepares the planning contract for future governed generation.

## Safety Confirmations

- No generation occurred.
- No Runway call is made by the new route.
- No ingest is performed.
- No promotion occurs.
- No manifest is updated.
- No ACTIVE asset is written.
