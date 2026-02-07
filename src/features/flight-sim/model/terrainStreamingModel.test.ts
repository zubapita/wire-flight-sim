import { describe, expect, it } from "vitest";
import {
  buildTerrainFromLoadedChunks,
  isValidChunkId,
  LoadedTerrainChunk,
  TerrainChunkDescriptor,
} from "@/features/flight-sim/model/terrainStreamingModel";
import { TerrainMesh } from "@/features/flight-sim/model/terrainModel";

function createDescriptor(chunkId: string, lod: number): TerrainChunkDescriptor {
  return {
    chunkId,
    lod,
    url: `/api/terrain/chunk/${chunkId}`,
    gridX: 0,
    gridZ: 0,
    bbox: {
      minX: -100,
      minY: 0,
      minZ: -100,
      maxX: 100,
      maxY: 100,
      maxZ: 100,
    },
  };
}

function createDenseMesh(edgeCount: number): TerrainMesh {
  const vertices = Array.from({ length: edgeCount + 1 }, (_, index) => ({
    x: index,
    y: 0,
    z: 0,
  }));

  const edges: Array<[number, number]> = [];
  for (let i = 0; i < edgeCount; i += 1) {
    edges.push([i, i + 1]);
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

describe("terrainStreamingModel", () => {
  it("validates chunk id format", () => {
    expect(isValidChunkId("tokyo_0_1")).toBe(true);
    expect(isValidChunkId("TOKYO-0-1")).toBe(false);
  });

  it("caps edges for low quality", () => {
    const chunk: LoadedTerrainChunk = {
      descriptor: createDescriptor("tokyo_0_0", 0),
      mesh: createDenseMesh(6000),
    };

    const terrain = buildTerrainFromLoadedChunks([chunk], "low", { x: 0, y: 0, z: 0 });
    expect(terrain.edges.length).toBeLessThanOrEqual(5000);
  });

  it("keeps far lod-2 chunk to preserve network continuity", () => {
    const nearChunk: LoadedTerrainChunk = {
      descriptor: createDescriptor("tokyo_0_0", 0),
      mesh: createDenseMesh(40),
    };
    const farChunk: LoadedTerrainChunk = {
      descriptor: {
        ...createDescriptor("tokyo_4_4", 2),
        gridX: 4,
        gridZ: 4,
        bbox: {
          minX: 4000,
          minY: 0,
          minZ: 4000,
          maxX: 4200,
          maxY: 100,
          maxZ: 4200,
        },
      },
      mesh: createDenseMesh(40),
    };

    const terrain = buildTerrainFromLoadedChunks([nearChunk, farChunk], "low", { x: 0, y: 0, z: 0 });
    expect(terrain.edges.length).toBe(80);
  });
});
