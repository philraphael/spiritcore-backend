# Memory Architecture Optimization: Implementing Hierarchical Memory

## 1. Current State Assessment

**File**: `/home/ubuntu/spiritcore-repo-new/src/services/memory.mjs`

The current `memory.mjs` service provides core functionalities for writing, querying, and managing memory entries. It interacts with a `memories` table in Supabase and logs memory access for auditing purposes.

**Key Observations:**
- **Unified Memory Stream**: All memory entries are stored in a single `memories` table, differentiated by a `kind` field (e.g., "message"). This represents a largely chronological, undifferentiated stream of interactions.
- **Rolling Window**: The `query` function retrieves a `limit` of recent memories, effectively implementing a rolling window for context, which aligns with the 80-message window mentioned in the strategic documents.
- **Policy Management**: The `computePolicyState` function manages memory lifecycle (active, dormant, compress_due, delete_due) based on `created_at` timestamps and configurable policies.
- **Sanitization**: Content is sanitized and truncated to 4000 characters, ensuring data integrity and preventing overflow.
- **Event Bus Integration**: Emits a `memory.written` event, indicating extensibility for other services to react to new memories.

## 2. Optimization Gap Analysis

The current memory system, while robust for basic persistence, lacks the hierarchical structure and nuanced recall capabilities outlined in the strategic analysis. The primary gaps are:

- **Lack of Hierarchical Structure**: The system does not differentiate between episodic (significant events), semantic (structured facts), and procedural (interaction patterns) memories. All are treated as generic "messages" or content.
- **Limited Surfacing**: The current `query` mechanism primarily retrieves recent conversational history. It does not proactively surface relevant long-term memories based on context or emotional state.
- **Absence of Significance Scoring**: There is no mechanism to score the importance or emotional weight of a memory, meaning a mundane greeting holds the same weight as a profound shared experience.
- **No Contextual Injection**: The system doesn't explicitly support injecting specific, highly relevant memories into the Spiritkin's context during a conversation, which is crucial for making users feel "truly known."

## 3. Proposed Hierarchical Memory Architecture

To address these gaps, I propose extending the existing `memory.mjs` and its associated Supabase schema to support a three-layered hierarchical memory system:

### **3.1. Episodic Memory (Significant Events)**
- **Purpose**: Stores significant shared events, emotional milestones, and key narrative beats.
- **Implementation**: 
    - **Extend `write` function**: Introduce a new `kind` for `episodic` memories. These would be triggered by specific events (e.g., `conversation.ended` event from `eventBus`) and extracted by a new `MemoryExtractorService`.
    - **New `meta` fields**: Add fields to the `meta` object for `emotion_tags`, `significance_score`, and `summary` of the event.
    - **Supabase Schema**: Potentially a new `episodic_memories` table or an expanded `memories` table with indexed `kind` and `significance_score`.

### **3.2. Semantic Memory (Structured Facts)**
- **Purpose**: Stores structured facts about the user, Spiritkin, and their relationship (e.g., user's name, job, preferences, recurring anxieties).
- **Implementation**: 
    - **New `kind` for `semantic` memories**: These would be key-value pairs or structured JSON stored in the `content` or `meta` field.
    - **`MemoryExtractorService`**: This service would identify and extract these facts from conversations.
    - **`upsert` logic**: Semantic memories should be upserted (updated if existing, inserted if new) to maintain a single, current source of truth for each fact.
    - **Supabase Schema**: A `semantic_memories` table with `user_id`, `key`, `value`, `updated_at`.

### **3.3. Procedural Memory (Interaction Patterns)**
- **Purpose**: Stores interaction patterns and preferences (e.g., user prefers direct questions, responds well to humor, preferred greeting).
- **Implementation**: 
    - **Behavioral Analysis**: A new service (or extension of `emotionService` or `orchestrator`) would analyze conversation turns and user reactions to infer procedural patterns.
    - **`meta` fields**: Store `interaction_style`, `preferred_tone`, `response_patterns` within the `meta` object of `procedural` kind memories.
    - **Supabase Schema**: Could be part of `semantic_memories` or a dedicated `procedural_memories` table.

## 4. Integration with `memory.mjs`

- **`write` function**: Will be extended to handle new `kind` types (`episodic`, `semantic`, `procedural`) and their specific `meta` structures.
- **`query` function**: Will be enhanced to query across these new memory types, allowing for more intelligent retrieval based on conversational context, emotional state, and significance scores. This will move beyond a simple `limit` to a more sophisticated context assembly.
- **`memoryExtractor.mjs`**: This existing file (or a new `MemoryExtractorService`) will be crucial for parsing raw conversation text and identifying candidates for episodic and semantic memories.

## 5. Phased Implementation Plan

1.  **Phase 1.1: Semantic Memory Foundation**: 
    - Create `semantic_memories` table in Supabase.
    - Extend `memoryExtractor.mjs` to identify and extract key facts (user name, preferences) from incoming messages.
    - Modify `memory.mjs` to `upsert` these facts into `semantic_memories`.
2.  **Phase 1.2: Episodic Memory Foundation**: 
    - Create `episodic_memories` table in Supabase.
    - Extend `memoryExtractor.mjs` to identify significant events or emotional peaks from conversation segments.
    - Modify `memory.mjs` to `insert` these episodic memories with a `significance_score`.
3.  **Phase 1.3: Procedural Memory (Initial)**: 
    - Add basic `interaction_style` tracking to `semantic_memories` or `user_profiles`.
4.  **Phase 1.4: Contextual Recall**: 
    - Modify `contextResolver.mjs` to query across `semantic_memories` and `episodic_memories` based on current conversation context and inject relevant memories into the Spiritkin's prompt.

This phased approach ensures that the existing system remains stable while gradually building out the more sophisticated hierarchical memory architecture. Each step will be verified to prevent regression and ensure credit efficiency.
