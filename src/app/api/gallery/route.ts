import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import {
  getUploadDir,
  getAlbumDir,
  sanitizeFolderName,
  resolvePhotoDiskPath,
} from '@/lib/storage';

export const dynamic = 'force-dynamic';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

function makeCaptionFromFilename(filename: string): string {
  const ext = path.extname(filename);
  return (
    path
      .basename(filename, ext)
      .replace(/^[0-9]+-[a-z0-9]+-/, '')
      .replace(/[_-]+/g, ' ')
      .trim() || filename
  );
}

/**
 * 갤러리 폴더(/app/data/uploads -> 호스트 /media/rudy/moim-gallery)를 앨범별 하위 폴더 구조로 정렬·동기화합니다.
 * 1) 모든 앨범에 대해 /media/rudy/moim-gallery/<앨범폴더명> 디렉토리 보장
 * 2) 루트에 흩어져 있던 기존 이미지들을 소속 앨범 폴더로 자동 이동(정렬) 및 URL 갱신
 * 3) 각 앨범 폴더(/media/rudy/moim-gallery/<앨범폴더명>/) 내 신규 이미지를 스캔하여 DB에 자동 등록
 */
async function syncLocalGalleryFolder() {
  try {
    const uploadDir = getUploadDir();
    if (!fs.existsSync(uploadDir)) return;

    const firstMember = await prisma.member.findFirst({
      orderBy: { joinedAt: 'asc' },
    });
    if (!firstMember) return;

    let albums = await prisma.album.findMany({
      include: { photos: true },
      orderBy: { createdAt: 'asc' },
    });

    if (albums.length === 0) {
      const created = await prisma.album.create({
        data: { title: '모임 기본 앨범' },
        include: { photos: true },
      });
      albums = [created];
    }

    // 1. 각 앨범별 폴더 생성 및 기존 DB 사진 중 루트에 있는 파일을 앨범 폴더로 이동
    const folderToAlbumMap = new Map<string, (typeof albums)[0]>();
    for (const album of albums) {
      const { folderName, fullPath: albumDirPath } = getAlbumDir(album.title);
      folderToAlbumMap.set(folderName, album);

      for (const photo of album.photos) {
        const expectedPrefix = `/api/uploads/${encodeURIComponent(folderName)}/`;
        if (!photo.url.startsWith(expectedPrefix)) {
          const fileName = path.basename(decodeURIComponent(photo.url));
          const oldRootPath = path.join(uploadDir, fileName);
          const newAlbumFilePath = path.join(albumDirPath, fileName);

          if (fs.existsSync(oldRootPath) && !fs.existsSync(newAlbumFilePath)) {
            try {
              fs.renameSync(oldRootPath, newAlbumFilePath);
            } catch {}
          }

          if (fs.existsSync(newAlbumFilePath)) {
            const newUrl = `/api/uploads/${encodeURIComponent(folderName)}/${encodeURIComponent(
              fileName
            )}`;
            await prisma.photo.update({
              where: { id: photo.id },
              data: { url: newUrl },
            });
          }
        }
      }
    }

    // 2. 루트(/media/rudy/moim-gallery)에 직접 놓인 미분류 이미지가 있으면 첫 번째 앨범 폴더로 이동
    const defaultAlbum = albums[0];
    const { folderName: defaultFolderName, fullPath: defaultAlbumDir } = getAlbumDir(
      defaultAlbum.title
    );

    const rootEntries = fs.readdirSync(uploadDir, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(ext)) continue;

        const srcPath = path.join(uploadDir, entry.name);
        const destPath = path.join(defaultAlbumDir, entry.name);
        try {
          if (!fs.existsSync(destPath)) {
            fs.renameSync(srcPath, destPath);
          }
        } catch {}
      }
    }

    // 3. 모든 하위 폴더(/media/rudy/moim-gallery/<앨범폴더명>)를 스캔하여 앨범 및 사진 동기화
    const allPhotos = await prisma.photo.findMany({ select: { url: true } });
    const registeredUrls = new Set(allPhotos.map((p) => decodeURIComponent(p.url)));

    const subEntries = fs.readdirSync(uploadDir, { withFileTypes: true });
    for (const dirEntry of subEntries) {
      if (!dirEntry.isDirectory()) continue;
      if (dirEntry.name.startsWith('.') || dirEntry.name === '_기타첨부') continue;

      const folderName = dirEntry.name;
      let targetAlbum = folderToAlbumMap.get(folderName);

      // 호스트에서 새 폴더를 직접 만든 경우 자동으로 앨범 생성
      if (!targetAlbum) {
        const createdAlbum = await prisma.album.create({
          data: { title: folderName.replace(/_/g, ' ') },
          include: { photos: true },
        });
        targetAlbum = createdAlbum;
        folderToAlbumMap.set(folderName, createdAlbum);
      }

      const albumDirPath = path.join(uploadDir, folderName);
      const files = fs.readdirSync(albumDirPath, { withFileTypes: true });
      for (const fileEntry of files) {
        if (!fileEntry.isFile()) continue;
        const ext = path.extname(fileEntry.name).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(ext)) continue;

        const decodedUrl = `/api/uploads/${folderName}/${fileEntry.name}`;
        if (registeredUrls.has(decodedUrl)) continue;

        const encodedUrl = `/api/uploads/${encodeURIComponent(
          folderName
        )}/${encodeURIComponent(fileEntry.name)}`;

        await prisma.photo.create({
          data: {
            url: encodedUrl,
            caption: makeCaptionFromFilename(fileEntry.name),
            albumId: targetAlbum.id,
            uploaderId: firstMember.id,
          },
        });
        registeredUrls.add(decodedUrl);
      }
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

    const albumsWithFolder = albums.map((a) => ({
      ...a,
      folderName: sanitizeFolderName(a.title),
    }));

    const events = await prisma.event.findMany({
      orderBy: { startAt: 'desc' },
    });

    return NextResponse.json({
      albums: albumsWithFolder,
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

      const trimmedTitle = String(title).trim();
      const album = await prisma.album.create({
        data: {
          title: trimmedTitle,
          eventId: eventId || null,
        },
      });

      // 앨범 생성 즉시 호스트 갤러리 경로에 해당 앨범 폴더 생성
      getAlbumDir(trimmedTitle);

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
        const diskPath = resolvePhotoDiskPath(photo.url);
        if (fs.existsSync(diskPath)) {
          try {
            fs.unlinkSync(diskPath);
          } catch {}
        }
      }
      await prisma.photo.delete({ where: { id: photoId } });
      return NextResponse.json({ ok: true });
    }

    if (albumId) {
      const album = await prisma.album.findUnique({
        where: { id: albumId },
        include: { photos: true },
      });
      if (album) {
        for (const p of album.photos) {
          const diskPath = resolvePhotoDiskPath(p.url);
          if (fs.existsSync(diskPath)) {
            try {
              fs.unlinkSync(diskPath);
            } catch {}
          }
        }
      }
      await prisma.album.delete({ where: { id: albumId } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '삭제 대상 ID가 필요합니다.' }, { status: 400 });
  } catch (error) {
    console.error('Gallery DELETE error:', error);
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
  }
}
