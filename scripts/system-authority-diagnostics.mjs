import { readFile } from "fs/promises";

const REGISTRY_PATH = new URL("../SPIRITCORE_SYSTEM_AUTHORITY_REGISTRY.json", import.meta.url);

const ALLOWED_AUTHORITY_LEVELS = new Set([
  "authoritative",
  "legacy_gated",
  "helper",
  "deprecated_candidate",
  "needs_review",
]);

const ALLOWED_WRITE_LEVELS = new Set([
  "none",
  "review_only",
  "approved_only",
  "active_only_with_promotion",
]);

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function fail(checks, name, detail) {
  checks.push({ name, ok: false, detail });
}

function pass(checks, name, detail) {
  checks.push({ name, ok: true, detail });
}

function getSystem(systems, systemId) {
  return systems.find((system) => system.systemId === systemId);
}

function requireSystem(checks, systems, systemId) {
  const system = getSystem(systems, systemId);
  if (!system) {
    fail(checks, `system:${systemId}:exists`, "required system missing from authority registry");
    return null;
  }
  pass(checks, `system:${systemId}:exists`, "required system is registered");
  return system;
}

async function main() {
  const checks = [];
  let registry;

  try {
    const raw = await readFile(REGISTRY_PATH, "utf8");
    registry = JSON.parse(raw);
    pass(checks, "registry:parse", "SPIRITCORE_SYSTEM_AUTHORITY_REGISTRY.json exists and parses");
  } catch (error) {
    fail(checks, "registry:parse", error?.message || String(error));
    printJson({ ok: false, checks, summary: { passCount: 0, failCount: 1 } });
    process.exitCode = 1;
    return;
  }

  const systems = Array.isArray(registry.systems) ? registry.systems : [];
  if (systems.length > 0) {
    pass(checks, "registry:systems", `${systems.length} systems registered`);
  } else {
    fail(checks, "registry:systems", "systems must be a non-empty array");
  }

  for (const system of systems) {
    if (!system.systemId) fail(checks, "system:systemId", "all systems must include systemId");
    if (!ALLOWED_AUTHORITY_LEVELS.has(system.authorityLevel)) {
      fail(checks, `system:${system.systemId}:authorityLevel`, `invalid authorityLevel ${system.authorityLevel}`);
    }
    if (!ALLOWED_WRITE_LEVELS.has(system.allowedWrites)) {
      fail(checks, `system:${system.systemId}:allowedWrites`, `invalid allowedWrites ${system.allowedWrites}`);
    }
  }

  const mediaProduction = requireSystem(checks, systems, "media_production");
  if (mediaProduction) {
    if (mediaProduction.authorityLevel === "authoritative" && mediaProduction.ownerRoute?.includes("/admin/media")) {
      pass(checks, "media:authority", "/admin/media/* is marked authoritative for the future media pipeline");
    } else {
      fail(checks, "media:authority", "media_production must be authoritative and own /admin/media/*");
    }
    if (mediaProduction.replacementPolicy === "do_not_duplicate") {
      pass(checks, "media:duplication-lock", "media production is locked against duplicate generator paths");
    } else {
      fail(checks, "media:duplication-lock", "media_production replacementPolicy must be do_not_duplicate");
    }
  }

  const legacyGenerator = requireSystem(checks, systems, "legacy_generator_routes");
  if (legacyGenerator) {
    if (["legacy_gated", "deprecated_candidate"].includes(legacyGenerator.authorityLevel)) {
      pass(checks, "legacy-generator:not-authoritative", "legacy generator routes are not authoritative");
    } else {
      fail(checks, "legacy-generator:not-authoritative", "legacy generator routes must be legacy_gated or deprecated_candidate");
    }
    if (legacyGenerator.replacementPolicy === "legacy_do_not_expand") {
      pass(checks, "legacy-generator:do-not-expand", "legacy generator routes are marked do-not-expand");
    } else {
      fail(checks, "legacy-generator:do-not-expand", "legacy generator routes must use legacy_do_not_expand");
    }
  }

  const stagingProductionConflicts = systems.filter((system) =>
    (system.stagingOnly === true || system.stagingBypassAllowed === true)
    && system.productionAllowed === true
    && !["source_still_ingest", "asset_ingest", "motion_pack_plan", "sequence_compose_plan", "source_reference_plan"].includes(system.systemId)
  );
  if (stagingProductionConflicts.length === 0) {
    pass(checks, "staging-bypass:production-denied", "no provider/execution staging bypass system is productionAllowed=true");
  } else {
    fail(checks, "staging-bypass:production-denied", `unexpected productionAllowed staging bypass systems: ${stagingProductionConflicts.map((s) => s.systemId).join(", ")}`);
  }

  const explicitActiveWriters = new Set(registry.explicitActiveWriteSystemIds || []);
  const activeWriters = systems.filter((system) => system.allowedWrites === "active_only_with_promotion");
  const unexpectedActiveWriters = activeWriters.filter((system) => !explicitActiveWriters.has(system.systemId));
  if (unexpectedActiveWriters.length === 0) {
    pass(checks, "active-writes:explicit-only", "ACTIVE writes are limited to explicit future promotion systems");
  } else {
    fail(checks, "active-writes:explicit-only", `unexpected ACTIVE writers: ${unexpectedActiveWriters.map((s) => s.systemId).join(", ")}`);
  }

  const allowedProviderSystems = new Set(registry.allowedProviderCallSystemIds || []);
  const providerSystems = systems.filter((system) => system.providerCallAllowed === true);
  const unexpectedProviderSystems = providerSystems.filter((system) => !allowedProviderSystems.has(system.systemId));
  if (unexpectedProviderSystems.length === 0) {
    pass(checks, "provider-calls:known-only", "providerCallAllowed=true appears only on registered Runway provider/status systems");
  } else {
    fail(checks, "provider-calls:known-only", `unexpected provider call systems: ${unexpectedProviderSystems.map((s) => s.systemId).join(", ")}`);
  }

  const premium = requireSystem(checks, systems, "premium_generation_readiness");
  if (registry.premiumGenerationEnabled === false && premium?.premiumGenerationEnabled === false) {
    pass(checks, "premium-generation:disabled", "premium self-generation remains disabled");
  } else {
    fail(checks, "premium-generation:disabled", "premium_generation_readiness must remain disabled");
  }

  const sourceStill = requireSystem(checks, systems, "source_still_ingest");
  if (sourceStill?.allowedWrites === "approved_only" && sourceStill.providerCallAllowed === false) {
    pass(checks, "source-still-ingest:approved-only", "source still ingest remains approved-only with no provider calls");
  } else {
    fail(checks, "source-still-ingest:approved-only", "source still ingest must be approved_only and providerCallAllowed=false");
  }

  const assetIngest = requireSystem(checks, systems, "asset_ingest");
  if (assetIngest?.allowedWrites === "approved_only" && assetIngest.providerCallAllowed === false) {
    pass(checks, "asset-ingest:approved-only", "asset ingest remains approved-only with no provider calls");
  } else {
    fail(checks, "asset-ingest:approved-only", "asset ingest must be approved_only and providerCallAllowed=false");
  }

  const sequenceExecute = requireSystem(checks, systems, "sequence_compose_execute");
  if (sequenceExecute?.plannedOnly === true && sequenceExecute.productionAllowed === false && sequenceExecute.providerCallAllowed === false) {
    pass(checks, "sequence-compose-execute:planned-only", "sequence-compose-execute remains planned-only until writer approval");
  } else {
    fail(checks, "sequence-compose-execute:planned-only", "sequence-compose-execute must remain plannedOnly, non-production, and no provider call");
  }

  const failCount = checks.filter((check) => !check.ok).length;
  const passCount = checks.filter((check) => check.ok).length;
  printJson({
    ok: failCount === 0,
    mode: "read-only",
    registryPath: "SPIRITCORE_SYSTEM_AUTHORITY_REGISTRY.json",
    checks,
    summary: {
      passCount,
      failCount,
      systemCount: systems.length,
    },
  });
  process.exitCode = failCount === 0 ? 0 : 1;
}

main().catch((error) => {
  printJson({
    ok: false,
    mode: "read-only",
    error: error?.message || String(error),
  });
  process.exitCode = 1;
});
