/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Smartphone, Search, ArrowUpDown, Filter, Edit, Save, X, Check,
  AlertCircle, ShieldCheck, HelpCircle, FileSpreadsheet, Copy, Calendar, Phone, Wifi
} from 'lucide-react';
import { Site } from '../types.ts';

interface SimCardTabProps {
  sites: Site[];
  onUpdateSite: (siteId: string, siteData: any) => Promise<boolean>;
  currentUser?: { role: string; displayName: string; isReadOnly?: boolean } | null;
}

export default function SimCardTab({ sites, onUpdateSite, currentUser }: SimCardTabProps) {
  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Sorting States
  const [sortField, setSortField] = useState<'siteId' | 'siteName' | 'phoneNo' | 'packageType' | 'daysLeft'>('siteId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  
  // Form Field States
  const [formPhoneNo, setFormPhoneNo] = useState('');
  const [formPackageType, setFormPackageType] = useState('');
  const [formRefillDate, setFormRefillDate] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formGsm, setFormGsm] = useState('');
  
  // Notification States
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin' && !currentUser?.isReadOnly;

  // Helper: Calculate remaining days
  const getDaysRemaining = (expiryDateStr?: string) => {
    if (!expiryDateStr) return null;
    const expiryDate = new Date(expiryDateStr);
    if (isNaN(expiryDate.getTime())) return null;
    
    const today = new Date();
    // set time to 00:00:00 to only compare dates
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);
    
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Helper: Get SIM Card Status Info
  const getStatusInfo = (expiryDateStr?: string) => {
    if (!expiryDateStr) {
      return { label: 'Belum Diatur', color: 'bg-slate-100 text-slate-600 border-slate-200', type: 'NONE' };
    }
    
    const days = getDaysRemaining(expiryDateStr);
    if (days === null) {
      return { label: 'Belum Diatur', color: 'bg-slate-100 text-slate-600 border-slate-200', type: 'NONE' };
    }
    
    if (days <= 0) {
      return { label: 'Expired', color: 'bg-rose-50 text-rose-700 border-rose-100', type: 'EXPIRED' };
    } else if (days <= 15) {
      return { label: 'Masa Tenggang', color: 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse', type: 'TENGGANG' };
    } else {
      return { label: 'Aktif', color: 'bg-emerald-50 text-emerald-800 border-emerald-100', type: 'ACTIVE' };
    }
  };

  // Helper: Format Date beautifully
  const formatDateString = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return '-';
    }
  };

  // Extract unique GSM operators for filters
  const uniqueOperators = Array.from(new Set(sites.map(s => s.gsm || 'TELKOMSEL'))).filter(Boolean).sort();

  // Search, Filter and Process Sites
  const processedSites = sites.map(site => {
    const daysLeft = getDaysRemaining(site.packageExpiryDate);
    const statusObj = getStatusInfo(site.packageExpiryDate);
    return {
      ...site,
      daysLeft,
      statusType: statusObj.type,
      statusLabel: statusObj.label,
      statusColor: statusObj.color
    };
  });

  const filteredSites = processedSites.filter(site => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      site.siteId.toLowerCase().includes(searchLower) ||
      site.siteName.toLowerCase().includes(searchLower) ||
      (site.phoneNo || '').toLowerCase().includes(searchLower) ||
      (site.packageType || '').toLowerCase().includes(searchLower);

    const matchesOperator = operatorFilter === 'ALL' || (site.gsm || 'TELKOMSEL').toUpperCase() === operatorFilter.toUpperCase();
    const matchesStatus = statusFilter === 'ALL' || site.statusType === statusFilter;

    return matchesSearch && matchesOperator && matchesStatus;
  });

  // Sorting Logic
  const sortedSites = [...filteredSites].sort((a, b) => {
    let valA: any = a[sortField] || '';
    let valB: any = b[sortField] || '';

    if (sortField === 'daysLeft') {
      const daysA = a.daysLeft === null ? 999999 : a.daysLeft;
      const daysB = b.daysLeft === null ? 999999 : b.daysLeft;
      return sortDirection === 'asc' ? daysA - daysB : daysB - daysA;
    }

    valA = valA.toString().toLowerCase();
    valB = valB.toString().toLowerCase();

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination Logic
  const totalRows = sortedSites.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * rowsPerPage;
  const paginatedSites = sortedSites.slice(startIndex, startIndex + rowsPerPage);

  const toggleSort = (field: 'siteId' | 'siteName' | 'phoneNo' | 'packageType' | 'daysLeft') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Reset pagination if search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, operatorFilter, statusFilter, rowsPerPage]);

  // Open Edit Modal
  const handleOpenEdit = (site: Site) => {
    setEditingSite(site);
    setFormPhoneNo(site.phoneNo || '');
    setFormPackageType(site.packageType || '');
    setFormRefillDate(site.packageRefillDate ? site.packageRefillDate.substring(0, 10) : '');
    setFormExpiryDate(site.packageExpiryDate ? site.packageExpiryDate.substring(0, 10) : '');
    setFormGsm(site.gsm || 'TELKOMSEL');
    setSuccessMessage(null);
    setErrorMessage(null);
    setIsEditModalOpen(true);
  };

  // Submit Edit Handler
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite) return;

    try {
      const updatedData = {
        phoneNo: formPhoneNo.trim(),
        packageType: formPackageType.trim(),
        packageRefillDate: formRefillDate ? new Date(formRefillDate).toISOString() : '',
        packageExpiryDate: formExpiryDate ? new Date(formExpiryDate).toISOString() : '',
        gsm: formGsm.toUpperCase()
      };

      const success = await onUpdateSite(editingSite.siteId, updatedData);
      if (success) {
        setSuccessMessage('Data kartu SIM berhasil diperbarui ke database!');
        setTimeout(() => {
          setIsEditModalOpen(false);
          setEditingSite(null);
        }, 1200);
      } else {
        setErrorMessage('Gagal menyimpan data kartu SIM. Periksa koneksi Anda.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem.');
    }
  };

  // CSV Exporter
  const handleExportCSV = () => {
    const headers = ['Site ID', 'Nama Site', 'Operator GSM', 'No HP SIM', 'Tipe Paket', 'Tanggal Isi Ulang', 'Masa Berlaku', 'Sisa Hari', 'Status'];
    const rows = sortedSites.map(s => [
      s.siteId,
      s.siteName,
      s.gsm || 'TELKOMSEL',
      s.phoneNo || '-',
      s.packageType || '-',
      s.packageRefillDate ? s.packageRefillDate.substring(0, 10) : '-',
      s.packageExpiryDate ? s.packageExpiryDate.substring(0, 10) : '-',
      s.daysLeft !== null ? s.daysLeft : 'Belum Diatur',
      s.statusLabel
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SIM_Card_Masa_Berlaku_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy Logs to Clipboard
  const handleCopyToClipboard = () => {
    const textRows = sortedSites.map((s, idx) => {
      const daysStr = s.daysLeft !== null ? `${s.daysLeft} hari sisa` : 'Belum diatur';
      return `${idx + 1}. [${s.siteId}] Name: ${s.siteName} | Operator: ${s.gsm || 'TELKOMSEL'} | No HP: ${s.phoneNo || '-'} | Expired: ${s.packageExpiryDate ? s.packageExpiryDate.substring(0, 10) : '-'} (${daysStr})`;
    });
    
    const textContent = `MONITORING MASA BERLAKU KARTU SIM TOWERGUARD\nDiunduh pada: ${new Date().toLocaleString('id-ID')}\n\n` + textRows.join('\n');
    
    navigator.clipboard.writeText(textContent)
      .then(() => {
        setCopiedNotification(true);
        setTimeout(() => setCopiedNotification(false), 2000);
      })
      .catch(err => {
        console.error('Gagal menyalin teks: ', err);
      });
  };

  // Metrics Calculations
  const totalSIMCount = processedSites.length;
  const activeSIMCount = processedSites.filter(s => s.statusType === 'ACTIVE').length;
  const tenggangSIMCount = processedSites.filter(s => s.statusType === 'TENGGANG').length;
  const expiredSIMCount = processedSites.filter(s => s.statusType === 'EXPIRED').length;
  const unconfiguredSIMCount = processedSites.filter(s => s.statusType === 'NONE').length;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Bento Grid Header Summary Card Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">TOTAL SIM CARD</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-black text-slate-800">{totalSIMCount}</span>
            <span className="text-xs text-slate-400">Unit</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block font-mono">Seluruh Site Terdaftar</span>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold font-mono text-emerald-500 uppercase tracking-wider">SIM AKTIF</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-black text-emerald-600">{activeSIMCount}</span>
            <span className="text-xs text-emerald-500 font-bold">Safe</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block font-mono">Masa berlaku &gt; 15 hari</span>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold font-mono text-amber-500 uppercase tracking-wider">MASA TENGGANG</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-black text-amber-600">{tenggangSIMCount}</span>
            <span className="text-xs text-amber-500 font-bold animate-pulse">Warning</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block font-mono">Masa berlaku 1 - 15 hari</span>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold font-mono text-rose-500 uppercase tracking-wider">SIM EXPIRED</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-black text-rose-600">{expiredSIMCount}</span>
            <span className="text-xs text-rose-500 font-bold">Critical</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block font-mono">Masa berlaku habis (0 hari)</span>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">BELUM DIATUR</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-black text-slate-600">{unconfiguredSIMCount}</span>
            <span className="text-xs text-slate-400">Empty</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block font-mono">Data belum dinput</span>
        </div>
      </div>

      {/* Main Datatables Content Card */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6 flex flex-col">
        
        {/* Table Title Block with Utilities */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Smartphone size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 tracking-tight uppercase font-mono">MONITORING MASA BERLAKU KARTU</h2>
            </div>
          </div>

          {/* Copy and Export Utilities */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handleCopyToClipboard}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all relative cursor-pointer"
              title="Salin data monitoring ke clipboard"
            >
              <Copy size={13} />
              <span>Copy</span>
              {copiedNotification && (
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded shadow-lg animate-bounce font-medium whitespace-nowrap font-sans">
                  Tersalin!
                </span>
              )}
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title="Ekspor laporan kartu SIM ke CSV"
            >
              <FileSpreadsheet size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Search, Operators and Expiry Status Filters Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          
          {/* Search Input Box (6 columns) */}
          <div className="sm:col-span-5 relative">
            <label className="block text-[9px] font-bold font-mono text-slate-400 uppercase mb-1.5">Pencarian Cepat</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Cari Site ID, Nama, No HP, Paket..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 py-2.5 w-full bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold font-mono cursor-pointer"
                >
                  X
                </button>
              )}
            </div>
          </div>

          {/* Filter GSM Operator (3 columns) */}
          <div className="sm:col-span-3">
            <label className="block text-[9px] font-bold font-mono text-slate-400 uppercase mb-1.5">Operator GSM</label>
            <select
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-sans font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            >
              <option value="ALL">Semua Operator</option>
              <option value="TELKOMSEL">TELKOMSEL</option>
              <option value="INDOSAT">INDOSAT (ISAT)</option>
              <option value="XL">XL AXIATA</option>
              <option value="THREE">THREE (3)</option>
              <option value="SMARTFREN">SMARTFREN</option>
              {uniqueOperators.filter(op => !['TELKOMSEL', 'INDOSAT', 'XL', 'THREE', 'SMARTFREN', 'ISAT'].includes(op.toUpperCase())).map(op => (
                <option key={op} value={op.toUpperCase()}>{op.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Filter Status Expiry (2 columns) */}
          <div className="sm:col-span-2">
            <label className="block text-[9px] font-bold font-mono text-slate-400 uppercase mb-1.5">Status Masa Aktif</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-sans font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif (Aman)</option>
              <option value="TENGGANG">Tenggang (&lt;=15 Hari)</option>
              <option value="EXPIRED">Expired (Kritis)</option>
              <option value="NONE">Belum Diatur</option>
            </select>
          </div>

          {/* Pagination Rows Controller (2 columns) */}
          <div className="sm:col-span-2">
            <label className="block text-[9px] font-bold font-mono text-slate-400 uppercase mb-1.5">Tampilkan Baris</label>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm text-center"
            >
              <option value={5}>5 Baris</option>
              <option value={10}>10 Baris</option>
              <option value={20}>20 Baris</option>
              <option value={50}>50 Baris</option>
            </select>
          </div>

        </div>

        {/* Reset Filter Banner Info */}
        {(searchTerm || operatorFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <div className="flex items-center justify-between bg-indigo-50/50 px-4 py-2.5 rounded-2xl border border-indigo-100 text-xs text-indigo-800 font-medium">
            <span className="font-mono text-[11px]">
              🔍 Menampilkan <strong>{totalRows}</strong> hasil pencarian dari filter aktif.
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setOperatorFilter('ALL');
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
              className="text-xs text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        )}

        {/* Responsive SIM Card Table */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold font-mono uppercase text-slate-500 select-none">
                  <th 
                    onClick={() => toggleSort('siteId')}
                    className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors w-24"
                  >
                    <div className="flex items-center gap-1">
                      <span>Site ID</span>
                      <ArrowUpDown size={11} className={sortField === 'siteId' ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('siteName')}
                    className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Nama Site &amp; Operator</span>
                      <ArrowUpDown size={11} className={sortField === 'siteName' ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('phoneNo')}
                    className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>No HP SIM</span>
                      <ArrowUpDown size={11} className={sortField === 'phoneNo' ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('packageType')}
                    className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Tipe Paket &amp; Isi Ulang</span>
                      <ArrowUpDown size={11} className={sortField === 'packageType' ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('daysLeft')}
                    className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Masa Berlaku</span>
                      <ArrowUpDown size={11} className={sortField === 'daysLeft' ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  {isAdmin && <th className="py-3.5 px-4 text-center w-20">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedSites.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-mono bg-slate-50/20">
                      Tidak ada data SIM Card yang cocok dengan kriteria pencarian Anda.
                    </td>
                  </tr>
                ) : (
                  paginatedSites.map(site => (
                    <tr key={site.siteId} className="hover:bg-slate-50/50 transition-all">
                      
                      {/* Site ID Cell */}
                      <td className="py-3 px-4 font-bold font-mono text-slate-800">
                        {site.siteId}
                      </td>

                      {/* Site Name and GSM Network Cell */}
                      <td className="py-3 px-4">
                        <div className="font-sans font-semibold text-slate-800 leading-tight">{site.siteName}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Wifi size={10} className="text-slate-400" />
                          <span>GSM: <strong>{site.gsm || 'TELKOMSEL'}</strong></span>
                        </div>
                      </td>

                      {/* Phone No Cell */}
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {site.phoneNo ? (
                          <span className="flex items-center gap-1">
                            <Phone size={10} className="text-slate-400 shrink-0" />
                            <span>{site.phoneNo}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">Belum diset</span>
                        )}
                      </td>

                      {/* Package Type and Last Refill Date Cell */}
                      <td className="py-3 px-4">
                        <div className="font-sans font-medium text-slate-700">{site.packageType || <span className="text-slate-300 italic">Belum diset</span>}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Calendar size={10} className="text-slate-400" />
                          <span>Refill: {site.packageRefillDate ? formatDateString(site.packageRefillDate) : '-'}</span>
                        </div>
                      </td>

                      {/* Expiry Date and Countdown Cell */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-700 font-semibold">
                          {site.packageExpiryDate ? formatDateString(site.packageExpiryDate) : '-'}
                        </div>
                        {site.daysLeft !== null && (
                          <div className={`text-[10px] font-mono font-bold mt-0.5 ${
                            site.daysLeft <= 0 
                              ? 'text-rose-600' 
                              : site.daysLeft <= 15 
                              ? 'text-amber-600 animate-pulse' 
                              : 'text-emerald-600'
                          }`}>
                            {site.daysLeft <= 0 ? 'Expired' : `${site.daysLeft} hari lagi`}
                          </div>
                        )}
                      </td>

                      {/* Expiry Status Badge Cell */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase border ${site.statusColor}`}>
                          {site.statusLabel}
                        </span>
                      </td>

                      {/* Admin Edit Trigger Cell */}
                      {isAdmin && (
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenEdit(site)}
                            className="p-1.5 hover:bg-slate-100 hover:text-indigo-600 rounded-lg text-slate-500 transition-colors cursor-pointer"
                            title="Edit data SIM Card site ini"
                          >
                            <Edit size={14} />
                          </button>
                        </td>
                      )}

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Datatable Footer Pagination Indicators */}
        {totalRows > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <span className="text-[11px] text-slate-500 font-mono">
              Menampilkan <strong>{startIndex + 1}</strong> hingga{" "}
              <strong>{Math.min(startIndex + rowsPerPage, totalRows)}</strong> dari{" "}
              <strong>{totalRows}</strong> site SIM card
            </span>

            {/* Pagination navigators list */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 select-none">
                
                {/* Previous page button */}
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={activePage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 disabled:opacity-40 disabled:hover:border-slate-200 text-slate-600 bg-white cursor-pointer"
                >
                  Sebelumnya
                </button>

                {/* Page number buttons */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  const isCurrent = page === activePage;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                        isCurrent
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-400"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                {/* Next page button */}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={activePage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 disabled:opacity-40 disabled:hover:border-slate-200 text-slate-600 bg-white cursor-pointer"
                >
                  Berikutnya
                </button>

              </div>
            )}
          </div>
        )}

      </div>

      {/* Admin Dialog: Edit SIM Card Specifications Modal */}
      {isEditModalOpen && editingSite && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-fade-in select-none">
          <div className="bg-white rounded-3xl w-full max-w-md border border-slate-100 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="text-indigo-600" size={18} />
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-mono uppercase">EDIT DATA KARTU SIM</h3>
                  <span className="text-[10px] text-slate-400 font-mono">Site: {editingSite.siteId} - {editingSite.siteName}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingSite(null);
                }}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 overflow-y-auto">
              
              {/* Network GSM Operator (Read Only / Edit via Asset) */}
              <div>
                <label className="block text-[10px] font-bold font-mono text-slate-400 uppercase mb-1">Operator GSM Jaringan</label>
                <select
                  value={formGsm}
                  onChange={(e) => setFormGsm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-sans font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                >
                  <option value="TELKOMSEL">TELKOMSEL</option>
                  <option value="INDOSAT">INDOSAT (ISAT)</option>
                  <option value="XL">XL AXIATA</option>
                  <option value="THREE">THREE (3)</option>
                  <option value="SMARTFREN">SMARTFREN</option>
                </select>
              </div>

              {/* SIM Card Phone Number */}
              <div>
                <label className="block text-[10px] font-bold font-mono text-slate-400 uppercase mb-1">Nomor Telepon Kartu (No HP)</label>
                <input
                  type="text"
                  placeholder="Contoh: 081234567890"
                  value={formPhoneNo}
                  onChange={(e) => setFormPhoneNo(e.target.value.replace(/[^0-9]/g, ''))} // only digits allowed
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Subscription Package Type */}
              <div>
                <label className="block text-[10px] font-bold font-mono text-slate-400 uppercase mb-1">Tipe Paket &amp; Provider</label>
                <input
                  type="text"
                  placeholder="Contoh: M2M IoT Custom 10GB atau Halo Unlimited"
                  value={formPackageType}
                  onChange={(e) => setFormPackageType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-sans text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  required
                />
              </div>

              {/* Refill / Registration Date */}
              <div>
                <label className="block text-[10px] font-bold font-mono text-slate-400 uppercase mb-1 flex items-center gap-1">
                  <Calendar size={12} className="text-slate-400" />
                  Tanggal Pengisian Terakhir (Refill)
                </label>
                <input
                  type="date"
                  value={formRefillDate}
                  onChange={(e) => setFormRefillDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              {/* Expiry Date (Masa Berlaku Kartu) */}
              <div>
                <label className="block text-[10px] font-bold font-mono text-slate-400 uppercase mb-1 flex items-center gap-1">
                  <Calendar size={12} className="text-indigo-500" />
                  Tanggal Masa Berlaku Kartu (Masa Aktif)
                </label>
                <input
                  type="date"
                  value={formExpiryDate}
                  onChange={(e) => setFormExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-indigo-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  required
                />
              </div>

              {/* Status messages indicator block */}
              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-[11px] text-rose-800 font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form submit/cancel buttons actions */}
              <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingSite(null);
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-100 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                >
                  <Save size={14} />
                  <span>Simpan Perubahan</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
