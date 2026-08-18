"use client";

import { useEffect, useRef } from "react";

/**
 * Particle Constellation — Dala-style signature visual.
 *
 * Fixed full-viewport canvas that sits behind all content.
 * Particles start as a brain-shape cluster (hero) and disperse
 * as the user scrolls, remaining visible as ambient background
 * behind all subsequent sections.
 */
export function ParticleConstellation({
  className,
  scrollProgressRef,
}: {
  className?: string;
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
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      initParticles();
    }

    function initParticles() {
      particles = [];
      if (width === 0 || height === 0) return;

      // Brain/cloud cluster positioned on the right half of the hero
      const centerX = width * 0.68;
      const centerY = height * 0.5;
      const maxRadius = Math.min(width * 0.35, height * 0.42);

      const clusterCount = Math.min(600, Math.floor((width * height) / 500));
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
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          size: 1 + Math.random() * 2.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: 0.35 + Math.random() * 0.5,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.015,
          isAmbient: false,
          scatterAngle: Math.random() * Math.PI * 2,
          scatterSpeed: 0.8 + Math.random() * 2.5,
        });
      }

      // Ambient particles scattered across full viewport
      const ambientCount = Math.min(150, Math.floor((width * height) / 4000));
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
          opacity: 0.06 + Math.random() * 0.15,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.008,
          isAmbient: true,
          scatterAngle: Math.random() * Math.PI * 2,
          scatterSpeed: 0.3 + Math.random() * 1.5,
        });
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
      ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
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

      // Scroll progress: 0 = hero at top, 1 = hero fully scrolled past
      const scrollProgress = scrollProgressRef?.current ?? internalScrollRef.current;

      for (const p of particles) {
        p.rotation += p.rotationSpeed;

        if (p.isAmbient) {
          // Ambient particles: slow drift, wrap around viewport
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
          if (p.y < -10) p.y = height + 10;
          if (p.y > height + 10) p.y = -10;

          // Ambient particles stay at constant low opacity
          drawTriangle(p.x, p.y, p.size, p.rotation, p.color, p.opacity);
        } else {
          // Cluster particles: disperse on scroll
          if (scrollProgress > 0) {
            // Scatter outward from base position
            const scatterDist = scrollProgress * p.scatterSpeed * 400;
            const targetX = p.baseX + Math.cos(p.scatterAngle) * scatterDist;
            const targetY = p.baseY + Math.sin(p.scatterAngle) * scatterDist;

            // Smooth interpolation toward scatter target
            p.x += (targetX - p.x) * 0.08;
            p.y += (targetY - p.y) * 0.08;
          } else {
            // Return to base position when scrolled back up
            p.x += (p.baseX - p.x) * 0.1;
            p.y += (p.baseY - p.y) * 0.1;
          }

          // Subtle organic motion
          const t = Date.now() * 0.0004;
          p.x += Math.sin(t + p.baseX * 0.01) * 0.12;
          p.y += Math.cos(t + p.baseY * 0.01) * 0.12;

          // Opacity: full at scroll 0, fades to ambient level as dispersed
          // After full dispersion, particles remain visible at low opacity behind content
          const dispersedOpacity = 0.08 + (1 - Math.min(1, scrollProgress)) * 0.4;
          const finalOpacity = p.opacity * (scrollProgress > 0.05 ? dispersedOpacity : 1);

          drawTriangle(p.x, p.y, p.size, p.rotation, p.color, finalOpacity);
        }
      }

      animationId = requestAnimationFrame(animate);
    }

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
  }, [scrollProgressRef]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
      }}
    />
  );
}
