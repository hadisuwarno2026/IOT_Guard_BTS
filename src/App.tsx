/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { User, Site, AlarmLog, DeviceStatusLog, AuditTrail, IntegrationConfig } from './types.ts';
import LoginForm from './components/LoginForm.tsx';
import Sidebar, { TabID } from './components/Sidebar.tsx';
import Header from './components/Header.tsx';
import MobileFooter from './components/MobileFooter.tsx';
import DashboardTab from './components/DashboardTab.tsx';
import TowerMonitoringTab from './components/TowerMonitoringTab.tsx';
import AssetTab from './components/AssetTab.tsx';
import AlarmTab from './components/AlarmTab.tsx';
import DeviceStatusTab from './components/DeviceStatusTab.tsx';
import SettingsTab from './components/SettingsTab.tsx';
import UserManagementTab from './components/UserManagementTab.tsx';
import SimCardTab from './components/SimCardTab.tsx';
import { Volume2, VolumeX, RefreshCw } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabID>('dashboard');
  
  // Real-time states synchronized from backend server
  const [sites, setSites] = useState<Site[]>([]);
  const [alarmLogs, setAlarmLogs] = useState<AlarmLog[]>([]);
  const [deviceLogs, setDeviceLogs] = useState<DeviceStatusLog[]>([]);
  const [auditTrails, setAuditTrails] = useState<AuditTrail[]>([]);
  const [integrationConfig, setIntegrationConfig] = useState<IntegrationConfig>({
    gasUrl: '',
    whatsappProvider: 'fonnte',
    whatsappToken: '',
    whatsappPhone: '',
    whatsappEnabled: false,
    muteDurationMin: 5,
    supabaseUrl: '',
    supabaseKey: '',
    supabaseEnabled: false
  });

  const [isAudioMuted, setIsAudioMuted] = useState(true); // default to muted on browser loading
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Audio synthesize oscillator references for industrial SCADA buzzer
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorIntervalRef = useRef<any>(null);

  // Load and sync database status from server with self-healing local storage restore
  const fetchSystemStatus = async (showLoadingDot = false) => {
    if (isSyncing) return;
    if (showLoadingDot) setIsSyncing(true);
    
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        
        const serverTs = data.lastUpdateTs || 0;
        const localTsStr = localStorage.getItem('tbig_last_update_ts');
        const localTs = localTsStr ? Number(localTsStr) : 0;
        
        let needsRestore = false;
        const isSupabaseEnabled = !!data.integrationConfig?.supabaseEnabled;
        
        if (!isSupabaseEnabled && localTs > serverTs) {
          needsRestore = true;
        }
        
        // CHECK IF SERVER STATE HAS BEEN RESET (COLD START) BUT LOCALSTORAGE HAS SAVED DATA
        const localConfigStr = localStorage.getItem('tbig_config');
        const localSitesStr = localStorage.getItem('tbig_sites');
        let restoreData: any = {};
        
        if (localConfigStr) {
          try {
            const localConfig = JSON.parse(localConfigStr);
            restoreData.integrationConfig = localConfig;
            
            // If the browser has Supabase enabled/configured, but the server currently does not (e.g. server reset), we MUST restore!
            if (!needsRestore && localConfig) {
              const hasClientSupabase = localConfig.supabaseEnabled || (localConfig.supabaseUrl && localConfig.supabaseKey);
              if (hasClientSupabase && !isSupabaseEnabled) {
                needsRestore = true;
                console.log('[App] Restoring Supabase configuration from localStorage because server was reset...');
              } else if (!data.integrationConfig?.gasUrl && localConfig.gasUrl) {
                needsRestore = true;
              } else if (!data.integrationConfig?.whatsappToken && localConfig.whatsappToken) {
                needsRestore = true;
              }
            }
          } catch (e) {}
        }
        
        if (localSitesStr) {
          try {
            const localSites = JSON.parse(localSitesStr);
            restoreData.sites = localSites;
            // If server has fewer sites or different sites than local storage
            if (!needsRestore && localSites && Array.isArray(localSites) && 
                (localSites.length > (data.sites || []).length || 
                (localSites.length > 0 && (data.sites || []).length === 5 && localSites[0]?.siteId !== (data.sites || [])[0]?.siteId))) {
              needsRestore = true;
            }
          } catch (e) {}
        }
        
        if (needsRestore) {
          console.log('[App] Vercel serverless cold-start detected. Restoring state from browser localStorage...');
          const localAlarms = localStorage.getItem('tbig_alarmLogs');
          if (localAlarms) {
            try { restoreData.alarmLogs = JSON.parse(localAlarms); } catch (e) {}
          }
          const localDeviceLogs = localStorage.getItem('tbig_deviceLogs');
          if (localDeviceLogs) {
            try { restoreData.deviceLogs = JSON.parse(localDeviceLogs); } catch (e) {}
          }
          const localAudit = localStorage.getItem('tbig_auditTrails');
          if (localAudit) {
            try { restoreData.auditTrails = JSON.parse(localAudit); } catch (e) {}
          }
          
          const restoreRes = await fetch('/api/restore-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(restoreData)
          });
          
          if (restoreRes.ok) {
            const restored = await restoreRes.json();
            setSites(restored.sites || []);
            setAlarmLogs(restored.alarmLogs || []);
            setDeviceLogs(restored.deviceLogs || []);
            setAuditTrails(restored.auditTrails || []);
            setIntegrationConfig(restored.integrationConfig || {});
            
            // Save again to make sure everything matches
            localStorage.setItem('tbig_sites', JSON.stringify(restored.sites || []));
            localStorage.setItem('tbig_config', JSON.stringify(restored.integrationConfig || {}));
            localStorage.setItem('tbig_last_update_ts', (restored.lastUpdateTs || Date.now()).toString());
            return;
          }
        }
        
        // Otherwise, accept server state as single source of truth and cache it locally
        setSites(data.sites || []);
        setAlarmLogs(data.alarmLogs || []);
        setDeviceLogs(data.deviceLogs || []);
        setAuditTrails(data.auditTrails || []);
        setIntegrationConfig(data.integrationConfig || {});
        
        localStorage.setItem('tbig_sites', JSON.stringify(data.sites || []));
        localStorage.setItem('tbig_alarmLogs', JSON.stringify(data.alarmLogs || []));
        localStorage.setItem('tbig_deviceLogs', JSON.stringify(data.deviceLogs || []));
        localStorage.setItem('tbig_auditTrails', JSON.stringify(data.auditTrails || []));
        localStorage.setItem('tbig_config', JSON.stringify(data.integrationConfig || {}));
        localStorage.setItem('tbig_last_update_ts', serverTs.toString());
      }
    } catch (err) {
      console.error('[App] Server status fetch failed:', err);
      
      // Fallback to localStorage if server is temporarily unreachable (offline mode)
      const cachedSites = localStorage.getItem('tbig_sites');
      const cachedConfig = localStorage.getItem('tbig_config');
      const cachedAlarms = localStorage.getItem('tbig_alarmLogs');
      const cachedDevice = localStorage.getItem('tbig_deviceLogs');
      const cachedAudit = localStorage.getItem('tbig_auditTrails');
      
      if (cachedSites) setSites(JSON.parse(cachedSites));
      if (cachedConfig) setIntegrationConfig(JSON.parse(cachedConfig));
      if (cachedAlarms) setAlarmLogs(JSON.parse(cachedAlarms));
      if (cachedDevice) setDeviceLogs(JSON.parse(cachedDevice));
      if (cachedAudit) setAuditTrails(JSON.parse(cachedAudit));
    } finally {
      if (showLoadingDot) setIsSyncing(false);
    }
  };

  // Mute Siren physical signal relay post
  const handleMuteSiren = async (siteId: string, action: 'MUTE' | 'ON' = 'MUTE') => {
    try {
      const res = await fetch('/api/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          action,
          username: currentUser?.displayName || 'Admin',
          sites,
          integrationConfig
        })
      });
      if (res.ok) {
        await fetchSystemStatus(false);
      }
    } catch (e) {
      console.error('[App] Failed to change siren state:', e);
    }
  };

  // Manual Alarm Trigger injector (Playground helper)
  const handleInjectTestAlarm = async (
    siteId: string,
    grounding: string | null,
    door: string | null,
    teg?: 'NORMAL' | 'TIDAK_NORMAL' | null,
    resetReason?: string | null,
    lastRestart?: string | null
  ) => {
    try {
      const nowTs = Date.now();
      localStorage.setItem('tbig_last_update_ts', nowTs.toString());

      const res = await fetch('/api/test-alarm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          groundingState: grounding,
          doorState: door,
          tegState: teg,
          resetReasonState: resetReason,
          lastRestartState: lastRestart,
          username: currentUser?.displayName || 'Admin',
          sites,
          integrationConfig,
          alarmLogs
        })
      });
      if (res.ok) {
        await fetchSystemStatus(false);
      }
    } catch (e) {
      console.error('[App] Alarm injector crash:', e);
    }
  };

  // Mass scale database reset
  const handleResetAll = async () => {
    try {
      const updatedSites = sites.map(s => ({
        ...s,
        grounding: 'NORMAL',
        door: 'TERTUTUP',
        sirene: 'OFF',
        status: 'ONLINE',
        lastSeen: new Date().toISOString()
      }));
      setSites(updatedSites);
      setAlarmLogs([]);
      localStorage.setItem('tbig_sites', JSON.stringify(updatedSites));
      localStorage.setItem('tbig_alarmLogs', JSON.stringify([]));
      const nowTs = Date.now();
      localStorage.setItem('tbig_last_update_ts', nowTs.toString());

      const res = await fetch('/api/reset-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser?.displayName || 'Admin',
          sites: updatedSites,
          integrationConfig
        })
      });
      if (res.ok) {
        await fetchSystemStatus(true);
      }
    } catch (e) {
      console.error('[App] Master reset failed:', e);
    }
  };

  // Mass scale log emptier
  const handleClearLogs = async () => {
    try {
      setAlarmLogs([]);
      setDeviceLogs([]);
      localStorage.setItem('tbig_alarmLogs', JSON.stringify([]));
      localStorage.setItem('tbig_deviceLogs', JSON.stringify([]));
      const nowTs = Date.now();
      localStorage.setItem('tbig_last_update_ts', nowTs.toString());

      const res = await fetch('/api/clear-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser?.displayName || 'Admin',
          sites,
          integrationConfig,
          alarmLogs: [],
          deviceLogs: []
        })
      });
      if (res.ok) {
        await fetchSystemStatus(true);
      }
    } catch (e) {
      console.error('[App] Clear log failed:', e);
    }
  };

  // Save Config update
  const handleSaveConfig = async (newConfig: IntegrationConfig) => {
    try {
      setIntegrationConfig(newConfig);
      localStorage.setItem('tbig_config', JSON.stringify(newConfig));
      const nowTs = Date.now();
      localStorage.setItem('tbig_last_update_ts', nowTs.toString());

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: newConfig,
          username: currentUser?.displayName || 'Admin',
          sites,
          integrationConfig: newConfig
        })
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrationConfig(data.config || newConfig);
        if (data.lastUpdateTs) {
          localStorage.setItem('tbig_last_update_ts', data.lastUpdateTs.toString());
        }
      }
    } catch (e) {
      console.error('[App] Update config failed:', e);
    }
  };

  // CRUD tower site data handlers
  const handleAddSite = async (siteData: any) => {
    try {
      const newSite = {
        ...siteData,
        siteId: siteData.siteId.toUpperCase(),
        location: siteData.location || 'Lokasi Baru, Indonesia',
        latitude: Number(siteData.latitude) || -6.914744,
        longitude: Number(siteData.longitude) || 107.609810,
        grounding: 'NORMAL',
        door: 'TERTUTUP',
        sirene: 'OFF',
        gsm: '4G',
        rssi: -75,
        status: 'ONLINE',
        lastSeen: new Date().toISOString(),
        rectifier: siteData.rectifier || 'NORMAL',
        battery: siteData.battery || 'NORMAL',
        acPower: siteData.acPower || 'NORMAL',
        temperature: Number(siteData.temperature) || 28
      };
      // To ensure stateless server starts from our currently loaded list of sites,
      // we pass our existing sites array, and then let the API push the newSite to it.
      const previousSites = [...sites];
      const updatedSites = [...sites, newSite];
      setSites(updatedSites);
      localStorage.setItem('tbig_sites', JSON.stringify(updatedSites));
      const nowTs = Date.now();
      localStorage.setItem('tbig_last_update_ts', nowTs.toString());

      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...siteData, 
          username: currentUser?.displayName || 'Admin',
          sites: previousSites,
          integrationConfig
        })
      });
      if (res.ok) {
        await fetchSystemStatus(true);
        return true;
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal menambahkan BTS baru.');
        return false;
      }
    } catch (e) {
      console.error('[App] Add site failed:', e);
      return false;
    }
  };

  const handleUpdateSite = async (siteId: string, siteData: any) => {
    try {
      const updatedSites = sites.map(s => {
        if (s.siteId.toUpperCase() === siteId.toUpperCase()) {
          return {
            ...s,
            ...siteData,
            latitude: siteData.latitude !== undefined ? Number(siteData.latitude) : s.latitude,
            longitude: siteData.longitude !== undefined ? Number(siteData.longitude) : s.longitude,
            temperature: siteData.temperature !== undefined ? Number(siteData.temperature) : s.temperature,
            rssi: siteData.rssi !== undefined ? Number(siteData.rssi) : s.rssi
          };
        }
        return s;
      });
      // To ensure stateless server starts from our currently loaded list of sites,
      // we pass our existing sites array, then let the API perform the update in-place.
      const previousSites = [...sites];
      setSites(updatedSites);
      localStorage.setItem('tbig_sites', JSON.stringify(updatedSites));
      const nowTs = Date.now();
      localStorage.setItem('tbig_last_update_ts', nowTs.toString());

      const res = await fetch(`/api/sites/${siteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...siteData, 
          username: currentUser?.displayName || 'Admin',
          sites: previousSites,
          integrationConfig
        })
      });
      if (res.ok) {
        await fetchSystemStatus(true);
        return true;
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal memperbarui data BTS.');
        return false;
      }
    } catch (e) {
      console.error('[App] Update site failed:', e);
      return false;
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    try {
      const updatedSites = sites.filter(s => s.siteId.toUpperCase() !== siteId.toUpperCase());
      const previousSites = [...sites];
      setSites(updatedSites);
      localStorage.setItem('tbig_sites', JSON.stringify(updatedSites));
      const nowTs = Date.now();
      localStorage.setItem('tbig_last_update_ts', nowTs.toString());

      const res = await fetch(`/api/sites/${siteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: currentUser?.displayName || 'Admin',
          sites: previousSites,
          integrationConfig
        })
      });
      if (res.ok) {
        await fetchSystemStatus(true);
        return true;
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal menghapus BTS.');
        return false;
      }
    } catch (e) {
      console.error('[App] Delete site failed:', e);
      return false;
    }
  };

  // Periodic Keep-alive Polling Hook (5 Seconds Auto-Refresh)
  useEffect(() => {
    fetchSystemStatus(true); // initial load
    
    let intervalId: any = null;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        fetchSystemStatus(false);
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh]);

  // Audio feedback synthesis control system
  useEffect(() => {
    // Check if there are any online, unmuted, blazing alarms
    const hasActiveUnmutedAlarms = sites.some(site => {
      const activeAlarm = site.grounding === 'PUTUS' || site.door === 'TERBUKA';
      const isOnline = site.status === 'ONLINE';
      return activeAlarm && isOnline && site.sirene === 'ON';
    });

    const isAlarmActiveSiren = hasActiveUnmutedAlarms && !isAudioMuted;

    if (isAlarmActiveSiren) {
      // Begin Oscillator beep sounds if not already running
      if (!audioCtxRef.current) {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContextClass();
          audioCtxRef.current = ctx;

          let toggleFreq = false;
          oscillatorIntervalRef.current = setInterval(() => {
            if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
              const osc = audioCtxRef.current.createOscillator();
              const gainNode = audioCtxRef.current.createGain();

              osc.type = 'sawtooth';
              // Oscillating SCADA frequency siren sounds between 600Hz and 900Hz
              osc.frequency.setValueAtTime(toggleFreq ? 900 : 600, audioCtxRef.current.currentTime);
              
              gainNode.gain.setValueAtTime(0.12, audioCtxRef.current.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.35);

              osc.connect(gainNode);
              gainNode.connect(audioCtxRef.current.destination);

              osc.start();
              osc.stop(audioCtxRef.current.currentTime + 0.4);

              toggleFreq = !toggleFreq;
            }
          }, 450);
        } catch (err) {
          console.warn('[Buzzer] Web Audio API context construct failed:', err);
        }
      }
    } else {
      // Discontinue sound sirens immediately
      if (oscillatorIntervalRef.current) {
        clearInterval(oscillatorIntervalRef.current);
        oscillatorIntervalRef.current = null;
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch (e) {}
        audioCtxRef.current = null;
      }
    }

    return () => {
      if (oscillatorIntervalRef.current) {
        clearInterval(oscillatorIntervalRef.current);
      }
    };
  }, [sites, isAudioMuted]);

  // Logging custom Audit Trail triggers back-end proxy
  const handleLogout = async () => {
    try {
      await fetch('/api/audit-trail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: currentUser?.displayName || 'Admin',
          action: 'LOGOUT',
          details: 'User membersihkan sesi terminal & keluar.'
        })
      });
    } catch (e) {}
    setCurrentUser(null);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    // Log login audit trail
    fetch('/api/status').then(() => fetchSystemStatus(true));
  };

  // Guard activeTab based on user permissions
  useEffect(() => {
    if (currentUser) {
      const allowed = currentUser.permissions || [];
      if (allowed.length > 0 && !allowed.includes(activeTab)) {
        setActiveTab(allowed[0] as TabID);
      }
    }
  }, [currentUser, activeTab]);

  if (!currentUser) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-[#0F172A] overflow-hidden font-sans text-slate-200">
      
      {/* Sidebar Nav (Lateral panel) */}
      <Sidebar 
        activeTab={activeTab} 
        onChangeTab={setActiveTab} 
        onLogout={handleLogout} 
        sites={sites}
        alarmLogs={alarmLogs}
        currentUser={currentUser}
      />

      {/* Main Viewport Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Header navigation bar */}
        <Header 
          currentUser={currentUser} 
          onLogout={handleLogout}
          alarmLogs={alarmLogs}
        />

        {/* Content canvas viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 pb-20 md:pb-8 space-y-6 relative">
        
          {/* RENDERING PAGES STATE SHIFT */}
          {activeTab === 'dashboard' && (
            <DashboardTab 
              sites={sites} 
              alarmLogs={alarmLogs} 
              auditTrails={auditTrails}
              currentUser={currentUser}
              onMuteSiren={handleMuteSiren}
              onInjectTestAlarm={handleInjectTestAlarm}
              isAudioMuted={isAudioMuted}
              onToggleAudio={() => setIsAudioMuted(!isAudioMuted)}
              autoRefresh={autoRefresh}
              onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
            />
          )}

          {activeTab === 'monitoring' && (
            <TowerMonitoringTab 
              sites={sites} 
              onMuteSiren={handleMuteSiren}
              onAddSite={handleAddSite}
              onUpdateSite={handleUpdateSite}
              onDeleteSite={handleDeleteSite}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'asset' && (
            <AssetTab 
              sites={sites} 
              onMuteSiren={handleMuteSiren}
              onAddSite={handleAddSite}
              onUpdateSite={handleUpdateSite}
              onDeleteSite={handleDeleteSite}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'alarm' && (
            <AlarmTab 
              sites={sites} 
              alarmLogs={alarmLogs}
              currentUser={currentUser}
              onMuteSiren={handleMuteSiren}
              onInjectTestAlarm={handleInjectTestAlarm}
              onResetAll={handleResetAll}
              onClearLogs={handleClearLogs}
            />
          )}

          {activeTab === 'status' && (
            <DeviceStatusTab 
              sites={sites}
              deviceLogs={deviceLogs}
              onInjectTestAlarm={handleInjectTestAlarm}
              onMuteSiren={handleMuteSiren}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab 
              config={integrationConfig} 
              onSaveConfig={handleSaveConfig}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'users' && (
            <UserManagementTab 
              auditTrails={auditTrails} 
              currentUser={currentUser}
            />
          )}

          {activeTab === 'simcard' && (
            <SimCardTab 
              sites={sites}
              onUpdateSite={handleUpdateSite}
              currentUser={currentUser}
            />
          )}

        </main>
      </div>

      {/* Static Mobile Footer navigation */}
      <MobileFooter activeTab={activeTab} onChangeTab={setActiveTab} currentUser={currentUser} />

    </div>
  );
}
