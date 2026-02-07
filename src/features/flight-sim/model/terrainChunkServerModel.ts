import { promises as fs } from "node:fs";
import path from "node:path";
import { RawTerrainData } from "@/features/flight-sim/model/terrainModel";
import { TerrainChunkDescriptor, TerrainManifest, isValidChunkId } from "@/features/flight-sim/model/terrainStreamingModel";

type RawLayerMap = Record<
  string,
  {
    edges?: number[][];
    faces?: number[][];
  }
>;

type TerrainArchive = RawTerrainData & {
  source?: string;
};

type ChunkPayload = {
  chunkId: string;
  gridX: number;
  gridZ: number;
  lod: number;
  coordinateSystem: "projected";
  bbox: TerrainChunkDescriptor["bbox"];
  vertices: number[][];
  edges: number[][];
  faces: number[][];
  layers: RawLayerMap;
};

type ChunkBuildState = {
  chunkId: string;
  gridX: number;
  gridZ: number;
  lod: number;
  bbox: TerrainChunkDescriptor["bbox"];
  vertexMap: Map<number, number>;
  vertices: number[][];
  edges: number[][];
  faces: number[][];
  layers: RawLayerMap;
};

type ChunkDataset = {
  manifest: TerrainManifest;
  chunks: Map<string, ChunkPayload>;
};

const CHUNK_SIZE_METERS = 1400;
const BASE_BOOTSTRAP_CHUNK_COUNT = 4;
const EXTRA_BOOTSTRAP_PER_LAYER = 2;

let cachedDataset: ChunkDataset | null = null;

function createEmptyBbox(): TerrainChunkDescriptor["bbox"] {
  return {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
  };
}

function parseArchive(raw: unknown): TerrainArchive {
  const value = raw as Partial<TerrainArchive>;
  return {
    source: typeof value.source === "string" ? value.source : undefined,
    vertices: Array.isArray(value.vertices) ? value.vertices : [],
    edges: Array.isArray(value.edges) ? value.edges : [],
    faces: Array.isArray(value.faces) ? value.faces : [],
    layers: typeof value.layers === "object" && value.layers !== null ? value.layers : undefined,
  };
}

function buildPlanarCoordinates(vertices: number[][]): {
  coordinates: Array<{ x: number; z: number }>;
  isGeographic: boolean;
} {
  if (vertices.length === 0) {
    return { coordinates: [], isGeographic: false };
  }

  const probablyGeographic =
    vertices.filter((vertex) => {
      return (
        vertex.length >= 2 &&
        Number.isFinite(vertex[0]) &&
        Number.isFinite(vertex[1]) &&
        Math.abs(vertex[0]) <= 180 &&
        Math.abs(vertex[1]) <= 90
      );
    }).length / vertices.length > 0.9;

  if (!probablyGeographic) {
    return {
      coordinates: vertices.map((vertex) => ({ x: Number(vertex[0] ?? 0), z: Number(vertex[2] ?? 0) })),
      isGeographic: false,
    };
  }

  let lonOrigin = 0;
  let latOrigin = 0;
  for (const vertex of vertices) {
    lonOrigin += Number(vertex[0] ?? 0);
    latOrigin += Number(vertex[1] ?? 0);
  }
  lonOrigin /= vertices.length;
  latOrigin /= vertices.length;

  const latScale = 110_540;
  const lonScale = 111_320 * Math.cos((latOrigin * Math.PI) / 180);

  return {
    coordinates: vertices.map((vertex) => ({
      x: (Number(vertex[0] ?? 0) - lonOrigin) * lonScale,
      z: (Number(vertex[1] ?? 0) - latOrigin) * latScale,
    })),
    isGeographic: true,
  };
}

function getLod(gridX: number, gridZ: number): number {
  const ring = Math.max(Math.abs(gridX), Math.abs(gridZ));
  if (ring <= 1) {
    return 0;
  }
  if (ring <= 2) {
    return 1;
  }
  return 2;
}

function formatGridToken(value: number): string {
  return value < 0 ? `n${Math.abs(value)}` : `p${value}`;
}

function ensureChunk(map: Map<string, ChunkBuildState>, gridX: number, gridZ: number): ChunkBuildState {
  const chunkId = `tokyo_${formatGridToken(gridX)}_${formatGridToken(gridZ)}`;
  const existing = map.get(chunkId);
  if (existing) {
    return existing;
  }

  const created: ChunkBuildState = {
    chunkId,
    gridX,
    gridZ,
    lod: getLod(gridX, gridZ),
    bbox: createEmptyBbox(),
    vertexMap: new Map<number, number>(),
    vertices: [],
    edges: [],
    faces: [],
    layers: {},
  };
  map.set(chunkId, created);
  return created;
}

function updateBbox(chunk: ChunkBuildState, point: [number, number, number]): void {
  const [x, y, z] = point;
  chunk.bbox.minX = Math.min(chunk.bbox.minX, x);
  chunk.bbox.minY = Math.min(chunk.bbox.minY, y);
  chunk.bbox.minZ = Math.min(chunk.bbox.minZ, z);
  chunk.bbox.maxX = Math.max(chunk.bbox.maxX, x);
  chunk.bbox.maxY = Math.max(chunk.bbox.maxY, y);
  chunk.bbox.maxZ = Math.max(chunk.bbox.maxZ, z);
}

function ensureVertex(
  chunk: ChunkBuildState,
  archiveVertices: Array<[number, number, number]>,
  globalIndex: number,
): number | null {
  if (!Number.isInteger(globalIndex) || globalIndex < 0 || globalIndex >= archiveVertices.length) {
    return null;
  }

  const existing = chunk.vertexMap.get(globalIndex);
  if (existing !== undefined) {
    return existing;
  }

  const source = archiveVertices[globalIndex] ?? [0, 0, 0];
  const vertex: [number, number, number] = [source[0], source[1], source[2]];

  const localIndex = chunk.vertices.length;
  chunk.vertices.push(vertex);
  chunk.vertexMap.set(globalIndex, localIndex);
  updateBbox(chunk, vertex);
  return localIndex;
}

function mapEdgeToChunk(
  chunk: ChunkBuildState,
  archiveVertices: Array<[number, number, number]>,
  edge: number[],
  layerName: string,
): void {
  if (!Array.isArray(edge) || edge.length < 2) {
    return;
  }
  const a = ensureVertex(chunk, archiveVertices, edge[0]);
  const b = ensureVertex(chunk, archiveVertices, edge[1]);
  if (a === null || b === null || a === b) {
    return;
  }

  const normalized: [number, number] = a < b ? [a, b] : [b, a];
  chunk.edges.push(normalized);

  const layer = (chunk.layers[layerName] ??= { edges: [], faces: [] });
  layer.edges?.push(normalized);
}

function mapFaceToChunk(
  chunk: ChunkBuildState,
  archiveVertices: Array<[number, number, number]>,
  face: number[],
  layerName: string,
): void {
  if (!Array.isArray(face) || face.length < 3) {
    return;
  }
  const a = ensureVertex(chunk, archiveVertices, face[0]);
  const b = ensureVertex(chunk, archiveVertices, face[1]);
  const c = ensureVertex(chunk, archiveVertices, face[2]);
  if (a === null || b === null || c === null) {
    return;
  }

  const normalized: [number, number, number] = [a, b, c];
  chunk.faces.push(normalized);

  const layer = (chunk.layers[layerName] ??= { edges: [], faces: [] });
  layer.faces?.push(normalized);
}

function dedupeChunk(chunk: ChunkBuildState): ChunkPayload {
  const edgeSet = new Set<string>();
  const faceSet = new Set<string>();
  const edges: number[][] = [];
  const faces: number[][] = [];

  for (const edge of chunk.edges) {
    const key = `${edge[0]}:${edge[1]}`;
    if (edgeSet.has(key)) {
      continue;
    }
    edgeSet.add(key);
    edges.push(edge);
  }

  for (const face of chunk.faces) {
    const key = [...face].sort((a, b) => a - b).join(":");
    if (faceSet.has(key)) {
      continue;
    }
    faceSet.add(key);
    faces.push(face);
  }

  const normalizedLayers: RawLayerMap = {};
  for (const [layerName, layer] of Object.entries(chunk.layers)) {
    const layerEdges = (layer.edges ?? []).filter((edge) => edge.length >= 2);
    const layerFaces = (layer.faces ?? []).filter((face) => face.length >= 3);
    normalizedLayers[layerName] = { edges: layerEdges, faces: layerFaces };
  }

  return {
    chunkId: chunk.chunkId,
    gridX: chunk.gridX,
    gridZ: chunk.gridZ,
    lod: chunk.lod,
    coordinateSystem: "projected",
    bbox: chunk.bbox,
    vertices: chunk.vertices,
    edges,
    faces,
    layers: normalizedLayers,
  };
}

function gridFromPlanarPoint(point: { x: number; z: number }): { gridX: number; gridZ: number } {
  return {
    gridX: Math.floor(point.x / CHUNK_SIZE_METERS),
    gridZ: Math.floor(point.z / CHUNK_SIZE_METERS),
  };
}

function buildDataset(archive: TerrainArchive): ChunkDataset {
  const chunkMap = new Map<string, ChunkBuildState>();
  const { coordinates: planar, isGeographic } = buildPlanarCoordinates(archive.vertices);
  const projectedVertices: Array<[number, number, number]> = archive.vertices.map((vertex, index) => {
    const point = planar[index] ?? { x: 0, z: 0 };
    if (isGeographic) {
      return [point.x, Number(vertex[2] ?? 0), point.z];
    }
    return [Number(vertex[0] ?? 0), Number(vertex[1] ?? 0), Number(vertex[2] ?? 0)];
  });

  const sourceLayers = archive.layers ?? { other: { edges: archive.edges, faces: archive.faces } };

  for (const [layerName, layerData] of Object.entries(sourceLayers)) {
    const edges = Array.isArray(layerData.edges) ? layerData.edges : [];
    for (const edge of edges) {
      if (!Array.isArray(edge) || edge.length < 2) {
        continue;
      }
      const a = planar[edge[0]];
      const b = planar[edge[1]];
      if (!a || !b) {
        continue;
      }
      const center = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const grid = gridFromPlanarPoint(center);
      const chunk = ensureChunk(chunkMap, grid.gridX, grid.gridZ);
      mapEdgeToChunk(chunk, projectedVertices, edge, layerName);
    }

    const faces = Array.isArray(layerData.faces) ? layerData.faces : [];
    for (const face of faces) {
      if (!Array.isArray(face) || face.length < 3) {
        continue;
      }
      const a = planar[face[0]];
      const b = planar[face[1]];
      const c = planar[face[2]];
      if (!a || !b || !c) {
        continue;
      }
      const center = {
        x: (a.x + b.x + c.x) / 3,
        z: (a.z + b.z + c.z) / 3,
      };
      const grid = gridFromPlanarPoint(center);
      const chunk = ensureChunk(chunkMap, grid.gridX, grid.gridZ);
      mapFaceToChunk(chunk, projectedVertices, face, layerName);
    }
  }

  const chunks = Array.from(chunkMap.values())
    .map(dedupeChunk)
    .filter((chunk) => chunk.vertices.length > 0 && chunk.edges.length > 0);

  const descriptors: TerrainChunkDescriptor[] = chunks
    .map((chunk) => ({
      chunkId: chunk.chunkId,
      lod: chunk.lod,
      url: `/api/terrain/chunk/${chunk.chunkId}`,
      gridX: chunk.gridX,
      gridZ: chunk.gridZ,
      bbox: chunk.bbox,
    }))
    .filter((descriptor) => isValidChunkId(descriptor.chunkId));

  const chunkById = new Map(chunks.map((chunk) => [chunk.chunkId, chunk]));
  const nearCenter = descriptors
    .slice()
    .sort((a, b) => {
      const da = a.gridX * a.gridX + a.gridZ * a.gridZ;
      const db = b.gridX * b.gridX + b.gridZ * b.gridZ;
      return da - db;
    });

  const bootstrapSet = new Set(nearCenter.slice(0, BASE_BOOTSTRAP_CHUNK_COUNT).map((descriptor) => descriptor.chunkId));

  const pickLayerDenseChunks = (layerName: string) => {
    const dense = nearCenter
      .slice(0, 64)
      .map((descriptor) => {
        const payload = chunkById.get(descriptor.chunkId);
        const layerEdges = payload?.layers?.[layerName]?.edges?.length ?? 0;
        return {
          chunkId: descriptor.chunkId,
          layerEdges,
          distanceRank: descriptor.gridX * descriptor.gridX + descriptor.gridZ * descriptor.gridZ,
        };
      })
      .filter((row) => row.layerEdges > 0)
      .sort((a, b) => {
        if (b.layerEdges !== a.layerEdges) {
          return b.layerEdges - a.layerEdges;
        }
        return a.distanceRank - b.distanceRank;
      })
      .slice(0, EXTRA_BOOTSTRAP_PER_LAYER);

    for (const row of dense) {
      bootstrapSet.add(row.chunkId);
    }
  };

  pickLayerDenseChunks("building");
  pickLayerDenseChunks("water");

  const bootstrapChunkIds = Array.from(bootstrapSet);

  return {
    manifest: {
      version: new Date().toISOString().slice(0, 10),
      city: "tokyo",
      source: archive.source ?? "plateau-13103-minato-ku-2023-v4-real",
      bootstrapChunkIds,
      chunks: descriptors,
    },
    chunks: new Map(chunks.map((chunk) => [chunk.chunkId, chunk])),
  };
}

export async function getTerrainChunkDataset(): Promise<ChunkDataset> {
  if (cachedDataset) {
    return cachedDataset;
  }

  const terrainFilePath = path.join(process.cwd(), "public", "terrain", "sample_tokyo_wireframe.json");
  const text = await fs.readFile(terrainFilePath, "utf-8");
  const archive = parseArchive(JSON.parse(text));
  cachedDataset = buildDataset(archive);
  return cachedDataset;
}

export async function getTerrainManifest(): Promise<TerrainManifest> {
  const dataset = await getTerrainChunkDataset();
  return dataset.manifest;
}

export async function getTerrainChunkById(chunkId: string): Promise<ChunkPayload | null> {
  if (!isValidChunkId(chunkId)) {
    return null;
  }
  const dataset = await getTerrainChunkDataset();
  return dataset.chunks.get(chunkId) ?? null;
}
