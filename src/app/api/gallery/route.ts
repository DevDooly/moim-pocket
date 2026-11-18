import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getUploadDir } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

/**
 * 갤러리 폴더(/app/data/uploads -> 호스트 /media/rudy/moim-gallery) 내의 이미지 파일을 스캔하여
 * DB에 아직 등록되지 않은 이미지가 있으면 자동으로 앨범에 연결합니다.
 */
async function syncLocalGalleryFolder() {
  try {
    const uploadDir = getUploadDir();
    if (!fs.existsSync(uploadDir)) return;

    const firstMember = await prisma.member.findFirst({
      orderBy: { joinedAt: 'asc' },
    });
    if (!firstMember) return;

    let defaultAlbum = await prisma.album.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!defaultAlbum) {
      defaultAlbum = await prisma.album.create({
        data: { title: '모임 기본 앨범' },
      });
    }

    const existingPhotos = await prisma.photo.findMany({
      select: { url: true },
    });
    const registeredFiles = new Set(
      existingPhotos.map((p) => path.basename(decodeURIComponent(p.url)))
    );

    const entries = fs.readdirSync(uploadDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext)) continue;
      if (registeredFiles.has(entry.name)) continue;

      const url = `/api/files/${encodeURIComponent(entry.name)}`;
      const rawCaption = path
        .basename(entry.name, ext)
        .replace(/^[0-9]+-[a-z0-9]+-/, '')
        .replace(/[_-]+/g, ' ')
        .trim();

      await prisma.photo.create({
        data: {
          url,
          caption: rawCaption || entry.name,
          albumId: defaultAlbum.id,
          uploaderId: firstMember.id,
        },
      });
    }
  } catch (err) {
    console.error('Local gallery folder sync error:', err);
  }
}

export async function GET() {
  try {
    await syncLocalGalleryFolder();

    const albums = await prisma.album.findMany({
      include: {
        event: true,
        photos: {
          include: { uploader: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const events = await prisma.event.findMany({
      orderBy: { startAt: 'desc' },
    });

    return NextResponse.json({
      albums,
      events,
      galleryHostPath: process.env.GALLERY_HOST_PATH || '/media/rudy/moim-gallery',
    });
  } catch (error) {
    console.error('Gallery GET error:', error);
    return NextResponse.json({ error: '갤러리를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'create_album') {
      const { title, eventId } = body;
      if (!title) {
        return NextResponse.json({ error: '앨범 제목을 입력해주세요.' }, { status: 400 });
      }

      const album = await prisma.album.create({
        data: {
          title: String(title).trim(),
          eventId: eventId || null,
        },
      });

      return NextResponse.json({ ok: true, album });
    }

    if (action === 'add_photos') {
      const { albumId, uploaderId, urls, caption } = body;
      if (!albumId || !uploaderId || !Array.isArray(urls) || urls.length === 0) {
        return NextResponse.json({ error: '앨범, 업로더 및 이미지 URL이 필요합니다.' }, { status: 400 });
      }

      await prisma.photo.createMany({
        data: urls.map((url: string) => ({
          url,
          caption: caption || null,
          albumId,
          uploaderId,
        })),
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  } catch (error) {
    console.error('Gallery POST error:', error);
    return NextResponse.json({ error: '갤러리 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const photoId = searchParams.get('photoId');
    const albumId = searchParams.get('albumId');

    if (photoId) {
      const photo = await prisma.photo.findUnique({ where: { id: photoId } });
      if (photo) {
        const fileName = path.basename(decodeURIComponent(photo.url));
        const filePath = path.join(getUploadDir(), fileName);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch {}
        }
      }
      await prisma.photo.delete({ where: { id: photoId } });
      return NextResponse.json({ ok: true });
    }

    if (albumId) {
      await prisma.album.delete({ where: { id: albumId } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '삭제 대상 ID가 필요합니다.' }, { status: 400 });
  } catch (error) {
    console.error('Gallery DELETE error:', error);
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
  }
}
