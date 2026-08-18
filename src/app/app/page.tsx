"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, AlertTriangle, Users, Type, Loader2, Zap, Shield, GitBranch, ExternalLink } from "lucide-react";
import dynamic from "next/dynamic";

// react-force-graph-2d is canvas-based and must be dynamically imported (no SSR)
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-zinc-500">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  ),
});

interface BlastNode {
  id: number;
  name: string;
  distance: number;
  description: string;
}

interface BlastLink {
  source: number;
  target: number;
}

interface BlastRadiusResult {
  package: string;
  packageId: number;
  description: string;
  nodes: BlastNode[];
  links: BlastLink[];
  summary: {
    totalPackages: number;
    directDependents: number;
    transitiveDependents: number;
    maxDepth: number;
    deprecated: boolean;
  };
}

interface SharedMaintainer {
  name: string;
  id: number;
  packages: { name: string; id: number }[];
}

interface TyposquatCandidate {
  name: string;
  id: number;
  editDistance: number;
  lengthDiff: number;
  suspicious: boolean;
}

type Tab = "blast" | "maintainers" | "typosquat";

// Color by distance from compromised package
const DISTANCE_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e"];

function colorForDistance(d: number): string {
  if (d === 0) return "#ef4444"; // red for compromised package
  return DISTANCE_COLORS[Math.min(d, DISTANCE_COLORS.length - 1)];
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{ name: string; id: number; description: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blastResult, setBlastResult] = useState<BlastRadiusResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("blast");
  const [selectedNode, setSelectedNode] = useState<BlastNode | null>(null);
  const [maintainers, setMaintainers] = useState<SharedMaintainer[]>([]);
  const [typosquats, setTyposquats] = useState<TyposquatCandidate[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const graphRef = useRef<{ centerAt: (x: number, y: number, ms: number) => void; zoom: (z: number, ms: number) => void } | undefined>(undefined);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 600 });
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Responsive graph sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (graphContainerRef.current) {
        const rect = graphContainerRef.current.getBoundingClientRect();
        setGraphDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Debounced search for autocomplete
  const handleSearchChange = useCallback((value: string) => {
    setQuery(value);
    setShowSuggestions(true);
    setSelectedNode(null);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSuggestions(data.packages ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 150);
  }, []);

  const calculateBlastRadius = useCallback(async (packageName?: string) => {
    const name = packageName ?? query.trim();
    if (!name) return;

    setLoading(true);
    setError(null);
    setShowSuggestions(false);
    setSelectedNode(null);
    setActiveTab("blast");

    try {
      const res = await fetch(`/api/blast-radius?package=${encodeURIComponent(name)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to compute blast radius");
        setBlastResult(null);
      } else {
        setBlastResult(data);
        // Center the graph after it renders
        setTimeout(() => {
          if (graphRef.current) {
            graphRef.current.zoom(1.5, 300);
          }
        }, 100);
      }
    } catch {
      setError("Failed to connect to HydraDB. Is the Docker container running?");
      setBlastResult(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Load tab data when tab changes
  useEffect(() => {
    if (!blastResult) return;
    if (activeTab === "maintainers" && maintainers.length === 0) {
      setTabLoading(true);
      fetch(`/api/shared-maintainers?package=${encodeURIComponent(blastResult.package)}`)
        .then((r) => r.json())
        .then((data) => setMaintainers(data.maintainers ?? []))
        .catch(() => setMaintainers([]))
        .finally(() => setTabLoading(false));
    } else if (activeTab === "typosquat" && typosquats.length === 0) {
      setTabLoading(true);
      fetch(`/api/typosquat?package=${encodeURIComponent(blastResult.package)}`)
        .then((r) => r.json())
        .then((data) => setTyposquats(data.candidates ?? []))
        .catch(() => setTyposquats([]))
        .finally(() => setTabLoading(false));
    }
  }, [activeTab, blastResult, maintainers.length, typosquats.length]);

  // Reset tab data when package changes
  useEffect(() => {
    setMaintainers([]);
    setTyposquats([]);
  }, [blastResult?.package]);

  // Prepare graph data for react-force-graph-2d
  const graphData = blastResult
    ? {
        nodes: blastResult.nodes.map((n) => ({
          id: n.id,
          name: n.name,
          distance: n.distance,
          description: n.description,
          color: colorForDistance(n.distance),
          val: n.distance === 0 ? 3 : Math.max(1, 3 - n.distance * 0.3),
        })),
        links: blastResult.links.map((l) => ({
          source: l.source,
          target: l.target,
          color: "#3f3f46",
        })),
      }
    : { nodes: [], links: [] };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" fill="white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">BlastRadius</h1>
              <p className="text-xs text-zinc-500 -mt-0.5">Supply chain blast radius, powered by HydraDB</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <GitBranch className="w-3.5 h-3.5" />
            npm dependency graph
          </span>
          <a
            href="https://github.com/hydra-db/hydradb"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-zinc-300 transition-colors"
          >
            HydraDB OSS
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* Search bar */}
      <div className="relative px-6 py-4 border-b border-zinc-800 bg-zinc-900/30">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && calculateBlastRadius()}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Enter a compromised package name..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-colors"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onMouseDown={() => {
                      setQuery(s.name);
                      calculateBlastRadius(s.name);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-zinc-700 transition-colors border-b border-zinc-700/50 last:border-0"
                  >
                    <div className="text-sm font-medium text-zinc-100">{s.name}</div>
                    {s.description && (
                      <div className="text-xs text-zinc-500 truncate">{s.description}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => calculateBlastRadius()}
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-red-500/20"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Computing...
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                Calculate Blast Radius
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-6 py-3 bg-red-950/50 border-b border-red-900/50">
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-sm text-red-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph canvas */}
        <div
          ref={graphContainerRef}
          className="flex-1 relative bg-zinc-950"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(63, 63, 70, 0.3) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        >
          {!blastResult && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
              <Shield className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium text-zinc-500">Search for a package to visualize its blast radius</p>
              <p className="text-sm text-zinc-600 mt-1">Try: es-errors, chalk, debug, accepts, mime-db</p>
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/80 z-10">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-sm">Traversing the dependency graph...</p>
              <p className="text-xs text-zinc-600 mt-1">Running Cypher path procedure on HydraDB</p>
            </div>
          )}
          {blastResult && (
            <>
              {/* Summary bar */}
              <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-4 px-4 py-2.5 bg-zinc-900/80 backdrop-blur rounded-lg border border-zinc-800 text-sm">
                <span className="font-medium text-red-400">{blastResult.package}</span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-300">
                  <span className="font-bold text-white">{blastResult.summary.totalPackages}</span> packages affected
                </span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-300">
                  <span className="font-bold text-orange-400">{blastResult.summary.directDependents}</span> direct
                </span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-300">
                  <span className="font-bold text-yellow-400">{blastResult.summary.transitiveDependents}</span> transitive
                </span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-300">
                  max depth: <span className="font-bold text-white">{blastResult.summary.maxDepth}</span>
                </span>
                {blastResult.summary.deprecated && (
                  <span className="px-2 py-0.5 bg-red-950 text-red-400 rounded text-xs font-medium border border-red-900">
                    DEPRECATED
                  </span>
                )}
              </div>

              {/* Force graph */}
              <ForceGraph2D
                ref={graphRef as never}
                graphData={graphData}
                nodeLabel="name"
                nodeColor="color"
                nodeVal="val"
                nodeRelSize={6}
                linkColor="color"
                linkDirectionalArrowColor="color"
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={1}
                onNodeClick={(node: Record<string, unknown>) => {
                  setSelectedNode({
                    id: node.id as number,
                    name: node.name as string,
                    distance: node.distance as number,
                    description: (node.description as string) ?? "",
                  });
                }}
                nodeCanvasObject={(node: Record<string, unknown>, ctx: CanvasRenderingContext2D, globalScale: number) => {
                  const x = node.x as number;
                  const y = node.y as number;
                  const color = node.color as string;
                  const name = node.name as string;
                  const distance = node.distance as number;
                  const val = node.val as number;

                  // Draw node circle
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(x, y, 5 + (val - 1) * 2, 0, 2 * Math.PI);
                  ctx.fill();

                  // Draw glow for source node
                  if (distance === 0) {
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 15;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                  }

                  // Draw label (only when zoomed in enough)
                  if (globalScale > 1.5) {
                    ctx.font = `${10 / globalScale}px sans-serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = "#e4e4e7";
                    ctx.fillText(name, x, y + 12 / globalScale);
                  }
                }}
                cooldownTicks={100}
                width={graphDimensions.width}
                height={graphDimensions.height}
              />

              {/* Legend */}
              <div className="absolute bottom-4 left-4 px-4 py-2 bg-zinc-900/80 backdrop-blur rounded-lg border border-zinc-800 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500">Distance:</span>
                  {[0, 1, 2, 3].map((d) => (
                    <span key={d} className="flex items-center gap-1">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ background: colorForDistance(d) }}
                      />
                      <span className="text-zinc-400">{d === 0 ? "source" : `${d} hop${d > 1 ? "s" : ""}`}</span>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Side panel */}
        <div className="w-96 border-l border-zinc-800 bg-zinc-900/50 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-zinc-800">
            <TabButton active={activeTab === "blast"} onClick={() => setActiveTab("blast")} icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Blast Radius" />
            <TabButton active={activeTab === "maintainers"} onClick={() => setActiveTab("maintainers")} icon={<Users className="w-3.5 h-3.5" />} label="Maintainers" />
            <TabButton active={activeTab === "typosquat"} onClick={() => setActiveTab("typosquat")} icon={<Type className="w-3.5 h-3.5" />} label="Typosquat" />
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "blast" && (
              <BlastTab selectedNode={selectedNode} blastResult={blastResult} />
            )}
            {activeTab === "maintainers" && (
              <MaintainersTab maintainers={maintainers} loading={tabLoading} packageName={blastResult?.package} />
            )}
            {activeTab === "typosquat" && (
              <TyposquatTab candidates={typosquats} loading={tabLoading} packageName={blastResult?.package} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 ${
        active
          ? "text-zinc-100 border-red-500 bg-zinc-800/50"
          : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800/30"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function BlastTab({ selectedNode, blastResult }: { selectedNode: BlastNode | null; blastResult: BlastRadiusResult | null }) {
  if (!blastResult) {
    return <div className="text-zinc-600 text-sm text-center mt-8">No blast radius computed yet</div>;
  }

  if (selectedNode) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: colorForDistance(selectedNode.distance) }}
          />
          <h3 className="text-sm font-bold text-zinc-100">{selectedNode.name}</h3>
        </div>
        {selectedNode.description && (
          <p className="text-xs text-zinc-400">{selectedNode.description}</p>
        )}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Distance from source</span>
            <span className="font-medium text-zinc-200">
              {selectedNode.distance === 0 ? "Source (compromised)" : `${selectedNode.distance} hop${selectedNode.distance > 1 ? "s" : ""}`}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Package ID</span>
            <span className="font-mono text-zinc-400">{selectedNode.id}</span>
          </div>
        </div>
        {selectedNode.distance > 0 && (
          <div className="pt-2 px-3 py-2 bg-orange-950/30 border border-orange-900/30 rounded text-xs text-orange-300">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            This package is {selectedNode.distance} hop{selectedNode.distance > 1 ? "s" : ""} away from the compromised package.
          </div>
        )}
      </div>
    );
  }

  // Default: show blast radius summary
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-zinc-100 mb-1">Blast Radius Analysis</h3>
        <p className="text-xs text-zinc-500">Click a node in the graph to see details</p>
      </div>
      <div className="space-y-2">
        <StatRow label="Compromised package" value={blastResult.package} highlight />
        <StatRow label="Total packages affected" value={blastResult.summary.totalPackages.toString()} />
        <StatRow label="Direct dependents" value={blastResult.summary.directDependents.toString()} />
        <StatRow label="Transitive dependents" value={blastResult.summary.transitiveDependents.toString()} />
        <StatRow label="Max dependency depth" value={blastResult.summary.maxDepth.toString()} />
      </div>
      {blastResult.description && (
        <div className="pt-2">
          <p className="text-xs text-zinc-500 mb-1">Description</p>
          <p className="text-xs text-zinc-400">{blastResult.description}</p>
        </div>
      )}
      <div className="pt-2 px-3 py-2 bg-zinc-800/50 rounded text-xs text-zinc-400">
        <p className="font-medium text-zinc-300 mb-1">How this works</p>
        <p>The blast radius is computed by HydraDB&apos;s native path procedure <code className="text-orange-400">algo.SSpaths</code> traversing incoming <code className="text-orange-400">DEPENDS_ON</code> edges. This is a graph traversal — the question a vector database cannot answer.</p>
      </div>
    </div>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className={`font-medium ${highlight ? "text-red-400" : "text-zinc-200"}`}>{value}</span>
    </div>
  );
}

function MaintainersTab({ maintainers, loading, packageName }: { maintainers: SharedMaintainer[]; loading: boolean; packageName?: string }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center text-zinc-500 text-sm mt-8">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Finding shared maintainers...
      </div>
    );
  }

  if (!packageName) {
    return <div className="text-zinc-600 text-sm text-center mt-8">Search for a package first</div>;
  }

  if (maintainers.length === 0) {
    return (
      <div className="text-zinc-600 text-sm text-center mt-8">
        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
        No shared maintainers found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-zinc-100 mb-1">Shared Maintainer Risk</h3>
        <p className="text-xs text-zinc-500">
          If a maintainer of <span className="text-zinc-300">{packageName}</span> is compromised, these packages are also at risk.
        </p>
      </div>
      {maintainers.map((m) => (
        <div key={m.id} className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-zinc-100">{m.name}</span>
            <span className="px-2 py-0.5 bg-orange-950/50 text-orange-400 rounded text-xs font-medium">
              {m.packages.length} package{m.packages.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-1">
            {m.packages.map((p) => (
              <div key={p.id} className="text-xs text-zinc-400 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-zinc-600" />
                {p.name}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TyposquatTab({ candidates, loading, packageName }: { candidates: TyposquatCandidate[]; loading: boolean; packageName?: string }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center text-zinc-500 text-sm mt-8">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Scanning for typosquats...
      </div>
    );
  }

  if (!packageName) {
    return <div className="text-zinc-600 text-sm text-center mt-8">Search for a package first</div>;
  }

  if (candidates.length === 0) {
    return (
      <div className="text-zinc-600 text-sm text-center mt-8">
        <Type className="w-8 h-8 mx-auto mb-2 opacity-30" />
        No typosquat candidates found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-zinc-100 mb-1">Typosquat Detection</h3>
        <p className="text-xs text-zinc-500">
          Packages with names similar to <span className="text-zinc-300">{packageName}</span>. These could be typosquat attempts.
        </p>
      </div>
      {candidates.map((c) => (
        <div
          key={c.id}
          className={`p-3 rounded-lg border ${
            c.suspicious
              ? "bg-red-950/30 border-red-900/50"
              : "bg-zinc-800/50 border-zinc-800"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-zinc-100">{c.name}</span>
            {c.suspicious && (
              <span className="px-2 py-0.5 bg-red-950 text-red-400 rounded text-xs font-medium border border-red-900">
                SUSPICIOUS
              </span>
            )}
          </div>
          <div className="flex gap-4 text-xs text-zinc-500">
            <span>Edit distance: <span className="text-zinc-300">{c.editDistance}</span></span>
            <span>Length diff: <span className="text-zinc-300">{c.lengthDiff}</span></span>
          </div>
        </div>
      ))}
    </div>
  );
}
