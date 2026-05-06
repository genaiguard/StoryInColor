"use client";

/**
 * 3D rotating head for the upload screens.
 *
 * Uses LeePerrySmith — the canonical public-domain photogrammetry head
 * model in the three.js ecosystem. We render it with a wireframe
 * material so it reads as a "face scan" / sci-fi scanning visualization
 * rather than a creepy photo of a stranger. The wireframe topology
 * naturally communicates "AI is looking at a face" without being
 * cartoony.
 *
 * Lazy-loaded behind dynamic import so the ~250KB three.js bundle and
 * 400KB GLB don't ship on routes that don't need them.
 */

import { Suspense, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

const HEAD_URL = "/face-rating/head.glb";

interface HeadMeshProps {
  /** Front variant rocks gently side-to-side; side variant slowly orbits. */
  variant: "front" | "side";
}

function HeadMesh({ variant }: HeadMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useLoader(GLTFLoader, HEAD_URL);

  // Apply our material once on load.
  useRef<boolean>(false);
  if (gltf && (gltf as { _styled?: boolean })._styled !== true) {
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        // Wireframe + soft fill. Dark editorial vibe, slight glow on
        // the wireframe edges via emissive.
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#1a1a1a"),
          emissive: new THREE.Color("#ffffff"),
          emissiveIntensity: 0.04,
          wireframe: true,
          transparent: true,
          opacity: 0.85,
        });
      }
    });
    (gltf as { _styled?: boolean })._styled = true;
  }

  // Animate.
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    if (variant === "front") {
      // Subtle rocking ±10° on Y, +/-3° on X — feels alive but always face-on.
      groupRef.current.rotation.y = Math.sin(t * 0.4) * 0.18;
      groupRef.current.rotation.x = Math.sin(t * 0.35) * 0.05;
    } else {
      // Slowly orbit around so the user sees the side profile most of the
      // time, but with continuous motion that reveals depth.
      groupRef.current.rotation.y = Math.PI / 2 + Math.sin(t * 0.3) * 0.4;
      groupRef.current.rotation.x = Math.sin(t * 0.25) * 0.04;
    }
  });

  // The model is ~12 units tall by default. Center + scale.
  return (
    <group ref={groupRef} position={[0, -0.05, 0]} scale={0.16}>
      <primitive object={gltf.scene} />
    </group>
  );
}

export interface Head3DProps {
  variant: "front" | "side";
  className?: string;
}

export default function Head3D({ variant, className = "" }: Head3DProps) {
  return (
    <div className={`relative h-full w-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 32 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        {/* Ambient + key light + rim light → soft editorial volumetric feel. */}
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 2, 4]} intensity={0.6} />
        <directionalLight position={[-3, 1, -2]} intensity={0.35} color="#dde6ff" />
        <pointLight position={[0, 0, 3]} intensity={0.2} />
        <Suspense fallback={null}>
          <HeadMesh variant={variant} />
        </Suspense>
      </Canvas>
    </div>
  );
}
