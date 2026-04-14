# Spiritverse Stabilization QA Checklist

## Response Realism
- Start 5 back-and-forth turns with Lyra and confirm she does not default to filler openings like `ah`, `well`, or generic reassurance loops.
- Start 5 back-and-forth turns with Raien and confirm replies stay concise, direct, and do not over-explain simple questions.
- Start 5 back-and-forth turns with Kairo and confirm sentence openings vary across turns instead of reusing the same reflective wrapper.
- Repeat at least 3 turns with Elaria and 3 with Thalassar and confirm each has distinct cadence, vocabulary, and emotional stance.
- Open a major tab or game, then send a message. Confirm the reply does not say things like `I see you opened...` or narrate the interface directly.

## Voice Loop
- Enable continuous voice mode and confirm the mic starts listening after the initial user gesture.
- Speak once and confirm only one transcript is submitted.
- Let TTS play and confirm recognition does not restart while audio is still speaking.
- After TTS ends, confirm recognition resumes automatically.
- Interrupt with another spoken message after a completed reply and confirm the loop continues without getting stuck.
- Trigger a voice error or cancel recognition and confirm the loop does not spawn duplicate listeners.

## Chess Regression
- Start chess and make 5 valid user moves.
- Confirm each user move renders immediately on the board.
- Confirm each Spiritkin reply appears and the Spiritkin move renders after the backend response.
- Confirm the board state, move history, and turn badge stay in sync after every move.

## TicTacToe
- Start TicTacToe of Echoes and play until at least 5 accepted moves have occurred across both sides.
- Confirm each click updates the board immediately and the Spiritkin reply feels personality-based rather than generic.
- Confirm winner or draw state ends the game cleanly.

## Connect Four
- Start Connect Four Constellations and make at least 5 valid drops.
- Confirm discs appear in the correct column and row immediately.
- Confirm Spiritkin replies stay short and do not repeat raw move coordinates unless necessary.
- Confirm win detection or full-board state ends the game cleanly.

## Battleship
- Start Abyssal Battleship and make at least 5 valid guesses.
- Confirm guessed cells update visibly after each move.
- Confirm hit/miss state remains aligned with the visible grid.
- Confirm Spiritkin replies feel in-character and not like generic system text.

## Theme Consistency
- Verify chess and game surfaces stay on the dark palette with no beige regression.
- Check `crown`, `veil`, `ember`, `astral`, and `abyssal` themes for readable contrast.
- Confirm game overlays, buttons, and board chrome match the active dark theme direction.

## Mobile
- Verify `/app` loads on a narrow viewport without clipped composer or off-screen game controls.
- Confirm at least one move each in chess, TicTacToe, Connect Four, and Battleship works on mobile-sized layout.
- Confirm voice controls remain reachable and readable on mobile.
