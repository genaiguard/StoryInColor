"use client";

/**
 * 3D rotating head for the upload screens. Loads the LeePerrySmith GLB
 * face-scan model and renders it as a wireframe mesh — the dense triangle
 * grid reads as a human face while giving the AI / biometric-scan look.
 *
 * Corner-bracket SVG overlays add a targeting-reticle feel.
 */

import { useEffect, useRef } from "react";
import type * as THREE from "three";

interface Head3DProps {
  variant: "front" | "side";
  gender?: "male" | "female" | "other";
  className?: string;
}

const HEAD_URL = "/face-rating/head-male.glb";

export default function Head3D({
  variant,
  // gender is accepted for forward-compat (gender-aware variants may
  // return later) but the LeePerrySmith head reads as universal so all
  // genders currently render the same model.
  gender: _gender,
  className = "",
}: Head3DProps) {
  void _gender;
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = canvasRef.current;
    if (!container) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import(
        "three/examples/jsm/loaders/GLTFLoader.js"
      );
      if (cancelled || !container) return;

      const w0 = Math.max(1, container.clientWidth);
      const h0 = Math.max(1, container.clientHeight);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, w0 / h0, 0.1, 100);
      camera.position.set(0, 0, 3.2);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w0, h0);
      renderer.setClearColor(0x000000, 0);
      renderer.localClippingEnabled = true;
      renderer.domElement.style.display = "block";
      container.appendChild(renderer.domElement);

      const headGroup = new THREE.Group();

      try {
        const gltf = await new GLTFLoader().loadAsync(HEAD_URL);
        if (cancelled) return;

        gltf.scene.scale.setScalar(0.16);
        gltf.scene.position.y = -0.05;

        const clipPlanes: InstanceType<typeof THREE.Plane>[] = [];

        gltf.scene.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;

          const wireGeo = new THREE.WireframeGeometry(mesh.geometry);
          const wireMat = new THREE.LineBasicMaterial({
            color:          0xffffff,
            opacity:        0.28,
            transparent:    true,
            clippingPlanes: clipPlanes,
          });
          const lines = new THREE.LineSegments(wireGeo, wireMat);
          lines.scale.copy(mesh.scale);
          lines.position.copy(mesh.position);
          lines.rotation.copy(mesh.rotation);
          mesh.parent?.add(lines);
          mesh.visible = false;
        });

        headGroup.add(gltf.scene);
        scene.add(headGroup);
      } catch (err) {
        console.warn("[Head3D] GLB load failed:", err);
        return;
      }

      // Cyan scan line — sweeps top → bottom every 3.5 s.
      const scanGeo  = new THREE.PlaneGeometry(1.6, 0.002);
      const scanMat  = new THREE.MeshBasicMaterial({
        color: 0xaaddff, opacity: 0, transparent: true, side: THREE.DoubleSide,
      });
      const scanMesh = new THREE.Mesh(scanGeo, scanMat);
      headGroup.add(scanMesh);

      const t0 = performance.now();
      let raf  = 0;

      const animate = () => {
        if (cancelled) return;
        const t = (performance.now() - t0) / 1000;

        if (variant === "front") {
          headGroup.rotation.y = Math.sin(t * 0.4)  * 0.18;
          headGroup.rotation.x = Math.sin(t * 0.35) * 0.05;
        } else {
          headGroup.rotation.y = Math.PI / 2 + Math.sin(t * 0.3) * 0.4;
          headGroup.rotation.x = Math.sin(t * 0.25) * 0.04;
        }

        const phase = (t % 3.5) / 3.5;
        scanMesh.position.y = 0.9 - phase * 1.8;
        scanMat.opacity = Math.min(phase * 7, (1 - phase) * 7, 1.0) * 0.60;

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
        scene.traverse((obj) => {
          const m = obj as THREE.Mesh;
          if (m.isMesh) m.geometry?.dispose();
        });
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
  }, [variant]);

  return (
    <div className={`relative ${className}`} aria-hidden="true">
      <div ref={canvasRef} className="absolute inset-0" />
      <CornerBrackets />
    </div>
  );
}

function CornerBrackets() {
  const S = 18;
  const corners = [
    { top: true,  left: true  },
    { top: true,  left: false },
    { top: false, left: true  },
    { top: false, left: false },
  ] as const;
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
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1.5"
              strokeLinecap="square"
            />
          </svg>
        );
      })}
    </>
  );
}
