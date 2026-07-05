/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Eye, Wifi, WifiOff, ShieldCheck, Siren, Cpu, RefreshCw, Radio, Server, Zap, 
  Terminal, ShieldAlert, Search, ArrowUpDown, SlidersHorizontal, Copy
} from 'lucide-react';
import { Site, DeviceStatusLog } from '../types.ts';

interface DeviceStatusTabProps {
  sites: Site[];
  deviceLogs: DeviceStatusLog[];
  onInjectTestAlarm: (
    siteId: string, 
    grounding: string | null, 
    door: string | null,
    teg?: 'NORMAL' | 'TIDAK_NORMAL' | null,
    resetReason?: string | null,
    lastRestart?: string | null
  ) => void;
  onMuteSiren: (siteId: string, action: 'MUTE' | 'ON') => void;
}

export default function DeviceStatusTab({ sites, deviceLogs, onInjectTestAlarm, onMuteSiren }: DeviceStatusTabProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string>('BTS-001');

  // Datatable states
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [logSiteFilter, setLogSiteFilter] = useState<string>('SEMUA');
  const [logGroundingFilter, setLogGroundingFilter] = useState<string>('SEMUA');
  const [logDoorFilter, setLogDoorFilter] = useState<string>('SEMUA');
  const [logCurrentPage, setLogCurrentPage] = useState<number>(1);
  const [logItemsPerPage, setLogItemsPerPage] = useState<number>(10);
  const [logSortField, setLogSortField] = useState<keyof DeviceStatusLog>('timestamp');
  const [logSortOrder, setLogSortOrder] = useState<'asc' | 'desc'>('desc');

  const selectedSite = sites.find(s => s.siteId === selectedSiteId) || sites[0] || {
    siteId: '',
    siteName: 'Tidak Ada Data',
    location: '-',
    latitude: 0,
    longitude: 0,
    grounding: 'NORMAL',
    door: 'TERTUTUP',
    sirene: 'OFF',
    gsm: '3G',
    rssi: 0,
    status: 'OFFLINE',
    lastSeen: '',
    rectifier: 'NORMAL',
    battery: 'NORMAL',
    acPower: 'NORMAL',
    temperature: 0,
    isMuted: false
  };

  const getSignalStrengthQuality = (rssi: number) => {
    if (rssi >= -70) return { label: 'EXCELLENT', color: 'text-emerald-500', barCount: 4 };
    if (rssi >= -85) return { label: 'GOOD', color: 'text-blue-500', barCount: 3 };
    if (rssi >= -95) return { label: 'FAIR / WEAK', color: 'text-amber-500', barCount: 2 };
    return { label: 'POOR / DROPPING', color: 'text-red-500', barCount: 1 };
  };

  const getReadableTime = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleTimeString('id-ID') + ' ' + date.toLocaleDateString('id-ID');
    } catch (e) {
      return '';
    }
  };

  // Filter and search
  const filteredLogs = deviceLogs.filter(log => {
    // Search query matching Site ID or Site Name
    const sName = log.siteName || sites.find(s => s.siteId === log.siteId)?.siteName || '';
    const matchesSearch = 
      log.siteId.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      sName.toLowerCase().includes(logSearchQuery.toLowerCase());
    
    // Site filter
    const matchesSite = logSiteFilter === 'SEMUA' || log.siteId === logSiteFilter;

    // Grounding filter
    const matchesGrounding = logGroundingFilter === 'SEMUA' || log.grounding === logGroundingFilter;

    // Door filter
    const matchesDoor = logDoorFilter === 'SEMUA' || log.door === logDoorFilter;

    return matchesSearch && matchesSite && matchesGrounding && matchesDoor;
  });

  // Sort
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const valA = a[logSortField];
    const valB = b[logSortField];

    if (typeof valA === 'string' && typeof valB === 'string') {
      return logSortOrder === 'asc' 
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }
    
    if (typeof valA === 'number' && typeof valB === 'number') {
      return logSortOrder === 'asc' ? valA - valB : valB - valA;
    }

    return 0;
  });

  // Pagination
  const totalItems = sortedLogs.length;
  const totalPages = Math.ceil(totalItems / logItemsPerPage) || 1;
  const startIndex = (logCurrentPage - 1) * logItemsPerPage;
  const paginatedLogs = sortedLogs.slice(startIndex, startIndex + logItemsPerPage);

  const handleSort = (field: keyof DeviceStatusLog) => {
    if (logSortField === field) {
      setLogSortOrder(logSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setLogSortField(field);
      setLogSortOrder('asc');
    }
    setLogCurrentPage(1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header section */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Radio className="text-blue-500" />
            Device Status
          </h2>
        </div>

        <div className="flex gap-2 items-center">
          <span className="text-xs font-mono font-bold text-slate-400">PILIH SITE:</span>
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-1.5 font-mono focus:outline-none"
          >
            {sites.map(s => (
              <option key={s.siteId} value={s.siteId}>
                {s.siteId} - {s.siteName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* LEFT CARD - INFORMASI DEVICE ESP32 REAL / OTOMASIR (6 Columns) */}
        <div className="lg:col-span-6 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-5 tracking-tight uppercase font-mono flex items-center gap-2">
              <Cpu className="text-blue-500 w-4 h-4" />
              INFORMASI DEVICE IoT
            </h3>

            <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-sm">
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-slate-100">
                  {/* Row 1: Nama Site (ID) */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-3 text-xs font-semibold text-slate-400 font-mono">1</td>
                    <td className="py-2.5 px-3 text-xs font-bold text-slate-600">Nama Site (ID)</td>
                    <td className="py-2.5 px-3 text-xs text-right">
                      <span className="font-bold font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg text-[11px]">
                        {selectedSite.siteId || '-'}
                      </span>
                    </td>
                  </tr>

                  {/* Row 2: Site Name */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-3 text-xs font-semibold text-slate-400 font-mono">2</td>
                    <td className="py-2.5 px-3 text-xs font-bold text-slate-600">Site Name (Nama BTS)</td>
                    <td className="py-2.5 px-3 text-xs text-right font-bold text-slate-800 font-mono">
                      {selectedSite.siteName || '-'}
                    </td>
                  </tr>

                  {/* Row 3: Wifi Jaringan */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-3 text-xs font-semibold text-slate-400 font-mono">3</td>
                    <td className="py-2.5 px-3 text-xs font-bold text-slate-600">Wifi Jaringan</td>
                    <td className="py-2.5 px-3 text-xs text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold font-mono ${
                        selectedSite.status === 'ONLINE' 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-rose-500 text-white animate-pulse'
                      }`}>
                        {selectedSite.status === 'ONLINE' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {selectedSite.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </td>
                  </tr>

                  {/* Row 4: WiFi RSSI */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-3 text-xs font-semibold text-slate-400 font-mono">4</td>
                    <td className="py-2.5 px-3 text-xs font-bold text-slate-600">WiFi RSSI (Sinyal)</td>
                    <td className="py-2.5 px-3 text-xs text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-bold font-mono text-slate-800">
                          {selectedSite.rssi} dBm
                        </span>
                        <span className={`text-[9px] font-bold font-mono ${getSignalStrengthQuality(selectedSite.rssi).color}`}>
                          {getSignalStrengthQuality(selectedSite.rssi).label}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Row 5: Last Restart */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-3 text-xs font-semibold text-slate-400 font-mono">5</td>
                    <td className="py-2.5 px-3 text-xs font-bold text-slate-600">Last Restart</td>
                    <td className="py-2.5 px-3 text-xs text-right">
                      <span className="inline-block text-[11px] font-bold font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {selectedSite.lastRestart ? getReadableTime(selectedSite.lastRestart) : 'Belum Pernah'}
                      </span>
                    </td>
                  </tr>

                  {/* Row 6: Reset Reason */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-3 text-xs font-semibold text-slate-400 font-mono">6</td>
                    <td className="py-2.5 px-3 text-xs font-bold text-slate-600">Reset Reason</td>
                    <td className="py-2.5 px-3 text-xs text-right">
                      <span className="inline-block text-[11px] font-bold font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                        {selectedSite.resetReason || 'Power On'}
                      </span>
                    </td>
                  </tr>

                  {/* Row 7: Tegangan VCC */}
                  <tr className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-3 text-xs font-semibold text-slate-400 font-mono">7</td>
                    <td className="py-2.5 px-3 text-xs font-bold text-slate-600">Tegangan VCC (teg)</td>
                    <td className="py-2.5 px-3 text-xs text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-lg text-[11px] font-bold font-mono ${
                        selectedSite.teg === 'TIDAK_NORMAL' 
                          ? 'bg-rose-500 text-white animate-pulse' 
                          : 'bg-emerald-500 text-white'
                      }`}>
                        {selectedSite.teg === 'TIDAK_NORMAL' ? 'TIDAK NORMAL' : 'NORMAL'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT CARD - PENGUJIAN / CONTROL HARDWARE (6 Columns) */}
        <div className="lg:col-span-6 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-5 tracking-tight uppercase font-mono flex items-center gap-2">
              <SlidersHorizontal className="text-indigo-500 w-4 h-4" />
              SIMULASI HARDWARE
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Grounding switch */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase font-mono mt-0.5">Grounding Switch Loop</h4>
                </div>

                <div className="my-2">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono ${
                    selectedSite.grounding === 'PUTUS' 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : 'bg-emerald-500 text-white'
                  }`}>
                    {selectedSite.grounding === 'PUTUS' ? 'PUTUS' : 'SAMBUNG'}
                  </span>
                </div>

                <button
                  onClick={() => onInjectTestAlarm(selectedSite.siteId, selectedSite.grounding === 'PUTUS' ? 'NORMAL' : 'PUTUS', null)}
                  className={`w-full mt-2 py-1.5 rounded-xl text-[11px] font-semibold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    selectedSite.grounding === 'PUTUS'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  {selectedSite.grounding === 'PUTUS' ? 'Set SAMBUNG' : 'Set PUTUS'}
                </button>
              </div>

              {/* Door intrusion */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase font-mono mt-0.5">Door Magnetic switch</h4>
                </div>

                <div className="my-2">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono ${
                    selectedSite.door === 'TERBUKA' 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-emerald-500 text-white'
                  }`}>
                    {selectedSite.door === 'TERBUKA' ? 'TERBUKA' : 'TERTUTUP'}
                  </span>
                </div>

                <button
                  onClick={() => onInjectTestAlarm(selectedSite.siteId, null, selectedSite.door === 'TERBUKA' ? 'TERTUTUP' : 'TERBUKA')}
                  className={`w-full mt-2 py-1.5 rounded-xl text-[11px] font-semibold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    selectedSite.door === 'TERBUKA'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  {selectedSite.door === 'TERBUKA' ? 'Set TERTUTUP' : 'Set TERBUKA'}
                </button>
              </div>

              {/* Relay Sirene */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase font-mono mt-0.5">Sirine</h4>
                </div>

                <div className="my-2">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono ${
                    selectedSite.isMuted 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-emerald-500 text-white'
                  }`}>
                    {selectedSite.isMuted ? 'MUTE (SENYAP)' : 'AKTIF (SIAGA)'}
                  </span>
                </div>

                <button
                  onClick={() => onMuteSiren(selectedSite.siteId, selectedSite.isMuted ? 'ON' : 'MUTE')}
                  className={`w-full mt-2 py-1.5 rounded-xl text-[11px] font-semibold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    selectedSite.isMuted
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  {selectedSite.isMuted ? 'Set AKTIF' : 'Set MUTE'}
                </button>
              </div>

            </div>

            {/* Custom Interactive ESP32 Simulator Controls */}
            <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-150 space-y-3">              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 font-mono">SET RESET REASON:</label>
                  <select
                    value={selectedSite.resetReason || 'Power On'}
                    onChange={(e) => onInjectTestAlarm(selectedSite.siteId, null, null, null, e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-2 py-1.5 font-mono focus:outline-none cursor-pointer"
                  >
                    <option value="Power On">Power On</option>
                    <option value="Watchdog">Watchdog</option>
                    <option value="Software">Software</option>
                    <option value="Brownout">Brownout</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => {
                      const nowIso = new Date().toISOString();
                      onInjectTestAlarm(selectedSite.siteId, null, null, null, 'Software', nowIso);
                    }}
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 text-xs font-bold font-mono rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    REBOOT IoT
                  </button>
                </div>
              </div>
            </div>
          </div>

         <div className="mt-4 p-4 bg-[#F8FAFC] rounded-2xl border border-slate-200 text-xs flex items-center justify-center">
            <span className="font-bold text-slate-700 font-mono uppercase tracking-wider text-center">WAKTU DETAK TERAKHIR: {selectedSite.lastSeen ? getReadableTime(selectedSite.lastSeen) : 'BELUM ADA DATA'}</span>
          </div>
        </div>

      </div>

      {/* RECENT TELEMETRY SINKRONISASI LOGS TABLE */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase font-mono">LOG REALTIME</h3>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Cari Site ID / Nama..."
                value={logSearchQuery}
                onChange={(e) => {
                  setLogSearchQuery(e.target.value);
                  setLogCurrentPage(1);
                }}
                className="pl-7 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-44 font-mono text-slate-700"
              />
            </div>

            <select
              value={logSiteFilter}
              onChange={(e) => {
                setLogSiteFilter(e.target.value);
                setLogCurrentPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none font-mono"
            >
              <option value="SEMUA">🌐 Semua Site</option>
              {sites.map(s => (
                <option key={s.siteId} value={s.siteId}>{s.siteId}</option>
              ))}
            </select>

            <select
              value={logGroundingFilter}
              onChange={(e) => {
                setLogGroundingFilter(e.target.value);
                setLogCurrentPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none"
            >
              <option value="SEMUA">🔌 Semua Grounding</option>
              <option value="NORMAL">NORMAL</option>
              <option value="PUTUS">PUTUS</option>
            </select>

            <select
              value={logDoorFilter}
              onChange={(e) => {
                setLogDoorFilter(e.target.value);
                setLogCurrentPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none"
            >
              <option value="SEMUA">🚪 Semua Pintu</option>
              <option value="TERTUTUP">TERTUTUP</option>
              <option value="TERBUKA">TERBUKA</option>
            </select>

            <select
              value={logItemsPerPage}
              onChange={(e) => {
                setLogItemsPerPage(Number(e.target.value));
                setLogCurrentPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none"
            >
              <option value={5}>5 baris</option>
              <option value={10}>10 baris</option>
              <option value={20}>20 baris</option>
              <option value={50}>50 baris</option>
            </select>
          </div>
        </div>
        
        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-mono text-slate-500 uppercase font-bold">
                  <th onClick={() => handleSort('timestamp')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/50 select-none">
                    <div className="flex items-center gap-1.5">
                      <span>Waktu Telemetri</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('siteId')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/50 select-none">
                    <div className="flex items-center gap-1.5">
                      <span>Site ID</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('siteName')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/50 select-none">
                    <div className="flex items-center gap-1.5">
                      <span>Nama BTS</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('grounding')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/50 select-none">
                    <div className="flex items-center gap-1.5">
                      <span>Grounding</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('door')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/50 select-none">
                    <div className="flex items-center gap-1.5">
                      <span>Pintu</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('sirene')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/50 select-none">
                    <div className="flex items-center gap-1.5">
                      <span>Sirene</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('rssi')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/50 select-none">
                    <div className="flex items-center gap-1.5">
                      <span>RSSI</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('gsm')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/50 select-none">
                    <div className="flex items-center gap-1.5">
                      <span>GSM</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y text-[11px] font-mono text-slate-600">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans italic">
                      Tidak ada log telemetri yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log, index) => {
                    const isGroundingBroken = log.grounding === 'PUTUS';
                    const isDoorOpened = log.door === 'TERBUKA';
                    const assocSite = sites.find(s => s.siteId === log.siteId);
                    return (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-500 select-none">
                          {getReadableTime(log.timestamp)}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-800">
                          {log.siteId}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-800 font-sans">
                          {log.siteName || assocSite?.siteName || 'Unknown Site'}
                        </td>
                        <td className={`py-2 px-3 font-bold ${isGroundingBroken ? 'text-red-500 animate-pulse' : 'text-emerald-600'}`}>
                          {log.grounding}
                        </td>
                        <td className={`py-2 px-3 font-bold ${isDoorOpened ? 'text-amber-500' : 'text-emerald-600'}`}>
                          {log.door}
                        </td>
                        <td className="py-2 px-3 font-bold">
                          {log.sirene}
                        </td>
                        <td className="py-2 px-3 text-slate-800">
                          {log.rssi} dBm
                        </td>
                        <td className="py-2 px-3 text-indigo-600 font-bold uppercase">
                          {log.gsm}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-semibold text-slate-500 font-sans">
            <div>
              Menampilkan <strong className="text-slate-800">{totalItems === 0 ? 0 : startIndex + 1}</strong> - <strong className="text-slate-800">{Math.min(startIndex + logItemsPerPage, totalItems)}</strong> dari <strong className="text-slate-800">{totalItems}</strong> log realtime
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1 self-end sm:self-auto">
                <button
                  disabled={logCurrentPage === 1}
                  onClick={() => setLogCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer text-slate-700"
                >
                  Sebelumnya
                </button>
                
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const p = idx + 1;
                  // Only show current page, plus/minus 2 pages if there are many pages
                  if (totalPages > 6 && Math.abs(logCurrentPage - p) > 2 && p !== 1 && p !== totalPages) {
                    if (p === 2 || p === totalPages - 1) {
                      return <span key={p} className="px-1 text-slate-400">...</span>;
                    }
                    return null;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setLogCurrentPage(p)}
                      className={`w-7 h-7 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        logCurrentPage === p
                          ? 'bg-[#0F172A] text-white shadow-sm'
                          : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  disabled={logCurrentPage === totalPages}
                  onClick={() => setLogCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer text-slate-700"
                >
                  Berikutnya
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
