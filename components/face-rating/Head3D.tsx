"use client";

/**
 * 3D rotating head for the upload screens. Vanilla three.js — no
 * react-three-fiber, no react-reconciler, no JSX namespace augmentation.
 * Just a useEffect that mounts a three.js scene into a div ref.
 *
 * three.js is a pure canvas-rendering library; it doesn't touch React
 * internals at all. So this approach is immune to the React-version
 * mismatch that broke the R3F attempt.
 *
 * Lazy-loaded via next/dynamic in the call site so the ~150KB three.js
 * bundle and 400KB GLB only ship on the upload screens that mount it.
 */

import { useEffect, useRef } from "react";
// Types only — actual three.js is loaded lazily inside the useEffect
// below via dynamic import().
import type * as THREE from "three";

interface Head3DProps {
  /** Front variant rocks gently side-to-side; side variant orbits the
   *  90° profile anchor. */
  variant: "front" | "side";
  className?: string;
}

const HEAD_URL = "/face-rating/head.glb";

export default function Head3D({ variant, className = "" }: Head3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import(
        "three/examples/jsm/loaders/GLTFLoader.js"
      );
      if (cancelled || !container) return;

      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
      camera.position.set(0, 0, 3.2);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.display = "block";
      container.appendChild(renderer.domElement);

      // Soft three-point editorial lighting.
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 0.6);
      key.position.set(3, 2, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xdde6ff, 0.35);
      rim.position.set(-3, 1, -2);
      scene.add(rim);
      const fill = new THREE.PointLight(0xffffff, 0.2);
      fill.position.set(0, 0, 3);
      scene.add(fill);

      // Load the head.
      const loader = new GLTFLoader();
      const headGroup = new THREE.Group();
      try {
        const gltf = await loader.loadAsync(HEAD_URL);
        if (cancelled) return;
        gltf.scene.traverse((child) => {
          const maybeMesh = child as THREE.Mesh;
          if (maybeMesh.isMesh) {
            // Wireframe + soft fill — reads as a face-mesh scan, not a
            // photorealistic stranger.
            maybeMesh.material = new THREE.MeshStandardMaterial({
              color: new THREE.Color("#1a1a1a"),
              emissive: new THREE.Color("#ffffff"),
              emissiveIntensity: 0.04,
              wireframe: true,
              transparent: true,
              opacity: 0.85,
            });
          }
        });
        gltf.scene.scale.setScalar(0.16);
        gltf.scene.position.y = -0.05;
        headGroup.add(gltf.scene);
        scene.add(headGroup);
      } catch (err) {
        // Loading failed — give up silently. Fallback SVG underneath
        // remains visible to the user.
        console.warn("[Head3D] failed to load head.glb:", err);
        return;
      }

      // Animate.
      const startMs = performance.now();
      let raf = 0;
      const animate = () => {
        if (cancelled) return;
        const t = (performance.now() - startMs) / 1000;
        if (variant === "front") {
          headGroup.rotation.y = Math.sin(t * 0.4) * 0.18;
          headGroup.rotation.x = Math.sin(t * 0.35) * 0.05;
        } else {
          headGroup.rotation.y =
            Math.PI / 2 + Math.sin(t * 0.3) * 0.4;
          headGroup.rotation.x = Math.sin(t * 0.25) * 0.04;
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();

      // Resize handler.
      const onResize = () => {
        if (!container) return;
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      // Pause animation when not visible (saves battery on mobile).
      let visible = true;
      const onVisibility = () => {
        const wasVisible = visible;
        visible = document.visibilityState === "visible";
        if (!wasVisible && visible) {
          // Resume.
          raf = requestAnimationFrame(animate);
        }
        if (wasVisible && !visible) {
          cancelAnimationFrame(raf);
        }
      };
      document.addEventListener("visibilitychange", onVisibility);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVisibility);
        scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose();
            const mats = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            mats.forEach((m) => m?.dispose());
          }
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

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}
