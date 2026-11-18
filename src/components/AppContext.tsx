'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface Member {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  joinedAt: string;
}

export interface GroupSetting {
  id: string;
  groupName: string;
  bankAccount: string;
  monthlyFee: number;
  rulesMarkdown: string;
}

interface AppContextType {
  isHydrated: boolean;
  isGroupVerified: boolean;
  currentMember: Member | null;
  isAdmin: boolean;
  setting: GroupSetting;
  members: Member[];
  verifyGroupPin: (pin: string) => Promise<{ ok: boolean; message?: string }>;
  selectMember: (member: Member) => void;
  logoutMember: () => void;
   logoutAll: () => void;
  verifyAdminPin: (pin: string) => Promise<{ ok: boolean; message?: string }>;
  disableAdmin: () => void;
  refreshBootstrap: () => Promise<void>;
}

const defaultSetting: GroupSetting = {
  id: 'default',
  groupName: '우리계모임',
  bankAccount: '',
  monthlyFee: 30000,
  rulesMarkdown: '',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isGroupVerified, setIsGroupVerified] = useState(false);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [setting, setSetting] = useState<GroupSetting>(defaultSetting);
  const [members, setMembers] = useState<Member[]>([]);

  const refreshBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.setting) setSetting(data.setting);
      if (data.members) {
        setMembers(data.members);
        const savedMemberId = localStorage.getItem('gyemoim_member_id');
        if (savedMemberId) {
          const found = data.members.find((m: Member) => m.id === savedMemberId && m.isActive);
          if (found) setCurrentMember(found);
        }
      }
    } catch (e) {
      console.error('Bootstrap fetch error:', e);
    }
  }, []);

  useEffect(() => {
    const savedVerified = localStorage.getItem('gyemoim_group_verified') === 'true';
    const savedAdmin = localStorage.getItem('gyemoim_is_admin') === 'true';
    setIsGroupVerified(savedVerified);
    setIsAdmin(savedAdmin);
    setIsHydrated(true);
    refreshBootstrap();
  }, [refreshBootstrap]);

  const verifyGroupPin = async (pin: string) => {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_group', pin }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      localStorage.setItem('gyemoim_group_verified', 'true');
      document.cookie = 'gyemoim_group_verified=true; path=/; max-age=2592000';
      setIsGroupVerified(true);
      await refreshBootstrap();
      return { ok: true };
    }
    return { ok: false, message: data.message || '입장 코드가 일치하지 않습니다.' };
  };

  const selectMember = (member: Member) => {
    localStorage.setItem('gyemoim_member_id', member.id);
    setCurrentMember(member);
    if (member.role === 'ADMIN') {
      localStorage.setItem('gyemoim_is_admin', 'true');
      setIsAdmin(true);
    }
  };

  const logoutMember = () => {
    localStorage.removeItem('gyemoim_member_id');
    setCurrentMember(null);
  };

  const logoutAll = () => {
    localStorage.removeItem('gyemoim_group_verified');
    localStorage.removeItem('gyemoim_member_id');
    localStorage.removeItem('gyemoim_is_admin');
    document.cookie = 'gyemoim_group_verified=; path=/; max-age=0';
    setIsGroupVerified(false);
    setCurrentMember(null);
    setIsAdmin(false);
  };

  const verifyAdminPin = async (pin: string) => {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_admin', pin }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      localStorage.setItem('gyemoim_is_admin', 'true');
      setIsAdmin(true);
      return { ok: true };
    }
    return { ok: false, message: data.message || '총무 코드가 올바르지 않습니다.' };
  };

  const disableAdmin = () => {
    localStorage.removeItem('gyemoim_is_admin');
    setIsAdmin(false);
  };

  return (
    <AppContext.Provider
      value={{
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
        refreshBootstrap,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
