import { NextRequest } from "next/server";
import { cypher, propValue } from "@/lib/hydradb";

/**
 * GET /api/shared-maintainers?package=<name>
 *
 * Finds all packages that share maintainers with the given package.
 * Uses graph traversal: package -> MAINTAINED_BY -> maintainer <- MAINTAINED_BY <- other package
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const packageName = searchParams.get("package") ?? "";

  if (!packageName) {
    return Response.json({ error: "Package name required" }, { status: 400 });
  }

  try {
    // Find the package ID
    const idResult = await cypher(
      "MATCH (p:Package {name: $name}) RETURN p.id AS id",
      { name: packageName },
    );

    if (idResult.rows.length === 0) {
      return Response.json({ error: "Package not found" }, { status: 404 });
    }

    const packageId = propValue(idResult.rows[0][0] as { Integer?: number }) as number;

    // Find shared maintainers via graph traversal
    const result = await cypher(
      "MATCH (p:Package {id: $pkgId})-[:MAINTAINED_BY]->(m:Maintainer)<-[:MAINTAINED_BY]-(other:Package) WHERE other.id <> $pkgId RETURN m.name AS maintainer, m.id AS maintainerId, other.name AS packageName, other.id AS packageId ORDER BY maintainer, packageName",
      { pkgId: packageId },
    );

    // Group by maintainer
    const maintainerMap = new Map<string, { name: string; id: number; packages: { name: string; id: number }[] }>();

    for (const row of result.rows) {
      const maintainerName = propValue(row[0] as { String?: string }) as string;
      const maintainerId = propValue(row[1] as { Integer?: number }) as number;
      const pkgName = propValue(row[2] as { String?: string }) as string;
      const pkgId = propValue(row[3] as { Integer?: number }) as number;

      if (!maintainerMap.has(maintainerName)) {
        maintainerMap.set(maintainerName, { name: maintainerName, id: maintainerId, packages: [] });
      }
      maintainerMap.get(maintainerName)!.packages.push({ name: pkgName, id: pkgId });
    }

    const maintainers = Array.from(maintainerMap.values()).sort(
      (a, b) => b.packages.length - a.packages.length,
    );

    return Response.json({
      package: packageName,
      maintainers,
      totalSharedPackages: new Set(maintainers.flatMap((m) => m.packages.map((p) => p.id))).size,
    });
  } catch (err) {
    console.error("Shared maintainers error:", err);
    return Response.json(
      { error: "Failed to find shared maintainers" },
      { status: 500 },
    );
  }
}
