# Wake Mode Stabilization and Native Background Roadmap

## 1. Long-form speech capture fixes

Wake-mode speech capture now keeps a buffered foreground turn instead of submitting on the first final fragment.

Implemented:

- Separate pending transcript buffer for the current recognition run.
- Interim and final transcript segments are recombined into one coherent turn.
- Silence-grace timers were added:
  - standard voice turns use a shorter grace window
  - wake-mode turns use a longer grace window
- Explicit manual stop finalizes the buffered transcript immediately.
- Wake-name stripping now happens against the buffered final turn, not against a partial fragment.

Debug logging now records:

- transcript length
- segment count
- preview of the submitted final transcript
- active wake name
- wrong-wake detection

## 2. Wake UI and settings changes

Wake controls were removed from the main chat header and from the large in-room MVP card.

Current UI model:

- compact wake-status chip remains visible in the active room/top bar
- Settings now owns wake controls
- Settings also shows microphone/privacy context and the current wake word
- the bonded session defaults wake capability on when:
  - terms are accepted
  - a bonded Spiritkin exists
  - browser speech recognition is supported
  - the user has not already explicitly set the wake preference

## 3. Page visibility behavior

Foreground wake mode is now explicit about pause/resume behavior.

Implemented:

- when the page loses visibility, wake mode is marked paused
- when the browser window blurs, wake mode is marked paused
- when the user returns to the page/focus, the app attempts a safe foreground resume
- the UI only claims:
  - Wake ready
  - Listening
  - Wake detected
  - Wake paused

It does not claim background listening in the web app.

## 4. Limitations of web foreground wake mode

This remains a foreground browser feature only.

Limitations:

- depends on browser SpeechRecognition support
- depends on browser mic permission
- can pause when the tab loses visibility or the browser suspends recognition
- cannot listen on a locked device
- cannot guarantee real background capture in a standard web page
- browser timer/recognition behavior can vary by engine and device

## 5. Native/background roadmap requirements

True Alexa-like background mode needs a native-capable runtime or equivalent platform support.

Required foundation:

- native mobile wrapper or background-capable runtime
- persistent background audio/microphone permission model
- explicit wake-word engine ownership on device
- battery/thermal governor and throttling strategy
- wake/privacy indicators outside the web page
- always-available consent + settings model
- OS-level interruption handling
- environment/ambient output governor for future smart-space control
- stronger transcript/session handoff between wake engine and SpiritCore orchestration

## 6. What remains before beta

- verify deployed foreground wake behavior with real microphone input in Chrome/Edge after Railway serves the new build marker
- run longer live speech tests on real devices
- confirm pause/resume semantics on actual focus/tab changes outside headless automation
- tune silence-grace values with real user speech patterns
- decide whether legacy continuous voice mode should remain separately user-facing or be folded into one clearer voice settings model
