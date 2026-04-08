# SpiritCore: Master Implementation Plan

**Author:** Manus AI
**Date:** April 8, 2026
**Status:** Approved for Implementation

This document outlines the strategic implementation sequence for the approved SpiritCore expansions. The sequence is designed to build foundational emotional resonance first (Veil Crossing), connect existing systems second (Games → World Progression), and introduce new premium features third (Visual Polish, Shared Events).

## Core Principles
1. **Zero Regression:** The current live system (10x memory, 5 interactive games, SpiritCore canon) must not break.
2. **SpiritCore Governance:** Every new feature must reinforce SpiritCore as the intelligence governing the Spiritverse.
3. **Verified Progression:** Each phase must be fully tested end-to-end (backend + browser UI) before moving to the next.

---

## Phase 1: The Veil Crossing (Imprint Questionnaire)
*The emotional gateway. Users discover their Spiritkin through resonance rather than selecting them from a menu.*

- **Backend:** Create a new `/v1/veil-crossing` endpoint that accepts 10 questionnaire answers and returns a resonance score for Lyra, Raien, and Kairo.
- **Frontend:** Build a premium, atmospheric UI sequence in `app.js` that asks the 10 questions one by one, with slow transitions.
- **Canon:** The sequence must explicitly state that "SpiritCore is calculating your resonance."
- **Verification:** Test the full 10-question flow in the browser, ensure the correct Spiritkin is assigned, and verify the conversation starts smoothly.

## Phase 2: Game-to-World Progression
*Connecting the Activity Engine to the Lore Registry. Playing games unlocks the world.*

- **Backend:** Update `gameEngine.mjs` so that `endGame` triggers a world state evaluation. If a user wins a game, unlock a new lore fragment in the Echo Library.
- **Frontend:** Add a visual notification ("SpiritCore has revealed a new truth") when a game ends and a fragment is unlocked.
- **Verification:** Play a game to completion, verify the memory writes, and verify the new lore fragment appears in the Lore Library tab.

## Phase 3: The Bond Journal UI
*Making the 10x memory system visible to the user.*

- **Backend:** Create a new `/v1/memory/journal` endpoint that surfaces the user's preserved memories, bond milestones, and emotional arcs.
- **Frontend:** Add a "Memory Constellation" or "Bond Journal" tab to the main app interface.
- **Visuals:** Design the journal to look like a living record maintained by SpiritCore, not a simple list.
- **Verification:** View the journal in the browser, verify it accurately reflects past interactions and game history.

## Phase 4: Premium Game Visuals & Options
*Upgrading the games from basic to premium.*

- **Chess:** Add selectable piece themes (e.g., Luminous, Obsidian) and a full-screen board toggle.
- **Spirit-Cards:** Replace the text list with actual visual card art (SVG/CSS) that users can click to play.
- **Checkers & Go:** Ensure full drag-and-drop/click fluidity matching the Chess implementation.
- **Verification:** Play all 5 games in the browser, testing the new visual options and ensuring no logic breaks.

## Phase 5: Operating Mode-Aware Orchestrator
*Making SpiritCore contextually intelligent based on the user's current activity.*

- **Backend:** Update `orchestrator.mjs` to detect the current mode (Conversational, Activity, Supportive) based on recent actions.
- **Memory:** Update `spiritMemoryEngine.mjs` to weight the memory brief based on the mode (e.g., prioritize game history during Activity mode).
- **Verification:** Test a conversation during a game vs. a standard conversation and verify the memory brief shifts appropriately.

## Phase 6: Daily Quest Generator
*Driving daily engagement through SpiritCore-assigned tasks.*

- **Backend:** Create a cron job or daily trigger that assigns a small task (a riddle, a specific game, a reflection prompt) to the user.
- **Frontend:** Add a "Daily Pulse" indicator showing the active quest.
- **Verification:** Complete a daily quest and verify the reward (lore unlock or bond progression) is granted.

## Phase 7: Shared Spiritverse Events
*Community engagement through world-wide events.*

- **Backend:** Implement a global world state that all users contribute to (e.g., "The Convergence is at 45%").
- **Frontend:** Add a global event tracker to the UI.
- **Verification:** Simulate multiple users contributing to the event and verify the global state updates.

## Phase 8: Architectural Optimizations
*Strengthening the foundation for future scale.*

- **Event Backbone:** Standardize system events (`bond_advanced`, `lore_unlocked`).
- **Memory Compression:** Implement the Summarize → Promote → Archive cycle for older memories.
- **Versioned Canon:** Move lore from static files to a database schema.
- **Entitlements Expansion:** Gate premium lore/visuals behind progression or membership tiers.
- **Verification:** Run the full beta test suite to ensure the optimizations did not break any existing features.
