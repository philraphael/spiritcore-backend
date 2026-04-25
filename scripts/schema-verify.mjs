import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const REQUIRED_TABLES = [
  "users",
  "conversations",
  "messages",
  "memories",
  "spirit_memory",
  "episodes",
  "emotion_state",
  "world_state",
  "user_engagement",
  "safety_events",
];

const REQUIRED_COLUMNS = {
  memories: ["kind", "meta"],
  episodes: ["content", "emotion_snapshot"],
  emotion_state: ["label", "valence", "arousal", "metadata_json"],
  world_state: ["spiritkin_id", "scene_json"],
  user_engagement: [
    "user_id",
    "spiritkin_id",
    "last_session_at",
    "last_bond_stage",
    "last_echo_unlocks",
    "last_emotion_label",
    "last_arc",
    "updated_at",
  ],
};

const INDEX_EXPECTATIONS = [
  {
    table: "user_engagement",
    columns: ["user_id", "spiritkin_id"],
    unique: true,
    label: "user_engagement unique on user_id + spiritkin_id",
  },
  {
    table: "emotion_state",
    columns: ["user_id", "spiritkin_id", "conversation_id"],
    unique: true,
    label: "emotion_state unique on user_id + spiritkin_id + conversation_id",
  },
];

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function normalizeError(error) {
  if (!error) return null;
  return {
    code: error.code || null,
    message: error.message || String(error),
    details: error.details || null,
    hint: error.hint || null,
  };
}

function parseIndexColumns(indexdef = "") {
  const match = String(indexdef).match(/\(([^)]+)\)/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((part) => part.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function columnsMatch(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  return expected.every((column, index) => actual[index] === column);
}

async function verifyTable(supabase, table) {
  const { error } = await supabase.from(table).select("*").limit(0);
  return {
    table,
    ok: !error,
    error: normalizeError(error),
  };
}

async function verifyColumns(supabase, table, columns) {
  const { error } = await supabase.from(table).select(columns.join(",")).limit(0);
  return {
    table,
    columns,
    ok: !error,
    error: normalizeError(error),
  };
}

async function fetchPgIndexes(supabase) {
  const tableNames = [...new Set(INDEX_EXPECTATIONS.map((expectation) => expectation.table))];
  const { data, error } = await supabase
    .schema("pg_catalog")
    .from("pg_indexes")
    .select("tablename,indexname,indexdef")
    .in("tablename", tableNames);

  if (error) {
    return {
      available: false,
      reason: normalizeError(error),
      indexes: [],
    };
  }

  return {
    available: true,
    reason: null,
    indexes: Array.isArray(data) ? data : [],
  };
}

async function verifyIndexes(supabase) {
  const catalog = await fetchPgIndexes(supabase);
  if (!catalog.available) {
    return INDEX_EXPECTATIONS.map((expectation) => ({
      ...expectation,
      ok: null,
      status: "unverified",
      reason: "pg_catalog.pg_indexes is not exposed through the current Supabase REST API configuration.",
      error: catalog.reason,
    }));
  }

  return INDEX_EXPECTATIONS.map((expectation) => {
    const match = catalog.indexes.find((index) => {
      const indexdef = String(index.indexdef || "").toLowerCase();
      const actualColumns = parseIndexColumns(index.indexdef);
      return index.tablename === expectation.table
        && (!expectation.unique || indexdef.includes("unique index"))
        && columnsMatch(actualColumns, expectation.columns);
    });

    return {
      ...expectation,
      ok: !!match,
      status: match ? "verified" : "missing",
      indexName: match?.indexname || null,
      indexDef: match?.indexdef || null,
    };
  });
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    printJson({
      ok: false,
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
      secretsPrinted: false,
    });
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const tableResults = [];
  for (const table of REQUIRED_TABLES) {
    tableResults.push(await verifyTable(supabase, table));
  }

  const columnResults = [];
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    columnResults.push(await verifyColumns(supabase, table, columns));
  }

  const indexResults = await verifyIndexes(supabase);
  const tableFailures = tableResults.filter((result) => !result.ok);
  const columnFailures = columnResults.filter((result) => !result.ok);
  const indexFailures = indexResults.filter((result) => result.ok === false);
  const indexUnverified = indexResults.filter((result) => result.ok === null);
  const ok = tableFailures.length === 0 && columnFailures.length === 0 && indexFailures.length === 0;

  printJson({
    ok,
    mode: "read-only",
    secretsPrinted: false,
    checked: {
      tables: tableResults,
      columns: columnResults,
      indexes: indexResults,
    },
    summary: {
      tablePassCount: tableResults.filter((result) => result.ok).length,
      tableFailCount: tableFailures.length,
      columnPassCount: columnResults.filter((result) => result.ok).length,
      columnFailCount: columnFailures.length,
      indexVerifiedCount: indexResults.filter((result) => result.ok === true).length,
      indexFailCount: indexFailures.length,
      indexUnverifiedCount: indexUnverified.length,
    },
  });

  process.exitCode = ok ? 0 : 1;
}

main().catch((error) => {
  printJson({
    ok: false,
    error: error?.message || String(error),
    secretsPrinted: false,
  });
  process.exitCode = 1;
});
