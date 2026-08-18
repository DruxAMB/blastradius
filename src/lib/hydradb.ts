/**
 * HydraDB OSS client — HTTP API wrapper for Cypher queries.
 *
 * Talks to the self-hosted HydraDB graph-node via its HTTP query endpoint.
 * The graph engine executes OpenCypher (subset) and native path procedures.
 */

const HYDRADB_URL = process.env.HYDRADB_HTTP_URL ?? "http://localhost:8443";
const HYDRADB_TOKEN =
  process.env.HYDRADB_AUTH_TOKEN ?? "local-development-token-32-bytes";
const HYDRADB_NAMESPACE = "default";
const HYDRADB_GRAPH = process.env.HYDRADB_GRAPH_ID ?? "default";
const HYDRADB_CELL = "cell-0";

export interface CypherResultRow {
  [key: string]: unknown;
}

export interface CypherResult {
  columns: string[];
  rows: unknown[][];
  bookmark: string | null;
}

export interface HydraNode {
  id: number;
  labels: string[];
  properties: Record<string, { String?: string; Integer?: number; Boolean?: boolean }>;
}

export interface HydraRelationship {
  id: number;
  edge_type: string;
  src: number;
  dst: number;
  properties: Record<string, unknown>;
}

export interface HydraPath {
  nodes: HydraNode[];
  relationships: HydraRelationship[];
}

/**
 * Execute a Cypher query against HydraDB.
 * Returns parsed columns and rows.
 */
export async function cypher(
  query: string,
  parameters?: Record<string, unknown>,
): Promise<CypherResult> {
  const body: Record<string, unknown> = {
    cell_id: HYDRADB_CELL,
    query,
  };
  if (parameters) {
    body.parameters = parameters;
  }

  const url = `${HYDRADB_URL}/v1/graphs/${HYDRADB_GRAPH}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HYDRADB_TOKEN}`,
      "X-Graph-Namespace": HYDRADB_NAMESPACE,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HydraDB HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();

  if (json.error) {
    throw new Error(`HydraDB query error: ${json.error.message}`);
  }

  return {
    columns: json.columns ?? [],
    rows: json.rows ?? [],
    bookmark: json.bookmark ?? null,
  };
}

/**
 * Extract a string property value from a HydraDB node property object.
 * HydraDB returns properties as { String: "value" } or { Integer: 123 }.
 */
export function propValue(
  prop: { String?: string; Integer?: number; Boolean?: boolean } | undefined,
): string | number | boolean | undefined {
  if (!prop) return undefined;
  if (prop.String !== undefined) return prop.String;
  if (prop.Integer !== undefined) return prop.Integer;
  if (prop.Boolean !== undefined) return prop.Boolean;
  return undefined;
}

/**
 * Parse a path value from a Cypher path procedure result.
 * The path value has { nodes: [...], relationships: [...] }.
 */
export function parsePath(pathValue: unknown): HydraPath {
  const p = pathValue as { nodes: HydraNode[]; relationships: HydraRelationship[] };
  return {
    nodes: p.nodes,
    relationships: p.relationships,
  };
}

/**
 * Check if HydraDB is reachable and responsive.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${HYDRADB_URL}/readyz`, {
      headers: { Authorization: `Bearer ${HYDRADB_TOKEN}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
