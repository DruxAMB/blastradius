"use client";

import Link from "next/link";
import { useRef } from "react";
import { ParticleConstellation } from "@/components/particle-constellation";
import { FadeUp, FadeIn, ScaleIn, useScrollProgress } from "@/components/animations";

export default function LandingPage() {
  const heroScrollProgress = useScrollProgress();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Fixed particle constellation — behind all content, disperses on scroll */}
      <ParticleConstellation scrollProgressRef={heroScrollProgress} />

      {/* Nav — fixed, transparent on black */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-6">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="2" fill="#8052ff" />
              <circle cx="10" cy="10" r="5" stroke="#8052ff" strokeWidth="1" opacity="0.6" />
              <circle cx="10" cy="10" r="8" stroke="#8052ff" strokeWidth="1" opacity="0.3" />
            </svg>
            <span className="text-[14px] font-semibold tracking-[0.025em] uppercase">BlastRadius</span>
          </div>
          <div className="flex items-center gap-10">
            <a href="https://github.com/hydra-db/hydradb" target="_blank" rel="noopener noreferrer" className="text-[14px] font-semibold tracking-[0.025em] uppercase text-[#9a9a9a] hover:text-white transition-colors">
              HydraDB
            </a>
            <Link href="/app" className="btn-violet flex items-center gap-1">
              Launch <span className="hidden md:block">Tool</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — text on left, particles visible behind on right (fixed canvas) */}
      <section className="relative min-h-screen flex items-center px-8 pt-32 pb-20 overflow-hidden">
        {/* Subtle violet glow */}
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] -translate-y-1/2 translate-x-1/4 bg-[#8052ff]/6 rounded-full blur-[180px] pointer-events-none" />

        <div className="relative z-10 max-w-[1280px] mx-auto w-full">
          {/* Text occupies left half — particles show through on the right */}
          <div className="max-w-xl">
            <FadeUp delay={0.1}>
              <h1 className="mb-8 text-5xl">
                When a package <br /> is compromised,
                <br />
                <span className="text-[#8052ff] text-display">what&apos;s the blast radius?</span>
              </h1>
            </FadeUp>
            <FadeUp>
              <div className="text-amber-label mb-6">
                Supply chain attacks are surging
              </div>
            </FadeUp>
            <FadeUp delay={0.2}>
              <p className="text-body-lg text-[#bdbdbd] max-w-[480px] mb-10">
                BlastRadius computes the complete transitive dependency closure of any npm
                package in seconds. Powered by HydraDB&apos;s graph-native engine — the
                question a vector database cannot answer.
              </p>
            </FadeUp>
            <FadeUp delay={0.3}>
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
            </FadeUp>
          </div>
        </div>
      </section>

      {/* Problem section — text LEFT, visual RIGHT (zigzag 1) */}
      <section className="relative z-10 px-8 py-[120px]">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-[120px] items-start">
          <FadeUp>
            <div className="text-amber-label mb-6">The problem</div>
            <h2 className="text-heading-lg mb-8">
              Every dependency is a liability.
            </h2>
          </FadeUp>
          <FadeUp delay={0.15}>
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
          </FadeUp>
        </div>
      </section>

      {/* Three layers — visual LEFT, text RIGHT (zigzag 2) */}
      <section className="relative z-10 px-8 py-[120px]">
        <div className="max-w-[1280px] mx-auto">
          <FadeUp className="mb-[96px]">
            <div className="text-amber-label mb-6">Three layers</div>
            <h2 className="text-heading-lg">Three layers of risk.</h2>
          </FadeUp>

          <div className="space-y-[80px]">
            <RiskLayer
              number="01"
              label="BLAST RADIUS"
              title="Transitive reverse dependency closure"
              description="Every package affected, directly or indirectly, up to 10 hops. Computed via HydraDB's native OpenCypher path procedure — a graph traversal, not a search."
              color="#8052ff"
              reversed
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
              reversed
            />
          </div>
        </div>
      </section>

      {/* How it works — text LEFT, code RIGHT (zigzag continues) */}
      <section className="relative z-10 px-8 py-[120px]">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-[120px] items-start">
          <FadeUp>
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
          </FadeUp>
          <FadeUp delay={0.15}>
            <div className="max-w-[520px]">
              <div className="font-mono text-[13px] leading-[1.7] text-[#bdbdbd]">
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
          </FadeUp>
        </div>
      </section>

      {/* CTA — centered, spacious */}
      <section className="relative z-10 px-8 py-[160px]">
        <FadeUp className="max-w-[1280px] mx-auto text-center">
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
        </FadeUp>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-8 py-12 border-t border-[#111]">
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
  reversed,
}: {
  number: string;
  label: string;
  title: string;
  description: string;
  color: string;
  reversed?: boolean;
}) {
  return (
    <FadeUp>
      <div className={`grid grid-cols-1 lg:grid-cols-[80px_1fr_2fr] gap-6 lg:gap-12 items-start ${reversed ? "lg:[direction:rtl]" : ""}`}>
        <div className="text-[14px] font-semibold tracking-[0.025em] uppercase lg:[direction:ltr]" style={{ color }}>
          {number}
        </div>
        <div className="lg:[direction:ltr]">
          <div className="text-[12px] font-semibold tracking-[0.025em] uppercase mb-3" style={{ color }}>
            {label}
          </div>
          <h3 className="text-[27px] font-normal leading-[1.1] tracking-[-0.02em]">
            {title}
          </h3>
        </div>
        <p className="text-body-lg text-[#bdbdbd] max-w-[480px] lg:[direction:ltr]">
          {description}
        </p>
      </div>
    </FadeUp>
  );
}
