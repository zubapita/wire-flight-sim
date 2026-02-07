#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const DEFAULT_CITYGML_ZIP = path.join(
  os.homedir(),
  "Library/Application Support/plateaukit/data/13103_minato-ku_pref_2023_citygml_2_op.zip",
);
const DEFAULT_RAILWAY_GEOJSON = path.join(process.cwd(), "docs/data/minato_related_railway.geojson");
const DEFAULT_OUTPUT = path.join(process.cwd(), "docs/data/minato_plateau_feature_collection.json");
const DEFAULT_MESH_CODES = [
  "53393567",
  "53393568",
  "53393569",
  "53393640",
  "53393641",
  "53393650",
  "53393651",
  "53393652",
  "53393660",
  "53393661",
  "53393662",
  "53393670",
];

const CITY_GML_LAYER_PATTERNS = [
  {
    layer: "building",
    matcher: /^udx\/bldg\/.+_bldg_.+_op\.gml$/,
  },
  {
    layer: "road",
    matcher: /^udx\/tran\/.+_tran_.+_op\.gml$/,
  },
  {
    layer: "bridge",
    matcher: /^udx\/brid\/.+_brid_.+_op\.gml$/,
  },
  {
    layer: "water",
    matcher: /^udx\/fld\/.+_fld_.+_op\.gml$/,
  },
];

function parseArgs(argv) {
  const args = {
    citygmlZip: DEFAULT_CITYGML_ZIP,
    railwayGeojson: DEFAULT_RAILWAY_GEOJSON,
    output: DEFAULT_OUTPUT,
    meshCodes: DEFAULT_MESH_CODES,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--citygml-zip") {
      args.citygmlZip = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--railway-geojson") {
      args.railwayGeojson = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--output") {
      args.output = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--mesh-codes") {
      args.meshCodes = String(argv[i + 1] ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => /^\d{8}$/.test(value));
      i += 1;
      continue;
    }
    throw new Error(`Unknown option: ${token}`);
  }

  return args;
}

function parseNumbers(raw) {
  return raw
    .trim()
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function normalizeLonLat(x, y, z) {
  // Some CityGML tiles encode [lat, lon, z]; swap to [lon, lat, z].
  if (Math.abs(x) <= 90 && Math.abs(y) <= 180 && Math.abs(y) > 90) {
    return [y, x, z];
  }
  return [x, y, z];
}

function parsePosList(posListTag, value) {
  const dimMatch = posListTag.match(/srsDimension=\"(\d+)\"/);
  const values = parseNumbers(value);
  if (values.length < 6) {
    return null;
  }

  let dimension = dimMatch ? Number(dimMatch[1]) : 0;
  if (!Number.isInteger(dimension) || dimension < 2 || dimension > 3) {
    if (values.length % 3 === 0) {
      dimension = 3;
    } else {
      dimension = 2;
    }
  }

  const coordinates = [];
  for (let i = 0; i < values.length; i += dimension) {
    const x = values[i];
    const y = values[i + 1];
    const z = dimension >= 3 ? values[i + 2] : 0;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      continue;
    }
    coordinates.push(normalizeLonLat(x, y, z));
  }

  if (coordinates.length < 3) {
    return null;
  }

  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1] || first[2] !== last[2]) {
    coordinates.push([...first]);
  }

  return coordinates;
}

function extractPolygonFeaturesFromCityGml(gmlText, layer, sourceEntry) {
  const features = [];
  const posListRegex = /(<gml:posList[^>]*>)([\s\S]*?)<\/gml:posList>/g;

  let match = posListRegex.exec(gmlText);
  let index = 0;
  while (match) {
    const ring = parsePosList(match[1], match[2]);
    if (ring) {
      features.push({
        type: "Feature",
        properties: {
          layer,
          sourceEntry,
          sourceIndex: index,
        },
        geometry: {
          type: "Polygon",
          coordinates: [ring],
        },
      });
      index += 1;
    }
    match = posListRegex.exec(gmlText);
  }

  return features;
}

function readZipEntry(zipPath, entryPath) {
  return execFileSync("unzip", ["-p", zipPath, entryPath], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 1024,
  });
}

function listZipEntries(zipPath) {
  const raw = execFileSync("unzip", ["-Z1", zipPath], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function resolveCityGmlSources(zipPath, meshCodes) {
  const entries = listZipEntries(zipPath);
  const sources = [];
  const allowedCodes = new Set(meshCodes);

  for (const entry of entries) {
    const codeMatch = entry.match(/\/(\d{8})_[^/]+_op\.gml$/);
    if (!codeMatch) {
      continue;
    }
    if (allowedCodes.size > 0 && !allowedCodes.has(codeMatch[1])) {
      continue;
    }

    for (const pattern of CITY_GML_LAYER_PATTERNS) {
      if (pattern.matcher.test(entry)) {
        sources.push({
          entry,
          layer: pattern.layer,
        });
        break;
      }
    }
  }

  return sources.sort((a, b) => a.entry.localeCompare(b.entry));
}

async function loadRailwayFeatures(railwayGeojsonPath) {
  const raw = await readFile(path.resolve(railwayGeojsonPath), "utf8");
  const data = JSON.parse(raw);
  const inputFeatures = Array.isArray(data.features) ? data.features : [];

  return inputFeatures
    .filter((feature) => feature?.geometry?.type === "LineString" || feature?.geometry?.type === "MultiLineString")
    .map((feature) => ({
      type: "Feature",
      properties: {
        ...(feature.properties ?? {}),
        layer: "railway",
      },
      geometry: feature.geometry,
    }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cityGmlSources = resolveCityGmlSources(path.resolve(args.citygmlZip), args.meshCodes);
  if (cityGmlSources.length === 0) {
    throw new Error("No CityGML sources matched expected patterns in zip.");
  }

  const allFeatures = [];
  for (const source of cityGmlSources) {
    const xml = readZipEntry(path.resolve(args.citygmlZip), source.entry);
    const features = extractPolygonFeaturesFromCityGml(xml, source.layer, source.entry);
    for (const feature of features) {
      allFeatures.push(feature);
    }
  }

  const railwayFeatures = await loadRailwayFeatures(args.railwayGeojson);
  for (const feature of railwayFeatures) {
    allFeatures.push(feature);
  }

  const output = {
    type: "FeatureCollection",
    source: "plateau-13103-minato-ku-2023-citygml-v4-and-related-v4",
    generatedAt: new Date().toISOString(),
    features: allFeatures,
  };

  const outputPath = path.resolve(args.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output)}\n`, "utf8");

  console.log(`Generated ${outputPath}`);
  console.log(`CityGML sources: ${cityGmlSources.length}`);
  console.log(`Features: ${allFeatures.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
