"use client";

/**
 * Procedural biometric face wireframe for the upload screens.
 *
 * Replaces the GLB sculpture approach with a Three.js landmark mesh that
 * reads as an AI facial-analysis visualization rather than a museum bust.
 *
 * Design language:
 *   - White topology lines in three opacity tiers (outline / features / structure)
 *   - Pulsing white dots at key anatomical landmarks
 *   - Cyan (#aaddff) scan line sweeping top-to-bottom, looping every 3.5s
 *   - Corner bracket overlay — biometric / targeting-reticle feel
 *   - Gender-differentiated through facial proportions only (no separate models)
 *   - No external GLB files; pure Three.js geometry
 *
 * Both front and side variants use the same 3D landmark geometry. The side
 * variant pre-rotates ~70° around y to expose the natural profile silhouette
 * produced by the z-depth in the front face landmarks.
 */

import { useEffect, useRef } from "react";

interface Head3DProps {
  variant: "front" | "side";
  gender?: "male" | "female" | "other";
  className?: string;
}

type V3 = [number, number, number];
type Edge = { a: number; b: number; tier: 1 | 2 | 3 };

// ── FRONT FACE ──────────────────────────────────────────────────────────────
// Coordinate space: x ∈ [-1,1] right, y ∈ [-1,1] up, z ∈ [-0.1, 0.15] depth.
// Origin at facial center.

function frontPts(g: "male" | "female" | "other"): V3[] {
  const f = g === "female";

  const jw  = f ? 0.48 : 0.60;    // jaw width
  const fw  = f ? 0.58 : 0.66;    // forehead width
  const ckw = f ? 0.62 : 0.70;    // cheekbone width
  const fh  = f ? 0.86 : 0.83;    // face half-height (crown)
  const cY  = f ? -0.82 : -0.83;  // chin Y
  const eyY = f ? 0.13 : 0.10;    // eye centre Y
  const eyX = f ? 0.19 : 0.21;    // eye centre X
  const eyW = f ? 0.155 : 0.140;  // eye half-width
  const eyH = f ? 0.052 : 0.043;  // eye half-height
  const bwY = f ? 0.240 : 0.230;  // brow Y
  const bwX = f ? 0.210 : 0.220;  // brow half-span
  const bwA = f ? 0.038 : 0.015;  // brow arch
  const nW  = f ? 0.095 : 0.120;  // nostril X
  const nTY = f ? -0.210 : -0.230;// nose tip Y
  const mW  = f ? 0.180 : 0.220;  // mouth half-width
  const mY  = f ? -0.410 : -0.430;// mouth Y
  const lT  = f ? 0.033 : 0.027;  // lip thickness

  return [
    // 0-11  face outline
    [  0,         fh,         -0.08 ], // 0  crown
    [  fw*0.52,   fh*0.72,    -0.04 ], // 1  R upper forehead
    [  fw,        fh*0.30,     0.00 ], // 2  R temple
    [  ckw,       0.04,        0.05 ], // 3  R cheekbone
    [  jw,       -fh*0.44,     0.02 ], // 4  R jaw
    [  jw*0.28,  -fh*0.76,     0.00 ], // 5  R chin-jaw
    [  0,         cY,          0.00 ], // 6  chin tip
    [ -jw*0.28,  -fh*0.76,     0.00 ], // 7  L chin-jaw
    [ -jw,       -fh*0.44,     0.02 ], // 8  L jaw
    [ -ckw,       0.04,        0.05 ], // 9  L cheekbone
    [ -fw,        fh*0.30,     0.00 ], // 10 L temple
    [ -fw*0.52,   fh*0.72,    -0.04 ], // 11 L upper forehead

    // 12-18  midline
    [  0,         fh*0.67,    -0.04 ], // 12 forehead centre
    [  0,         0.09,        0.08 ], // 13 nose root / glabella
    [  0,         nTY+0.07,    0.12 ], // 14 nose bridge mid
    [  0,         nTY,         0.13 ], // 15 nose tip
    [  0,         mY+lT,       0.09 ], // 16 upper lip centre
    [  0,         mY-lT,       0.08 ], // 17 lower lip centre
    [  0,        -fh*0.62,     0.03 ], // 18 chin centre

    // 19-22  right eye
    [  eyX+eyW,   eyY,         0.11 ], // 19 outer
    [  eyX,       eyY+eyH,     0.12 ], // 20 top
    [  eyX-eyW,   eyY,         0.12 ], // 21 inner
    [  eyX,       eyY-eyH,     0.11 ], // 22 bottom

    // 23-26  left eye
    [ -eyX-eyW,   eyY,         0.11 ], // 23 outer
    [ -eyX,       eyY+eyH,     0.12 ], // 24 top
    [ -eyX+eyW,   eyY,         0.12 ], // 25 inner
    [ -eyX,       eyY-eyH,     0.11 ], // 26 bottom

    // 27-29  right brow
    [  eyX+bwX,   bwY,         0.09 ], // 27 outer
    [  eyX,       bwY+bwA,     0.10 ], // 28 peak
    [  eyX-bwX,   bwY,         0.10 ], // 29 inner

    // 30-32  left brow
    [ -eyX-bwX,   bwY,         0.09 ], // 30 outer
    [ -eyX,       bwY+bwA,     0.10 ], // 31 peak
    [ -eyX+bwX,   bwY,         0.10 ], // 32 inner

    // 33-34  nostrils
    [  nW,        nTY+0.05,    0.12 ], // 33 right
    [ -nW,        nTY+0.05,    0.12 ], // 34 left

    // 35-40  mouth
    [  mW,        mY,          0.09 ], // 35 R corner
    [ -mW,        mY,          0.09 ], // 36 L corner
    [  mW*0.48,   mY+lT,       0.10 ], // 37 R upper lip
    [ -mW*0.48,   mY+lT,       0.10 ], // 38 L upper lip
    [  mW*0.48,   mY-lT,       0.09 ], // 39 R lower lip
    [ -mW*0.48,   mY-lT,       0.09 ], // 40 L lower lip

    // 41-42  philtrum
    [  nW*0.40,   mY+lT+0.06,  0.10 ], // 41 right
    [ -nW*0.40,   mY+lT+0.06,  0.10 ], // 42 left
  ];
}

function frontEdges(): Edge[] {
  return [
    // Tier 1 — face outline
    { a:0,  b:1,  tier:1 }, { a:1,  b:2,  tier:1 }, { a:2,  b:3,  tier:1 },
    { a:3,  b:4,  tier:1 }, { a:4,  b:5,  tier:1 }, { a:5,  b:6,  tier:1 },
    { a:6,  b:7,  tier:1 }, { a:7,  b:8,  tier:1 }, { a:8,  b:9,  tier:1 },
    { a:9,  b:10, tier:1 }, { a:10, b:11, tier:1 }, { a:11, b:0,  tier:1 },

    // Tier 2 — midline / nose
    { a:0,  b:12, tier:2 }, { a:12, b:13, tier:2 }, { a:13, b:14, tier:2 },
    { a:14, b:15, tier:2 }, { a:15, b:41, tier:2 }, { a:15, b:42, tier:2 },
    { a:41, b:16, tier:2 }, { a:42, b:16, tier:2 },
    { a:17, b:18, tier:2 }, { a:18, b:6,  tier:2 },
    { a:13, b:33, tier:2 }, { a:13, b:34, tier:2 },
    { a:33, b:15, tier:2 }, { a:34, b:15, tier:2 },

    // Tier 2 — right eye
    { a:19, b:20, tier:2 }, { a:20, b:21, tier:2 },
    { a:21, b:22, tier:2 }, { a:22, b:19, tier:2 },
    // Tier 2 — left eye
    { a:23, b:24, tier:2 }, { a:24, b:25, tier:2 },
    { a:25, b:26, tier:2 }, { a:26, b:23, tier:2 },

    // Tier 2 — brows
    { a:27, b:28, tier:2 }, { a:28, b:29, tier:2 },
    { a:30, b:31, tier:2 }, { a:31, b:32, tier:2 },

    // Tier 2 — mouth
    { a:35, b:37, tier:2 }, { a:37, b:16, tier:2 },
    { a:16, b:38, tier:2 }, { a:38, b:36, tier:2 },
    { a:35, b:39, tier:2 }, { a:39, b:17, tier:2 },
    { a:17, b:40, tier:2 }, { a:40, b:36, tier:2 },

    // Tier 3 — structural cross-connections
    { a:12, b:28, tier:3 }, { a:12, b:31, tier:3 }, // forehead → brow peaks
    { a:1,  b:27, tier:3 }, { a:11, b:30, tier:3 }, // forehead → brow outer
    { a:29, b:21, tier:3 }, { a:32, b:25, tier:3 }, // brow inner → eye inner
    { a:27, b:19, tier:3 }, { a:30, b:23, tier:3 }, // brow outer → eye outer
    { a:29, b:13, tier:3 }, { a:32, b:13, tier:3 }, // brow inner → nose root
    { a:3,  b:19, tier:3 }, { a:9,  b:23, tier:3 }, // cheekbone → eye outer
    { a:3,  b:33, tier:3 }, { a:9,  b:34, tier:3 }, // cheekbone → nostril
    { a:22, b:33, tier:3 }, { a:26, b:34, tier:3 }, // eye bottom → nostril (NL fold)
    { a:4,  b:35, tier:3 }, { a:8,  b:36, tier:3 }, // jaw → mouth corner
    { a:5,  b:39, tier:3 }, { a:7,  b:40, tier:3 }, // chin-jaw → lower lip
    { a:1,  b:20, tier:3 }, { a:11, b:24, tier:3 }, // forehead → eye top
    { a:2,  b:27, tier:3 }, { a:10, b:30, tier:3 }, // temple → brow outer
  ];
}

// ── SIDE PROFILE ────────────────────────────────────────────────────────────
// 22-point outline gives a smooth, recognisable head silhouette without the
// blocky look of a coarse polygon. All z=0 (profile in x-y plane); gentle
// y-axis rocking reveals the slight 3D feel of a flat silhouette.

function sidePts(g: "male" | "female" | "other"): V3[] {
  const f = g === "female";
  // Nose protrusion and chin shape vary by gender.
  const nP  = f ? 0.17 : 0.22;    // peak nose protrusion
  const cP  = f ? 0.07 : 0.10;    // chin protrusion (x)
  const bP  = f ? 0.09 : 0.13;    // brow protrusion
  const nTY = f ? -0.20 : -0.23;  // nose tip Y

  // Face outline: clockwise starting from crown (face looks right = +x)
  const outline: V3[] = [
    [  0.00,   0.86, 0.0 ], // 0  crown
    [  0.06,   0.76, 0.0 ], // 1  upper forehead
    [  0.09,   0.58, 0.0 ], // 2  mid forehead
    [  bP,     0.26, 0.0 ], // 3  brow ridge
    [  bP-0.02,0.12, 0.0 ], // 4  glabella (concave)
    [  nP-0.06,0.02, 0.0 ], // 5  nose root
    [  nP,     nTY+0.09, 0.0 ], // 6  nose upper
    [  nP,     nTY,  0.0 ], // 7  nose tip
    [  nP-0.08,nTY-0.07,0.0 ], // 8  subnasal
    [  cP+0.04,-0.38,0.0 ], // 9  upper lip
    [  cP+0.02,-0.46,0.0 ], // 10 lips
    [  cP,    -0.54,0.0  ], // 11 lower lip
    [  cP+0.01,-0.61,0.0 ], // 12 chin bump
    [  0.02,  -0.70,0.0  ], // 13 chin tip
    [ -0.06,  -0.80,0.0  ], // 14 chin-neck
    [ -0.20,  -0.83,0.0  ], // 15 neck base
    [ -0.36,  -0.72,0.0  ], // 16 jaw angle
    [ -0.54,  -0.32,0.0  ], // 17 post-ear
    [ -0.63,   0.08,0.0  ], // 18 rear mid
    [ -0.60,   0.50,0.0  ], // 19 rear upper
    [ -0.38,   0.78,0.0  ], // 20 rear crown
    // 0 closes back to crown
  ];

  // Ear (4 points, sits around index 17 on the outline)
  const ear: V3[] = [
    [ -0.46,  0.04, 0.0 ], // 21 ear top
    [ -0.52, -0.08, 0.0 ], // 22 ear mid
    [ -0.48, -0.20, 0.0 ], // 23 ear bottom
  ];

  // Eye marker
  const eye: V3 = [ bP-0.03, 0.12, 0.0 ]; // 24

  return [...outline, ...ear, eye];
}

function sideEdges(): Edge[] {
  const outline: Edge[] = [];
  for (let i = 0; i < 21; i++) {
    outline.push({ a: i, b: i === 20 ? 0 : i + 1, tier: 1 });
  }
  return [
    ...outline,
    // Ear
    { a: 21, b: 22, tier: 2 }, { a: 22, b: 23, tier: 2 },
    { a: 17, b: 21, tier: 2 }, { a: 17, b: 23, tier: 2 },
    // Brow to eye
    { a: 3,  b: 24, tier: 2 },
    // Structural: forehead diagonal
    { a: 1,  b: 20, tier: 3 },
    { a: 3,  b: 21, tier: 3 },
    { a: 16, b: 23, tier: 3 },
  ];
}

// ── COMPONENT ───────────────────────────────────────────────────────────────

export default function Head3D({
  variant,
  gender = "other",
  className = "",
}: Head3DProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = canvasRef.current;
    if (!container) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const THREE = await import("three");
      if (cancelled || !container) return;

      const w0 = Math.max(1, container.clientWidth);
      const h0 = Math.max(1, container.clientHeight);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(28, w0 / h0, 0.1, 100);
      camera.position.set(0, 0, 5.0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w0, h0);
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.display = "block";
      container.appendChild(renderer.domElement);

      const g = gender === "female" ? "female" : gender === "male" ? "male" : "other";
      const pts   = variant === "side" ? sidePts(g)   : frontPts(g);
      const edges = variant === "side" ? sideEdges()  : frontEdges();

      const faceGroup = new THREE.Group();
      scene.add(faceGroup);

      // Build line geometry batched by tier
      const pos1: number[] = [], pos2: number[] = [], pos3: number[] = [];
      for (const e of edges) {
        const a = pts[e.a], b = pts[e.b];
        if (!a || !b) continue;
        const arr = e.tier === 1 ? pos1 : e.tier === 2 ? pos2 : pos3;
        arr.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }

      const tierDefs: [number[], number][] = [
        [pos1, 0.55], // outline
        [pos2, 0.30], // features
        [pos3, 0.13], // structural
      ];
      for (const [pos, opacity] of tierDefs) {
        if (pos.length === 0) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        faceGroup.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
          color: 0xffffff, opacity, transparent: true,
        })));
      }

      // Key landmark dots
      const dotIdxFront = [0, 6, 15, 19, 21, 23, 25, 28, 31, 35, 36, 3, 9];
      const dotIdxSide  = [0, 3, 7, 13, 21, 24];
      const dotPos: number[] = [];
      for (const i of (variant === "side" ? dotIdxSide : dotIdxFront)) {
        const p = pts[i];
        if (p) dotPos.push(p[0], p[1], p[2]);
      }
      const dotGeo = new THREE.BufferGeometry();
      dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(dotPos, 3));
      const dotMat = new THREE.PointsMaterial({
        color: 0xffffff, size: 0.028, sizeAttenuation: true,
        opacity: 1.0, transparent: true,
      });
      faceGroup.add(new THREE.Points(dotGeo, dotMat));

      // Cyan scan line
      const scanGeo = new THREE.PlaneGeometry(1.55, 0.003);
      const scanMat = new THREE.MeshBasicMaterial({
        color: 0xaaddff, opacity: 0, transparent: true, side: THREE.DoubleSide,
      });
      const scanMesh = new THREE.Mesh(scanGeo, scanMat);
      faceGroup.add(scanMesh);

      const t0 = performance.now();
      let raf = 0;

      const animate = () => {
        if (cancelled) return;
        const t = (performance.now() - t0) / 1000;

        if (variant === "front") {
          faceGroup.rotation.y = Math.sin(t * 0.38) * 0.16;
          faceGroup.rotation.x = Math.sin(t * 0.31) * 0.04;
        } else {
          faceGroup.rotation.y = Math.sin(t * 0.30) * 0.10;
          faceGroup.rotation.x = Math.sin(t * 0.22) * 0.03;
        }

        // Scan: top → bottom, 3.5s period
        const phase = (t % 3.5) / 3.5;
        scanMesh.position.y = 0.95 - phase * 1.92;
        scanMat.opacity = Math.min(phase * 7, (1 - phase) * 7, 1.0) * 0.62;

        // Pulse dots
        dotMat.opacity = 0.60 + 0.40 * Math.sin(t * 2.5);

        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();

      const onResize = () => {
        if (!container) return;
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      let visible = true;
      const onVis = () => {
        const now = document.visibilityState === "visible";
        if (!visible && now) raf = requestAnimationFrame(animate);
        if (visible && !now) cancelAnimationFrame(raf);
        visible = now;
      };
      document.addEventListener("visibilitychange", onVis);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVis);
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [variant, gender]);

  return (
    <div className={`relative ${className}`} aria-hidden="true">
      {/* Canvas mount point */}
      <div ref={canvasRef} className="absolute inset-0" />

      {/* Corner bracket overlays — biometric viewfinder feel */}
      <CornerBrackets />
    </div>
  );
}

function CornerBrackets() {
  const S = 18; // arm length px
  const W = 1.5;
  const C = "rgba(255,255,255,0.25)";
  const corners = [
    { top: true,  left: true  },
    { top: true,  left: false },
    { top: false, left: true  },
    { top: false, left: false },
  ];
  return (
    <>
      {corners.map(({ top, left }) => {
        const d = top && left
          ? `M 1,${S+1} L 1,1 L ${S+1},1`
          : top && !left
          ? `M 1,1 L ${S+1},1 L ${S+1},${S+1}`
          : !top && left
          ? `M 1,1 L 1,${S+1} L ${S+1},${S+1}`
          : `M ${S+1},1 L ${S+1},${S+1} L 1,${S+1}`;
        return (
          <svg
            key={`${top}-${left}`}
            width={S + 2}
            height={S + 2}
            viewBox={`0 0 ${S + 2} ${S + 2}`}
            style={{
              position: "absolute",
              top:    top  ? 8 : undefined,
              bottom: !top ? 8 : undefined,
              left:   left ? 8 : undefined,
              right:  !left? 8 : undefined,
              pointerEvents: "none",
            }}
          >
            <path
              d={d}
              fill="none"
              stroke={C}
              strokeWidth={W}
              strokeLinecap="square"
            />
          </svg>
        );
      })}
    </>
  );
}
