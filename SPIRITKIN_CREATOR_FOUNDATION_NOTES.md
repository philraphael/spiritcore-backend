# Spiritkin Creator Foundation Notes

## Foundation added

- Added a reusable creator foundation schema for generated Spiritkins.
- Added local draft persistence for the survey-based creator flow.
- Added a small local creator library record so generated/bonded custom Spiritkins have a durable runtime trail.

## Draft / save / apply flow

1. Survey answers are saved locally as the user progresses.
2. Reopening the creator restores the in-progress draft.
3. Generated Spiritkins are normalized into the same bonded runtime shape the rest of the app expects.
4. Bonding applies that normalized Spiritkin directly as the primary companion.

## Media attachment foundation

- Generated Spiritkins now carry a `creatorFoundation` object with:
  - version
  - source
  - asset base path
  - reserved media slots for portrait, intro trailer, bond trailer, and ambient still

## What remains for later

- Final asset upload / generation pipeline
- admin workflow for reviewing and publishing generated Spiritkins
- actual image / trailer production and attachment

