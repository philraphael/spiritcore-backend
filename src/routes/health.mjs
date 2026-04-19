/**
 * SpiritCore — Health, Readiness & Metrics Routes (Phase F)
 *
 * GET /health   — Liveness probe. Fast, no DB call. Returns 200 if process is alive.
 * GET /ready    — Readiness probe. Checks Supabase connectivity and registry state.
 * GET /metrics  — Lightweight runtime counters. No external dependencies.
 */

import { nowIso } from "../utils/time.mjs";

// ── In-process lightweight metrics ───────────────────────────────────────────
const _metrics = {
  startedAt:         Date.now(),
  requestsTotal:     0,
  requestsOk:        0,
  requestsError:     0,
  safetyEscalations: 0,
  adapterCalls:      0,
};

export function incrementMetric(key) {
  if (key in _metrics) _metrics[key]++;
}

export const healthRoutes = async (app, opts = {}) => {
  const { registry, supabase } = opts;
  const requireAdminAccess = app.requireAdminAccess;

  // ── GET /health — Liveness ────────────────────────────────────────────────
  app.get("/health", async (req, reply) => {
    return reply.code(200).send({
      ok:      true,
      service: "spiritcore",
      version: "1.0.0-phase-f",
      env:     process.env.NODE_ENV || "development",
      ts:      nowIso(),
    });
  });

  // ── GET /ready — Readiness ────────────────────────────────────────────────
  app.get("/ready", async (req, reply) => {
    const checks = {};
    let allOk = true;

    // 1. Supabase connectivity
    try {
      const sb = supabase ?? app.container?.supabase;
      if (sb) {
        const { error } = await sb
          .from("spiritkins")
          .select("id", { count: "exact", head: true });
        checks.supabase = error ? { ok: false, error: error.message } : { ok: true };
      } else {
        checks.supabase = { ok: false, error: "supabase client not available" };
      }
    } catch (err) {
      checks.supabase = { ok: false, error: err.message };
    }
    if (!checks.supabase.ok) allOk = false;

    // 2. Spiritkin registry loaded
    try {
      const reg = registry ?? app.container?.registry;
      if (reg) {
        const canonical = await reg.listCanonical();
        checks.registry = {
          ok:    canonical.length > 0,
          count: canonical.length,
          names: canonical.map(s => s.name),
        };
        if (!checks.registry.ok) allOk = false;
      } else {
        checks.registry = { ok: false, error: "registry not available" };
        allOk = false;
      }
    } catch (err) {
      checks.registry = { ok: false, error: err.message };
      allOk = false;
    }

    // 3. Orchestrator initialized
    const orch = app.orchestrator ?? app.container?.orchestrator;
    checks.orchestrator = { ok: !!orch };
    if (!checks.orchestrator.ok) allOk = false;

    // 4. DI container valid
    checks.container = { ok: !!(app.container) };

    return reply.code(allOk ? 200 : 503).send({ ok: allOk, ts: nowIso(), checks });
  });

  // ── GET /metrics — Lightweight counters ──────────────────────────────────
  app.get("/metrics", { preHandler: requireAdminAccess }, async (req, reply) => {
    const uptimeMs = Date.now() - _metrics.startedAt;
    return reply.code(200).send({
      ok:      true,
      ts:      nowIso(),
      uptime:  {
        ms:      uptimeMs,
        seconds: Math.floor(uptimeMs / 1000),
        minutes: Math.floor(uptimeMs / 60000),
      },
      requests: {
        total: _metrics.requestsTotal,
        ok:    _metrics.requestsOk,
        error: _metrics.requestsError,
      },
      safety:  { escalations: _metrics.safetyEscalations },
      adapter: { calls: _metrics.adapterCalls },
    });
  });
};
