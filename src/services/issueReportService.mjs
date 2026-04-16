function createId(prefix = "iss") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function summarizeText(text, limit = 140) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function uniqueStrings(values, limit = 6) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))].slice(0, limit);
}

function buildIssueClassification(text) {
  const input = String(text || "").trim();
  const lower = input.toLowerCase();
  if (!lower) {
    return {
      kind: "ignore_noise",
      confidence: 0,
      route: "ignore",
      reason: "empty input",
      signals: [],
    };
  }

  const bugSignals = [
    /\bbug\b/i,
    /\bbroken\b/i,
    /\bnot working\b/i,
    /\bisn'?t working\b/i,
    /\bdoesn'?t work\b/i,
    /\bkeeps turning off\b/i,
    /\bcrash(?:ed|es|ing)?\b/i,
    /\bstuck\b/i,
    /\bglitch(?:y)?\b/i,
    /\berror\b/i,
    /\bfailed\b/i,
    /\bwon'?t load\b/i,
    /\bvoice keeps\b/i,
    /\bgame isn'?t working\b/i,
  ];

  const correctionSignals = [
    /\byou keep repeating\b/i,
    /\btoo repetitive\b/i,
    /\bstop saying\b/i,
    /\bdon'?t say\b/i,
    /\bdon'?t call me\b/i,
    /\bless narrator\b/i,
    /\bdon'?t narrate\b/i,
    /\bkeep it respectful\b/i,
    /\bno profanity\b/i,
    /\bdon'?t tease\b/i,
    /\bi don'?t like\b/i,
    /\bthat tone\b/i,
  ];

  const contentSignals = [
    /\bthat'?s wrong\b/i,
    /\bincorrect\b/i,
    /\bnot accurate\b/i,
    /\bout of character\b/i,
    /\bdoesn'?t sound like\b/i,
    /\bcanon(?:ically)? wrong\b/i,
    /\blore is wrong\b/i,
    /\bmade up\b/i,
  ];

  const featureSignals = [
    /\bfeature request\b/i,
    /\bcan you add\b/i,
    /\byou should add\b/i,
    /\bi wish there was\b/i,
    /\bwould be cool if\b/i,
    /\bplease add\b/i,
    /\bneed a feature\b/i,
  ];

  const matches = {
    bug: bugSignals.filter((pattern) => pattern.test(lower)).length,
    preference_correction: correctionSignals.filter((pattern) => pattern.test(lower)).length,
    content_problem: contentSignals.filter((pattern) => pattern.test(lower)).length,
    feature_request: featureSignals.filter((pattern) => pattern.test(lower)).length,
  };

  const ranked = Object.entries(matches).sort((a, b) => b[1] - a[1]);
  const [kind, count] = ranked[0];

  if (!count) {
    return {
      kind: "ignore_noise",
      confidence: 0.08,
      route: "ignore",
      reason: "no issue-report signals detected",
      signals: [],
    };
  }

  const confidenceBase = {
    bug: 0.7,
    preference_correction: 0.72,
    content_problem: 0.68,
    feature_request: 0.66,
  }[kind] || 0.5;

  const confidence = clamp01(confidenceBase + (count - 1) * 0.08, confidenceBase);
  const route = kind === "bug"
    ? "repair_queue"
    : kind === "preference_correction"
      ? "adaptive_behavior"
      : kind === "content_problem"
        ? "content_review"
        : "owner_review";

  return {
    kind,
    confidence,
    route,
    reason: `matched ${count} issue-report signal${count === 1 ? "" : "s"}`,
    signals: uniqueStrings(ranked.filter(([, score]) => score > 0).map(([label]) => label), 4),
  };
}

function buildRepairSummary({ reportText, classification, context = {} }) {
  const lower = String(reportText || "").toLowerCase();
  const probableArea =
    /\bvoice|mic|speech|audio\b/.test(lower) ? "voice_audio" :
    /\bgame|board|move|chess|checkers|connect four|battleship|tic tac toe\b/.test(lower) ? "games" :
    /\brepeat|tone|narrat|phrase\b/.test(lower) ? "adaptive_behavior" :
    /\bcanon|lore|character|spiritkin\b/.test(lower) ? "content_voice" :
    "general_app";

  const ownerDigestLine = classification.kind === "bug"
    ? `Bug report: ${summarizeText(reportText, 120)}`
    : classification.kind === "preference_correction"
      ? `Preference correction: ${summarizeText(reportText, 120)}`
      : classification.kind === "content_problem"
        ? `Content concern: ${summarizeText(reportText, 120)}`
        : `Feature request: ${summarizeText(reportText, 120)}`;

  return {
    probable_area: probableArea,
    actionable_summary: summarizeText(reportText, 220),
    owner_digest_line: ownerDigestLine,
    suggested_next_action:
      classification.route === "repair_queue" ? "review for sandbox repair planning" :
      classification.route === "adaptive_behavior" ? "review adaptation/correction behavior" :
      classification.route === "content_review" ? "review canon/content fidelity" :
      "review for roadmap triage",
    conversation_context: {
      conversation_id: context.conversationId ?? null,
      spiritkin_name: context.spiritkinName ?? null,
      user_id: context.userId ?? null,
    }
  };
}

export function createIssueReportService({ supabase, logger = console }) {
  const memoryStore = [];

  async function persistRecord(record) {
    try {
      const { error } = await supabase.from("issue_reports").insert({
        id: record.id,
        user_id: record.user_id,
        conversation_id: record.conversation_id,
        spiritkin_name: record.spiritkin_name,
        report_text: record.report_text,
        classification: record.classification,
        route: record.route,
        confidence: record.confidence,
        status: record.status,
        source: record.source,
        reason: record.reason,
        signals: record.signals,
        repair_summary: record.repair_summary,
        created_at: record.created_at,
        updated_at: record.updated_at,
      });
      if (error) throw error;
      return { storage: "supabase" };
    } catch (error) {
      memoryStore.unshift({ ...record, storage: "memory" });
      if (memoryStore.length > 250) memoryStore.pop();
      logger.warn?.(`[IssueReportService] Falling back to memory store: ${error.message}`);
      logger.info?.({ issue_report: record }, "issue_report_logged");
      return { storage: "memory", error: error.message };
    }
  }

  async function captureFromInteraction({ userId, conversationId, spiritkinName, input, source = "interact" }) {
    const classification = buildIssueClassification(input);
    if (classification.kind === "ignore_noise" || classification.confidence < 0.58) {
      return { ok: true, captured: false, classification };
    }

    const timestamp = nowIso();
    const record = {
      id: createId(),
      user_id: userId ? String(userId) : null,
      conversation_id: conversationId ?? null,
      spiritkin_name: spiritkinName ?? null,
      report_text: String(input || "").trim(),
      classification: classification.kind,
      route: classification.route,
      confidence: classification.confidence,
      status: classification.route === "repair_queue" ? "queued" : "logged",
      source,
      reason: classification.reason,
      signals: classification.signals,
      repair_summary: buildRepairSummary({
        reportText: input,
        classification,
        context: { userId, conversationId, spiritkinName }
      }),
      created_at: timestamp,
      updated_at: timestamp,
    };

    const persisted = await persistRecord(record);
    return {
      ok: true,
      captured: true,
      classification,
      record: {
        id: record.id,
        classification: record.classification,
        route: record.route,
        confidence: record.confidence,
        status: record.status,
        created_at: record.created_at,
        storage: persisted.storage,
      },
    };
  }

  async function listRecent({ limit = 50 } = {}) {
    try {
      const { data, error } = await supabase
        .from("issue_reports")
        .select("id, user_id, conversation_id, spiritkin_name, report_text, classification, route, confidence, status, source, reason, signals, repair_summary, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(limit) || 50, 200));
      if (error) throw error;
      return data ?? [];
    } catch (_) {
      return memoryStore.slice(0, Math.min(Number(limit) || 50, 200));
    }
  }

  async function getDigest() {
    const reports = await listRecent({ limit: 100 });
    const countsByClassification = reports.reduce((acc, report) => {
      const key = report.classification || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const countsByStatus = reports.reduce((acc, report) => {
      const key = report.status || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      generated_at: nowIso(),
      totals: {
        reports: reports.length,
        by_classification: countsByClassification,
        by_status: countsByStatus,
      },
      queue: reports
        .filter((report) => report.route === "repair_queue")
        .slice(0, 10)
        .map((report) => ({
          id: report.id,
          confidence: report.confidence,
          status: report.status,
          owner_digest_line: report.repair_summary?.owner_digest_line || summarizeText(report.report_text, 120),
          probable_area: report.repair_summary?.probable_area || "general_app",
          created_at: report.created_at,
        })),
      corrections: reports
        .filter((report) => report.route === "adaptive_behavior")
        .slice(0, 10)
        .map((report) => ({
          id: report.id,
          owner_digest_line: report.repair_summary?.owner_digest_line || summarizeText(report.report_text, 120),
          confidence: report.confidence,
          created_at: report.created_at,
        })),
      owner_digest: reports.slice(0, 12).map((report) => ({
        id: report.id,
        classification: report.classification,
        route: report.route,
        status: report.status,
        confidence: report.confidence,
        summary: report.repair_summary?.owner_digest_line || summarizeText(report.report_text, 120),
        created_at: report.created_at,
      })),
    };
  }

  return {
    buildIssueClassification,
    captureFromInteraction,
    listRecent,
    getDigest,
  };
}
