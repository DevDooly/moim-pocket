'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  CheckCircle2,
  Lock,
  Trash2,
  UserX,
  X,
  PlusCircle,
} from 'lucide-react';
import { useApp } from '@/components/AppContext';

export default function PollsPage() {
  const { currentMember, isAdmin } = useApp();
  const [polls, setPolls] = useState<any[]>([]);
  const [activeMembers, setActiveMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 항목 추가 입력창 상태
  const [newOptionInputs, setNewOptionInputs] = useState<Record<string, string>>({});

  // 새 투표 생성 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [allowAddOption, setAllowAddOption] = useState(true);
  const [options, setOptions] = useState<string[]>(['', '']);

  const fetchPolls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/polls', { cache: 'no-store' });
      const data = await res.json();
      setPolls(data.polls || []);
      setActiveMembers(data.activeMembers || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  const handleToggleOptionVote = async (poll: any, optionId: string) => {
    if (!currentMember || poll.isClosed) return;

    const myVotedOptionIds = poll.options
      .filter((opt: any) => opt.votes.some((v: any) => v.memberId === currentMember.id))
      .map((opt: any) => opt.id);

    let nextOptionIds: string[] = [];
    if (poll.allowMultiple) {
      if (myVotedOptionIds.includes(optionId)) {
        nextOptionIds = myVotedOptionIds.filter((id: string) => id !== optionId);
      } else {
        nextOptionIds = [...myVotedOptionIds, optionId];
      }
    } else {
      nextOptionIds = myVotedOptionIds.includes(optionId) ? [] : [optionId];
    }

    await fetch('/api/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'vote',
        pollId: poll.id,
        memberId: currentMember.id,
        optionIds: nextOptionIds,
      }),
    });

    fetchPolls();
  };

  const handleAddOption = async (pollId: string) => {
    const text = (newOptionInputs[pollId] || '').trim();
    if (!text) return;

    const res = await fetch('/api/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_option',
        pollId,
        text,
      }),
    });

    if (res.ok) {
      setNewOptionInputs((prev) => ({ ...prev, [pollId]: '' }));
      fetchPolls();
    }
  };

  const handleClosePoll = async (pollId: string) => {
    if (!confirm('이 투표를 마감하시겠습니까?')) return;
    await fetch('/api/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close_poll', pollId }),
    });
    fetchPolls();
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!confirm('이 투표를 삭제하시겠습니까?')) return;
    await fetch(`/api/polls?id=${pollId}`, { method: 'DELETE' });
    fetchPolls();
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      alert('최소 2개 이상의 선택지를 입력해주세요.');
      return;
    }

    const res = await fetch('/api/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_poll',
        title,
        closesAt: closesAt || null,
        allowMultiple,
        allowAddOption,
        options: validOptions,
      }),
    });

    if (res.ok) {
      setShowCreateModal(false);
      setTitle('');
      setClosesAt('');
      setAllowMultiple(false);
      setAllowAddOption(true);
      setOptions(['', '']);
      fetchPolls();
    }
  };

  return (
    <div className="space-y-4">
      {/* 상단 세그먼트 탭: 일정표 vs 투표 */}
      <div className="flex bg-slate-200/80 p-1 rounded-2xl">
        <Link
          href="/schedule"
          className="flex-1 py-2 text-center text-xs font-extrabold rounded-xl text-slate-500 hover:text-slate-900"
        >
          📅 모임 일정표 & 정산
        </Link>
        <Link
          href="/polls"
          className="flex-1 py-2 text-center text-xs font-extrabold rounded-xl bg-white text-slate-900 shadow-xs"
        >
          🗳️ 실시간 투표
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-sm text-slate-900">모임 의사결정 투표</h2>
          <p className="text-[11px] text-slate-400">
            항목을 터치해 투표하고 미투표 멤버를 한눈에 확인하세요
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-900 text-[#FEE500] text-xs font-extrabold shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>새 투표 만들기</span>
        </button>
      </div>

      {/* 투표 카드 리스트 */}
      <div className="space-y-4">
        {polls.map((poll) => {
          const totalVotes = poll.options.reduce(
            (sum: number, opt: any) => sum + opt.votes.length,
            0
          );

          const votedMemberIds = new Set<string>();
          poll.options.forEach((opt: any) => {
            opt.votes.forEach((v: any) => votedMemberIds.add(v.memberId));
          });

          const nonVoters = activeMembers.filter((m) => !votedMemberIds.has(m.id));

          return (
            <div
              key={poll.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        poll.isClosed
                          ? 'bg-slate-200 text-slate-600'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {poll.isClosed ? '마감됨' : '진행중'}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {poll.allowMultiple ? '복수 선택 가능' : '단일 선택'}
                    </span>
                    {poll.closesAt && (
                      <span className="text-[10px] text-slate-400">
                        마감: {new Date(poll.closesAt).toLocaleDateString('ko-KR')}
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-base text-slate-900">{poll.title}</h3>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1">
                    {!poll.isClosed && (
                      <button
                        onClick={() => handleClosePoll(poll.id)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold"
                      >
                        투표 마감
                      </button>
                    )}
                    <button
                      onClick={() => handleDeletePoll(poll.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* 선택지 & 실시간 퍼센트 바 차트 */}
              <div className="space-y-2">
                {poll.options.map((opt: any) => {
                  const count = opt.votes.length;
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  const isMyChoice = opt.votes.some(
                    (v: any) => v.memberId === currentMember?.id
                  );
                  const voterNames = opt.votes
                    .map((v: any) => v.member?.name)
                    .filter(Boolean);

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={poll.isClosed}
                      onClick={() => handleToggleOptionVote(poll, opt.id)}
                      className={`w-full text-left rounded-2xl p-3 border relative overflow-hidden transition ${
                        isMyChoice
                          ? 'border-slate-900 bg-amber-50/40'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-[#FEE500]/35 transition-all pointer-events-none"
                        style={{ width: `${pct}%` }}
                      />

                      <div className="relative flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${
                              isMyChoice ? 'text-slate-900 fill-[#FEE500]' : 'text-slate-300'
                            }`}
                          />
                          <span className="font-bold text-xs text-slate-900">{opt.text}</span>
                        </div>
                        <span className="text-xs font-extrabold text-slate-900 shrink-0">
                          {count}표 ({pct}%)
                        </span>
                      </div>

                      {voterNames.length > 0 && (
                        <p className="relative text-[11px] text-slate-500 mt-1 pl-6">
                          투표자: {voterNames.join(', ')}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 멤버의 선택지 추가 허용 시 입력창 */}
              {!poll.isClosed && poll.allowAddOption && (
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    value={newOptionInputs[poll.id] || ''}
                    onChange={(e) =>
                      setNewOptionInputs((prev) => ({
                        ...prev,
                        [poll.id]: e.target.value,
                      }))
                    }
                    placeholder="새로운 투표 선택지 직접 추가..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddOption(poll.id)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shrink-0"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>항목 추가</span>
                  </button>
                </div>
              )}

              {/* 미투표자 명단 표시 (독촉용) */}
              <div className="rounded-xl bg-rose-50/70 border border-rose-100 px-3 py-2 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-rose-800">
                  <UserX className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="font-extrabold shrink-0">
                    미투표 멤버 ({nonVoters.length}명):
                  </span>
                  <span className="font-medium">
                    {nonVoters.length > 0
                      ? nonVoters.map((m) => m.name).join(', ')
                      : '전원 투표 완료! 🎉'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && polls.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-xs text-slate-400">
            생성된 투표가 없습니다.
          </div>
        )}
      </div>

      {/* 새 투표 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900">새 투표 만들기</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreatePoll} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">투표 질문 제목</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 연말 모임 날짜 언제가 좋을까요?"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">마감 일시 (선택)</label>
                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-slate-600">선택지 목록</label>
                {options.map((opt, idx) => (
                  <div key={idx} className="flex gap-1.5">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const copy = [...options];
                        copy[idx] = e.target.value;
                        setOptions(copy);
                      }}
                      placeholder={`선택지 ${idx + 1}`}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200"
                      required={idx < 2}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                        className="px-2.5 rounded-xl bg-slate-100 text-slate-500"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setOptions([...options, ''])}
                  className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-slate-600 font-bold"
                >
                  + 선택지 칸 추가
                </button>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowMultiple}
                    onChange={(e) => setAllowMultiple(e.target.checked)}
                    className="rounded text-slate-900"
                  />
                  <span className="font-semibold text-slate-700">복수 선택 허용</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowAddOption}
                    onChange={(e) => setAllowAddOption(e.target.checked)}
                    className="rounded text-slate-900"
                  />
                  <span className="font-semibold text-slate-700">
                    일반 멤버의 선택지 직접 추가 허용
                  </span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 text-[#FEE500] font-extrabold"
                >
                  투표 시작하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
