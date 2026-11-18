import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getUploadDir } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const singleFile = formData.get('file') as File | null;

    const uploadTargets: File[] = [...files];
    if (singleFile && !uploadTargets.includes(singleFile)) {
      uploadTargets.push(singleFile);
    }

    if (uploadTargets.length === 0) {
      return NextResponse.json({ error: '업로드할 파일이 없습니다.' }, { status: 400 });
    }

    const uploadDir = getUploadDir();
    const urls: string[] = [];

    for (const file of uploadTargets) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const ext = path.extname(file.name) || '.jpg';
      const safeBase = path
        .basename(file.name, ext)
        .replace(/[^a-zA-Z0-9가-힣_-]/g, '_')
        .slice(0, 32);
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase}${ext}`;
      const filePath = path.join(uploadDir, uniqueName);

      await fs.writeFile(filePath, buffer);
      urls.push(`/api/files/${encodeURIComponent(uniqueName)}`);
    }

    return NextResponse.json({
      ok: true,
      url: urls[0],
      urls,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: '파일 업로드에 실패했습니다.' }, { status: 500 });
  }
}
