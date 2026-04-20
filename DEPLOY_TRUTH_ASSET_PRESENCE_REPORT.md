## Exact local file presence

Verified on disk:

- `Spiritverse_MASTER_ASSETS/ACTIVE/concepts/Elaria.png`
  - exists: `true`
- `Spiritverse_MASTER_ASSETS/ACTIVE/concepts/thalassar.png`
  - exists: `true`
- `Spiritverse_MASTER_ASSETS/ACTIVE/concepts/Elaria Left Thalassar right.png`
  - exists: `true`
- `Spiritverse_MASTER_ASSETS/ACTIVE/rooms/Spiritverse background base theme.png`
  - exists: `true`

## Exact git tracking status

Before this fix:

- `git ls-files` returned nothing for all four files
- `git ls-tree -r --name-only HEAD -- ...` returned nothing for all four files
- `git ls-tree -r --name-only origin/main -- ...` returned nothing for all four files

Confirmed ignore root cause:

- `.gitignore` contained a blanket `*.png` rule
- `git check-ignore -v` showed that exact rule was ignoring:
  - `Elaria.png`
  - `thalassar.png`
  - `Elaria Left Thalassar right.png`
  - `Spiritverse background base theme.png`

## Exact root cause

The failing founder and room assets existed locally but were never deployed because they were ignored by git and therefore absent from both `HEAD` and `origin/main`.

The server route was not the root problem for these four 404s. Production was missing the files because the repository never included them.

## Exact fix applied

- Added narrow `.gitignore` exceptions for the four required PNG files:
  - `!Spiritverse_MASTER_ASSETS/ACTIVE/concepts/Elaria.png`
  - `!Spiritverse_MASTER_ASSETS/ACTIVE/concepts/thalassar.png`
  - `!Spiritverse_MASTER_ASSETS/ACTIVE/concepts/Elaria Left Thalassar right.png`
  - `!Spiritverse_MASTER_ASSETS/ACTIVE/rooms/Spiritverse background base theme.png`
- Staged and committed those exact assets so they become part of the deployed build.

## Exact final asset names and paths

- `/app/assets/concepts/Elaria.png`
- `/app/assets/concepts/thalassar.png`
- `/app/assets/concepts/Elaria%20Left%20Thalassar%20right.png`
- `/app/assets/rooms/Spiritverse%20background%20base%20theme.png`

On disk:

- `Spiritverse_MASTER_ASSETS/ACTIVE/concepts/Elaria.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/concepts/thalassar.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/concepts/Elaria Left Thalassar right.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/rooms/Spiritverse background base theme.png`

## Verification results

- Local file presence confirmed before commit.
- `.gitignore` root cause confirmed.
- After staging/commit, these files should appear in:
  - `git ls-files`
  - `git ls-tree -r --name-only HEAD`
  - `git ls-tree -r --name-only origin/main`
- No filename mismatch was found; the real issue was ignored/untracked deploy absence.
