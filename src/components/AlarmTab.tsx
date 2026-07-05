/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Siren, VolumeX, Volume2, ShieldAlert, Zap, AlertTriangle, 
  Trash2, RefreshCw, CheckCircle, Search, Calendar, Filter, 
  HardDriveDownload, ArrowUpDown, ChevronLeft, ChevronRight, Info, PlusCircle 
} from 'lucide-react';
import { Site, AlarmLog, User } from '../types.ts';

interface AlarmTabProps {
  sites: Site[];
  alarmLogs: AlarmLog[];
  currentUser: User;
  onMuteSiren: (siteId: string, action: 'MUTE' | 'ON') => void;
  onInjectTestAlarm: (siteId: string, grounding: string | null, door: string | null) => void;
  onResetAll: () => void;
  onClearLogs: () => void;
}

export default function AlarmTab({
  sites,
  alarmLogs,
  currentUser,
  onMuteSiren,
  onInjectTestAlarm,
  onResetAll,
  onClearLogs
}: AlarmTabProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Datatable state variables
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'SEMUA' | 'ACTIVE' | 'CLOSED'>('SEMUA');
  const [typeFilter, setTypeFilter] = useState<string>('SEMUA');
  
  // Period filter states
  const [periodPreset, setPeriodPreset] = useState<'SEMUA' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM'>('SEMUA');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [sortField, setSortField] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected site for inline lab test injector
  const [injectSiteId, setInjectSiteId] = useState<string>(sites[0]?.siteId || '');

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, periodPreset, customStartDate, customEndDate]);

  // Sync selected site if sites list updates or is loaded
  useEffect(() => {
    if (!injectSiteId && sites.length > 0) {
      setInjectSiteId(sites[0].siteId);
    }
  }, [sites, injectSiteId]);

  const activeAlarmsCount = alarmLogs.filter(log => log.status === 'ACTIVE').length;
  const resolvedAlarmsCount = alarmLogs.filter(log => log.status === 'CLOSED').length;

  const handleResetAllAction = () => {
    setIsResetting(true);
    setTimeout(() => {
      onResetAll();
      setIsResetting(false);
    }, 600);
  };

  const handleClearLogsAction = () => {
    if (confirm('Apakah Anda yakin ingin menghapus semua riwayat logs dan alarm?')) {
      setIsClearing(true);
      setTimeout(() => {
        onClearLogs();
        setIsClearing(false);
      }, 600);
    }
  };

  // Helper date matching logic for period filter
  const matchesPeriod = (timestampStr: string) => {
    if (periodPreset === 'SEMUA') return true;
    const logDate = new Date(timestampStr);
    if (isNaN(logDate.getTime())) return true;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    const last7DaysStart = new Date(todayStart);
    last7DaysStart.setDate(last7DaysStart.getDate() - 7);
    
    const last30DaysStart = new Date(todayStart);
    last30DaysStart.setDate(last30DaysStart.getDate() - 30);

    if (periodPreset === 'TODAY') {
      return logDate >= todayStart;
    }
    if (periodPreset === 'YESTERDAY') {
      const nextDayStart = new Date(todayStart);
      return logDate >= yesterdayStart && logDate < nextDayStart;
    }
    if (periodPreset === 'LAST_7_DAYS') {
      return logDate >= last7DaysStart;
    }
    if (periodPreset === 'LAST_30_DAYS') {
      return logDate >= last30DaysStart;
    }
    if (periodPreset === 'CUSTOM') {
      if (customStartDate) {
        const start = new Date(customStartDate + 'T00:00:00');
        if (logDate < start) return false;
      }
      if (customEndDate) {
        const end = new Date(customEndDate + 'T23:59:59');
        if (logDate > end) return false;
      }
      return true;
    }
    return true;
  };

  // Filtered Alarm Logs
  const filteredLogs = alarmLogs.filter(log => {
    const matchesSearch = log.siteId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.siteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.keterangan.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.alarmType.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'SEMUA' || log.status === statusFilter;
    const matchesType = typeFilter === 'SEMUA' || log.alarmType === typeFilter;
    const matchesTime = matchesPeriod(log.timestamp);

    return matchesSearch && matchesStatus && matchesType && matchesTime;
  });

  // Sorted Alarm Logs
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    let aVal: any = a[sortField as keyof AlarmLog];
    let bVal: any = b[sortField as keyof AlarmLog];

    if (aVal === undefined || aVal === null) aVal = '';
    if (bVal === undefined || bVal === null) bVal = '';

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    aVal = String(aVal).toLowerCase();
    bVal = String(bVal).toLowerCase();

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginated Alarm Logs
  const totalItems = sortedLogs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLogs = sortedLogs.slice(startIndex, startIndex + pageSize);

  // Sync pagination if total pages shrink
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getReadableDateTime = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) + ' ' + date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch(e) {
      return isoStr;
    }
  };

  const getAlarmTypeBadge = (type: string) => {
    switch (type) {
      case 'GROUNDING_PUTUS':
        return 'bg-red-50 text-red-700 border border-red-200';
      case 'PINTU_TERBUKA':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'AC_POWER_FAIL':
        return 'bg-amber-50 text-amber-700 border border-amber-150';
      case 'ESP32_OFFLINE':
        return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'TEMPERATURE_HIGH':
        return 'bg-red-50 text-red-600 border border-red-150';
      case 'NORMAL':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      default:
        return 'bg-slate-50 text-slate-600 border border-slate-200';
    }
  };

  // CSV Export for Alarm Logs
  const handleExportCSV = () => {
    const headers = ['Log ID', 'Waktu', 'Site ID', 'Nama BTS', 'Tipe Alarm', 'Status', 'Keterangan Teknis'];
    const rows = sortedLogs.map(l => [
      l.id,
      getReadableDateTime(l.timestamp),
      l.siteId,
      l.siteName,
      l.alarmType.replace('_', ' '),
      l.status,
      l.keterangan
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_alarm_bts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Panel */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Siren className={`text-rose-500 ${activeAlarmsCount > 0 ? 'animate-spin' : ''}`} />
            Manajemen Alarm
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <HardDriveDownload size={14} />
            Export CSV
          </button>

          {currentUser.role === 'admin' && !currentUser.isReadOnly && (
            <>
              <button
                onClick={handleResetAllAction}
                disabled={isResetting}
                className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle size={14} />
                {isResetting ? 'Mereset...' : 'Reset All Alarm'}
              </button>
              <button
                onClick={handleClearLogsAction}
                disabled={isClearing}
                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={14} />
                {isClearing ? 'Membersihkan...' : 'Bersihkan Logs'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Stats Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Calendar size={20} />
          </div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 block font-bold uppercase">Total Alarm</span>
            <span className="text-xl font-bold text-slate-800">{alarmLogs.length}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
          <div className={`p-3 rounded-xl ${activeAlarmsCount > 0 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
            <Siren size={20} />
          </div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 block font-bold uppercase">Alarm Aktif</span>
            <span className={`text-xl font-bold ${activeAlarmsCount > 0 ? 'text-red-600 font-extrabold' : 'text-slate-800'}`}>
              {activeAlarmsCount}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 block font-bold uppercase">Alarm Selesai</span>
            <span className="text-xl font-bold text-slate-800">{resolvedAlarmsCount}</span>
          </div>
        </div>
      </div>

      {/* MAIN DATATABLE CONTAINER CARD */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        
        {/* Datatable Filter Control Panel */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
          
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-center flex-1">
              {/* Search Input - Optimized Width */}
              <div className="relative w-full sm:max-w-[220px]">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  placeholder="Cari Site ID, Nama..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Filter Status */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase whitespace-nowrap">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-auto"
                >
                  <option value="SEMUA">SEMUA STATUS</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              {/* Filter Type */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase whitespace-nowrap">Tipe:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-auto"
                >
                  <option value="SEMUA">SEMUA TIPE</option>
                  <option value="GROUNDING_PUTUS">GROUNDING PUTUS</option>
                  <option value="PINTU_TERBUKA">PINTU TERBUKA</option>
                  <option value="AC_POWER_FAIL">AC POWER DROP</option>
                  <option value="ESP32_OFFLINE">ESP32 OFFLINE</option>
                  <option value="TEMPERATURE_HIGH">SUHU TINGGI</option>
                  <option value="NORMAL">NORMAL</option>
                </select>
              </div>

              {/* Filter Periode - Placed next to Tipe */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase whitespace-nowrap flex items-center gap-1">
                  <Calendar size={12} className="text-indigo-500" />
                  Periode:
                </span>
                <select
                  value={periodPreset}
                  onChange={(e) => {
                    setPeriodPreset(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-auto"
                >
                  <option value="SEMUA">SEMUA PERIODE</option>
                  <option value="TODAY">HARI INI</option>
                  <option value="YESTERDAY">KEMARIN</option>
                  <option value="LAST_7_DAYS">7 HARI TERAKHIR</option>
                  <option value="LAST_30_DAYS">30 HARI TERAKHIR</option>
                  <option value="CUSTOM">KUSTOM TANGGAL</option>
                </select>
              </div>

              {/* Custom Datepicker Inline */}
              {periodPreset === 'CUSTOM' && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0 bg-white p-1 px-2.5 rounded-xl border border-slate-150 animate-fade-in">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-slate-400 uppercase">Dari:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => {
                        setCustomStartDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="bg-transparent border-0 p-0 text-[11px] text-slate-800 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="h-3 w-[1px] bg-slate-200 hidden sm:block" />
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-slate-400 uppercase">S/D:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => {
                        setCustomEndDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="bg-transparent border-0 p-0 text-[11px] text-slate-800 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Page size controller */}
            <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase whitespace-nowrap">Tampilkan:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-2.5 py-1.5 font-mono focus:outline-none"
              >
                <option value={10}>10 Baris</option>
                <option value={25}>25 Baris</option>
                <option value={50}>50 Baris</option>
                <option value={100}>100 Baris</option>
              </select>
            </div>
          </div>

        </div>

        {/* Clear Filters Indicator */}
        {(searchQuery !== '' || statusFilter !== 'SEMUA' || typeFilter !== 'SEMUA' || periodPreset !== 'SEMUA' || customStartDate !== '' || customEndDate !== '') && (
          <div className="bg-indigo-50/40 px-5 py-2.5 border-b border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">
              Menampilkan <strong>{filteredLogs.length}</strong> hasil pencarian filter.
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('SEMUA');
                setTypeFilter('SEMUA');
                setPeriodPreset('SEMUA');
                setCustomStartDate('');
                setCustomEndDate('');
                setCurrentPage(1);
              }}
              className="text-indigo-600 hover:text-indigo-800 font-bold font-mono text-[10px] uppercase cursor-pointer"
            >
              Reset Filter [X]
            </button>
          </div>
        )}

        {/* Responsive Table Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">
                <th className="py-4 px-5 font-bold cursor-pointer select-none hover:bg-slate-100" onClick={() => handleSort('timestamp')}>
                  <div className="flex items-center gap-1">
                    Waktu Alarm
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-4 px-5 font-bold cursor-pointer select-none hover:bg-slate-100" onClick={() => handleSort('siteId')}>
                  <div className="flex items-center gap-1">
                    Site ID
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-4 px-5 font-bold cursor-pointer select-none hover:bg-slate-100" onClick={() => handleSort('siteName')}>
                  <div className="flex items-center gap-1">
                    Nama BTS
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-4 px-5 font-bold cursor-pointer select-none hover:bg-slate-100" onClick={() => handleSort('alarmType')}>
                  <div className="flex items-center gap-1">
                    Tipe Alarm
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-4 px-5 font-bold cursor-pointer select-none hover:bg-slate-100" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1">
                    Status
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-4 px-5 font-bold cursor-pointer select-none hover:bg-slate-100" onClick={() => handleSort('keterangan')}>
                  <div className="flex items-center gap-1">
                    Keterangan Teknis
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-4 px-5 font-bold text-center">Aksi Kontrol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 bg-white">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldAlert size={36} className="text-slate-300" />
                      <span className="font-semibold text-slate-500">Tidak ada riwayat alarm terdaftar</span>
                      <span className="text-[11px] text-slate-400">Silakan ubah filter atau jalankan simulasi lab di bawah.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map(log => {
                  const isActive = log.status === 'ACTIVE';
                  
                  // Try to find the associated real-time site
                  const assocSite = sites.find(s => s.siteId === log.siteId);

                  return (
                    <tr key={log.id} className={`hover:bg-slate-50/40 transition-colors ${isActive ? 'bg-rose-50/10' : ''}`}>
                      <td className="py-3.5 px-5 font-mono font-medium text-slate-600 whitespace-nowrap">
                        {getReadableDateTime(log.timestamp)}
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-800">
                        {log.siteId}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-slate-700">
                        {log.siteName}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`px-2 py-1 rounded text-[10px] font-mono font-bold inline-block ${getAlarmTypeBadge(log.alarmType)}`}>
                          {log.alarmType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-mono ${
                          isActive 
                            ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
                          {isActive ? 'ACTIVE' : 'RESOLVED'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 leading-normal max-w-xs truncate" title={log.keterangan}>
                        {log.keterangan}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        {assocSite ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Mute/Unmute sirene button */}
                            {assocSite.isMuted ? (
                              <button
                                disabled={currentUser.isReadOnly}
                                onClick={() => onMuteSiren(assocSite.siteId, 'ON')}
                                className={`px-2.5 py-1 font-bold rounded-lg text-[10px] font-mono flex items-center gap-1 shadow-sm transition-all ${
                                  currentUser.isReadOnly
                                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                }`}
                                title={currentUser.isReadOnly ? "Hanya melihat (Tidak boleh menyalakan sirene)" : "Nyalakan Sirene"}
                              >
                                <Volume2 size={12} />
                                ON
                              </button>
                            ) : (
                              <button
                                disabled={currentUser.isReadOnly}
                                onClick={() => onMuteSiren(assocSite.siteId, 'MUTE')}
                                className={`px-2.5 py-1 font-bold rounded-lg text-[10px] font-mono flex items-center gap-1 shadow-sm transition-all ${
                                  currentUser.isReadOnly
                                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                    : 'bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200 cursor-pointer'
                                }`}
                                title={currentUser.isReadOnly ? "Hanya melihat (Tidak boleh mute)" : "Mute Sirene"}
                              >
                                <VolumeX size={12} />
                                MUTE
                              </button>
                            )}

                            {/* Direct Cure button for admins */}
                            {currentUser.role === 'admin' && !currentUser.isReadOnly && (assocSite.grounding === 'PUTUS' || assocSite.door === 'TERBUKA') && (
                              <button
                                onClick={() => onInjectTestAlarm(assocSite.siteId, 'NORMAL', 'TERTUTUP')}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold rounded-lg text-[10px] font-mono flex items-center gap-1 cursor-pointer shadow-sm transition-all"
                                title="Cure/Pulihkan alarm ke Normal"
                              >
                                CURE
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Datatable Footer & Pagination */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-500">
          <div>
            Menampilkan <strong>{totalItems === 0 ? 0 : startIndex + 1}</strong> sampai <strong>{Math.min(startIndex + pageSize, totalItems)}</strong> dari <strong>{totalItems}</strong> entri log alarm
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono border font-bold transition-all cursor-pointer ${
                  currentPage === page 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </div>

      {/* COLLAPSIBLE / CONDITIONAL LAB PLAYGROUND INJECTOR (Kept safe but styled cleanly as a secondary section) */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-700 tracking-tight uppercase font-mono flex items-center gap-1.5">
            <Info size={14} className="text-indigo-500" />
            LAB PLAYGROUND DIAGNOSTIK INJEKSI ALARM
          </h3>
          <span className="text-[10px] bg-slate-200/80 text-slate-600 px-2.5 py-0.5 rounded-full font-bold font-mono">
            Privilege: {currentUser.role.toUpperCase()}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
          Gunakan konsol simulasi di bawah ini untuk menguji tanggapan data langsung dan menyimulasikan alarm (loop kawat tembaga grounding terputus atau pintu shelter terbuka) pada sistem monitoring BTS.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div className="md:col-span-4">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 font-bold">
              Pilih Target BTS Site
            </label>
            <select
              value={injectSiteId}
              onChange={(e) => setInjectSiteId(e.target.value)}
              className="block w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {sites.map(s => (
                <option key={s.siteId} value={s.siteId}>
                  {s.siteId} - {s.siteName} (Ground: {s.grounding}, Pintu: {s.door})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-8 flex flex-wrap gap-2.5 pt-2 md:pt-0">
            <button
              onClick={() => onInjectTestAlarm(injectSiteId, 'PUTUS', null)}
              disabled={currentUser.role !== 'admin'}
              className="px-3.5 py-2.5 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 disabled:opacity-40 text-slate-700 hover:text-red-700 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Zap size={14} className="text-red-500 animate-pulse" />
              Injeksi Grounding Putus
            </button>

            <button
              onClick={() => onInjectTestAlarm(injectSiteId, null, 'TERBUKA')}
              disabled={currentUser.role !== 'admin'}
              className="px-3.5 py-2.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-200 disabled:opacity-40 text-slate-700 hover:text-amber-700 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <ShieldAlert size={14} className="text-amber-500" />
              Injeksi Pintu Terbuka
            </button>

            <button
              onClick={() => onInjectTestAlarm(injectSiteId, 'NORMAL', 'TERTUTUP')}
              disabled={currentUser.role !== 'admin'}
              className="px-3.5 py-2.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 disabled:opacity-40 text-slate-700 hover:text-emerald-700 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <CheckCircle size={14} className="text-emerald-500" />
              Reset Site Normal (Cure)
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
