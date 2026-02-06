"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { FlightState, GraphicsQuality } from "@/features/flight-sim/types/flightTypes";
import { TerrainLayerId, TerrainMesh } from "@/features/flight-sim/model/terrainModel";

type Props = {
  flightState: FlightState;
  terrain: TerrainMesh;
  graphicsQuality: GraphicsQuality;
};

type LayerStyle = {
  lineColor: number;
  lineOpacity: number;
  surfaceColor: number;
  surfaceOpacity: number;
};

const DEFAULT_LAYER_STYLE: LayerStyle = {
  lineColor: 0x7affde,
  lineOpacity: 0.88,
  surfaceColor: 0x2a5b42,
  surfaceOpacity: 0.3,
};

const LAYER_STYLES: Record<TerrainLayerId, LayerStyle> = {
  building: {
    lineColor: 0x86ffda,
    lineOpacity: 0.9,
    surfaceColor: 0x3f6b5d,
    surfaceOpacity: 0.6,
  },
  road: {
    lineColor: 0x9ec8ff,
    lineOpacity: 0.85,
    surfaceColor: 0x2b3752,
    surfaceOpacity: 0.24,
  },
  bridge: {
    lineColor: 0xffcf8a,
    lineOpacity: 0.92,
    surfaceColor: 0x6b5330,
    surfaceOpacity: 0.55,
  },
  railway: {
    lineColor: 0xffa4a4,
    lineOpacity: 0.88,
    surfaceColor: 0x6d3030,
    surfaceOpacity: 0.35,
  },
  water: {
    lineColor: 0x79d0ff,
    lineOpacity: 0.92,
    surfaceColor: 0x16557d,
    surfaceOpacity: 0.46,
  },
  ground: {
    lineColor: 0x33515b,
    lineOpacity: 0.48,
    surfaceColor: 0x1f312f,
    surfaceOpacity: 0.2,
  },
  other: DEFAULT_LAYER_STYLE,
};

function createTerrainLineSegments(
  terrain: TerrainMesh,
  edges: Array<[number, number]>,
  lineColor: number,
  lineOpacity: number,
): THREE.LineSegments {
  const points: number[] = [];

  for (const [a, b] of edges) {
    const from = terrain.vertices[a];
    const to = terrain.vertices[b];
    if (!from || !to) {
      continue;
    }
    points.push(from.x, from.y, from.z, to.x, to.y, to.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));

  const material = new THREE.LineBasicMaterial({
    color: lineColor,
    transparent: true,
    opacity: lineOpacity,
  });
  return new THREE.LineSegments(geometry, material);
}

function createTerrainSurfaceMesh(
  terrain: TerrainMesh,
  faces: Array<[number, number, number]>,
  surfaceColor: number,
  surfaceOpacity: number,
): THREE.Mesh | null {
  if (faces.length === 0) {
    return null;
  }

  const positions: number[] = [];
  for (const vertex of terrain.vertices) {
    positions.push(vertex.x, vertex.y, vertex.z);
  }

  const indices: number[] = [];
  for (const [a, b, c] of faces) {
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
    color: surfaceColor,
    roughness: 0.92,
    metalness: 0.04,
    transparent: true,
    opacity: surfaceOpacity,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

export function FlightSceneView({ flightState, terrain, graphicsQuality }: Props) {
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

    const renderer = new THREE.WebGLRenderer({ antialias: graphicsQuality === "high" });
    const maxRatio = graphicsQuality === "low" ? 1 : graphicsQuality === "medium" ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRatio));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const disposables: Array<THREE.LineSegments | THREE.Mesh> = [];
    const layers = terrain.layers.length > 0
      ? terrain.layers
      : [{ id: "other" as const, edges: terrain.edges, faces: terrain.faces }];

    for (const layer of layers) {
      const style = LAYER_STYLES[layer.id] ?? DEFAULT_LAYER_STYLE;
      const layerSurface = createTerrainSurfaceMesh(
        terrain,
        layer.faces,
        style.surfaceColor,
        style.surfaceOpacity,
      );
      if (layerSurface) {
        scene.add(layerSurface);
        disposables.push(layerSurface);
      }

      const layerLines = createTerrainLineSegments(
        terrain,
        layer.edges,
        style.lineColor,
        style.lineOpacity,
      );
      scene.add(layerLines);
      disposables.push(layerLines);
    }

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
    scene.add(
      new THREE.Line(
        horizonGeometry,
        new THREE.LineBasicMaterial({ color: 0x2efbbf, opacity: 0.4, transparent: true }),
      ),
    );

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
      for (const item of disposables) {
        item.geometry.dispose();
        const material = item.material;
        if (Array.isArray(material)) {
          for (const m of material) {
            m.dispose();
          }
        } else {
          material.dispose();
        }
      }
      renderer.dispose();
      cameraRef.current = null;
      rendererRef.current = null;
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [terrain, graphicsQuality]);

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
    camera.rotation.set(pitchRad, yawRad + Math.PI, -rollRad);
  }, [flightState]);

  return <div className="scene-root" ref={mountRef} />;
}
