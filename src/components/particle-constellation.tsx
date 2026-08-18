"use client";

import { useEffect, useRef } from "react";

/**
 * Particle Constellation — 3D tetrahedron of triangular particles.
 *
 * Fixed full-viewport canvas behind all content.
 * Particles are distributed on the faces of a 3D tetrahedron,
 * which slowly rotates. Projected to 2D with perspective so
 * depth is visible (far particles = smaller, dimmer).
 * Disperses on scroll, reacts to mouse hover.
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

    // Mouse tracking for repulsion
    const mouse = { x: -9999, y: -9999, active: false };
    const repelRadius = 120;
    const repelStrength = 2.5;

    const colors = [
      "#8052ff", "#ffb829", "#15846e", "#ff6b9d",
      "#5b9eff", "#a78bfa", "#fbbf24", "#34d399",
    ];

    // 3D particle — lives on a tetrahedron face, gets projected to 2D each frame
    interface Particle3D {
      // 3D base position on tetrahedron (unit space, before scale/rotation)
      bx: number; // base 3D coords
      by: number;
      bz: number;
      // Current 2D screen position (computed each frame)
      x: number;
      y: number;
      // Screen-space offset for scatter/mouse interaction
      ox: number; // offset x
      oy: number; // offset y
      size: number;
      color: string;
      opacity: number;
      rotation: number;
      rotationSpeed: number;
      isAmbient: boolean;
      scatterAngle: number;
      scatterSpeed: number;
    }

    let particles: Particle3D[] = [];

    // Tetrahedron vertices (regular, centered at origin)
    const tetraVertices = [
      [1, 1, 1],
      [1, -1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
    ];

    // The 4 faces (each is 3 vertex indices)
    const tetraFaces = [
      [0, 1, 2],
      [0, 1, 3],
      [0, 2, 3],
      [1, 2, 3],
    ];

    // Random point on a triangle face using barycentric coordinates
    function randomPointOnFace(face: number[]): [number, number, number] {
      const [a, b, c] = face;
      const v0 = tetraVertices[a];
      const v1 = tetraVertices[b];
      const v2 = tetraVertices[c];
      let r1 = Math.random();
      let r2 = Math.random();
      if (r1 + r2 > 1) {
        r1 = 1 - r1;
        r2 = 1 - r2;
      }
      const r3 = 1 - r1 - r2;
      return [
        v0[0] * r1 + v1[0] * r2 + v2[0] * r3,
        v0[1] * r1 + v1[1] * r2 + v2[1] * r3,
        v0[2] * r1 + v1[2] * r2 + v2[2] * r3,
      ];
    }

    // 3D rotation matrices
    function rotateY(x: number, y: number, z: number, angle: number): [number, number, number] {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return [x * cos + z * sin, y, -x * sin + z * cos];
    }

    function rotateX(x: number, y: number, z: number, angle: number): [number, number, number] {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return [x, y * cos - z * sin, y * sin + z * cos];
    }

    // Perspective projection
    const fov = 600;
    function project(x: number, y: number, z: number, cx: number, cy: number): { x: number; y: number; scale: number } {
      const depth = fov / (fov + z);
      return {
        x: cx + x * depth,
        y: cy + y * depth,
        scale: depth,
      };
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

      // Tetrahedron cluster — particles on faces, positioned right side of hero
      const clusterCount = Math.min(8000, Math.floor((width * height) / 500));
      const tetraScale = Math.min(width * 0.18, height * 0.28);

      for (let i = 0; i < clusterCount; i++) {
        const face = tetraFaces[Math.floor(Math.random() * tetraFaces.length)];
        // 70% on faces, 30% on edges (thicker edges for wireframe feel)
        let point: [number, number, number];
        if (Math.random() < 0.3) {
          // Snap toward an edge — pick two vertices, interpolate
          const edge = [face[0], face[Math.floor(Math.random() * 2) + 1]];
          const t = Math.random();
          const v0 = tetraVertices[edge[0]];
          const v1 = tetraVertices[edge[1]];
          point = [
            v0[0] * (1 - t) + v1[0] * t,
            v0[1] * (1 - t) + v1[1] * t,
            v0[2] * (1 - t) + v1[2] * t,
          ];
          // Add slight jitter so edges aren't perfectly straight
          point[0] += (Math.random() - 0.5) * 0.08;
          point[1] += (Math.random() - 0.5) * 0.08;
          point[2] += (Math.random() - 0.5) * 0.08;
        } else {
          point = randomPointOnFace(face);
          // Add slight jitter for organic feel
          point[0] += (Math.random() - 0.5) * 0.1;
          point[1] += (Math.random() - 0.5) * 0.1;
          point[2] += (Math.random() - 0.5) * 0.1;
        }

        // Scale to tetrahedron size
        const bx = point[0] * tetraScale;
        const by = point[1] * tetraScale;
        const bz = point[2] * tetraScale;

        particles.push({
          bx,
          by,
          bz,
          x: 0,
          y: 0,
          ox: 0,
          oy: 0,
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

      // Ambient particles scattered across full viewport (2D, no 3D)
      const ambientCount = Math.min(1500, Math.floor((width * height) / 4000));
      for (let i = 0; i < ambientCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        particles.push({
          bx: 0,
          by: 0,
          bz: 0,
          x,
          y,
          ox: 0,
          oy: 0,
          size: 4 + Math.random() * 1.5,
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

    // Rotation angles — accumulate over time for continuous spin
    let rotY = 0;
    let rotX = 0;

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      const scrollProgress = scrollProgressRef?.current ?? internalScrollRef.current;
      const cx = width * 0.68; // tetrahedron center on screen
      const cy = height * 0.5;

      // Slow auto-rotation
      rotY += 0.003;
      rotX += 0.001;

      // Sort cluster particles by depth for proper z-ordering
      const clusterParticles: { p: Particle3D; z: number; screenX: number; screenY: number; scale: number }[] = [];

      for (const p of particles) {
        p.rotation += p.rotationSpeed;

        if (p.isAmbient) {
          // Ambient: 2D drift, wrap around
          p.x += (Math.random() - 0.5) * 0.1;
          p.y += (Math.random() - 0.5) * 0.1;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
          if (p.y < -10) p.y = height + 10;
          if (p.y > height + 10) p.y = -10;
          drawTriangle(p.x, p.y, p.size, p.rotation, p.color, p.opacity);
        } else {
          // 3D tetrahedron particle: rotate, project, draw
          let [rx, ry, rz] = rotateY(p.bx, p.by, p.bz, rotY);
          [rx, ry, rz] = rotateX(rx, ry, rz, rotX);

          const proj = project(rx, ry, rz, cx, cy);
          const screenX = proj.x;
          const screenY = proj.y;
          const depthScale = proj.scale; // <1 when far, >1 when near

          // Store for depth sorting
          clusterParticles.push({ p, z: rz, screenX, screenY, scale: depthScale });
        }
      }

      // Sort by z (far to near) so near particles draw on top
      clusterParticles.sort((a, b) => a.z - b.z);

      for (const { p, z, screenX, screenY, scale } of clusterParticles) {
        // Scatter offset for scroll dispersion
        let ox = 0;
        let oy = 0;

        if (scrollProgress > 0) {
          const scatterDist = scrollProgress * p.scatterSpeed * 400;
          ox = Math.cos(p.scatterAngle) * scatterDist;
          oy = Math.sin(p.scatterAngle) * scatterDist;
        }

        // Mouse repulsion (in screen space)
        if (mouse.active) {
          const dx = screenX + ox - mouse.x;
          const dy = screenY + oy - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < repelRadius && dist > 0) {
            const force = (1 - dist / repelRadius) * repelStrength;
            ox += (dx / dist) * force;
            oy += (dy / dist) * force;
          }
        }

        // Organic motion
        const t = Date.now() * 0.0004;
        ox += Math.sin(t + p.bx * 0.01) * 0.5;
        oy += Math.cos(t + p.by * 0.01) * 0.5;

        const finalX = screenX + ox;
        const finalY = screenY + oy;

        // Size and opacity scaled by depth
        const depthOpacity = 0.4 + scale * 0.6; // far = dimmer, near = brighter
        const dispersedOpacity = 0.08 + (1 - Math.min(1, scrollProgress)) * 0.4;
        const finalOpacity = p.opacity * depthOpacity * (scrollProgress > 0.05 ? dispersedOpacity : 1);

        drawTriangle(finalX, finalY, p.size * scale, p.rotation, p.color, finalOpacity);
      }

      animationId = requestAnimationFrame(animate);
    }

    function handleScroll() {
      const scrollY = window.scrollY;
      const heroHeight = window.innerHeight;
      internalScrollRef.current = Math.min(1, Math.max(0, scrollY / heroHeight));
    }

    function handleMouseMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    }

    function handleMouseLeave() {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    }

    resize();
    animate();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseout", handleMouseLeave, { passive: true });
    handleScroll();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseout", handleMouseLeave);
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
