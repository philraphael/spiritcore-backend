/**
 * SpiritCore — Feedback Service
 *
 * Stores and retrieves explicit user feedback from feedback_events table.
 */

export function createFeedbackService({ supabase, analyticsService }) {
  /**
   * Submit a feedback event.
   * Returns { ok, id } on success or throws AppError.
   */
  async function submit({
    userId,
    conversationId,
    spiritkinName,
    rating,
    helpful,
    emotionalResonance,
    freeText,
    messageId,
  }) {
    if (!userId) throw new Error("userId is required");
    if (!spiritkinName) throw new Error("spiritkinName is required");
    if (rating != null && (rating < 1 || rating > 5)) throw new Error("rating must be 1–5");

    const { data, error } = await supabase.from("feedback_events").insert({
      user_id:             String(userId),
      conversation_id:     conversationId ?? null,
      spiritkin_name:      String(spiritkinName),
      rating:              rating != null ? Number(rating) : null,
      helpful:             helpful != null ? Boolean(helpful) : null,
      emotional_resonance: emotionalResonance ?? null,
      free_text:           freeText ?? null,
      message_id:          messageId ?? null,
    }).select("id").single();

    if (error) throw new Error(error.message);

    // Update spiritkin_metrics non-blocking
    if (analyticsService && rating != null) {
      analyticsService.updateMetricsFromFeedback({ spiritkinName, rating });
    }

    return { ok: true, id: data?.id };
  }

  /**
   * List recent feedback for a spiritkin (operator/analytics use).
   */
  async function listForSpiritkin({ spiritkinName, limit = 50 }) {
    const { data, error } = await supabase
      .from("feedback_events")
      .select("id, user_id, conversation_id, spiritkin_name, rating, helpful, emotional_resonance, free_text, created_at")
      .eq("spiritkin_name", spiritkinName)
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit), 200));

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  return { submit, listForSpiritkin };
}
