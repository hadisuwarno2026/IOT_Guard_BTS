/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Eye, 
  ShieldCheck, 
  ClipboardList, 
  Search, 
  UserCheck, 
  Trash2, 
  Edit, 
  UserPlus, 
  X, 
  Check, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  SlidersHorizontal,
  ArrowUpDown,
  Filter,
  FileSpreadsheet,
  Copy
} from 'lucide-react';
import { AuditTrail, User } from '../types.ts';

const AVAILABLE_MENUS = [
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'alarm', label: 'Alarm' },
  { id: 'asset', label: 'Asset' },
  { id: 'simcard', label: 'SIM Card' },
  { id: 'status', label: 'Device' },
  { id: 'users', label: 'User' },
  { id: 'settings', label: 'Setting' }
];

interface UserManagementTabProps {
  auditTrails: AuditTrail[];
  currentUser: User;
}

export default function UserManagementTab({ auditTrails, currentUser }: UserManagementTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isFetchLoading, setIsFetchLoading] = useState(false);

  // DATATABLE STATES FOR AUDIT TRAILS
  const [sortField, setSortField] = useState<'timestamp' | 'user' | 'action' | 'details'>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterUser, setFilterUser] = useState<string>('ALL');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'audit'>('users');

  // Form states for Add User
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addDisplayName, setAddDisplayName] = useState('');
  const [addRole, setAddRole] = useState<'admin' | 'viewer'>('viewer');
  const [addPassword, setAddPassword] = useState('');
  const [addPermissions, setAddPermissions] = useState<string[]>([
    'dashboard', 'monitoring', 'asset', 'alarm', 'status', 'simcard'
  ]);
  const [addIsReadOnly, setAddIsReadOnly] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  // Form states for Edit User
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'viewer'>('viewer');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editIsReadOnly, setEditIsReadOnly] = useState(false);

  // Automatically adjust permissions checklist when role selection changes
  useEffect(() => {
    if (addRole === 'admin') {
      setAddPermissions(['dashboard', 'monitoring', 'asset', 'alarm', 'status', 'simcard', 'users', 'settings']);
    } else {
      setAddPermissions(['dashboard', 'monitoring', 'asset', 'alarm', 'status', 'simcard']);
    }
  }, [addRole]);

  useEffect(() => {
    if (editingUserId) {
      if (editRole === 'admin') {
        setEditPermissions(['dashboard', 'monitoring', 'asset', 'alarm', 'status', 'simcard', 'users', 'settings']);
      } else {
        setEditPermissions(prev => prev.filter(p => p !== 'users' && p !== 'settings'));
      }
    }
  }, [editRole, editingUserId]);

  const fetchUsers = () => {
    setIsFetchLoading(true);
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success' && data.users) {
          setUsersList(data.users);
        }
      })
      .catch(err => console.warn('[UserManagement] Failed to fetch users:', err))
      .finally(() => setIsFetchLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    if (!addUsername.trim() || !addDisplayName.trim() || !addPassword.trim()) {
      setFormError('Semua kolom formulir harus diisi!');
      return;
    }

    setIsSubmitLoading(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: addUsername.trim(),
          displayName: addDisplayName.trim(),
          role: addRole,
          password: addPassword,
          permissions: addPermissions,
          isReadOnly: addIsReadOnly,
          adminName: currentUser.displayName
        })
      });

      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setShowAddForm(false);
        setAddUsername('');
        setAddDisplayName('');
        setAddPassword('');
        setAddRole('viewer');
        setAddPermissions(['dashboard', 'monitoring', 'asset', 'alarm', 'status', 'simcard']);
        setAddIsReadOnly(false);
        fetchUsers();
      } else {
        setFormError(data.message || 'Gagal menambahkan operator baru.');
      }
    } catch (err) {
      setFormError('Gagal menghubungi server untuk mendaftarkan operator.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleEditSubmit = async (id: string) => {
    if (!editDisplayName.trim()) return;

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: editDisplayName.trim(),
          role: editRole,
          permissions: editPermissions,
          isReadOnly: editIsReadOnly,
          adminName: currentUser.displayName
        })
      });

      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setEditingUserId(null);
        fetchUsers();
      } else {
        alert(data.message || 'Gagal memperbarui profil operator.');
      }
    } catch (err) {
      alert('Gagal menghubungi server sistem.');
    }
  };

  const handleDeleteUser = async (id: string, displayName: string) => {
    if (id === currentUser.id) {
      alert('Anda tidak bisa menghapus akun Anda sendiri yang sedang aktif digunakan.');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus operator "${displayName}" dari database?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${id}?adminName=${encodeURIComponent(currentUser.displayName)}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (response.ok && data.status === 'success') {
        fetchUsers();
      } else {
        alert(data.message || 'Gagal menghapus operator.');
      }
    } catch (err) {
      alert('Gagal menghapus operator.');
    }
  };

  const startEditing = (user: any) => {
    setEditingUserId(user.id);
    setEditDisplayName(user.displayName);
    setEditRole(user.role === 'admin' ? 'admin' : 'viewer');
    setEditPermissions(user.permissions || []);
    setEditIsReadOnly(!!user.isReadOnly);
  };

  // 1. EXTRACT UNIQUE USERS & ACTIONS DYNAMICALLY
  const uniqueUsers = Array.from(new Set(auditTrails.map(t => t.user))).filter(Boolean).sort();
  const uniqueActions = Array.from(new Set(auditTrails.map(t => t.action))).filter(Boolean).sort();

  const getReadableTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID');
    } catch (e) {
      return '';
    }
  };

  // 2. SEARCH & FILTER LOGIC
  const filteredTrails = auditTrails.filter(trail => {
    const timeStr = getReadableTime(trail.timestamp).toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    
    const matchesSearch = 
      trail.user.toLowerCase().includes(searchLower) ||
      trail.action.toLowerCase().includes(searchLower) ||
      trail.details.toLowerCase().includes(searchLower) ||
      timeStr.includes(searchLower);

    let matchesUser = true;
    if (filterUser !== 'ALL') {
      if (filterUser === 'SYSTEM') {
        matchesUser = trail.user === 'SYSTEM';
      } else if (filterUser === 'ESP32') {
        matchesUser = trail.user === 'ESP32';
      } else if (filterUser === 'OPERATOR') {
        matchesUser = trail.user !== 'SYSTEM' && trail.user !== 'ESP32';
      } else {
        matchesUser = trail.user === filterUser;
      }
    }

    let matchesAction = true;
    if (filterAction !== 'ALL') {
      matchesAction = trail.action === filterAction;
    }

    return matchesSearch && matchesUser && matchesAction;
  });

  // 3. MULTI-COLUMN SORTING
  const sortedTrails = [...filteredTrails].sort((a, b) => {
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';

    if (sortField === 'timestamp') {
      const timeA = new Date(valA).getTime();
      const timeB = new Date(valB).getTime();
      return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
    }

    valA = valA.toString().toLowerCase();
    valB = valB.toString().toLowerCase();

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // 4. PAGINATION CALCULATIONS
  const totalRows = sortedTrails.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * rowsPerPage;
  const paginatedTrails = sortedTrails.slice(startIndex, startIndex + rowsPerPage);

  // 5. SORT TOGGLER
  const toggleSort = (field: 'timestamp' | 'user' | 'action' | 'details') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // 6. CSV EXPORT COMPILER
  const handleExportCSV = () => {
    const headers = ['ID', 'Waktu', 'Pengguna', 'Aksi', 'Keterangan/Detail'];
    const rows = sortedTrails.map(t => [
      t.id,
      getReadableTime(t.timestamp),
      t.user,
      t.action,
      t.details.replace(/"/g, '""')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Audit_Trail_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 7. CLIPBOARD COPIER
  const handleCopyToClipboard = () => {
    const textRows = sortedTrails.map((t, idx) => 
      `${idx + 1}. [${getReadableTime(t.timestamp)}] User: ${t.user} | Action: ${t.action} | Details: ${t.details}`
    );
    const textContent = `LAPORAN RIWAYAT AUDIT TOWERGUARD\nDiunduh pada: ${new Date().toLocaleString('id-ID')}\n\n` + textRows.join('\n');
    
    navigator.clipboard.writeText(textContent)
      .then(() => {
        setCopiedNotification(true);
        setTimeout(() => setCopiedNotification(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  // Reset pagination if search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterUser, filterAction, rowsPerPage]);

  const isCurrentUserAdmin = currentUser.role === 'admin' && !currentUser.isReadOnly;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header section */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <UserCheck className="text-emerald-500" />
            User Manajemen
          </h2>
        </div>

        {isCurrentUserAdmin && !showAddForm && activeSubTab === 'users' && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <UserPlus size={16} />
            User
          </button>
        )}
      </div>

      {/* SUB TABS NAVIGATION BAR */}
      <div className="bg-[#0b1329] px-6 pt-4 rounded-3xl border border-slate-900 shadow-lg print:hidden">
        <div className="flex border-b border-slate-800 gap-1 flex-wrap">
          <button
            onClick={() => setActiveSubTab('users')}
            className={`pb-3 px-4 text-xs font-semibold tracking-tight border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'users' 
                ? 'border-[#10b981] text-[#10b981] font-bold' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Daftar User
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`pb-3 px-4 text-xs font-semibold tracking-tight border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'audit' 
                ? 'border-[#10b981] text-[#10b981] font-bold' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Riwayat Aktivitas
          </button>
        </div>
      </div>

      {activeSubTab === 'users' && (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
          
          {/* Add User Form (Shown dynamically for Admin) */}
          {showAddForm && (
            <div className="border border-slate-200 bg-slate-50 rounded-2xl p-4 space-y-3 relative animate-slide-up text-slate-900 shadow-inner">
              <button 
                onClick={() => { setShowAddForm(false); setFormError(''); }}
                className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
              
              <h4 className="text-xs font-bold text-slate-900 tracking-tight uppercase font-mono flex items-center gap-1">
                <UserPlus className="text-emerald-600" size={14} />
                <span className="text-slate-900">Registrasi User</span>
              </h4>

              {formError && (
                <div className="p-2 bg-red-50 border border-red-150 rounded-lg text-[11px] text-red-600 flex items-center gap-1.5 font-mono">
                  <AlertCircle size={12} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleAddSubmit} className="space-y-3 text-xs text-slate-900">
                <div>
                  <label className="block text-[10px] font-mono text-slate-700 uppercase mb-1 font-bold">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={addDisplayName}
                    onChange={(e) => setAddDisplayName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-500 font-sans font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-700 uppercase mb-1 font-bold">Username / Email</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: budi atau budi@towerguard.com"
                    value={addUsername}
                    onChange={(e) => setAddUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-500 font-sans font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-700 uppercase mb-1 font-bold">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Minimal 6 karakter"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-500 font-sans font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-700 uppercase mb-1 font-bold">Role Akses</label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as 'admin' | 'viewer')}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-sans font-medium"
                  >
                    <option value="viewer" className="text-slate-900">User Regular</option>
                    <option value="admin" className="text-slate-900">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-700 uppercase mb-1.5 font-bold">Hak Akses Menu</label>
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    {AVAILABLE_MENUS.map((menu) => {
                      const checked = addPermissions.includes(menu.id);
                      return (
                        <label key={menu.id} className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900 transition-colors">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (checked) {
                                setAddPermissions(addPermissions.filter(p => p !== menu.id));
                              } else {
                                setAddPermissions([...addPermissions, menu.id]);
                              }
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className="font-sans font-semibold text-[11px] select-none">{menu.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <input
                    type="checkbox"
                    id="addIsReadOnly"
                    checked={addIsReadOnly}
                    onChange={(e) => setAddIsReadOnly(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <label htmlFor="addIsReadOnly" className="font-sans font-bold text-[10.5px] text-indigo-900 cursor-pointer select-none flex items-center gap-1">
                    Hanya Melihat (Tidak boleh edit)
                  </label>
                </div>

                <div className="flex gap-2 pt-1.5">
                  <button
                    type="submit"
                    disabled={isSubmitLoading}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg font-bold text-xs shadow-sm transition"
                  >
                    {isSubmitLoading ? 'Mendaftarkan...' : 'Simpan Operator'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddForm(false); setFormError(''); }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Shield className="text-indigo-500" size={16} />
              <h3 className="text-xs font-bold text-slate-800 tracking-tight uppercase font-mono">Daftar User</h3>
            </div>
            {isFetchLoading && <span className="text-[10px] font-mono text-slate-400 animate-pulse">Menghubungkan...</span>}
          </div>

          <div className="overflow-x-auto border border-slate-150 rounded-2xl shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150">
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider w-8 text-center">No</th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">Operator</th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">Username</th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">Role</th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {usersList.map((user, idx) => {
                  const isAdmin = user.role === 'admin';
                  const isCurrent = user.id === currentUser.id;
                  const isEditing = editingUserId === user.id;

                  return (
                    <tr 
                      key={user.id} 
                      className={`hover:bg-slate-50/40 transition-colors ${
                        isCurrent ? 'bg-emerald-50/10' : ''
                      }`}
                    >
                      {isEditing ? (
                        <td colSpan={5} className="p-3 bg-indigo-50/20">
                          <div className="space-y-3 text-xs text-slate-900">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[9px] font-mono text-slate-700 uppercase mb-1 font-bold">Nama Lengkap</label>
                                <input
                                  type="text"
                                  value={editDisplayName}
                                  onChange={(e) => setEditDisplayName(e.target.value)}
                                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-sans font-medium"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-mono text-slate-700 uppercase mb-1 font-bold">Role Akses</label>
                                <select
                                  value={editRole}
                                  onChange={(e) => setEditRole(e.target.value as 'admin' | 'viewer')}
                                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-sans font-medium text-xs"
                                >
                                  <option value="viewer" className="text-slate-900 font-sans font-medium">User Regular</option>
                                  <option value="admin" className="text-slate-900 font-sans font-medium">Administrator</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9px] font-mono text-slate-700 uppercase mb-1.5 font-bold">Hak Akses Menu</label>
                              <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px]">
                                {AVAILABLE_MENUS.map((menu) => {
                                  const checked = editPermissions.includes(menu.id);
                                  return (
                                    <label key={menu.id} className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          if (checked) {
                                            setEditPermissions(editPermissions.filter(p => p !== menu.id));
                                          } else {
                                            setEditPermissions([...editPermissions, menu.id]);
                                          }
                                        }}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3 cursor-pointer"
                                      />
                                      <span className="font-sans font-semibold text-[10px] select-none">{menu.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 p-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                              <input
                                type="checkbox"
                                id={`editIsReadOnly-${user.id}`}
                                checked={editIsReadOnly}
                                onChange={(e) => setEditIsReadOnly(e.target.checked)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3 cursor-pointer"
                              />
                              <label htmlFor={`editIsReadOnly-${user.id}`} className="font-sans font-bold text-[10px] text-indigo-900 cursor-pointer select-none">
                                Hanya Melihat (Tidak boleh edit)
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditSubmit(user.id)}
                                className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] cursor-pointer transition shadow-sm"
                              >
                                Simpan
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] cursor-pointer transition"
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-400 text-center">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 tracking-tight">{user.displayName}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[8px] font-bold font-mono">
                                  Aktif
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5" title="Aktivitas Terakhir">
                              Aktif: {user.lastActive || '-'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 font-medium">
                            {user.username}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase inline-block ${
                                isAdmin ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {user.role === 'admin' ? 'admin' : 'viewer'}
                              </span>
                              {user.isReadOnly && (
                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[8px] font-bold uppercase font-mono">
                                  Hanya Melihat
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5 max-w-[240px]">
                              {(user.permissions || []).map((pId: string) => {
                                const m = AVAILABLE_MENUS.find(menu => menu.id === pId);
                                if (!m) return null;
                                return (
                                  <span key={pId} className="px-1 py-0.2 bg-slate-100 text-slate-600 border border-slate-200/60 rounded text-[8px] font-semibold leading-tight font-sans tracking-tight">
                                    {m.label}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {isCurrentUserAdmin ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => startEditing(user)}
                                  title="Edit operator"
                                  className="p-1 hover:bg-slate-200 text-slate-500 hover:text-indigo-700 rounded transition cursor-pointer"
                                >
                                  <Edit size={12} />
                                </button>
                                {!isCurrent && (
                                  <button
                                    onClick={() => handleDeleteUser(user.id, user.displayName)}
                                    title="Hapus operator"
                                    className="p-1 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded transition cursor-pointer"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">-</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'audit' && (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6 flex flex-col">
          


          <div className="flex flex-col gap-4">
            {/* Header Title with Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="text-indigo-600" size={20} />
                <div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase font-mono">AUDIT TRAIL</h3>
                  <span className="text-[10px] text-slate-400 font-mono">Real-time database events and state log</span>
                </div>
              </div>

              {/* Export Utilities */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={handleCopyToClipboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all relative"
                  title="Salin semua data saat ini ke clipboard"
                >
                  <Copy size={13} />
                  <span>Copy</span>
                  {copiedNotification && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded shadow-lg animate-bounce font-sans font-medium whitespace-nowrap">
                      Tersalin!
                    </span>
                  )}
                </button>

                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-bold transition-all"
                  title="Unduh laporan audit trail berformat .csv"
                >
                  <FileSpreadsheet size={13} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Advanced Filters Toolbar Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              
              {/* Search input (6 cols on large, full on small) */}
              <div className="sm:col-span-4 relative">
                <label className="block text-[9px] font-bold font-mono text-slate-400 uppercase mb-1">Pencarian</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Cari kata kunci..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-8 py-2 w-full bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold font-mono"
                    >
                      X
                    </button>
                  )}
                </div>
              </div>

              {/* User filter */}
              <div className="sm:col-span-3">
                <label className="block text-[9px] font-bold font-mono text-slate-400 uppercase mb-1">Filter Pengguna</label>
                <select
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl text-xs font-sans font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">Semua Pengguna</option>
                  <option value="SYSTEM">SISTEM (Auto-Log)</option>
                  <option value="ESP32">ESP32 (Hardware)</option>
                  <option value="OPERATOR">Hanya Operator Manusia</option>
                  {uniqueUsers.filter(u => u !== 'SYSTEM' && u !== 'ESP32').map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Action filter */}
              <div className="sm:col-span-3">
                <label className="block text-[9px] font-bold font-mono text-slate-400 uppercase mb-1">Filter Jenis Aksi</label>
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl text-xs font-sans font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">Semua Aksi</option>
                  {uniqueActions.map(act => (
                    <option key={act} value={act}>{act}</option>
                  ))}
                </select>
              </div>

              {/* Page rows controller */}
              <div className="sm:col-span-2">
                <label className="block text-[9px] font-bold font-mono text-slate-400 uppercase mb-1">Baris / Hal</label>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

            </div>
          </div>

          {/* Active Filters Reset Indicator */}
          {(searchTerm || filterUser !== 'ALL' || filterAction !== 'ALL') && (
            <div className="flex items-center justify-between bg-indigo-50/50 px-4 py-2 rounded-xl border border-indigo-100 text-xs text-indigo-800 font-medium">
              <span className="font-mono text-[11px]">
                🔍 Menampilkan <strong>{totalRows}</strong> hasil dari filter aktif.
              </span>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterUser('ALL');
                  setFilterAction('ALL');
                  setCurrentPage(1);
                }}
                className="text-xs text-indigo-700 hover:text-indigo-900 font-bold underline"
              >
                Reset Filter
              </button>
            </div>
          )}

          {/* Interactive Responsive Table */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold font-mono uppercase text-slate-500 select-none">
                    
                    {/* Timestamp Header */}
                    <th 
                      onClick={() => toggleSort('timestamp')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Waktu &amp; Tanggal</span>
                        <ArrowUpDown size={11} className={sortField === 'timestamp' ? 'text-indigo-600 font-bold' : 'text-slate-400'} />
                      </div>
                    </th>

                    {/* User Header */}
                    <th 
                      onClick={() => toggleSort('user')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Pengguna</span>
                        <ArrowUpDown size={11} className={sortField === 'user' ? 'text-indigo-600 font-bold' : 'text-slate-400'} />
                      </div>
                    </th>

                    {/* Action Header */}
                    <th 
                      onClick={() => toggleSort('action')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Aksi</span>
                        <ArrowUpDown size={11} className={sortField === 'action' ? 'text-indigo-600 font-bold' : 'text-slate-400'} />
                      </div>
                    </th>

                    {/* Details Header */}
                    <th 
                      onClick={() => toggleSort('details')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Keterangan Kejadian</span>
                        <ArrowUpDown size={11} className={sortField === 'details' ? 'text-indigo-600 font-bold' : 'text-slate-400'} />
                      </div>
                    </th>

                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedTrails.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400 font-mono bg-slate-50/20">
                        Tidak ada catatan log audit trail yang cocok dengan kriteria filter Anda.
                      </td>
                    </tr>
                  ) : (
                    paginatedTrails.map((trail) => {
                      const isSystem = trail.user === 'SYSTEM';
                      const isESP = trail.user === 'ESP32';
                      return (
                        <tr key={trail.id} className="hover:bg-slate-50/70 font-mono text-[11px] transition-all">
                          {/* Timestamp cell */}
                          <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                            {getReadableTime(trail.timestamp)}
                          </td>
                          
                          {/* User badge cell */}
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] tracking-wide ${
                              isSystem 
                                ? 'bg-slate-100 text-slate-600' 
                                : isESP 
                                ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                            }`}>
                              {trail.user}
                            </span>
                          </td>
                          
                          {/* Action cell */}
                          <td className="py-2.5 px-4 font-bold text-slate-800 uppercase">
                            {trail.action}
                          </td>

                          {/* Description cell */}
                          <td className="py-2.5 px-4 text-slate-600 leading-relaxed max-w-sm font-sans font-medium">
                            {trail.details}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls Footer */}
          {totalRows > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-4 mt-auto">
              {/* Row info text */}
              <span className="text-[11px] text-slate-500 font-mono">
                Menampilkan <strong>{totalRows === 0 ? 0 : startIndex + 1}</strong> hingga{" "}
                <strong>{Math.min(startIndex + rowsPerPage, totalRows)}</strong> dari{" "}
                <strong>{totalRows}</strong> log audit trail
              </span>

              {/* Navigators list */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1 select-none">
                  
                  {/* First page button */}
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={activePage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 disabled:opacity-40 disabled:hover:border-slate-200 text-slate-600 bg-white cursor-pointer"
                    title="Halaman Pertama"
                  >
                    <ChevronsLeft size={14} />
                  </button>

                  {/* Previous page button */}
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={activePage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 disabled:opacity-40 disabled:hover:border-slate-200 text-slate-600 bg-white cursor-pointer"
                    title="Halaman Sebelumnya"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  {/* Visual Page Buttons */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      // Show current page, and +1 / -1 surroundings
                      return Math.abs(page - activePage) <= 1 || page === 1 || page === totalPages;
                    })
                    .map((page, index, array) => {
                      const isCurrent = page === activePage;
                      const hasGap = index > 0 && page - array[index - 1] > 1;

                      return (
                        <React.Fragment key={page}>
                          {hasGap && <span className="px-1 text-slate-400 font-mono">...</span>}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                              isCurrent
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-400"
                            }`}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  {/* Next page button */}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={activePage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 disabled:opacity-40 disabled:hover:border-slate-200 text-slate-600 bg-white cursor-pointer"
                    title="Halaman Berikutnya"
                  >
                    <ChevronRight size={14} />
                  </button>

                  {/* Last page button */}
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={activePage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 disabled:opacity-40 disabled:hover:border-slate-200 text-slate-600 bg-white cursor-pointer"
                    title="Halaman Terakhir"
                  >
                    <ChevronsRight size={14} />
                  </button>

                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
