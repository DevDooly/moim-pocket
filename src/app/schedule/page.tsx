'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  List,
  Plus,
  MapPin,
  ExternalLink,
  Users,
  Calculator,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '@/components/AppContext';

export default function SchedulePage() {
  const { currentMember, isAdmin } = useApp();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 월간 캘린더 기준 연/월
  const [calDate, setCalDate] = useState(() => new Date());

  // 새 일정 등록 모달
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/schedule', { cache: 'no-store' });
      const data = await res.json();
      setEvents(data.events || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleRsvp = async (eventId: string, status: 'ATTEND' | 'ABSENT' | 'MAYBE') => {
    if (!currentMember) return;
    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rsvp',
        eventId,
        memberId: currentMember.id,
        status,
      }),
    });
    fetchSchedule();
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_event',
        title,
        startAt,
        endAt: endAt || null,
        location,
        description,
      }),
    });
    if (res.ok) {
      setShowCreateModal(false);
      setTitle('');
      setStartAt('');
      setEndAt('');
      setLocation('');
      setDescription('');
      fetchSchedule();
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' });
    fetchSchedule();
  };

  // 월간 캘린더 날짜 배열 계산
  const calYear = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const calendarCells: (number | null)[] = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const getEventsOnDay = (day: number) =>
    events.filter((ev) => {
      const d = new Date(ev.startAt);
      return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === day;
    });

  return (
    <div className="space-y-4">
      {/* 상단 세그먼트 탭: 일정표 vs 투표 */}
      <div className="flex bg-slate-200/80 p-1 rounded-2xl">
        <Link
          href="/schedule"
          className="flex-1 py-2 text-center text-xs font-extrabold rounded-xl bg-white text-slate-900 shadow-xs"
        >
          📅 모임 일정표 & 정산
        </Link>
        <Link
          href="/polls"
          className="flex-1 py-2 text-center text-xs font-extrabold rounded-xl text-slate-500 hover:text-slate-900"
        >
          🗳️ 실시간 투표
        </Link>
      </div>

      {/* 뷰 전환 (리스트 뷰 / 캘린더 뷰) + 일정 등록 버튼 */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>리스트 뷰</span>
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'calendar' ? 'bg-slate-900 text-white' : 'text-slate-500'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>월간 캘린더</span>
          </button>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-900 text-[#FEE500] text-xs font-extrabold shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>일정 등록</span>
        </button>
      </div>

      {/* 월간 캘린더 뷰 */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCalDate(new Date(calYear, calMonth - 1, 1))}
              className="p-1.5 rounded-xl hover:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="font-extrabold text-sm text-slate-900">
              {calYear}년 {calMonth + 1}월
            </h3>
            <button
              onClick={() => setCalDate(new Date(calYear, calMonth + 1, 1))}
              className="p-1.5 rounded-xl hover:bg-slate-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400">
            <div className="text-rose-500">일</div>
            <div>월</div>
            <div>화</div>
            <div>수</div>
            <div>목</div>
            <div>금</div>
            <div className="text-sky-600">토</div>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarCells.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="h-16 sm:h-24 lg:h-28 rounded-xl bg-slate-50/40" />;
              }
              const dayEvents = getEventsOnDay(day);
              return (
                <div
                  key={day}
                  className={`h-16 sm:h-24 lg:h-28 rounded-xl border p-1.5 sm:p-2 flex flex-col justify-between text-xs ${
                    dayEvents.length > 0
                      ? 'border-amber-300 bg-amber-50/60'
                      : 'border-slate-100 bg-white'
                  }`}
                >
                  <span className="font-bold text-slate-700 text-[11px] sm:text-xs">{day}</span>
                  <div className="space-y-1 overflow-hidden">
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="px-1.5 py-0.5 rounded bg-slate-900 text-[#FEE500] text-[9px] sm:text-[11px] font-bold truncate"
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 일정 상세 카드 리스트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {events.map((ev) => {
          const rsvps = ev.rsvps || [];
          const attendList = rsvps.filter((r: any) => r.status === 'ATTEND');
          const absentList = rsvps.filter((r: any) => r.status === 'ABSENT');
          const maybeList = rsvps.filter((r: any) => r.status === 'MAYBE');
          const myRsvp = rsvps.find((r: any) => r.memberId === currentMember?.id)?.status;

          // 모임 지출 연동: 이 일정에 태그된 출금 내역 총합 및 참석자 1인당 평균 사용액 계산
          const expenseTxs = (ev.transactions || []).filter((t: any) => t.type === 'EXPENSE');
          const totalEventExpense = expenseTxs.reduce(
            (sum: number, t: any) => sum + Number(t.amount || 0),
            0
          );
          const attendeeCount = Math.max(attendList.length, 1);
          const perPersonCost = Math.round(totalEventExpense / attendeeCount);

          const isMapLink =
            ev.location?.startsWith('http://') || ev.location?.startsWith('https://');

          return (
            <div
              key={ev.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px] mb-1">
                    {new Date(ev.startAt).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <h3 className="font-extrabold text-base text-slate-900">{ev.title}</h3>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteEvent(ev.id)}
                    className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                    title="일정 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {ev.description && (
                <p className="text-xs text-slate-600 leading-relaxed">{ev.description}</p>
              )}

              {ev.location && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  {isMapLink ? (
                    <a
                      href={ev.location}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-600 font-bold underline inline-flex items-center gap-1 truncate"
                    >
                      <span>{ev.location}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="font-medium">{ev.location}</span>
                  )}
                </div>
              )}

              {/* 참석 여부 (RSVP) 투표 버튼 */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleRsvp(ev.id, 'ATTEND')}
                    className={`py-2 rounded-xl text-xs font-extrabold border transition ${
                      myRsvp === 'ATTEND'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50'
                    }`}
                  >
                    🙋 참석 ({attendList.length})
                  </button>
                  <button
                    onClick={() => handleRsvp(ev.id, 'ABSENT')}
                    className={`py-2 rounded-xl text-xs font-extrabold border transition ${
                      myRsvp === 'ABSENT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-rose-50'
                    }`}
                  >
                    😢 불참 ({absentList.length})
                  </button>
                  <button
                    onClick={() => handleRsvp(ev.id, 'MAYBE')}
                    className={`py-2 rounded-xl text-xs font-extrabold border transition ${
                      myRsvp === 'MAYBE'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50'
                    }`}
                  >
                    🤔 미정 ({maybeList.length})
                  </button>
                </div>

                {/* 상태별 멤버 명단 표시 */}
                <div className="bg-slate-50 rounded-xl p-3 text-[11px] space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-emerald-700 shrink-0">참석:</span>
                    <span className="text-slate-700">
                      {attendList.length > 0
                        ? attendList.map((r: any) => r.member?.name).join(', ')
                        : '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-rose-600 shrink-0">불참:</span>
                    <span className="text-slate-700">
                      {absentList.length > 0
                        ? absentList.map((r: any) => r.member?.name).join(', ')
                        : '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-amber-600 shrink-0">미정:</span>
                    <span className="text-slate-700">
                      {maybeList.length > 0
                        ? maybeList.map((r: any) => r.member?.name).join(', ')
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 모임 지출 연동 요약 (이 모임 총 지출액 / 참석자 1인당 평균 사용액) */}
              <div className="rounded-xl bg-slate-900 text-white p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[#FEE500]" />
                  <div>
                    <div className="text-[10px] text-slate-300">이 모임 연동 총 지출액</div>
                    <div className="font-extrabold text-sm">
                      ₩{totalEventExpense.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-300">
                    참석자({attendList.length}명) 1인당 평균
                  </div>
                  <div className="font-extrabold text-sm text-[#FEE500]">
                    ₩{(attendList.length > 0 ? perPersonCost : 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && events.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-xs text-slate-400">
            등록된 모임 일정이 없습니다. 우측 상단 버튼으로 새 일정을 등록해보세요!
          </div>
        )}
      </div>

      {/* 일정 등록 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900">새 모임 일정 등록</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">일정 제목</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 2026 여름 가평 글램핑 여행"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">시작 일시</label>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">종료 일시 (선택)</label>
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  장소 또는 네이버/카카오 지도 링크
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="예: https://map.kakao.com/... 또는 강남역 11번 출구"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">상세 설명</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="준비물, 회비 지원 안내 등"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
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
