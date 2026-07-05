/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Building2, Radio, Siren, Eye, Calendar, FileText, Settings, 
  UserCheck, LogOut, Shield, ShieldCheck, AlertTriangle, AlertCircle, Package,
  Smartphone
} from 'lucide-react';
import { Site, AlarmLog, User } from '../types.ts';

export type TabID = 'dashboard' | 'monitoring' | 'asset' | 'alarm' | 'status' | 'settings' | 'users' | 'simcard';

interface SidebarProps {
  activeTab: TabID;
  onChangeTab: (tab: TabID) => void;
  onLogout: () => void;
  sites: Site[];
  alarmLogs: AlarmLog[];
  currentUser?: User | null;
}

export default function Sidebar({ activeTab, onChangeTab, onLogout, sites, alarmLogs, currentUser }: SidebarProps) {
  // Navigation tabs configuration filtered by user's specific permissions
  const rawMenuItems = [
    { id: 'monitoring' as TabID, label: 'Monitoring', icon: <Radio size={18} /> },
    { id: 'dashboard' as TabID, label: 'Dashboard', icon: <Building2 size={18} /> },
    { id: 'alarm' as TabID, label: 'Alarm', icon: <Siren size={18} />, badge: alarmLogs.filter(l => l.status === 'ACTIVE').length },
    { id: 'asset' as TabID, label: 'Asset', icon: <Package size={18} /> },
    { id: 'simcard' as TabID, label: 'SIM Card', icon: <Smartphone size={18} /> },
    { id: 'status' as TabID, label: 'Device', icon: <Eye size={18} /> },
    { id: 'settings' as TabID, label: 'Setting', icon: <Settings size={18} /> },
    { id: 'users' as TabID, label: 'User', icon: <UserCheck size={18} /> },
  ];

  const menuItems = rawMenuItems.filter(item => {
    if (currentUser?.permissions && Array.isArray(currentUser.permissions)) {
      return currentUser.permissions.includes(item.id);
    }
    if (item.id === 'settings' || item.id === 'users') {
      return currentUser?.role === 'admin';
    }
    return true;
  });

  // Raw counts as shown in the original layout sheet 
  const totalSiteCount = 25;
  const alarmSiteCount = sites.filter(s => s.grounding === 'PUTUS' || s.door === 'TERBUKA').length;
  const warningSiteCount = 1;
  const offlineSiteCount = sites.filter(s => s.status === 'OFFLINE').length;
  const normalSiteCount = totalSiteCount - alarmSiteCount - warningSiteCount - offlineSiteCount;

  return (
    <aside className="hidden md:flex w-[260px] bg-[#1E293B] text-slate-300 flex-col justify-between p-5 border-r border-white/10 shrink-0 font-sans print:hidden">
      
      {/* Top Brand Name */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 border-b border-white/5 pb-5">
          <div className="w-10 h-10 bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] rounded-xl flex items-center justify-center animate-pulse shrink-0">
            <Radio size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-black text-[#38BDF8] uppercase tracking-tight leading-tight">TBIG GUARD</h1>
            <p className="text-[10px] text-slate-400 font-mono">Real-time Monitoring &amp; Alert</p>
          </div>
        </div>

        {/* Navigation Menus List */}
        <nav className="space-y-1">
          {menuItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`w-full flex items-center gap-3.5 py-2.5 px-3.5 rounded-l-xl rounded-r-none text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-[#38BDF8]/10 text-[#38BDF8] border-r-3 border-[#38BDF8] font-bold' 
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <div className={isActive ? 'text-[#38BDF8]' : 'text-slate-400 group-hover:text-white'}>
                  {item.icon}
                </div>
                <span>{item.label}</span>

                {/* Badge for alarm updates */}
                {item.id === 'alarm' && (item.badge ?? 0) > 0 && (
                  <span className="ml-auto bg-[#EF4444] text-white font-bold font-mono py-0.5 px-2 rounded-full text-[10px] animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3.5 py-2.5 px-3.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 transition-colors cursor-pointer mt-4"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </nav>
      </div>

      {/* Bottom Site Stats Card Indicator */}
      <div className="bg-[#0F172A] border border-white/5 rounded-2xl p-4 space-y-3 mt-8">
        <h4 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">STATUS RINGKASAN</h4>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-400">
            <span className="flex items-center gap-2">
              <Radio size={12} className="text-[#38BDF8]" />
              Total Site
            </span>
            <span className="font-bold font-mono">{totalSiteCount}</span>
          </div>

          <div className="flex justify-between items-center text-slate-400 border-t border-white/5 pt-1.5">
            <span className="flex items-center gap-2">
              <ShieldCheck size={12} className="text-[#22C55E]" />
              Normal
            </span>
            <span className="font-bold font-mono text-[#22C55E]">{normalSiteCount}</span>
          </div>

          <div className="flex justify-between items-center text-slate-400">
            <span className="flex items-center gap-2">
              <AlertTriangle size={12} className="text-[#EF4444]" />
              Alarm
            </span>
            <span className="font-bold font-mono text-[#EF4444]">{alarmSiteCount}</span>
          </div>

          <div className="flex justify-between items-center text-slate-400">
            <span className="flex items-center gap-2">
              <AlertCircle size={12} className="text-[#F59E0B]" />
              Warning
            </span>
            <span className="font-bold font-mono text-[#F59E0B]">{warningSiteCount}</span>
          </div>

          <div className="flex justify-between items-center text-slate-400">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 ml-0.5 mr-0.5" />
              Offline
            </span>
            <span className="font-bold font-mono text-slate-400">{offlineSiteCount}</span>
          </div>
        </div>
      </div>

    </aside>
  );
}
