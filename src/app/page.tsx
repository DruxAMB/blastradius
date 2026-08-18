import Link from "next/link";
import { Zap, AlertTriangle, Users, Type, GitBranch, Shield, ArrowRight, TrendingUp } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <span className="text-lg font-bold tracking-tight">BlastRadius</span>
        </div>
        <Link
          href="/app"
          className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          Launch Tool →
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative px-6 pt-20 pb-32 max-w-5xl mx-auto">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-red-500/10 rounded-full blur-[120px]" />
          <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-orange-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="relative text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-400">
            <TrendingUp className="w-3.5 h-3.5 text-red-400" />
            Supply chain attacks are surging
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
            When a package is compromised,
            <br />
            <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              what's the blast radius?
            </span>
          </h1>

          <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10">
            BlastRadius computes the complete transitive dependency closure of any npm package
            in seconds. Powered by HydraDB&apos;s graph-native engine — the question a vector
            database cannot answer.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/app"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all shadow-lg shadow-red-500/20"
            >
              <AlertTriangle className="w-4 h-4" />
              Calculate Blast Radius
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="https://github.com/hydra-db/hydradb"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-medium rounded-lg transition-colors"
            >
              <GitBranch className="w-4 h-4" />
              HydraDB OSS
            </a>
          </div>
        </div>
      </section>

      {/* Problem section */}
      <section className="px-6 py-16 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-4">The problem</h2>
          <p className="text-zinc-400 text-center max-w-2xl mx-auto mb-12">
            In 2016, the unpublishing of <code className="text-orange-400">left-pad</code> broke
            thousands of projects. In 2024, a compromised <code className="text-orange-400">ultra</code> package
            ran malicious code on every install. The question is always the same: what else is affected?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-red-950/50 flex items-center justify-center mb-4">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="font-semibold mb-2">Direct dependents</h3>
              <p className="text-sm text-zinc-500">
                Packages that list the compromised package as a dependency. Easy to find —
                but that&apos;s just the first wave.
              </p>
            </div>
            <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-orange-950/50 flex items-center justify-center mb-4">
                <GitBranch className="w-5 h-5 text-orange-400" />
              </div>
              <h3 className="font-semibold mb-2">Transitive closure</h3>
              <p className="text-sm text-zinc-500">
                Packages that depend on packages that depend on the compromised one. This is
                the graph traversal that matters — and it&apos;s what BlastRadius computes.
              </p>
            </div>
            <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-yellow-950/50 flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-yellow-400" />
              </div>
              <h3 className="font-semibold mb-2">Shared maintainers</h3>
              <p className="text-sm text-zinc-500">
                If the maintainer is compromised, every package they maintain is at risk.
                BlastRadius traces the maintainer graph too.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-4">How it works</h2>
          <p className="text-zinc-400 text-center max-w-2xl mx-auto mb-12">
            BlastRadius uses HydraDB&apos;s native OpenCypher path procedures to traverse the
            dependency graph. This is not a search — it&apos;s a graph traversal.
          </p>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 font-mono text-sm">
            <div className="text-zinc-500 mb-2">// The blast radius query</div>
            <div className="text-zinc-300">
              <span className="text-purple-400">CALL</span> algo.SSpaths(&#123;
            </div>
            <div className="text-zinc-300 pl-4">
              sourceNode: <span className="text-orange-400">$pkgId</span>,
            </div>
            <div className="text-zinc-300 pl-4">
              relTypes: [<span className="text-green-400">&apos;DEPENDS_ON&apos;</span>],
            </div>
            <div className="text-zinc-300 pl-4">
              relDirection: <span className="text-green-400">&apos;incoming&apos;</span>,
            </div>
            <div className="text-zinc-300 pl-4">
              maxLen: <span className="text-blue-400">10</span>,
            </div>
            <div className="text-zinc-300 pl-4">
              pathCount: <span className="text-blue-400">200</span>
            </div>
            <div className="text-zinc-300">
              &#125;) <span className="text-purple-400">YIELD</span> path{" "}
              <span className="text-purple-400">RETURN</span> path
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
              <p className="text-sm text-zinc-400">222 npm packages with real dependency relationships, seeded into HydraDB</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
              <p className="text-sm text-zinc-400">Graph-native traversal via OpenCypher path procedures — not a vector search</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
              <p className="text-sm text-zinc-400">Interactive force-directed visualization, color-coded by distance from source</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Three layers of risk</h2>
          <div className="space-y-4">
            <FeatureRow
              icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
              title="Blast Radius"
              description="Transitive reverse dependency closure — every package affected, directly or indirectly, up to 10 hops."
              color="red"
            />
            <FeatureRow
              icon={<Users className="w-5 h-5 text-orange-400" />}
              title="Shared Maintainer Risk"
              description="If a maintainer is compromised, every package they maintain is at risk. Traced through the maintainer graph."
              color="orange"
            />
            <FeatureRow
              icon={<Type className="w-5 h-5 text-yellow-400" />}
              title="Typosquat Detection"
              description="Packages with names similar to the target — potential typosquat attacks. Ranked by edit distance."
              color="yellow"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 border-t border-zinc-900">
        <div className="max-w-2xl mx-auto text-center">
          <Shield className="w-12 h-12 mx-auto mb-6 text-zinc-700" />
          <h2 className="text-3xl font-bold mb-4">See it in action</h2>
          <p className="text-zinc-400 mb-8">
            Try packages like <code className="text-orange-400">es-errors</code>,{" "}
            <code className="text-orange-400">chalk</code>, or{" "}
            <code className="text-orange-400">debug</code> to see the graph explode.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all shadow-lg shadow-red-500/20 text-lg"
          >
            Launch BlastRadius
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-zinc-600">
          <span>Built for Hack Hydra 2026</span>
          <div className="flex items-center gap-4">
            <a href="https://github.com/hydra-db/hydradb" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">
              HydraDB
            </a>
            <span>Powered by OpenCypher</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureRow({ icon, title, description, color }: { icon: React.ReactNode; title: string; description: string; color: string }) {
  const colorMap: Record<string, string> = {
    red: "bg-red-950/30 border-red-900/30",
    orange: "bg-orange-950/30 border-orange-900/30",
    yellow: "bg-yellow-950/30 border-yellow-900/30",
  };
  return (
    <div className={`flex items-start gap-4 p-5 rounded-xl border ${colorMap[color] ?? colorMap.red}`}>
      <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-zinc-400">{description}</p>
      </div>
    </div>
  );
}
