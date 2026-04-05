/**
 * SpiritCore — Admin & Command Center Routes
 * 
 * GET /v1/admin/conversations/recent  — list recent conversations across all users
 * GET /v1/admin/messages/:conversationId — fetch transcript for a conversation
 * GET /v1/admin/stats                 — global system stats
 */

export async function adminRoutes(fastify, opts) {
  const { supabase, messageService, registry } = opts;

  // ── GET /v1/admin/conversations/recent ──────────────────────────────────────
  fastify.get("/v1/admin/conversations/recent", async (req, reply) => {
    try {
      const limit = Math.min(Number(req.query?.limit ?? 50), 200);
      const { data, error } = await supabase
        .from("conversations")
        .select("id, user_id, spiritkin_id, title, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Resolve spiritkin names from registry
      const spiritkins = await registry.listCanonical();
      const skMap = Object.fromEntries(spiritkins.map(sk => [sk.id, sk.name]));
      
      const enriched = (data || []).map(conv => ({
        ...conv,
        spiritkin_name: skMap[conv.spiritkin_id] || "Unknown"
      }));

      return { ok: true, conversations: enriched };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "DB_ERROR", message: err.message });
    }
  });

  // ── GET /v1/admin/messages/:conversationId ──────────────────────────────────
  fastify.get("/v1/admin/messages/:conversationId", async (req, reply) => {
    const { conversationId } = req.params;
    try {
      const messages = await messageService.fetchRecent({ conversationId, limit: 100 });
      return { ok: true, messages };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "DB_ERROR", message: err.message });
    }
  });

  // ── GET /v1/admin/stats ─────────────────────────────────────────────────────
  fastify.get("/v1/admin/stats", async (req, reply) => {
    try {
      const { count: totalUsers } = await supabase.from("entitlements").select("*", { count: "exact", head: true });
      const { count: totalMessages } = await supabase.from("messages").select("*", { count: "exact", head: true });
      const { count: totalConversations } = await supabase.from("conversations").select("*", { count: "exact", head: true });

      return {
        ok: true,
        stats: {
          total_users: totalUsers || 0,
          total_messages: totalMessages || 0,
          total_conversations: totalConversations || 0,
          timestamp: new Date().toISOString()
        }
      };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "DB_ERROR", message: err.message });
    }
  });
}
