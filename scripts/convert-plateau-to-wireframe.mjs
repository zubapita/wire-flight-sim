#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const EXIT_INVALID_ARGS = 2;
const EXIT_READ_FAILED = 3;
const EXIT_PARSE_FAILED = 4;
const EXIT_CONVERT_FAILED = 5;
const EXIT_WRITE_FAILED = 6;

function printUsage() {
  console.error(
    "Usage: node scripts/convert-plateau-to-wireframe.mjs --input <input.json> --output <output.json> [--decimals 3]",
  );
}

function parseArgs(argv) {
  const args = { decimals: 3 };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input") {
      args.input = argv[i + 1];
      i += 1;
    } else if (token === "--output") {
      args.output = argv[i + 1];
      i += 1;
    } else if (token === "--decimals") {
      args.decimals = Number(argv[i + 1]);
      i += 1;
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }

  if (!args.input || !args.output || !Number.isInteger(args.decimals) || args.decimals < 0 || args.decimals > 6) {
    throw new Error("Invalid arguments");
  }

  return args;
}

function quantize(value, decimals) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function makeVertexKey(vertex, decimals) {
  return `${quantize(vertex[0], decimals)},${quantize(vertex[1], decimals)},${quantize(vertex[2], decimals)}`;
}

function addVertex(vertexMap, vertices, vertex, decimals) {
  const key = makeVertexKey(vertex, decimals);
  const index = vertexMap.get(key);
  if (index !== undefined) {
    return index;
  }

  const nextIndex = vertices.length;
  vertexMap.set(key, nextIndex);
  vertices.push([quantize(vertex[0], decimals), quantize(vertex[1], decimals), quantize(vertex[2], decimals)]);
  return nextIndex;
}

function normalizeEdge(a, b) {
  return a < b ? [a, b] : [b, a];
}

function extractRingsFromGeoJSONFeature(feature) {
  if (!feature || !feature.geometry) {
    return [];
  }

  const { type, coordinates } = feature.geometry;
  if (type === "Polygon") {
    return coordinates;
  }
  if (type === "MultiPolygon") {
    return coordinates.flat();
  }
  return [];
}

function extractRingsFromCityJSONGeometry(cityObject, vertices) {
  const geometries = cityObject?.geometry;
  if (!Array.isArray(geometries)) {
    return [];
  }

  const rings = [];

  for (const geometry of geometries) {
    if (geometry.type !== "MultiSurface" && geometry.type !== "Solid") {
      continue;
    }

    const boundaries = geometry.boundaries;
    if (!Array.isArray(boundaries)) {
      continue;
    }

    for (const boundary of boundaries) {
      const candidateRings = geometry.type === "Solid" ? boundary.flat() : boundary;
      for (const ringIndexes of candidateRings) {
        if (!Array.isArray(ringIndexes) || ringIndexes.length < 2) {
          continue;
        }
        const ring = [];
        for (const vertexIndex of ringIndexes) {
          const vertex = vertices[vertexIndex];
          if (!vertex) {
            continue;
          }
          ring.push(vertex);
        }
        if (ring.length >= 2) {
          rings.push(ring);
        }
      }
    }
  }

  return rings;
}

function convertToWireframe(inputData, decimals) {
  const vertices = [];
  const vertexMap = new Map();
  const edgeSet = new Set();
  const faces = [];

  const addRing = (ring) => {
    if (!Array.isArray(ring) || ring.length < 2) {
      return;
    }

    const ringVertexIndexes = ring.map((v) => addVertex(vertexMap, vertices, v, decimals));

    for (let i = 0; i < ringVertexIndexes.length; i += 1) {
      const a = ringVertexIndexes[i];
      const b = ringVertexIndexes[(i + 1) % ringVertexIndexes.length];
      if (a === b) {
        continue;
      }
      const [e0, e1] = normalizeEdge(a, b);
      edgeSet.add(`${e0},${e1}`);
    }

    if (ringVertexIndexes.length >= 3) {
      for (let i = 1; i < ringVertexIndexes.length - 1; i += 1) {
        const f0 = ringVertexIndexes[0];
        const f1 = ringVertexIndexes[i];
        const f2 = ringVertexIndexes[i + 1];
        if (f0 !== f1 && f1 !== f2 && f0 !== f2) {
          faces.push([f0, f1, f2]);
        }
      }
    }
  };

  if (inputData.type === "FeatureCollection" && Array.isArray(inputData.features)) {
    for (const feature of inputData.features) {
      const rings = extractRingsFromGeoJSONFeature(feature);
      for (const ring of rings) {
        addRing(ring);
      }
    }
  } else if (inputData.type === "CityJSON" && inputData.CityObjects && inputData.vertices) {
    const allVertices = inputData.vertices;
    for (const key of Object.keys(inputData.CityObjects).sort()) {
      const cityObject = inputData.CityObjects[key];
      const rings = extractRingsFromCityJSONGeometry(cityObject, allVertices);
      for (const ring of rings) {
        addRing(ring);
      }
    }
  } else {
    throw new Error("Unsupported input format. Provide GeoJSON FeatureCollection or CityJSON.");
  }

  const edges = Array.from(edgeSet)
    .map((entry) => entry.split(",").map(Number))
    .sort((a, b) => (a[0] - b[0] !== 0 ? a[0] - b[0] : a[1] - b[1]));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    vertexCount: vertices.length,
    edgeCount: edges.length,
    faceCount: faces.length,
    vertices,
    edges,
    faces,
  };
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    printUsage();
    console.error(`E_INVALID_ARGS: ${error.message}`);
    process.exit(EXIT_INVALID_ARGS);
  }

  let raw;
  try {
    raw = await readFile(path.resolve(args.input), "utf8");
  } catch (error) {
    console.error(`E_READ_FAILED: ${error.message}`);
    process.exit(EXIT_READ_FAILED);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.error(`E_PARSE_FAILED: ${error.message}`);
    process.exit(EXIT_PARSE_FAILED);
  }

  let output;
  try {
    output = convertToWireframe(data, args.decimals);
  } catch (error) {
    console.error(`E_CONVERT_FAILED: ${error.message}`);
    process.exit(EXIT_CONVERT_FAILED);
  }

  try {
    await writeFile(path.resolve(args.output), `${JSON.stringify(output, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error(`E_WRITE_FAILED: ${error.message}`);
    process.exit(EXIT_WRITE_FAILED);
  }

  console.log(`Converted ${args.input} -> ${args.output}`);
  console.log(`Vertices: ${output.vertexCount}, Edges: ${output.edgeCount}`);
}

main();
