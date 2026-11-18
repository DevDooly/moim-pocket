'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Check,
  X,
  Minus,
  Plus,
  Search,
  Receipt,
  FileSpreadsheet,
  Trash2,
  Edit3,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Upload,
  Mail,
  Sparkles,
  CheckCircle2,
  Webhook,
} from 'lucide-react';
import { useApp } from '@/components/AppContext';

const CATEGORIES = [
  '회비',
  '이자/기타수입',
  '식비',
  '숙박/여행',
  '경조사',
  '운영비',
  '기타',
];

export default function LedgerPage() {
  const { isAdmin, setting, refreshBootstrap } = useApp();
  const [activeTab, setActiveTab] = useState<'matrix' | 'transactions'>('matrix');

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [members, setMembers] = useState<any[]>([]);
  const [duesRecords, setDuesRecords] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 총무 전용 일괄 납부 상태
  const [bulkMonth, setBulkMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [bulkAmount, setBulkAmount] = useState<number>(30000);
  const [submittingBulk, setSubmittingBulk] = useState(false);

  // 입출금 필터 상태
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 영수증 모달
  const [receiptModalUrl, setReceiptModalUrl] = useState<string | null>(null);

  // 수기 내역 등록/수정 모달
  const [showTxModal, setShowTxModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txDate, setTxDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [txType, setTxType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [txCategory, setTxCategory] = useState<string>('식비');
  const [txAmount, setTxAmount] = useState<string>('');
  const [txMemberId, setTxMemberId] = useState<string>('');
  const [txEventId, setTxEventId] = useState<string>('');
  const [txDescription, setTxDescription] = useState<string>('');
  const [txReceiptUrl, setTxReceiptUrl] = useState<string>('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // 카카오뱅크 엑셀 / 이메일 가져오기 모달 상태
  const [showKakaoModal, setShowKakaoModal] = useState(false);
  const [kakaoTab, setKakaoTab] = useState<'file' | 'imap' | 'webhook'>('file');
  const [excelPassword, setExcelPassword] = useState('890803');
  const [autoRegisterMembers, setAutoRegisterMembers] = useState(true);
  const [hasSampleFile, setHasSampleFile] = useState(false);
  const [sampleFileName, setSampleFileName] = useState<string | null>(null);
  const [imapHost, setImapHost] = useState('imap.naver.com');
  const [imapPort, setImapPort] = useState(993);
  const [imapUser, setImapUser] = useState('');
  const [imapPass, setImapPass] = useState('');
  const [importingKakao, setImportingKakao] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState('');

  const fetchLedger = useCallback(async (targetYear: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ledger?year=${targetYear}`, { cache: 'no-store' });
      const data = await res.json();
      setMembers(data.members || []);
      setDuesRecords(data.duesRecords || []);
      setTransactions(data.transactions || []);
      setEvents(data.events || []);
      if (data.setting?.monthlyFee) {
        setBulkAmount(data.setting.monthlyFee);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchKakaoImportConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/import/kakao', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setHasSampleFile(Boolean(data.hasSampleFile));
      setSampleFileName(data.sampleFileName || null);
      if (data.excelPassword) setExcelPassword(data.excelPassword);
      if (data.imapHost) setImapHost(data.imapHost);
      if (data.imapPort) setImapPort(Number(data.imapPort));
      if (data.imapUser) setImapUser(data.imapUser);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchLedger(year);
    fetchKakaoImportConfig();
  }, [year, fetchLedger, fetchKakaoImportConfig]);

  const activeMembers = members.filter((m) => m.isActive);

  const getDuesStatus = (memberId: string, m: number) => {
    const rec = duesRecords.find((r) => r.memberId === memberId && r.month === m);
    return rec?.status || 'UNPAID';
  };

  // 총무: 셀 클릭 시 납부완료 -> 미납 -> 면제 순환
  const handleCellClick = async (memberId: string, m: number) => {
    if (!isAdmin) return;
    const current = getDuesStatus(memberId, m);
    const nextStatus =
      current === 'PAID' ? 'UNPAID' : current === 'UNPAID' ? 'EXEMPT' : 'PAID';

    await fetch('/api/ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_dues_status',
        year,
        month: m,
        memberId,
        status: nextStatus,
        amount: setting.monthlyFee || 30000,
      }),
    });
    fetchLedger(year);
  };

  // 총무: 선택 멤버 일괄 납부 등록
  const handleBulkDuesSubmit = async () => {
    if (selectedMemberIds.length === 0) {
      alert('일괄 납부 처리할 멤버를 선택해주세요.');
      return;
    }
    setSubmittingBulk(true);
    try {
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_dues',
          year,
          month: bulkMonth,
          memberIds: selectedMemberIds,
          amount: bulkAmount,
        }),
      });
      if (res.ok) {
        setSelectedMemberIds([]);
        await fetchLedger(year);
      }
    } finally {
      setSubmittingBulk(false);
    }
  };

  const toggleSelectMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const openCreateTxModal = () => {
    setEditingTxId(null);
    setTxDate(new Date().toISOString().slice(0, 10));
    setTxType('EXPENSE');
    setTxCategory('식비');
    setTxAmount('');
    setTxMemberId('');
    setTxEventId('');
    setTxDescription('');
    setTxReceiptUrl('');
    setShowTxModal(true);
  };

  const openEditTxModal = (tx: any) => {
    setEditingTxId(tx.id);
    setTxDate(new Date(tx.date).toISOString().slice(0, 10));
    setTxType(tx.type);
    setTxCategory(tx.category);
    setTxAmount(String(tx.amount));
    setTxMemberId(tx.memberId || '');
    setTxEventId(tx.eventId || '');
    setTxDescription(tx.description || '');
    setTxReceiptUrl(tx.receiptUrl || '');
    setShowTxModal(true);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) setTxReceiptUrl(data.url);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: editingTxId,
      action: 'create_transaction',
      date: txDate,
      type: txType,
      category: txCategory,
      amount: Number(txAmount),
      memberId: txMemberId || null,
      eventId: txEventId || null,
      description: txDescription,
      receiptUrl: txReceiptUrl || null,
    };

    const res = await fetch('/api/ledger', {
      method: editingTxId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setShowTxModal(false);
      await fetchLedger(year);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('이 거래 내역을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/ledger?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchLedger(year);
    }
  };

  // 카카오뱅크 엑셀 직접 업로드 핸들러
  const handleKakaoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingKakao(true);
    setImportError('');
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('password', excelPassword);
      formData.append('autoRegisterMembers', String(autoRegisterMembers));

      const res = await fetch('/api/import/kakao', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || '파일 가져오기에 실패했습니다.');
      } else {
        setImportResult(data);
        await fetchLedger(year);
        await refreshBootstrap();
      }
    } finally {
      setImportingKakao(false);
      e.target.value = '';
    }
  };

  // 서버 내 예시 파일 즉시 가져오기 핸들러
  const handleImportSampleFile = async () => {
    setImportingKakao(true);
    setImportError('');
    setImportResult(null);
    try {
      const res = await fetch('/api/import/kakao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'sample',
          password: excelPassword,
          autoRegisterMembers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || '예시 파일 가져오기에 실패했습니다.');
      } else {
        setImportResult(data);
        await fetchLedger(year);
        await refreshBootstrap();
      }
    } finally {
      setImportingKakao(false);
    }
  };

  // 이메일(IMAP)에서 최신 카카오뱅크 엑셀 가져오기 핸들러
  const handleImportFromImap = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportingKakao(true);
    setImportError('');
    setImportResult(null);
    try {
      const res = await fetch('/api/import/kakao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'imap',
          password: excelPassword,
          autoRegisterMembers,
          imapHost,
          imapPort,
          imapUser,
          imapPass,
          saveConfig: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || '이메일 가져오기에 실패했습니다.');
      } else {
        setImportResult(data);
        await fetchLedger(year);
        await refreshBootstrap();
      }
    } finally {
      setImportingKakao(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    const d = new Date(tx.date);
    if (filterMonth !== 'ALL') {
      const m = d.getMonth() + 1;
      if (d.getFullYear() !== year || m !== Number(filterMonth)) return false;
    }
    if (filterType !== 'ALL' && tx.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = tx.description?.toLowerCase().includes(q);
      const matchCat = tx.category?.toLowerCase().includes(q);
      const matchMem = tx.member?.name?.toLowerCase().includes(q);
      if (!matchDesc && !matchCat && !matchMem) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* 상단 탭 전환 + 카카오뱅크 엑셀/이메일 가져오기 버튼 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex bg-slate-200/80 p-1 rounded-2xl flex-1 min-w-[240px]">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition ${
              activeTab === 'matrix'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            월별 회비 매트릭스
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition ${
              activeTab === 'transactions'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            입출금 내역 장부 ({transactions.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setImportError('');
            setImportResult(null);
            setShowKakaoModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-[#FEE500] hover:bg-yellow-300 text-slate-900 text-xs font-extrabold shadow-xs transition shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>카카오뱅크 엑셀 / 이메일 가져오기</span>
        </button>
      </div>

      {/* 연도 선택기 */}
      <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80">
        <button
          onClick={() => setYear((y) => y - 1)}
          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-extrabold text-sm text-slate-900">{year}년 회비 & 장부</span>
        <button
          onClick={() => setYear((y) => y + 1)}
          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 탭 1: 월별 회비 납부 매트릭스 */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="font-extrabold text-sm sm:text-base text-slate-900">
                  {year}년 월별 회비 납부 현황
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  {isAdmin
                    ? '총무 모드: 각 셀을 클릭하면 [완납 → 미납 → 면제] 상태가 즉시 전환됩니다'
                    : '초록 체크: 완납 / 빨간 점: 미납 / 회색: 면제'}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> 완납
                </span>
                <span className="inline-flex items-center gap-1 text-rose-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> 미납
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> 면제
                </span>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 px-4 pb-1">
              <table className="w-full border-collapse text-xs sm:text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-3 text-left font-bold sticky left-0 bg-white z-10">
                      멤버
                    </th>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <th key={m} className="py-2.5 px-1.5 text-center font-bold">
                        {m}월
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/70">
                      <td className="py-3 pr-3 font-bold text-slate-900 sticky left-0 bg-white z-10 whitespace-nowrap">
                        {member.name}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                        const st = getDuesStatus(member.id, m);
                        return (
                          <td key={m} className="py-2.5 px-1.5 text-center">
                            <button
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => handleCellClick(member.id, m)}
                              className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl inline-flex items-center justify-center transition ${
                                st === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                  : st === 'EXEMPT'
                                  ? 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                  : 'bg-rose-50 text-rose-500 hover:bg-rose-100'
                              } ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                              title={`${member.name} ${m}월: ${
                                st === 'PAID' ? '완납' : st === 'EXEMPT' ? '면제' : '미납'
                              }`}
                            >
                              {st === 'PAID' ? (
                                <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3px]" />
                              ) : st === 'EXEMPT' ? (
                                <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              ) : (
                                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* [총무 전용] 빠른 일괄 납부 처리 위젯 */}
          {isAdmin && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[#FEE500]" />
                  <h3 className="font-extrabold text-sm text-[#FEE500]">
                    [총무 전용] 빠른 일괄 납부 처리
                  </h3>
                </div>
                <span className="text-[11px] text-slate-300">장부 + 매트릭스 동시 반영</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">대상 월 선택</label>
                  <select
                    value={bulkMonth}
                    onChange={(e) => setBulkMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {year}년 {m}월 회비
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">1인당 회비 (원)</label>
                  <input
                    type="number"
                    value={bulkAmount}
                    onChange={(e) => setBulkAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-slate-300">납부 멤버 다중 선택</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedMemberIds(
                        selectedMemberIds.length === activeMembers.length
                          ? []
                          : activeMembers.map((m) => m.id)
                      )
                    }
                    className="text-[11px] text-[#FEE500] underline font-semibold"
                  >
                    {selectedMemberIds.length === activeMembers.length
                      ? '전체 해제'
                      : '전체 멤버 선택'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeMembers.map((member) => {
                    const checked = selectedMemberIds.includes(member.id);
                    const alreadyPaid = getDuesStatus(member.id, bulkMonth) === 'PAID';
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleSelectMember(member.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                          checked
                            ? 'bg-[#FEE500] text-slate-900 border-[#FEE500]'
                            : 'bg-slate-800 text-slate-200 border-slate-700'
                        }`}
                      >
                        <span>{member.name}</span>
                        {alreadyPaid && (
                          <span className="text-[10px] px-1 rounded bg-emerald-500/20 text-emerald-300">
                            완납됨
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                disabled={submittingBulk}
                onClick={handleBulkDuesSubmit}
                className="w-full py-3 rounded-xl bg-[#FEE500] hover:bg-yellow-300 text-slate-900 font-extrabold text-xs transition shadow-sm"
              >
                {submittingBulk
                  ? '일괄 등록 중...'
                  : `[선택 멤버(${selectedMemberIds.length}명) 회비 입금 일괄 등록]`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 탭 2: 입출금 내역 리스트 */}
      {activeTab === 'transactions' && (
        <div className="space-y-3">
          {/* 필터 및 검색 바 */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="내역 메모, 카테고리, 입금자 이름 검색"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              {isAdmin && (
                <button
                  onClick={openCreateTxModal}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900 text-[#FEE500] text-xs font-extrabold shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>수기 내역 등록</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-700"
              >
                <option value="ALL">전체 월 보기</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={String(m)}>
                    {year}년 {m}월
                  </option>
                ))}
              </select>

              <div className="flex gap-1">
                {(['ALL', 'INCOME', 'EXPENSE'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      filterType === t
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {t === 'ALL' ? '전체' : t === 'INCOME' ? '입금(+)' : '출금(-)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 거래 내역 목록 */}
          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100">
            {filteredTransactions.map((tx) => {
              const isIncome = tx.type === 'INCOME';
              return (
                <div key={tx.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                          isIncome
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {tx.category}
                      </span>
                      {tx.sourceType === 'CSV' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FEE500]/50 text-slate-900">
                          카카오뱅크엑셀
                        </span>
                      )}
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {tx.description}
                      </span>
                      {tx.receiptUrl && (
                        <button
                          onClick={() => setReceiptModalUrl(tx.receiptUrl)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold hover:bg-amber-200"
                          title="영수증 사진 보기"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>영수증</span>
                        </button>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{new Date(tx.date).toLocaleString('ko-KR')}</span>
                      {tx.member && <span>· 관련 멤버: {tx.member.name}</span>}
                      {tx.event && (
                        <span className="text-indigo-600 font-semibold">
                          · 일정: {tx.event.title}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`font-black text-sm sm:text-base ${
                        isIncome ? 'text-sky-600' : 'text-rose-600'
                      }`}
                    >
                      {isIncome ? '+' : '-'}₩{Number(tx.amount).toLocaleString()}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center justify-end gap-1.5 mt-1">
                        <button
                          onClick={() => openEditTxModal(tx)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                          title="내역 수정"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                          title="내역 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredTransactions.length === 0 && (
              <div className="py-10 text-center text-xs text-slate-400">
                조건에 맞는 입출금 내역이 없습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 카카오뱅크 엑셀 / 이메일 자동 가져오기 모달 */}
      {showKakaoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FEE500] text-slate-900 flex items-center justify-center font-black">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    카카오뱅크 거래내역 엑셀 & 이메일 연동
                  </h3>
                  <p className="text-xs text-slate-500">
                    암호 걸린 엑셀(.xlsx) 자동 복호화 · 중복 방지 · 멤버/회비 자동 매칭
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowKakaoModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3가지 연동 방식 탭 */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-extrabold">
              <button
                type="button"
                onClick={() => setKakaoTab('file')}
                className={`py-2 rounded-xl transition ${
                  kakaoTab === 'file' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                📁 엑셀 파일 업로드
              </button>
              <button
                type="button"
                onClick={() => setKakaoTab('imap')}
                className={`py-2 rounded-xl transition ${
                  kakaoTab === 'imap' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                📧 이메일 자동수신
              </button>
              <button
                type="button"
                onClick={() => setKakaoTab('webhook')}
                className={`py-2 rounded-xl transition ${
                  kakaoTab === 'webhook' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                🔗 서버 웹훅 API
              </button>
            </div>

            {/* 공통 옵션: 엑셀 비밀번호 + 신규 멤버 자동 등록 */}
            <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2.5 border border-slate-200/70 text-xs">
              <div className="flex items-center justify-between gap-3">
                <label className="font-bold text-slate-700 shrink-0">
                  카카오뱅크 엑셀 비밀번호 (생년월일 6자리)
                </label>
                <input
                  type="text"
                  value={excelPassword}
                  onChange={(e) => setExcelPassword(e.target.value)}
                  placeholder="예: 890803"
                  className="w-36 px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-extrabold text-center tracking-widest text-slate-900"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-slate-200/60">
                <input
                  type="checkbox"
                  checked={autoRegisterMembers}
                  onChange={(e) => setAutoRegisterMembers(e.target.checked)}
                  className="rounded text-slate-900"
                />
                <span className="text-slate-600 font-medium">
                  거래내역의 입금/이체자 실명(예: 김선홍, 정진우 등)을 멤버로 자동 등록 및 당월 회비 완납 처리
                </span>
              </label>
            </div>

            {/* 탭 1: 엑셀 파일 업로드 & 서버 샘플 파일 즉시 실행 */}
            {kakaoTab === 'file' && (
              <div className="space-y-3 text-xs">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-slate-900 rounded-2xl p-6 bg-slate-50/50 hover:bg-amber-50/30 transition cursor-pointer text-center">
                  <Upload className="w-7 h-7 text-slate-400 mb-2" />
                  <span className="font-extrabold text-sm text-slate-800">
                    {importingKakao
                      ? '엑셀 암호 해제 및 거래내역 분석 중...'
                      : '클릭하여 카카오뱅크 엑셀(.xlsx / .csv) 파일 선택'}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">
                    이메일로 받은 원본 암호화 엑셀 파일을 그대로 업로드하면 서버가 비밀번호({excelPassword})로 자동 복호화합니다
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleKakaoFileUpload}
                    className="hidden"
                    disabled={importingKakao}
                  />
                </label>

                {hasSampleFile && (
                  <div className="rounded-2xl bg-slate-900 text-white p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[#FEE500] font-extrabold text-xs">
                        <Sparkles className="w-4 h-4" />
                        프로젝트 폴더 내 예시 엑셀 파일 감지됨!
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-slate-300">
                        비밀번호: {excelPassword}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 break-all">{sampleFileName}</p>
                    <button
                      type="button"
                      disabled={importingKakao}
                      onClick={handleImportSampleFile}
                      className="w-full py-2.5 rounded-xl bg-[#FEE500] hover:bg-yellow-300 text-slate-900 font-extrabold text-xs transition"
                    >
                      {importingKakao
                        ? '가져오는 중...'
                        : '⚡ 서버의 예시 엑셀 파일 즉시 복호화 & 장부 반영하기'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 탭 2: 이메일(IMAP) 자동 수신 연동 */}
            {kakaoTab === 'imap' && (
              <form onSubmit={handleImportFromImap} className="space-y-3 text-xs">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setImapHost('imap.naver.com');
                      setImapPort(993);
                    }}
                    className={`flex-1 py-1.5 rounded-xl font-bold border ${
                      imapHost === 'imap.naver.com'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    네이버 메일 (imap.naver.com)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImapHost('imap.gmail.com');
                      setImapPort(993);
                    }}
                    className={`flex-1 py-1.5 rounded-xl font-bold border ${
                      imapHost === 'imap.gmail.com'
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Gmail (imap.gmail.com)
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-600 mb-1">IMAP 서버 주소</label>
                    <input
                      type="text"
                      value={imapHost}
                      onChange={(e) => setImapHost(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">포트 (SSL)</label>
                    <input
                      type="number"
                      value={imapPort}
                      onChange={(e) => setImapPort(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      수신 이메일 계정 (카카오뱅크에서 보낸 곳)
                    </label>
                    <input
                      type="text"
                      value={imapUser}
                      onChange={(e) => setImapUser(e.target.value)}
                      placeholder="예: myid@naver.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      이메일 비밀번호 (또는 앱 비밀번호)
                    </label>
                    <input
                      type="password"
                      value={imapPass}
                      onChange={(e) => setImapPass(e.target.value)}
                      placeholder="비밀번호 입력 (저장 시 생략 가능)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={importingKakao}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#FEE500] font-extrabold inline-flex items-center justify-center gap-1.5"
                >
                  <Mail className="w-4 h-4" />
                  <span>
                    {importingKakao
                      ? '메일함 접속 및 첨부 엑셀 복호화 중...'
                      : '메일함에서 최신 카카오뱅크 엑셀 자동 가져오기'}
                  </span>
                </button>
              </form>
            )}

            {/* 탭 3: 외부 메일 포워딩 웹훅 안내 */}
            {kakaoTab === 'webhook' && (
              <div className="space-y-2.5 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
                  <Webhook className="w-4 h-4 text-indigo-600" />
                  <span>서버 직접 수신 API (`POST /api/import/kakao`)</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Cloudflare Email Routing, Make, n8n, 또는 모바일 자동화에서 카카오뱅크 이메일 첨부파일을 서버로 바로 쏘면 즉시 복호화 및 장부 반영이 수행됩니다.
                </p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl overflow-x-auto text-[11px]">
{`curl -X POST http://서버주소:3000/api/import/kakao \\
  -F "file=@카카오뱅크_거래내역.xlsx" \\
  -F "password=${excelPassword}"`}
                </pre>
              </div>
            )}

            {/* 에러 및 성공 결과 배너 */}
            {importError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                ⚠️ {importError}
              </div>
            )}

            {importResult && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-1.5 text-emerald-950">
                <div className="flex items-center gap-1.5 font-extrabold text-sm text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>카카오뱅크 거래내역 가져오기 완료!</span>
                </div>
                <p>
                  · <strong>예금주/계좌:</strong> {importResult.accountHolder} (
                  {importResult.accountNumber})
                </p>
                <p>
                  · <strong>조회 기간:</strong> {importResult.period}
                </p>
                <p>
                  · <strong>반영 결과:</strong> 총 {importResult.totalParsed}건 중{' '}
                  <strong className="text-emerald-700 underline">
                    신규 {importResult.insertedCount}건 장부 등록
                  </strong>{' '}
                  (중복/0원 제외: {importResult.skippedCount}건)
                </p>
                {importResult.newlyRegisteredMembers?.length > 0 && (
                  <p>
                    · <strong>자동 등록된 멤버:</strong>{' '}
                    {importResult.newlyRegisteredMembers.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 영수증 이미지 확인 모달 */}
      {receiptModalUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 flex items-center justify-center p-4"
          onClick={() => setReceiptModalUrl(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900">첨부 영수증 확인</h4>
              <button
                onClick={() => setReceiptModalUrl(null)}
                className="p-1 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 flex justify-center">
              <img
                src={receiptModalUrl}
                alt="영수증 이미지"
                className="max-h-[70vh] w-auto rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* [총무 전용] 수기 내역 등록/수정 모달 */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingTxId ? '입출금 내역 수정' : '새 입출금 내역 등록'}
              </h3>
              <button
                onClick={() => setShowTxModal(false)}
                className="p-1 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTxType('INCOME');
                    setTxCategory('회비');
                  }}
                  className={`py-2.5 rounded-xl font-extrabold border ${
                    txType === 'INCOME'
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                >
                  + 입금 (수입)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTxType('EXPENSE');
                    setTxCategory('식비');
                  }}
                  className={`py-2.5 rounded-xl font-extrabold border ${
                    txType === 'EXPENSE'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                >
                  - 출금 (지출)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">거래 일자</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">카테고리 구분</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">금액 (원)</label>
                <input
                  type="number"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="예: 30000"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">관련 멤버 (선택)</label>
                  <select
                    value={txMemberId}
                    onChange={(e) => setTxMemberId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="">선택 안함</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">모임 일정 연동 (선택)</label>
                  <select
                    value={txEventId}
                    onChange={(e) => setTxEventId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="">연결 안함</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">내용 / 메모</label>
                <input
                  type="text"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="예: 11월 정기모임 삼겹살 결제"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">영수증 사진 첨부 (선택)</label>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingReceipt ? '업로드 중...' : '영수증 이미지 선택'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptUpload}
                      className="hidden"
                    />
                  </label>
                  {txReceiptUrl && (
                    <span className="text-emerald-600 font-semibold truncate">
                      첨부 완료 ✓
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 text-[#FEE500] font-extrabold"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
