import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getUploadDir, getAlbumDir } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const singleFile = formData.get('file') as File | null;
    const albumTitle = formData.get('albumTitle') as string | null;

    const uploadTargets: File[] = [...files];
    if (singleFile && !uploadTargets.includes(singleFile)) {
      uploadTargets.push(singleFile);
    }

    if (uploadTargets.length === 0) {
      return NextResponse.json({ error: '업로드할 파일이 없습니다.' }, { status: 400 });
    }

    // 앨범명이 전달된 경우 /media/rudy/moim-gallery/<앨범폴더명>/ 하위에 저장
    // 영수증/게시글 첨부 등 일반 파일은 /media/rudy/moim-gallery/_기타첨부/ 하위에 저장
    const targetFolderTitle = albumTitle ? albumTitle : '_기타첨부';
    const { folderName, fullPath: targetDir } = getAlbumDir(targetFolderTitle);

    const urls: string[] = [];

    for (const file of uploadTargets) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const ext = path.extname(file.name) || '.jpg';
      const safeBase = path
        .basename(file.name, ext)
        .replace(/[^a-zA-Z0-9가-힣_-]/g, '_')
        .slice(0, 40);
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeBase}${ext}`;
      const filePath = path.join(targetDir, uniqueName);

      await fs.writeFile(filePath, buffer);
      urls.push(
        `/api/uploads/${encodeURIComponent(folderName)}/${encodeURIComponent(uniqueName)}`
      );
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
