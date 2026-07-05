/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, MapPin, AlertTriangle, ShieldCheck, HelpCircle, Search, 
  Wifi, Thermometer, Battery, Zap, ShieldAlert, Cpu, Siren, Volume2, VolumeX,
  Plus, Edit, Trash2, X, Save, Tv, Play, Pause, Minimize, ChevronLeft, ChevronRight, Clock,
  Columns
} from 'lucide-react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Site } from '../types.ts';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface TowerMonitoringTabProps {
  sites: Site[];
  onMuteSiren: (siteId: string, action: 'MUTE' | 'ON') => void;
  onAddSite: (site: any) => Promise<boolean>;
  onUpdateSite: (siteId: string, site: any) => Promise<boolean>;
  onDeleteSite: (siteId: string) => Promise<boolean>;
  currentUser?: { role: string; displayName: string };
}

export default function TowerMonitoringTab({ 
  sites, 
  onMuteSiren,
  onAddSite,
  onUpdateSite,
  onDeleteSite,
  currentUser 
}: TowerMonitoringTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>('BTS-001');

  // TV Mode state
  const [isTvMode, setIsTvMode] = useState(false);
  const [isTvPaused, setIsTvPaused] = useState(false);
  const [tvInterval, setTvInterval] = useState(10); // rotation interval in seconds
  const [tvProgress, setTvProgress] = useState(0); // rotation progress percentage (0 - 100)
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tvSidebarMode, setTvSidebarMode] = useState<'slim' | 'normal' | 'hidden'>('slim');

  // Clock effect for TV Mode
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Automatic Rotation Carousel Logic for TV Mode
  useEffect(() => {
    if (!isTvMode || isTvPaused) return;

    const alarmSites = sites.filter(s => s.grounding === 'PUTUS' || s.door === 'TERBUKA' || s.acPower === 'FAIL');
    if (alarmSites.length === 0) return;

    const intervalMs = 100;
    const step = (100 / (tvInterval * 1000)) * intervalMs;

    const timer = setInterval(() => {
      setTvProgress(prev => {
        if (prev >= 100) {
          // Go to next site in the alarmSites array
          setSelectedSiteId(currentId => {
            if (!currentId || alarmSites.length === 0) return alarmSites[0]?.siteId || null;
            const currentIndex = alarmSites.findIndex(s => s.siteId === currentId);
            const nextIndex = (currentIndex + 1) % alarmSites.length;
            return alarmSites[nextIndex]?.siteId || null;
          });
          return 0;
        }
        return prev + step;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isTvMode, isTvPaused, tvInterval, sites]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Helper: Calculate remaining days
  const getDaysRemaining = (expiryDateStr?: string) => {
    if (!expiryDateStr) return null;
    const expiryDate = new Date(expiryDateStr);
    if (isNaN(expiryDate.getTime())) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);
    
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  // Form Fields State
  const [siteId, setSiteId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState(-6.9);
  const [longitude, setLongitude] = useState(107.5);
  const [rectifier, setRectifier] = useState<'NORMAL' | 'FAULT'>('NORMAL');
  const [battery, setBattery] = useState<'NORMAL' | 'LOW' | 'FAULT'>('NORMAL');
  const [acPower, setAcPower] = useState<'NORMAL' | 'FAIL'>('NORMAL');
  const [temperature, setTemperature] = useState(25);
  const [gsm, setGsm] = useState('TELKOMSEL');
  const [rssi, setRssi] = useState(-65);
  const [status, setStatus] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [grounding, setGrounding] = useState<'NORMAL' | 'PUTUS'>('NORMAL');
  const [door, setDoor] = useState<'TERTUTUP' | 'TERBUKA'>('TERTUTUP');
  const [phoneNo, setPhoneNo] = useState('');
  const [packageType, setPackageType] = useState('');
  const [packageRefillDate, setPackageRefillDate] = useState('');
  const [packageExpiryDate, setPackageExpiryDate] = useState('');

  const openAddModal = () => {
    // Generate a new siteId based on current maximum or sequence
    const nextNum = sites.reduce((max, site) => {
      const match = site.siteId.match(/BTS-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        return num > max ? num : max;
      }
      return max;
    }, 0) + 1;
    const formattedId = `BTS-${nextNum.toString().padStart(3, '0')}`;
    
    setSiteId(formattedId);
    setSiteName(`BTS-NEW-${nextNum}`);
    setLocation('Bandung, Indonesia');
    setLatitude(-6.9 + (Math.random() - 0.5) * 0.2);
    setLongitude(107.5 + (Math.random() - 0.5) * 0.2);
    setRectifier('NORMAL');
    setBattery('NORMAL');
    setAcPower('NORMAL');
    setTemperature(26);
    setGsm('TELKOMSEL');
    setRssi(-65);
    setStatus('ONLINE');
    setGrounding('NORMAL');
    setDoor('TERTUTUP');
    setPhoneNo('');
    setPackageType('');
    setPackageRefillDate('');
    setPackageExpiryDate('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (site: Site) => {
    setSiteId(site.siteId);
    setSiteName(site.siteName);
    setLocation(site.location);
    setLatitude(site.latitude);
    setLongitude(site.longitude);
    setRectifier(site.rectifier);
    setBattery(site.battery);
    setAcPower(site.acPower);
    setTemperature(site.temperature);
    setGsm(site.gsm);
    setRssi(site.rssi);
    setStatus(site.status);
    setGrounding(site.grounding);
    setDoor(site.door);
    setPhoneNo(site.phoneNo || '');
    setPackageType(site.packageType || '');
    setPackageRefillDate(site.packageRefillDate || '');
    setPackageExpiryDate(site.packageExpiryDate || '');
    setIsEditModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onAddSite({
      siteId,
      siteName,
      location,
      latitude: Number(latitude),
      longitude: Number(longitude),
      rectifier,
      battery,
      acPower,
      temperature: Number(temperature),
      gsm,
      rssi: Number(rssi),
      status,
      grounding,
      door,
      phoneNo,
      packageType,
      packageRefillDate,
      packageExpiryDate
    });
    if (success) {
      setIsAddModalOpen(false);
      setSelectedSiteId(siteId);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onUpdateSite(siteId, {
      siteName,
      location,
      latitude: Number(latitude),
      longitude: Number(longitude),
      rectifier,
      battery,
      acPower,
      temperature: Number(temperature),
      gsm,
      rssi: Number(rssi),
      status,
      grounding,
      door,
      phoneNo,
      packageType,
      packageRefillDate,
      packageExpiryDate
    });
    if (success) {
      setIsEditModalOpen(false);
    }
  };

  const handleDeleteClick = async (targetId: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus site ${targetId}?`)) {
      const success = await onDeleteSite(targetId);
      if (success) {
        const remaining = sites.filter(s => s.siteId !== targetId);
        if (remaining.length > 0) {
          setSelectedSiteId(remaining[0].siteId);
        } else {
          setSelectedSiteId(null);
        }
      }
    }
  };

  const filteredSites = sites.filter(site => {
    return site.siteId.toLowerCase().includes(searchQuery.toLowerCase()) ||
           site.siteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           site.location.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const selectedSiteMap = sites.find(s => s.siteId === selectedSiteId) || sites[0] || {
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
    temperature: 0
  };

  const alarmSites = sites.filter(s => s.grounding === 'PUTUS' || s.door === 'TERBUKA' || s.acPower === 'FAIL');
  const activeTvSite = alarmSites.find(s => s.siteId === selectedSiteId) || alarmSites[0] || selectedSiteMap;

  // Helper colors based on status
  const getGroundingColor = (status: 'NORMAL' | 'PUTUS') => {
    return status === 'PUTUS' ? 'text-red-500 bg-red-50 border-red-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };

  const getDoorColor = (status: 'TERTUTUP' | 'TERBUKA') => {
    return status === 'TERBUKA' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };

  // Card Metrics Calculations
  const totalSites = sites.length;
  const alarmGroundCount = sites.filter(s => s.grounding === 'PUTUS').length;
  const alarmPintuCount = sites.filter(s => s.door === 'TERBUKA').length;
  const activeAlarmSitesCount = sites.filter(s => s.grounding === 'PUTUS' || s.door === 'TERBUKA').length;
  const clearAlarmSitesCount = sites.filter(s => s.grounding === 'NORMAL' && s.door === 'TERTUTUP').length;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Card 1: Alarm Ground */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold font-mono text-rose-500 uppercase tracking-wider">ALARM GROUND</span>
            <div className="p-1.5 bg-rose-50 text-rose-500 rounded-xl">
              <ShieldAlert size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-xl font-black text-slate-800">{alarmGroundCount}</span>
            <span className="text-xs text-rose-500 font-bold">Kabel</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block font-mono leading-tight">Grounding Putus</span>
        </div>

        {/* Card 2: Alarm Pintu */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold font-mono text-amber-500 uppercase tracking-wider">ALARM PINTU</span>
            <div className="p-1.5 bg-amber-50 text-amber-500 rounded-xl">
              <Siren size={16} className={alarmPintuCount > 0 ? "animate-bounce" : ""} />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-xl font-black text-slate-800">{alarmPintuCount}</span>
            <span className="text-xs text-amber-500 font-bold">Pintu</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block font-mono leading-tight">Shelter Terbuka</span>
        </div>

        {/* Card 3: Site Active Alarm */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold font-mono text-red-600 uppercase tracking-wider">SITE ACTIVE ALARM</span>
            <div className="p-1.5 bg-red-50 text-red-600 rounded-xl">
              <AlertTriangle size={16} className={activeAlarmSitesCount > 0 ? "animate-pulse" : ""} />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-xl font-black text-red-600">{activeAlarmSitesCount}</span>
            <span className="text-xs text-red-500 font-bold">Active</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block font-mono leading-tight">Total Site Bermasalah</span>
        </div>

        {/* Card 4: Site Clear Alarm */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold font-mono text-emerald-600 uppercase tracking-wider">SITE CLEAR ALARM</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-xl font-black text-emerald-600">{clearAlarmSitesCount}</span>
            <span className="text-xs text-emerald-500 font-bold">Clear</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block font-mono leading-tight">Kondisi Normal &amp; Aman</span>
        </div>

        {/* Card 5: Total Site */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold font-mono text-indigo-500 uppercase tracking-wider">TOTAL SITE</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-xl">
              <Radio size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-xl font-black text-slate-800">{totalSites}</span>
            <span className="text-xs text-slate-400">Site</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block font-mono leading-tight">Seluruh Tower Guard</span>
        </div>
      </div>
      
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase font-mono flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              Geographic Site Monitor
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                const alarmSites = sites.filter(s => s.grounding === 'PUTUS' || s.door === 'TERBUKA' || s.acPower === 'FAIL');
                const isCurrentSiteAlarm = selectedSiteId && alarmSites.some(s => s.siteId === selectedSiteId);
                if (!isCurrentSiteAlarm && alarmSites.length > 0) {
                  setSelectedSiteId(alarmSites[0].siteId);
                }
                setIsTvMode(true);
                setTvProgress(0);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold font-mono text-xs cursor-pointer shadow-sm transition-all border border-slate-800"
            >
              <Tv size={13} className="text-emerald-400 animate-pulse" />
              <span>MODE NOC</span>
            </button>
          </div>
        </div>

        {/* FULL WIDTH GEOGRAPHY CANVAS or REAL GOOGLE MAPS */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl h-[550px] relative overflow-hidden flex items-center justify-center">
          {hasValidKey ? (
            <APIProvider apiKey={API_KEY} version="weekly">
              <Map
                defaultCenter={{ lat: selectedSiteMap?.latitude || -6.914744, lng: selectedSiteMap?.longitude || 107.609810 }}
                defaultZoom={11}
                mapId="DEMO_MAP_ID"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                style={{ width: '100%', height: '100%' }}
              >
                {sites.map(site => {
                  const hasAlarm = site.grounding === 'PUTUS' || site.door === 'TERBUKA';
                  const isSelected = selectedSiteId === site.siteId;
                  
                  return (
                    <AdvancedMarker
                      key={site.siteId}
                      position={{ lat: Number(site.latitude || 0), lng: Number(site.longitude || 0) }}
                      onClick={() => {
                        setSelectedSiteId(site.siteId);
                        setIsDetailModalOpen(true);
                      }}
                    >
                      <div className="relative flex flex-col items-center">
                        {/* Pulsing halo for alarms */}
                        {site.status === 'ONLINE' && hasAlarm && (
                          <div className="absolute inset-0 rounded-full bg-red-500/30 scale-150 animate-ping pointer-events-none" />
                        )}
                        
                        {/* Tower Icon pin shape */}
                        <div 
                          className={`p-1.5 rounded-full border-2 shadow-md flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'scale-110 ring-4 ring-slate-400/30 bg-slate-800 text-white border-white' 
                              : site.status === 'OFFLINE'
                              ? 'bg-slate-100 border-slate-400 text-slate-500' 
                              : hasAlarm 
                              ? 'bg-red-500 border-white text-white' 
                              : 'bg-emerald-500 border-white text-white'
                          }`}
                          style={{ width: '32px', height: '32px' }}
                        >
                          <Radio size={16} className={hasAlarm ? "animate-pulse" : ""} />
                        </div>

                        {/* Tooltip text tag */}
                        <div className={`mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono shadow border ${
                          isSelected 
                            ? 'bg-[#0F172A] text-white border-slate-800' 
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}>
                          {site.siteId}
                        </div>
                      </div>
                    </AdvancedMarker>
                  );
                })}
              </Map>
            </APIProvider>
          ) : (
            <>
              <LeafletMap 
                sites={sites} 
                selectedSiteId={selectedSiteId} 
                onSelectSite={(siteId) => {
                  setSelectedSiteId(siteId);
                  setIsDetailModalOpen(true);
                }}
                selectedSiteMap={selectedSiteMap}
              />
              {/* Info banner to tell how to activate GMP */}
              <div className="absolute bottom-2 left-2 z-[1000] bg-slate-900/90 border border-slate-800 px-2 py-1 rounded text-[9px] font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Peta Interaktif Aktif. Klik penanda untuk membuka modal.</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* DETAILED SITE DATA & ALARM MODAL */}
      {isDetailModalOpen && selectedSiteMap && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl p-6 max-w-2xl w-full relative max-h-[90vh] overflow-y-auto animate-fade-in text-slate-800">
            {/* Close Button */}
            <button
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 bg-slate-50 rounded-full transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Header: ID, Name, and Status */}
            <div className="border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="text-emerald-500 animate-pulse" size={20} />
                <h3 className="text-lg font-bold text-slate-800 font-mono">{selectedSiteMap.siteId}</h3>
                <span className="text-sm text-slate-500 font-semibold">- {selectedSiteMap.siteName}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-slate-500">
                <span className={`inline-flex items-center gap-1 py-0.5 px-2.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                  selectedSiteMap.status === 'ONLINE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedSiteMap.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {selectedSiteMap.status}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={12} className="text-slate-400" />
                  {selectedSiteMap.location}
                </span>
              </div>
            </div>

            {/* Content Body */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Column 1: Data Site (Informasi Teknis) */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono border-b border-slate-100 pb-1">
                  SITE INFORMASI
                </h4>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-xs font-mono font-bold text-slate-400">SiteID :</span>
                    <span className="text-xs font-mono font-bold text-slate-800">{selectedSiteMap.siteId}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-xs font-mono font-bold text-slate-400">Site name :</span>
                    <span className="text-xs font-bold text-slate-800">{selectedSiteMap.siteName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-xs font-mono font-bold text-slate-400">longitude :</span>
                    <span className="text-xs font-mono font-bold text-slate-800">{selectedSiteMap.longitude}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-xs font-mono font-bold text-slate-400">latitude :</span>
                    <span className="text-xs font-mono font-bold text-slate-800">{selectedSiteMap.latitude}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-xs font-mono font-bold text-slate-400">Sim card :</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      (selectedSiteMap.packageExpiryDate && getDaysRemaining(selectedSiteMap.packageExpiryDate) !== null && getDaysRemaining(selectedSiteMap.packageExpiryDate)! > 0)
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {(selectedSiteMap.packageExpiryDate && getDaysRemaining(selectedSiteMap.packageExpiryDate) !== null && getDaysRemaining(selectedSiteMap.packageExpiryDate)! > 0)
                        ? 'AKTIF'
                        : 'NON AKTIF'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-xs font-mono font-bold text-slate-400">Masa berlaku :</span>
                    <span className="text-xs font-mono font-bold text-slate-800">
                      {selectedSiteMap.packageExpiryDate 
                        ? `${formatDateString(selectedSiteMap.packageExpiryDate)} ${
                            getDaysRemaining(selectedSiteMap.packageExpiryDate) !== null 
                              ? `(${getDaysRemaining(selectedSiteMap.packageExpiryDate)} hari sisa)` 
                              : ''
                          }`
                        : '-'
                      }
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="text-xs font-mono font-bold text-slate-400">Address :</span>
                    <span className="text-xs text-slate-700 leading-relaxed">{selectedSiteMap.location}</span>
                  </div>
                </div>
              </div>

              {/* Column 2: Status Alarm & Sensors */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono border-b border-slate-100 pb-1">
                  STATUS ALARM & SENSOR
                </h4>

                <div className="space-y-2.5">
                  {/* Grounding Sensor */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    selectedSiteMap.grounding === 'PUTUS'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border-emerald-100 text-emerald-800'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <ShieldAlert size={16} className={selectedSiteMap.grounding === 'PUTUS' ? 'text-rose-500 animate-bounce' : 'text-emerald-500'} />
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 block font-bold">GROUNDING BTS</span>
                        <span className="text-xs font-bold block mt-0.5">{selectedSiteMap.grounding === 'PUTUS' ? '⚠️ ALARM: PUTUS' : '🟢 NORMAL'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Door Switch Sensor */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    selectedSiteMap.door === 'TERBUKA'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-emerald-50 border-emerald-100 text-emerald-800'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <Siren size={16} className={selectedSiteMap.door === 'TERBUKA' ? 'text-amber-500 animate-pulse' : 'text-emerald-500'} />
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 block font-bold">PINTU SHELTER</span>
                        <span className="text-xs font-bold block mt-0.5">{selectedSiteMap.door === 'TERBUKA' ? '🚪 ALARM: TERBUKA' : '🔒 TERTUTUP'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sirene Controller directly below Pintu Shelter card inside Status Alarm & Sensor */}
                  {(selectedSiteMap.grounding === 'PUTUS' || selectedSiteMap.door === 'TERBUKA') && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 text-red-700">
                        <Siren size={18} className="animate-spin" />
                        <div>
                          <span className="text-[9px] uppercase font-bold font-mono tracking-wider text-red-500 block">KONTROL AUDIO SIRINE</span>
                          <span className="text-xs font-bold block leading-tight">{selectedSiteMap.isMuted ? 'Mute (Sirine Disenyapkan)' : 'Sirine Berbunyi Keras'}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {selectedSiteMap.isMuted ? (
                          <button
                            type="button"
                            onClick={() => onMuteSiren(selectedSiteMap.siteId, 'ON')}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Volume2 size={13} />
                            Nyalakan Sirine
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onMuteSiren(selectedSiteMap.siteId, 'MUTE')}
                            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <VolumeX size={13} />
                            Senyapkan Sirine
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2 justify-end items-center">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Tutup Detail
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ADD SITE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl p-6 max-w-lg w-full relative max-h-[90vh] overflow-y-auto animate-fade-in text-slate-800">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
            
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="text-emerald-600" />
              <span>Tambah BTS Baru</span>
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">SITE ID</label>
                  <input
                    type="text"
                    required
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-800"
                    placeholder="Contoh: BTS-004"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">NAMA SITE</label>
                  <input
                    type="text"
                    required
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 text-slate-800"
                    placeholder="Contoh: BTS CIMAHI"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">LOKASI ALAMAT</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 text-slate-800"
                    placeholder="Contoh: Cimahi, Jawa Barat"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">LATITUDE</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={latitude}
                    onChange={(e) => setLatitude(Number(e.target.value))}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">LONGITUDE</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={longitude}
                    onChange={(e) => setLongitude(Number(e.target.value))}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">SUHU INTERNAL (°C)</label>
                  <input
                    type="number"
                    required
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">GSM NETWORK & SIGNAL</label>
                  <input
                    type="text"
                    required
                    value={gsm}
                    onChange={(e) => setGsm(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">RECTIFIER</label>
                  <select
                    value={rectifier}
                    onChange={(e) => setRectifier(e.target.value as any)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none text-slate-800"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="FAULT">FAULT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">BATERAI BACKUP</label>
                  <select
                    value={battery}
                    onChange={(e) => setBattery(e.target.value as any)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none text-slate-800"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="LOW">LOW</option>
                    <option value="FAULT">FAULT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">LISTRIK PLN (AC POWER)</label>
                  <select
                    value={acPower}
                    onChange={(e) => setAcPower(e.target.value as any)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none text-slate-800"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="FAIL">FAIL (PADAM)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">STATUS SYSTEM</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-mono text-slate-800"
                  >
                    <option value="ONLINE">ONLINE</option>
                    <option value="OFFLINE">OFFLINE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">NOMOR HP</label>
                  <input
                    type="text"
                    value={phoneNo}
                    onChange={(e) => setPhoneNo(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-800"
                    placeholder="Contoh: 08123456789"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">ISI PAKET</label>
                  <input
                    type="text"
                    value={packageType}
                    onChange={(e) => setPackageType(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 text-slate-800"
                    placeholder="Contoh: Unlimited 50GB"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">TANGGAL ISI</label>
                  <input
                    type="date"
                    value={packageRefillDate}
                    onChange={(e) => setPackageRefillDate(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">TANGGAL EXPIRED</label>
                  <input
                    type="date"
                    value={packageExpiryDate}
                    onChange={(e) => setPackageExpiryDate(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus size={14} />
                  Tambah Site
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SITE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl p-6 max-w-lg w-full relative max-h-[90vh] overflow-y-auto animate-fade-in text-slate-800">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
            
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Edit className="text-emerald-600" size={18} />
              <span>Ubah Data BTS - {siteId}</span>
            </h3>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">SITE ID (TIDAK BISA DIUBAH)</label>
                  <input
                    type="text"
                    disabled
                    value={siteId}
                    className="block w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-400 font-mono cursor-not-allowed text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">NAMA SITE</label>
                  <input
                    type="text"
                    required
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 text-slate-800"
                    placeholder="Contoh: BTS CIMAHI"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">LOKASI ALAMAT</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 text-slate-800"
                    placeholder="Contoh: Cimahi, Jawa Barat"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">LATITUDE</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={latitude}
                    onChange={(e) => setLatitude(Number(e.target.value))}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">LONGITUDE</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={longitude}
                    onChange={(e) => setLongitude(Number(e.target.value))}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">SUHU INTERNAL (°C)</label>
                  <input
                    type="number"
                    required
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">GSM NETWORK & SIGNAL</label>
                  <input
                    type="text"
                    required
                    value={gsm}
                    onChange={(e) => setGsm(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">RECTIFIER</label>
                  <select
                    value={rectifier}
                    onChange={(e) => setRectifier(e.target.value as any)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none text-slate-800"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="FAULT">FAULT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">BATERAI BACKUP</label>
                  <select
                    value={battery}
                    onChange={(e) => setBattery(e.target.value as any)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none text-slate-800"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="LOW">LOW</option>
                    <option value="FAULT">FAULT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">LISTRIK PLN (AC POWER)</label>
                  <select
                    value={acPower}
                    onChange={(e) => setAcPower(e.target.value as any)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none text-slate-800"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="FAIL">FAIL (PADAM)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">STATUS SYSTEM</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-mono text-slate-800"
                  >
                    <option value="ONLINE">ONLINE</option>
                    <option value="OFFLINE">OFFLINE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">NOMOR HP</label>
                  <input
                    type="text"
                    value={phoneNo}
                    onChange={(e) => setPhoneNo(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-800"
                    placeholder="Contoh: 08123456789"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">ISI PAKET</label>
                  <input
                    type="text"
                    value={packageType}
                    onChange={(e) => setPackageType(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 text-slate-800"
                    placeholder="Contoh: Unlimited 50GB"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">TANGGAL ISI</label>
                  <input
                    type="date"
                    value={packageRefillDate}
                    onChange={(e) => setPackageRefillDate(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">TANGGAL EXPIRED</label>
                  <input
                    type="date"
                    value={packageExpiryDate}
                    onChange={(e) => setPackageExpiryDate(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Save size={14} />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TV MODE OVERLAY PANEL */}
      {isTvMode && (
        <div className="fixed inset-0 z-[99999] bg-[#070A12] text-slate-100 flex flex-col h-screen w-screen overflow-hidden animate-fade-in select-none">
          {/* TOP BAR */}
          <div className="bg-[#0D111A] border-b border-slate-800 px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4 z-10 shadow-xl shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <Tv size={18} className="text-emerald-400 animate-pulse" />
              </div>
              <div>
                <h2 className="text-sm font-black tracking-wider uppercase font-mono text-white flex items-center gap-2">
                  NOC COMMAND MONITORING
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500 text-slate-950 animate-pulse">
                    TV MODE ACTIVE
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Sistem Pemantauan Terpusat Real-time BTS SCADA</p>
              </div>
            </div>

            {/* QUICK STATUS TICKER */}
            <div className="hidden lg:flex items-center gap-4 font-mono text-[10px] bg-slate-950/40 border border-slate-800/50 px-4 py-1.5 rounded-xl">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-400">NORMAL:</span>
                <span className="font-bold text-emerald-400">{sites.filter(s => s.status === 'ONLINE' && s.grounding !== 'PUTUS' && s.door !== 'TERBUKA').length}</span>
              </div>
              <div className="w-px h-3 bg-slate-800" />
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-slate-400">ALARM:</span>
                <span className="font-bold text-red-400">{sites.filter(s => s.status === 'ONLINE' && (s.grounding === 'PUTUS' || s.door === 'TERBUKA')).length}</span>
              </div>
              <div className="w-px h-3 bg-slate-800" />
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="text-slate-400">OFFLINE:</span>
                <span className="font-bold text-slate-400">{sites.filter(s => s.status === 'OFFLINE').length}</span>
              </div>
            </div>

            {/* TIME & ROTATION PLAYER CONTROLS */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Clock */}
              <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/80 px-3 py-1.5 rounded-xl font-mono text-xs">
                <Clock size={13} className="text-emerald-400" />
                <span className="text-slate-200 font-bold">{currentTime.toLocaleTimeString('id-ID')}</span>
                <span className="text-slate-500 text-[10px]">WIB</span>
              </div>

              {/* Carousel controls */}
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    const alarmSites = sites.filter(s => s.grounding === 'PUTUS' || s.door === 'TERBUKA' || s.acPower === 'FAIL');
                    if (alarmSites.length === 0) return;
                    setSelectedSiteId(currentId => {
                      if (!currentId) return alarmSites[0].siteId;
                      const index = alarmSites.findIndex(s => s.siteId === currentId);
                      const prevIndex = index <= 0 ? alarmSites.length - 1 : index - 1;
                      return alarmSites[prevIndex].siteId;
                    });
                    setTvProgress(0);
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  title="Situs Sebelumnya"
                >
                  <ChevronLeft size={14} />
                </button>
                
                <button
                  type="button"
                  onClick={() => setIsTvPaused(!isTvPaused)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-mono text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                >
                  {isTvPaused ? (
                    <>
                      <Play size={10} className="fill-white text-white animate-pulse" />
                      <span>PLAY</span>
                    </>
                  ) : (
                    <>
                      <Pause size={10} className="fill-white text-white" />
                      <span>PAUSE</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const alarmSites = sites.filter(s => s.grounding === 'PUTUS' || s.door === 'TERBUKA' || s.acPower === 'FAIL');
                    if (alarmSites.length === 0) return;
                    setSelectedSiteId(currentId => {
                      if (!currentId) return alarmSites[0].siteId;
                      const index = alarmSites.findIndex(s => s.siteId === currentId);
                      const nextIndex = (index + 1) % alarmSites.length;
                      return alarmSites[nextIndex].siteId;
                    });
                    setTvProgress(0);
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  title="Situs Selanjutnya"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Speed dropdown */}
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-slate-400 hidden sm:inline text-[10px]">ROTASI:</span>
                <select
                  value={tvInterval}
                  onChange={(e) => {
                    setTvInterval(Number(e.target.value));
                    setTvProgress(0);
                  }}
                  className="bg-slate-900 border border-slate-800 text-slate-200 px-2 py-1.5 rounded-xl text-[10px] focus:outline-none"
                >
                  <option value={5}>5 DETIK</option>
                  <option value={10}>10 DETIK</option>
                  <option value={20}>20 DETIK</option>
                  <option value={30}>30 DETIK</option>
                </select>
              </div>

              {/* Sidebar Mode Selector */}
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-slate-400 hidden sm:inline text-[10px]">SIDEBAR:</span>
                <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTvSidebarMode('slim')}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      tvSidebarMode === 'slim'
                        ? 'bg-emerald-600 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                    title="Sidebar Ramping (Slim)"
                  >
                    RAMPING
                  </button>
                  <button
                    type="button"
                    onClick={() => setTvSidebarMode('normal')}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      tvSidebarMode === 'normal'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                    title="Sidebar Normal"
                  >
                    NORMAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setTvSidebarMode('hidden')}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      tvSidebarMode === 'hidden'
                        ? 'bg-red-600 text-white shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                    title="Sembunyikan Sidebar"
                  >
                    HIDDEN
                  </button>
                </div>
              </div>

              {/* Exit Button */}
              <button
                type="button"
                onClick={() => setIsTvMode(false)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold font-mono text-xs cursor-pointer shadow-md transition-colors"
              >
                <Minimize size={14} />
                <span>EXIT NOC</span>
              </button>
            </div>
          </div>

          {/* ROTATION PROGRESS BAR */}
          {!isTvPaused && alarmSites.length > 0 && (
            <div className="w-full h-[3px] bg-slate-950 overflow-hidden shrink-0">
              <div 
                className="h-full bg-emerald-500 transition-all duration-100 ease-linear shadow-[0_0_8px_#10B981]" 
                style={{ width: `${tvProgress}%` }}
              />
            </div>
          )}

          {/* TV BODY GRID */}
          {alarmSites.length > 0 ? (
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
              {/* Left panel: Dark styled map */}
              <div className="flex-1 h-1/2 lg:h-full relative overflow-hidden bg-[#070A13]">
                {hasValidKey ? (
                  <APIProvider apiKey={API_KEY} version="weekly">
                    <Map
                      center={tvSidebarMode === 'hidden' ? { lat: -2.5, lng: 118.0 } : { lat: Number(activeTvSite?.latitude || -6.914744), lng: Number(activeTvSite?.longitude || 107.609810) }}
                      zoom={tvSidebarMode === 'hidden' ? 5 : 11}
                      mapId="DEMO_MAP_ID"
                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                      style={{ width: '100%', height: '100%' }}
                    >
                      {alarmSites.map(site => {
                        const hasAlarm = site.grounding === 'PUTUS' || site.door === 'TERBUKA' || site.acPower === 'FAIL';
                        const isSelected = selectedSiteId === site.siteId;
                        
                        return (
                          <AdvancedMarker
                            key={site.siteId}
                            position={{ lat: Number(site.latitude || 0), lng: Number(site.longitude || 0) }}
                            onClick={() => {
                              setSelectedSiteId(site.siteId);
                              setTvProgress(0);
                            }}
                          >
                            <div className="relative flex flex-col items-center">
                              {site.status === 'ONLINE' && hasAlarm && (
                                <div className="absolute inset-0 rounded-full bg-red-500/30 scale-150 animate-ping pointer-events-none" />
                              )}
                              
                              <div 
                                className={`p-1.5 rounded-full border-2 shadow-md flex items-center justify-center transition-all ${
                                  isSelected 
                                    ? 'scale-125 ring-4 ring-emerald-500/40 bg-slate-950 text-white border-emerald-400' 
                                    : site.status === 'OFFLINE'
                                    ? 'bg-slate-800 border-slate-600 text-slate-500' 
                                    : hasAlarm 
                                    ? 'bg-red-500 border-white text-white' 
                                    : 'bg-emerald-500 border-white text-white'
                                }`}
                                style={{ width: '36px', height: '36px' }}
                              >
                                <Radio size={18} className={hasAlarm ? "animate-pulse" : ""} />
                              </div>

                              <div className={`mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono shadow border ${
                                isSelected 
                                  ? 'bg-[#10B981] text-slate-950 border-emerald-300' 
                                  : 'bg-slate-900 text-slate-300 border-slate-800'
                              }`}>
                                {site.siteId}
                              </div>
                            </div>
                          </AdvancedMarker>
                        );
                      })}
                    </Map>
                  </APIProvider>
                ) : (
                  <LeafletMap 
                    sites={alarmSites} 
                    selectedSiteId={selectedSiteId} 
                    onSelectSite={(siteId) => {
                      setSelectedSiteId(siteId);
                      setTvProgress(0);
                    }}
                    selectedSiteMap={activeTvSite}
                    isTvMode={true}
                    tvSidebarMode={tvSidebarMode}
                  />
                )}

                {/* Floating button to restore sidebar when hidden */}
                {tvSidebarMode === 'hidden' && (
                  <button
                    type="button"
                    onClick={() => setTvSidebarMode('slim')}
                    className="absolute top-4 right-4 z-[9999] flex items-center gap-1.5 px-3 py-2 bg-slate-900/90 border border-slate-700 text-emerald-400 hover:text-emerald-300 rounded-xl text-[10px] font-bold font-mono shadow-2xl hover:scale-105 transition-all cursor-pointer"
                  >
                    <Columns size={12} className="animate-pulse" />
                    <span>TAMPILKAN SIDEBAR</span>
                  </button>
                )}
              </div>

              {/* Right panel: Telemetry Information */}
              {tvSidebarMode !== 'hidden' && (
                <div className={`w-full ${
                  tvSidebarMode === 'slim' ? 'lg:w-[320px]' : 'lg:w-[460px]'
                } h-1/2 lg:h-full bg-[#0D121F] border-t lg:border-t-0 lg:border-l border-slate-800 ${
                  tvSidebarMode === 'slim' ? 'p-4' : 'p-5'
                } flex flex-col overflow-y-auto shrink-0 scrollbar-thin z-10 transition-all duration-300`}>
                  <div className={`border-b border-slate-800 ${tvSidebarMode === 'slim' ? 'pb-3 mb-3' : 'pb-4 mb-4'}`}>
                    <div className="flex items-center gap-2">
                      <Radio className="text-emerald-400 animate-pulse" size={tvSidebarMode === 'slim' ? 18 : 24} />
                      <h3 className={`${tvSidebarMode === 'slim' ? 'text-lg' : 'text-2xl'} font-black font-mono tracking-tight text-white`}>{activeTvSite.siteId}</h3>
                      <span className={`${tvSidebarMode === 'slim' ? 'text-xs' : 'text-base'} text-slate-400 font-bold truncate`}>- {activeTvSite.siteName}</span>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-[10px] font-black font-mono uppercase tracking-wider ${
                        activeTvSite.status === 'ONLINE' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-slate-800 border border-slate-700 text-slate-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${activeTvSite.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        {activeTvSite.status}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1 truncate">
                        <MapPin size={13} className="text-slate-500" />
                        {activeTvSite.location}
                      </span>
                    </div>
                  </div>

                  {/* Bento Grid layout */}
                  <div className={`grid grid-cols-2 ${tvSidebarMode === 'slim' ? 'gap-2.5' : 'gap-3.5'}`}>
                    {/* Grounding switch */}
                    <div className={`${tvSidebarMode === 'slim' ? 'p-3' : 'p-4'} rounded-2xl border flex flex-col justify-between transition-all duration-300 ${
                      activeTvSite.grounding === 'PUTUS'
                        ? 'bg-red-950/40 border-red-500/40 text-red-100 shadow-[inset_0_0_12px_rgba(239,68,68,0.15)] animate-pulse'
                        : 'bg-slate-900/50 border-slate-800/60 text-slate-100'
                    }`}>
                      <span className="text-[9px] font-mono tracking-wider text-slate-400 font-extrabold uppercase block mb-1">GROUNDING TOWER</span>
                      <div className="flex items-center justify-between mt-2">
                        <ShieldAlert size={tvSidebarMode === 'slim' ? 18 : 24} className={activeTvSite.grounding === 'PUTUS' ? 'text-red-500 animate-bounce' : 'text-emerald-400'} />
                        <span className={`${tvSidebarMode === 'slim' ? 'text-[11px] px-2 py-0.5' : 'text-sm px-3 py-1'} font-black font-mono tracking-wide rounded-xl ${
                          activeTvSite.grounding === 'PUTUS' ? 'bg-red-500 text-white' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {activeTvSite.grounding === 'PUTUS' ? 'PUTUS' : 'SAMBUNG'}
                        </span>
                      </div>
                    </div>

                    {/* Door switch */}
                    <div className={`${tvSidebarMode === 'slim' ? 'p-3' : 'p-4'} rounded-2xl border flex flex-col justify-between transition-all duration-300 ${
                      activeTvSite.door === 'TERBUKA'
                        ? 'bg-amber-950/40 border-amber-500/40 text-amber-100 shadow-[inset_0_0_12px_rgba(245,158,11,0.15)]'
                        : 'bg-slate-900/50 border-slate-800/60 text-slate-100'
                    }`}>
                      <span className="text-[9px] font-mono tracking-wider text-slate-400 font-extrabold uppercase block mb-1">PINTU SHELTER</span>
                      <div className="flex items-center justify-between mt-2">
                        <Siren size={tvSidebarMode === 'slim' ? 18 : 24} className={activeTvSite.door === 'TERBUKA' ? 'text-amber-500 animate-pulse' : 'text-emerald-400'} />
                        <span className={`${tvSidebarMode === 'slim' ? 'text-[11px] px-2 py-0.5' : 'text-sm px-3 py-1'} font-black font-mono tracking-wide rounded-xl ${
                          activeTvSite.door === 'TERBUKA' ? 'bg-amber-500 text-white' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {activeTvSite.door === 'TERBUKA' ? 'TERBUKA' : 'TERTUTUP'}
                        </span>
                      </div>
                    </div>

                    {/* PLN AC Power */}
                    <div className={`${tvSidebarMode === 'slim' ? 'p-3' : 'p-4'} rounded-2xl border flex flex-col justify-between ${
                      activeTvSite.acPower === 'FAIL'
                        ? 'bg-red-950/30 border-red-600/40'
                        : 'bg-slate-900/50 border-slate-800/60'
                    }`}>
                      <span className="text-[9px] font-mono tracking-wider text-slate-400 font-extrabold uppercase block mb-1">LISTRIK PLN (AC)</span>
                      <div className="flex items-center justify-between mt-2">
                        <Zap size={tvSidebarMode === 'slim' ? 18 : 22} className={activeTvSite.acPower === 'FAIL' ? 'text-red-500 animate-pulse' : 'text-emerald-400'} />
                        <span className={`${tvSidebarMode === 'slim' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'} font-black font-mono rounded-xl ${
                          activeTvSite.acPower === 'FAIL' ? 'bg-red-500 text-white' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {activeTvSite.acPower === 'FAIL' ? 'PADAM' : 'NORMAL'}
                        </span>
                      </div>
                    </div>

                    {/* Temperature */}
                    <div className={`${tvSidebarMode === 'slim' ? 'p-3' : 'p-4'} rounded-2xl border border-slate-800/60 bg-slate-900/50 flex flex-col justify-between`}>
                      <span className="text-[9px] font-mono tracking-wider text-slate-400 font-extrabold uppercase block mb-1">SUHU SHELTER</span>
                      <div className="flex items-center justify-between mt-2">
                        <Thermometer size={tvSidebarMode === 'slim' ? 18 : 22} className={activeTvSite.temperature > 32 ? 'text-rose-400 animate-bounce' : 'text-cyan-400'} />
                        <span className={`text-sm font-black font-mono ${activeTvSite.temperature > 32 ? 'text-rose-400' : 'text-cyan-400'}`}>
                          {activeTvSite.temperature}°C
                        </span>
                      </div>
                    </div>

                    {/* Battery */}
                    <div className={`${tvSidebarMode === 'slim' ? 'p-3' : 'p-4'} rounded-2xl border flex flex-col justify-between ${
                      activeTvSite.battery !== 'NORMAL'
                        ? 'bg-amber-950/20 border-amber-500/30'
                        : 'bg-slate-900/50 border-slate-800/60'
                    }`}>
                      <span className="text-[9px] font-mono tracking-wider text-slate-400 font-extrabold uppercase block mb-1">BATERAI BACKUP</span>
                      <div className="flex items-center justify-between mt-2">
                        <Battery size={tvSidebarMode === 'slim' ? 18 : 22} className={activeTvSite.battery !== 'NORMAL' ? 'text-amber-500 animate-pulse' : 'text-emerald-400'} />
                        <span className={`${tvSidebarMode === 'slim' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'} font-black font-mono rounded-xl ${
                          activeTvSite.battery === 'LOW' ? 'bg-amber-500 text-white' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {activeTvSite.battery}
                        </span>
                      </div>
                    </div>

                    {/* Rectifier */}
                    <div className={`${tvSidebarMode === 'slim' ? 'p-3' : 'p-4'} rounded-2xl border flex flex-col justify-between ${
                      activeTvSite.rectifier === 'FAULT'
                        ? 'bg-red-950/20 border-red-500/30'
                        : 'bg-slate-900/50 border-slate-800/60'
                    }`}>
                      <span className="text-[9px] font-mono tracking-wider text-slate-400 font-extrabold uppercase block mb-1">STATUS RECTIFIER</span>
                      <div className="flex items-center justify-between mt-2">
                        <Cpu size={tvSidebarMode === 'slim' ? 18 : 22} className={activeTvSite.rectifier === 'FAULT' ? 'text-red-500 animate-pulse' : 'text-emerald-400'} />
                        <span className={`${tvSidebarMode === 'slim' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'} font-black font-mono rounded-xl ${
                          activeTvSite.rectifier === 'FAULT' ? 'bg-red-500 text-white' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {activeTvSite.rectifier}
                        </span>
                      </div>
                    </div>

                    {/* Signal GSM */}
                    <div className={`${tvSidebarMode === 'slim' ? 'p-3' : 'p-4'} rounded-2xl border border-slate-800/60 bg-slate-900/50 flex flex-col justify-between col-span-2`}>
                      <span className="text-[9px] font-mono tracking-wider text-slate-400 font-extrabold uppercase block mb-1">TELEMETRI MODUL</span>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-2">
                          <Wifi size={16} className="text-emerald-400" />
                          <span className="text-xs font-bold font-mono text-white">{activeTvSite.gsm}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold font-mono text-emerald-400">{activeTvSite.rssi} dBm</span>
                          <span className="text-[9px] text-slate-500 font-mono block">SIGNAL STRENGTH</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Siren Controller */}
                  {(activeTvSite.grounding === 'PUTUS' || activeTvSite.door === 'TERBUKA') && (
                    <div className={`${tvSidebarMode === 'slim' ? 'mt-3 p-3' : 'mt-4 p-4'} rounded-2xl bg-red-950/40 border border-red-500/30 flex flex-col gap-3`}>
                      <div className="flex items-center gap-2 text-red-200">
                        <Siren size={20} className="animate-spin text-red-400" />
                        <div>
                          <span className="text-[8px] uppercase font-black font-mono tracking-wider text-red-400 block">AUDIO SIRINE KONTROL</span>
                          <span className="text-xs font-black block leading-tight">{activeTvSite.isMuted ? 'MUTE (Sirine Disenyapkan)' : 'SIRINE BERBUNYI NYARING!'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {activeTvSite.isMuted ? (
                          <button
                            type="button"
                            onClick={() => onMuteSiren(activeTvSite.siteId, 'ON')}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Volume2 size={13} />
                            NYALAKAN SIRINE
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onMuteSiren(activeTvSite.siteId, 'MUTE')}
                            className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <VolumeX size={13} />
                            SENYAPKAN SIRINE
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dynamic Bottom Carousel Progress Dots */}
                  <div className="mt-auto pt-4 border-t border-slate-800 flex items-center justify-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                    {alarmSites.map((s, idx) => {
                      const hasAlarm = s.grounding === 'PUTUS' || s.door === 'TERBUKA' || s.acPower === 'FAIL';
                      const isActive = s.siteId === selectedSiteId;
                      return (
                        <button
                          key={s.siteId}
                          type="button"
                          onClick={() => {
                            setSelectedSiteId(s.siteId);
                            setTvProgress(0);
                          }}
                          className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all ${
                            isActive 
                              ? 'w-6 bg-emerald-400' 
                              : s.status === 'OFFLINE'
                              ? 'bg-slate-700'
                              : hasAlarm
                              ? 'bg-red-500 animate-pulse'
                              : 'bg-slate-500 hover:bg-slate-400'
                          }`}
                          title={s.siteId}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#090D1A] relative overflow-hidden">
              {/* Decorative grid pattern background */}
              <div className="absolute inset-0 bg-[radial-gradient(#1E293B_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />
              
              <div className="relative z-10 max-w-lg w-full text-center flex flex-col items-center space-y-6 p-10 rounded-3xl bg-[#0D1222]/80 border border-slate-800/80 shadow-2xl backdrop-blur-sm">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
                  <div className="relative p-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                    <ShieldCheck size={64} className="animate-pulse" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-mono font-black tracking-wider uppercase text-emerald-400 flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    SISTEM OPERASIONAL NORMAL
                  </h3>
                  <p className="text-sm text-slate-300 font-medium leading-relaxed">
                    Seluruh {sites.length} site BTS dipantau terpusat dalam kondisi aman dan normal. Tidak ada alarm kritis yang terdeteksi saat ini.
                  </p>
                </div>
                
                <div className="w-full bg-slate-950/60 border border-slate-800/50 p-4 rounded-2xl font-mono text-left text-xs space-y-2.5">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>STATUS NOC:</span>
                    <span className="text-emerald-400 font-bold">ONLINE / ACTIVE</span>
                  </div>
                  <div className="h-px bg-slate-800/60" />
                  <div className="flex justify-between items-center text-slate-400">
                    <span>GROUNDING PUTUS:</span>
                    <span className="text-slate-200 font-bold">0 SITES</span>
                  </div>
                  <div className="h-px bg-slate-800/60" />
                  <div className="flex justify-between items-center text-slate-400">
                    <span>PINTU TERBUKA:</span>
                    <span className="text-slate-200 font-bold">0 SITES</span>
                  </div>
                  <div className="h-px bg-slate-800/60" />
                  <div className="flex justify-between items-center text-slate-400">
                    <span>LISTRIK PLN PADAM:</span>
                    <span className="text-slate-200 font-bold">0 SITES</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsTvMode(false)}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold font-mono text-xs cursor-pointer shadow-md transition-colors border border-slate-700 w-full"
                >
                  KEMBALI KE GEOGRAPHIC MONITOR
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface LeafletMapProps {
  sites: Site[];
  selectedSiteId: string | null;
  onSelectSite: (siteId: string) => void;
  selectedSiteMap: any;
  isTvMode?: boolean;
  tvSidebarMode?: 'slim' | 'normal' | 'hidden';
}

type MapLayerType = 'streets' | 'satellite' | 'light' | 'dark';

function LeafletMap({ sites, selectedSiteId, onSelectSite, selectedSiteMap, isTvMode, tvSidebarMode }: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const [layerType, setLayerType] = useState<MapLayerType>(isTvMode ? 'dark' : 'streets'); // Default to dark in TV Mode, streets otherwise

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Use Indonesia center as initial view if tvSidebarMode is hidden
    const isHidden = tvSidebarMode === 'hidden';
    const initialLat = isHidden ? -2.5 : Number(selectedSiteMap?.latitude || -6.914744);
    const initialLng = isHidden ? 118.0 : Number(selectedSiteMap?.longitude || 107.609810);
    const initialZoom = isHidden ? 5 : 11;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false, // Turn off default so we can place it cleanly
      attributionControl: false,
    });

    // Add zoom control to bottom right instead
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    // Trigger a resize after map loads to ensure it displays correctly in full size
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync selected site center or full Indonesia view when hidden
  useEffect(() => {
    if (!mapRef.current) return;

    // Trigger invalidateSize to let Leaflet recalculate layout on sidebar change
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 200);

    if (tvSidebarMode === 'hidden') {
      // Indonesia center and zoom for full map view
      mapRef.current.setView([-2.5, 118.0], 5);
    } else if (selectedSiteMap) {
      const lat = Number(selectedSiteMap.latitude || 0);
      const lng = Number(selectedSiteMap.longitude || 0);
      if (lat && lng) {
        mapRef.current.setView([lat, lng], 11);
      }
    }

    return () => clearTimeout(timer);
  }, [selectedSiteId, tvSidebarMode, selectedSiteMap]);

  // Handle Layer Type Change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old layer
    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    let url = '';
    let options = {};

    switch (layerType) {
      case 'streets':
        url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        options = {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        };
        break;
      case 'satellite':
        url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        options = {
          maxZoom: 19,
          attribution: '&copy; Esri World Imagery'
        };
        break;
      case 'light':
        url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        options = {
          maxZoom: 19,
          attribution: '&copy; CARTO Positron'
        };
        break;
      case 'dark':
        url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        options = {
          maxZoom: 19,
          attribution: '&copy; CARTO Dark Matter'
        };
        break;
    }

    const newLayer = L.tileLayer(url, options).addTo(map);
    tileLayerRef.current = newLayer;
  }, [layerType]);

  // Sync markers dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    Object.keys(markersRef.current).forEach(key => {
      const marker = markersRef.current[key];
      if (marker) marker.remove();
    });
    markersRef.current = {};

    sites.forEach(site => {
      const siteLat = Number(site.latitude || 0);
      const siteLng = Number(site.longitude || 0);
      if (!siteLat || !siteLng) return;

      const hasAlarm = site.grounding === 'PUTUS' || site.door === 'TERBUKA';
      const isSelected = selectedSiteId === site.siteId;

      const markerColorClass = site.status === 'OFFLINE'
        ? 'bg-slate-500'
        : hasAlarm
        ? 'bg-red-500 animate-pulse'
        : 'bg-emerald-500';

      const ringClass = isSelected
        ? 'ring-4 ring-slate-400/50 scale-110 border-white'
        : 'border-white';

      const pulseElement = site.status === 'ONLINE' && hasAlarm
        ? `<div class="absolute -inset-2 rounded-full bg-red-500/30 animate-ping pointer-events-none"></div>`
        : '';

      const customHtml = `
        <div class="relative flex flex-col items-center">
          ${pulseElement}
          <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-all ${markerColorClass} ${ringClass}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"/></svg>
          </div>
          <div class="mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono shadow border ${
            isSelected ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-200'
          }">
            ${site.siteId}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: customHtml,
        className: 'bg-transparent border-none shadow-none',
        iconSize: [50, 60],
        iconAnchor: [25, 45],
      });

      const marker = L.marker([siteLat, siteLng], { icon }).addTo(map);
      marker.on('click', () => {
        onSelectSite(site.siteId);
      });

      markersRef.current[site.siteId] = marker;
    });
  }, [sites, selectedSiteId]);

  return (
    <div className="relative w-full h-full">
      {/* Floating map layer selector */}
      <div className="absolute top-2 right-2 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1 rounded-xl shadow-lg flex gap-1 text-[10px] font-mono font-bold">
        <button
          onClick={() => setLayerType('streets')}
          className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
            layerType === 'streets'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
          JALAN (OSM)
        </button>
        <button
          onClick={() => setLayerType('satellite')}
          className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
            layerType === 'satellite'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
          SATELIT
        </button>
        <button
          onClick={() => setLayerType('light')}
          className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
            layerType === 'light'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white inline-block border border-slate-400" />
          TERANG
        </button>
        <button
          onClick={() => setLayerType('dark')}
          className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
            layerType === 'dark'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-800 inline-block" />
          GELAP
        </button>
      </div>

      <div ref={mapContainerRef} className="w-full h-full rounded-xl overflow-hidden" />
    </div>
  );
}
