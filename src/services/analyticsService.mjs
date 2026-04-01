/**
 * SpiritCore — Analytics Service
 *
 * Fire-and-forget, non-blocking analytics logging.
 * All writes are safe to fail — they never throw to callers.
 *
 * Tables:
 *   analytics_interactions  — per-interact event
 *   analytics_sessions      — behavioral signals
 *   spiritkin_metrics       — derived aggregates (upserted)
 */

export function createAnalyticsService({ supabase }) {
  /**
   * Log a single interaction event.
   * Called after /v1/interact completes (or fails).
   * Non-blocking: returns void, never throws.
   */
  function logInteraction({
    userId,
    spiritkinName,
    conversationId,
    inputLength,
    responseLength,
    latencyMs,
    success,
    retryCount = 0,
    safetyTier,
    traceId,
  }) {
    setImmediate(async () => {
      try {
        await supabase.from("analytics_interactions").insert({
          user_id:         String(userId ?? ""),
          spiritkin_name:  String(spiritkinName ?? "unknown"),
          conversation_id: conversationId ?? null,
          input_length:    Number(inputLength ?? 0),
          response_length: Number(responseLength ?? 0),
          latency_ms:      latencyMs != null ? Number(latencyMs) : null,
          success:         Boolean(success),
          retry_count:     Number(retryCount ?? 0),
          safety_tier:     safetyTier != null ? Number(safetyTier) : null,
          trace_id:        traceId ?? null,
        });
        // Update spiritkin_metrics aggregate (upsert)
        await _updateMetrics({ spiritkinName, success, responseLength });
      } catch (_err) {
        // Intentionally silent — analytics must never break the chat path
      }
    });
  }

  /**
   * Log a behavioral session event.
   * event_type: 'start' | 'end' | 'spiritkin_selected' | 'first_message' | 'abandon'
   * Non-blocking.
   */
  function logSessionEvent({
    userId,
    conversationId,
    spiritkinName,
    eventType,
    firstMessageDelay,
    sessionDurationMs,
    messageCount = 0,
    metadata,
  }) {
    setImmediate(async () => {
      try {
        await supabase.from("analytics_sessions").insert({
          user_id:              String(userId ?? ""),
          conversation_id:      conversationId ?? null,
          spiritkin_name:       spiritkinName ?? null,
          event_type:           String(eventType),
          first_message_delay:  firstMessageDelay != null ? Number(firstMessageDelay) : null,
          session_duration_ms:  sessionDurationMs != null ? Number(sessionDurationMs) : null,
          message_count:        Number(messageCount ?? 0),
          metadata:             metadata ?? null,
        });
        if (eventType === "start" && spiritkinName) {
          await _updateSessionMetrics({ spiritkinName });
        }
        if (eventType === "abandon" && spiritkinName) {
          await _updateDropOff({ spiritkinName });
        }
      } catch (_err) {
        // Intentionally silent
      }
    });
  }

  /**
   * Upsert spiritkin_metrics after each interaction.
   * Uses raw SQL via rpc if available, otherwise a read-modify-write.
   */
  async function _updateMetrics({ spiritkinName, success, responseLength }) {
    if (!spiritkinName) return;
    try {
      const { data: existing } = await supabase
        .from("spiritkin_metrics")
        .select("total_interactions, successful_interactions, avg_response_length")
        .eq("spiritkin_name", spiritkinName)
        .single();

      const total    = (existing?.total_interactions ?? 0) + 1;
      const successes = (existing?.successful_interactions ?? 0) + (success ? 1 : 0);
      const prevAvgLen = existing?.avg_response_length ?? 0;
      const newAvgLen  = Math.round((prevAvgLen * (total - 1) + (responseLength ?? 0)) / total);

      await supabase.from("spiritkin_metrics").upsert({
        spiritkin_name:          spiritkinName,
        total_interactions:      total,
        successful_interactions: successes,
        avg_response_length:     newAvgLen,
        updated_at:              new Date().toISOString(),
      }, { onConflict: "spiritkin_name" });
    } catch (_err) {
      // Intentionally silent
    }
  }

  async function _updateSessionMetrics({ spiritkinName }) {
    try {
      const { data: existing } = await supabase
        .from("spiritkin_metrics")
        .select("total_sessions")
        .eq("spiritkin_name", spiritkinName)
        .single();

      await supabase.from("spiritkin_metrics").upsert({
        spiritkin_name: spiritkinName,
        total_sessions: (existing?.total_sessions ?? 0) + 1,
        updated_at:     new Date().toISOString(),
      }, { onConflict: "spiritkin_name" });
    } catch (_err) {
      // Intentionally silent
    }
  }

  async function _updateDropOff({ spiritkinName }) {
    try {
      const { data: existing } = await supabase
        .from("spiritkin_metrics")
        .select("drop_off_count")
        .eq("spiritkin_name", spiritkinName)
        .single();

      await supabase.from("spiritkin_metrics").upsert({
        spiritkin_name: spiritkinName,
        drop_off_count: (existing?.drop_off_count ?? 0) + 1,
        updated_at:     new Date().toISOString(),
      }, { onConflict: "spiritkin_name" });
    } catch (_err) {
      // Intentionally silent
    }
  }

  /**
   * Update spiritkin_metrics after a feedback event.
   * Non-blocking.
   */
  function updateMetricsFromFeedback({ spiritkinName, rating }) {
    setImmediate(async () => {
      if (!spiritkinName || !rating) return;
      try {
        const { data: existing } = await supabase
          .from("spiritkin_metrics")
          .select("avg_rating, total_feedback_count")
          .eq("spiritkin_name", spiritkinName)
          .single();

        const count   = (existing?.total_feedback_count ?? 0) + 1;
        const prevAvg = existing?.avg_rating ?? 0;
        const newAvg  = ((prevAvg * (count - 1)) + rating) / count;

        await supabase.from("spiritkin_metrics").upsert({
          spiritkin_name:       spiritkinName,
          avg_rating:           Math.round(newAvg * 100) / 100,
          total_feedback_count: count,
          updated_at:           new Date().toISOString(),
        }, { onConflict: "spiritkin_name" });
      } catch (_err) {
        // Intentionally silent
      }
    });
  }

  return {
    logInteraction,
    logSessionEvent,
    updateMetricsFromFeedback,
  };
}
