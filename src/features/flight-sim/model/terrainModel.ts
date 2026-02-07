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

export type RawTerrainData = {
  coordinateSystem?: "geographic" | "projected";
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

export function mapRawTerrainData(raw: RawTerrainData): TerrainMesh {
  const rawVertices = Array.isArray(raw.vertices) ? raw.vertices : [];
  const isGeographic =
    raw.coordinateSystem === "geographic"
      ? true
      : raw.coordinateSystem === "projected"
        ? false
        : detectGeographicCoordinates(rawVertices);

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

export function mergeTerrainMeshes(meshes: TerrainMesh[]): TerrainMesh {
  if (meshes.length === 0) {
    return createBootstrapTerrain();
  }

  const vertices: Vec3[] = [];
  const edges: Array<[number, number]> = [];
  const faces: Array<[number, number, number]> = [];
  const layersById = new Map<TerrainLayerId, TerrainLayerMesh>();
  const edgeKeys = new Set<string>();
  const faceKeys = new Set<string>();

  for (const mesh of meshes) {
    const offset = vertices.length;
    vertices.push(...mesh.vertices);

    for (const [a, b] of mesh.edges) {
      const edge: [number, number] = [a + offset, b + offset];
      const key = edge[0] < edge[1] ? `${edge[0]}:${edge[1]}` : `${edge[1]}:${edge[0]}`;
      if (edgeKeys.has(key)) {
        continue;
      }
      edgeKeys.add(key);
      edges.push(edge);
    }

    for (const [a, b, c] of mesh.faces) {
      const face: [number, number, number] = [a + offset, b + offset, c + offset];
      const key = [...face].sort((x, y) => x - y).join(":");
      if (faceKeys.has(key)) {
        continue;
      }
      faceKeys.add(key);
      faces.push(face);
    }

    for (const layer of mesh.layers) {
      const existing = layersById.get(layer.id) ?? { id: layer.id, edges: [], faces: [] };
      for (const [a, b] of layer.edges) {
        const edge: [number, number] = [a + offset, b + offset];
        existing.edges.push(edge);
      }
      for (const [a, b, c] of layer.faces) {
        const face: [number, number, number] = [a + offset, b + offset, c + offset];
        existing.faces.push(face);
      }
      layersById.set(layer.id, existing);
    }
  }

  return {
    vertices,
    edges,
    faces,
    layers: Array.from(layersById.values()),
  };
}

export function limitTerrainEdges(mesh: TerrainMesh, maxEdges: number): TerrainMesh {
  if (maxEdges <= 0 || mesh.edges.length <= maxEdges) {
    return mesh;
  }

  const stride = Math.max(1, Math.ceil(mesh.edges.length / maxEdges));
  const selectedEdges: Array<[number, number]> = [];
  for (let i = 0; i < mesh.edges.length; i += stride) {
    selectedEdges.push(mesh.edges[i]);
  }

  const layerEdgeMap = new Map<string, true>();
  for (const [a, b] of selectedEdges) {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    layerEdgeMap.set(key, true);
  }

  const layers = mesh.layers.map((layer) => ({
    id: layer.id,
    edges: layer.edges.filter(([a, b]) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      return layerEdgeMap.has(key);
    }),
    faces: layer.faces,
  }));

  return {
    vertices: mesh.vertices,
    edges: selectedEdges,
    faces: mesh.faces,
    layers,
  };
}

export function createBootstrapTerrain(): TerrainMesh {
  const vertices: Vec3[] = [];
  const edges: Array<[number, number]> = [];
  const addEdge = (a: number, b: number): void => {
    const edge = normalizeEdge([a, b]);
    if (edge) {
      edges.push(edge);
    }
  };

  const size = 2500;
  const step = 250;

  for (let x = -size; x <= size; x += step) {
    vertices.push({ x, y: 0, z: -size });
    vertices.push({ x, y: 0, z: size });
    addEdge(vertices.length - 2, vertices.length - 1);
  }

  for (let z = -size; z <= size; z += step) {
    vertices.push({ x: -size, y: 0, z });
    vertices.push({ x: size, y: 0, z });
    addEdge(vertices.length - 2, vertices.length - 1);
  }

  const towerPoints: Array<{ x: number; z: number; top: number }> = [
    { x: 0, z: 0, top: 900 },
    { x: 800, z: 800, top: 700 },
    { x: -900, z: 650, top: 760 },
    { x: 1200, z: -1000, top: 640 },
    { x: -1100, z: -1100, top: 820 },
  ];

  for (const point of towerPoints) {
    const baseA = vertices.length;
    vertices.push({ x: point.x - 45, y: 0, z: point.z - 45 });
    const baseB = vertices.length;
    vertices.push({ x: point.x + 45, y: 0, z: point.z - 45 });
    const baseC = vertices.length;
    vertices.push({ x: point.x + 45, y: 0, z: point.z + 45 });
    const baseD = vertices.length;
    vertices.push({ x: point.x - 45, y: 0, z: point.z + 45 });
    const topA = vertices.length;
    vertices.push({ x: point.x - 45, y: point.top, z: point.z - 45 });
    const topB = vertices.length;
    vertices.push({ x: point.x + 45, y: point.top, z: point.z - 45 });
    const topC = vertices.length;
    vertices.push({ x: point.x + 45, y: point.top, z: point.z + 45 });
    const topD = vertices.length;
    vertices.push({ x: point.x - 45, y: point.top, z: point.z + 45 });

    addEdge(baseA, baseB);
    addEdge(baseB, baseC);
    addEdge(baseC, baseD);
    addEdge(baseD, baseA);

    addEdge(topA, topB);
    addEdge(topB, topC);
    addEdge(topC, topD);
    addEdge(topD, topA);

    addEdge(baseA, topA);
    addEdge(baseB, topB);
    addEdge(baseC, topC);
    addEdge(baseD, topD);
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
