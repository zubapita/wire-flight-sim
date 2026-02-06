"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { FlightState } from "@/features/flight-sim/types/flightTypes";
import { TerrainMesh } from "@/features/flight-sim/model/terrainModel";

type Props = {
  flightState: FlightState;
  terrain: TerrainMesh;
};

function createTerrainLineSegments(terrain: TerrainMesh): THREE.LineSegments {
  const points: number[] = [];

  for (const [a, b] of terrain.edges) {
    const from = terrain.vertices[a];
    const to = terrain.vertices[b];
    if (!from || !to) {
      continue;
    }
    points.push(from.x, from.y, from.z, to.x, to.y, to.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));

  const material = new THREE.LineBasicMaterial({ color: 0x7affde, transparent: true, opacity: 0.88 });
  return new THREE.LineSegments(geometry, material);
}

function createTerrainSurfaceMesh(terrain: TerrainMesh): THREE.Mesh | null {
  if (terrain.faces.length === 0) {
    return null;
  }

  const positions: number[] = [];
  for (const vertex of terrain.vertices) {
    positions.push(vertex.x, vertex.y, vertex.z);
  }

  const indices: number[] = [];
  for (const [a, b, c] of terrain.faces) {
    if (!terrain.vertices[a] || !terrain.vertices[b] || !terrain.vertices[c]) {
      continue;
    }
    indices.push(a, b, c);
  }

  if (indices.length === 0) {
    return null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x2a5b42,
    roughness: 0.92,
    metalness: 0.04,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

export function FlightSceneView({ flightState, terrain }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02060a);

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 40000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const terrainSurface = createTerrainSurfaceMesh(terrain);
    if (terrainSurface) {
      scene.add(terrainSurface);
    }

    const terrainLines = createTerrainLineSegments(terrain);
    scene.add(terrainLines);

    const ambientLight = new THREE.AmbientLight(0x8fcfff, 0.45);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xd8fff4, 0.85);
    directionalLight.position.set(1800, 3200, 1200);
    scene.add(directionalLight);

    const horizonGeometry = new THREE.BufferGeometry();
    horizonGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-10000, 0, 3000, 10000, 0, 3000], 3),
    );
    scene.add(new THREE.Line(horizonGeometry, new THREE.LineBasicMaterial({ color: 0x2efbbf, opacity: 0.4, transparent: true })));

    const onResize = (): void => {
      if (!mount || !cameraRef.current || !rendererRef.current) {
        return;
      }
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener("resize", onResize);

    let rafId = 0;
    const render = (): void => {
      if (!rendererRef.current || !cameraRef.current) {
        return;
      }
      rendererRef.current.render(scene, cameraRef.current);
      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      if (terrainSurface) {
        terrainSurface.geometry.dispose();
        (terrainSurface.material as THREE.Material).dispose();
      }
      terrainLines.geometry.dispose();
      (terrainLines.material as THREE.Material).dispose();
      renderer.dispose();
      cameraRef.current = null;
      rendererRef.current = null;
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [terrain]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }

    const pitchRad = (flightState.pitchDeg * Math.PI) / 180;
    const yawRad = (flightState.yawDeg * Math.PI) / 180;
    const rollRad = (flightState.rollDeg * Math.PI) / 180;

    camera.position.set(flightState.position.x, flightState.position.y, flightState.position.z);
    camera.rotation.order = "YXZ";
    // Match camera forward vector to flight model movement vector.
    camera.rotation.set(pitchRad, yawRad + Math.PI, -rollRad);
  }, [flightState]);

  return <div className="scene-root" ref={mountRef} />;
}
