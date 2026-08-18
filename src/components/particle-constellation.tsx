"use client";

import { useEffect, useRef } from "react";

/**
 * Particle Constellation — morphing 3D shape system.
 *
 * Particles cycle through 4 shapes:
 * 1. Tetrahedron (3D triangle — complexity/structure)
 * 2. Concentric circles (blast radius — shockwave rings)
 * 3. Zap bolt (lightning — compromise/attack)
 * 4. Letter H (HydraDB logo — the engine)
 *
 * Shape morphs smoothly with lerp. Drag to rotate.
 * Hover repels particles. Scroll disperses.
 */

type ShapeType = "tetra" | "circles" | "zap" | "h";

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

    // Drag-to-rotate
    const drag = { active: false, lastX: 0, lastY: 0, velX: 0, velY: 0 };
    const dragSensitivity = 0.008;
    const inertiaDamping = 0.95;

    // Mouse hover repulsion
    const mouse = { x: -9999, y: -9999, active: false };
    const repelRadius = 400;
    const repelStrength = 10;

    const colors = [
      "#8052ff", "#ffb829", "#15846e", "#ff6b9d",
      "#5b9eff", "#a78bfa", "#fbbf24", "#34d399",
    ];

    // --- Shape definitions ---
    // Each shape produces an array of [x, y, z] target positions (in unit space, -1..1)
    // All shapes produce the same number of points (particleCount)

    // Tetrahedron vertices
    const tetraVerts = [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
    const tetraFaces = [[0,1,2],[0,1,3],[0,2,3],[1,2,3]];

    function randPointOnFace(face: number[]): [number, number, number] {
      const [a,b,c] = face;
      const v0 = tetraVerts[a], v1 = tetraVerts[b], v2 = tetraVerts[c];
      let r1 = Math.random(), r2 = Math.random();
      if (r1 + r2 > 1) { r1 = 1-r1; r2 = 1-r2; }
      const r3 = 1 - r1 - r2;
      return [
        v0[0]*r1 + v1[0]*r2 + v2[0]*r3,
        v0[1]*r1 + v1[1]*r2 + v2[1]*r3,
        v0[2]*r1 + v1[2]*r2 + v2[2]*r3,
      ];
    }

    // Zap bolt — lightning shape as line segments (in unit space, -1..1)
    // Simplified lightning bolt path
    const zapSegments: [number, number][][] = [
      [[0.1, -1], [-0.3, -0.1], [0.1, -0.1], [-0.1, 1]], // main bolt
    ];

    function randPointOnZap(): [number, number, number] {
      const seg = zapSegments[0];
      // Pick a random sub-segment
      const t = Math.random();
      const idx = Math.floor(t * (seg.length - 1));
      const localT = t * (seg.length - 1) - idx;
      const p0 = seg[idx];
      const p1 = seg[Math.min(idx + 1, seg.length - 1)];
      const x = p0[0] * (1 - localT) + p1[0] * localT;
      const y = p0[1] * (1 - localT) + p1[1] * localT;
      // Add slight jitter for thickness
      return [x + (Math.random() - 0.5) * 0.08, y + (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.15];
    }

    // Letter H — three line segments
    const hSegments: [number, number][][] = [
      [[-0.4, -1], [-0.4, 1]],  // left vertical
      [[0.4, -1], [0.4, 1]],    // right vertical
      [[-0.4, 0], [0.4, 0]],    // horizontal bar
    ];

    function randPointOnH(): [number, number, number] {
      const segIdx = Math.floor(Math.random() * hSegments.length);
      const seg = hSegments[segIdx];
      const t = Math.random();
      const x = seg[0][0] * (1 - t) + seg[1][0] * t;
      const y = seg[0][1] * (1 - t) + seg[1][1] * t;
      return [x + (Math.random() - 0.5) * 0.06, y + (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.15];
    }

    // Concentric circles — rings at increasing radius
    function randPointOnCircles(): [number, number, number] {
      const rings = [0.3, 0.55, 0.8, 1.05, 1.3];
      const ringIdx = Math.floor(Math.random() * rings.length);
      const angle = Math.random() * Math.PI * 2;
      const r = rings[ringIdx] + (Math.random() - 0.5) * 0.05;
      return [Math.cos(angle) * r, Math.sin(angle) * r, (Math.random() - 0.5) * 0.1];
    }

    // --- Particle data ---
    interface Particle {
      // Target positions for each shape
      targets: Record<ShapeType, [number, number, number]>;
      // Current interpolated 3D position
      cx: number; cy: number; cz: number;
      // Screen offset for scatter/mouse
      ox: number; oy: number;
      size: number;
      color: string;
      opacity: number;
      rotation: number;
      rotationSpeed: number;
      isAmbient: boolean;
      scatterAngle: number;
      scatterSpeed: number;
      vx: number;
      vy: number;
      // For ambient particles (2D only)
      x: number;
      y: number;
    }

    let particles: Particle[] = [];

    // Shape cycling
    const shapeOrder: ShapeType[] = ["tetra", "circles", "zap", "h"];
    let currentShapeIdx = 0;
    let nextShapeIdx = 1;
    let morphProgress = 0; // 0 = current shape, 1 = next shape
    const holdDuration = 3000; // ms to hold on each shape
    const morphDuration = 2500; // ms to morph between shapes
    let phaseStart = Date.now();
    let phase: "hold" | "morph" = "hold";

    // 3D rotation
    function rotateY(x: number, y: number, z: number, a: number): [number, number, number] {
      const c = Math.cos(a), s = Math.sin(a);
      return [x * c + z * s, y, -x * s + z * c];
    }
    function rotateX(x: number, y: number, z: number, a: number): [number, number, number] {
      const c = Math.cos(a), s = Math.sin(a);
      return [x, y * c - z * s, y * s + z * c];
    }

    const fov = 600;
    function project(x: number, y: number, z: number, cx: number, cy: number) {
      const depth = fov / (fov + z);
      return { x: cx + x * depth, y: cy + y * depth, scale: depth };
    }

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

      const clusterCount = Math.min(6000, Math.floor((width * height) / 200));

      for (let i = 0; i < clusterCount; i++) {
        // Generate target position for each shape
        const tetraPos = (() => {
          const face = tetraFaces[Math.floor(Math.random() * tetraFaces.length)];
          if (Math.random() < 0.3) {
            // Edge
            const edge = [face[0], face[Math.floor(Math.random() * 2) + 1]];
            const t = Math.random();
            const v0 = tetraVerts[edge[0]], v1 = tetraVerts[edge[1]];
            return [
              v0[0]*(1-t)+v1[0]*t + (Math.random()-0.5)*0.08,
              v0[1]*(1-t)+v1[1]*t + (Math.random()-0.5)*0.08,
              v0[2]*(1-t)+v1[2]*t + (Math.random()-0.5)*0.08,
            ] as [number, number, number];
          }
          return randPointOnFace(face);
        })();

        particles.push({
          targets: {
            tetra: tetraPos,
            circles: randPointOnCircles(),
            zap: randPointOnZap(),
            h: randPointOnH(),
          },
          cx: 0, cy: 0, cz: 0,
          ox: 0, oy: 0,
          size: 1 + Math.random() * 2.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: 0.35 + Math.random() * 0.5,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.015,
          isAmbient: false,
          scatterAngle: Math.random() * Math.PI * 2,
          scatterSpeed: 0.8 + Math.random() * 2.5,
          vx: 0, vy: 0,
          x: 0, y: 0,
        });
      }

      // Ambient particles
      const ambientCount = Math.min(200, Math.floor((width * height) / 4000));
      for (let i = 0; i < ambientCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        particles.push({
          targets: { tetra: [0,0,0], circles: [0,0,0], zap: [0,0,0], h: [0,0,0] },
          cx: 0, cy: 0, cz: 0,
          ox: 0, oy: 0,
          size: 4 + Math.random() * 1.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: 0.06 + Math.random() * 0.15,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.002,
          isAmbient: true,
          scatterAngle: 0, scatterSpeed: 0,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          x, y,
        });
      }
    }

    function drawTriangle(x: number, y: number, size: number, rotation: number, color: string, opacity: number) {
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

    let rotY = 0;
    let rotX = 0;

    function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

    // Easing for smooth morph
    function easeInOut(t: number) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      const scrollProgress = scrollProgressRef?.current ?? internalScrollRef.current;

      // Two-phase scroll: 0→0.3 drift to center, 0.3→1 scatter
      const centerPhase = Math.min(1, scrollProgress / 0.1); // 0→1 over first 10% of scroll
      const scatterPhase = Math.max(0, (scrollProgress - 0.1) / 0.9); // 0→1 over remaining 90%

      // Shape center moves from right (0.68) to center (0.5) as user scrolls
      const cx = width * (0.68 - centerPhase * 0.18);
      const cy = height * 0.5;
      const tetraScale = Math.min(width * 0.40, height * 0.40);

      // Shape cycling logic
      const now = Date.now();
      const elapsed = now - phaseStart;
      if (phase === "hold") {
        if (elapsed >= holdDuration) {
          phase = "morph";
          phaseStart = now;
          morphProgress = 0;
        }
      } else {
        morphProgress = elapsed / morphDuration;
        if (morphProgress >= 1) {
          currentShapeIdx = nextShapeIdx;
          nextShapeIdx = (nextShapeIdx + 1) % shapeOrder.length;
          phase = "hold";
          phaseStart = now;
          morphProgress = 0;
        }
      }

      const currentShape = shapeOrder[currentShapeIdx];
      const nextShape = shapeOrder[nextShapeIdx];
      const morphT = phase === "morph" ? easeInOut(morphProgress) : 0;

      // Rotation: auto-spin + drag inertia
      if (!drag.active) {
        rotY += drag.velY;
        rotX += drag.velX;
        drag.velY *= inertiaDamping;
        drag.velX *= inertiaDamping;
        if (Math.abs(drag.velY) < 0.001) rotY += 0.003;
        if (Math.abs(drag.velX) < 0.001) rotX += 0.001;
      }

      // Draw ambient particles first (background layer)
      for (const p of particles) {
        if (!p.isAmbient) continue;
        p.rotation += p.rotationSpeed;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
        drawTriangle(p.x, p.y, p.size, p.rotation, p.color, p.opacity);
      }

      // Compute and sort cluster particles by depth
      const clusterRenders: { x: number; y: number; z: number; scale: number; p: Particle }[] = [];

      for (const p of particles) {
        if (p.isAmbient) continue;
        p.rotation += p.rotationSpeed;

        // Get target positions for current and next shape
        const curTarget = p.targets[currentShape];
        const nextTarget = p.targets[nextShape];

        // Lerp between shapes
        const tx = lerp(curTarget[0], nextTarget[0], morphT) * tetraScale;
        const ty = lerp(curTarget[1], nextTarget[1], morphT) * tetraScale;
        const tz = lerp(curTarget[2], nextTarget[2], morphT) * tetraScale;

        // 3D rotation
        let [rx, ry, rz] = rotateY(tx, ty, tz, rotY);
        [rx, ry, rz] = rotateX(rx, ry, rz, rotX);

        // Project to screen
        const proj = project(rx, ry, rz, cx, cy);

        clusterRenders.push({ x: proj.x, y: proj.y, z: rz, scale: proj.scale, p });
      }

      // Sort far to near
      clusterRenders.sort((a, b) => a.z - b.z);

      for (const r of clusterRenders) {
        const p = r.p;
        let ox = 0;
        let oy = 0;

        // Scroll dispersion — only after shape has reached center
        if (scatterPhase > 0) {
          const scatterDist = scatterPhase * p.scatterSpeed * 400;
          ox = Math.cos(p.scatterAngle) * scatterDist;
          oy = Math.sin(p.scatterAngle) * scatterDist;
        }

        // Mouse repulsion (when not dragging)
        if (mouse.active && !drag.active) {
          const dx = r.x + ox - mouse.x;
          const dy = r.y + oy - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < repelRadius && dist > 0) {
            const force = (1 - dist / repelRadius) * repelStrength;
            ox += (dx / dist) * force;
            oy += (dy / dist) * force;
          }
        }

        // Organic motion
        const t = Date.now() * 0.0004;
        ox += Math.sin(t + p.targets[currentShape][0] * 0.01) * 0.5;
        oy += Math.cos(t + p.targets[currentShape][1] * 0.01) * 0.5;

        const finalX = r.x + ox;
        const finalY = r.y + oy;

        const depthOpacity = 0.4 + r.scale * 0.6;
        const dispersedOpacity = 0.08 + (1 - Math.min(1, scatterPhase)) * 0.4;
        const finalOpacity = p.opacity * depthOpacity * (scatterPhase > 0.05 ? dispersedOpacity : 1);

        drawTriangle(finalX, finalY, p.size * r.scale, p.rotation, p.color, finalOpacity);
      }

      animationId = requestAnimationFrame(animate);
    }

    function handleScroll() {
      internalScrollRef.current = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
    }

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "A" || target.tagName === "BUTTON" || target.tagName === "INPUT" || target.closest("a, button, input"))) return;
      if (e.clientX < width * 0.45) return;
      drag.active = true;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.velX = 0;
      drag.velY = 0;
    }

    function handleMouseMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
      if (!drag.active) return;
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      rotY += dx * dragSensitivity;
      rotX += dy * dragSensitivity;
      drag.velY = dx * dragSensitivity;
      drag.velX = dy * dragSensitivity;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
    }

    function handleMouseUp() { drag.active = false; }
    function handleMouseLeave() { mouse.active = false; mouse.x = -9999; mouse.y = -9999; }

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length === 0) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "A" || target.tagName === "BUTTON" || target.tagName === "INPUT" || target.closest("a, button, input"))) return;
      if (e.touches[0].clientX < width * 0.45) return;
      drag.active = true;
      drag.lastX = e.touches[0].clientX;
      drag.lastY = e.touches[0].clientY;
      drag.velX = 0; drag.velY = 0;
    }
    function handleTouchMove(e: TouchEvent) {
      if (!drag.active || e.touches.length === 0) return;
      const dx = e.touches[0].clientX - drag.lastX;
      const dy = e.touches[0].clientY - drag.lastY;
      rotY += dx * dragSensitivity;
      rotX += dy * dragSensitivity;
      drag.velY = dx * dragSensitivity;
      drag.velX = dy * dragSensitivity;
      drag.lastX = e.touches[0].clientX;
      drag.lastY = e.touches[0].clientY;
    }
    function handleTouchEnd() { drag.active = false; }

    resize();
    animate();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mouseout", handleMouseLeave, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    handleScroll();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mouseout", handleMouseLeave);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
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
