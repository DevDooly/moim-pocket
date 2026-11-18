import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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

    return NextResponse.json({ albums, events });
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
