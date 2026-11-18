'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Vote,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { useApp } from '@/components/AppContext';

export default function HomePage() {
  const { currentMember, setting } = useApp();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bootstrap', { cache: 'no-store' });
      const data = await res.json();
      if (data.summary) setSummary(data.summary);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyAccount = async () => {
    const accountText = setting.bankAccount || '계좌번호 미등록';
    try {
      await navigator.clipboard.writeText(accountText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(`계좌번호: ${accountText}`);
    }
  };

  if (loading || !summary) {
    return (
      <div className="space-y-4">
        <div className="h-48 rounded-3xl bg-slate-200 animate-pulse" />
        <div className="h-20 rounded-2xl bg-slate-200 animate-pulse" />
        <div className="h-36 rounded-2xl bg-slate-200 animate-pulse" />
      </div>
    );
  }

  const myDues = summary.currentMonthDues?.find(
    (d: any) => d.memberId === currentMember?.id
  );
  const isMyDuesPaid = myDues?.status === 'PAID';
  const isMyDuesExempt = myDues?.status === 'EXEMPT';

  const getDdayText = (dateStr: string) => {
    const target = new Date(dateStr);
    const today = new Date();
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const t1 = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    const diff = Math.round((t1 - t0) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'D-Day';
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  };

  return (
    <div className="space-y-4">
      {/* ① 통장 현황 카드 (카카오뱅크 모임통장 스타일) */}
      <section className="rounded-3xl bg-slate-900 text-white p-5 shadow-lg relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-[#FEE500]/10 blur-xl pointer-events-none" />

        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#FEE500] text-slate-900 text-[11px] font-extrabold">
              모임통장 잔액
            </span>
            <p className="text-xs text-slate-300 mt-1.5">
              {setting.bankAccount || '설정에서 계좌번호를 등록해주세요'}
            </p>
          </div>
          <button
            onClick={handleCopyAccount}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#FEE500]" />
                <span className="text-[#FEE500]">복사완료!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>계좌번호 복사</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-4 mb-5">
          <div className="text-3xl font-black tracking-tight text-white">
            ₩{Number(summary.totalBalance || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            기본 월 회비: ₩{Number(setting.monthlyFee || 0).toLocaleString()} / 월
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-3.5 border-t border-white/10">
          <div className="rounded-2xl bg-white/5 p-3">
            <div className="flex items-center gap-1 text-xs text-sky-300 font-semibold">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>{summary.currentMonth}월 총 입금액</span>
            </div>
            <p className="mt-1 text-base font-extrabold text-sky-400">
              +₩{Number(summary.monthlyIncome || 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl bg-white/5 p-3">
            <div className="flex items-center gap-1 text-xs text-rose-300 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{summary.currentMonth}월 총 지출액</span>
            </div>
            <p className="mt-1 text-base font-extrabold text-rose-400">
              -₩{Number(summary.monthlyExpense || 0).toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      {/* ② 내 회비 상태 배너 */}
      <Link
        href="/ledger"
        className={`flex items-center justify-between p-4 rounded-2xl border transition shadow-xs ${
          isMyDuesPaid
            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
            : isMyDuesExempt
            ? 'bg-slate-100 border-slate-200 text-slate-700'
            : 'bg-rose-50/90 border-rose-200 text-rose-950'
        }`}
      >
        <div className="flex items-center gap-3">
          {isMyDuesPaid ? (
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="text-xs font-semibold opacity-75">
              {summary.currentYear}년 {summary.currentMonth}월 내 회비 상태
            </div>
            <div className="text-sm font-extrabold mt-0.5">
              {currentMember?.name}님, 당월 회비{' '}
              {isMyDuesPaid ? (
                <span className="text-emerald-700 underline">완납 완료</span>
              ) : isMyDuesExempt ? (
                <span className="text-slate-600">면제/해당없음</span>
              ) : (
                <span className="text-rose-600 underline">미납 상태</span>
              )}
              입니다
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 opacity-50" />
      </Link>

      {/* ③ 하이라이트 위젯 (다가오는 일정 D-Day & 진행 중인 투표) */}
      <div className="grid grid-cols-1 gap-3">
        {/* 다가오는 일정 1건 */}
        <Link
          href="/schedule"
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-400 transition block"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <Calendar className="w-4 h-4 text-slate-900" />
              다가오는 모임 일정
            </span>
            {summary.upcomingEvent && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#FEE500] text-slate-900 font-black text-xs">
                {getDdayText(summary.upcomingEvent.startAt)}
              </span>
            )}
          </div>

          {summary.upcomingEvent ? (
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                {summary.upcomingEvent.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                일시: {new Date(summary.upcomingEvent.startAt).toLocaleString('ko-KR', {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {summary.upcomingEvent.location && (
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{summary.upcomingEvent.location}</span>
                </p>
              )}
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-emerald-700 font-bold">
                  참석 확정:{' '}
                  {
                    (summary.upcomingEvent.rsvps || []).filter(
                      (r: any) => r.status === 'ATTEND'
                    ).length
                  }
                  명
                </span>
                <span className="text-slate-400 font-medium">참석 여부 투표하기 →</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-2">예정된 다가오는 일정이 없습니다.</p>
          )}
        </Link>

        {/* 진행 중인 투표 배너 */}
        {summary.activePolls && summary.activePolls.length > 0 && (
          <Link
            href="/polls"
            className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200/80 shadow-xs hover:border-amber-400 transition block"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
                <Vote className="w-4 h-4 text-amber-600" />
                현재 진행 중인 투표 ({summary.activePolls.length}건)
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                참여 가능
              </span>
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              {summary.activePolls[0].title}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              터치하여 실시간 투표 현황 확인 및 투표하기 →
            </p>
          </Link>
        )}
      </div>

      {/* ④ 최신 공지사항 1건 */}
      {summary.latestNotice && (
        <Link
          href="/board"
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition block"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
              <Megaphone className="w-4 h-4 text-rose-500" />
              최신 공지사항
            </span>
            <span className="text-[11px] text-slate-400">게시판 더보기 →</span>
          </div>
          <h4 className="font-bold text-sm text-slate-900">{summary.latestNotice.title}</h4>
          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
            {summary.latestNotice.content}
          </p>
        </Link>
      )}

      {/* ⑤ 최근 입출금 내역 3건 */}
      <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-extrabold text-slate-900 text-sm">최근 입출금 내역</h3>
          <Link href="/ledger" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
            전체 장부 보기 →
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {(summary.recentTransactions || []).map((tx: any) => {
            const isIncome = tx.type === 'INCOME';
            return (
              <div key={tx.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isIncome
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {tx.category}
                    </span>
                    <p className="font-bold text-slate-900 text-xs truncate">
                      {tx.description}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(tx.date).toLocaleDateString('ko-KR')}
                    {tx.member ? ` · ${tx.member.name}` : ''}
                  </p>
                </div>
                <div
                  className={`font-extrabold text-sm shrink-0 ${
                    isIncome ? 'text-sky-600' : 'text-rose-600'
                  }`}
                >
                  {isIncome ? '+' : '-'}₩{Number(tx.amount).toLocaleString()}
                </div>
              </div>
            );
          })}
          {(!summary.recentTransactions || summary.recentTransactions.length === 0) && (
            <p className="text-xs text-slate-400 py-4 text-center">
              등록된 입출금 내역이 없습니다.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
