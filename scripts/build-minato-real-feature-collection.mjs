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

const CITY_GML_SOURCES = [
  {
    entry: "udx/bldg/53393661_bldg_6697_op.gml",
    layer: "building",
  },
  {
    entry: "udx/tran/53393661_tran_6697_op.gml",
    layer: "road",
  },
  {
    entry: "udx/brid/53393661_brid_6697_op.gml",
    layer: "bridge",
  },
  {
    entry: "udx/fld/pref/furukawa_shibuyagawa-furukawa-etc/53393567_fld_6697_l2_op.gml",
    layer: "water",
  },
];

function parseArgs(argv) {
  const args = {
    citygmlZip: DEFAULT_CITYGML_ZIP,
    railwayGeojson: DEFAULT_RAILWAY_GEOJSON,
    output: DEFAULT_OUTPUT,
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

  const allFeatures = [];
  for (const source of CITY_GML_SOURCES) {
    const xml = readZipEntry(path.resolve(args.citygmlZip), source.entry);
    const features = extractPolygonFeaturesFromCityGml(xml, source.layer, source.entry);
    allFeatures.push(...features);
  }

  const railwayFeatures = await loadRailwayFeatures(args.railwayGeojson);
  allFeatures.push(...railwayFeatures);

  const output = {
    type: "FeatureCollection",
    source: "plateau-13103-minato-ku-2023-citygml-v4-and-related-v4",
    generatedAt: new Date().toISOString(),
    features: allFeatures,
  };

  const outputPath = path.resolve(args.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Generated ${outputPath}`);
  console.log(`Features: ${allFeatures.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
