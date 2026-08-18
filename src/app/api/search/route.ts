import { NextRequest } from "next/server";
import { cypher, propValue } from "@/lib/hydradb";

/**
 * GET /api/search?q=<query>
 * Search for packages by name prefix (autocomplete).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q") ?? "";

  if (!q || q.length < 1) {
    return Response.json({ packages: [] });
  }

  try {
    // HydraDB supports STARTS WITH for prefix matching
    const result = await cypher(
      "MATCH (p:Package) WHERE p.name STARTS WITH $prefix RETURN p.name AS name, p.id AS id, p.description AS description ORDER BY p.name LIMIT 10",
      { prefix: q },
    );

    const packages = result.rows.map((row) => ({
      name: propValue(row[0] as { String?: string }) as string,
      id: propValue(row[1] as { Integer?: number }) as number,
      description: propValue(row[2] as { String?: string }) as string,
    }));

    return Response.json({ packages });
  } catch (err) {
    console.error("Search error:", err);
    return Response.json(
      { error: "Search failed", packages: [] },
      { status: 500 },
    );
  }
}
