function createId(prefix = "iss") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function currentUtcDayBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
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

function sanitizeContext(context = {}) {
  if (!context || typeof context !== "object") return {};
  return {
    source_context: String(context.sourceContext || context.source || "").trim() || null,
    current_feature: String(context.currentFeature || context.feature || context.activeTab || "").trim() || null,
    related_spiritkin: String(context.relatedSpiritkin || context.spiritkinName || "").trim() || null,
    conversation_id: context.conversationId ?? null,
    user_id: context.userId ? String(context.userId) : null,
    session_id: context.sessionId ? String(context.sessionId) : null,
  };
}

function scoreMatchCount(lower, patterns = []) {
  return patterns.filter((pattern) => pattern.test(lower)).length;
}

function inferThemeSignature(lower = "", probableArea = "general_app") {
  if (/\bmic|microphone|voice|speech|audio\b/.test(lower)) return `${probableArea}:voice_mic`;
  if (/\bgame|board|move|turn|ai\b/.test(lower)) return `${probableArea}:gameplay_flow`;
  if (/\brepeat|repeating|tone|narrat|phrase|teas|respect\b/.test(lower)) return `${probableArea}:delivery_tone`;
  if (/\bcanon|lore|wrong|incorrect|out of character\b/.test(lower)) return `${probableArea}:canon_content`;
  if (/\bslow|load|loading|stuck|freeze|crash|broken|error|fail\b/.test(lower)) return `${probableArea}:stability`;
  if (/\badd|feature|wish\b/.test(lower)) return `${probableArea}:feature_request`;
  return `${probableArea}:${summarizeText(lower.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(), 48) || "general"}`;
}

function buildIssueClassification(text, context = {}) {
  const input = String(text || "").trim();
  const lower = input.toLowerCase();
  if (!lower) {
    return {
      kind: "ignore_noise",
      category: "low_signal_ignore",
      confidence: 0,
      route: "ignore",
      severity: "low",
      risk_tier: "informational",
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
    /\bnot loading\b/i,
    /\bkeeps freezing\b/i,
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
    /\btalk like that\b/i,
    /\bkeep it smooth\b/i,
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

  const lowSignalSignals = [
    /\bwhatever\b/i,
    /\bnever mind\b/i,
    /\bidk\b/i,
    /\bignore that\b/i,
  ];

  const matches = {
    bug: scoreMatchCount(lower, bugSignals),
    preference_correction: scoreMatchCount(lower, correctionSignals),
    content_problem: scoreMatchCount(lower, contentSignals),
    feature_request: scoreMatchCount(lower, featureSignals),
    low_signal_ignore: scoreMatchCount(lower, lowSignalSignals),
  };

  const ranked = Object.entries(matches).sort((a, b) => b[1] - a[1]);
  const [kind, count] = ranked[0];

  if (!count) {
    return {
      kind: "ignore_noise",
      category: "low_signal_ignore",
      confidence: 0.08,
      route: "ignore",
      severity: "low",
      risk_tier: "informational",
      reason: "no issue-report signals detected",
      signals: [],
    };
  }

  const confidenceBase = {
    bug: 0.7,
    preference_correction: 0.72,
    content_problem: 0.68,
    feature_request: 0.66,
    low_signal_ignore: 0.3,
  }[kind] || 0.5;

  const confidence = clamp01(confidenceBase + (count - 1) * 0.08, confidenceBase);
  const route = kind === "bug"
    ? "repair_queue"
    : kind === "preference_correction"
      ? "adaptive_behavior"
      : kind === "content_problem"
        ? "content_review"
        : kind === "feature_request"
          ? "owner_review"
          : "ignore";
  const severity = kind === "bug"
    ? (/\bcrash|error|won'?t load|can'?t|cannot|keeps turning off|not working|broken\b/.test(lower) ? "high" : "medium")
    : kind === "content_problem"
      ? "medium"
      : "low";
  const riskTier = route === "repair_queue"
    ? "repair_candidate"
    : route === "adaptive_behavior"
      ? "adaptive_only"
      : route === "owner_review" || route === "content_review"
        ? "review_needed"
        : "informational";
  const featureContext = sanitizeContext(context);

  return {
    kind,
    category: kind === "ignore_noise" ? "low_signal_ignore" : kind,
    confidence,
    route,
    severity,
    risk_tier: riskTier,
    reason: `matched ${count} issue-report signal${count === 1 ? "" : "s"}`,
    signals: uniqueStrings(ranked.filter(([, score]) => score > 0).map(([label]) => label), 4),
    feature_context: featureContext.current_feature,
  };
}

function buildRepairSummary({ reportText, classification, context = {} }) {
  const lower = String(reportText || "").toLowerCase();
  const normalizedContext = sanitizeContext(context);
  const probableArea =
    normalizedContext.current_feature || (
      /\bvoice|mic|speech|audio\b/.test(lower) ? "voice_audio" :
      /\bgame|board|move|chess|checkers|connect four|battleship|tic tac toe\b/.test(lower) ? "games" :
      /\brepeat|tone|narrat|phrase\b/.test(lower) ? "adaptive_behavior" :
      /\bcanon|lore|character|spiritkin\b/.test(lower) ? "content_voice" :
      "general_app"
    );

  const ownerDigestLine = classification.kind === "bug"
    ? `Bug report: ${summarizeText(reportText, 120)}`
    : classification.kind === "preference_correction"
      ? `Preference correction: ${summarizeText(reportText, 120)}`
      : classification.kind === "content_problem"
        ? `Content concern: ${summarizeText(reportText, 120)}`
        : classification.kind === "feature_request"
          ? `Feature request: ${summarizeText(reportText, 120)}`
          : `Low-signal report: ${summarizeText(reportText, 120)}`;

  const recurringKey = [
    classification.kind,
    probableArea,
    normalizedContext.related_spiritkin || "global",
    inferThemeSignature(lower, probableArea),
  ].join(":");

  return {
    probable_area: probableArea,
    severity: classification.severity,
    risk_tier: classification.risk_tier,
    suggested_route: classification.route,
    actionable_summary: summarizeText(reportText, 220),
    owner_digest_line: ownerDigestLine,
    suggested_next_action:
      classification.route === "repair_queue" ? "review for sandbox repair planning" :
      classification.route === "adaptive_behavior" ? "review adaptation/correction behavior" :
      classification.route === "content_review" ? "review canon/content fidelity" :
      classification.route === "ignore" ? "ignore for now" :
      "review for roadmap triage",
    recurring_key: recurringKey,
    governance: {
      autonomous_patch_allowed: false,
      autonomous_deploy_allowed: false,
      owner_approval_required: true,
    },
    context: normalizedContext,
  };
}

function normalizeStoredRecord(record = {}) {
  const summary = record.repair_summary && typeof record.repair_summary === "object" ? record.repair_summary : {};
  return {
    ...record,
    raw_report: record.report_text,
    summary: summary.actionable_summary || summarizeText(record.report_text, 220),
    severity: summary.severity || record.severity || "low",
    risk_tier: summary.risk_tier || "informational",
    suggested_route: summary.suggested_route || record.route || "ignore",
    context: summary.context || {},
    grouped_key: summary.recurring_key || null,
  };
}

function summarizeGroup(group = []) {
  const first = group[0] || {};
  return {
    grouped_key: first.grouped_key || null,
    classification: first.classification || "unknown",
    probable_area: first.repair_summary?.probable_area || first.context?.current_feature || "general_app",
    count: group.length,
    latest_created_at: group[0]?.created_at || null,
    top_summary: first.repair_summary?.owner_digest_line || first.summary || summarizeText(first.report_text, 120),
    severity: first.severity || "low",
    risk_tier: first.risk_tier || "informational",
  };
}

function clusterIssueReports(reports = []) {
  return Object.values(
    (reports || []).reduce((acc, report) => {
      const key = report.grouped_key || `${report.classification}:${report.context?.current_feature || "general_app"}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(report);
      return acc;
    }, {})
  )
    .map((group) => group.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))))
    .sort((a, b) => {
      const severityScore = { high: 3, medium: 2, low: 1 };
      const scoreA = (a.length * 10) + (severityScore[a[0]?.severity] || 0);
      const scoreB = (b.length * 10) + (severityScore[b[0]?.severity] || 0);
      return scoreB - scoreA;
    });
}

function buildReproductionHints(group = [], report = {}) {
  const probableArea = report.repair_summary?.probable_area || report.context?.current_feature || "general_app";
  const lines = [
    `Start in feature area: ${probableArea}.`,
  ];

  if (report.context?.source_context) lines.push(`Observed from source context: ${report.context.source_context}.`);
  if (report.context?.related_spiritkin) lines.push(`Related Spiritkin in reports: ${report.context.related_spiritkin}.`);
  if (/\bmic|microphone|voice|speech|audio\b/i.test(report.raw_report || "")) {
    lines.push("Exercise voice or microphone flow and watch for repeated disconnects or state resets.");
  }
  if (/\b(game|board|move|turn|ai|load)\b/i.test(report.raw_report || "")) {
    lines.push("Open the game surface, start a session, and verify first-load plus move/render behavior.");
  }
  if (group.length > 1) {
    lines.push(`Cross-check against ${group.length} similar report${group.length === 1 ? "" : "s"} in the same cluster.`);
  }

  return uniqueStrings(lines, 6);
}

function buildRepairPacket(group = []) {
  const primary = group[0];
  if (!primary) return null;

  return {
    issue_id: primary.id,
    cluster_key: primary.grouped_key || null,
    summary: primary.repair_summary?.owner_digest_line || primary.summary || summarizeText(primary.raw_report, 140),
    category: primary.classification || "bug",
    severity: primary.severity || "low",
    confidence: clamp01(
      group.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / Math.max(group.length, 1),
      clamp01(primary.confidence, 0.5)
    ),
    reproduction_hints: buildReproductionHints(group, primary),
    feature_context: {
      probable_area: primary.repair_summary?.probable_area || primary.context?.current_feature || "general_app",
      current_feature: primary.context?.current_feature || null,
      source_context: primary.context?.source_context || null,
      related_spiritkin: primary.context?.related_spiritkin || null,
    },
    recent_related_reports: group.slice(0, 5).map((report) => ({
      id: report.id,
      created_at: report.created_at,
      summary: report.repair_summary?.owner_digest_line || report.summary || summarizeText(report.raw_report, 120),
      confidence: report.confidence,
      severity: report.severity,
      route: report.route,
    })),
    recommended_next_action:
      primary.route === "repair_queue"
        ? "Owner review, then convert into a Codex sandbox repair brief if confirmed."
        : "Owner review before any workflow escalation.",
    governance: {
      autonomous_patch_allowed: false,
      autonomous_deploy_allowed: false,
      owner_approval_required: true,
    },
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

  async function countRecentUserReportsToday(userId) {
    if (!userId) return 0;
    const { startIso, endIso } = currentUtcDayBounds();
    try {
      const { count, error } = await supabase
        .from("issue_reports")
        .select("id", { count: "exact", head: true })
        .eq("user_id", String(userId))
        .eq("source", "user_report")
        .gte("created_at", startIso)
        .lt("created_at", endIso);
      if (error) throw error;
      if (!Number.isFinite(count)) throw new Error("issue report count unavailable");
      return Number(count || 0);
    } catch (_) {
      return memoryStore.filter((record) => (
        String(record.user_id || "") === String(userId) &&
        record.source === "user_report" &&
        typeof record.created_at === "string" &&
        record.created_at >= startIso &&
        record.created_at < endIso
      )).length;
    }
  }

  async function reportIssue({
    userId = null,
    conversationId = null,
    spiritkinName = null,
    sessionId = null,
    input = "",
    source = "user_report",
    sourceContext = null,
    currentFeature = null,
  }) {
    if (source === "user_report" && userId) {
      const reportsToday = await countRecentUserReportsToday(userId);
      if (reportsToday >= 3) {
        throw new Error("You have reached the beta report limit for today. You can send up to 3 reports per day.");
      }
    }

    const classification = buildIssueClassification(input, {
      userId,
      conversationId,
      spiritkinName,
      sessionId,
      source,
      sourceContext,
      currentFeature,
    });
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
        context: {
          userId,
          conversationId,
          spiritkinName,
          sessionId,
          source,
          sourceContext,
          currentFeature,
        }
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
        severity: record.repair_summary?.severity || classification.severity,
        risk_tier: record.repair_summary?.risk_tier || classification.risk_tier,
        route: record.route,
        suggested_route: record.repair_summary?.suggested_route || classification.route,
        confidence: record.confidence,
        status: record.status,
        created_at: record.created_at,
        storage: persisted.storage,
      },
    };
  }

  async function captureFromInteraction({ userId, conversationId, spiritkinName, input, source = "interact", currentFeature = null }) {
    return reportIssue({
      userId,
      conversationId,
      spiritkinName,
      input,
      source,
      sourceContext: "interaction_message",
      currentFeature,
    });
  }

  async function listRecent({ limit = 50 } = {}) {
    try {
      const { data, error } = await supabase
        .from("issue_reports")
        .select("id, user_id, conversation_id, spiritkin_name, report_text, classification, route, confidence, status, source, reason, signals, repair_summary, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(limit) || 50, 200));
      if (error) throw error;
      return (data ?? []).map(normalizeStoredRecord);
    } catch (_) {
      return memoryStore.slice(0, Math.min(Number(limit) || 50, 200)).map(normalizeStoredRecord);
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
    const groupedRecurringIssues = clusterIssueReports(reports)
      .filter((group) => group.length > 1)
      .sort((a, b) => {
        const scoreA = (a.length * 10) + (a[0]?.severity === "high" ? 5 : 0);
        const scoreB = (b.length * 10) + (b[0]?.severity === "high" ? 5 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 10)
      .map(summarizeGroup);

    return {
      generated_at: nowIso(),
      governance: {
        autonomous_patch_allowed: false,
        autonomous_deploy_allowed: false,
        owner_approval_required: true,
      },
      totals: {
        reports: reports.length,
        by_classification: countsByClassification,
        by_status: countsByStatus,
      },
      grouped_recurring_issues: groupedRecurringIssues,
      latest_reported_issues: reports.slice(0, 12).map((report) => ({
        id: report.id,
        classification: report.classification,
        severity: report.severity,
        risk_tier: report.risk_tier,
        route: report.route,
        summary: report.repair_summary?.owner_digest_line || report.summary,
        created_at: report.created_at,
      })),
      top_bug_themes: reports
        .filter((report) => report.classification === "bug")
        .reduce((acc, report) => {
          const key = report.repair_summary?.probable_area || "general_app";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
      unresolved_issues: reports
        .filter((report) => report.status !== "resolved" && report.route !== "ignore")
        .slice(0, 20)
        .map((report) => ({
          id: report.id,
          classification: report.classification,
          severity: report.severity,
          risk_tier: report.risk_tier,
          route: report.route,
          status: report.status,
          summary: report.repair_summary?.owner_digest_line || report.summary,
          created_at: report.created_at,
        })),
      preference_correction_trends: reports
        .filter((report) => report.classification === "preference_correction")
        .reduce((acc, report) => {
          const key = report.repair_summary?.probable_area || "adaptive_behavior";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
      queue: reports
        .filter((report) => report.route === "repair_queue")
        .slice(0, 10)
        .map((report) => ({
          id: report.id,
          severity: report.severity,
          risk_tier: report.risk_tier,
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
          probable_area: report.repair_summary?.probable_area || "adaptive_behavior",
          confidence: report.confidence,
          created_at: report.created_at,
        })),
      owner_digest: reports.slice(0, 12).map((report) => ({
        id: report.id,
        classification: report.classification,
        severity: report.severity,
        risk_tier: report.risk_tier,
        route: report.route,
        status: report.status,
        confidence: report.confidence,
        summary: report.repair_summary?.owner_digest_line || summarizeText(report.report_text, 120),
        created_at: report.created_at,
      })),
    };
  }

  async function getRepairPackets({ limit = 25 } = {}) {
    const reports = await listRecent({ limit: Math.max(Number(limit) || 25, 100) });
    return clusterIssueReports(
      reports.filter((report) => report.route === "repair_queue" || report.risk_tier === "repair_candidate")
    )
      .map(buildRepairPacket)
      .filter(Boolean)
      .slice(0, Math.min(Number(limit) || 25, 100));
  }

  async function getRepairHandoffDigest({ limit = 25 } = {}) {
    const packets = await getRepairPackets({ limit: Math.max(Number(limit) || 25, 50) });
    const recurringBugs = packets.slice(0, 10).map((packet) => ({
      cluster_key: packet.cluster_key,
      issue_id: packet.issue_id,
      summary: packet.summary,
      severity: packet.severity,
      confidence: packet.confidence,
      probable_area: packet.feature_context?.probable_area || "general_app",
      related_reports: packet.recent_related_reports.length,
      recommended_next_action: packet.recommended_next_action,
    }));
    const severityScore = { high: 3, medium: 2, low: 1 };
    const highestSeverityIssues = [...packets]
      .sort((a, b) => {
        const scoreA = (severityScore[a.severity] || 0) * 10 + a.confidence;
        const scoreB = (severityScore[b.severity] || 0) * 10 + b.confidence;
        return scoreB - scoreA;
      })
      .slice(0, 10);
    const newestIssues = [...packets]
      .sort((a, b) => String(b.recent_related_reports?.[0]?.created_at || "").localeCompare(String(a.recent_related_reports?.[0]?.created_at || "")))
      .slice(0, 10);
    const systemAreas = packets.reduce((acc, packet) => {
      const key = packet.feature_context?.probable_area || "general_app";
      if (!acc[key]) acc[key] = { probable_area: key, complaints: 0, clusters: 0 };
      acc[key].clusters += 1;
      acc[key].complaints += packet.recent_related_reports.length;
      return acc;
    }, {});

    return {
      generated_at: nowIso(),
      governance: {
        autonomous_patch_allowed: false,
        autonomous_deploy_allowed: false,
        owner_approval_required: true,
      },
      total_repair_packets: packets.length,
      top_recurring_bugs: recurringBugs,
      highest_severity_issues: highestSeverityIssues,
      newly_emerging_issues: newestIssues,
      repeat_complaints_by_system_area: Object.values(systemAreas).sort((a, b) => b.complaints - a.complaints),
      repair_packets: packets,
    };
  }

  return {
    buildIssueClassification,
    reportIssue,
    captureFromInteraction,
    listRecent,
    getDigest,
    getRepairPackets,
    getRepairHandoffDigest,
  };
}
