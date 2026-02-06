import { Vec3 } from "@/features/flight-sim/types/flightTypes";

export type TerrainWireframe = {
  vertices: Vec3[];
  edges: Array<[number, number]>;
};

export function createBootstrapTerrain(): TerrainWireframe {
  const vertices: Vec3[] = [];
  const edges: Array<[number, number]> = [];

  const size = 2500;
  const step = 250;

  for (let x = -size; x <= size; x += step) {
    vertices.push({ x, y: 0, z: -size });
    vertices.push({ x, y: 0, z: size });
    edges.push([vertices.length - 2, vertices.length - 1]);
  }

  for (let z = -size; z <= size; z += step) {
    vertices.push({ x: -size, y: 0, z });
    vertices.push({ x: size, y: 0, z });
    edges.push([vertices.length - 2, vertices.length - 1]);
  }

  return { vertices, edges };
}
