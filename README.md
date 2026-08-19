# BlastRadius

**Supply chain blast radius visualizer — when an npm package is compromised, BlastRadius shows you the complete transitive blast radius in seconds.**

Built on [HydraDB](https://github.com/hydra-db/hydradb)'s graph-native engine. This is a graph traversal problem — the question a vector database cannot answer.

## What it does

When a package like `es-errors` is compromised, you need to know every package that depends on it — directly or transitively. BlastRadius computes this using HydraDB's native OpenCypher path procedure (`algo.SSpaths`), traversing incoming `DEPENDS_ON` edges to find the complete reverse dependency closure.

### Features

1. **Blast Radius Visualization** — Interactive force-directed graph showing every package affected by a compromise, color-coded by distance from the source. The graph explodes outward from the compromised package.

2. **Shared Maintainer Risk** — If a maintainer of the compromised package is also a maintainer of other packages, those packages are at risk too. This uses graph traversal: `package → MAINTAINED_BY → maintainer ← MAINTAINED_BY ← other packages`.

3. **Typosquat Detection** — Finds packages with names similar to the compromised package using prefix matching (`STARTS WITH`) and Levenshtein edit distance. Catches `left_pad`, `leftpad`, `lodas` etc.

## Architecture

```
npm registry API
       │
       ▼
   Seed script (scripts/seed.ts)
   fetches 222 packages + deps + maintainers
       │
       ▼
   HydraDB OSS (Docker)
   ┌─────────────────────────────┐
   │  Graph engine (OpenCypher)   │
   │  - algo.SSpaths (blast radius)│
   │  - MATCH traversal (maintainers)│
   │  - STARTS WITH (typosquat)   │
   └─────────────────────────────┘
       │
       ▼
   Next.js API routes
   /api/blast-radius
   /api/shared-maintainers
   /api/typosquat
   /api/search
       │
       ▼
   React UI (react-force-graph-2d)
   Dark dashboard + interactive graph
```

### Why HydraDB?

The blast radius query is a **transitive closure** — "find every package that depends on this one, directly or indirectly, up to 10 hops." This is a graph traversal problem that requires variable-length path queries.

HydraDB's native path procedure `algo.SSpaths` with `relDirection: 'incoming'` computes this in a single query, returning full paths (not just endpoints). This is the graph-native approach that a vector database or document store cannot do efficiently.

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (for HydraDB)
- Node.js 20+ and npm

### Setup

1. **Start HydraDB:**

```bash
docker compose up -d
```

2. **Install dependencies:**

```bash
npm install
```

3. **Seed the database** (fetches 222 npm packages and their dependency relationships):

```bash
npx tsx scripts/seed.ts
```

4. **Run the app:**

```bash
npm run dev
```

5. **Open http://localhost:3000**

### Try these packages

- `es-errors` — 27 packages affected, depth 4
- `chalk` — 19 packages affected, depth 2
- `debug` — 9 packages affected, depth 2
- `accepts` — shared maintainers with 30+ packages
- `left-pad` — typosquat candidates: `left_pad`, `leftpad`

## Tech Stack

- **Next.js 16.3.1** (App Router, Turbopack)
- **TypeScript 5.9.3**
- **Tailwind CSS 4.3.3**
- **HydraDB OSS** (self-hosted via Docker)
- **react-force-graph-2d** (canvas-based graph visualization)
- **lucide-react** (icons)

## How the blast radius query works

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

## License

MIT — see [LICENSE](LICENSE)

## Attribution

- [HydraDB](https://github.com/hydra-db/hydradb) — graph database engine (OpenCypher, path procedures)
- [Next.js](https://nextjs.org) — React framework
- [react-force-graph-2d](https://github.com/vasturiano/react-force-graph-2d) — graph visualization
- [Tailwind CSS](https://tailwindcss.com) — styling
- [lucide-react](https://lucide.dev) — icons
- [GSAP](https://gsap.com) — scroll animations
- [npm registry API](https://registry.npmjs.org) — package metadata and dependency data
