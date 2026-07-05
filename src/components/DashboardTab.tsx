/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Building2, MapPin, Radio, ShieldAlert, Siren, VolumeX, Volume2, ShieldCheck, 
  Thermometer, Zap, Battery, RefreshCw, AlertTriangle, Play 
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as ChartTooltip, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { Site, AlarmLog, AuditTrail, User } from '../types.ts';

interface DashboardTabProps {
  sites: Site[];
  alarmLogs: AlarmLog[];
  auditTrails: AuditTrail[];
  currentUser: User;
  onMuteSiren: (siteId: string, action: 'MUTE' | 'ON') => void;
  onInjectTestAlarm: (siteId: string, grounding: string | null, door: string | null) => void;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

export default function DashboardTab({
  sites,
  alarmLogs,
  auditTrails,
  currentUser,
  onMuteSiren,
  onInjectTestAlarm,
  isAudioMuted,
  onToggleAudio,
  autoRefresh,
  onToggleAutoRefresh
}: DashboardTabProps) {
  // Select active site to examine in detail
  const [selectedSiteId, setSelectedSiteId] = useState<string>('BTS-001');

  const selectedSite = sites.find(s => s.siteId === selectedSiteId) || sites[0] || {
    siteId: 'BTS-001',
    siteName: 'BTS SUMBERJAYA',
    location: 'Sumberjaya, Indonesia',
    latitude: -6.914744,
    longitude: 107.609810,
    grounding: 'NORMAL',
    door: 'TERTUTUP',
    sirene: 'OFF',
    gsm: '4G',
    rssi: -72,
    status: 'ONLINE',
    rectifier: 'NORMAL',
    battery: 'NORMAL',
    acPower: 'NORMAL',
    temperature: 28,
    isMuted: false,
    mutedRemaining: 0
  };

  // Dynamically calculate Alarm Trend (last 7 days) from active and historical alarmLogs
  const getLast7Days = () => {
    const days = [];
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        dateStr: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('id-ID', options)
      });
    }
    return days;
  };

  const alarmTrendData = getLast7Days().map(day => {
    // Count alarms for this day based on log timestamp
    const logsOnDay = alarmLogs.filter(log => {
      if (!log.timestamp) return false;
      return log.timestamp.startsWith(day.dateStr);
    });

    const alarmCount = logsOnDay.filter(l => 
      l.alarmType === 'GROUNDING_PUTUS' || 
      l.alarmType === 'PINTU_TERBUKA'
    ).length;

    const warningCount = logsOnDay.filter(l => 
      l.alarmType === 'TEMPERATURE_HIGH' || 
      l.alarmType === 'AC_POWER_FAIL' ||
      l.alarmType === 'ESP32_OFFLINE'
    ).length;

    return {
      name: day.label,
      Alarm: alarmCount,
      Warning: warningCount
    };
  });

  // Calculate Site Distributions dynamically from sites list (pulling from database)
  const totalSitesCount = sites.length || 1;
  const offlineSitesCount = sites.filter(s => s.status === 'OFFLINE').length;
  const activeAlarmSites = sites.filter(s => s.status === 'ONLINE' && (s.grounding === 'PUTUS' || s.door === 'TERBUKA')).length;
  const warningSitesCount = sites.filter(s => s.status === 'ONLINE' && s.grounding === 'NORMAL' && s.door === 'TERTUTUP' && (s.temperature > 35 || s.acPower === 'FAIL' || s.rectifier === 'FAULT' || s.battery === 'LOW')).length;
  const normalSitesCount = sites.filter(s => s.status === 'ONLINE' && s.grounding === 'NORMAL' && s.door === 'TERTUTUP' && !(s.temperature > 35 || s.acPower === 'FAIL' || s.rectifier === 'FAULT' || s.battery === 'LOW')).length;

  const distributionData = [
    { name: 'Normal', value: normalSitesCount, color: '#22C55E' },
    { name: 'Alarm', value: activeAlarmSites, color: '#EF4444' },
    { name: 'Warning', value: warningSitesCount, color: '#F59E0B' },
    { name: 'Offline', value: offlineSitesCount, color: '#64748B' },
  ];

  const activeAlarmsList = alarmLogs.filter(log => log.status === 'ACTIVE');

  // Format Helper for timestamps
  const getReadableTime = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return '10:24:10';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Upper Site Selector & Notification Control Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Building2 className="text-slate-600" />
            Dashboard Alarm Site
          </h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Site Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {sites.map(s => (
                <option key={s.siteId} value={s.siteId}>
                  {s.siteId} - {s.siteName}
                </option>
              ))}
            </select>
          </div>

          {/* Browser Audio Alarm Sound Toggle */}
          <button
            onClick={onToggleAudio}
            className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
              isAudioMuted 
                ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100' 
                : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 ring-4 ring-rose-500/10'
            }`}
            title={isAudioMuted ? 'Nyalakan alarm audio' : 'Bisukan alarm audio'}
          >
            {isAudioMuted ? <VolumeX size={16} /> : <Siren size={16} className="animate-bounce" />}
            <span className="hidden md:inline">{isAudioMuted ? 'Buzzer Silenced' : 'Buzzer Armed'}</span>
          </button>

          {/* Direct Manual Alarm Injectors (Only Admin) */}
          {currentUser.role === 'admin' && !currentUser.isReadOnly && (
            <div className="flex gap-1">
              <button
                onClick={() => onInjectTestAlarm(selectedSite.siteId, 'PUTUS', null)}
                className="px-2.5 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs rounded-xl font-medium transition-colors cursor-pointer"
                title="Simulasi Grounding Putus"
              >
                Grounding Putus
              </button>
              <button
                onClick={() => onInjectTestAlarm(selectedSite.siteId, null, 'TERBUKA')}
                className="px-2.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600 text-xs rounded-xl font-medium transition-colors cursor-pointer"
                title="Simulasi Pintu Terbuka"
              >
                Pintu Shelter
              </button>
              <button
                onClick={() => onInjectTestAlarm(selectedSite.siteId, 'NORMAL', 'TERTUTUP')}
                className="px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 text-xs rounded-xl font-medium transition-colors cursor-pointer"
                title="Reset normal"
              >
                Cure Site Alarms
              </button>
            </div>
          )}
        </div>
      </div>

      {/* THREE COLUMN SCADA GRAPHIC GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* LEFTSIDE COLUMN - SITE INFORMATION & DEVICE STATUS COMBINED CARD */}
        <div className="hidden md:flex lg:col-span-3 flex-col lg:h-[580px] gap-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              
              {/* SECTION 1: SITE INFORMATION */}
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                  <span className="text-xs uppercase tracking-wider font-mono text-slate-400">SITE INFORMATION</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider ${
                    selectedSite.status === 'OFFLINE'
                      ? 'bg-slate-100 text-slate-500'
                      : selectedSite.grounding === 'PUTUS' || selectedSite.door === 'TERBUKA'
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-emerald-500 text-white'
                  }`}>
                    {selectedSite.status === 'OFFLINE' ? 'OFFLINE' : (selectedSite.grounding === 'PUTUS' || selectedSite.door === 'TERBUKA' ? 'ALARM' : 'NORMAL')}
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">Site ID</span>
                    <div className="text-lg font-bold text-slate-800 font-mono">{selectedSite.siteId}</div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">Site Name</span>
                    <div className="text-sm font-semibold text-slate-700">{selectedSite.siteName}</div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">Location</span>
                    <div className="text-xs text-slate-600 flex items-start gap-1">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                      <span>{selectedSite.location}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">Latitude</span>
                      <span className="text-xs font-mono text-slate-600 font-medium">{Number(selectedSite.latitude || 0).toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">Longitude</span>
                      <span className="text-xs font-mono text-slate-600 font-medium">{Number(selectedSite.longitude || 0).toFixed(6)}</span>
                    </div>
                  </div>

                  
                </div>
              </div>

              {/* SECTION 2: STATUS PERANGKAT */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 mb-2.5 tracking-wider uppercase font-mono">STATUS PERANGKAT</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50/70 rounded-xl">
                    <span className="text-[11px] text-slate-600 flex items-center gap-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      Rectifier
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${selectedSite.rectifier === 'NORMAL' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {selectedSite.rectifier}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50/70 rounded-xl">
                    <span className="text-[11px] text-slate-600 flex items-center gap-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Battery Bank
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${selectedSite.battery === 'NORMAL' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {selectedSite.battery}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50/70 rounded-xl">
                    <span className="text-[11px] text-slate-600 flex items-center gap-1.5 font-medium">
                      <Zap size={11} className="text-amber-500" />
                      AC Mains
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${selectedSite.acPower === 'NORMAL' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {selectedSite.acPower === 'NORMAL' ? 'NORMAL' : 'FAIL'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50/70 rounded-xl">
                    <span className="text-[11px] text-slate-600 flex items-center gap-1.5 font-medium">
                      <Thermometer size={11} className="text-red-400" />
                      Temp Shelter
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-700">
                      {selectedSite.temperature} °C
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50/70 rounded-xl">
                    <span className="text-[11px] text-slate-600 flex items-center gap-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                      Grounding
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${selectedSite.grounding === 'NORMAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {selectedSite.grounding === 'NORMAL' ? 'NORMAL' : 'PUTUS'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50/70 rounded-xl">
                    <span className="text-[11px] text-slate-600 flex items-center gap-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                      Pintu Shelter
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${selectedSite.door === 'TERTUTUP' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {selectedSite.door === 'TERTUTUP' ? 'TERTUTUP' : 'TERBUKA'}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN - INTERACTIVE SCHEMATIC TOWER GRAPHIC */}
        <div className="lg:col-span-6 bg-[#0F172A] rounded-2xl shadow-inset relative flex flex-col min-h-[500px] lg:h-[580px] border border-slate-800">
          
          {/* Mobile Telemetry Header */}
          <div className="md:hidden bg-slate-900 border-b border-slate-800 py-2.5 px-4 flex justify-between items-center z-10">
            <button
              onClick={onToggleAutoRefresh}
              className={`text-xs uppercase tracking-widest font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                autoRefresh ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              TELEMETRY: {autoRefresh ? 'ON' : 'OFF'}
            </button>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded">SITE: {selectedSite.siteId}</span>
          </div>

          {/* Top telemetry status lines */}
          <div className="absolute top-4 md:top-4 left-4 right-4 flex justify-between items-center z-10 mt-10 md:mt-0">
            <button
              onClick={onToggleAutoRefresh}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all flex items-center gap-1 cursor-pointer hover:scale-[1.02] ${
                autoRefresh
                  ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
                  : 'text-slate-400 bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'
              }`}
              title={autoRefresh ? "Klik untuk mematikan telemetry otomatis" : "Klik untuk menghidupkan telemetry otomatis"}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
              {autoRefresh ? 'LIVE TELEMETRY ACTIVE' : 'TELEMETRY INACTIVE'}
            </button>
          </div>

          {/* MAIN TOWER VECTOR CANVAS AND TELEMETRY PANELS */}
          <div className="flex-1 relative flex flex-col md:flex-row items-center justify-start md:justify-center pt-8 pb-10 px-6 gap-6 md:gap-10">
            
            {/* Elegant SVG Tower Background layout */}
            <div className="relative flex-1 w-full max-w-[340px] sm:max-w-[420px] md:max-w-[440px] lg:max-w-[460px] flex items-center justify-center max-h-[380px] lg:max-h-[420px]">
              <svg viewBox="40 -45 320 515" className="w-auto h-full max-h-[380px] lg:max-h-[420px] pointer-events-none">
                <defs>
                  <linearGradient id="shelterMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1E293B" />
                    <stop offset="100%" stopColor="#0F172A" />
                  </linearGradient>
                  <linearGradient id="towerSteel" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#94A3B8" />
                    <stop offset="50%" stopColor="#F1F5F9" />
                    <stop offset="100%" stopColor="#475569" />
                  </linearGradient>
                  <linearGradient id="concreteFoot" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#CBD5E1" />
                    <stop offset="100%" stopColor="#64748B" />
                  </linearGradient>
                  <radialGradient id="alarmPulse" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="normalWave" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </radialGradient>
                </defs>

                <g id="grid-radar" opacity="0.12">
                  <circle cx="200" cy="200" r="160" fill="none" stroke="#38BDF8" strokeWidth="0.75" strokeDasharray="3,3" />
                  <circle cx="200" cy="200" r="110" fill="none" stroke="#22C55E" strokeWidth="0.75" strokeDasharray="3,3" />
                  <circle cx="200" cy="200" r="60" fill="none" stroke="#22C55E" strokeWidth="0.75" strokeDasharray="3,3" />
                  <line x1="200" y1="20" x2="200" y2="460" stroke="#38BDF8" strokeWidth="0.75" strokeDasharray="3,3" />
                  <line x1="20" y1="200" x2="380" y2="200" stroke="#38BDF8" strokeWidth="0.75" strokeDasharray="3,3" />
                </g>

                {/* Signals Wave emanating from the antennas */}
                {selectedSite.sirene === 'ON' ? (
                  <g>
                    {/* Concentric waves with safe opacity pulsing to convey the radio signal */}
                    <circle cx="200" cy="70" r="30" fill="url(#alarmPulse)" className="animate-pulse" opacity="0.9" />
                    <circle cx="200" cy="70" r="50" fill="none" stroke="#EF4444" strokeWidth="1.5" className="animate-pulse" opacity="0.75" />
                    <circle cx="200" cy="70" r="75" fill="none" stroke="#F87171" strokeWidth="1" className="animate-pulse" opacity="0.5" />
                    <circle cx="200" cy="70" r="95" fill="none" stroke="#EF4444" strokeWidth="2" opacity="0.8" className="animate-pulse" />
                    <path d="M 170 45 A 30 30 0 0 1 230 45" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" />
                    <path d="M 155 30 A 50 50 0 0 1 245 30" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" />
                    <path d="M 140 15 A 70 70 0 0 1 260 15" fill="none" stroke="#FCA5A5" strokeWidth="1" strokeLinecap="round" />
                  </g>
                ) : (
                  <g>
                    <circle cx="200" cy="70" r="40" fill="url(#normalWave)" className="animate-pulse" />
                    <path d="M 180 50 A 20 20 0 0 1 220 50" fill="none" stroke="#10B981" strokeWidth="2.5" opacity="0.7" strokeLinecap="round" />
                    <path d="M 170 40 A 30 30 0 0 1 230 40" fill="none" stroke="#34D399" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
                  </g>
                )}

                {/* Concrete Foundations */}
                <g id="foundations">
                  {/* Left Foot */}
                  <polygon points="144,450 176,450 172,460 148,460" fill="url(#concreteFoot)" stroke="#475569" strokeWidth="1" />
                  <rect x="148" y="448" width="24" height="2" fill="#334155" />
                  {/* Right Foot */}
                  <polygon points="224,450 256,450 252,460 228,460" fill="url(#concreteFoot)" stroke="#475569" strokeWidth="1" />
                  <rect x="228" y="448" width="24" height="2" fill="#334155" />
                </g>

                {/* Cable Tray running down the tower */}
                <path d="M 203 90 L 203 440" stroke="#0F172A" strokeWidth="3" opacity="0.7" />
                <path d="M 203 90 L 203 440" stroke="#475569" strokeWidth="1" opacity="0.9" strokeDasharray="2,2" />

                {/* Ladder steps running up the core */}
                <path d="M195,90 L195,448 M201,90 L201,448 M195,100 L201,100 M195,112 L201,112 M195,124 L201,124 M195,136 L201,136 M195,148 L201,148 M195,160 L201,160 M195,172 L201,172 M195,184 L201,184 M195,196 L201,196 M195,208 L201,208 M195,220 L201,220 M195,232 L201,232 M195,244 L201,244 M195,256 L201,256 M195,268 L201,268 M195,280 L201,280 M195,292 L201,292 M195,304 L201,304 M195,316 L201,316 M195,328 L201,328 M195,340 L201,340 M195,352 L201,352 M195,364 L201,364 M195,376 L201,376 M195,388 L201,388 M195,400 L201,400 M195,412 L201,412 M195,424 L201,424 M195,436 L201,436" stroke="#64748B" strokeWidth="1" opacity="0.8" />

                {/* Obstruction warning rod on peak */}
                <line x1="200" y1="70" x2="200" y2="25" stroke="#94A3B8" strokeWidth="2" />
                <circle cx="200" cy="25" r="4" fill="#EF4444" />
                <circle cx="200" cy="25" r="9" fill="#EF4444" opacity="0.6" className="animate-pulse" />

                {/* Steel Truss Tower drawing */}
                <g id="tower-frame" stroke="url(#towerSteel)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                  {/* Main 3D legs with depth */}
                  <line x1="180" y1="70" x2="160" y2="450" strokeWidth="3" />
                  <line x1="220" y1="70" x2="240" y2="450" strokeWidth="3" />
                  {/* Middle depth leg */}
                  <line x1="200" y1="70" x2="200" y2="450" stroke="#334155" strokeWidth="1" opacity="0.5" />
                  
                  {/* Cross Bracings - Multi Stage lattice */}
                  {/* Stage 1 */}
                  <line x1="180" y1="70" x2="220" y2="70" />
                  <line x1="180" y1="70" x2="217" y2="120" strokeWidth="1.5" />
                  <line x1="220" y1="70" x2="177" y2="120" strokeWidth="1.5" />
                  
                  {/* Stage 2 */}
                  <line x1="177" y1="120" x2="217" y2="120" />
                  <line x1="177" y1="120" x2="214" y2="180" strokeWidth="1.5" />
                  <line x1="217" y1="120" x2="174" y2="180" strokeWidth="1.5" />
                  <line x1="177" y1="150" x2="214" y2="150" opacity="0.5" strokeWidth="1" />
                  
                  {/* Stage 3 */}
                  <line x1="174" y1="180" x2="214" y2="180" />
                  <line x1="174" y1="180" x2="210" y2="250" strokeWidth="1.5" />
                  <line x1="214" y1="180" x2="170" y2="250" strokeWidth="1.5" />
                  <line x1="172" y1="215" x2="211" y2="215" opacity="0.5" strokeWidth="1" />

                  {/* Stage 4 */}
                  <line x1="170" y1="250" x2="210" y2="250" />
                  <line x1="170" y1="250" x2="205" y2="330" strokeWidth="1.5" />
                  <line x1="210" y1="250" x2="165" y2="330" strokeWidth="1.5" />
                  <line x1="167" y1="290" x2="207" y2="290" opacity="0.5" strokeWidth="1" />

                  {/* Stage 5 */}
                  <line x1="165" y1="330" x2="205" y2="330" />
                  <line x1="165" y1="330" x2="200" y2="410" strokeWidth="1.5" />
                  <line x1="205" y1="330" x2="160" y2="410" strokeWidth="1.5" />
                  <line x1="161" y1="370" x2="202" y2="370" opacity="0.5" strokeWidth="1" />

                  {/* Stage 6 Base */}
                  <line x1="160" y1="410" x2="240" y2="410" strokeWidth="2.5" />
                  <line x1="160" y1="410" x2="240" y2="450" opacity="0.5" strokeWidth="1" />
                  <line x1="240" y1="410" x2="160" y2="450" opacity="0.5" strokeWidth="1" />
                  <line x1="160" y1="450" x2="240" y2="450" strokeWidth="4" stroke="#64748B" />
                </g>

                {/* Sector Antennas RF Panels at top */}
                <g id="sector-antennas">
                  {/* Left panel */}
                  <rect x="171" y="60" width="4" height="24" rx="1" fill="#FFFFFF" stroke="#475569" strokeWidth="1" />
                  <line x1="171" y1="72" x2="180" y2="72" stroke="#475569" strokeWidth="1.5" />
                  {/* Center panel */}
                  <rect x="198" y="55" width="5" height="28" rx="1" fill="#FFFFFF" stroke="#475569" strokeWidth="1" />
                  {/* Right panel */}
                  <rect x="225" y="60" width="4" height="24" rx="1" fill="#FFFFFF" stroke="#475569" strokeWidth="1" />
                  <line x1="225" y1="72" x2="220" y2="72" stroke="#475569" strokeWidth="1.5" />
                </g>

                {/* Parabolic Antenna Dishes */}
                {/* Left Microwave Dish */}
                <g id="dish-left">
                  <line x1="175" y1="130" x2="155" y2="130" stroke="#475569" strokeWidth="2" />
                  <path d="M 155 118 A 12 12 0 0 0 155 142 Z" fill="#334155" stroke="#E2E8F0" strokeWidth="1.5" />
                  <line x1="155" y1="130" x2="149" y2="130" stroke="#CBD5E1" strokeWidth="1.5" />
                </g>
                
                {/* Right Microwave Dish */}
                <g id="dish-right">
                  <line x1="225" y1="210" x2="245" y2="210" stroke="#475569" strokeWidth="2" />
                  <path d="M 245 198 A 12 12 0 0 1 245 222 Z" fill="#334155" stroke="#E2E8F0" strokeWidth="1.5" />
                  <line x1="245" y1="210" x2="251" y2="210" stroke="#CBD5E1" strokeWidth="1.5" />
                </g>

                {/* Shelter Cabin on right side */}
                <g id="shelter">
                  {/* Concrete Footing base */}
                  <rect x="245" y="440" width="100" height="10" rx="1" fill="url(#concreteFoot)" stroke="#334155" strokeWidth="1" />
                  
                  {/* Main Cabin box structure */}
                  <rect x="250" y="370" width="90" height="70" rx="3" fill="url(#shelterMetal)" stroke="#475569" strokeWidth="2" />
                  
                  {/* Cable entry port gland */}
                  <rect x="255" y="378" width="12" height="8" rx="0.5" fill="#0F172A" stroke="#475569" strokeWidth="1" />
                  <line x1="258" y1="382" x2="240" y2="382" stroke="#1E293B" strokeWidth="2" opacity="0.75" />

                  {/* AC Unit on the Right Side of Shelter */}
                  <rect x="340" y="380" width="8" height="20" rx="0.5" fill="#475569" stroke="#334155" strokeWidth="1" />
                  <line x1="341" y1="385" x2="347" y2="385" stroke="#1E293B" strokeWidth="0.75" />
                  <line x1="341" y1="390" x2="347" y2="390" stroke="#1E293B" strokeWidth="0.75" />
                  <line x1="341" y1="395" x2="347" y2="395" stroke="#1E293B" strokeWidth="0.75" />

                  {/* Door Layout state handling */}
                  {selectedSite.door === 'TERBUKA' ? (
                    <g id="door-open">
                      {/* Dark inside room cutout */}
                      <rect x="280" y="382" width="35" height="58" rx="1.5" fill="#020617" stroke="#EF4444" strokeWidth="1" />
                      {/* Server rack silhouette and battery stack */}
                      <rect x="284" y="388" width="8" height="52" fill="#1E293B" />
                      <rect x="296" y="388" width="15" height="42" fill="none" stroke="#475569" strokeWidth="0.75" />
                      {/* Server indicator blinking LEDs */}
                      <circle cx="288" cy="393" r="1.2" fill="#10B981" />
                      <circle cx="288" cy="397" r="1.2" fill="#EF4444" className="animate-pulse" />
                      <circle cx="288" cy="401" r="1.2" fill="#38BDF8" />
                      
                      {/* Door Swung outwards to the left (Isometric flat 2D layout, 100% stable, no 3D transform context shifts) */}
                      <polygon points="280,382 262,388 262,446 280,440" fill="#334155" stroke="#64748B" strokeWidth="1.5" />
                      {/* Yellow hazard warning sign on the swung-out door */}
                      <polygon points="266,394 274,394 270,399" fill="#F59E0B" />
                    </g>
                  ) : (
                    <g id="door-closed">
                      {/* Secure Closed Door */}
                      <rect x="280" y="382" width="35" height="58" rx="1.5" fill="#0F172A" stroke="#64748B" strokeWidth="1.5" />
                      {/* Door lock handle */}
                      <line x1="285" y1="410" x2="285" y2="416" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="285" cy="410" r="1" fill="#1E293B" />
                      {/* Warning label sign on door */}
                      <rect x="288" y="392" width="18" height="10" rx="0.5" fill="#F59E0B" />
                      <polygon points="297,393 294,398 300,398" fill="#000" />
                    </g>
                  )}
                </g>

                {/* Siren Warning Light on top of shelter */}
                {selectedSite.sirene === 'ON' ? (
                  <g id="siren-warning-on" className="animate-pulse">
                    <rect x="305" y="364" width="10" height="6" fill="#334155" stroke="#475569" strokeWidth="1" />
                    <path d="M 303 364 C 303 356, 317 356, 317 364 Z" fill="#EF4444" />
                    {/* Spinning light beams */}
                    <line x1="310" y1="360" x2="275" y2="340" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.8" />
                    <line x1="310" y1="360" x2="345" y2="340" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.8" />
                    {/* Concentric alert waves with safe animate-pulse representing beacon flashing */}
                    <circle cx="310" cy="360" r="12" fill="url(#alarmPulse)" className="animate-pulse" opacity="0.8" />
                    <circle cx="310" cy="360" r="20" fill="none" stroke="#EF4444" strokeWidth="1" strokeDasharray="2,2" className="animate-pulse" opacity="0.6" />
                  </g>
                ) : (
                  <g id="siren-warning-off">
                    <rect x="305" y="364" width="10" height="6" fill="#334155" />
                    <path d="M 303 364 C 303 356, 317 356, 317 364 Z" fill="#64748B" />
                  </g>
                )}

                {/* Grounding Spike Connection at left base */}
                <g id="grounding-installation">
                  {/* Grounding Spike Box / Earth Pit */}
                  <rect x="110" y="445" width="20" height="5" fill="#475569" rx="1" />
                  <line x1="120" y1="440" x2="120" y2="475" stroke={selectedSite.grounding === 'PUTUS' ? '#EF4444' : '#10B981'} strokeWidth="3.5" />
                  
                  {/* Grounding Fins Symbol */}
                  <line x1="110" y1="460" x2="130" y2="460" stroke={selectedSite.grounding === 'PUTUS' ? '#EF4444' : '#10B981'} strokeWidth="2" opacity="0.8" />
                  <line x1="114" y1="467" x2="126" y2="467" stroke={selectedSite.grounding === 'PUTUS' ? '#EF4444' : '#10B981'} strokeWidth="2" opacity="0.8" />
                  <line x1="117" y1="474" x2="123" y2="474" stroke={selectedSite.grounding === 'PUTUS' ? '#EF4444' : '#10B981'} strokeWidth="2" opacity="0.8" />

                  {/* Wire path state */}
                  {selectedSite.grounding === 'PUTUS' ? (
                    <g>
                      {/* Broken disconnected paths */}
                      <path d="M 160 448 C 145 448, 142 430, 136 430" fill="none" stroke="#EF4444" strokeWidth="2" strokeDasharray="3,3" />
                      {/* Disturbance glowing warning point (safe layout-stable pulse) */}
                      <circle cx="131" cy="430" r="4" fill="#EF4444" />
                      <circle cx="131" cy="430" r="8" fill="none" stroke="#EF4444" strokeWidth="1.5" className="animate-pulse" opacity="0.8" />
                      <circle cx="131" cy="430" r="5" fill="#EF4444" />
                      <text x="131" y="433" fill="#FFFFFF" fontSize="8" fontWeight="black" textAnchor="middle" fontFamily="sans">!</text>
                      <path d="M 126 430 Q 120 430, 120 440" fill="none" stroke="#EF4444" strokeWidth="2" strokeDasharray="3,3" />
                    </g>
                  ) : (
                    <path d="M 160 448 C 145 448, 135 435, 120 440" fill="none" stroke="#10B981" strokeWidth="2.5" />
                  )}
                </g>

                {/* Ambient Ground decoration line */}
                <line x1="15" y1="450" x2="385" y2="450" stroke="#1E293B" strokeWidth="3" opacity="0.5" />
              </svg>
            </div>

            {/* Side-by-side Panel holding Kabel Grounding and Pintu Shelter stacked top-to-bottom */}
            <div className="flex flex-col gap-3.5 w-full md:w-[210px] sm:max-w-xs z-20">
              
              {/* Telemetry Header */}
              <div className="mb-1 text-left hidden md:block">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">TELEMETRY POINTS</span>
                <span className="text-xs font-bold text-slate-400 font-mono">SENSOR STATUS</span>
              </div>

              {/* Label 1: GROUNDING ALARM POINT */}
              <div 
                className={`flex items-center gap-3 bg-slate-900/90 border backdrop-blur rounded-xl p-3 shadow-2xl transition-all ${
                  currentUser.role === 'admin' && !currentUser.isReadOnly ? 'cursor-pointer hover:scale-[1.02] hover:bg-slate-900' : 'cursor-default'
                }`}
                style={{ borderColor: selectedSite.grounding === 'PUTUS' ? '#EF4444' : '#1E293B' }}
                onClick={() => {
                  if (currentUser.role === 'admin' && !currentUser.isReadOnly) {
                     onInjectTestAlarm(selectedSite.siteId, selectedSite.grounding === 'PUTUS' ? 'NORMAL' : 'PUTUS', null);
                  }
                }}
              >
                <div className={`p-2 rounded-lg shrink-0 ${selectedSite.grounding === 'PUTUS' ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                  <Zap size={16} />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <div className="text-[9px] font-mono tracking-wider text-slate-400 font-bold truncate">KABEL GROUNDING</div>
                  <div className={`text-xs font-bold leading-tight truncate ${selectedSite.grounding === 'PUTUS' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {selectedSite.grounding === 'PUTUS' ? 'TERPUTUS' : 'NORMAL (OK)'}
                  </div>
                  <div className="text-[8px] font-mono text-slate-500 truncate">Kabel Tembaga 50mm</div>
                </div>
              </div>

              {/* Label 2: DOOR SENSOR ALARM POINT */}
              <div 
                className={`flex items-center gap-3 bg-slate-900/90 border backdrop-blur rounded-xl p-3 shadow-2xl transition-all ${
                  currentUser.role === 'admin' && !currentUser.isReadOnly ? 'cursor-pointer hover:scale-[1.02] hover:bg-slate-900' : 'cursor-default'
                }`}
                style={{ borderColor: selectedSite.door === 'TERBUKA' ? '#F59E0B' : '#1E293B' }}
                onClick={() => {
                  if (currentUser.role === 'admin' && !currentUser.isReadOnly) {
                     onInjectTestAlarm(selectedSite.siteId, null, selectedSite.door === 'TERBUKA' ? 'TERTUTUP' : 'TERBUKA');
                  }
                }}
              >
                <div className={`p-2 rounded-lg shrink-0 ${selectedSite.door === 'TERBUKA' ? 'bg-amber-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                  <ShieldAlert size={16} />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <div className="text-[9px] font-mono tracking-wider text-slate-400 font-bold truncate">PINTU SHELTER BTS</div>
                  <div className={`text-xs font-bold leading-tight truncate ${selectedSite.door === 'TERBUKA' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {selectedSite.door === 'TERBUKA' ? 'TERBUKA (ALERT)' : 'TERTUTUP (AMAN)'}
                  </div>
                  <div className="text-[8px] font-mono text-slate-500 truncate">Magnetic Switch @GPIO19</div>
                </div>
              </div>

              {/* Right Side / Nested: SIRENE PANEL CALLOUT (Positioned under the stacked sensors) */}
              {(selectedSite.grounding === 'PUTUS' || selectedSite.door === 'TERBUKA') && (
                <div className="bg-slate-950/95 border border-red-500/40 rounded-xl p-3.5 shadow-2xl text-center w-full z-30 animate-pulse mt-1">
                  <div className="flex justify-center mb-1 text-red-500">
                    <Siren size={20} className="animate-spin" />
                  </div>
                  <div className="text-[10px] font-mono text-red-400 font-bold uppercase">SIRENE AKTIF</div>
                  <p className="text-[8px] text-slate-400 mb-2 leading-snug">Relay active di shelter</p>
                  
                  {selectedSite.isMuted ? (
                    <button
                      onClick={() => onMuteSiren(selectedSite.siteId, 'ON')}
                      className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-[10px] sm:text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Volume2 size={12} strokeWidth={2.5} />
                      NYALAKAN (ON)
                    </button>
                  ) : (
                    <button
                      onClick={() => onMuteSiren(selectedSite.siteId, 'MUTE')}
                      className="w-full py-1.5 px-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg text-[10px] sm:text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <VolumeX size={12} strokeWidth={2.5} />
                      MUTE (SENYAP)
                    </button>
                  )}
                </div>
              )}

            </div>

          </div>
        </div>

        {/* RIGHTSIDE COLUMN - ACTIVE ALARMS (SQUARE SIZE TO BALANCE THE LAYOUT) */}
        <div className="hidden md:flex lg:col-span-3 flex-col lg:h-[580px] gap-6">
          
          {/* Active Alarms Drawer (Mock lists and actual) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase font-mono">Alarm Aktif</h3>
              <span className="bg-rose-50 text-rose-600 text-[10px] px-2 py-0.5 rounded-full font-bold font-mono animate-pulse">
                {activeAlarmsList.length} AKTIF
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-thin">
              {activeAlarmsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <ShieldCheck size={36} className="text-emerald-500 mb-2 animate-bounce" />
                  <span className="text-xs font-semibold text-slate-600">Tidak Ada Alarm Aktif</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-1">Semua site terpantau aman</span>
                </div>
              ) : (
                activeAlarmsList.map(item => (
                  <div key={item.id} className="p-3.5 bg-red-50/70 border border-red-200/60 rounded-xl flex items-start gap-2.5 flex-col">
                    <div className="flex items-center gap-2 w-full">
                      <div className="p-1 px-2 rounded bg-red-500 text-white text-[9px] font-mono font-bold animate-pulse">
                        {item.alarmType === 'GROUNDING_PUTUS' 
                          ? 'GROUNDING PUTUS' 
                          : item.alarmType === 'PINTU_TERBUKA' 
                          ? 'PINTU BTS TERBUKA' 
                          : item.alarmType === 'AC_POWER_FAIL' 
                          ? 'AC POWER_FAIL' 
                          : item.alarmType.replace('_', ' ')}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 ml-auto">{getReadableTime(item.timestamp)}</span>
                    </div>

                    <div className="text-xs font-bold text-slate-800 tracking-tight">
                      {item.siteId} - {item.siteName || sites.find(s => s.siteId === item.siteId)?.siteName || 'Unknown Site'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* BOTTOM GRAPHICS - DAILY TREND & TOTAL DISTRIBUTIONS SECTION */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-6 pb-4">
        
        {/* LINE CHART: ALARM TREND (7 HARI TERAKHIR) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase font-mono tracking-tight">ALARM TREND (7 HARI TERAKHIR)</h3>
          </div>
          
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={alarmTrendData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                <ChartTooltip />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} />
                <Line type="monotone" dataKey="Alarm" stroke="#EF4444" strokeWidth={2.5} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Warning" stroke="#F59E0B" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DONUT CHART: DISTRIBUSI STATUS SITE */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1 w-full text-center md:text-left flex flex-col justify-between h-full">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase font-mono tracking-wider mb-5 flex items-center justify-center md:justify-start gap-2">
                <span className="w-1.5 h-3 bg-blue-500 rounded-full" />
                DISTRIBUSI STATUS SITE
              </h3>
              
              <div className="space-y-2.5 w-full">
                {distributionData.map((d, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between py-2 px-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl text-xs transition-all duration-200 hover:translate-x-1"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: d.color }} />
                      <span className="text-slate-600 font-semibold">{d.name}</span>
                    </span>
                    <span className="font-bold font-mono text-slate-700">
                      {d.value} Site ({Math.round((d.value / totalSitesCount) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Donut rendering using Recharts */}
          <div className="w-[180px] h-[180px] relative shrink-0 flex items-center justify-center bg-slate-50/30 rounded-2xl p-2 border border-slate-100/50">
            {/* Center label */}
            <div className="absolute flex flex-col items-center justify-center pointer-events-none z-10">
              <span className="text-4xl font-extrabold font-mono text-slate-800 tracking-tight leading-none">{totalSitesCount}</span>
              <span className="text-[9px] uppercase tracking-wider font-extrabold font-mono text-slate-400 mt-1">TOTAL SITE</span>
            </div>
            
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
