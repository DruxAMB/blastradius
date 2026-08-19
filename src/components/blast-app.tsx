"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, AlertTriangle, Users, Type, Loader2, ArrowLeft, Zap, X, Terminal } from "lucide-react";
import dynamic from "next/dynamic";

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

export default function BlastApp({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{ name: string; id: number; description: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blastResult, setBlastResult] = useState<BlastRadiusResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("blast");
  const [selectedNode, setSelectedNode] = useState<BlastNode | null>(null);
  const [maintainers, setMaintainers] = useState<SharedMaintainer[]>([]);
  const [typosquats, setTyposquats] = useState<TyposquatCandidate[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const graphRef = useRef<{ zoom: (z: number, ms: number) => void } | undefined>(undefined);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 600 });
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Live compromise propagation
  const [propagationStage, setPropagationStage] = useState(-1); // -1 = not started, 0..maxDist = current hop
  const [showQueryOverlay, setShowQueryOverlay] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const propagationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const propagationStartTimeRef = useRef(0);

  useEffect(() => {
    const updateDimensions = () => {
      setGraphDimensions({ width: window.innerWidth, height: window.innerHeight });
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
        // Center the graph on the origin (where source node sits)
        setTimeout(() => {
          if (graphRef.current) {
            graphRef.current.zoom(1.5, 300);
          }
        }, 100);
      }
    } catch {
      // HydraDB unreachable — show setup modal with instructions
      setShowSetupModal(true);
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

  // Live compromise propagation — reveal nodes hop by hop
  useEffect(() => {
    // Clear any previous propagation timers
    propagationTimersRef.current.forEach(clearTimeout);
    propagationTimersRef.current = [];
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    setPropagationStage(-1);
    setElapsedMs(0);

    if (!blastResult) return;

    const maxDist = blastResult.summary.maxDepth;
    const stageDelay = 600; // ms between each hop wave

    // Show Cypher query overlay first
    setShowQueryOverlay(true);
    setPropagationStage(-1);

    const overlayTimer = setTimeout(() => {
      setShowQueryOverlay(false);
      propagationStartTimeRef.current = Date.now();

      // Start elapsed timer
      elapsedTimerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - propagationStartTimeRef.current);
      }, 50);

      // Reveal each ring with delay
      for (let d = 0; d <= maxDist; d++) {
        const t = setTimeout(() => {
          setPropagationStage(d);
          if (d === maxDist) {
            // Stop elapsed timer after last wave
            setTimeout(() => {
              if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
            }, 300);
          }
        }, d * stageDelay);
        propagationTimersRef.current.push(t);
      }
    }, 1500); // 1.5s overlay display time

    propagationTimersRef.current.push(overlayTimer);

    return () => {
      propagationTimersRef.current.forEach(clearTimeout);
      propagationTimersRef.current = [];
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [blastResult]);

  // Compute radial layout: source at center, dependents arranged in rings by distance
  // Only show nodes up to the current propagation stage
  const graphData = (() => {
    if (!blastResult) return { nodes: [], links: [] };

    // Filter nodes by propagation stage (-1 = none visible, 0 = source only, etc.)
    const visibleNodes = propagationStage < 0
      ? []
      : blastResult.nodes.filter((n) => n.distance <= propagationStage);

    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

    // Group visible nodes by distance
    const byDistance = new Map<number, typeof blastResult.nodes>();
    for (const n of visibleNodes) {
      const arr = byDistance.get(n.distance) ?? [];
      arr.push(n);
      byDistance.set(n.distance, arr);
    }
    if (byDistance.size === 0) return { nodes: [], links: [] };
    const maxDist = Math.max(...byDistance.keys());

    // Assign positions: source at (0,0), each ring at increasing radius
    const ringSpacing = 120;
    const nodePositions = new Map<number, { x: number; y: number }>();

    for (const [dist, nodes] of byDistance) {
      if (dist === 0) {
        nodePositions.set(nodes[0].id, { x: 0, y: 0 });
        continue;
      }
      const radius = dist * ringSpacing;
      const angleStep = (Math.PI * 2) / nodes.length;
      const angleOffset = dist * 0.3;
      nodes.forEach((n, i) => {
        const angle = i * angleStep + angleOffset;
        nodePositions.set(n.id, {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        });
      });
    }

    return {
      nodes: visibleNodes.map((n) => {
        const pos = nodePositions.get(n.id) ?? { x: 0, y: 0 };
        return {
          id: n.id,
          name: n.name,
          distance: n.distance,
          description: n.description,
          color: colorForDistance(n.distance),
          val: n.distance === 0 ? 4 : Math.max(1, 3 - n.distance * 0.3),
          x: pos.x,
          y: pos.y,
          fx: pos.x,
          fy: pos.y,
        };
      }),
      // Only show links where both endpoints are visible
      links: blastResult.links
        .filter((l) => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target))
        .map((l) => ({
          source: l.source,
          target: l.target,
          color: "rgba(120, 120, 120, 0.2)",
        })),
    };
  })();

  // Count of currently visible nodes (for live counter)
  const visibleCount = propagationStage >= 0 && blastResult
    ? blastResult.nodes.filter((n) => n.distance <= propagationStage).length
    : 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black text-white">
      {/* Header — minimal, transparent on black */}
      <header className="px-8 py-4">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-2 text-[#9a9a9a] hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[14px] font-semibold tracking-[0.025em] uppercase">Back</span>
          </button>
        </div>
        <div className="text-[12px] text-[#9a9a9a] uppercase tracking-[0.025em]">
          npm dependency graph
        </div>
        </div>
      </header>

      {/* Search — no container, floating on black */}
      <div className="px-8 pb-6">
        <div className="max-w-[1280px] mx-auto">
        <div className="flex gap-3 max-w-[500px] mx-auto">
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
                Blast
              </>
            )}
          </button>
        </div>
        </div>
      </div>

      {/* Error — minimal text on black */}
      {error && (
        <div className="px-8 pb-4">
          <div className="max-w-[1280px] mx-auto">
          <div className="max-w-[640px] flex items-center gap-2 text-[14px] text-[#ffb829]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
          </div>
        </div>
      )}

      {/* Setup modal — shown when HydraDB is unreachable (e.g. on deployed URL) */}
      {showSetupModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowSetupModal(false)}
        >
          <div
            className="relative w-full max-w-[520px] mx-8 bg-[#0a0a0a] border border-[#222] rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-[#8052ff]" />
                <span className="text-[14px] font-semibold text-white">HydraDB Connection Required</span>
              </div>
              <button
                onClick={() => setShowSetupModal(false)}
                className="text-[#666] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-[13px] text-[#9a9a9a] leading-relaxed">
                BlastRadius requires a running HydraDB instance to execute graph traversal queries.
                The database isn't reachable from this deployment. Run it locally in 3 steps:
              </p>

              {/* Step 1 */}
              <div className="space-y-1.5">
                <div className="text-[11px] text-[#666] uppercase tracking-[0.05em]">1. Clone &amp; install</div>
                <div className="bg-black border border-[#1a1a1a] rounded px-4 py-2.5 font-mono text-[12px] text-[#bdbdbd]">
                  git clone https://github.com/DruxAMB/blastradius.git<br />
                  cd blastradius &amp;&amp; npm install
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-1.5">
                <div className="text-[11px] text-[#666] uppercase tracking-[0.05em]">2. Start HydraDB + seed data</div>
                <div className="bg-black border border-[#1a1a1a] rounded px-4 py-2.5 font-mono text-[12px] text-[#bdbdbd]">
                  docker compose up -d<br />
                  npx tsx scripts/seed.ts
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-1.5">
                <div className="text-[11px] text-[#666] uppercase tracking-[0.05em]">3. Run the app</div>
                <div className="bg-black border border-[#1a1a1a] rounded px-4 py-2.5 font-mono text-[12px] text-[#bdbdbd]">
                  npm run dev<span className="text-[#666]">  # open http://localhost:3000</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#1a1a1a]">
                <p className="text-[12px] text-[#666] leading-relaxed">
                  The demo video shows the full experience without local setup.
                  See the <a href="https://github.com/DruxAMB/blastradius" target="_blank" rel="noopener noreferrer" className="text-[#8052ff] hover:underline">README</a> for details.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden px-8 pb-6">
        <div className="max-w-[1280px] mx-auto h-full flex overflow-hidden">
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
              {/* Cypher query overlay — shows the actual query before graph explodes */}
              {showQueryOverlay && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/90">
                  <div className="font-mono text-[13px] leading-[1.8] text-[#bdbdbd] max-w-[600px] px-8">
                    <div className="text-[#666] mb-3 text-[11px] uppercase tracking-[0.05em]">HydraDB · OpenCypher</div>
                    <div><span className="text-[#8052ff]">CALL</span> algo.SSpaths(&#123;</div>
                    <div className="pl-4">sourceNode: <span className="text-[#ffb829]">$pkgId</span>,</div>
                    <div className="pl-4">relTypes: [<span className="text-[#15846e]">&apos;DEPENDS_ON&apos;</span>],</div>
                    <div className="pl-4">relDirection: <span className="text-[#15846e]">&apos;incoming&apos;</span>,</div>
                    <div className="pl-4">maxLen: <span className="text-[#ffb829]">10</span>,</div>
                    <div className="pl-4">pathCount: <span className="text-[#ffb829]">200</span></div>
                    <div>&#125;) <span className="text-[#8052ff]">YIELD</span> path <span className="text-[#8052ff]">RETURN</span> path</div>
                    <div className="mt-4 text-[#666] text-[11px] animate-pulse">Executing traversal...</div>
                  </div>
                </div>
              )}

              {/* Summary — live counter during propagation, full stats after */}
              <div className="absolute top-4 left-0 right-0 z-10 flex items-center gap-6 text-[14px] backdrop-blur-lg">
                <span className="text-[#8052ff] font-semibold">{blastResult.package}</span>
                <span className="text-[#333]">·</span>
                {propagationStage >= 0 && propagationStage < blastResult.summary.maxDepth ? (
                  <span className="text-[#bdbdbd]">
                    <span className="text-white font-semibold tabular-nums">{visibleCount}</span> affected
                    <span className="text-[#8052ff] ml-2 tabular-nums">· {(elapsedMs / 1000).toFixed(1)}s</span>
                  </span>
                ) : (
                  <>
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
                    <span className="text-[#333]">·</span>
                    <span className="text-[#8052ff] tabular-nums">{(elapsedMs / 1000).toFixed(1)}s</span>
                  </>
                )}
                {blastResult.summary.deprecated && (
                  <span className="text-[#ffb829] text-[12px] uppercase tracking-[0.025em] font-semibold">
                    Deprecated
                  </span>
                )}
              </div>

              {/* ForceGraph2D — absolute positioned to span full viewport so rings display fully */}
              <div className="fixed inset-0 z-0 top-20 -translate-x-[10%] pointer-events-auto">
                <ForceGraph2D
                  ref={graphRef as never}
                  graphData={graphData}
                  nodeLabel="name"
                  nodeColor="color"
                  nodeVal="val"
                  nodeRelSize={6}
                  linkColor="color"
                  linkDirectionalArrowColor="color"
                  linkDirectionalArrowLength={3}
                  linkDirectionalArrowRelPos={1}
                  linkDirectionalParticles={2}
                  linkDirectionalParticleWidth={2}
                  linkDirectionalParticleSpeed={0.004}
                  linkDirectionalParticleColor={() => "#8052ff"}
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
                    const radius = 5 + (val - 1) * 2;

                    // Pulsing glow on source node
                    if (distance === 0) {
                      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.003);
                      ctx.shadowColor = color;
                      ctx.shadowBlur = 15 + pulse * 25;
                      ctx.fillStyle = color;
                      ctx.beginPath();
                      ctx.arc(x, y, radius + 2, 0, 2 * Math.PI);
                      ctx.fill();
                      ctx.shadowBlur = 0;

                      // Outer ring
                      ctx.strokeStyle = color;
                      ctx.globalAlpha = 0.3 + pulse * 0.3;
                      ctx.lineWidth = 1.5;
                      ctx.beginPath();
                      ctx.arc(x, y, radius + 8 + pulse * 6, 0, 2 * Math.PI);
                      ctx.stroke();
                      ctx.globalAlpha = 1;
                    } else {
                      // Regular nodes — subtle glow
                      ctx.shadowColor = color;
                      ctx.shadowBlur = 8;
                      ctx.fillStyle = color;
                      ctx.beginPath();
                      ctx.arc(x, y, radius, 0, 2 * Math.PI);
                      ctx.fill();
                      ctx.shadowBlur = 0;
                    }

                    // Labels
                    if (globalScale > 1.2) {
                      const fontSize = distance === 0 ? 12 : 10;
                      ctx.font = `${fontSize / globalScale}px Inter, sans-serif`;
                      ctx.textAlign = "center";
                      ctx.textBaseline = "middle";
                      ctx.fillStyle = distance === 0 ? "#ffffff" : "#bdbdbd";
                      ctx.fillText(name, x, y + (radius + 10) / globalScale);
                    }
                  }}
                  linkCanvasObjectMode={() => "before"}
                  linkCanvasObject={(_link: Record<string, unknown>, ctx: CanvasRenderingContext2D, globalScale: number) => {
                    // Draw concentric guide rings (behind everything, echoes the blast radius logo)
                    if (blastResult) {
                      const maxDist = blastResult.summary.maxDepth;
                      const ringSpacing = 120;
                      for (let d = 1; d <= maxDist; d++) {
                        const radius = d * ringSpacing;
                        ctx.strokeStyle = "rgba(128, 82, 255, 0.04)";
                        ctx.lineWidth = 1 / globalScale;
                        ctx.beginPath();
                        ctx.arc(0, 0, radius, 0, Math.PI * 2);
                        ctx.stroke();
                      }
                    }

                    // Draw subtle gradient line for this link
                    const link = _link as { source?: { x: number; y: number }; target?: { x: number; y: number } };
                    const source = link.source;
                    const target = link.target;
                    if (!source || !target) return;
                    if (typeof source.x !== "number" || typeof target.x !== "number") return;
                    if (!isFinite(source.x) || !isFinite(source.y) || !isFinite(target.x) || !isFinite(target.y)) return;

                    const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
                    gradient.addColorStop(0, "rgba(128, 82, 255, 0.15)");
                    gradient.addColorStop(1, "rgba(128, 82, 255, 0.05)");
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 1 / globalScale;
                    ctx.beginPath();
                    ctx.moveTo(source.x, source.y);
                    ctx.lineTo(target.x, target.y);
                    ctx.stroke();
                  }}
                  enableNodeDrag={true}
                  cooldownTicks={0}
                  width={graphDimensions.width}
                  height={graphDimensions.height}
                />
              </div>

              {/* Legend — floating, no container */}
              <div className="absolute bottom-4 left-0 text-[12px] flex items-center gap-4">
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
        <div className="w-[400px] min-h-[500px] h-fit backdrop-blur-lg flex flex-col overflow-hidden">
          {/* Tabs — ghost text, no container */}
          <div className="flex px-8 py-4 gap-6">
            <TabButton active={activeTab === "blast"} onClick={() => setActiveTab("blast")} label="Blast Radius" />
            <TabButton active={activeTab === "maintainers"} onClick={() => setActiveTab("maintainers")} label="Maintainers" />
            <TabButton active={activeTab === "typosquat"} onClick={() => setActiveTab("typosquat")} label="Typosquat" />
          </div>

          {/* Tab content — floating on black */}
          <div className="flex-1 overflow-y-auto px-8 pb-6">
            {activeTab === "blast" && <BlastTab selectedNode={selectedNode} blastResult={blastResult} />}
            {activeTab === "maintainers" && <MaintainersTab maintainers={maintainers} loading={tabLoading} packageName={blastResult?.package} />}
            {activeTab === "typosquat" && <TyposquatTab candidates={typosquats} loading={tabLoading} packageName={blastResult?.package} />}
          </div>
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
