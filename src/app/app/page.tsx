"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, AlertTriangle, Users, Type, Loader2, ArrowLeft, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-[#9a9a9a]">
      <Loader2 className="w-5 h-5 animate-spin" />
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

// Dala color palette
const DISTANCE_COLORS = [
  "#8052ff", // 0 — electric iris (source/compromised)
  "#ffb829", // 1 — saffron spark
  "#15846e", // 2 — deep verdant
  "#ff6b9d", // 3 — magenta
  "#5b9eff", // 4 — blue
  "#a78bfa", // 5 — light violet
  "#fbbf24", // 6 — amber
  "#34d399", // 7 — teal
  "#8052ff", // 8
  "#ffb829", // 9
];

function colorForDistance(d: number): string {
  return DISTANCE_COLORS[Math.min(d, DISTANCE_COLORS.length - 1)];
}

export default function AppPage() {
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
  const graphRef = useRef<{ zoom: (z: number, ms: number) => void } | undefined>(undefined);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 600 });
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const updateDimensions = () => {
      if (graphContainerRef.current) {
        const rect = graphContainerRef.current.getBoundingClientRect();
        setGraphDimensions({ width: rect.width, height: rect.height });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

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
        setTimeout(() => {
          if (graphRef.current) graphRef.current.zoom(1.5, 300);
        }, 100);
      }
    } catch {
      setError("Failed to connect to HydraDB. Is the Docker container running?");
      setBlastResult(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

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

  useEffect(() => {
    setMaintainers([]);
    setTyposquats([]);
  }, [blastResult?.package]);

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
          color: "#222",
        })),
      }
    : { nodes: [], links: [] };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black text-white">
      {/* Header — minimal, transparent on black */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-[#9a9a9a] hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[14px] font-semibold tracking-[0.025em] uppercase">Back</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="2" fill="#8052ff" />
              <circle cx="10" cy="10" r="5" stroke="#8052ff" strokeWidth="1" opacity="0.6" />
              <circle cx="10" cy="10" r="8" stroke="#8052ff" strokeWidth="1" opacity="0.3" />
            </svg>
            <span className="text-[14px] font-semibold tracking-[0.025em] uppercase">BlastRadius</span>
          </div>
        </div>
        <div className="text-[12px] text-[#9a9a9a] uppercase tracking-[0.025em]">
          npm dependency graph
        </div>
      </header>

      {/* Search — no container, floating on black */}
      <div className="px-6 pb-6">
        <div className="flex gap-3 max-w-[640px] mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a9a9a]" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && calculateBlastRadius()}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Enter a compromised package name..."
              className="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-[24px] text-[15px] text-white placeholder-[#666] focus:outline-none focus:border-[#8052ff] transition-colors"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-[24px] z-50 max-h-64 overflow-y-auto overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onMouseDown={() => {
                      setQuery(s.name);
                      calculateBlastRadius(s.name);
                    }}
                    className="w-full text-left px-5 py-3 hover:bg-[#111] transition-colors"
                  >
                    <div className="text-[15px] text-white">{s.name}</div>
                    {s.description && (
                      <div className="text-[12px] text-[#9a9a9a] truncate mt-0.5">{s.description}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => calculateBlastRadius()}
            disabled={loading || !query.trim()}
            className="btn-violet disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Computing
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Blast Radius
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error — minimal text on black */}
      {error && (
        <div className="px-6 pb-4">
          <div className="max-w-[640px] mx-auto flex items-center gap-2 text-[14px] text-[#ffb829]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph canvas — pure black void */}
        <div ref={graphContainerRef} className="flex-1 relative bg-black">
          {!blastResult && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#444]">
              <p className="text-[18px] font-light text-[#666]">Search for a package to visualize its blast radius</p>
              <p className="text-[14px] text-[#444] mt-2">Try: es-errors, chalk, debug, accepts, mime-db</p>
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
              <Loader2 className="w-6 h-6 animate-spin mb-4 text-[#8052ff]" />
              <p className="text-[14px] text-[#9a9a9a]">Traversing the dependency graph...</p>
              <p className="text-[12px] text-[#555] mt-1">Running Cypher path procedure on HydraDB</p>
            </div>
          )}
          {blastResult && (
            <>
              {/* Summary — floating text, no container */}
              <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-6 text-[14px]">
                <span className="text-[#8052ff] font-semibold">{blastResult.package}</span>
                <span className="text-[#333]">·</span>
                <span className="text-[#bdbdbd]">
                  <span className="text-white font-semibold">{blastResult.summary.totalPackages}</span> affected
                </span>
                <span className="text-[#333]">·</span>
                <span className="text-[#bdbdbd]">
                  <span className="text-[#ffb829] font-semibold">{blastResult.summary.directDependents}</span> direct
                </span>
                <span className="text-[#333]">·</span>
                <span className="text-[#bdbdbd]">
                  <span className="text-white font-semibold">{blastResult.summary.transitiveDependents}</span> transitive
                </span>
                <span className="text-[#333]">·</span>
                <span className="text-[#bdbdbd]">
                  depth <span className="text-white font-semibold">{blastResult.summary.maxDepth}</span>
                </span>
                {blastResult.summary.deprecated && (
                  <span className="text-[#ffb829] text-[12px] uppercase tracking-[0.025em] font-semibold">
                    Deprecated
                  </span>
                )}
              </div>

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
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(x, y, 5 + (val - 1) * 2, 0, 2 * Math.PI);
                  ctx.fill();
                  if (distance === 0) {
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 20;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                  }
                  if (globalScale > 1.5) {
                    ctx.font = `${10 / globalScale}px Inter, sans-serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(name, x, y + 14 / globalScale);
                  }
                }}
                cooldownTicks={100}
                width={graphDimensions.width}
                height={graphDimensions.height}
              />

              {/* Legend — floating, no container */}
              <div className="absolute bottom-4 left-4 text-[12px] flex items-center gap-4">
                <span className="text-[#666] uppercase tracking-[0.025em]">Distance</span>
                {[0, 1, 2, 3].map((d) => (
                  <span key={d} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: colorForDistance(d) }} />
                    <span className="text-[#9a9a9a]">{d === 0 ? "source" : `${d} hop${d > 1 ? "s" : ""}`}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Side panel — no border, no card, floating on black */}
        <div className="w-[400px] bg-black flex flex-col overflow-hidden">
          {/* Tabs — ghost text, no container */}
          <div className="flex px-6 py-4 gap-6">
            <TabButton active={activeTab === "blast"} onClick={() => setActiveTab("blast")} label="Blast Radius" />
            <TabButton active={activeTab === "maintainers"} onClick={() => setActiveTab("maintainers")} label="Maintainers" />
            <TabButton active={activeTab === "typosquat"} onClick={() => setActiveTab("typosquat")} label="Typosquat" />
          </div>

          {/* Tab content — floating on black */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {activeTab === "blast" && <BlastTab selectedNode={selectedNode} blastResult={blastResult} />}
            {activeTab === "maintainers" && <MaintainersTab maintainers={maintainers} loading={tabLoading} packageName={blastResult?.package} />}
            {activeTab === "typosquat" && <TyposquatTab candidates={typosquats} loading={tabLoading} packageName={blastResult?.package} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-[14px] font-semibold tracking-[0.025em] uppercase transition-colors ${
        active ? "text-white" : "text-[#555] hover:text-[#9a9a9a]"
      }`}
    >
      {label}
    </button>
  );
}

function BlastTab({ selectedNode, blastResult }: { selectedNode: BlastNode | null; blastResult: BlastRadiusResult | null }) {
  if (!blastResult) {
    return <div className="text-[#444] text-[14px] mt-12 text-center font-light">No blast radius computed yet</div>;
  }

  if (selectedNode) {
    return (
      <div className="space-y-5 mt-4">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: colorForDistance(selectedNode.distance) }} />
          <h3 className="text-[27px] font-normal tracking-[-0.02em]">{selectedNode.name}</h3>
        </div>
        {selectedNode.description && (
          <p className="text-[18px] font-light text-[#bdbdbd] leading-[1.5]">{selectedNode.description}</p>
        )}
        <div className="space-y-3 pt-2">
          <div className="flex justify-between text-[14px]">
            <span className="text-[#666]">Distance from source</span>
            <span className="text-white">
              {selectedNode.distance === 0 ? "Source (compromised)" : `${selectedNode.distance} hop${selectedNode.distance > 1 ? "s" : ""}`}
            </span>
          </div>
          <div className="flex justify-between text-[14px]">
            <span className="text-[#666]">Package ID</span>
            <span className="font-mono text-[#9a9a9a]">{selectedNode.id}</span>
          </div>
        </div>
        {selectedNode.distance > 0 && (
          <p className="text-[14px] text-[#ffb829] font-light pt-2">
            This package is {selectedNode.distance} hop{selectedNode.distance > 1 ? "s" : ""} away from the compromised package.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      <div>
        <div className="text-amber-label mb-3">Analysis</div>
        <h3 className="text-[27px] font-normal tracking-[-0.02em] mb-2">Blast Radius</h3>
        <p className="text-[14px] text-[#666]">Click a node in the graph to see details</p>
      </div>
      <div className="space-y-3">
        <StatRow label="Compromised package" value={blastResult.package} accent />
        <StatRow label="Total packages affected" value={blastResult.summary.totalPackages.toString()} />
        <StatRow label="Direct dependents" value={blastResult.summary.directDependents.toString()} />
        <StatRow label="Transitive dependents" value={blastResult.summary.transitiveDependents.toString()} />
        <StatRow label="Max dependency depth" value={blastResult.summary.maxDepth.toString()} />
      </div>
      {blastResult.description && (
        <div className="pt-2">
          <div className="text-[12px] text-[#666] uppercase tracking-[0.025em] mb-2">Description</div>
          <p className="text-[18px] font-light text-[#bdbdbd] leading-[1.5]">{blastResult.description}</p>
        </div>
      )}
      <div className="pt-4">
        <div className="text-amber-label mb-2">How this works</div>
        <p className="text-[14px] font-light text-[#9a9a9a] leading-[1.6]">
          Computed by HydraDB&apos;s native path procedure <span className="text-[#8052ff]">algo.SSpaths</span> traversing
          incoming <span className="text-[#8052ff]">DEPENDS_ON</span> edges. This is a graph traversal — the question a
          vector database cannot answer.
        </p>
      </div>
    </div>
  );
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center text-[14px]">
      <span className="text-[#666]">{label}</span>
      <span className={accent ? "text-[#8052ff] font-semibold" : "text-white font-semibold"}>{value}</span>
    </div>
  );
}

function MaintainersTab({ maintainers, loading, packageName }: { maintainers: SharedMaintainer[]; loading: boolean; packageName?: string }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center text-[#666] text-[14px] mt-12">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Finding shared maintainers...
      </div>
    );
  }
  if (!packageName) {
    return <div className="text-[#444] text-[14px] mt-12 text-center font-light">Search for a package first</div>;
  }
  if (maintainers.length === 0) {
    return (
      <div className="text-[#444] text-[14px] mt-12 text-center font-light">
        No shared maintainers found
      </div>
    );
  }

  return (
    <div className="space-y-8 mt-4">
      <div>
        <div className="text-amber-label mb-3">Shared Risk</div>
        <h3 className="text-[27px] font-normal tracking-[-0.02em] mb-2">Maintainer Risk</h3>
        <p className="text-[14px] font-light text-[#9a9a9a] leading-[1.5]">
          If a maintainer of <span className="text-white">{packageName}</span> is compromised, these packages are also at risk.
        </p>
      </div>
      {maintainers.map((m) => (
        <div key={m.id}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[18px] font-normal text-white">{m.name}</span>
            <span className="text-[12px] text-[#ffb829] uppercase tracking-[0.025em] font-semibold">
              {m.packages.length} package{m.packages.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-1.5">
            {m.packages.map((p) => (
              <div key={p.id} className="text-[14px] text-[#9a9a9a] font-light">
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
      <div className="flex items-center justify-center text-[#666] text-[14px] mt-12">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Scanning for typosquats...
      </div>
    );
  }
  if (!packageName) {
    return <div className="text-[#444] text-[14px] mt-12 text-center font-light">Search for a package first</div>;
  }
  if (candidates.length === 0) {
    return (
      <div className="text-[#444] text-[14px] mt-12 text-center font-light">
        No typosquat candidates found
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      <div>
        <div className="text-amber-label mb-3">Detection</div>
        <h3 className="text-[27px] font-normal tracking-[-0.02em] mb-2">Typosquat Scan</h3>
        <p className="text-[14px] font-light text-[#9a9a9a] leading-[1.5]">
          Packages with names similar to <span className="text-white">{packageName}</span>. These could be typosquat attempts.
        </p>
      </div>
      {candidates.map((c) => (
        <div key={c.id}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[18px] font-normal text-white">{c.name}</span>
            {c.suspicious && (
              <span className="text-[12px] text-[#ffb829] uppercase tracking-[0.025em] font-semibold">
                Suspicious
              </span>
            )}
          </div>
          <div className="flex gap-6 text-[12px] text-[#666]">
            <span>Edit distance: <span className="text-[#bdbdbd]">{c.editDistance}</span></span>
            <span>Length diff: <span className="text-[#bdbdbd]">{c.lengthDiff}</span></span>
          </div>
        </div>
      ))}
    </div>
  );
}
