# Wake Mode MVP and Responsive QA Report

## 1. How wake mode works

Foreground wake mode is an explicit user-controlled setting in the bonded chat surface. It is stored in browser local storage under `sk_foreground_wake_mode` and only operates while the app is open and visible enough for browser speech recognition to run.

The UI now shows:

- Wake mode on/off state.
- Active wake word for the currently bonded Spiritkin.
- Listening, wake-detected, disabled, unsupported, and off states.
- A clear "App-open only" constraint.

When enabled, the current browser SpeechRecognition path starts with source labels such as `wake-mode-enable`, `wake-mode-resume`, or `wake-mode-unmute`. The existing voice continuity path is preserved. After Spiritkin speech finishes, wake mode can resume listening through the same lifecycle used by current voice mode.

## 2. Constraints vs true Alexa-like background mode

This is not a background assistant and does not run on a locked device, inactive browser, service worker, or OS-level audio session.

Remaining constraints:

- Requires the app to be open.
- Requires browser microphone permission.
- Requires browser SpeechRecognition support.
- May pause when the tab loses visibility or the browser suspends recognition.
- Does not listen globally across the device.
- Does not implement hotword detection outside the current foreground web app.

## 3. Active Spiritkin wake ownership

Wake detection is now bound to the active/bonded Spiritkin rather than all Spiritkins at once.

Valid frontend wake names remain:

- `lyra`
- `kairo`
- `raien`
- `solis`
- `neris`

If the bonded Spiritkin is Solis, wake mode listens for `solis` and ignores `lyra`, `kairo`, `raien`, and `neris` as activation triggers. Browser logs now report the active wake name and active Spiritkin in `wake-detected` and `wake-not-detected` paths.

Wake phrases are stripped before submission in wake mode. For example, `solis what should I focus on` submits `what should I focus on`. If the user says only `solis`, the app marks wake detected and keeps listening for the actual request.

## 4. Responsive layout behavior by device class

Desktop, `1281px+`:

- Keeps the two-column world shell with a stable main content column and right support rail.
- Maintains the active Spiritkin rail without crowding game surfaces.

Fold open / tablet, `901px-1280px`:

- Collapses the world shell into a single column.
- Converts sticky rail behavior into normal flow to avoid overlap.
- Keeps the Spiritkin dock visible as a full-width support surface.

Fold closed / tablet-ish, `621px-900px`:

- Uses single-column shell and overlay layouts.
- Keeps primary room navigation in two columns where space allows.
- Constrains reveal/trailer and game containers to usable heights.

Narrow phone, `620px and below`:

- Uses single-column shell, nav, rail, and overlay layouts.
- Prevents horizontal overflow on Spiritkin dock and wake-mode cards.
- Keeps game boards scrollable inside their intended container.
- Keeps wake controls readable without stacking over the composer.

## 5. Live frontend issues fixed during this pass

- Continued the Solis/Neris asset path cleanup by preserving the runtime `/app/assets/concepts/*` alias structure from the previous hotfix.
- Added responsive overflow guards around the companion dock after mobile probing showed the dock could exceed narrow phone width.
- Added wake-mode UI in the same rail/composer area so it does not introduce a new top-level panel or stacking layer.

## 6. What remains before beta readiness

- Verify the pushed build on Railway after deployment using build marker `20260423003000`.
- Confirm real microphone permission and wake behavior manually in Chrome/Edge, because headless browser verification uses a mocked SpeechRecognition object.
- Run device/browser QA on actual iPhone/Android/foldable hardware.
- Decide whether old continuous voice mode and new foreground wake mode should remain separate user-facing controls or be merged into one clearer voice settings panel later.
- True Alexa-like background mode requires a separate native/PWA/background capability design and should not be attempted in this MVP.
