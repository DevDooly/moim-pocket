'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  FolderPlus,
  Upload,
  Download,
  Archive,
  Trash2,
  X,
  Image as ImageIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '@/components/AppContext';

export default function GalleryPage() {
  const { currentMember, isAdmin } = useApp();
  const [albums, setAlbums] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 앨범 생성 모달
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumEventId, setAlbumEventId] = useState('');

  // 사진 업로드 상태 (리사이징 vs 원본 옵션 포함)
  const [resizeOption, setResizeOption] = useState<'RESIZE' | 'ORIGINAL'>('RESIZE');
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // 라이트박스 뷰어 상태
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gallery', { cache: 'no-store' });
      const data = await res.json();
      const list = data.albums || [];
      setAlbums(list);
      setEvents(data.events || []);
      if (list.length > 0 && !selectedAlbumId) {
        setSelectedAlbumId(list[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedAlbumId]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const currentAlbum = albums.find((a) => a.id === selectedAlbumId) || albums[0] || null;

  // 이미지 리사이즈 헬퍼 (용량 절감용)
  const compressImageIfNeeded = async (file: File): Promise<File> => {
    if (resizeOption === 'ORIGINAL' || !file.type.startsWith('image/')) {
      return file;
    }

    return new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX_DIM = 1600;
        let { width, height } = img;
        if (width <= MAX_DIM && height <= MAX_DIM) {
          resolve(file);
          return;
        }
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => resolve(file);
      img.src = url;
    });
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_album',
        title: albumTitle,
        eventId: albumEventId || null,
      }),
    });
    const data = await res.json();
    if (res.ok && data.album) {
      setShowAlbumModal(false);
      setAlbumTitle('');
      setAlbumEventId('');
      setSelectedAlbumId(data.album.id);
      await fetchGallery();
    }
  };

  const handleMultipleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !currentAlbum || !currentMember) return;

    setUploadingPhotos(true);
    try {
      const formData = new FormData();
      for (const rawFile of Array.from(fileList)) {
        const processed = await compressImageIfNeeded(rawFile);
        formData.append('files', processed);
      }

      const upRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const upData = await upRes.json();

      if (upRes.ok && Array.isArray(upData.urls)) {
        await fetch('/api/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_photos',
            albumId: currentAlbum.id,
            uploaderId: currentMember.id,
            urls: upData.urls,
            caption: photoCaption.trim() || null,
          }),
        });
        setPhotoCaption('');
        await fetchGallery();
      }
    } finally {
      setUploadingPhotos(false);
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('이 사진을 삭제하시겠습니까?')) return;
    await fetch(`/api/gallery?photoId=${photoId}`, { method: 'DELETE' });
    setLightboxIndex(null);
    await fetchGallery();
  };

  const handleDeleteAlbum = async (albumId: string) => {
    if (!confirm('이 앨범과 포함된 모든 사진을 삭제하시겠습니까?')) return;
    await fetch(`/api/gallery?albumId=${albumId}`, { method: 'DELETE' });
    setSelectedAlbumId(null);
    await fetchGallery();
  };

  const photos = currentAlbum?.photos || [];

  return (
    <div className="space-y-4">
      {/* 상단 헤더 & 앨범 생성 버튼 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-sm text-slate-900">모임 추억 사진 갤러리</h2>
          <p className="text-[11px] text-slate-400">
            앨범별로 사진을 모아보고 ZIP으로 한 번에 내려받으세요
          </p>
        </div>
        <button
          onClick={() => setShowAlbumModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-[#FEE500] text-xs font-extrabold shadow-xs"
        >
          <FolderPlus className="w-4 h-4" />
          <span>새 앨범 생성</span>
        </button>
      </div>

      {/* 앨범 폴더 가로 스크롤 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {albums.map((album) => {
          const active = currentAlbum?.id === album.id;
          return (
            <button
              key={album.id}
              onClick={() => setSelectedAlbumId(album.id)}
              className={`px-3.5 py-2.5 rounded-2xl text-left shrink-0 border transition ${
                active
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
              }`}
            >
              <div className="font-extrabold text-xs">{album.title}</div>
              <div
                className={`text-[10px] mt-0.5 ${
                  active ? 'text-[#FEE500]' : 'text-slate-400'
                }`}
              >
                사진 {album.photos?.length || 0}장
              </div>
            </button>
          );
        })}
      </div>

      {/* 선택된 앨범 상세 및 업로드 바 */}
      {currentAlbum ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">{currentAlbum.title}</h3>
              {currentAlbum.event && (
                <p className="text-xs text-indigo-600 font-semibold mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>연결된 일정: {currentAlbum.event.title}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {photos.length > 0 && (
                <a
                  href={`/api/gallery/zip?albumId=${currentAlbum.id}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>앨범 ZIP 다운로드</span>
                </a>
              )}
              {isAdmin && (
                <button
                  onClick={() => handleDeleteAlbum(currentAlbum.id)}
                  className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                  title="앨범 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 다중 이미지 업로드 컨트롤 */}
          <div className="bg-slate-50 rounded-2xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700">사진 다중 업로드</span>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setResizeOption('RESIZE')}
                  className={`px-2 py-0.5 rounded-md font-bold ${
                    resizeOption === 'RESIZE'
                      ? 'bg-slate-900 text-[#FEE500]'
                      : 'bg-white text-slate-500 border border-slate-200'
                  }`}
                >
                  권장 해상도 자동 최적화
                </button>
                <button
                  type="button"
                  onClick={() => setResizeOption('ORIGINAL')}
                  className={`px-2 py-0.5 rounded-md font-bold ${
                    resizeOption === 'ORIGINAL'
                      ? 'bg-slate-900 text-[#FEE500]'
                      : 'bg-white text-slate-500 border border-slate-200'
                  }`}
                >
                  원본 화질 저장
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                placeholder="사진 한 줄 설명 (선택)"
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs"
              />
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FEE500] hover:bg-yellow-300 text-slate-900 font-extrabold text-xs cursor-pointer shrink-0 shadow-xs">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingPhotos ? '업로드 중...' : '사진 선택 (다중)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMultipleUpload}
                  className="hidden"
                  disabled={uploadingPhotos}
                />
              </label>
            </div>
          </div>

          {/* 사진 그리드 */}
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo: any, idx: number) => (
                <div
                  key={photo.id}
                  onClick={() => setLightboxIndex(idx)}
                  className="aspect-square rounded-2xl overflow-hidden bg-slate-100 relative group cursor-pointer border border-slate-200/60"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || '모임 사진'}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2 text-white opacity-0 group-hover:opacity-100 transition">
                    <p className="text-[10px] font-bold truncate">
                      {photo.caption || photo.uploader?.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <ImageIcon className="w-8 h-8 mx-auto stroke-[1.5px]" />
              <p className="text-xs">아직 이 앨범에 등록된 사진이 없습니다.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center text-xs text-slate-400">
          앨범을 먼저 생성해주세요.
        </div>
      )}

      {/* 라이트박스 전체화면 뷰어 */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-between p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="flex items-center justify-between text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-sm font-bold">
                {photos[lightboxIndex].caption || currentAlbum.title}
              </p>
              <p className="text-xs text-slate-400">
                업로더: {photos[lightboxIndex].uploader?.name} ·{' '}
                {new Date(photos[lightboxIndex].createdAt).toLocaleDateString('ko-KR')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={photos[lightboxIndex].url}
                download
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>개별 저장</span>
              </a>
              {(isAdmin || photos[lightboxIndex].uploaderId === currentMember?.id) && (
                <button
                  onClick={() => handleDeletePhoto(photos[lightboxIndex].id)}
                  className="p-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setLightboxIndex(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 flex items-center justify-center relative my-4"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxIndex > 0 && (
              <button
                onClick={() => setLightboxIndex(lightboxIndex - 1)}
                className="absolute left-2 p-2 rounded-full bg-white/15 hover:bg-white/30 text-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <img
              src={photos[lightboxIndex].url}
              alt="전체화면 사진"
              className="max-h-[75vh] max-w-full object-contain rounded-xl"
            />
            {lightboxIndex < photos.length - 1 && (
              <button
                onClick={() => setLightboxIndex(lightboxIndex + 1)}
                className="absolute right-2 p-2 rounded-full bg-white/15 hover:bg-white/30 text-white"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          <div className="text-center text-xs text-slate-400">
            {lightboxIndex + 1} / {photos.length}
          </div>
        </div>
      )}

      {/* 새 앨범 생성 모달 */}
      {showAlbumModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900">새 사진 앨범 만들기</h3>
              <button
                onClick={() => setShowAlbumModal(false)}
                className="p-1 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateAlbum} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">앨범 이름</label>
                <input
                  type="text"
                  value={albumTitle}
                  onChange={(e) => setAlbumTitle(e.target.value)}
                  placeholder="예: 2026 여름 가평 여행"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  모임 일정과 연결 (선택)
                </label>
                <select
                  value={albumEventId}
                  onChange={(e) => setAlbumEventId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="">연결 안함</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAlbumModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 text-[#FEE500] font-extrabold"
                >
                  생성하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
