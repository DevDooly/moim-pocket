import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/prisma';
import { getUploadDir } from '@/lib/storage';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const albumId = searchParams.get('albumId');

    if (!albumId) {
      return NextResponse.json({ error: '앨범 ID가 필요합니다.' }, { status: 400 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: { photos: true },
    });

    if (!album) {
      return NextResponse.json({ error: '앨범을 찾을 수 없습니다.' }, { status: 404 });
    }

    const zip = new JSZip();
    const uploadDir = getUploadDir();

    for (let i = 0; i < album.photos.length; i++) {
      const photo = album.photos[i];
      const fileName = path.basename(decodeURIComponent(photo.url));
      const filePath = path.join(uploadDir, fileName);

      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(fileName) || '.jpg';
        zip.file(`${String(i + 1).padStart(3, '0')}_${fileName.replace(/^[0-9]+-[a-z0-9]+-/, '') || `photo${ext}`}`, buffer);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const safeAlbumTitle = encodeURIComponent(album.title.replace(/\s+/g, '_'));

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeAlbumTitle}.zip"`,
      },
    });
  } catch (error) {
    console.error('Album ZIP error:', error);
    return NextResponse.json({ error: 'ZIP 파일 생성에 실패했습니다.' }, { status: 500 });
  }
}
