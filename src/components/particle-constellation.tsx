"use client";

import { useEffect, useRef } from "react";

/**
 * Particle Constellation — Dala-style signature visual.
 * Thousands of tiny outlined triangular particles forming an organic cloud shape,
 * with ambient particles drifting across the background.
 * Colors: violet, amber, teal, magenta, blue — saturated chromatic, never grayscale.
 */
export function ParticleConstellation({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      vx: number;
      vy: number;
      size: number;
      color: string;
      opacity: number;
      rotation: number;
      rotationSpeed: number;
      isAmbient: boolean;
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
      ctx.scale(dpr, dpr);
      initParticles();
    }

    function initParticles() {
      particles = [];
      if (width === 0 || height === 0) return;

      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) * 0.4;

      // Brain/cloud shape particles — dense cluster
      const clusterCount = Math.min(400, Math.floor((width * height) / 800));
      for (let i = 0; i < clusterCount; i++) {
        // Create organic brain-like distribution
        const angle = Math.random() * Math.PI * 2;
        const r = Math.pow(Math.random(), 0.5) * maxRadius;
        // Add some lobes for brain shape
        const lobeFactor = 1 + 0.3 * Math.sin(angle * 2);
        const x = centerX + Math.cos(angle) * r * lobeFactor;
        const y = centerY + Math.sin(angle) * r * 0.7; // squish vertically

        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          size: 1 + Math.random() * 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: 0.3 + Math.random() * 0.5,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.01,
          isAmbient: false,
        });
      }

      // Ambient particles — scattered across full canvas
      const ambientCount = Math.min(80, Math.floor((width * height) / 6000));
      for (let i = 0; i < ambientCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.08,
          vy: (Math.random() - 0.5) * 0.08,
          size: 1 + Math.random() * 1.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: 0.1 + Math.random() * 0.2,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.005,
          isAmbient: true,
        });
      }
    }

    function drawTriangle(x: number, y: number, size: number, rotation: number, color: string, opacity: number) {
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

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Wrap around edges for ambient particles
        if (p.isAmbient) {
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        } else {
          // Cluster particles drift back toward center
          const cx = width / 2;
          const cy = height / 2;
          const dx = cx - p.x;
          const dy = cy - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > Math.min(width, height) * 0.45) {
            p.vx += (dx / dist) * 0.002;
            p.vy += (dy / dist) * 0.002;
          }
          // Damping
          p.vx *= 0.99;
          p.vy *= 0.99;
        }

        drawTriangle(p.x, p.y, p.size, p.rotation, p.color, p.opacity);
      }

      animationId = requestAnimationFrame(animate);
    }

    resize();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
