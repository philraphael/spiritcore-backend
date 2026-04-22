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

const SEVERITY_SCORE = {
  high: 3,
  medium: 2,
  low: 1,
};

const RISK_SCORE = {
  repair_candidate: 3,
  review_needed: 2,
  adaptive_only: 1,
  informational: 0,
};

const CLUSTER_STOP_WORDS = new Set([
  "the", "and", "that", "this", "with", "from", "into", "when", "then", "have", "keeps",
  "keep", "after", "before", "while", "there", "they", "them", "does", "doesnt", "dont",
  "not", "working", "right", "just", "like", "feel", "game", "games", "voice", "spiritkin",
  "spiritcore", "report", "issue", "please", "would", "could", "should", "still", "again",
  "once", "your", "about", "because", "around", "general", "user", "beta",
]);

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

function normalizeClusterTokens(text = "", limit = 6) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && token.length > 2 && !CLUSTER_STOP_WORDS.has(token))
    .slice(0, limit);
}

function inferAffectedSystem(probableArea = "general_app", reportText = "") {
  const lower = String(reportText || "").toLowerCase();
  if (probableArea === "voice_audio" || /\b(mic|microphone|voice|speech|audio)\b/.test(lower)) return "voice_runtime";
  if (probableArea === "games" || /\b(game|board|move|turn|piece|tile)\b/.test(lower)) return "game_runtime";
  if (/\b(boot|startup|load|loading|crash|render|screen|blank)\b/.test(lower)) return "app_shell";
  if (probableArea === "adaptive_behavior") return "adaptive_behavior";
  if (probableArea === "content_voice") return "content_fidelity";
  return probableArea || "general_app";
}

function buildRecurringKey({ reportText, classification, probableArea, context = {} }) {
  const normalizedContext = sanitizeContext(context);
  const lower = String(reportText || "").toLowerCase();
  const signature = inferThemeSignature(lower, probableArea);
  const tokens = normalizeClusterTokens(reportText, 5).join("_") || "general";
  return [
    classification?.kind || "unknown",
    probableArea || "general_app",
    normalizedContext.related_spiritkin || "global",
    signature,
    tokens,
  ].join(":");
}

function buildInitialReproductionHints({ probableArea = "general_app", reportText = "", context = {} }) {
  const normalizedContext = sanitizeContext(context);
  const lower = String(reportText || "").toLowerCase();
  const lines = [`Open the ${probableArea} surface and repeat the user path that triggered the report.`];

  if (normalizedContext.source_context) lines.push(`Start from source context: ${normalizedContext.source_context}.`);
  if (normalizedContext.related_spiritkin) lines.push(`Use Spiritkin context: ${normalizedContext.related_spiritkin}.`);
  if (normalizedContext.conversation_id) lines.push("Check the linked conversation state before reproducing the issue.");
  if (/\bboot|startup|load|loading|blank screen\b/.test(lower)) lines.push("Reproduce from a cold page load and watch the first render lifecycle.");
  if (/\brender|screen|layout|button|click|tap|panel\b/.test(lower)) lines.push("Confirm the UI renders, then verify the failing interaction after first paint.");
  if (/\bmic|microphone|voice|speech|audio\b/.test(lower)) lines.push("Exercise the microphone path and confirm state transitions through listen, process, and response.");
  if (/\bgame|board|move|turn|piece|tile\b/.test(lower)) lines.push("Start a fresh game and confirm board render plus first interaction alignment.");

  return uniqueStrings(lines, 6);
}

function buildRecoveryGuidance({ probableArea = "general_app", classification = {}, reportText = "" }) {
  const lower = String(reportText || "").toLowerCase();
  const lines = [
    "Refresh once before retrying the same action.",
    "If the issue repeats, send the visible build marker and the room or feature you were using.",
  ];

  if (classification.route === "repair_queue") lines.unshift("If the action is blocked, stop retrying loops and capture the exact failing step for review.");
  if (probableArea === "voice_audio" || /\bmic|microphone|voice|speech|audio\b/.test(lower)) lines.push("If voice is affected, pause speaking, let the state settle, then retry one clean turn.");
  if (probableArea === "games" || /\b(game|board|move|turn)\b/.test(lower)) lines.push("If gameplay is affected, avoid rapid repeated clicks and retry from a fresh board state.");
  if (/\b(boot|load|render|screen|blank)\b/.test(lower)) lines.push("If the interface does not recover after refresh, capture the boot or render failure text from the screen.");

  return uniqueStrings(lines, 5);
}

function buildDiagnosticsChecklist({ probableArea = "general_app", reportText = "", classification = {}, context = {} }) {
  const normalizedContext = sanitizeContext(context);
  const lower = String(reportText || "").toLowerCase();
  const checks = [];

  if (/\b(boot|startup|load|loading|blank)\b/.test(lower)) checks.push("Verify boot fallback visibility and capture the build marker shown with the failure.");
  if (/\b(render|screen|layout|button|click|tap|panel)\b/.test(lower)) checks.push("Confirm a visible render surface exists before the failing interaction.");
  if (probableArea === "voice_audio" || /\b(mic|microphone|voice|speech|audio)\b/.test(lower)) checks.push("Inspect voice state transitions and confirm the microphone does not stall between user and Spiritkin turns.");
  if (probableArea === "games" || /\b(game|board|move|turn)\b/.test(lower)) checks.push("Verify board render, click alignment, and state updates on the first user action.");
  if (classification.route === "repair_queue") checks.push("Review clustered reports first before drafting any manual repair brief.");
  if (normalizedContext.current_feature) checks.push(`Validate the production path in feature context: ${normalizedContext.current_feature}.`);

  return uniqueStrings(checks, 6);
}

function computePriorityScore({ severity = "low", confidence = 0, groupSize = 1, riskTier = "informational" }) {
  return ((SEVERITY_SCORE[severity] || 1) * 30)
    + ((RISK_SCORE[riskTier] || 0) * 10)
    + (Math.min(groupSize, 6) * 6)
    + Math.round(clamp01(confidence, 0) * 20);
}

function priorityLabelFromScore(score = 0) {
  if (score >= 110) return "urgent";
  if (score >= 80) return "high";
  if (score >= 50) return "watch";
  return "routine";
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

  const clearSummary = summarizeText(reportText, 180);
  const affectedSystem = inferAffectedSystem(probableArea, reportText);
  const reproductionHints = buildInitialReproductionHints({ probableArea, reportText, context: normalizedContext });
  const recoveryGuidance = buildRecoveryGuidance({ probableArea, classification, reportText });
  const diagnostics = buildDiagnosticsChecklist({ probableArea, reportText, classification, context: normalizedContext });
  const recurringKey = buildRecurringKey({
    reportText,
    classification,
    probableArea,
    context: normalizedContext,
  });
  const priorityScore = computePriorityScore({
    severity: classification.severity,
    confidence: classification.confidence,
    groupSize: 1,
    riskTier: classification.risk_tier,
  });

  return {
    probable_area: probableArea,
    affected_system: affectedSystem,
    issue_family: classification.kind,
    theme_signature: inferThemeSignature(lower, probableArea),
    severity: classification.severity,
    confidence: classification.confidence,
    risk_tier: classification.risk_tier,
    suggested_route: classification.route,
    clear_summary: clearSummary,
    actionable_summary: summarizeText(reportText, 220),
    owner_digest_line: ownerDigestLine,
    owner_review_brief: `${affectedSystem} / ${classification.severity} / ${classification.route}`,
    reproduction_hints: reproductionHints,
    recovery_guidance: recoveryGuidance,
    diagnostics,
    suggested_next_action:
      classification.route === "repair_queue" ? "review for sandbox repair planning" :
      classification.route === "adaptive_behavior" ? "review adaptation/correction behavior" :
      classification.route === "content_review" ? "review canon/content fidelity" :
      classification.route === "ignore" ? "ignore for now" :
      "review for roadmap triage",
    recurring_key: recurringKey,
    priority_score: priorityScore,
    priority_label: priorityLabelFromScore(priorityScore),
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
    affected_system: summary.affected_system || inferAffectedSystem(summary.probable_area || "general_app", record.report_text || ""),
    priority_score: Number(summary.priority_score || 0),
    priority_label: summary.priority_label || "routine",
    context: summary.context || {},
    grouped_key: summary.recurring_key || null,
  };
}

function summarizeGroup(group = []) {
  const first = group[0] || {};
  const averageConfidence = clamp01(
    group.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / Math.max(group.length, 1),
    clamp01(first.confidence, 0.5)
  );
  const priorityScore = computePriorityScore({
    severity: first.severity || "low",
    confidence: averageConfidence,
    groupSize: group.length,
    riskTier: first.risk_tier || "informational",
  });
  return {
    grouped_key: first.grouped_key || null,
    classification: first.classification || "unknown",
    probable_area: first.repair_summary?.probable_area || first.context?.current_feature || "general_app",
    affected_system: first.repair_summary?.affected_system || first.affected_system || "general_app",
    count: group.length,
    latest_created_at: group[0]?.created_at || null,
    top_summary: first.repair_summary?.owner_digest_line || first.summary || summarizeText(first.report_text, 120),
    severity: first.severity || "low",
    risk_tier: first.risk_tier || "informational",
    confidence: averageConfidence,
    priority_score: priorityScore,
    priority_label: priorityLabelFromScore(priorityScore),
  };
}

function clusterIssueReports(reports = []) {
  return Object.values(
    (reports || []).reduce((acc, report) => {
      const probableArea = report.repair_summary?.probable_area || report.context?.current_feature || "general_app";
      const key = report.grouped_key || [
        report.classification || "unknown",
        probableArea,
        report.repair_summary?.affected_system || report.affected_system || "general_app",
        report.repair_summary?.theme_signature || inferThemeSignature(String(report.raw_report || report.report_text || "").toLowerCase(), probableArea),
      ].join(":");
      if (!acc[key]) acc[key] = [];
      acc[key].push(report);
      return acc;
    }, {})
  )
    .map((group) => group.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))))
    .sort((a, b) => {
      const scoreA = computePriorityScore({
        severity: a[0]?.severity || "low",
        confidence: a[0]?.confidence || 0,
        groupSize: a.length,
        riskTier: a[0]?.risk_tier || "informational",
      });
      const scoreB = computePriorityScore({
        severity: b[0]?.severity || "low",
        confidence: b[0]?.confidence || 0,
        groupSize: b.length,
        riskTier: b[0]?.risk_tier || "informational",
      });
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

  const averageConfidence = clamp01(
    group.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / Math.max(group.length, 1),
    clamp01(primary.confidence, 0.5)
  );
  const priorityScore = computePriorityScore({
    severity: primary.severity || "low",
    confidence: averageConfidence,
    groupSize: group.length,
    riskTier: primary.risk_tier || "informational",
  });
  const featureContext = {
    probable_area: primary.repair_summary?.probable_area || primary.context?.current_feature || "general_app",
    affected_system: primary.repair_summary?.affected_system || primary.affected_system || "general_app",
    current_feature: primary.context?.current_feature || null,
    source_context: primary.context?.source_context || null,
    related_spiritkin: primary.context?.related_spiritkin || null,
  };

  return {
    issue_id: primary.id,
    cluster_key: primary.grouped_key || null,
    summary: primary.repair_summary?.owner_digest_line || primary.summary || summarizeText(primary.raw_report, 140),
    clear_summary: primary.repair_summary?.clear_summary || primary.summary || summarizeText(primary.raw_report, 180),
    category: primary.classification || "bug",
    severity: primary.severity || "low",
    confidence: averageConfidence,
    priority_score: priorityScore,
    priority_label: priorityLabelFromScore(priorityScore),
    reproduction_hints: buildReproductionHints(group, primary),
    feature_context: featureContext,
    affected_system: featureContext.affected_system,
    grouped_related_issues: group.slice(0, 5).map((report) => ({
      id: report.id,
      created_at: report.created_at,
      severity: report.severity,
      summary: report.repair_summary?.clear_summary || report.repair_summary?.owner_digest_line || report.summary || summarizeText(report.raw_report, 120),
      current_feature: report.context?.current_feature || null,
    })),
    recent_related_reports: group.slice(0, 5).map((report) => ({
      id: report.id,
      created_at: report.created_at,
      summary: report.repair_summary?.owner_digest_line || report.summary || summarizeText(report.raw_report, 120),
      confidence: report.confidence,
      severity: report.severity,
      route: report.route,
    })),
    diagnostics: primary.repair_summary?.diagnostics || buildDiagnosticsChecklist({
      probableArea: featureContext.probable_area,
      reportText: primary.raw_report,
      classification: primary,
      context: primary.context,
    }),
    user_recovery_guidance: primary.repair_summary?.recovery_guidance || buildRecoveryGuidance({
      probableArea: featureContext.probable_area,
      classification: primary,
      reportText: primary.raw_report,
    }),
    owner_review_summary: primary.repair_summary?.owner_review_brief || `${featureContext.affected_system} / ${primary.severity || "low"} / ${primary.route || "review"}`,
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
        affected_system: record.repair_summary?.affected_system || "general_app",
        priority_label: record.repair_summary?.priority_label || "routine",
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
    const reviewSummary = {
      urgent_clusters: groupedRecurringIssues.filter((item) => item.priority_label === "urgent").length,
      high_priority_clusters: groupedRecurringIssues.filter((item) => item.priority_label === "high").length,
      watch_clusters: groupedRecurringIssues.filter((item) => item.priority_label === "watch").length,
      top_review_targets: groupedRecurringIssues.slice(0, 5).map((item) => ({
        grouped_key: item.grouped_key,
        probable_area: item.probable_area,
        affected_system: item.affected_system,
        summary: item.top_summary,
        severity: item.severity,
        count: item.count,
        priority_label: item.priority_label,
      })),
    };

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
      review_summary: reviewSummary,
      latest_reported_issues: reports.slice(0, 12).map((report) => ({
        id: report.id,
        classification: report.classification,
        severity: report.severity,
        risk_tier: report.risk_tier,
        route: report.route,
        summary: report.repair_summary?.owner_digest_line || report.summary,
        affected_system: report.repair_summary?.affected_system || report.affected_system || "general_app",
        priority_label: report.priority_label || report.repair_summary?.priority_label || "routine",
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
          affected_system: report.repair_summary?.affected_system || report.affected_system || "general_app",
          priority_label: report.priority_label || report.repair_summary?.priority_label || "routine",
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
          affected_system: report.repair_summary?.affected_system || report.affected_system || "general_app",
          priority_label: report.priority_label || report.repair_summary?.priority_label || "routine",
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
        affected_system: report.repair_summary?.affected_system || report.affected_system || "general_app",
        priority_label: report.priority_label || report.repair_summary?.priority_label || "routine",
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
      clear_summary: packet.clear_summary,
      severity: packet.severity,
      confidence: packet.confidence,
      probable_area: packet.feature_context?.probable_area || "general_app",
      affected_system: packet.affected_system || packet.feature_context?.affected_system || "general_app",
      related_reports: packet.recent_related_reports.length,
      priority_label: packet.priority_label,
      priority_score: packet.priority_score,
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
      if (!acc[key]) acc[key] = { probable_area: key, complaints: 0, clusters: 0, highest_priority: "routine" };
      acc[key].clusters += 1;
      acc[key].complaints += packet.recent_related_reports.length;
      if ((packet.priority_score || 0) >= 80) {
        acc[key].highest_priority = packet.priority_label || acc[key].highest_priority;
      }
      return acc;
    }, {});
    const priorityQueue = [...packets]
      .sort((a, b) => Number(b.priority_score || 0) - Number(a.priority_score || 0))
      .slice(0, 12)
      .map((packet) => ({
        issue_id: packet.issue_id,
        cluster_key: packet.cluster_key,
        summary: packet.summary,
        clear_summary: packet.clear_summary,
        severity: packet.severity,
        confidence: packet.confidence,
        probable_area: packet.feature_context?.probable_area || "general_app",
        affected_system: packet.affected_system || packet.feature_context?.affected_system || "general_app",
        priority_label: packet.priority_label,
        priority_score: packet.priority_score,
        related_reports: packet.recent_related_reports?.length || 0,
        recommended_next_action: packet.recommended_next_action,
      }));

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
      review_summary: {
        urgent_packets: packets.filter((packet) => packet.priority_label === "urgent").length,
        high_priority_packets: packets.filter((packet) => packet.priority_label === "high").length,
        watch_packets: packets.filter((packet) => packet.priority_label === "watch").length,
        production_verification_required: true,
        owner_action: "Review packets in priority order, validate reproduction in production, then prepare a manual repair brief.",
      },
      priority_queue: priorityQueue,
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
