'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Wallet,
  CalendarCheck,
  Image as ImageIcon,
  MessageSquareText,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Lock,
  LogOut,
  Sparkles,
  ChevronRight,
  Settings,
  X,
  Vote,
} from 'lucide-react';
import { useApp } from './AppContext';

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    isHydrated,
    isGroupVerified,
    currentMember,
    isAdmin,
    setting,
    members,
    verifyGroupPin,
    selectMember,
    logoutMember,
    logoutAll,
    verifyAdminPin,
    disableAdmin,
  } = useApp();

  const pathname = usePathname();
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState('');

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-full max-w-md p-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEE500] text-slate-900 font-bold animate-pulse">
            ₩
          </div>
          <p className="mt-3 text-sm font-medium text-slate-500">모임포켓 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 1단계: 게이트 화면 (최초 접속 - GROUP_PIN 입력)
  if (!isGroupVerified) {
    const handleGateSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setPinError('');
      setIsSubmitting(true);
      const res = await verifyGroupPin(pinInput);
      setIsSubmitting(false);
      if (!res.ok) {
        setPinError(res.message || '입장 코드가 일치하지 않습니다.');
      } else {
        setPinInput('');
      }
    };

    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-900 px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
          <div className="bg-[#FEE500] px-6 py-8 text-slate-900 text-center relative">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-900 text-[#FEE500] flex items-center justify-center shadow-md mb-3">
              <Lock className="w-7 h-7" />
            </div>
            <span className="inline-block px-3 py-1 rounded-full bg-slate-900/10 text-xs font-semibold tracking-wide mb-1">
              모임통장 & 커뮤니티 대시보드
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">{setting.groupName}</h1>
            <p className="text-xs text-slate-700 mt-1">
              공유받은 모임 입장 코드(PIN)를 입력해 입장하세요
            </p>
          </div>

          <form onSubmit={handleGateSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                모임 입장 코드 (GROUP_PIN)
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="입장 코드 4자리 입력 (기본: 1234)"
                className="w-full px-4 py-3.5 text-center text-lg font-bold tracking-widest rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                autoFocus
                required
              />
              {pinError && (
                <p className="mt-2 text-xs font-medium text-rose-600 text-center">{pinError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-[#FEE500] font-bold text-sm shadow-lg transition flex items-center justify-center gap-2"
            >
              <span>{isSubmitting ? '확인 중...' : '모임 대시보드 입장하기'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="pt-2 text-center">
              <p className="text-[11px] text-slate-400">
                초기 데모 입장 코드: <span className="font-semibold text-slate-600">1234</span> / 총무 코드:{' '}
                <span className="font-semibold text-slate-600">9999</span>
              </p>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 2단계: 프로필 선택 화면 (로그인 대체)
  const activeMembers = members.filter((m) => m.isActive);
  if (!currentMember) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          <div className="bg-slate-900 px-6 py-8 text-white text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[#FEE500] text-slate-900 flex items-center justify-center font-extrabold text-xl mb-3">
              👋
            </div>
            <h1 className="text-xl font-bold">{setting.groupName}</h1>
            <p className="text-xs text-slate-300 mt-1">
              본인 이름을 선택하면 바로 모임 대시보드로 접속됩니다
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
              {activeMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => selectMember(member)}
                  className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-slate-900 hover:bg-amber-50/50 transition text-left group"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <span>{member.name}</span>
                      {member.role === 'ADMIN' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#FEE500] text-slate-900 font-extrabold">
                          총무
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">클릭하여 시작</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-900 transition" />
                </button>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>명단에 이름이 없다면 총무에게 요청하세요</span>
              <button
                onClick={logoutAll}
                className="text-slate-500 hover:text-rose-600 font-medium underline"
              >
                잠금화면으로
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPinError('');
    const res = await verifyAdminPin(adminPinInput);
    if (!res.ok) {
      setAdminPinError(res.message || '총무 코드가 올바르지 않습니다.');
    } else {
      setAdminPinInput('');
      setShowAdminModal(false);
    }
  };

  // 모바일 하단 5탭 메뉴
  const mobileNavItems = [
    {
      href: '/',
      label: '홈',
      icon: Home,
      active: pathname === '/',
    },
    {
      href: '/ledger',
      label: '장부/회비',
      icon: Wallet,
      active: pathname.startsWith('/ledger'),
    },
    {
      href: '/schedule',
      label: '일정/투표',
      icon: CalendarCheck,
      active: pathname.startsWith('/schedule') || pathname.startsWith('/polls'),
    },
    {
      href: '/gallery',
      label: '갤러리',
      icon: ImageIcon,
      active: pathname.startsWith('/gallery'),
    },
    {
      href: '/board',
      label: '게시판/더보기',
      icon: MessageSquareText,
      active: pathname.startsWith('/board') || pathname.startsWith('/settings'),
    },
  ];

  // PC 사이드바 상세 메뉴
  const desktopNavItems = [
    {
      href: '/',
      label: '홈 대시보드',
      desc: '통장 잔액 및 모임 요약',
      icon: Home,
      active: pathname === '/',
    },
    {
      href: '/ledger',
      label: '회비 & 장부 관리',
      desc: '월별 납부 매트릭스 · 입출금 내역',
      icon: Wallet,
      active: pathname.startsWith('/ledger'),
    },
    {
      href: '/schedule',
      label: '일정표 & 모임 정산',
      desc: '캘린더 · 참석 투표 · N분의1 정산',
      icon: CalendarCheck,
      active: pathname.startsWith('/schedule'),
    },
    {
      href: '/polls',
      label: '실시간 의사결정 투표',
      desc: '모임 메뉴/일정 투표 및 미투표 현황',
      icon: Vote,
      active: pathname.startsWith('/polls'),
    },
    {
      href: '/gallery',
      label: '추억 사진 갤러리',
      desc: '앨범별 사진첩 및 ZIP 다운로드',
      icon: ImageIcon,
      active: pathname.startsWith('/gallery'),
    },
    {
      href: '/board',
      label: '모임 회칙 & 게시판',
      desc: '고정 회칙 안내 및 자유 소통',
      icon: MessageSquareText,
      active: pathname.startsWith('/board'),
    },
    {
      href: '/settings',
      label: '설정 & 데이터 백업',
      desc: '멤버 관리 및 SQLite DB 백업',
      icon: Settings,
      active: pathname.startsWith('/settings'),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      {/* PC 웹 전용 좌측 고정 사이드바 (lg 이상에서 표시) */}
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-slate-900 text-white z-30 shadow-xl">
        {/* 브랜드 헤더 */}
        <div className="p-6 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FEE500] text-slate-900 flex items-center justify-center font-black text-xl shadow-md">
              ₩
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-white text-lg truncate">
                  {setting.groupName}
                </h1>
              </div>
              <p className="text-xs text-slate-400 truncate">Moim-Pocket 웹 대시보드</p>
            </div>
          </Link>

          {/* 현재 접속 프로필 및 권한 카드 */}
          <div className="mt-5 p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">현재 접속 멤버</span>
                <span className="font-extrabold text-sm text-white">
                  {currentMember.name}님
                </span>
              </div>
              {isAdmin ? (
                <span className="px-2 py-0.5 text-[11px] font-extrabold rounded-lg bg-[#FEE500] text-slate-900">
                  총무 권한 ON
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-lg bg-white/10 text-slate-300">
                  일반 멤버
                </span>
              )}
            </div>

            <div className="flex gap-1.5 pt-1">
              {isAdmin ? (
                <button
                  onClick={disableAdmin}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>총무모드 해제</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowAdminModal(true)}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition flex items-center justify-center gap-1"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-[#FEE500]" />
                  <span>총무 모드 전환</span>
                </button>
              )}

              <button
                onClick={logoutMember}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 transition"
                title="다른 멤버로 프로필 변경"
              >
                <UserCheck className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* PC 사이드바 내비게이션 메뉴 */}
        <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
          {desktopNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl transition ${
                  item.active
                    ? 'bg-[#FEE500] text-slate-900 font-extrabold shadow-md'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    item.active ? 'text-slate-900 stroke-[2.5px]' : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-sm leading-tight truncate">{item.label}</div>
                  <div
                    className={`text-[11px] mt-0.5 truncate ${
                      item.active ? 'text-slate-800 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {item.desc}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* PC 사이드바 하단 정보 */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>월 회비 ₩{Number(setting.monthlyFee || 0).toLocaleString()}</span>
          <button
            onClick={logoutAll}
            className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-400 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>잠금</span>
          </button>
        </div>
      </aside>

      {/* 우측(PC) / 전체(모바일) 메인 컨텐츠 래퍼 */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen pb-20 lg:pb-8">
        {/* 모바일 & 태블릿 상단 헤더 (lg 미만에서 표시) */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FEE500] text-slate-900 flex items-center justify-center font-black text-base shadow-sm">
              ₩
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-slate-900 text-base leading-tight">
                  {setting.groupName}
                </h1>
                {isAdmin && (
                  <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded bg-emerald-100 text-emerald-800">
                    총무모드 ON
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                접속 프로필: <strong className="text-slate-700">{currentMember.name}</strong>님
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-1.5">
            {isAdmin ? (
              <button
                onClick={disableAdmin}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 transition"
                title="클릭 시 일반 멤버 모드로 전환"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>총무 ON</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAdminModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                title="총무 코드(ADMIN_PIN) 입력"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                <span>총무전환</span>
              </button>
            )}

            <Link
              href="/settings"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="모임 설정 및 백업"
            >
              <Settings className="w-4 h-4" />
            </Link>

            <button
              onClick={logoutMember}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              title="멤버 프로필 전환"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* PC 상단 유틸리티 바 (lg 이상에서 표시) */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200/80 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-slate-900">
              {desktopNavItems.find((i) => i.active)?.label || '대시보드'}
            </span>
            <span className="text-xs text-slate-400">
              {desktopNavItems.find((i) => i.active)?.desc}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
              모임통장: <strong className="text-slate-800">{setting.bankAccount || '미등록'}</strong>
            </div>
            <button
              onClick={logoutMember}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>프로필 전환 ({currentMember.name})</span>
            </button>
          </div>
        </header>

        {/* 반응형 본문 컨테이너 (모바일은 패딩 컴팩트, PC는 최대 7xl 와이드 컨테이너) */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8 space-y-6">
          {children}
        </main>

        {/* 모바일 전용 하단 고정 탭 바 (lg 미만에서만 표시) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 px-2 py-1.5">
          <div className="max-w-xl mx-auto grid grid-cols-5 gap-1">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition ${
                    item.active
                      ? 'text-slate-900 font-extrabold bg-[#FEE500]/35'
                      : 'text-slate-400 hover:text-slate-700 font-medium'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${item.active ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
                  <span className="text-[11px] mt-1 tracking-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* 총무 모드 PIN 입력 모달 */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#FEE500] text-slate-900 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">총무(관리자) 모드 전환</h3>
                  <p className="text-xs text-slate-500">총무 전용 인증 코드를 입력하세요</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAdminModal(false);
                  setAdminPinError('');
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-3">
              <input
                type="password"
                inputMode="numeric"
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                placeholder="총무 코드 입력 (기본: 9999)"
                className="w-full px-4 py-3 text-center text-lg font-bold tracking-widest rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                autoFocus
                required
              />
              {adminPinError && (
                <p className="text-xs text-rose-600 font-medium text-center">{adminPinError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-semibold text-sm"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl bg-slate-900 text-[#FEE500] font-bold text-sm"
                >
                  총무 권한 활성화
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
