import { NextResponse } from "next/server";
import { z } from "zod";
import { getTerrainChunkById } from "@/features/flight-sim/model/terrainChunkServerModel";

export const runtime = "nodejs";

const chunkIdSchema = z.string().regex(/^[a-z0-9_]+$/);

type RouteContext = {
  params: Promise<{
    chunkId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { chunkId: rawChunkId } = await context.params;
  const chunkIdResult = chunkIdSchema.safeParse(rawChunkId);

  if (!chunkIdResult.success) {
    return NextResponse.json(
      {
        code: "E_INVALID_CHUNK_ID",
        message: "chunkId must match ^[a-z0-9_]+$",
      },
      { status: 400 },
    );
  }

  try {
    const chunk = await getTerrainChunkById(chunkIdResult.data);
    if (!chunk) {
      return NextResponse.json(
        {
          code: "E_CHUNK_NOT_FOUND",
          message: `Chunk not found: ${chunkIdResult.data}`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(chunk);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown chunk load failure";
    return NextResponse.json(
      {
        code: "E_CHUNK_LOAD",
        message: `Failed to load terrain chunk: ${message}`,
      },
      { status: 500 },
    );
  }
}
