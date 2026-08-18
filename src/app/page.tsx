import Link from "next/link";
import { ParticleConstellation } from "@/components/particle-constellation";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Nav — transparent, minimal */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-5">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Triangular logo mark */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L18 16H2L10 2Z" stroke="#8052ff" strokeWidth="1.5" />
              <path d="M10 2L18 16H2L10 2Z" fill="url(#logo-gradient)" fillOpacity="0.3" />
              <defs>
                <linearGradient id="logo-gradient" x1="10" y1="2" x2="10" y2="16">
                  <stop stopColor="#8052ff" />
                  <stop offset="1" stopColor="#15846e" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-[14px] font-semibold tracking-[0.025em] uppercase">BlastRadius</span>
          </div>
          <div className="flex items-center gap-8">
            <Link href="/app" className="text-[14px] font-semibold tracking-[0.025em] uppercase text-[#9a9a9a] hover:text-white transition-colors">
              Tool
            </Link>
            <a href="https://github.com/hydra-db/hydradb" target="_blank" rel="noopener noreferrer" className="text-[14px] font-semibold tracking-[0.025em] uppercase text-[#9a9a9a] hover:text-white transition-colors">
              HydraDB
            </a>
            <Link href="/app" className="btn-violet">
              Launch Tool
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — two-column asymmetric split */}
      <section className="relative min-h-screen flex items-center px-6 pt-32 pb-20">
        {/* Particle constellation on the right */}
        <div className="absolute inset-0 z-0">
          <ParticleConstellation className="absolute right-0 top-0 w-full h-full opacity-60" />
        </div>

        {/* Gradient glow */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-[#8052ff]/8 rounded-full blur-[150px]" />
        </div>

        <div className="relative z-10 max-w-[1280px] mx-auto w-full">
          <div className="max-w-[640px]">
            <div className="text-amber-label mb-6">
              Supply chain attacks are surging
            </div>
            <h1 className="text-display mb-8">
              When a package is compromised,
              <br />
              <span className="text-[#8052ff]">what&apos;s the blast radius?</span>
            </h1>
            <p className="text-body-lg text-[#bdbdbd] max-w-[480px] mb-10">
              BlastRadius computes the complete transitive dependency closure of any npm
              package in seconds. Powered by HydraDB&apos;s graph-native engine — the
              question a vector database cannot answer.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/app" className="btn-violet">
                Calculate Blast Radius
              </Link>
              <a
                href="https://github.com/hydra-db/hydradb"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                HydraDB OSS →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Problem section — spacious two-column */}
      <section className="px-6 py-[120px]">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[120px] items-start">
            <div>
              <div className="text-amber-label mb-6">The problem</div>
              <h2 className="text-heading-lg mb-8">
                Every dependency is a liability.
              </h2>
            </div>
            <div className="max-w-[520px]">
              <p className="text-body-lg text-[#bdbdbd] mb-6">
                In 2016, the unpublishing of <span className="text-[#ffb829]">left-pad</span> broke
                thousands of projects. In 2024, a compromised <span className="text-[#ffb829]">ultra</span> package
                ran malicious code on every install.
              </p>
              <p className="text-body-lg text-[#bdbdbd]">
                The question is always the same: what else is affected? Not just direct
                dependents — the entire transitive closure. That&apos;s a graph traversal
                problem, and it&apos;s what BlastRadius solves.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Three layers of risk — spacious, no cards */}
      <section className="px-6 py-[120px]">
        <div className="max-w-[1280px] mx-auto">
          <div className="mb-[96px]">
            <div className="text-amber-label mb-6">Three layers</div>
            <h2 className="text-heading-lg">Three layers of risk.</h2>
          </div>

          <div className="space-y-[60px]">
            <RiskLayer
              number="01"
              label="BLAST RADIUS"
              title="Transitive reverse dependency closure"
              description="Every package affected, directly or indirectly, up to 10 hops. Computed via HydraDB's native OpenCypher path procedure — a graph traversal, not a search."
              color="#8052ff"
            />
            <RiskLayer
              number="02"
              label="SHARED MAINTAINERS"
              title="If a maintainer is compromised"
              description="Every package they maintain is at risk. Traced through the maintainer graph: package → MAINTAINED_BY → maintainer ← MAINTAINED_BY ← other packages."
              color="#ffb829"
            />
            <RiskLayer
              number="03"
              label="TYPOSQUAT DETECTION"
              title="Packages with similar names"
              description="Potential typosquat attacks, ranked by Levenshtein edit distance. Catches left_pad, leftpad, lodas — the packages that trick developers into installing malware."
              color="#15846e"
            />
          </div>
        </div>
      </section>

      {/* How it works — the query */}
      <section className="px-6 py-[120px]">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[120px] items-start">
            <div>
              <div className="text-amber-label mb-6">How it works</div>
              <h2 className="text-heading-lg mb-8">
                A graph traversal, not a search.
              </h2>
              <p className="text-body-lg text-[#bdbdbd] max-w-[480px]">
                HydraDB&apos;s native path procedure <span className="text-white">algo.SSpaths</span> traverses
                incoming DEPENDS_ON edges from the compromised package, finding every
                dependent in a single query. Each path returned contains the full chain
                of nodes and relationships.
              </p>
            </div>
            <div className="max-w-[520px]">
              <div className="font-mono text-[13px] leading-[1.6] text-[#bdbdbd]">
                <div className="text-[#9a9a9a] mb-3">// The blast radius query</div>
                <div><span className="text-[#8052ff]">CALL</span> algo.SSpaths(&#123;</div>
                <div className="pl-4">sourceNode: <span className="text-[#ffb829]">$pkgId</span>,</div>
                <div className="pl-4">relTypes: [<span className="text-[#15846e]">&apos;DEPENDS_ON&apos;</span>],</div>
                <div className="pl-4">relDirection: <span className="text-[#15846e]">&apos;incoming&apos;</span>,</div>
                <div className="pl-4">maxLen: <span className="text-[#ffb829]">10</span>,</div>
                <div className="pl-4">pathCount: <span className="text-[#ffb829]">200</span></div>
                <div>&#125;) <span className="text-[#8052ff]">YIELD</span> path <span className="text-[#8052ff]">RETURN</span> path</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA — spacious, minimal */}
      <section className="px-6 py-[160px]">
        <div className="max-w-[1280px] mx-auto text-center">
          <h2 className="text-heading-lg mb-8">
            See the graph explode.
          </h2>
          <p className="text-body-lg text-[#bdbdbd] max-w-[480px] mx-auto mb-12">
            Try <span className="text-[#ffb829]">es-errors</span>, <span className="text-[#ffb829]">chalk</span>, or{" "}
            <span className="text-[#ffb829]">debug</span> to see the full blast radius in seconds.
          </p>
          <Link href="/app" className="btn-violet inline-block">
            Launch BlastRadius
          </Link>
        </div>
      </section>

      {/* Footer — minimal */}
      <footer className="px-6 py-12 border-t border-[#111]">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between text-[12px] text-[#9a9a9a]">
          <span>Built for Hack Hydra 2026</span>
          <div className="flex items-center gap-6">
            <a href="https://github.com/hydra-db/hydradb" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              HydraDB
            </a>
            <span>Powered by OpenCypher</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function RiskLayer({
  number,
  label,
  title,
  description,
  color,
}: {
  number: string;
  label: string;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[80px_1fr_2fr] gap-6 lg:gap-12 items-start">
      <div className="text-[14px] font-semibold tracking-[0.025em] uppercase" style={{ color }}>
        {number}
      </div>
      <div>
        <div className="text-[12px] font-semibold tracking-[0.025em] uppercase mb-3" style={{ color }}>
          {label}
        </div>
        <h3 className="text-[27px] font-normal leading-[1.1] tracking-[-0.02em]">
          {title}
        </h3>
      </div>
      <p className="text-body-lg text-[#bdbdbd] max-w-[480px]">
        {description}
      </p>
    </div>
  );
}
