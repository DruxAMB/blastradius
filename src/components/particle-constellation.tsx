"use client";

import { useEffect, useRef } from "react";

/**
 * Particle Constellation — Dala-style signature visual.
 *
 * Two modes:
 * - "hero": Brain-shape cluster on the right half + ambient particles. Responds to scroll
 *   by dispersing particles as the user scrolls past the hero.
 * - "ambient": Scattered ambient particles across full canvas for background atmosphere.
 */
export function ParticleConstellation({
  className,
  mode = "hero",
  scrollProgressRef,
}: {
  className?: string;
  mode?: "hero" | "ambient";
  scrollProgressRef?: React.RefObject<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const internalScrollRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = 0;
    let height = 0;

    const colors = [
      "#8052ff", // electric iris
      "#ffb829", // saffron spark
      "#15846e", // deep verdant
      "#ff6b9d", // magenta
      "#5b9eff", // blue
      "#a78bfa", // light violet
      "#fbbf24", // amber
      "#34d399", // teal
    ];

    interface Particle {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      opacity: number;
      rotation: number;
      rotationSpeed: number;
      isAmbient: boolean;
      scatterAngle: number;
      scatterSpeed: number;
    }

    let particles: Particle[] = [];

    function resize() {
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      initParticles();
    }

    function initParticles() {
      particles = [];
      if (width === 0 || height === 0) return;

      if (mode === "hero") {
        // Brain/cloud cluster positioned on the right half
        const centerX = width * 0.65;
        const centerY = height * 0.5;
        const maxRadius = Math.min(width * 0.4, height * 0.45);

        const clusterCount = Math.min(500, Math.floor((width * height) / 600));
        for (let i = 0; i < clusterCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.pow(Math.random(), 0.5) * maxRadius;
          // Brain-like lobes
          const lobeFactor = 1 + 0.35 * Math.sin(angle * 2) + 0.15 * Math.sin(angle * 5);
          const x = centerX + Math.cos(angle) * r * lobeFactor;
          const y = centerY + Math.sin(angle) * r * 0.7;

          particles.push({
            x,
            y,
            baseX: x,
            baseY: y,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2,
            size: 1 + Math.random() * 2.5,
            color: colors[Math.floor(Math.random() * colors.length)],
            opacity: 0.3 + Math.random() * 0.5,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.015,
            isAmbient: false,
            scatterAngle: Math.random() * Math.PI * 2,
            scatterSpeed: 0.5 + Math.random() * 2,
          });
        }

        // Ambient particles across full canvas
        const ambientCount = Math.min(100, Math.floor((width * height) / 5000));
        for (let i = 0; i < ambientCount; i++) {
          const x = Math.random() * width;
          const y = Math.random() * height;
          particles.push({
            x,
            y,
            baseX: x,
            baseY: y,
            vx: (Math.random() - 0.5) * 0.1,
            vy: (Math.random() - 0.5) * 0.1,
            size: 1 + Math.random() * 1.5,
            color: colors[Math.floor(Math.random() * colors.length)],
            opacity: 0.08 + Math.random() * 0.2,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.008,
            isAmbient: true,
            scatterAngle: Math.random() * Math.PI * 2,
            scatterSpeed: 0.3 + Math.random() * 1.5,
          });
        }
      } else {
        // Ambient-only mode for background sections
        const count = Math.min(120, Math.floor((width * height) / 4000));
        for (let i = 0; i < count; i++) {
          const x = Math.random() * width;
          const y = Math.random() * height;
          particles.push({
            x,
            y,
            baseX: x,
            baseY: y,
            vx: (Math.random() - 0.5) * 0.08,
            vy: (Math.random() - 0.5) * 0.08,
            size: 1 + Math.random() * 1.5,
            color: colors[Math.floor(Math.random() * colors.length)],
            opacity: 0.05 + Math.random() * 0.15,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.005,
            isAmbient: true,
            scatterAngle: Math.random() * Math.PI * 2,
            scatterSpeed: 0.3 + Math.random() * 1,
          });
        }
      }
    }

    function drawTriangle(
      x: number,
      y: number,
      size: number,
      rotation: number,
      color: string,
      opacity: number
    ) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.strokeStyle = color;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.866, size * 0.5);
      ctx.lineTo(-size * 0.866, size * 0.5);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Get scroll progress (0 = hero visible, 1 = hero scrolled past)
      const scrollProgress = scrollProgressRef?.current ?? internalScrollRef.current;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        if (p.isAmbient) {
          // Ambient particles wrap around
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        } else {
          // Cluster particles: disperse on scroll
          if (scrollProgress > 0) {
            const scatterDist = scrollProgress * p.scatterSpeed * 300;
            p.x = p.baseX + Math.cos(p.scatterAngle) * scatterDist;
            p.y = p.baseY + Math.sin(p.scatterAngle) * scatterDist;
          } else {
            // Gentle drift back to base position
            p.x += (p.baseX - p.x) * 0.05;
            p.y += (p.baseY - p.y) * 0.05;
          }

          // Subtle organic motion
          p.x += Math.sin(Date.now() * 0.0005 + p.baseX * 0.01) * 0.15;
          p.y += Math.cos(Date.now() * 0.0005 + p.baseY * 0.01) * 0.15;
        }

        // Fade out as scroll progresses (for hero mode)
        const opacityMultiplier = p.isAmbient ? 1 - scrollProgress * 0.5 : 1 - scrollProgress * 0.8;
        drawTriangle(p.x, p.y, p.size, p.rotation, p.color, p.opacity * opacityMultiplier);
      }

      animationId = requestAnimationFrame(animate);
    }

    // Track scroll progress internally if no external ref provided
    function handleScroll() {
      const scrollY = window.scrollY;
      const heroHeight = window.innerHeight;
      internalScrollRef.current = Math.min(1, Math.max(0, scrollY / heroHeight));
    }

    resize();
    animate();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [mode, scrollProgressRef]);

  return <canvas ref={canvasRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
