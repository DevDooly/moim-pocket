'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Edit3,
  Plus,
  Heart,
  MessageCircle,
  Pin,
  Trash2,
  Upload,
  X,
  Settings,
} from 'lucide-react';
import { useApp } from '@/components/AppContext';

export default function BoardPage() {
  const { currentMember, isAdmin, refreshBootstrap } = useApp();
  const [rulesMarkdown, setRulesMarkdown] = useState('');
  const [editingRules, setEditingRules] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 댓글 입력창 상태
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // 글쓰기 모달
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postIsNotice, setPostIsNotice] = useState(false);
  const [postImageUrl, setPostImageUrl] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/board', { cache: 'no-store' });
      const data = await res.json();
      setRulesMarkdown(data.setting?.rulesMarkdown || '');
      setPosts(data.posts || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const handleSaveRules = async () => {
    const res = await fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_rules',
        rulesMarkdown,
      }),
    });
    if (res.ok) {
      setEditingRules(false);
      await refreshBootstrap();
      await fetchBoard();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) setPostImageUrl(data.url);
    } finally {
      setUploadingImg(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember) return;

    const res = await fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_post',
        title: postTitle,
        content: postContent,
        isNotice: isAdmin ? postIsNotice : false,
        imageUrl: postImageUrl || null,
        authorId: currentMember.id,
      }),
    });

    if (res.ok) {
      setShowWriteModal(false);
      setPostTitle('');
      setPostContent('');
      setPostIsNotice(false);
      setPostImageUrl('');
      fetchBoard();
    }
  };

  const handleAddComment = async (postId: string) => {
    const content = (commentInputs[postId] || '').trim();
    if (!content || !currentMember) return;

    const res = await fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_comment',
        postId,
        content,
        authorId: currentMember.id,
      }),
    });

    if (res.ok) {
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      fetchBoard();
    }
  };

  const handleLikePost = async (postId: string) => {
    await fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'like_post', postId }),
    });
    fetchBoard();
  };

  const handleToggleNotice = async (post: any) => {
    if (!isAdmin) return;
    await fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toggle_notice',
        postId: post.id,
        isNotice: !post.isNotice,
      }),
    });
    fetchBoard();
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('이 게시글을 삭제하시겠습니까?')) return;
    await fetch(`/api/board?postId=${postId}`, { method: 'DELETE' });
    fetchBoard();
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
    await fetch(`/api/board?commentId=${commentId}`, { method: 'DELETE' });
    fetchBoard();
  };

  return (
    <div className="space-y-4">
      {/* 상단 세그먼트 탭: 회칙/게시판 vs 설정/백업 */}
      <div className="flex bg-slate-200/80 p-1 rounded-2xl">
        <Link
          href="/board"
          className="flex-1 py-2 text-center text-xs font-extrabold rounded-xl bg-white text-slate-900 shadow-xs"
        >
          📌 모임 회칙 & 자유게시판
        </Link>
        <Link
          href="/settings"
          className="flex-1 py-2 text-center text-xs font-extrabold rounded-xl text-slate-500 hover:text-slate-900 inline-flex items-center justify-center gap-1"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>설정 & 데이터 백업</span>
        </Link>
      </div>

      {/* 상단 고정 모임 회칙 영역 */}
      <section className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-amber-950 font-extrabold text-sm">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span>고정 모임 회칙 안내</span>
          </div>
          {isAdmin && !editingRules && (
            <button
              onClick={() => setEditingRules(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-bold"
            >
              <Edit3 className="w-3 h-3" />
              <span>회칙 편집</span>
            </button>
          )}
        </div>

        {editingRules ? (
          <div className="space-y-2">
            <textarea
              rows={6}
              value={rulesMarkdown}
              onChange={(e) => setRulesMarkdown(e.target.value)}
              className="w-full p-3 rounded-xl bg-white border border-amber-300 text-xs leading-relaxed focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingRules(false)}
                className="px-3 py-1.5 rounded-xl bg-white text-slate-600 text-xs font-bold"
              >
                취소
              </button>
              <button
                onClick={handleSaveRules}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-[#FEE500] text-xs font-extrabold"
              >
                회칙 저장
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed bg-white/80 rounded-xl p-3 border border-amber-100">
            {rulesMarkdown || '등록된 모임 회칙이 없습니다.'}
          </div>
        )}
      </section>

      {/* 자유 게시판 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-sm text-slate-900">공지 & 자유 게시판</h2>
          <p className="text-[11px] text-slate-400">모임 소식과 이야기를 자유롭게 남겨보세요</p>
        </div>
        <button
          onClick={() => setShowWriteModal(true)}
          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-900 text-[#FEE500] text-xs font-extrabold shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>글쓰기</span>
        </button>
      </div>

      {/* 게시글 목록 */}
      <div className="space-y-3">
        {posts.map((post) => (
          <article
            key={post.id}
            className={`bg-white rounded-2xl border p-4 shadow-xs space-y-3 ${
              post.isNotice ? 'border-slate-900/30 bg-slate-50/40' : 'border-slate-200/80'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  {post.isNotice && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 text-[#FEE500] text-[10px] font-extrabold">
                      공지
                    </span>
                  )}
                  <span className="text-xs font-bold text-slate-700">
                    {post.author?.name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    · {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <h3 className="font-extrabold text-sm text-slate-900">{post.title}</h3>
              </div>

              <div className="flex items-center gap-1">
                {isAdmin && (
                  <button
                    onClick={() => handleToggleNotice(post)}
                    className={`p-1.5 rounded-lg ${
                      post.isNotice
                        ? 'bg-amber-100 text-amber-800'
                        : 'hover:bg-slate-100 text-slate-400'
                    }`}
                    title="공지 상단 고정 전환"
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                )}
                {(isAdmin || post.authorId === currentMember?.id) && (
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                    title="게시글 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
              {post.content}
            </p>

            {post.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="max-h-72 w-auto mx-auto object-contain"
                />
              </div>
            )}

            {/* 좋아요 & 댓글 수 */}
            <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
              <button
                onClick={() => handleLikePost(post.id)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition"
              >
                <Heart className="w-3.5 h-3.5 fill-rose-500" />
                <span>좋아요 {post.likes || 0}</span>
              </button>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-semibold">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>댓글 {post.comments?.length || 0}</span>
              </span>
            </div>

            {/* 댓글 목록 및 입력 */}
            <div className="bg-slate-50 rounded-xl p-3 space-y-2">
              {(post.comments || []).map((c: any) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-2 text-xs border-b border-slate-200/60 last:border-none pb-1.5 last:pb-0"
                >
                  <div>
                    <span className="font-bold text-slate-900 mr-1.5">
                      {c.author?.name}:
                    </span>
                    <span className="text-slate-700">{c.content}</span>
                  </div>
                  {(isAdmin || c.authorId === currentMember?.id) && (
                    <button
                      onClick={() => handleDeleteComment(c.id)}
                      className="text-slate-400 hover:text-rose-600 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              <div className="flex gap-1.5 pt-1">
                <input
                  type="text"
                  value={commentInputs[post.id] || ''}
                  onChange={(e) =>
                    setCommentInputs((prev) => ({
                      ...prev,
                      [post.id]: e.target.value,
                    }))
                  }
                  placeholder="따뜻한 댓글을 남겨보세요..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleAddComment(post.id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold shrink-0"
                >
                  등록
                </button>
              </div>
            </div>
          </article>
        ))}

        {!loading && posts.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-xs text-slate-400">
            작성된 게시글이 없습니다.
          </div>
        )}
      </div>

      {/* 글쓰기 모달 */}
      {showWriteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900">게시글 작성</h3>
              <button
                onClick={() => setShowWriteModal(false)}
                className="p-1 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">제목</label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="게시글 제목을 입력하세요"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">내용</label>
                <textarea
                  rows={4}
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="자유롭게 내용을 작성하세요"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingImg ? '업로드 중...' : '사진 첨부 (선택)'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                {postImageUrl && (
                  <span className="text-emerald-600 font-bold">이미지 첨부됨 ✓</span>
                )}
              </div>

              {isAdmin && (
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={postIsNotice}
                    onChange={(e) => setPostIsNotice(e.target.checked)}
                    className="rounded text-slate-900"
                  />
                  <span className="font-bold text-slate-800">공지사항으로 상단 고정</span>
                </label>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWriteModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 text-[#FEE500] font-extrabold"
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
