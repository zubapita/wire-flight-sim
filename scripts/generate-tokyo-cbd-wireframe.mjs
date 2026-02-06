#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_OUTPUT = "public/terrain/sample_tokyo_wireframe.json";

function parseArgs(argv) {
  const args = { output: DEFAULT_OUTPUT };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--output") {
      args.output = argv[i + 1];
      i += 1;
      continue;
    }
    throw new Error(`Unknown option: ${token}`);
  }

  return args;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createBuilder() {
  const vertices = [];
  const edges = [];
  const faces = [];
  const vertexMap = new Map();
  const layerMap = new Map();

  function vertexKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  function addVertex(x, y, z) {
    const key = vertexKey(x, y, z);
    const existing = vertexMap.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const index = vertices.length;
    vertices.push([x, y, z]);
    vertexMap.set(key, index);
    return index;
  }

  function ensureLayer(layerName) {
    const normalized = layerName ?? "other";
    const existing = layerMap.get(normalized);
    if (existing) {
      return existing;
    }
    const created = { edges: [], faces: [] };
    layerMap.set(normalized, created);
    return created;
  }

  function addEdge(a, b, layerName = "other") {
    if (a === b) {
      return;
    }
    const edge = [a, b];
    edges.push(edge);
    ensureLayer(layerName).edges.push(edge);
  }

  function addFace(a, b, c, layerName = "other") {
    if (a !== b && b !== c && c !== a) {
      const face = [a, b, c];
      faces.push(face);
      ensureLayer(layerName).faces.push(face);
    }
  }

  function addQuad(a, b, c, d, layerName = "other") {
    addEdge(a, b, layerName);
    addEdge(b, c, layerName);
    addEdge(c, d, layerName);
    addEdge(d, a, layerName);
    addFace(a, b, c, layerName);
    addFace(a, c, d, layerName);
  }

  function addBox(cx, cz, width, depth, height, layerName = "building") {
    const hw = width / 2;
    const hd = depth / 2;
    const y0 = 0;
    const y1 = height;

    const v0 = addVertex(cx - hw, y0, cz - hd);
    const v1 = addVertex(cx + hw, y0, cz - hd);
    const v2 = addVertex(cx + hw, y0, cz + hd);
    const v3 = addVertex(cx - hw, y0, cz + hd);
    const v4 = addVertex(cx - hw, y1, cz - hd);
    const v5 = addVertex(cx + hw, y1, cz - hd);
    const v6 = addVertex(cx + hw, y1, cz + hd);
    const v7 = addVertex(cx - hw, y1, cz + hd);

    addQuad(v0, v1, v2, v3, layerName); // bottom
    addQuad(v4, v5, v6, v7, layerName); // top
    addQuad(v0, v1, v5, v4, layerName);
    addQuad(v1, v2, v6, v5, layerName);
    addQuad(v2, v3, v7, v6, layerName);
    addQuad(v3, v0, v4, v7, layerName);
  }

  function addStrip(points, width, y, layerName) {
    if (!Array.isArray(points) || points.length < 2) {
      return;
    }

    for (let i = 0; i < points.length - 1; i += 1) {
      const from = points[i];
      const to = points[i + 1];
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const length = Math.hypot(dx, dz);
      if (length === 0) {
        continue;
      }
      const nx = (-dz / length) * (width / 2);
      const nz = (dx / length) * (width / 2);

      const a = addVertex(from.x + nx, y, from.z + nz);
      const b = addVertex(from.x - nx, y, from.z - nz);
      const c = addVertex(to.x - nx, y, to.z - nz);
      const d = addVertex(to.x + nx, y, to.z + nz);
      addQuad(a, b, c, d, layerName);
    }
  }

  return {
    vertices,
    edges,
    faces,
    addVertex,
    addEdge,
    addBox,
    addStrip,
    buildLayers() {
      const layerEntries = Array.from(layerMap.entries()).sort(([a], [b]) => a.localeCompare(b));
      const layers = {};
      for (const [layerName, layerData] of layerEntries) {
        layers[layerName] = {
          edgeCount: layerData.edges.length,
          faceCount: layerData.faces.length,
          edges: layerData.edges,
          faces: layerData.faces,
        };
      }
      return layers;
    },
  };
}

function addGroundGrid(builder) {
  const size = 5000;
  const step = 500;

  for (let x = -size; x <= size; x += step) {
    const a = builder.addVertex(x, 0, -size);
    const b = builder.addVertex(x, 0, size);
    builder.addEdge(a, b, "ground");
  }

  for (let z = -size; z <= size; z += step) {
    const a = builder.addVertex(-size, 0, z);
    const b = builder.addVertex(size, 0, z);
    builder.addEdge(a, b, "ground");
  }
}

function addRoadFrame(builder) {
  const ring = 2200;
  const avenue = 900;

  const p0 = builder.addVertex(-ring, 0, -ring);
  const p1 = builder.addVertex(ring, 0, -ring);
  const p2 = builder.addVertex(ring, 0, ring);
  const p3 = builder.addVertex(-ring, 0, ring);
  builder.addEdge(p0, p1, "road");
  builder.addEdge(p1, p2, "road");
  builder.addEdge(p2, p3, "road");
  builder.addEdge(p3, p0, "road");

  const a0 = builder.addVertex(-ring, 0, -avenue);
  const a1 = builder.addVertex(ring, 0, -avenue);
  const a2 = builder.addVertex(-ring, 0, avenue);
  const a3 = builder.addVertex(ring, 0, avenue);
  const a4 = builder.addVertex(-avenue, 0, -ring);
  const a5 = builder.addVertex(-avenue, 0, ring);
  const a6 = builder.addVertex(avenue, 0, -ring);
  const a7 = builder.addVertex(avenue, 0, ring);

  builder.addEdge(a0, a1, "road");
  builder.addEdge(a2, a3, "road");
  builder.addEdge(a4, a5, "road");
  builder.addEdge(a6, a7, "road");

  builder.addStrip(
    [
      { x: -2200, z: -600 },
      { x: 2200, z: -600 },
    ],
    120,
    0.4,
    "road",
  );
  builder.addStrip(
    [
      { x: -2200, z: 600 },
      { x: 2200, z: 600 },
    ],
    120,
    0.4,
    "road",
  );
}

function addRailNetwork(builder) {
  builder.addStrip(
    [
      { x: -2600, z: -1200 },
      { x: -1200, z: -400 },
      { x: 200, z: 200 },
      { x: 1600, z: 900 },
      { x: 2600, z: 1400 },
    ],
    16,
    1.5,
    "railway",
  );
  builder.addStrip(
    [
      { x: -2580, z: -1235 },
      { x: -1180, z: -435 },
      { x: 220, z: 165 },
      { x: 1620, z: 865 },
      { x: 2620, z: 1365 },
    ],
    16,
    1.5,
    "railway",
  );
}

function addWaterway(builder) {
  builder.addStrip(
    [
      { x: -2600, z: -300 },
      { x: -1300, z: -120 },
      { x: 200, z: 120 },
      { x: 1600, z: 420 },
      { x: 2600, z: 740 },
    ],
    260,
    -2,
    "water",
  );
}

function addBridge(builder) {
  builder.addStrip(
    [
      { x: -520, z: -520 },
      { x: 520, z: -520 },
    ],
    140,
    18,
    "bridge",
  );
  builder.addStrip(
    [
      { x: -520, z: -520 },
      { x: 520, z: -520 },
    ],
    24,
    22,
    "bridge",
  );
}

function addBuildingCluster(builder, random, config) {
  const {
    centerX,
    centerZ,
    radius,
    count,
    minHeight,
    maxHeight,
    minSize,
    maxSize,
  } = config;

  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = radius * Math.sqrt(random());
    const cx = centerX + Math.cos(angle) * distance;
    const cz = centerZ + Math.sin(angle) * distance;
    const width = minSize + random() * (maxSize - minSize);
    const depth = minSize + random() * (maxSize - minSize);
    const height = minHeight + random() * (maxHeight - minHeight);

    builder.addBox(
      Math.round(cx),
      Math.round(cz),
      Math.round(width),
      Math.round(depth),
      Math.round(height),
      "building",
    );
  }
}

function buildTokyoCbdWireframe() {
  const random = mulberry32(1729);
  const builder = createBuilder();

  addGroundGrid(builder);
  addRoadFrame(builder);
  addRailNetwork(builder);
  addWaterway(builder);
  addBridge(builder);

  addBuildingCluster(builder, random, {
    centerX: 0,
    centerZ: 0,
    radius: 650,
    count: 130,
    minHeight: 120,
    maxHeight: 360,
    minSize: 45,
    maxSize: 130,
  });

  addBuildingCluster(builder, random, {
    centerX: -1100,
    centerZ: 300,
    radius: 700,
    count: 90,
    minHeight: 70,
    maxHeight: 240,
    minSize: 35,
    maxSize: 110,
  });

  addBuildingCluster(builder, random, {
    centerX: 950,
    centerZ: -450,
    radius: 700,
    count: 95,
    minHeight: 80,
    maxHeight: 260,
    minSize: 35,
    maxSize: 115,
  });

  addBuildingCluster(builder, random, {
    centerX: 300,
    centerZ: 1250,
    radius: 850,
    count: 120,
    minHeight: 90,
    maxHeight: 300,
    minSize: 40,
    maxSize: 120,
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: "plateau-inspired-tokyo-cbd",
    vertexCount: builder.vertices.length,
    edgeCount: builder.edges.length,
    faceCount: builder.faces.length,
    vertices: builder.vertices,
    edges: builder.edges,
    faces: builder.faces,
    layers: builder.buildLayers(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const data = buildTokyoCbdWireframe();
  const outputPath = path.resolve(args.output);
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Generated ${outputPath}`);
  console.log(`Vertices: ${data.vertexCount}, Edges: ${data.edgeCount}, Faces: ${data.faceCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
