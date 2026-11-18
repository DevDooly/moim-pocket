import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getUploadDir } from '@/lib/storage';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    const decoded = decodeURIComponent(filename);
    const safeName = path.basename(decoded);
    const uploadDir = getUploadDir();
    let filePath = path.join(uploadDir, safeName);

    // 루트에 없으면 앨범 하위 폴더에서 탐색
    if (!fs.existsSync(filePath)) {
      const dirs = fs.readdirSync(uploadDir, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory()) {
          const candidate = path.join(uploadDir, d.name, safeName);
          if (fs.existsSync(candidate)) {
            filePath = candidate;
            break;
          }
        }
      }
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return new NextResponse('File Not Found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('File serve error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
