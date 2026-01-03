"use client";

import { Download, FileIcon, FileText, FileCode, FileImage, FileVideo, FileAudio, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileMessageProps {
  file: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
  };
  isOwn: boolean;
}

// Format file size to human readable
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Get icon based on mime type
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("rar") || mimeType.includes("7z")) return FileArchive;
  if (mimeType.includes("text/") || mimeType.includes("javascript") || mimeType.includes("json") || mimeType.includes("xml")) return FileCode;
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("word")) return FileText;
  return FileIcon;
}

export function FileMessage({ file, isOwn }: FileMessageProps) {
  const Icon = getFileIcon(file.mimeType);

  const handleDownload = async () => {
    try {
      // Get auth token
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("auth_token="))
        ?.split("=")[1];

      const response = await fetch(`/api/files/${file.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        isOwn
          ? "bg-primary/10 border-primary/20"
          : "bg-muted border-border"
      }`}
    >
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
          isOwn ? "bg-primary/20" : "bg-background"
        }`}
      >
        <Icon className={`w-5 h-5 ${isOwn ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.originalName}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDownload}
        className="flex-shrink-0"
        title="Download"
      >
        <Download className="w-4 h-4" />
      </Button>
    </div>
  );
}
