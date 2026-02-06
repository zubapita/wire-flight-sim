import { GraphicsQuality, Vec3 } from "@/features/flight-sim/types/flightTypes";
import {
  RawTerrainData,
  TerrainMesh,
  limitTerrainEdges,
  mapRawTerrainData,
  mergeTerrainMeshes,
} from "@/features/flight-sim/model/terrainModel";

export type TerrainChunkDescriptor = {
  chunkId: string;
  lod: number;
  url: string;
  gridX: number;
  gridZ: number;
  bbox: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
};

export type TerrainManifest = {
  version: string;
  city: string;
  source: string;
  bootstrapChunkIds: string[];
  chunks: TerrainChunkDescriptor[];
};

export type LoadedTerrainChunk = {
  descriptor: TerrainChunkDescriptor;
  mesh: TerrainMesh;
};

type CacheRecord = {
  chunkId: string;
  payload: RawTerrainData;
  savedAt: number;
  sizeBytes: number;
};

const CHUNK_ID_PATTERN = /^[a-z0-9_]+$/;
const CACHE_DB_NAME = "flight-sim-terrain-cache";
const CACHE_STORE_NAME = "chunk-cache";
const CACHE_VERSION = 1;
const CACHE_MAX_ENTRIES = 48;
const CACHE_MAX_BYTES = 25 * 1024 * 1024;

const EDGE_CAP_BY_QUALITY: Record<GraphicsQuality, number> = {
  low: 5000,
  medium: 11000,
  high: 18000,
};

const LOAD_RADIUS_BY_QUALITY: Record<GraphicsQuality, number> = {
  low: 2200,
  medium: 2800,
  high: 3600,
};

const KEEP_RADIUS_BY_QUALITY: Record<GraphicsQuality, number> = {
  low: 3200,
  medium: 4200,
  high: 5200,
};

function chunkCenter(descriptor: TerrainChunkDescriptor): { x: number; z: number } {
  return {
    x: (descriptor.bbox.minX + descriptor.bbox.maxX) / 2,
    z: (descriptor.bbox.minZ + descriptor.bbox.maxZ) / 2,
  };
}

function distanceSqToChunk(point: Vec3, descriptor: TerrainChunkDescriptor): number {
  const center = chunkCenter(descriptor);
  const dx = point.x - center.x;
  const dz = point.z - center.z;
  return dx * dx + dz * dz;
}

function normalizeRawTerrainData(raw: unknown): RawTerrainData {
  const value = raw as Partial<RawTerrainData>;
  return {
    vertices: Array.isArray(value.vertices) ? value.vertices : [],
    edges: Array.isArray(value.edges) ? value.edges : [],
    faces: Array.isArray(value.faces) ? value.faces : [],
    layers: typeof value.layers === "object" && value.layers !== null ? value.layers : undefined,
  };
}

function normalizeManifest(raw: unknown): TerrainManifest {
  const value = raw as Partial<TerrainManifest>;
  return {
    version: typeof value.version === "string" ? value.version : "unknown",
    city: typeof value.city === "string" ? value.city : "unknown",
    source: typeof value.source === "string" ? value.source : "unknown",
    bootstrapChunkIds: Array.isArray(value.bootstrapChunkIds) ? value.bootstrapChunkIds : [],
    chunks: Array.isArray(value.chunks)
      ? value.chunks.filter((chunk): chunk is TerrainChunkDescriptor => {
          if (!chunk || typeof chunk !== "object") {
            return false;
          }
          const candidate = chunk as TerrainChunkDescriptor;
          return (
            typeof candidate.chunkId === "string" &&
            CHUNK_ID_PATTERN.test(candidate.chunkId) &&
            typeof candidate.lod === "number" &&
            typeof candidate.url === "string" &&
            typeof candidate.gridX === "number" &&
            typeof candidate.gridZ === "number" &&
            typeof candidate.bbox === "object" &&
            candidate.bbox !== null
          );
        })
      : [],
  };
}

async function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME, { keyPath: "chunkId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readFromCache(chunkId: string): Promise<RawTerrainData | null> {
  const db = await openCacheDb();
  if (!db) {
    return null;
  }

  return new Promise((resolve) => {
    const transaction = db.transaction(CACHE_STORE_NAME, "readonly");
    const store = transaction.objectStore(CACHE_STORE_NAME);
    const request = store.get(chunkId);
    request.onsuccess = () => {
      const row = request.result as CacheRecord | undefined;
      resolve(row ? row.payload : null);
    };
    request.onerror = () => resolve(null);
  });
}

async function writeToCache(chunkId: string, payload: RawTerrainData): Promise<void> {
  const db = await openCacheDb();
  if (!db) {
    return;
  }

  const serialized = JSON.stringify(payload);
  const nextRecord: CacheRecord = {
    chunkId,
    payload,
    savedAt: Date.now(),
    sizeBytes: serialized.length,
  };

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(CACHE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(CACHE_STORE_NAME);
    store.put(nextRecord);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });

  await pruneCache(db);
}

async function pruneCache(db: IDBDatabase): Promise<void> {
  const rows = await new Promise<CacheRecord[]>((resolve) => {
    const transaction = db.transaction(CACHE_STORE_NAME, "readonly");
    const store = transaction.objectStore(CACHE_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as CacheRecord[]) ?? []);
    request.onerror = () => resolve([]);
  });

  const sorted = rows.sort((a, b) => a.savedAt - b.savedAt);
  let totalBytes = sorted.reduce((sum, row) => sum + row.sizeBytes, 0);
  const removeIds: string[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const overflowEntries = sorted.length - i > CACHE_MAX_ENTRIES;
    const overflowBytes = totalBytes > CACHE_MAX_BYTES;
    if (!overflowEntries && !overflowBytes) {
      break;
    }
    removeIds.push(sorted[i].chunkId);
    totalBytes -= sorted[i].sizeBytes;
  }

  if (removeIds.length === 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(CACHE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(CACHE_STORE_NAME);
    for (const chunkId of removeIds) {
      store.delete(chunkId);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

function selectTargetChunks(
  manifest: TerrainManifest,
  loadedIds: Set<string>,
  flightPosition: Vec3,
  graphicsQuality: GraphicsQuality,
): TerrainChunkDescriptor[] {
  const loadRadiusSq = LOAD_RADIUS_BY_QUALITY[graphicsQuality] ** 2;
  const candidates = manifest.chunks
    .filter((chunk) => {
      if (loadedIds.has(chunk.chunkId)) {
        return false;
      }
      return distanceSqToChunk(flightPosition, chunk) <= loadRadiusSq;
    })
    .sort((a, b) => distanceSqToChunk(flightPosition, a) - distanceSqToChunk(flightPosition, b));

  return candidates.slice(0, 4);
}

function keepChunksNear(
  chunks: LoadedTerrainChunk[],
  flightPosition: Vec3,
  graphicsQuality: GraphicsQuality,
): LoadedTerrainChunk[] {
  const keepRadiusSq = KEEP_RADIUS_BY_QUALITY[graphicsQuality] ** 2;
  return chunks.filter((chunk) => distanceSqToChunk(flightPosition, chunk.descriptor) <= keepRadiusSq);
}

function buildLodTerrain(chunks: LoadedTerrainChunk[], graphicsQuality: GraphicsQuality, flightPosition: Vec3): TerrainMesh {
  const sorted = [...chunks].sort((a, b) => {
    return distanceSqToChunk(flightPosition, a.descriptor) - distanceSqToChunk(flightPosition, b.descriptor);
  });

  const kept: TerrainMesh[] = [];
  for (const item of sorted) {
    if (item.descriptor.lod >= 2 && graphicsQuality === "low") {
      continue;
    }
    kept.push(item.mesh);
  }

  const merged = mergeTerrainMeshes(kept);
  return limitTerrainEdges(merged, EDGE_CAP_BY_QUALITY[graphicsQuality]);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export type TerrainStreamingSession = {
  bootstrap: (graphicsQuality: GraphicsQuality) => Promise<TerrainMesh>;
  refreshAroundFlight: (flightPosition: Vec3, graphicsQuality: GraphicsQuality) => Promise<TerrainMesh | null>;
  clear: () => void;
};

export function createTerrainStreamingSession(): TerrainStreamingSession {
  let manifest: TerrainManifest | null = null;
  let loadedChunks: LoadedTerrainChunk[] = [];
  const inFlight = new Map<string, Promise<LoadedTerrainChunk>>();

  const loadChunk = async (descriptor: TerrainChunkDescriptor): Promise<LoadedTerrainChunk> => {
    const cacheHit = await readFromCache(descriptor.chunkId);
    if (cacheHit) {
      return {
        descriptor,
        mesh: mapRawTerrainData(cacheHit),
      };
    }

    const raw = normalizeRawTerrainData(await fetchJson(descriptor.url));
    await writeToCache(descriptor.chunkId, raw);
    return {
      descriptor,
      mesh: mapRawTerrainData(raw),
    };
  };

  const loadChunkOnce = async (descriptor: TerrainChunkDescriptor): Promise<LoadedTerrainChunk> => {
    const existing = loadedChunks.find((chunk) => chunk.descriptor.chunkId === descriptor.chunkId);
    if (existing) {
      return existing;
    }

    const pending = inFlight.get(descriptor.chunkId);
    if (pending) {
      return pending;
    }

    const request = loadChunk(descriptor)
      .then((chunk) => {
        loadedChunks.push(chunk);
        return chunk;
      })
      .finally(() => {
        inFlight.delete(descriptor.chunkId);
      });

    inFlight.set(descriptor.chunkId, request);
    return request;
  };

  const ensureManifest = async (): Promise<TerrainManifest> => {
    if (manifest) {
      return manifest;
    }
    const loaded = normalizeManifest(await fetchJson("/api/terrain/manifest"));
    manifest = loaded;
    return loaded;
  };

  const preloadLikelyChunks = (loadedManifest: TerrainManifest): void => {
    const preloadTargets = loadedManifest.chunks
      .filter((chunk) => !loadedManifest.bootstrapChunkIds.includes(chunk.chunkId))
      .sort((a, b) => a.lod - b.lod)
      .slice(0, 6);

    Promise.all(preloadTargets.map((chunk) => loadChunkOnce(chunk))).catch(() => {
      // Ignore preload failures and keep gameplay responsive.
    });
  };

  return {
    async bootstrap(graphicsQuality: GraphicsQuality): Promise<TerrainMesh> {
      const loadedManifest = await ensureManifest();
      const bootstrapTargets = loadedManifest.chunks.filter((chunk) =>
        loadedManifest.bootstrapChunkIds.includes(chunk.chunkId),
      );

      if (bootstrapTargets.length === 0) {
        throw new Error("E_MANIFEST_EMPTY: no bootstrap chunks available");
      }

      await Promise.all(bootstrapTargets.map((chunk) => loadChunkOnce(chunk)));
      preloadLikelyChunks(loadedManifest);

      return buildLodTerrain(loadedChunks, graphicsQuality, { x: 0, y: 0, z: 0 });
    },

    async refreshAroundFlight(flightPosition: Vec3, graphicsQuality: GraphicsQuality): Promise<TerrainMesh | null> {
      if (!manifest) {
        return null;
      }

      const loadedIds = new Set(loadedChunks.map((chunk) => chunk.descriptor.chunkId));
      const targets = selectTargetChunks(manifest, loadedIds, flightPosition, graphicsQuality);
      if (targets.length === 0) {
        const trimmed = keepChunksNear(loadedChunks, flightPosition, graphicsQuality);
        if (trimmed.length === loadedChunks.length) {
          return null;
        }
        loadedChunks = trimmed;
        return buildLodTerrain(loadedChunks, graphicsQuality, flightPosition);
      }

      await Promise.all(targets.map((target) => loadChunkOnce(target)));
      loadedChunks = keepChunksNear(loadedChunks, flightPosition, graphicsQuality);
      return buildLodTerrain(loadedChunks, graphicsQuality, flightPosition);
    },

    clear() {
      loadedChunks = [];
      manifest = null;
      inFlight.clear();
    },
  };
}

export function isValidChunkId(chunkId: string): boolean {
  return CHUNK_ID_PATTERN.test(chunkId);
}

export function buildTerrainFromLoadedChunks(
  chunks: LoadedTerrainChunk[],
  graphicsQuality: GraphicsQuality,
  flightPosition: Vec3,
): TerrainMesh {
  return buildLodTerrain(chunks, graphicsQuality, flightPosition);
}
