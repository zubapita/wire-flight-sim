import { Vec3 } from "@/features/flight-sim/types/flightTypes";

export type TerrainLayerId = "building" | "road" | "bridge" | "railway" | "water" | "ground" | "other";

export type TerrainLayerMesh = {
  id: TerrainLayerId;
  edges: Array<[number, number]>;
  faces: Array<[number, number, number]>;
};

export type TerrainMesh = {
  vertices: Vec3[];
  edges: Array<[number, number]>;
  faces: Array<[number, number, number]>;
  layers: TerrainLayerMesh[];
};

type RawTerrainData = {
  vertices: number[][];
  edges: number[][];
  faces?: number[][];
  layers?: Record<
    string,
    {
      edges?: number[][];
      faces?: number[][];
    }
  >;
};

function normalizeEdge(edge: number[]): [number, number] | null {
  if (edge.length < 2) {
    return null;
  }
  const a = edge[0];
  const b = edge[1];
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) {
    return null;
  }
  return a < b ? [a, b] : [b, a];
}

function detectGeographicCoordinates(vertices: number[][]): boolean {
  if (vertices.length === 0) {
    return false;
  }
  let validCount = 0;
  for (const vertex of vertices) {
    if (vertex.length < 2) {
      continue;
    }
    const lon = vertex[0];
    const lat = vertex[1];
    if (Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
      validCount += 1;
    }
  }
  return validCount / vertices.length > 0.9;
}

function deriveFacesFromEdges(vertexCount: number, edges: Array<[number, number]>): Array<[number, number, number]> {
  const adjacency = new Map<number, Set<number>>();
  const edgeKeys = new Set<string>();

  for (const [a, b] of edges) {
    if (a < 0 || b < 0 || a >= vertexCount || b >= vertexCount) {
      continue;
    }
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
    edgeKeys.add(`${a},${b}`);
  }

  const visitedEdgeKeys = new Set<string>();
  const faces: Array<[number, number, number]> = [];
  const cycleKeys = new Set<string>();

  const markEdgeVisited = (a: number, b: number): void => {
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    visitedEdgeKeys.add(key);
  };

  const isEdgeVisited = (a: number, b: number): boolean => {
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    return visitedEdgeKeys.has(key);
  };

  for (const edgeKey of edgeKeys) {
    const [aRaw, bRaw] = edgeKey.split(",");
    const start = Number(aRaw);
    const second = Number(bRaw);

    if (isEdgeVisited(start, second)) {
      continue;
    }

    const cycle: number[] = [start, second];
    markEdgeVisited(start, second);

    let prev = start;
    let current = second;
    let closed = false;

    for (let step = 0; step < vertexCount + 2; step += 1) {
      const neighbors = adjacency.get(current);
      if (!neighbors || neighbors.size === 0) {
        break;
      }

      const nextCandidates = Array.from(neighbors).filter((n) => n !== prev);
      if (nextCandidates.length === 0) {
        break;
      }

      let next = nextCandidates.find((n) => !isEdgeVisited(current, n));
      if (next === undefined) {
        next = nextCandidates[0];
      }

      markEdgeVisited(current, next);

      if (next === start) {
        closed = true;
        break;
      }

      cycle.push(next);
      prev = current;
      current = next;
    }

    if (!closed || cycle.length < 3) {
      continue;
    }

    const canonical = [...cycle].sort((x, y) => x - y).join(",");
    if (cycleKeys.has(canonical)) {
      continue;
    }
    cycleKeys.add(canonical);

    for (let i = 1; i < cycle.length - 1; i += 1) {
      faces.push([cycle[0], cycle[i], cycle[i + 1]]);
    }
  }

  return faces;
}

function normalizeLayerId(layerName: string): TerrainLayerId {
  const value = layerName.toLowerCase();
  if (value === "building") {
    return "building";
  }
  if (value === "road") {
    return "road";
  }
  if (value === "bridge") {
    return "bridge";
  }
  if (value === "railway" || value === "rail") {
    return "railway";
  }
  if (value === "water") {
    return "water";
  }
  if (value === "ground") {
    return "ground";
  }
  return "other";
}

function normalizeFaces(rawFaces: number[][]): Array<[number, number, number]> {
  return rawFaces
    .filter((face) => face.length >= 3)
    .map((face) => [face[0], face[1], face[2]] as [number, number, number]);
}

function mapRawTerrainData(raw: RawTerrainData): TerrainMesh {
  const rawVertices = Array.isArray(raw.vertices) ? raw.vertices : [];
  const isGeographic = detectGeographicCoordinates(rawVertices);

  let lonOrigin = 0;
  let latOrigin = 0;
  if (isGeographic) {
    for (const [lon, lat] of rawVertices) {
      lonOrigin += lon;
      latOrigin += lat;
    }
    lonOrigin /= rawVertices.length;
    latOrigin /= rawVertices.length;
  }

  const latScale = 110_540;
  const lonScale = 111_320 * Math.cos((latOrigin * Math.PI) / 180);

  const vertices: Vec3[] = rawVertices.map((vertex) => {
    const x0 = Number(vertex[0] ?? 0);
    const y0 = Number(vertex[1] ?? 0);
    const z0 = Number(vertex[2] ?? 0);

    if (isGeographic) {
      return {
        x: (x0 - lonOrigin) * lonScale,
        y: z0,
        z: (y0 - latOrigin) * latScale,
      };
    }

    return { x: x0, y: y0, z: z0 };
  });

  const edges = (Array.isArray(raw.edges) ? raw.edges : [])
    .map(normalizeEdge)
    .filter((edge): edge is [number, number] => edge !== null);

  const faces = Array.isArray(raw.faces)
    ? normalizeFaces(raw.faces)
    : deriveFacesFromEdges(vertices.length, edges);

  const layers: TerrainLayerMesh[] = [];
  const rawLayers = raw.layers;

  if (rawLayers && typeof rawLayers === "object") {
    for (const [layerName, layerData] of Object.entries(rawLayers)) {
      const layerEdges = (Array.isArray(layerData?.edges) ? layerData.edges : [])
        .map(normalizeEdge)
        .filter((edge): edge is [number, number] => edge !== null);
      const layerFaces = normalizeFaces(Array.isArray(layerData?.faces) ? layerData.faces : []);

      layers.push({
        id: normalizeLayerId(layerName),
        edges: layerEdges,
        faces: layerFaces,
      });
    }
  }

  if (layers.length === 0) {
    layers.push({
      id: "other",
      edges,
      faces,
    });
  }

  return { vertices, edges, faces, layers };
}

export async function loadTerrainFromUrl(url: string): Promise<TerrainMesh> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load terrain: ${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as RawTerrainData;
  return mapRawTerrainData(raw);
}

export function createBootstrapTerrain(): TerrainMesh {
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

  return {
    vertices,
    edges,
    faces: [],
    layers: [
      {
        id: "ground",
        edges,
        faces: [],
      },
    ],
  };
}
