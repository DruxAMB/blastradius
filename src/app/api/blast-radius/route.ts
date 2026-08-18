import { NextRequest } from "next/server";
import { cypher, propValue, type HydraPath } from "@/lib/hydradb";

/**
 * GET /api/blast-radius?package=<name>
 *
 * Computes the transitive reverse dependency closure (blast radius) of a package
 * using HydraDB's native path procedure algo.SSpaths with incoming direction.
 *
 * Returns:
 * - nodes: all packages in the blast radius, with their distance from the source
 * - links: dependency edges between them
 * - summary: counts of affected packages, max depth, etc.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const packageName = searchParams.get("package") ?? "";

  if (!packageName) {
    return Response.json({ error: "Package name required" }, { status: 400 });
  }

  try {
    // 1. Find the package node ID by name
    const idResult = await cypher(
      "MATCH (p:Package {name: $name}) RETURN p.id AS id, p.description AS description, p.deprecated AS deprecated",
      { name: packageName },
    );

    if (idResult.rows.length === 0) {
      return Response.json({ error: "Package not found" }, { status: 404 });
    }

    const packageId = propValue(idResult.rows[0][0] as { Integer?: number }) as number;
    const description = propValue(idResult.rows[0][1] as { String?: string }) as string;
    const deprecated = propValue(idResult.rows[0][2] as { String?: string }) as string;

    // 2. Compute blast radius using path procedure (incoming DEPENDS_ON edges)
    const blastResult = await cypher(
      "CALL algo.SSpaths({sourceNode: $pkgId, relTypes: ['DEPENDS_ON'], relDirection: 'incoming', maxLen: 10}) YIELD path RETURN path",
      { pkgId: packageId },
    );

    // 3. Parse paths into nodes and links
    const nodeMap = new Map<number, { id: number; name: string; distance: number; description: string }>();
    const links: { source: number; target: number }[] = [];

    // Add the source package
    nodeMap.set(packageId, { id: packageId, name: packageName, distance: 0, description });

    for (const row of blastResult.rows) {
      const path = parsePath(row[0]);

      // Each path is: source <- [depends_on] <- dependent <- [depends_on] <- ...
      // The path nodes are [source, dependent1, dependent2, ...]
      // The path relationships connect them in reverse
      const nodes = path.nodes;
      const rels = path.relationships;

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const name = propValue(node.properties.name) as string;
        const desc = propValue(node.properties.description) as string;
        const distance = i; // distance from source = position in path

        if (!nodeMap.has(node.id)) {
          nodeMap.set(node.id, { id: node.id, name, distance, description: desc });
        } else {
          // Keep the minimum distance
          const existing = nodeMap.get(node.id)!;
          if (distance < existing.distance) {
            existing.distance = distance;
          }
        }
      }

      // Add links from relationships
      for (const rel of rels) {
        links.push({ source: rel.src, target: rel.dst });
      }
    }

    // Deduplicate links
    const linkSet = new Set<string>();
    const uniqueLinks = links.filter((l) => {
      const key = `${l.source}-${l.target}`;
      if (linkSet.has(key)) return false;
      linkSet.add(key);
      return true;
    });

    const nodes = Array.from(nodeMap.values());

    // 4. Build summary
    const summary = {
      totalPackages: nodes.length,
      directDependents: nodes.filter((n) => n.distance === 1).length,
      transitiveDependents: nodes.filter((n) => n.distance > 1).length,
      maxDepth: Math.max(...nodes.map((n) => n.distance)),
      deprecated: deprecated === "true",
    };

    return Response.json({
      package: packageName,
      packageId,
      description,
      nodes,
      links: uniqueLinks,
      summary,
    });
  } catch (err) {
    console.error("Blast radius error:", err);
    return Response.json(
      { error: "Failed to compute blast radius" },
      { status: 500 },
    );
  }
}

// Helper to parse path from row
function parsePath(rowValue: unknown): HydraPath {
  const p = rowValue as { value: { nodes: HydraPath["nodes"]; relationships: HydraPath["relationships"] } };
  return {
    nodes: p.value.nodes,
    relationships: p.value.relationships,
  };
}
