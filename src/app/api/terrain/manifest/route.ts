import { NextResponse } from "next/server";
import { getTerrainManifest } from "@/features/flight-sim/model/terrainChunkServerModel";

export const runtime = "nodejs";

export async function GET() {
  try {
    const manifest = await getTerrainManifest();
    return NextResponse.json(manifest);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown manifest load failure";
    return NextResponse.json(
      {
        code: "E_MANIFEST_LOAD",
        message: `Failed to load terrain manifest: ${message}`,
      },
      { status: 500 },
    );
  }
}
