/**
 * Seed script — fetches npm package data and ingests it into HydraDB.
 *
 * Usage: npx tsx scripts/seed.ts
 *
 * This script:
 * 1. Fetches package metadata from the npm registry API
 * 2. Builds a dependency graph (packages + DEPENDS_ON edges)
 * 3. Builds maintainer relationships (packages + MAINTAINED_BY edges)
 * 4. Ingests everything into HydraDB via Cypher UNWIND/MERGE
 *
 * The dataset is curated to include packages with known dependency chains
 * (e.g., left-pad → express → webpack) for a compelling blast radius demo.
 */

import { cypher } from "../src/lib/hydradb";

// --- Curated package list ---
// These packages form interesting dependency chains for the blast radius demo.
// We fetch their real metadata from the npm registry.
const SEED_PACKAGES = [
  // The infamous left-pad and its dependents
  "left-pad",
  "pad",
  "express",
  "body-parser",
  "content-disposition",
  "content-type",
  "cookie",
  "cookie-signature",
  "debug",
  "depd",
  "encodeurl",
  "escape-html",
  "etag",
  "finalhandler",
  "fresh",
  "http-errors",
  "merge-descriptors",
  "methods",
  "on-finished",
  "parseurl",
  "path-to-regexp",
  "proxy-addr",
  "qs",
  "range-parser",
  "safe-buffer",
  "send",
  "serve-static",
  "setprototypeof",
  "statuses",
  "type-is",
  "utils-merge",
  "vary",
  "accepts",
  "mime-types",
  "mime-db",
  "bytes",
  "compressible",
  "negotiator",
  "webpack",
  "loader-runner",
  "schema-utils",
  "tapable",
  "enhanced-resolve",
  "watchpack",
  "graceful-fs",
  "glob",
  "inflight",
  "inherits",
  "minimatch",
  "once",
  "wrappy",
  "path-is-absolute",
  "fs.realpath",
  "rimraf",
  "lodash",
  "lodash.merge",
  "lodash.get",
  "lodash.set",
  "lodash.debounce",
  "lodash.isequal",
  "chalk",
  "ansi-styles",
  "escape-string-regexp",
  "supports-color",
  "has-flag",
  "color-convert",
  "color-name",
  "react",
  "react-dom",
  "scheduler",
  "axios",
  "follow-redirects",
  "form-data",
  "asynckit",
  "combined-stream",
  "delayed-stream",
  "mime",
  "uuid",
  "commander",
  "dotenv",
  "typescript",
  "tslib",
  "zod",
  "next",
  // Typosquat candidates
  "left_pad",
  "leftpad",
  "left-pad-js",
  "lodahs",
  "lodas",
  "chalks",
  "axois",
  "expres",
  "reactt",
  "dotenvs",
];

interface NpmPackageMeta {
  name: string;
  description?: string;
  dependencies?: Record<string, string>;
  maintainers?: { name: string; email?: string }[];
  deprecated?: string;
  versions?: Record<string, unknown>;
  "dist-tags"?: { latest: string };
}

/** Fetch package metadata from the npm registry. */
async function fetchNpmPackage(name: string): Promise<NpmPackageMeta | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as NpmPackageMeta;
    return data;
  } catch {
    return null;
  }
}

/** Extract the latest version's dependencies from the full metadata. */
function getLatestDeps(meta: NpmPackageMeta): Record<string, string> {
  // npm registry returns all versions; we want the latest's dependencies
  const latestTag = meta["dist-tags"]?.latest;
  if (latestTag && meta.versions) {
    const latestVersion = (meta.versions as Record<string, { dependencies?: Record<string, string> }>)[latestTag];
    if (latestVersion?.dependencies) {
      return latestVersion.dependencies;
    }
  }
  // Fallback to top-level dependencies
  return meta.dependencies ?? {};
}

/** Filter dependencies to only include ones in our seed list. */
function filterToSeedDeps(
  deps: Record<string, string>,
  seedSet: Set<string>,
): string[] {
  return Object.keys(deps).filter((d) => seedSet.has(d));
}

async function main() {
  console.log("=== BlastRadius Seed Script ===");
  console.log(`Fetching metadata for ${SEED_PACKAGES.length} packages from npm...`);

  const seedSet = new Set(SEED_PACKAGES);

  // 1. Fetch all package metadata
  const packages: Map<string, NpmPackageMeta> = new Map();
  let fetched = 0;
  for (const name of SEED_PACKAGES) {
    const meta = await fetchNpmPackage(name);
    if (meta) {
      packages.set(name, meta);
      fetched++;
      process.stdout.write(`\r  Fetched ${fetched}/${SEED_PACKAGES.length}`);
    }
    // Small delay to be nice to the npm API
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log(`\n  Successfully fetched ${fetched} packages.`);

  // 2. Assign integer IDs to packages
  const packageIds = new Map<string, number>();
  let nextId = 1;
  for (const name of packages.keys()) {
    packageIds.set(name, nextId++);
  }

  // 3. Collect maintainers and assign IDs
  const maintainerIds = new Map<string, number>();
  let nextMaintainerId = 10000;
  const packageMaintainers: Map<string, string[]> = new Map();

  for (const [name, meta] of packages) {
    const maintainers = meta.maintainers?.map((m) => m.name) ?? [];
    packageMaintainers.set(name, maintainers);
    for (const m of maintainers) {
      if (!maintainerIds.has(m)) {
        maintainerIds.set(m, nextMaintainerId++);
      }
    }
  }

  console.log(`  Found ${maintainerIds.size} unique maintainers.`);

  // 4. Build dependency edges (only between seed packages)
  const depEdges: { from: number; to: number; fromName: string; toName: string }[] = [];
  for (const [name, meta] of packages) {
    const deps = getLatestDeps(meta);
    const seedDeps = filterToSeedDeps(deps, seedSet);
    for (const dep of seedDeps) {
      const fromId = packageIds.get(name)!;
      const toId = packageIds.get(dep)!;
      if (fromId !== toId) {
        depEdges.push({ from: fromId, to: toId, fromName: name, toName: dep });
      }
    }
  }
  console.log(`  Found ${depEdges.length} dependency edges between seed packages.`);

  // 5. Ingest into HydraDB
  console.log("\nIngesting into HydraDB...");

  // 5a. Ingest package nodes via UNWIND
  const packageRows = Array.from(packages.entries()).map(([name, meta]) => ({
    id: packageIds.get(name)!,
    name,
    description: meta.description ?? "",
    deprecated: meta.deprecated ? "true" : "false",
  }));

  // Batch in groups of 50
  for (let i = 0; i < packageRows.length; i += 50) {
    const batch = packageRows.slice(i, i + 50);
    await cypher(
      "UNWIND $rows AS row MERGE (n {id: row.id}) SET n:Package, n.name = row.name, n.description = row.description, n.deprecated = row.deprecated",
      { rows: batch },
    );
    process.stdout.write(`\r  Packages: ${Math.min(i + 50, packageRows.length)}/${packageRows.length}`);
  }
  console.log(" ✓");

  // 5b. Ingest maintainer nodes via UNWIND
  const maintainerRows = Array.from(maintainerIds.entries()).map(([name, id]) => ({
    id,
    name,
  }));

  for (let i = 0; i < maintainerRows.length; i += 50) {
    const batch = maintainerRows.slice(i, i + 50);
    await cypher(
      "UNWIND $rows AS row MERGE (n {id: row.id}) SET n:Maintainer, n.name = row.name",
      { rows: batch },
    );
  }
  console.log(`  Maintainers: ${maintainerRows.length} ✓`);

  // 5c. Ingest DEPENDS_ON edges via UNWIND (edges need their own integer IDs)
  let nextEdgeId = 100000;
  const depRows = depEdges.map((e) => ({
    source: e.from,
    target: e.to,
    edgeId: nextEdgeId++,
  }));

  for (let i = 0; i < depRows.length; i += 50) {
    const batch = depRows.slice(i, i + 50);
    await cypher(
      "UNWIND $rows AS row MATCH (s:Package {id: row.source}), (d:Package {id: row.target}) MERGE (s)-[r:DEPENDS_ON {id: row.edgeId}]->(d)",
      { rows: batch },
    );
  }
  console.log(`  Dependency edges: ${depRows.length} ✓`);

  // 5d. Ingest MAINTAINED_BY edges via UNWIND
  const maintainerEdgeRows: { source: number; target: number; edgeId: number }[] = [];
  for (const [pkgName, maintainers] of packageMaintainers) {
    const pkgId = packageIds.get(pkgName)!;
    for (const m of maintainers) {
      const mId = maintainerIds.get(m);
      if (mId) {
        maintainerEdgeRows.push({ source: pkgId, target: mId, edgeId: nextEdgeId++ });
      }
    }
  }

  for (let i = 0; i < maintainerEdgeRows.length; i += 50) {
    const batch = maintainerEdgeRows.slice(i, i + 50);
    await cypher(
      "UNWIND $rows AS row MATCH (p:Package {id: row.source}), (m:Maintainer {id: row.target}) MERGE (p)-[r:MAINTAINED_BY {id: row.edgeId}]->(m)",
      { rows: batch },
    );
  }
  console.log(`  Maintainer edges: ${maintainerEdgeRows.length} ✓`);

  // 6. Summary
  console.log("\n=== Seed Complete ===");
  console.log(`  Packages: ${packages.size}`);
  console.log(`  Maintainers: ${maintainerIds.size}`);
  console.log(`  Dependency edges: ${depEdges.length}`);
  console.log(`  Maintainer edges: ${maintainerEdgeRows.length}`);

  // Print some interesting blast radius candidates
  console.log("\n  Blast radius candidates (packages with most reverse deps):");
  const reverseDepCount = new Map<number, number>();
  for (const e of depEdges) {
    reverseDepCount.set(e.to, (reverseDepCount.get(e.to) ?? 0) + 1);
  }
  const sorted = Array.from(reverseDepCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [id, count] of sorted) {
    const name = Array.from(packageIds.entries()).find(([_, i]) => i === id)?.[0];
    console.log(`    ${name}: ${count} direct dependents`);
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
