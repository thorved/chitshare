import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { readFile, unlink } from "fs/promises";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/files/[id] - Download file
export async function GET(request: Request, { params }: RouteParams) {
  try {
    await requireAuth(request);
    const { id } = await params;

    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    try {
      const data = await readFile(file.path);

      return new NextResponse(data, {
        headers: {
          "Content-Type": file.mimeType,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(file.originalName)}"`,
          "Content-Length": String(file.size),
        },
      });
    } catch {
      return NextResponse.json(
        { error: "File not found on disk" },
        { status: 404 },
      );
    }
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/files/[id] - Delete file (owner or admin)
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Only uploader or admin can delete
    if (file.uploaderId !== user.id && !user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete from disk
    try {
      await unlink(file.path);
    } catch {
      // File might already be deleted
    }

    // Delete from database
    await prisma.file.delete({ where: { id } });

    return NextResponse.json({ message: "File deleted" });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
