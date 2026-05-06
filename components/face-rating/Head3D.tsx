"use client";

/**
 * 3D rotating head for the upload screens. Vanilla three.js — no
 * react-three-fiber, so it's immune to the React-version mismatch
 * that broke the R3F attempt.
 *
 * Two models, swapped by user-selected gender:
 *   - Male / unspecified → LeePerrySmith.glb (public-domain photoscan
 *     used in the three.js example gallery for years).
 *   - Female → Nefertiti.glb (the famous Egyptian queen bust, also
 *     public domain, also from three.js examples). Distinct silhouette
 *     with a headpiece that reads as an elaborate hairline.
 *
 * Both rendered as alabaster sculptures with museum-style overhead key
 * lighting. Reads as editorial art-object portraits, not Pixar
 * cartoons or wireframe scan visualizations.
 *
 * Lazy-loaded via next/dynamic in the call site so the ~150KB three.js
 * bundle and ~400KB–1.2MB GLBs only ship on the upload screens.
 */

import { useEffect, useRef } from "react";
import type * as THREE from "three";

interface Head3DProps {
  /** Front variant rocks gently side-to-side; side variant orbits the
   *  90° profile anchor. */
  variant: "front" | "side";
  /** User-selected gender. Female loads Nefertiti; everything else
   *  (male, "prefer not to say", unspecified) loads LeePerrySmith. */
  gender?: "male" | "female" | "other";
  className?: string;
}

const MALE_HEAD_URL = "/face-rating/head-male.glb";
const FEMALE_HEAD_URL = "/face-rating/head-female.glb";

export default function Head3D({
  variant,
  gender,
  className = "",
}: Head3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = containerRef.current;
    if (!container) return;

    const headUrl = gender === "female" ? FEMALE_HEAD_URL : MALE_HEAD_URL;
    // Female model (Nefertiti) is taller than the male head — needs a
    // smaller scale to fit the same canvas. Y-offset compensates so
    // both center vertically.
    const headScale = gender === "female" ? 0.04 : 0.16;
    const headYOffset = gender === "female" ? -0.5 : -0.05;

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

      // Museum-style alabaster lighting.
      //   - Slightly cool ambient lift so shadows don't go pure black on
      //     the white material.
      //   - Strong overhead key (slightly warm) — like a gallery spotlight.
      //   - Soft front fill so eye sockets / facial concavities don't
      //     disappear into shadow.
      //   - Subtle cool back-fill for depth separation.
      scene.add(new THREE.AmbientLight(0xeae6ff, 0.35));
      const key = new THREE.DirectionalLight(0xfff4e0, 1.4);
      key.position.set(0.8, 4, 2.5);
      scene.add(key);
      const front = new THREE.DirectionalLight(0xffffff, 0.55);
      front.position.set(0.5, 0.5, 4);
      scene.add(front);
      const back = new THREE.DirectionalLight(0xc8d0ff, 0.45);
      back.position.set(-1.5, 1.5, -3);
      scene.add(back);

      const loader = new GLTFLoader();
      const headGroup = new THREE.Group();
      try {
        const gltf = await loader.loadAsync(headUrl);
        if (cancelled) return;
        gltf.scene.traverse((child) => {
          const maybeMesh = child as THREE.Mesh;
          if (maybeMesh.isMesh) {
            // Warm off-white alabaster. Reads as a marble bust under
            // museum lighting. Not chalky, not metallic — sculptural.
            maybeMesh.material = new THREE.MeshStandardMaterial({
              color: new THREE.Color("#f0e9dc"),
              roughness: 0.55,
              metalness: 0.05,
              emissive: new THREE.Color("#fff4e6"),
              emissiveIntensity: 0.04,
            });
            if (maybeMesh.geometry && !maybeMesh.geometry.attributes.normal) {
              maybeMesh.geometry.computeVertexNormals();
            }
          }
        });
        gltf.scene.scale.setScalar(headScale);
        gltf.scene.position.y = headYOffset;
        headGroup.add(gltf.scene);
        scene.add(headGroup);
      } catch (err) {
        console.warn("[Head3D] failed to load head GLB:", err);
        return;
      }

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
      const onVisibility = () => {
        const wasVisible = visible;
        visible = document.visibilityState === "visible";
        if (!wasVisible && visible) {
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
  }, [variant, gender]);

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}
