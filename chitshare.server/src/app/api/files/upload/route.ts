import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = join(process.cwd(), "uploads");
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch {
    // Directory already exists
  }
}

// POST /api/files/upload - Upload file
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const groupId = formData.get("groupId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 },
      );
    }

    // If uploading to group, verify membership
    if (groupId) {
      const membership = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId: user.id, groupId } },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "Not a group member" },
          { status: 403 },
        );
      }
    }

    await ensureUploadDir();

    // Generate unique filename
    const ext = file.name.split(".").pop() || "";
    const filename = `${randomUUID()}.${ext}`;
    const filepath = join(UPLOAD_DIR, filename);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    // Save to database
    const dbFile = await prisma.file.create({
      data: {
        filename,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        path: filepath,
        uploaderId: user.id,
        groupId: groupId || undefined,
      },
    });

    return NextResponse.json(
      {
        file: {
          id: dbFile.id,
          filename: dbFile.originalName,
          mimeType: dbFile.mimeType,
          size: dbFile.size,
          createdAt: dbFile.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// GET /api/files/upload - List user's files
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");

    const files = await prisma.file.findMany({
      where: groupId ? { groupId } : { uploaderId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        size: true,
        createdAt: true,
        uploader: {
          select: { id: true, username: true },
        },
      },
    });

    return NextResponse.json({ files });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("List files error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
