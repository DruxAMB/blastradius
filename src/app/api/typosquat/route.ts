import { NextRequest } from "next/server";
import { cypher, propValue } from "@/lib/hydradb";

/**
 * GET /api/typosquat?package=<name>
 *
 * Finds potential typosquat packages by name similarity.
 * Uses STARTS WITH for prefix matching and also checks for common typosquat patterns.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const packageName = searchParams.get("package") ?? "";

  if (!packageName) {
    return Response.json({ error: "Package name required" }, { status: 400 });
  }

  try {
    // Get the first 3 characters as prefix for broad matching
    const prefix = packageName.substring(0, Math.min(3, packageName.length));

    // Search for packages with similar prefixes
    const result = await cypher(
      "MATCH (p:Package) WHERE p.name STARTS WITH $prefix RETURN p.name AS name, p.id AS id ORDER BY p.name LIMIT 50",
      { prefix },
    );

    const allPackages = result.rows.map((row) => ({
      name: propValue(row[0] as { String?: string }) as string,
      id: propValue(row[1] as { Integer?: number }) as number,
    }));

    // Compute edit distance (Levenshtein) and filter
    const candidates = allPackages
      .filter((p) => p.name !== packageName)
      .map((p) => ({
        ...p,
        editDistance: levenshtein(packageName, p.name),
        lengthDiff: Math.abs(p.name.length - packageName.length),
      }))
      .filter((p) => p.editDistance <= Math.max(3, Math.floor(packageName.length / 3)))
      .sort((a, b) => a.editDistance - b.editDistance)
      .slice(0, 15);

    // Flag suspicious ones
    const flagged = candidates.map((p) => ({
      ...p,
      suspicious: p.editDistance <= 2 && p.lengthDiff <= 2,
    }));

    return Response.json({
      package: packageName,
      candidates: flagged,
      total: flagged.length,
    });
  } catch (err) {
    console.error("Typosquat error:", err);
    return Response.json(
      { error: "Failed to find typosquat candidates" },
      { status: 500 },
    );
  }
}

/** Levenshtein edit distance. */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
