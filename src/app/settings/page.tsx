'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Save,
  UserPlus,
  UserCheck,
  UserX,
  Database,
  Download,
  Upload,
  ShieldAlert,
  Edit2,
} from 'lucide-react';
import { useApp } from '@/components/AppContext';

export default function SettingsPage() {
  const { isAdmin, refreshBootstrap, logoutAll } = useApp();
  const [groupName, setGroupName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [monthlyFee, setMonthlyFee] = useState<number>(30000);
  const [members, setMembers] = useState<any[]>([]);
  const [savingSetting, setSavingSetting] = useState(false);

  // 멤버 추가 상태
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');

  const fetchSettings = useCallback(async () => {
    const res = await fetch('/api/settings', { cache: 'no-store' });
    const data = await res.json();
    if (data.setting) {
      setGroupName(data.setting.groupName || '');
      setBankAccount(data.setting.bankAccount || '');
      setMonthlyFee(Number(data.setting.monthlyFee || 30000));
    }
    if (data.members) {
      setMembers(data.members);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSavingSetting(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_setting',
          groupName,
          bankAccount,
          monthlyFee,
        }),
      });
      if (res.ok) {
        await refreshBootstrap();
        alert('모임 기본 설정이 저장되었습니다.');
      }
    } finally {
      setSavingSetting(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newMemberName.trim()) return;
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_member',
        name: newMemberName.trim(),
        role: newMemberRole,
      }),
    });
    if (res.ok) {
      setNewMemberName('');
      await fetchSettings();
      await refreshBootstrap();
    }
  };

  const handleRenameMember = async (member: any) => {
    if (!isAdmin) return;
    const nextName = prompt('변경할 멤버 이름을 입력하세요:', member.name);
    if (!nextName || !nextName.trim()) return;
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_member',
        id: member.id,
        name: nextName.trim(),
      }),
    });
    await fetchSettings();
    await refreshBootstrap();
  };

  const handleToggleMemberActive = async (member: any) => {
    if (!isAdmin) return;
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_member',
        id: member.id,
        isActive: !member.isActive,
      }),
    });
    if (res.ok) {
      await fetchSettings();
      await refreshBootstrap();
    }
  };

  const handleRestoreDb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('선택한 SQLite DB 파일로 현재 데이터를 복원(덮어쓰기)하시겠습니까?')) {
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/backup', { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok) {
      alert('DB 복원이 완료되었습니다. 데이터를 새로고침합니다.');
      await fetchSettings();
      await refreshBootstrap();
    } else {
      alert(data.error || '복원에 실패했습니다.');
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* 상단 세그먼트 탭: 회칙/게시판 vs 설정/백업 */}
      <div className="flex bg-slate-200/80 p-1 rounded-2xl">
        <Link
          href="/board"
          className="flex-1 py-2 text-center text-xs font-extrabold rounded-xl text-slate-500 hover:text-slate-900"
        >
          📌 모임 회칙 & 자유게시판
        </Link>
        <Link
          href="/settings"
          className="flex-1 py-2 text-center text-xs font-extrabold rounded-xl bg-white text-slate-900 shadow-xs"
        >
          ⚙️ 설정 & 데이터 백업
        </Link>
      </div>

      {!isAdmin && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3 text-xs text-amber-900">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-extrabold">총무 전용 설정 페이지 안내</p>
            <p className="text-amber-700 mt-0.5">
              상단 헤더의 <strong>[총무전환]</strong> 버튼을 눌러 총무 코드(ADMIN_PIN)를 입력하면 모임 정보 수정, 멤버 관리, DB 백업이 활성화됩니다.
            </p>
          </div>
        </div>
      )}

      {/* ① 모임 기본 정보 설정 */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <h3 className="font-extrabold text-sm text-slate-900">모임 기본 정보 설정</h3>
        <form onSubmit={handleSaveSetting} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-600 mb-1">모임 이름</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 disabled:bg-slate-50"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-600 mb-1">
              모임통장 계좌번호 (홈 화면 원클릭 복사용)
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="예: 카카오뱅크 3333-01-2345678 (홍길동)"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-600 mb-1">월 기본 회비 (원)</label>
            <input
              type="number"
              disabled={!isAdmin}
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 disabled:bg-slate-50 font-bold"
              required
            />
          </div>

          {isAdmin && (
            <button
              type="submit"
              disabled={savingSetting}
              className="w-full py-3 rounded-xl bg-slate-900 text-[#FEE500] font-extrabold inline-flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{savingSetting ? '저장 중...' : '모임 기본 정보 저장'}</span>
            </button>
          )}
        </form>
      </section>

      {/* ② 멤버 관리 (Soft Delete 지원) */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900">멤버 관리</h3>
          <p className="text-[11px] text-slate-400">
            탈퇴/휴면 처리 시에도 기존 장부 기록 보존을 위해 Soft Delete(비활성화)로 안전하게 유지됩니다
          </p>
        </div>

        {isAdmin && (
          <form onSubmit={handleAddMember} className="flex gap-1.5 text-xs">
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="신규 멤버 이름 입력"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200"
              required
            />
            <select
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value as 'MEMBER' | 'ADMIN')}
              className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white font-bold"
            >
              <option value="MEMBER">일반 멤버</option>
              <option value="ADMIN">총무</option>
            </select>
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-900 text-[#FEE500] font-extrabold shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>추가</span>
            </button>
          </form>
        )}

        <div className="divide-y divide-slate-100">
          {members.map((member) => (
            <div
              key={member.id}
              className="py-2.5 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`font-extrabold ${
                    member.isActive ? 'text-slate-900' : 'text-slate-400 line-through'
                  }`}
                >
                  {member.name}
                </span>
                {member.role === 'ADMIN' && (
                  <span className="px-1.5 py-0.5 rounded bg-[#FEE500] text-slate-900 text-[10px] font-extrabold">
                    총무
                  </span>
                )}
                {!member.isActive && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">
                    휴면/탈퇴
                  </span>
                )}
              </div>

              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleRenameMember(member)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                    title="이름 수정"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleToggleMemberActive(member)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                      member.isActive
                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {member.isActive ? (
                      <>
                        <UserX className="w-3 h-3" />
                        <span>휴면처리</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3 h-3" />
                        <span>복구</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ③ 데이터 백업 / 복원 (총무 전용) */}
      <section className="bg-slate-900 text-white rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#FEE500]" />
          <h3 className="font-extrabold text-sm text-[#FEE500]">
            SQLite 데이터베이스 원클릭 백업 & 복원
          </h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          현재 모임의 모든 장부, 회비 매트릭스, 일정, 투표, 게시글이 담긴 단일 SQLite DB 파일(
          <code>gyemoim.db</code>)을 브라우저로 즉시 다운로드하여 백업할 수 있습니다.
        </p>

        {isAdmin ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href="/api/backup"
              download
              className="py-3 rounded-xl bg-[#FEE500] hover:bg-yellow-300 text-slate-900 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>DB 파일 백업 다운로드</span>
            </a>

            <label className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700">
              <Upload className="w-4 h-4 text-slate-300" />
              <span>DB 백업 파일 복원</span>
              <input
                type="file"
                accept=".db,.sqlite,.sqlite3"
                onChange={handleRestoreDb}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <p className="text-xs text-amber-300 font-semibold">
            * 데이터 백업 및 복원 기능은 총무 모드 활성화 후 사용할 수 있습니다.
          </p>
        )}
      </section>

      {/* 기기 잠금 초기화 */}
      <div className="text-center pt-2">
        <button
          onClick={logoutAll}
          className="text-xs text-slate-400 hover:text-rose-600 underline font-medium"
        >
          모임 입장 코드 잠금화면으로 돌아가기 (전체 로그아웃)
        </button>
      </div>
    </div>
  );
}
