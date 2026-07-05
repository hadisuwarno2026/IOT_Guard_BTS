/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, MapPin, AlertTriangle, ShieldCheck, HelpCircle, Search, 
  Wifi, Thermometer, Battery, Zap, ShieldAlert, Cpu, Siren, Volume2, VolumeX,
  Plus, Edit, Trash2, X, Save, Layers, Box, CheckSquare,
  Download, ArrowUpDown, SlidersHorizontal, AlertCircle, Phone, Calendar
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

interface AssetTabProps {
  sites: Site[];
  onMuteSiren: (siteId: string, action: 'MUTE' | 'ON') => void;
  onAddSite: (site: any) => Promise<boolean>;
  onUpdateSite: (siteId: string, site: any) => Promise<boolean>;
  onDeleteSite: (siteId: string) => Promise<boolean>;
  currentUser?: { role: string; displayName: string; isReadOnly?: boolean };
}

export default function AssetTab({ 
  sites, 
  onMuteSiren,
  onAddSite,
  onUpdateSite,
  onDeleteSite,
  currentUser 
}: AssetTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>('BTS-001');
  const [mapMode, setMapMode] = useState<'osm' | 'schematic'>('osm');

  // Show geographic map & specifications detail block above the datatable
  const [showMap, setShowMap] = useState<boolean>(false);

  // Datatable specific state
  const [tableStatusFilter, setTableStatusFilter] = useState<'SEMUA' | 'ONLINE' | 'OFFLINE'>('SEMUA');
  const [tableAlarmFilter, setTableAlarmFilter] = useState<'SEMUA' | 'ALARM' | 'NORMAL'>('SEMUA');
  const [tableGsmFilter, setTableGsmFilter] = useState<string>('SEMUA');
  const [tableSortField, setTableSortField] = useState<string>('siteId');
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
    setSiteName(`ASSET-BTS-NEW-${nextNum}`);
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
      phoneNo: '',
      packageType: '',
      packageRefillDate: '',
      packageExpiryDate: ''
    });
    if (success) {
      setIsAddModalOpen(false);
      setSelectedSiteId(siteId);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const existingSite = sites.find(s => s.siteId.toUpperCase() === siteId.toUpperCase());
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
      phoneNo: existingSite?.phoneNo || '',
      packageType: existingSite?.packageType || '',
      packageRefillDate: existingSite?.packageRefillDate || '',
      packageExpiryDate: existingSite?.packageExpiryDate || ''
    });
    if (success) {
      setIsEditModalOpen(false);
    }
  };

  const handleDeleteClick = async (targetId: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus asset ${targetId}?`)) {
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

  // Helper colors based on status
  const getGroundingColor = (status: 'NORMAL' | 'PUTUS') => {
    return status === 'PUTUS' ? 'text-red-500 bg-red-50 border-red-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };

  const getDoorColor = (status: 'TERTUTUP' | 'TERBUKA') => {
    return status === 'TERBUKA' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };

  // Extract unique GSM operators for filters dropdown
  const uniqueGsmOperators = Array.from(new Set(sites.map(s => s.gsm.toUpperCase()))).filter(Boolean);

  // Filtered sites for datatable
  const datatableFilteredSites = sites.filter(site => {
    const matchesSearch = site.siteId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          site.siteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          site.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (site.phoneNo && site.phoneNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (site.packageType && site.packageType.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = tableStatusFilter === 'SEMUA' || site.status === tableStatusFilter;

    const hasAlarm = site.grounding === 'PUTUS' || site.door === 'TERBUKA' || site.acPower === 'FAIL' || site.battery === 'LOW' || site.rectifier === 'FAULT';
    const matchesAlarm = tableAlarmFilter === 'SEMUA' || 
                         (tableAlarmFilter === 'ALARM' && hasAlarm) || 
                         (tableAlarmFilter === 'NORMAL' && !hasAlarm);

    const matchesGsm = tableGsmFilter === 'SEMUA' || site.gsm.toUpperCase() === tableGsmFilter.toUpperCase();

    return matchesSearch && matchesStatus && matchesAlarm && matchesGsm;
  });

  // Sorted sites for datatable
  const sortedSites = [...datatableFilteredSites].sort((a, b) => {
    let aVal: any = a[tableSortField as keyof Site];
    let bVal: any = b[tableSortField as keyof Site];

    if (aVal === undefined || aVal === null) aVal = '';
    if (bVal === undefined || bVal === null) bVal = '';

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return tableSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    aVal = String(aVal).toLowerCase();
    bVal = String(bVal).toLowerCase();

    if (aVal < bVal) return tableSortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return tableSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginated sites for datatable
  const totalItems = sortedSites.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedSites = sortedSites.slice(startIndex, startIndex + pageSize);

  // Sync pagination if total pages shrink
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handleSort = (field: string) => {
    if (tableSortField === field) {
      setTableSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortField(field);
      setTableSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Site ID', 'Nama Site', 'Lokasi', 'Latitude', 'Longitude', 
      'Status Koneksi', 'Suhu (C)', 'Sinyal GSM', 'RSSI (dBm)', 
      'Grounding', 'Pintu', 'Rectifier', 'Baterai', 'AC Power', 
      'Sirene', 'No HP SIM', 'Jenis Paket', 'Tgl Pengisian', 'Tgl Expired'
    ];

    const rows = sortedSites.map(s => [
      s.siteId,
      s.siteName,
      s.location,
      s.latitude,
      s.longitude,
      s.status,
      s.temperature,
      s.gsm,
      s.rssi,
      s.grounding,
      s.door,
      s.rectifier,
      s.battery,
      s.acPower,
      s.sirene,
      s.phoneNo || '',
      s.packageType || '',
      s.packageRefillDate || '',
      s.packageExpiryDate || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_inventaris_bts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Search and Header Section */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Package className="text-blue-500 animate-pulse" />
              Site Informasi
            </h2>
          </div>
          
          {/* Toggle Map & Detail Panel */}
          <button
            onClick={() => setShowMap(!showMap)}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border text-xs font-semibold self-start sm:self-auto ${
              showMap
                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm font-bold'
                : 'bg-white text-slate-600 hover:text-slate-800 border-slate-200 shadow-sm'
            }`}
          >
            <Layers size={14} className={showMap ? "animate-spin text-blue-500" : ""} />
            <span>{showMap ? 'Sembunyikan Peta' : 'Tampilkan Peta'}</span>
          </button>
        </div>

        <div className="flex items-center gap-3 w-full lg:max-w-md">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Cari Asset ID, nama, atau lokasi..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {currentUser?.role === 'admin' && !currentUser?.isReadOnly && (
            <button
              onClick={openAddModal}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus size={14} />
              <span>Tambah Asset</span>
            </button>
          )}
        </div>
      </div>

      {showMap && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch animate-fade-in">

          {/* MAP COMPONENT (8 Columns) */}
          <div className="xl:col-span-8 bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col gap-5 h-full">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase font-mono">Geographic Asset Map</h3>
                {!hasValidKey && (
                  <div className="flex bg-slate-100 p-0.5 rounded-xl text-[10px] font-mono font-bold">
                    <button
                      onClick={() => setMapMode('osm')}
                      className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                        mapMode === 'osm'
                          ? 'bg-[#0F172A] text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      OSM MAP
                    </button>
                    <button
                      onClick={() => setMapMode('schematic')}
                      className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                        mapMode === 'schematic'
                          ? 'bg-[#0F172A] text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      SCHEMATIC
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* CUSTOM GEOGRAPHY CANVAS or REAL GOOGLE MAPS */}
            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl h-[330px] relative overflow-hidden flex items-center justify-center">
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
                          onClick={() => setSelectedSiteId(site.siteId)}
                        >
                          <div className="relative flex flex-col items-center">
                            {/* Pulsing halo for alarms */}
                            {site.status === 'ONLINE' && hasAlarm && (
                              <div className="absolute inset-0 rounded-full bg-red-500/30 scale-150 animate-ping pointer-events-none" />
                            )}
                            
                            {/* Asset Icon pin shape */}
                            <div 
                              className={`p-1.5 rounded-full border-2 shadow-md flex items-center justify-center transition-all ${
                                isSelected 
                                  ? 'scale-110 ring-4 ring-slate-400/30 bg-slate-800 text-white border-white' 
                                  : site.status === 'OFFLINE'
                                  ? 'bg-slate-100 border-slate-400 text-slate-500' 
                                  : hasAlarm 
                                  ? 'bg-red-50 border-white text-white' 
                                  : 'bg-blue-500 border-white text-white'
                              }`}
                              style={{ width: '32px', height: '32px' }}
                            >
                              <Package size={16} className={hasAlarm ? "animate-pulse" : ""} />
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
              ) : mapMode === 'osm' ? (
                <>
                  <LeafletMap 
                    sites={sites} 
                    selectedSiteId={selectedSiteId} 
                    onSelectSite={setSelectedSiteId}
                    selectedSiteMap={selectedSiteMap}
                  />
                  {/* Info banner to tell how to activate GMP */}
                  <div className="absolute bottom-2 left-2 z-20 bg-slate-900/90 border border-slate-800 px-2 py-1 rounded text-[9px] font-mono text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Interactive Map (No API Key Required). Add GOOGLE_MAPS_PLATFORM_KEY to secrets to use Google Maps</span>
                  </div>
                </>
              ) : (
                <>
                  {/* Topography Grid Line overlays */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-20" />
                  
                  {/* Compass Rose */}
                  <div className="absolute top-4 right-4 pointer-events-none text-slate-600 font-mono text-[9px] text-right">
                    <div>GRID: REG-IV</div>
                    <div>UTARA ▲</div>
                  </div>

                  {/* Indonesia West Java SVG Land Outline simulation */}
                  <svg viewBox="0 0 400 300" className="w-full h-full relative z-10 p-4">
                    {/* Landmass representation (Simple abstract vector curve) */}
                    <path 
                      d="M 20,120 Q 80,110 130,120 T 260,115 T 380,130 Q 390,170 380,210 T 250,225 T 140,210 Q 70,220 20,200 Z" 
                      fill="#1E293B" 
                      stroke="#334155" 
                      strokeWidth="2" 
                    />
                    
                    {/* Java Mountain Peaks decoration */}
                    <polygon points="120,130 140,90 160,130" fill="#0F172A" stroke="#475569" strokeWidth="1" />
                    <polygon points="210,135 235,80 260,135" fill="#0F172A" stroke="#475569" strokeWidth="1" />
                    <polygon points="290,140 310,105 330,140" fill="#0F172A" stroke="#475569" strokeWidth="1" />

                    {/* Sea names */}
                    <text x="180" y="50" fill="#475569" fontSize="10" fontFamily="monospace" letterSpacing="2">LAUT JAWA</text>
                    <text x="180" y="270" fill="#475569" fontSize="10" fontFamily="monospace" letterSpacing="2">SAMUDERA HINDIA</text>
                    
                    {/* Link trails representing RF telemetry beams to central NOC server */}
                    {sites.map(site => {
                      if (site.status === 'OFFLINE') return null;
                      const siteLng = Number(site.longitude || 0);
                      const siteLat = Number(site.latitude || 0);
                      const x = 30 + ((siteLng - 107.3) / 0.4) * 340;
                      const y = 60 + ((Math.abs(siteLat) - 6.7) / 0.4) * 180;
                      const hasAlarm = site.grounding === 'PUTUS' || site.door === 'TERBUKA';

                      if (isNaN(x) || isNaN(y)) return null;

                      return (
                        <line 
                          key={`line-${site.siteId}`}
                          x1={x} 
                          y1={y} 
                          x2="200" 
                          y2="150" 
                          stroke={hasAlarm ? '#EF4444' : '#38BDF8'} 
                          strokeWidth="1" 
                          strokeDasharray="2,3" 
                          opacity="0.3"
                        />
                      );
                    })}

                    {/* Central NOC Tower Hub representing target dashboard receiver */}
                    <g transform="translate(200, 150)">
                      <circle r="6" fill="#10B981" />
                      <circle r="12" fill="none" stroke="#10B981" strokeWidth="1" className="animate-ping" style={{ transformOrigin: '200px 150px' }} />
                      <path d="M-3,5 L0,-15 L3,5 Z" fill="#F1F5F9" />
                    </g>
                    <text x="175" y="170" fill="#059669" fontSize="8" fontFamily="monospace" fontWeight="bold">NOC CORE</text>

                    {/* SITE MARKERS GENERATOR */}
                    {sites.map(site => {
                      const siteLng = Number(site.longitude || 0);
                      const siteLat = Number(site.latitude || 0);
                      const x = 30 + ((siteLng - 107.3) / 0.4) * 340;
                      const y = 60 + ((Math.abs(siteLat) - 6.7) / 0.4) * 180;
                      const hasAlarm = site.grounding === 'PUTUS' || site.door === 'TERBUKA';

                      if (isNaN(x) || isNaN(y)) return null;

                      const isSelected = selectedSiteId === site.siteId;

                      return (
                        <g 
                          key={site.siteId} 
                          transform={`translate(${x}, ${y})`}
                          className="cursor-pointer pointer-events-auto"
                          onClick={() => setSelectedSiteId(site.siteId)}
                        >
                          {/* Ring highlight if selected */}
                          {isSelected && (
                            <circle r="12" fill="none" stroke="#E2E8F0" strokeWidth="2.5" />
                          )}

                          {/* Blinking signal radiation ripple if alarm blares */}
                          {site.status === 'ONLINE' && hasAlarm && (
                            <circle r="9" fill="none" stroke="#EF4444" strokeWidth="2" className="animate-ping" />
                          )}

                          {/* Central marker node */}
                          <circle 
                            r={isSelected ? "6" : "5"} 
                            fill={
                              site.status === 'OFFLINE' 
                                ? '#64748B' 
                                : hasAlarm 
                                ? '#EF4444' 
                                : '#38BDF8'
                            } 
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                          />

                          {/* ID Label Tag */}
                          <text 
                            y="-10" 
                            textAnchor="middle" 
                            fill={isSelected ? "#FFF" : "#94A3B8"} 
                            fontSize="9" 
                            fontWeight={isSelected ? "bold" : "normal"}
                            fontFamily="monospace"
                          >
                            {site.siteId}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Info banner to tell how to activate GMP */}
                  <div className="absolute bottom-2 left-2 z-20 bg-slate-900/90 border border-slate-800 px-2 py-1 rounded text-[9px] font-mono text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Google Maps: Add GOOGLE_MAPS_PLATFORM_KEY to AI Studio secrets to enable real maps</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* DETAIL PANEL (4 Columns) */}
          <div className="xl:col-span-4 bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between h-full">
            {/* Quick inspect detail box of clicked coordinates */}
            <div className="flex-1 flex flex-col justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-[#0F172A] border border-slate-800 text-blue-400 rounded-xl">
                  <Box size={18} />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block font-bold">SPESIFIKASI DETAIL ASSET</span>
                  <h4 className="text-xs font-bold text-slate-800">{selectedSiteMap.siteId} / {selectedSiteMap.siteName}</h4>
                  <p className="text-[10px] font-mono text-slate-500">{selectedSiteMap.location}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block font-bold">LATITUDE</span>
                  <span className="font-mono text-slate-700 font-bold">{Number(selectedSiteMap.latitude || 0).toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block font-bold">LONGITUDE</span>
                  <span className="font-mono text-slate-700 font-bold">{Number(selectedSiteMap.longitude || 0).toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block font-bold">NO HP</span>
                  <span className="font-mono text-slate-700 font-bold">{selectedSiteMap.phoneNo || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block font-bold">ISI PAKET</span>
                  <span className="text-slate-700 font-bold">{selectedSiteMap.packageType || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block font-bold">TGL ISI</span>
                  <span className="font-mono text-slate-700 font-bold">{selectedSiteMap.packageRefillDate || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block font-bold">TGL EXPIRED</span>
                  <span className="font-mono text-slate-700 font-bold">{selectedSiteMap.packageExpiryDate || '-'}</span>
                </div>
              </div>

              {/* AC Mains fail or fault alerts overlay */}
              <div className={`mt-3 py-2 px-3 rounded-xl flex items-center gap-2 text-xs border ${
                selectedSiteMap.acPower === 'FAIL' || selectedSiteMap.rectifier === 'FAULT'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-[#F0FDF4] border-emerald-100 text-emerald-800'
              }`}>
                <Zap size={14} className={selectedSiteMap.acPower === 'FAIL' ? 'animate-bounce text-rose-500' : 'text-emerald-500'} />
                <span className="font-mono font-medium">
                  AC MAINS FEEDER: {selectedSiteMap.acPower === 'FAIL' ? '⚠️ TENSION FAILURE' : 'OK (220V STABLE)'}
                </span>
              </div>

              {currentUser?.role === 'admin' && !currentUser?.isReadOnly && (
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-200">
                  <button
                    onClick={() => openEditModal(selectedSiteMap)}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit size={13} className="text-slate-600" />
                    <span>Ubah Asset</span>
                  </button>
                  <button
                    onClick={() => handleDeleteClick(selectedSiteMap.siteId)}
                    className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-rose-100 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} className="text-rose-600" />
                    <span>Hapus Asset</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TABLE VIEW / DATATABLE SITE */}
      <div className="space-y-6 animate-fade-in text-slate-800">
          {/* Datatable Filter Controls */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                <SlidersHorizontal size={14} className="text-blue-500" />
                <span>Filter Data:</span>
              </div>
              
              {/* Status Filter */}
              <div>
                <label className="block text-[9px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Status Koneksi</label>
                <select
                  value={tableStatusFilter}
                  onChange={(e) => {
                    setTableStatusFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                >
                  <option value="SEMUA">🌐 Semua Status</option>
                  <option value="ONLINE">ONLINE</option>
                  <option value="OFFLINE">OFFLINE</option>
                </select>
              </div>

              {/* Alarm Filter */}
              <div>
                <label className="block text-[9px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Kondisi Alarm</label>
                <select
                  value={tableAlarmFilter}
                  onChange={(e) => {
                    setTableAlarmFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                >
                  <option value="SEMUA">🚨 Semua Alarm</option>
                  <option value="ALARM">Alarm Aktif</option>
                  <option value="NORMAL">Normal</option>
                </select>
              </div>

              {/* GSM Provider Filter */}
              <div>
                <label className="block text-[9px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Provider GSM</label>
                <select
                  value={tableGsmFilter}
                  onChange={(e) => {
                    setTableGsmFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                >
                  <option value="SEMUA">📡 Semua Operator</option>
                  {uniqueGsmOperators.map(op => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>

              {/* Reset Button */}
              {(tableStatusFilter !== 'SEMUA' || tableAlarmFilter !== 'SEMUA' || tableGsmFilter !== 'SEMUA') && (
                <button
                  onClick={() => {
                    setTableStatusFilter('SEMUA');
                    setTableAlarmFilter('SEMUA');
                    setTableGsmFilter('SEMUA');
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 self-end h-[32px] mt-4"
                >
                  <X size={12} />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            {/* Export Action */}
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer self-start md:self-auto whitespace-nowrap shadow-sm"
            >
              <Download size={14} />
              <span>Ekspor CSV</span>
            </button>
          </div>

          {/* TABLE CONTAINER CARD */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100">
                    <th 
                      onClick={() => handleSort('siteId')}
                      className="px-6 py-4 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase cursor-pointer hover:bg-slate-100/50 select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>ID Asset</span>
                        <ArrowUpDown size={12} className="text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('siteName')}
                      className="px-6 py-4 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase cursor-pointer hover:bg-slate-100/50 select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Nama Site</span>
                        <ArrowUpDown size={12} className="text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('location')}
                      className="px-6 py-4 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase cursor-pointer hover:bg-slate-100/50 select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Lokasi & Koordinat</span>
                        <ArrowUpDown size={12} className="text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('status')}
                      className="px-6 py-4 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase cursor-pointer hover:bg-slate-100/50 select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Koneksi</span>
                        <ArrowUpDown size={12} className="text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('grounding')}
                      className="px-6 py-4 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase cursor-pointer hover:bg-slate-100/50 select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Grounding</span>
                        <ArrowUpDown size={12} className="text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('door')}
                      className="px-6 py-4 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase cursor-pointer hover:bg-slate-100/50 select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Pintu</span>
                        <ArrowUpDown size={12} className="text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('temperature')}
                      className="px-6 py-4 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase cursor-pointer hover:bg-slate-100/50 select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Suhu</span>
                        <ArrowUpDown size={12} className="text-slate-400" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase select-none">
                      Power / Batt
                    </th>
                    <th 
                      onClick={() => handleSort('rssi')}
                      className="px-6 py-4 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase cursor-pointer hover:bg-slate-100/50 select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Sinyal</span>
                        <ArrowUpDown size={12} className="text-slate-400" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase select-none">
                      No SIM & Paket
                    </th>
                    <th className="px-6 py-4 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase select-none text-right">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedSites.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-slate-500 text-sm font-medium">
                        Tidak ada data BTS yang cocok dengan filter atau pencarian Anda.
                      </td>
                    </tr>
                  ) : (
                    paginatedSites.map(site => {
                      const hasAlarm = site.grounding === 'PUTUS' || site.door === 'TERBUKA' || site.acPower === 'FAIL' || site.battery === 'LOW' || site.rectifier === 'FAULT';
                      const isHighTemp = site.temperature > 35;
                      const todayStr = new Date().toISOString().split('T')[0];
                      const isExpired = site.packageExpiryDate ? site.packageExpiryDate < todayStr : false;

                      return (
                        <tr 
                          key={site.siteId} 
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          {/* ID Asset */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-bold text-blue-600 font-mono bg-blue-50/70 border border-blue-100 px-2.5 py-1 rounded-lg">
                              {site.siteId}
                            </span>
                          </td>

                          {/* Nama Asset */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800">{site.siteName}</span>
                              <span className="text-[10px] font-medium text-slate-400 uppercase font-mono tracking-wider">{site.gsm} Node</span>
                            </div>
                          </td>

                          {/* Lokasi */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col min-w-[150px]">
                              <span className="text-xs text-slate-600 font-medium line-clamp-1 flex items-center gap-1">
                                <MapPin size={11} className="text-slate-400 shrink-0" />
                                {site.location}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {Number(site.latitude || 0).toFixed(5)}, {Number(site.longitude || 0).toFixed(5)}
                              </span>
                            </div>
                          </td>

                          {/* Koneksi */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[10px] font-bold font-mono ${
                              site.status === 'ONLINE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${site.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                              {site.status}
                            </span>
                          </td>

                          {/* Grounding */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                              site.grounding === 'PUTUS' 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {site.grounding === 'PUTUS' ? '⚠️ PUTUS' : '🟢 NORMAL'}
                            </span>
                          </td>

                          {/* Pintu */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                              site.door === 'TERBUKA' 
                                ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {site.door === 'TERBUKA' ? '🚪 TERBUKA' : '🔒 TERTUTUP'}
                            </span>
                          </td>

                          {/* Suhu */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold font-mono ${
                              isHighTemp 
                                ? 'bg-rose-100 text-rose-700 animate-pulse font-extrabold' 
                                : 'bg-slate-50 text-slate-700 border border-slate-150'
                            }`}>
                              <Thermometer size={12} className={isHighTemp ? "text-rose-500" : "text-slate-400"} />
                              {site.temperature} °C
                            </span>
                          </td>

                          {/* Power / Batt / Rectifier */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold w-fit ${
                                site.acPower === 'FAIL' 
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}>
                                PLN: {site.acPower === 'FAIL' ? '⚠️ FAIL' : 'OK'}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold w-fit ${
                                site.battery === 'LOW'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}>
                                BATT: {site.battery}
                              </span>
                            </div>
                          </td>

                          {/* RSSI */}
                          <td className="px-6 py-4 whitespace-nowrap font-mono">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                              <Wifi size={12} className="text-slate-400" />
                              <span>{site.rssi} dBm</span>
                              <span className="text-[10px] font-semibold text-slate-400 font-sans">({site.gsm})</span>
                            </div>
                          </td>

                          {/* SIM & Paket */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col text-[11px] min-w-[130px]">
                              {site.phoneNo ? (
                                <>
                                  <span className="font-mono text-slate-700 font-bold flex items-center gap-1">
                                    <Phone size={10} className="text-slate-400" />
                                    {site.phoneNo}
                                  </span>
                                  <span className="text-slate-500 font-medium">{site.packageType || 'No Package'}</span>
                                  {site.packageExpiryDate && (
                                    <span className={`text-[10px] font-mono flex items-center gap-0.5 mt-0.5 ${
                                      isExpired ? 'text-red-500 font-bold' : 'text-slate-400'
                                    }`}>
                                      <Calendar size={9} />
                                      Exp: {site.packageExpiryDate} {isExpired && '(EXPIRED)'}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-400 italic">Belum dikonfigurasi</span>
                              )}
                            </div>
                          </td>

                          {/* Aksi */}
                          <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasAlarm && (
                                <button
                                  disabled={currentUser?.isReadOnly}
                                  onClick={() => onMuteSiren(site.siteId, site.isMuted ? 'ON' : 'MUTE')}
                                  title={currentUser?.isReadOnly ? "Hanya melihat (Tidak boleh ubah sirene)" : (site.isMuted ? "Aktifkan Sirene" : "Mute Sirene")}
                                  className={`p-1.5 rounded-lg transition-all ${
                                    currentUser?.isReadOnly
                                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                      : site.isMuted 
                                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 cursor-pointer' 
                                        : 'bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer'
                                  }`}
                                >
                                  {site.isMuted ? <Volume2 size={13} /> : <VolumeX size={13} />}
                                </button>
                              )}

                              {currentUser?.role === 'admin' && !currentUser?.isReadOnly && (
                                <>
                                  <button
                                    onClick={() => openEditModal(site)}
                                    title="Edit Data Asset"
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Edit size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(site.siteId)}
                                    title="Hapus Asset"
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 rounded-lg transition-colors cursor-pointer border border-rose-100"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-4">
                <span>
                  Menampilkan <strong className="text-slate-800">{totalItems === 0 ? 0 : startIndex + 1}</strong> - <strong className="text-slate-800">{Math.min(startIndex + pageSize, totalItems)}</strong> dari <strong className="text-slate-800">{totalItems}</strong> data BTS
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-mono uppercase">Tampilkan:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none text-slate-700"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1 self-end sm:self-auto">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer text-slate-700"
                  >
                    Sebelumnya
                  </button>
                  
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const p = idx + 1;
                    return (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          currentPage === p
                            ? 'bg-[#0F172A] text-white shadow-sm'
                            : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer text-slate-700"
                  >
                    Selanjutnya
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* ADD SITE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl p-6 max-w-lg w-full relative max-h-[90vh] overflow-y-auto animate-fade-in text-slate-800">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
            
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="text-blue-600" />
              <span>Tambah Asset Baru</span>
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">ASSET SITE ID</label>
                  <input
                    type="text"
                    required
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-mono text-slate-800"
                    placeholder="Contoh: BTS-004"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">NAMA ASSET BTS</label>
                  <input
                    type="text"
                    required
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800"
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
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800"
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
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-mono text-slate-800"
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
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">SUHU INTERNAL (°C)</label>
                  <input
                    type="number"
                    required
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">GSM NETWORK & SIGNAL</label>
                  <input
                    type="text"
                    required
                    value={gsm}
                    onChange={(e) => setGsm(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800"
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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus size={14} />
                  Tambah Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SITE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl p-6 max-w-lg w-full relative max-h-[90vh] overflow-y-auto animate-fade-in text-slate-800">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
            
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Edit className="text-blue-600" size={18} />
              <span>Ubah Data Asset - {siteId}</span>
            </h3>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">ASSET ID (TIDAK BISA DIUBAH)</label>
                  <input
                    type="text"
                    disabled
                    value={siteId}
                    className="block w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-400 font-mono cursor-not-allowed text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">NAMA ASSET BTS</label>
                  <input
                    type="text"
                    required
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800"
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
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800"
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
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-mono text-slate-800"
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
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">SUHU INTERNAL (°C)</label>
                  <input
                    type="number"
                    required
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">GSM NETWORK & SIGNAL</label>
                  <input
                    type="text"
                    required
                    value={gsm}
                    onChange={(e) => setGsm(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">RECTIFIER STATUS</label>
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
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">BATERAI BACKUP STATUS</label>
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
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">GROUNDING STATUS</label>
                  <select
                    value={grounding}
                    onChange={(e) => setGrounding(e.target.value as any)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none text-slate-800"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="PUTUS">PUTUS (ALARM)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">STATUS PINTU SHELTER</label>
                  <select
                    value={door}
                    onChange={(e) => setDoor(e.target.value as any)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none text-slate-800"
                  >
                    <option value="TERTUTUP">TERTUTUP (NORMAL)</option>
                    <option value="TERBUKA">TERBUKA (ALARM)</option>
                  </select>
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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Save size={14} />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
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
}

type MapLayerType = 'streets' | 'satellite' | 'light' | 'dark';

function LeafletMap({ sites, selectedSiteId, onSelectSite, selectedSiteMap }: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const [layerType, setLayerType] = useState<MapLayerType>('streets');

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialLat = Number(selectedSiteMap?.latitude || -6.914744);
    const initialLng = Number(selectedSiteMap?.longitude || 107.609810);

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync selected site center
  useEffect(() => {
    if (!mapRef.current || !selectedSiteMap) return;
    const lat = Number(selectedSiteMap.latitude || 0);
    const lng = Number(selectedSiteMap.longitude || 0);
    if (lat && lng) {
      mapRef.current.setView([lat, lng], mapRef.current.getZoom());
    }
  }, [selectedSiteId]);

  // Handle Layer Type Change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
        : 'bg-blue-500';

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
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
          </div>
          <div class="mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono shadow border ${
            isSelected ? 'bg-[#0F172A] text-white border-slate-800' : 'bg-white text-slate-700 border-slate-200'
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
              ? 'bg-blue-500 text-slate-950 shadow-sm'
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
              ? 'bg-blue-500 text-slate-950 shadow-sm'
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
              ? 'bg-blue-500 text-slate-950 shadow-sm'
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
              ? 'bg-blue-500 text-slate-950 shadow-sm'
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
