# BlastRadius

**When an npm package is compromised, how fast can you map the damage?**

BlastRadius computes the complete transitive blast radius of any npm package in seconds — every direct dependent, every transitive dependent, every shared maintainer, every typosquat candidate — using [HydraDB](https://github.com/hydra-db/hydradb)'s graph-native traversal engine.

This is a graph traversal problem. The question a vector database cannot answer.

> In May 2026, the TanStack compromise hit 160+ packages in 6 minutes. By the time anyone asked "what's affected?" — it was already everywhere. BlastRadius answers that question in one query.

---

## How it works

Type a compromised package name → BlastRadius executes a transitive reverse dependency closure on HydraDB → the graph explodes outward hop by hop, showing every affected package in real time.

[Demo video — to be added]

### The money shot

The graph doesn't just show the blast radius — it **performs** it:

1. **Cypher query overlay** — the actual `algo.SSpaths` query appears on screen before execution
2. **Hop-by-hop propagation** — nodes appear ring by ring, each ring = one more hop of dependency depth
3. **Live counter** — affected package count ticks up in real time, with an elapsed timer

Other tools show a snapshot. BlastRadius shows the explosion.

---

## Features

### 1. Blast Radius Visualization

Interactive radial graph showing every package affected by a compromise:

- Source package at center, glowing and pulsing
- Direct dependents in the first ring, transitive dependents in outer rings
- Color-coded by distance: red (source) → orange (1 hop) → yellow (2 hops) → green (3+ hops)
- Animated particles flow along edges showing dependency direction
- Faint concentric guide rings echo the "blast radius" concept
- Click any node to see its distance, description, and dependency chain

**Query:** HydraDB's `algo.SSpaths` traverses incoming `DEPENDS_ON` edges up to 10 hops.

### 2. Shared Maintainer Risk

If a maintainer of the compromised package also maintains other packages, those are at risk too. One compromised person becomes a multi-package attack surface.

**Query:** `MATCH (p:Package)-[:MAINTAINED_BY]->(m:Maintainer)<-[:MAINTAINED_BY]-(other:Package)` — traverses the maintainer graph to find all packages sharing maintainers with the source.

### 3. Typosquat Detection

Finds packages with names similar to the compromised package — the attack you didn't see coming. Catches `left_pad`, `leftpad`, `lodas` and ranks them by edit distance.

**Query:** Prefix matching (`STARTS WITH`) and Levenshtein edit distance across all package names in the graph.

---

## Architecture

```
npm registry API
       │
       ▼
   Seed script (scripts/seed.ts)
   Fetches 222 real packages + dependencies + maintainers
       │
       ▼
   HydraDB OSS (Docker, localhost:8443)
   ┌──────────────────────────────────┐
   │  Graph engine (OpenCypher)        │
   │  • algo.SSpaths (blast radius)    │
   │  • MATCH traversal (maintainers)  │
   │  • STARTS WITH (typosquat)        │
   └──────────────────────────────────┘
       │
       ▼
   Next.js API routes
   /api/blast-radius · /api/shared-maintainers
   /api/typosquat · /api/search
       │
       ▼
   React UI (react-force-graph-2d)
   Radial graph + live propagation
```

### Graph schema

```
(:Package {name, description, version, deprecated, downloads})
(:Maintainer {name, email})

(:Package)-[:DEPENDS_ON {version_range, type}]->(:Package)
(:Package)-[:MAINTAINED_BY]->(:Maintainer)
```

### Why HydraDB?

The blast radius query is a **transitive closure** — "find every package that depends on this one, directly or indirectly, up to 10 hops." This requires variable-length path queries over a dependency graph.

HydraDB's native path procedure `algo.SSpaths` with `relDirection: 'incoming'` computes this in a single query, returning full paths (not just endpoints). This is the graph-native approach that vector databases and document stores cannot do efficiently.

Remove HydraDB and the product doesn't work. The graph traversal IS the product.

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (for HydraDB)
- Node.js 20+ and npm

### Setup

```bash
# 1. Start HydraDB
docker compose up -d

# 2. Install dependencies
npm install

# 3. Seed the database (fetches 222 npm packages + their dependency graphs)
npx tsx scripts/seed.ts

# 4. Run the app
npm run dev
```

Open http://localhost:3000

### Try these packages

| Package | Affected | Depth | Notes |
|---|---|---|---|
| `es-errors` | 27 | 4 | Full transitive chain |
| `chalk` | 19 | 2 | Popular, wide impact |
| `debug` | 9 | 2 | Deep chain |
| `accepts` | — | — | 30+ shared maintainers |
| `left-pad` | — | — | Typosquat candidates: `left_pad`, `leftpad` |

---

## The blast radius query

```cypher
CALL algo.SSpaths({
  sourceNode: $pkgId,
  relTypes: ['DEPENDS_ON'],
  relDirection: 'incoming',
  maxLen: 10,
  pathCount: 200
}) YIELD path RETURN path
```

This traverses incoming `DEPENDS_ON` edges from the compromised package, finding every package that depends on it directly or transitively (up to 10 hops). Each path returned contains the full chain of nodes and relationships, which the API parses into a graph structure for visualization.

---

## Tech Stack

- **HydraDB OSS** — graph database engine (self-hosted via Docker, OpenCypher, path procedures)
- **Next.js 16.3.1** — full-stack framework (App Router, Turbopack)
- **TypeScript 5.9.3** — type safety
- **Tailwind CSS 4.3.3** — styling
- **react-force-graph-2d** — canvas-based graph visualization
- **GSAP** — scroll and transition animations
- **lucide-react** — icons
- **npm registry API** — real package metadata and dependency data

---

## Links

- **Live demo:** https://blastradiusv1.vercel.app/ (requires local HydraDB — see Setup)
- **Source code:** https://github.com/DruxAMB/blastradius
- **HydraDB:** https://github.com/hydra-db/hydradb

---

## License

MIT — see [LICENSE](LICENSE)

## Attribution

- [HydraDB](https://github.com/hydra-db/hydradb) — graph database engine (OpenCypher, path procedures)
- [Next.js](https://nextjs.org) — React framework
- [react-force-graph-2d](https://github.com/vasturiano/react-force-graph-2d) — graph visualization
- [Tailwind CSS](https://tailwindcss.com) — styling
- [GSAP](https://gsap.com) — animations
- [lucide-react](https://lucide.dev) — icons
- [npm registry API](https://registry.npmjs.org) — package metadata and dependency data
