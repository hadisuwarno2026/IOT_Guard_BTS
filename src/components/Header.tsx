/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Bell, Clock, User as UserIcon, LogOut, ChevronDown, Menu } from 'lucide-react';
import { User, AlarmLog } from '../types.ts';

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  alarmLogs: AlarmLog[];
}

export default function Header({ currentUser, onLogout, alarmLogs }: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [showDropdown, setShowDropdown] = useState(false);

  // Tick the clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeAlarmsCount = alarmLogs.filter(l => l.status === 'ACTIVE').length;

  const formattedTime = time.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return (
    <header className="bg-[#1E293B]/50 backdrop-blur-sm h-16 border-b border-white/5 px-6 flex items-center justify-between font-sans print:hidden shrink-0 relative z-40">
      
      {/* Left side Hamburger / Title mobile */}
      <div className="flex items-center gap-3">
        <button className="md:hidden text-slate-300 hover:text-slate-100 p-1.5 hover:bg-white/5 rounded-xl cursor-not-allowed">
          <Menu size={20} />
        </button>
        <span className="text-xs uppercase tracking-wider font-bold font-mono text-slate-300 hidden md:block">
          SISTEM MONITORING BTS OPERASIONAL
        </span>
      </div>

      {/* Right side widgets (Notifications, Alerts, Clock, User Profile info) */}
      <div className="flex items-center gap-5">
        
        {/* Real-time Clock widget */}
        <div className="flex items-center gap-1.5 text-slate-200 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
          <Clock size={15} className="text-slate-400" />
          <span className="text-xs font-bold font-mono tracking-tight">{formattedTime} WIB</span>
        </div>

        {/* Pulsating active alarm count banner */}
        {activeAlarmsCount > 0 ? (
          <div className="flex items-center gap-1.5 bg-[#EF4444] text-white px-3 py-1.5 rounded-xl text-xs font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white" />
            <span>{activeAlarmsCount} Alarm Aktif</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] px-3 py-1.5 rounded-xl text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
            <span>Sistem Aman</span>
          </div>
        )}

        {/* User profile details with session action dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 py-1.5 px-3 rounded-xl transition-all cursor-pointer text-xs text-slate-200"
          >
            <div className="w-6 h-6 rounded-lg bg-slate-900 border border-white/15 text-slate-400 flex items-center justify-center">
              <UserIcon size={14} />
            </div>
            
            <div className="text-left hidden md:block">
              <div className="font-bold text-slate-200 leading-none">{currentUser.displayName}</div>
              <div className="text-[9px] font-mono text-slate-400 uppercase">{currentUser.role}</div>
            </div>

            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-[#1E293B] border border-white/10 rounded-2xl shadow-xl py-2 z-50">
              <div className="px-4 py-2 border-b border-white/5 text-[10px] font-mono text-slate-400 uppercase font-black">
                Aktivitas Sesi
              </div>
              
              <button
                onClick={onLogout}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-[#EF4444]/10 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut size={14} />
                <span>Logout Terminal</span>
              </button>
            </div>
          )}
        </div>

      </div>

    </header>
  );
}
