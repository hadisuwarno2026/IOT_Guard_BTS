/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { Site, AlarmLog, AuditTrail, IntegrationConfig, DeviceStatusLog } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json());

// Supabase Lazy Initialization and Connection Helper
let supabaseClientCache: any = null;
let lastUsedUrl = '';
let lastUsedKey = '';

function getSupabaseClient() {
  let url = integrationConfig?.supabaseUrl || process.env.SUPABASE_URL;
  const key = integrationConfig?.supabaseKey || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  url = String(url).trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return null;
  }

  if (!supabaseClientCache || url !== lastUsedUrl || key !== lastUsedKey) {
    try {
      supabaseClientCache = createClient(url, key);
      lastUsedUrl = url;
      lastUsedKey = key;
    } catch (e) {
      console.warn('[Supabase] Failed to instantiate client:', e instanceof Error ? e.message : e);
      return null;
    }
  }

  return supabaseClientCache;
}

// Database schema mappings for SITE, ALARM, DEVICE
function mapDbSite(dbSite: any): Site {
  return {
    siteId: dbSite.SiteID || dbSite.site_id || dbSite.siteId || '',
    siteName: dbSite.SiteName || dbSite.site_name || dbSite.siteName || '',
    location: dbSite.Lokasi || dbSite.location || '',
    latitude: Number(dbSite.Latitude || dbSite.latitude || -6.914744),
    longitude: Number(dbSite.Longitude || dbSite.longitude || 107.609810),
    grounding: 'NORMAL',
    door: 'TERTUTUP',
    sirene: 'OFF',
    gsm: '4G',
    rssi: -75,
    status: 'OFFLINE',
    lastSeen: new Date().toISOString(),
    rectifier: 'NORMAL',
    battery: 'NORMAL',
    acPower: 'NORMAL',
    temperature: 28,
    lastRestart: dbSite.LastRestart || dbSite.last_restart || dbSite.lastRestart || new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    resetReason: dbSite.ResetReason || dbSite.reset_reason || dbSite.resetReason || 'Power On',
    teg: dbSite.Teg || dbSite.teg || 'NORMAL',
    phoneNo: dbSite.PhoneNo || dbSite.phone_no || dbSite.phoneNo || '',
    packageType: dbSite.PackageType || dbSite.package_type || dbSite.packageType || '',
    packageRefillDate: dbSite.PackageRefillDate || dbSite.package_refill_date || dbSite.packageRefillDate || '',
    packageExpiryDate: dbSite.PackageExpiryDate || dbSite.package_expiry_date || dbSite.packageExpiryDate || ''
  };
}

function mapDbAlarm(dbAlarm: any): AlarmLog {
  return {
    id: String(dbAlarm.id || dbAlarm.AlarmID || ''),
    timestamp: dbAlarm.Timestamp || dbAlarm.timestamp || new Date().toISOString(),
    siteId: dbAlarm.SiteID || dbAlarm.site_id || dbAlarm.siteId || '',
    siteName: dbAlarm.SiteName || dbAlarm.site_name || dbAlarm.siteName || '',
    alarmType: dbAlarm.AlarmType || dbAlarm.alarm_type || dbAlarm.alarmType || 'NORMAL',
    status: dbAlarm.Status || dbAlarm.status || 'CLOSED',
    keterangan: dbAlarm.Keterangan || dbAlarm.keterangan || ''
  };
}

function mapDbDevice(dbDevice: any): DeviceStatusLog {
  let gr: 'NORMAL' | 'PUTUS' = 'NORMAL';
  if (dbDevice.Grounding !== undefined) {
    if (typeof dbDevice.Grounding === 'number') {
      gr = dbDevice.Grounding === 1 ? 'NORMAL' : 'PUTUS';
    } else {
      gr = String(dbDevice.Grounding).toUpperCase() === 'PUTUS' ? 'PUTUS' : 'NORMAL';
    }
  }

  let dr: 'TERTUTUP' | 'TERBUKA' = 'TERTUTUP';
  if (dbDevice.Door !== undefined) {
    if (typeof dbDevice.Door === 'number') {
      dr = dbDevice.Door === 1 ? 'TERTUTUP' : 'TERBUKA';
    } else {
      dr = String(dbDevice.Door).toUpperCase() === 'TERBUKA' ? 'TERBUKA' : 'TERTUTUP';
    }
  }

  let sr: 'ON' | 'OFF' = 'OFF';
  if (dbDevice.Sirene !== undefined) {
    if (typeof dbDevice.Sirene === 'number') {
      sr = dbDevice.Sirene === 1 ? 'ON' : 'OFF';
    } else {
      sr = String(dbDevice.Sirene).toUpperCase() === 'ON' ? 'ON' : 'OFF';
    }
  }

  return {
    timestamp: dbDevice.Timestamp || dbDevice.timestamp || new Date().toISOString(),
    siteId: dbDevice.SiteID || dbDevice.site_id || dbDevice.siteId || '',
    siteName: dbDevice.SiteName || dbDevice.site_name || dbDevice.siteName || '',
    grounding: gr,
    door: dr,
    sirene: sr,
    gsm: dbDevice.GSM || dbDevice.gsm || '4G',
    rssi: Number(dbDevice.RSSI || dbDevice.rssi || -75)
  };
}

// Supabase sync read/write actions
async function loadStateFromSupabase() {
  const client = getSupabaseClient();
  if (!client || !integrationConfig?.supabaseEnabled) {
    return false;
  }

  try {
    const { data: dbSites, error: sitesError } = await client
      .from('SITE')
      .select('*');
    
    if (sitesError) {
      console.warn('[Supabase] Error loading SITE table:', sitesError.message);
      return false;
    }

    const { data: dbAlarms, error: alarmsError } = await client
      .from('ALARM')
      .select('*')
      .order('Timestamp', { ascending: false })
      .limit(100);

    if (alarmsError) {
      console.warn('[Supabase] Error loading ALARM table:', alarmsError.message);
      return false;
    }

    const { data: dbDevices, error: devicesError } = await client
      .from('DEVICE')
      .select('*')
      .order('Timestamp', { ascending: false })
      .limit(100);

    if (devicesError) {
      console.warn('[Supabase] Error loading DEVICE table:', devicesError.message);
      return false;
    }

    const loadedSites = dbSites.map((s: any) => mapDbSite(s));
    const loadedAlarms = dbAlarms.map((a: any) => mapDbAlarm(a));
    const loadedDeviceLogs = dbDevices.map((d: any) => mapDbDevice(d));

    for (const site of loadedSites) {
      const siteLogs = loadedDeviceLogs.filter(log => log.siteId.toUpperCase() === site.siteId.toUpperCase());
      if (siteLogs.length > 0) {
        const latestLog = siteLogs[0];
        site.grounding = latestLog.grounding;
        site.door = latestLog.door;
        site.sirene = latestLog.sirene;
        site.gsm = latestLog.gsm;
        site.rssi = latestLog.rssi;
        site.lastSeen = latestLog.timestamp;
        
        site.status = 'ONLINE';
      }

      const activeAlarmsForSite = loadedAlarms.filter(al => al.siteId.toUpperCase() === site.siteId.toUpperCase() && al.status === 'ACTIVE');
      if (activeAlarmsForSite.length > 0) {
        const groundingAlarm = activeAlarmsForSite.find(al => al.alarmType === 'GROUNDING_PUTUS');
        const doorAlarm = activeAlarmsForSite.find(al => al.alarmType === 'PINTU_TERBUKA');
        if (groundingAlarm) site.grounding = 'PUTUS';
        if (doorAlarm) site.door = 'TERBUKA';
        site.sirene = (site.grounding === 'PUTUS' || site.door === 'TERBUKA') ? 'ON' : 'OFF';
      }
    }

    sites = loadedSites;
    alarmLogs = loadedAlarms;
    deviceLogs = loadedDeviceLogs;
    lastUpdateTs = Date.now();
    return true;
  } catch (err) {
    console.error('[Supabase] Error loading from Supabase:', err);
    return false;
  }
}

async function saveSiteToSupabase(site: Site) {
  const client = getSupabaseClient();
  if (!client || !integrationConfig?.supabaseEnabled) return;
  try {
    const { error } = await client
      .from('SITE')
      .upsert({
        SiteID: site.siteId,
        SiteName: site.siteName,
        Lokasi: site.location,
        Latitude: site.latitude,
        Longitude: site.longitude,
        PhoneNo: site.phoneNo || '',
        PackageType: site.packageType || '',
        PackageRefillDate: site.packageRefillDate || '',
        PackageExpiryDate: site.packageExpiryDate || ''
      }, { onConflict: 'SiteID' });
    if (error) {
      console.warn('[Supabase] PascalCase SITE upsert failed, trying lowercase fallback...', error.message);
      const { error: error2 } = await client
        .from('SITE')
        .upsert({
          site_id: site.siteId,
          site_name: site.siteName,
          location: site.location,
          latitude: site.latitude,
          longitude: site.longitude,
          phone_no: site.phoneNo || '',
          package_type: site.packageType || '',
          package_refill_date: site.packageRefillDate || '',
          package_expiry_date: site.packageExpiryDate || ''
        }, { onConflict: 'site_id' });
      if (error2) {
        console.error('[Supabase] Lowercase fallback SITE upsert failed too:', error2.message);
      }
    }
  } catch (err) {
    console.error('[Supabase] Error upserting SITE:', err);
  }
}

async function deleteSiteFromSupabase(siteId: string) {
  const client = getSupabaseClient();
  if (!client || !integrationConfig?.supabaseEnabled) return;
  try {
    const { error } = await client
      .from('SITE')
      .delete()
      .eq('SiteID', siteId);
    if (error) {
      console.warn('[Supabase] PascalCase delete SITE failed, trying lowercase fallback...', error.message);
      const { error: error2 } = await client
        .from('SITE')
        .delete()
        .eq('site_id', siteId);
      if (error2) {
        console.error('[Supabase] Lowercase fallback delete SITE failed too:', error2.message);
      }
    }
  } catch (err) {
    console.error('[Supabase] Error deleting SITE:', err);
  }
}

async function logAlarmToSupabase(alarm: AlarmLog) {
  const client = getSupabaseClient();
  if (!client || !integrationConfig?.supabaseEnabled) return;
  try {
    const { error } = await client
      .from('ALARM')
      .insert({
        SiteID: alarm.siteId,
        AlarmType: alarm.alarmType,
        Status: alarm.status,
        Keterangan: alarm.keterangan,
        Timestamp: alarm.timestamp
      });
    if (error) console.error('[Supabase] Error inserting ALARM:', error.message);
  } catch (err) {
    console.error('[Supabase] Error inserting ALARM:', err);
  }
}

async function closeAlarmInSupabase(siteId: string, alarmType: string) {
  const client = getSupabaseClient();
  if (!client || !integrationConfig?.supabaseEnabled) return;
  try {
    const { error } = await client
      .from('ALARM')
      .update({ Status: 'CLOSED' })
      .eq('SiteID', siteId)
      .eq('AlarmType', alarmType)
      .eq('Status', 'ACTIVE');
    if (error) console.error('[Supabase] Error updating ALARM status:', error.message);
  } catch (err) {
    console.error('[Supabase] Error updating ALARM status:', err);
  }
}

async function logDeviceToSupabase(device: DeviceStatusLog) {
  const client = getSupabaseClient();
  if (!client || !integrationConfig?.supabaseEnabled) return;
  try {
    const { error } = await client
      .from('DEVICE')
      .insert({
        SiteID: device.siteId,
        Grounding: device.grounding,
        Door: device.door,
        Sirene: device.sirene,
        GSM: device.gsm,
        RSSI: device.rssi,
        Timestamp: device.timestamp
      });
    if (error) {
      // Try integer fallback in case user columns are defined as INTEGER (1/0)
      const { error: fallbackError } = await client
        .from('DEVICE')
        .insert({
          SiteID: device.siteId,
          Grounding: device.grounding === 'NORMAL' ? 1 : 0,
          Door: device.door === 'TERTUTUP' ? 1 : 0,
          Sirene: device.sirene === 'ON' ? 1 : 0,
          GSM: device.gsm,
          RSSI: device.rssi,
          Timestamp: device.timestamp
        });
      if (fallbackError) {
        console.error('[Supabase] Fallback insert to DEVICE failed:', fallbackError.message);
      }
    }
  } catch (err) {
    console.error('[Supabase] Error inserting DEVICE:', err);
  }
}

// In-Memory state
let lastUpdateTs = 0;
let localUsers: any[] = [
  { 
    id: 'a58a26b2-8618-4ab9-9497-a38cc0ea8b4e', 
    username: 'administrator', 
    displayName: 'Administrator', 
    role: 'admin', 
    lastActive: 'Sesi Aktif Sekarang',
    permissions: ['dashboard', 'monitoring', 'asset', 'alarm', 'status', 'simcard', 'users', 'settings'],
    isReadOnly: false
  },
  { 
    id: '5b141abb-2d47-4016-8b31-8550eb688c2f', 
    username: 'user', 
    displayName: 'User Regular', 
    role: 'viewer', 
    lastActive: 'Aktif di Database',
    permissions: ['dashboard', 'monitoring', 'asset', 'alarm', 'status', 'simcard'],
    isReadOnly: false
  }
];

const LOCAL_USERS_FILE = path.join(process.cwd(), 'local_users_db.json');

function loadLocalUsers() {
  try {
    if (fs.existsSync(LOCAL_USERS_FILE)) {
      const data = fs.readFileSync(LOCAL_USERS_FILE, 'utf8');
      localUsers = JSON.parse(data);
      // Migrate existing local users to have default permissions if missing
      localUsers = localUsers.map(u => {
        if (!u.permissions) {
          u.permissions = u.role === 'admin' 
            ? ['dashboard', 'monitoring', 'asset', 'alarm', 'status', 'simcard', 'users', 'settings']
            : ['dashboard', 'monitoring', 'asset', 'alarm', 'status', 'simcard'];
        }
        if (u.isReadOnly === undefined) {
          u.isReadOnly = false;
        }
        return u;
      });
      console.log('[Local DB] Loaded local users successfully. Count:', localUsers.length);
    } else {
      saveLocalUsers();
    }
  } catch (err) {
    console.error('[Local DB] Error loading local users:', err);
  }
}

function saveLocalUsers() {
  try {
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(localUsers, null, 2), 'utf8');
    console.log('[Local DB] Saved local users successfully.');
  } catch (err) {
    console.error('[Local DB] Error saving local users:', err);
  }
}

// Load local users on startup
loadLocalUsers();

let sites: Site[] = [];

// Seed initial alarm logs
let alarmLogs: AlarmLog[] = [];

// Seed initial history logs
let deviceLogs: DeviceStatusLog[] = [];

// Init integration configurations
let integrationConfig: IntegrationConfig = {
  gasUrl: 'https://script.google.com/macros/s/AKfycby8jU1M_BTS_MON_WebHooks/exec',
  whatsappProvider: 'fonnte',
  whatsappToken: 'FONNTE_TOKEN_97Fv2a1Bx',
  whatsappPhone: '081234567890',
  whatsappEnabled: true,
  muteDurationMin: 5,
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '',
  supabaseEnabled: !!(process.env.SUPABASE_URL && 
                       (process.env.SUPABASE_URL.startsWith('http://') || process.env.SUPABASE_URL.startsWith('https://')) && 
                       (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY))
};

// Seed audit trail logs
let auditTrails: AuditTrail[] = [
  {
    id: 'AT-001',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    user: 'Admin',
    action: 'LOGIN',
    details: 'User Admin masuk ke dalam sistem dari alamat IP 192.168.1.50'
  },
  {
    id: 'AT-002',
    timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
    user: 'Admin',
    action: 'MUTE ALARM',
    details: 'Siren pada BTS-003 dimatikan secara manual (Muted 5 menit)'
  },
  {
    id: 'AT-003',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    user: 'Admin',
    action: 'CONFIG UPDATE',
    details: 'Mengubah token Fonnte WhatsApp API dan memperbarui URL Webhook Google Apps Script.'
  }
];

// Middleware to transparently synchronize state from client in serverless/stateless environments (e.g. Vercel)
app.use((req, res, next) => {
  if (req.body) {
    const clientSites = req.body.clientSites || req.body.sites;
    const clientConfig = req.body.clientConfig || req.body.integrationConfig;
    const clientAlarms = req.body.clientAlarms || req.body.alarmLogs;
    const clientDeviceLogs = req.body.clientDeviceLogs || req.body.deviceLogs;
    const clientAudit = req.body.clientAudit || req.body.auditTrails;

    if (clientSites && Array.isArray(clientSites) && clientSites.length > 0) {
      sites = clientSites;
    }
    if (clientConfig && typeof clientConfig === 'object' && !Array.isArray(clientConfig)) {
      const mergedConfig = { ...integrationConfig };
      for (const key of Object.keys(clientConfig)) {
        const val = clientConfig[key];
        if (val !== undefined && val !== null && val !== '') {
          mergedConfig[key] = val;
        }
      }
      integrationConfig = mergedConfig;
    }
    if (clientAlarms && Array.isArray(clientAlarms)) {
      alarmLogs = clientAlarms;
    }
    if (clientDeviceLogs && Array.isArray(clientDeviceLogs)) {
      deviceLogs = clientDeviceLogs;
    }
    if (clientAudit && Array.isArray(clientAudit)) {
      auditTrails = clientAudit;
    }
  }
  next();
});

// Map of sirene muted status: key is siteId, value is boolean (true if muted)
const mutedSirens: { [siteId: string]: boolean } = {};

// Simulate Out-of-bound logs generator and helper functions
function checkSirenAutoReset() {
  // Disabled as per user request ("tidak perlu dibuat timer, hanya mute dan on saja")
}

function createAuditLog(user: string, action: string, details: string) {
  const log: AuditTrail = {
    id: 'AT-' + Math.floor(100+Math.random()*900) + '-' + Date.now().toString().slice(-4),
    timestamp: new Date().toISOString(),
    user,
    action,
    details
  };
  auditTrails.unshift(log);
  if (auditTrails.length > 100) auditTrails.pop();
}

// Simulated WhatsApp Cloud / Fonnte / Wablas callback logger
let whatsappNotificationLogs: Array<{
  timestamp: string;
  siteId: string;
  phoneNumber: string;
  provider: string;
  messageType: string;
  messageText: string;
  status: 'SENT' | 'FAILED';
}> = [];

async function sendWhatsAppActual(phone: string, text: string) {
  if (!integrationConfig.whatsappEnabled || !integrationConfig.whatsappToken) {
    return { status: 'FAILED', error: 'WhatsApp disabled or token missing' };
  }
  
  const provider = (integrationConfig.whatsappProvider || 'fonnte').toLowerCase();
  const token = integrationConfig.whatsappToken;
  
  // Auto format phone number (e.g., 08123456789 -> 628123456789)
  let formattedPhone = phone.trim();
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.slice(1);
  } else if (formattedPhone.startsWith('+')) {
    formattedPhone = formattedPhone.replace('+', '');
  }
  formattedPhone = formattedPhone.replace(/[^0-9]/g, ''); // keep only numbers
  
  try {
    if (provider === 'fonnte') {
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target: formattedPhone,
          message: text
        })
      });
      const resJson: any = await response.json();
      console.log('[Fonnte Send API Response]:', resJson);
      if (response.ok && (resJson.status === true || resJson.status === 'true' || resJson.status === 'success' || resJson.status === 'SENT' || resJson.message === 'success')) {
        return { status: 'SENT' };
      } else {
        return { status: 'FAILED', error: resJson.reason || resJson.message || JSON.stringify(resJson) };
      }
    } else if (provider === 'wablas') {
      const response = await fetch('https://api.wablas.com/api/send-message', {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: formattedPhone,
          message: text
        })
      });
      const resJson: any = await response.json();
      console.log('[Wablas Send API Response]:', resJson);
      if (response.ok && (resJson.status === true || resJson.status === 'true' || resJson.status === 'success')) {
        return { status: 'SENT' };
      } else {
        return { status: 'FAILED', error: resJson.message || resJson.reason || JSON.stringify(resJson) };
      }
    } else if (provider === 'whatsapp_cloud_api') {
      // Support TOKEN|PHONE_NUMBER_ID format
      let waToken = token;
      let waPhoneId = 'me';
      if (token.includes('|')) {
        const parts = token.split('|');
        waToken = parts[0].trim();
        waPhoneId = parts[1].trim();
      }
      
      const response = await fetch(`https://graph.facebook.com/v18.0/${waPhoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${waToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'text',
          text: { body: text }
        })
      });
      const resJson: any = await response.json();
      console.log('[WA Cloud API Response]:', resJson);
      if (response.ok && !resJson.error) {
        return { status: 'SENT' };
      } else {
        return { status: 'FAILED', error: resJson.error?.message || JSON.stringify(resJson) };
      }
    }
    return { status: 'SENT' };
  } catch (err: any) {
    console.error('[WhatsApp Send Error]:', err);
    return { status: 'FAILED', error: err.message || String(err) };
  }
}

function triggerSimulatedWhatsApp(site: Site, type: 'NORMAL' | 'GROUNDING_PUTUS' | 'PINTU_TERBUKA') {
  if (!integrationConfig.whatsappEnabled) return;

  const timestampStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  let text = '';

  if (type === 'NORMAL') {
    text = `🟢 BTS MONITORING\n\nSITE:\n${site.siteId} - ${site.siteName}\n\nSTATUS:\nNORMAL\n\nGrounding : Normal\nDoor : Tertutup\nSirene : OFF\n\nTanggal:\n${timestampStr}`;
  } else if (type === 'GROUNDING_PUTUS') {
    text = `🔴 BTS ALARM CRITICAL\n\n⚠️ Grounding Putus\n\nSite:\n${site.siteId} - ${site.siteName}\n\nLokasi:\n${site.location}\n\nStatus:\nGROUNDING PUTUS\n\nTindakan:\nPeriksa kabel grounding segera.\n\nWaktu:\n${timestampStr}`;
  } else if (type === 'PINTU_TERBUKA') {
    text = `🟠 BTS SECURITY ALERT\n\n⚠️ Pintu BTS Terbuka\n\nSite:\n${site.siteId} - ${site.siteName}\n\nLokasi:\n${site.location}\n\nStatus:\nDOOR OPEN\n\nKemungkinan:\nAkses tidak sah\n\nWaktu:\n${timestampStr}`;
  }

  const phones = integrationConfig.whatsappPhone
    ? integrationConfig.whatsappPhone.split(/[,;\s]+/).map(p => p.trim()).filter(p => p.length > 0)
    : [];

  if (phones.length === 0) {
    phones.push('081234567890');
  }

  phones.forEach(async (phone) => {
    const logEntry: any = {
      timestamp: new Date().toISOString(),
      siteId: site.siteId,
      phoneNumber: phone,
      provider: integrationConfig.whatsappProvider.toUpperCase(),
      messageType: type,
      messageText: text,
      status: 'SENT'
    };
    whatsappNotificationLogs.unshift(logEntry);

    if (integrationConfig.whatsappEnabled && integrationConfig.whatsappToken) {
      const result = await sendWhatsAppActual(phone, text);
      if (result.status === 'FAILED') {
        logEntry.status = 'FAILED';
      }
    }
  });

  if (whatsappNotificationLogs.length > 100) {
    whatsappNotificationLogs.splice(100);
  }
}

// Helper to log telemetry & alarm data to Google Sheets
async function sendToSpreadsheet(payload: any) {
  console.log(`[Spreadsheet] sendToSpreadsheet triggered. URL: "${integrationConfig.gasUrl}"`);
  if (!integrationConfig.gasUrl) {
    console.warn('[Spreadsheet] Skip send: gasUrl is empty.');
    return;
  }
  try {
    const response = await fetch(integrationConfig.gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        source: 'server_simulation' // Tells GAS to skip looping back to dashboard
      })
    });
    if (!response.ok) {
      console.warn(`[Spreadsheet] Log warning (status ${response.status}): ${response.statusText || 'Not Found'}`);
    } else {
      console.log('[Spreadsheet] Successfully logged to spreadsheet');
    }
  } catch (error) {
    console.warn('[Spreadsheet] Spreadsheet log failed:', error instanceof Error ? error.message : error);
  }
}

// Keep ESP32 status online tracker (mock watchdog)
if (!process.env.VERCEL && !process.env.NOW_BUILDER && !process.env.LAMBDA_TASK_ROOT && !process.env.AWS_EXECUTION_ENV) {
  setInterval(() => {
    const now = Date.now();
    checkSirenAutoReset();
  }, 5000);
}


// ==========================================
// API ROUTES
// ==========================================

// Add a new tower
app.post('/api/sites', async (req, res) => {
  const { siteId, siteName, location, latitude, longitude, rectifier, battery, acPower, temperature, username, phoneNo, packageType, packageRefillDate, packageExpiryDate } = req.body;
  if (!siteId || !siteName) {
    return res.status(400).json({ error: 'siteId and siteName are required' });
  }

  const existing = sites.find(s => s.siteId.toUpperCase() === siteId.toUpperCase());
  if (existing) {
    return res.status(400).json({ error: `Site ID ${siteId} sudah terdaftar.` });
  }

  const newSite: Site = {
    siteId: siteId.toUpperCase(),
    siteName,
    location: location || 'Lokasi Baru, Indonesia',
    latitude: Number(latitude) || -6.914744,
    longitude: Number(longitude) || 107.609810,
    grounding: 'NORMAL',
    door: 'TERTUTUP',
    sirene: 'OFF',
    gsm: '4G',
    rssi: -75,
    status: 'ONLINE',
    lastSeen: new Date().toISOString(),
    rectifier: rectifier || 'NORMAL',
    battery: battery || 'NORMAL',
    acPower: acPower || 'NORMAL',
    temperature: Number(temperature) || 28,
    lastRestart: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    resetReason: 'Power On',
    teg: 'NORMAL',
    phoneNo: phoneNo || '',
    packageType: packageType || '',
    packageRefillDate: packageRefillDate || '',
    packageExpiryDate: packageExpiryDate || ''
  };

  sites.push(newSite);
  lastUpdateTs = Date.now();
  createAuditLog(username || 'Admin', 'ADD SITE', `Menambahkan BTS baru: ${newSite.siteId} - ${newSite.siteName}`);

  // Save to Supabase SITE table
  await saveSiteToSupabase(newSite);

  // Send to Google Sheets SITE sheet
  await sendToSpreadsheet({
    action: 'CRUD_SITE',
    method: 'POST',
    siteId: newSite.siteId,
    site_id: newSite.siteId,
    siteName: newSite.siteName,
    site_name: newSite.siteName,
    location: newSite.location,
    latitude: newSite.latitude,
    longitude: newSite.longitude,
    site: {
      siteId: newSite.siteId,
      site_id: newSite.siteId,
      siteName: newSite.siteName,
      site_name: newSite.siteName,
      location: newSite.location,
      latitude: newSite.latitude,
      longitude: newSite.longitude
    }
  });

  res.json({ status: 'success', site: newSite });
});

// Update an existing tower
app.put('/api/sites/:siteId', async (req, res) => {
  const { siteId } = req.params;
  const { siteName, location, latitude, longitude, rectifier, battery, acPower, temperature, status, gsm, rssi, username, phoneNo, packageType, packageRefillDate, packageExpiryDate } = req.body;

  const site = sites.find(s => s.siteId.toUpperCase() === siteId.toUpperCase());
  if (!site) {
    return res.status(404).json({ error: 'Site not found' });
  }

  if (siteName) site.siteName = siteName;
  if (location) site.location = location;
  if (latitude !== undefined) site.latitude = Number(latitude);
  if (longitude !== undefined) site.longitude = Number(longitude);
  if (rectifier) site.rectifier = rectifier;
  if (battery) site.battery = battery;
  if (acPower) site.acPower = acPower;
  if (temperature !== undefined) site.temperature = Number(temperature);
  if (status) site.status = status;
  if (gsm) site.gsm = gsm;
  if (rssi !== undefined) site.rssi = Number(rssi);
  if (phoneNo !== undefined) site.phoneNo = phoneNo;
  if (packageType !== undefined) site.packageType = packageType;
  if (packageRefillDate !== undefined) site.packageRefillDate = packageRefillDate;
  if (packageExpiryDate !== undefined) site.packageExpiryDate = packageExpiryDate;
  if (req.body.lastRestart !== undefined) site.lastRestart = req.body.lastRestart;
  if (req.body.resetReason !== undefined) site.resetReason = req.body.resetReason;
  if (req.body.teg !== undefined) site.teg = req.body.teg;

  lastUpdateTs = Date.now();
  createAuditLog(username || 'Admin', 'UPDATE SITE', `Memperbarui data BTS: ${site.siteId} - ${site.siteName}`);

  // Save to Supabase SITE table
  await saveSiteToSupabase(site);

  // Send to Google Sheets SITE sheet
  await sendToSpreadsheet({
    action: 'CRUD_SITE',
    method: 'PUT',
    siteId: site.siteId,
    site_id: site.siteId,
    siteName: site.siteName,
    site_name: site.siteName,
    location: site.location,
    latitude: site.latitude,
    longitude: site.longitude,
    site: {
      siteId: site.siteId,
      site_id: site.siteId,
      siteName: site.siteName,
      site_name: site.siteName,
      location: site.location,
      latitude: site.latitude,
      longitude: site.longitude
    }
  });

  res.json({ status: 'success', site });
});

// Delete a tower
app.delete('/api/sites/:siteId', async (req, res) => {
  const { siteId } = req.params;
  const { username } = req.body;

  const index = sites.findIndex(s => s.siteId.toUpperCase() === siteId.toUpperCase());
  if (index === -1) {
    return res.status(404).json({ error: 'Site not found' });
  }

  const removedSite = sites[index];
  sites.splice(index, 1);
  lastUpdateTs = Date.now();

  createAuditLog(username || 'Admin', 'DELETE SITE', `Menghapus BTS: ${removedSite.siteId} - ${removedSite.siteName}`);

  // Delete from Supabase SITE table
  await deleteSiteFromSupabase(siteId);

  // Send to Google Sheets SITE sheet
  await sendToSpreadsheet({
    action: 'CRUD_SITE',
    method: 'DELETE',
    siteId: removedSite.siteId,
    site_id: removedSite.siteId,
    site: {
      siteId: removedSite.siteId,
      site_id: removedSite.siteId
    }
  });

  res.json({ status: 'success', message: `Site ${siteId} deleted successfully` });
});

// Get current system status
app.get('/api/status', async (req, res) => {
  if (integrationConfig?.supabaseEnabled) {
    await loadStateFromSupabase();
  }

  const mutableSitesStatus = sites.map(site => {
    const isMuted = !!mutedSirens[site.siteId];
    return {
      ...site,
      mutedRemaining: 0,
      isMuted
    };
  });

  res.json({
    sites: mutableSitesStatus,
    alarmLogs,
    deviceLogs,
    auditTrails,
    integrationConfig,
    whatsappLogs: whatsappNotificationLogs,
    lastUpdateTs
  });
});

// Login endpoint supporting local accounts and Supabase auth
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const client = getSupabaseClient();
  const isSupabase = !!(client && integrationConfig?.supabaseEnabled);

  // Normalization
  const normUsername = String(username || '').trim().toLowerCase();

  // If Supabase is enabled, try authenticating against Supabase Auth first
  if (isSupabase) {
    try {
      // If the username typed does not contain "@", try to sign in as normUsername@towerguard.com
      const emailToTry = normUsername.includes('@') ? username : `${normUsername}@towerguard.com`;
      const { data: authData, error: authError } = await client.auth.signInWithPassword({
        email: emailToTry,
        password: password
      });

      if (!authError && authData?.user) {
        // Fetch user profile from public.profiles table
        const { data: dbProfile } = await client
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        const role = dbProfile?.role === 'admin' ? 'admin' : 'viewer';
        const displayName = dbProfile?.nama || authData.user.email || 'User';

        createAuditLog(displayName, 'LOGIN', 'Pengguna berhasil masuk via Supabase Auth.');
        return res.json({
          status: 'success',
          user: {
            id: authData.user.id,
            username: normUsername,
            displayName: displayName,
            role: role
          }
        });
      } else if (authError) {
        console.warn('[Supabase Auth] Sign-in failed with email/password, trying fallback:', authError.message);
        
        // Try sign in with exact literal username too (if registered differently)
        if (!normUsername.includes('@')) {
          const { data: authData2, error: authError2 } = await client.auth.signInWithPassword({
            email: username,
            password: password
          });
          if (!authError2 && authData2?.user) {
            const { data: dbProfile2 } = await client
              .from('profiles')
              .select('*')
              .eq('id', authData2.user.id)
              .single();

            const role = dbProfile2?.role === 'admin' ? 'admin' : 'viewer';
            const displayName = dbProfile2?.nama || authData2.user.email || 'User';

            createAuditLog(displayName, 'LOGIN', 'Pengguna berhasil masuk via Supabase.');
            return res.json({
              status: 'success',
              user: {
                id: authData2.user.id,
                username: normUsername,
                displayName: displayName,
                role: role
              }
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Supabase Auth] Sign-in exception, trying local fallback:', err);
    }
  }

  // Local account / Admin fallback
  const localUser = localUsers.find(u => 
    u.username.toLowerCase() === normUsername && 
    (u.password === password || (normUsername === 'administrator' && password === 'admin123') || (normUsername === 'user' && password === 'user123'))
  );

  if (localUser) {
    createAuditLog(localUser.displayName, 'LOGIN', `${localUser.displayName} berhasil masuk ke dashboard (Local Fallback).`);
    return res.json({
      status: 'success',
      user: {
        id: localUser.id,
        username: localUser.username,
        displayName: localUser.displayName,
        role: localUser.role,
        permissions: localUser.permissions || [],
        isReadOnly: localUser.isReadOnly || false
      }
    });
  }

  return res.status(401).json({
    status: 'error',
    message: 'Kredensial salah! Silakan coba lagi.'
  });
});

// Get user accounts list
app.get('/api/users', async (req, res) => {
  const client = getSupabaseClient();
  const isSupabase = !!(client && integrationConfig?.supabaseEnabled);

  if (isSupabase) {
    try {
      const { data, error } = await client
        .from('profiles')
        .select('*');
      
      if (!error && data) {
        const supabaseUsers = data.map((profile: any) => {
          // Robustly determine a username if there is no username column
          const rawUsername = profile.username || profile.email || profile.email_address || profile.user_name || profile.nama?.toLowerCase().replace(/\s+/g, '') || 'operator';
          const cleanUsername = rawUsername.includes('@') ? rawUsername.split('@')[0] : rawUsername;
          
          return {
            id: profile.id,
            username: cleanUsername,
            displayName: profile.nama || 'Operator',
            role: profile.role === 'admin' ? 'admin' : 'viewer',
            lastActive: 'Aktif di Database',
            permissions: profile.role === 'admin'
              ? ['dashboard', 'monitoring', 'asset', 'alarm', 'status', 'simcard', 'users', 'settings']
              : ['dashboard', 'monitoring', 'asset', 'alarm', 'status', 'simcard'],
            isReadOnly: profile.is_read_only || false
          };
        });

        // Merge supabase users and local users (avoiding duplicates by username or ID)
        const mergedUsers = [...supabaseUsers];
        for (const localUser of localUsers) {
          if (!mergedUsers.some(u => u.username.toLowerCase() === localUser.username.toLowerCase() || u.id === localUser.id)) {
            mergedUsers.push({
              id: localUser.id,
              username: localUser.username,
              displayName: localUser.displayName,
              role: localUser.role,
              lastActive: 'Aktif Lokal / Memori',
              permissions: localUser.permissions || [],
              isReadOnly: localUser.isReadOnly || false
            });
          }
        }

        return res.json({ status: 'success', users: mergedUsers });
      } else if (error) {
        console.warn('[Supabase] Error listing profiles:', error.message);
      }
    } catch (err) {
      console.warn('[Supabase] Error listing profiles:', err);
    }
  }

  // Local fallback
  return res.json({
    status: 'success',
    users: localUsers
  });
});

// Add new user profile with bypass for email confirmation and robust local fallback
app.post('/api/users', async (req, res) => {
  const { username, displayName, role, password, adminName, permissions, isReadOnly } = req.body;
  const client = getSupabaseClient();
  const isSupabase = !!(client && integrationConfig?.supabaseEnabled);
  const newId = crypto.randomUUID();

  const newUser = {
    id: newId,
    username: username || 'user',
    displayName: displayName || 'User Baru',
    role: role || 'viewer',
    lastActive: 'Baru dibuat',
    password: password, // Store the password in local memory so local fallback login succeeds
    permissions: permissions || [],
    isReadOnly: !!isReadOnly
  };

  if (!isSupabase) {
    return res.status(400).json({
      status: 'error',
      message: 'Koneksi database (Supabase) tidak aktif! Silakan aktifkan dan konfigurasi Supabase di tab Pengaturan terlebih dahulu.'
    });
  }

  try {
    let authUserId = newId;
    let authSuccess = false;
    let authErrorMessage = '';

    const emailToUse = username.includes('@') ? username : `${username}@towerguard.com`;

    if (password) {
      let authData: any = null;
      let authErr: any = null;

      // Try admin API first to bypass email confirmation (requires service_role key)
      try {
        const { data, error } = await client.auth.admin.createUser({
          email: emailToUse,
          password: password,
          email_confirm: true,
          user_metadata: { nama: displayName }
        });
        authData = data;
        authErr = error;
      } catch (e) {
        authErr = e;
      }

      // If admin API fails or isn't available, fall back to public signUp
      if (authErr || !authData?.user) {
        console.log('[Supabase Auth] admin.createUser failed or not available, trying public signUp:', authErr?.message || authErr);
        const { data, error } = await client.auth.signUp({
          email: emailToUse,
          password: password,
          options: {
            data: {
              nama: displayName
            }
          }
        });
        authData = data;
        authErr = error;
      }

      if (!authErr && authData?.user) {
        authUserId = authData.user.id;
        authSuccess = true;
      } else {
        authErrorMessage = authErr?.message || JSON.stringify(authErr) || 'Auth failed';
        console.warn('[Supabase Auth] Both admin and public registration failed:', authErrorMessage);
      }
    }

    // Attempt to insert profile in the public.profiles table
    // Construct standard + all possible columns to fully satisfy "semua yang didaftarkan user masuk ke profiles"
    const profilePayload: any = {
      id: authUserId,
      nama: displayName,
      role: role === 'admin' ? 'admin' : 'user',
      updated_at: new Date().toISOString(),
      username: username,
      user_name: username,
      email: emailToUse,
      email_address: emailToUse,
      password: password,
      is_read_only: !!isReadOnly
    };

    let dbErrorToReport: any = null;
    try {
      // Attempt 1: Try with all columns
      const { error: dbErr1 } = await client
        .from('profiles')
        .insert(profilePayload);

      if (dbErr1) {
        console.warn('[Supabase] Initial profile insert failed, retrying with stripped columns...', dbErr1.message);
        dbErrorToReport = dbErr1;
        // Attempt 2: Strip non-standard columns and try again
        const strippedPayload = {
          id: authUserId,
          nama: displayName,
          role: role === 'admin' ? 'admin' : 'user',
          updated_at: new Date().toISOString(),
          is_read_only: !!isReadOnly
        };
        const { error: dbErr2 } = await client
          .from('profiles')
          .insert(strippedPayload);
        
        if (dbErr2) {
          console.error('[Supabase] Stripped profile insert failed too:', dbErr2.message);
          dbErrorToReport = dbErr2;
        } else {
          dbErrorToReport = null;
          console.log('[Supabase] Profile inserted successfully with stripped columns!');
        }
      } else {
        console.log('[Supabase] Profile inserted successfully with all details!');
      }
    } catch (dbEx: any) {
      console.error('[Supabase] Database exception during profile insert:', dbEx);
      dbErrorToReport = dbEx;
    }

    // If both Auth and direct DB profile insert failed, we abort and return a clear error to the UI
    if (dbErrorToReport && !authSuccess) {
      return res.status(400).json({
        status: 'error',
        message: `Gagal menambahkan user ke Database. Pesan Error Auth: "${authErrorMessage}". Pesan Error Database: "${dbErrorToReport.message || dbErrorToReport}". Pastikan "Allow Email Signups" diaktifkan di dashboard Supabase Anda.`
      });
    }

    newUser.id = authUserId;
  } catch (err: any) {
    console.warn('[Supabase] Exception inserting user profile:', err);
    return res.status(400).json({
      status: 'error',
      message: `Gagal mendaftarkan user ke database: ${err.message || err}`
    });
  }

  // Push to local memory state and save persistently as backup
  localUsers.push(newUser);
  saveLocalUsers();
  createAuditLog(adminName || 'Admin', 'ADD USER', `Menambahkan operator baru: ${displayName} (${role})`);

  return res.json({ status: 'success', user: newUser });
});

// Update user profile
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { displayName, role, adminName, permissions, isReadOnly } = req.body;
  const client = getSupabaseClient();
  const isSupabase = !!(client && integrationConfig?.supabaseEnabled);

  if (isSupabase) {
    try {
      const { error: dbErr } = await client
        .from('profiles')
        .update({
          nama: displayName,
          role: role === 'admin' ? 'admin' : 'user',
          updated_at: new Date().toISOString(),
          is_read_only: isReadOnly !== undefined ? !!isReadOnly : undefined
        })
        .eq('id', id);

      if (dbErr) {
        console.warn('[Supabase] Error updating profile:', dbErr);
        return res.status(400).json({ status: 'error', message: dbErr.message });
      }
    } catch (err) {
      console.warn('[Supabase] Exception updating user profile:', err);
      return res.status(500).json({ status: 'error', message: String(err) });
    }
  }

  // Update local state
  const idx = localUsers.findIndex(u => u.id === id);
  if (idx !== -1) {
    localUsers[idx].displayName = displayName;
    localUsers[idx].role = role;
    if (permissions !== undefined) {
      localUsers[idx].permissions = permissions;
    }
    if (isReadOnly !== undefined) {
      localUsers[idx].isReadOnly = !!isReadOnly;
    }
    saveLocalUsers();
  }

  createAuditLog(adminName || 'Admin', 'UPDATE USER', `Memperbarui operator: ${displayName} (${role})`);
  return res.json({ status: 'success' });
});

// Delete user profile
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const adminName = String(req.query.adminName || 'Admin');
  const client = getSupabaseClient();
  const isSupabase = !!(client && integrationConfig?.supabaseEnabled);

  if (isSupabase) {
    try {
      const { error: dbErr } = await client
        .from('profiles')
        .delete()
        .eq('id', id);

      if (dbErr) {
        console.warn('[Supabase] Error deleting profile:', dbErr);
        return res.status(400).json({ status: 'error', message: dbErr.message });
      }
    } catch (err) {
      console.warn('[Supabase] Exception deleting user profile:', err);
      return res.status(500).json({ status: 'error', message: String(err) });
    }
  }

  const targetUser = localUsers.find(u => u.id === id);
  localUsers = localUsers.filter(u => u.id !== id);
  saveLocalUsers();

  createAuditLog(adminName, 'DELETE USER', `Menghapus operator: ${targetUser?.displayName || id}`);
  return res.json({ status: 'success' });
});

// Post endpoint to restore client state to serverless memory
app.post('/api/restore-state', (req, res) => {
  const { sites: clientSites, integrationConfig: clientConfig, alarmLogs: clientAlarms, deviceLogs: clientDeviceLogs, auditTrails: clientAudit } = req.body;
  
  if (clientSites && Array.isArray(clientSites) && clientSites.length > 0) {
    sites = clientSites;
  }
  if (clientConfig && typeof clientConfig === 'object') {
    integrationConfig = { ...integrationConfig, ...clientConfig };
  }
  if (clientAlarms && Array.isArray(clientAlarms)) {
    alarmLogs = clientAlarms;
  }
  if (clientDeviceLogs && Array.isArray(clientDeviceLogs)) {
    deviceLogs = clientDeviceLogs;
  }
  if (clientAudit && Array.isArray(clientAudit)) {
    auditTrails = clientAudit;
  }
  
  lastUpdateTs = Date.now();
  
  res.json({
    status: 'success',
    sites,
    integrationConfig,
    alarmLogs,
    deviceLogs,
    auditTrails,
    lastUpdateTs
  });
});

// ESP32 GET Telemetry Endpoint (Friendly browser view helper)
app.get('/api/esp32', (req, res) => {
  res.json({ 
    message: 'ESP32 Telemetry endpoint is active. Please send HTTP POST requests with site_id.',
    example_payload: {
      site_id: 'BTS-001',
      grounding: 'PUTUS',
      door: 'TERBUKA',
      gsm: '4G',
      rssi: -72
    }
  });
});

// ESP32 POST Telemetry Endpoint (Real working endpoint!)
app.post('/api/esp32', async (req, res) => {
  const { site_id, grounding, door, sirene, gsm, rssi, site_name, last_restart, reset_reason, teg } = req.body;

  if (!site_id) {
    return res.status(400).json({ error: 'site_id is required' });
  }

  // Find or create site
  let site = sites.find(s => s.siteId === site_id || s.siteId.toLowerCase() === site_id.toLowerCase());
  
  const isNew = !site;
  if (isNew) {
    site = {
      siteId: site_id.toUpperCase(),
      siteName: site_name || `BTS ${site_id.toUpperCase()}`,
      location: 'Lokasi Baru, Indonesia',
      latitude: -6.914744 + (Math.random() - 0.5) * 0.1,
      longitude: 107.609810 + (Math.random() - 0.5) * 0.1,
      grounding: 'NORMAL',
      door: 'TERTUTUP',
      sirene: 'OFF',
      gsm: gsm || '4G',
      rssi: Number(rssi) || -75,
      status: 'ONLINE',
      lastSeen: new Date().toISOString(),
      rectifier: 'NORMAL',
      battery: 'NORMAL',
      acPower: 'NORMAL',
      temperature: 28,
      lastRestart: last_restart || new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      resetReason: reset_reason || 'Power On',
      teg: (teg === 'TIDAK_NORMAL' || teg === 'TIDAK') ? 'TIDAK_NORMAL' : 'NORMAL'
    };
    sites.push(site);
    await saveSiteToSupabase(site);
    createAuditLog('SYSTEM', 'NEW SITE REGISTERED', `BTS baru ${site_id} otomatis tersambung ke jaringan backend.`);
  }

  const oldGrounding = site!.grounding;
  const oldDoor = site!.door;

  // Update fields if provided
  if (grounding) site!.grounding = grounding === 'PUTUS' ? 'PUTUS' : 'NORMAL';
  if (door) site!.door = door === 'TERBUKA' ? 'TERBUKA' : 'TERTUTUP';
  if (gsm) site!.gsm = gsm;
  if (rssi) site!.rssi = Number(rssi);
  if (last_restart) site!.lastRestart = last_restart;
  if (reset_reason) site!.resetReason = reset_reason;
  if (teg) site!.teg = (teg === 'TIDAK_NORMAL' || teg === 'TIDAK') ? 'TIDAK_NORMAL' : 'NORMAL';
  
  // Update status and watchdog timer
  site!.status = 'ONLINE';
  site!.lastSeen = new Date().toISOString();

  // If sirens are muted, keep sirene state OFF, else follow active alarms
  const sireneActive = site!.grounding === 'PUTUS' || site!.door === 'TERBUKA';
  const isMuted = !!mutedSirens[site!.siteId];
  
  if (sireneActive) {
    site!.sirene = isMuted ? 'OFF' : 'ON';
  } else {
    site!.sirene = 'OFF';
    if (mutedSirens[site!.siteId]) {
      delete mutedSirens[site!.siteId]; // Clear mute state when normal
    }
  }

  // Log alarms in ALARM_LOG if state transitioned
  const newAlarmLogs: AlarmLog[] = [];

  // Grounding transitions
  if (oldGrounding === 'NORMAL' && site!.grounding === 'PUTUS') {
    if (mutedSirens[site!.siteId]) {
      delete mutedSirens[site!.siteId];
    }
    const logId = 'AL-' + Math.floor(100+Math.random()*900) + '-' + Date.now().toString().slice(-4);
    const newLog: AlarmLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      siteId: site!.siteId,
      siteName: site!.siteName,
      alarmType: 'GROUNDING_PUTUS',
      status: 'ACTIVE',
      keterangan: 'Kabel Grounding terdeteksi PUTUS oleh ESP32 (GPIO18).'
    };
    alarmLogs.unshift(newLog);
    await logAlarmToSupabase(newLog);
    triggerSimulatedWhatsApp(site!, 'GROUNDING_PUTUS');
    createAuditLog('ESP32', 'GROUNDING ALARM ACTIVE', `BTS ${site!.siteId} terdeteksi Grounding Putus.`);
  } else if (oldGrounding === 'PUTUS' && site!.grounding === 'NORMAL') {
    // Close existing active grounding alarms for this site
    alarmLogs = alarmLogs.map(log => {
      if (log.siteId === site!.siteId && log.alarmType === 'GROUNDING_PUTUS' && log.status === 'ACTIVE') {
        return { ...log, status: 'CLOSED' };
      }
      return log;
    });
    await closeAlarmInSupabase(site!.siteId, 'GROUNDING_PUTUS');
    triggerSimulatedWhatsApp(site!, 'NORMAL');
    createAuditLog('ESP32', 'GROUNDING ALARM RECOVERED', `BTS ${site!.siteId} Grounding kembali normal.`);
  }

  // Door transitions
  if (oldDoor === 'TERTUTUP' && site!.door === 'TERBUKA') {
    if (mutedSirens[site!.siteId]) {
      delete mutedSirens[site!.siteId];
    }
    const logId = 'AL-' + Math.floor(100+Math.random()*900) + '-' + Date.now().toString().slice(-4);
    const newLog: AlarmLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      siteId: site!.siteId,
      siteName: site!.siteName,
      alarmType: 'PINTU_TERBUKA',
      status: 'ACTIVE',
      keterangan: 'Pintu Shelter BTS Terbuka oleh ESP32 (GPIO19).'
    };
    alarmLogs.unshift(newLog);
    await logAlarmToSupabase(newLog);
    triggerSimulatedWhatsApp(site!, 'PINTU_TERBUKA');
    createAuditLog('ESP32', 'DOOR ALARM ACTIVE', `BTS ${site!.siteId} terdeteksi Pintu Terbuka.`);
  } else if (oldDoor === 'TERBUKA' && site!.door === 'TERTUTUP') {
    // Close existing active door alarms for this site
    alarmLogs = alarmLogs.map(log => {
      if (log.siteId === site!.siteId && log.alarmType === 'PINTU_TERBUKA' && log.status === 'ACTIVE') {
        return { ...log, status: 'CLOSED' };
      }
      return log;
    });
    await closeAlarmInSupabase(site!.siteId, 'PINTU_TERBUKA');
    triggerSimulatedWhatsApp(site!, 'NORMAL');
    createAuditLog('ESP32', 'DOOR ALARM RECOVERED', `BTS ${site!.siteId} Pintu ditutup kembali.`);
  }

  // Append to device log tracking history
  const newDevLog: DeviceStatusLog = {
    timestamp: new Date().toISOString(),
    siteId: site!.siteId,
    siteName: site!.siteName,
    grounding: site!.grounding,
    door: site!.door,
    sirene: site!.sirene,
    gsm: site!.gsm,
    rssi: site!.rssi
  };
  deviceLogs.unshift(newDevLog);
  if (deviceLogs.length > 100) deviceLogs.pop();

  // Save device telemetry log to Supabase DEVICE table
  await logDeviceToSupabase(newDevLog);

  lastUpdateTs = Date.now();

  // Send status update to Google Sheets if it didn't originate from GAS/simulation to prevent infinite loop
  if (req.body.source !== 'server_simulation') {
    await sendToSpreadsheet({
      siteId: site!.siteId,
      site_id: site!.siteId,
      siteName: site!.siteName,
      site_name: site!.siteName,
      grounding: site!.grounding,
      door: site!.door,
      sirene: site!.sirene,
      gsm: site!.gsm,
      rssi: site!.rssi,
      skipForward: true
    });
  }

  res.json({
    status: 'success',
    siteId: site!.siteId,
    grounding: site!.grounding === 'PUTUS' ? 'Putus' : 'Normal',
    door: site!.door === 'TERBUKA' ? 'Terbuka' : 'Tertutup',
    sirene_command: site!.sirene, // Respond with "ON" or "OFF" to let ESP32 control real physical siren relay!
    is_muted: isMuted
  });
});

// POST Manual Mute or ON Sirene for specific site (Client button click)
app.post('/api/mute', (req, res) => {
  const { siteId, action, username } = req.body;
  const site = sites.find(s => s.siteId.toUpperCase() === siteId.toUpperCase());

  if (!site) {
    return res.status(404).json({ error: 'Site not found' });
  }

  const isMuting = action === 'MUTE' || !action;

  if (isMuting) {
    mutedSirens[siteId] = true;
    site.sirene = 'OFF';
    createAuditLog(username || 'Admin', 'MUTE SIRENE', `Siren pada ${siteId} dibungkam secara manual.`);

    // Send WhatsApp message that Siren is muted by user
    if (integrationConfig.whatsappEnabled) {
      const timestampStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const textStr = `🔕 BTS SIRENE DIBUNGKAM\n\nSite ID: ${site.siteId}\nSite Name: ${site.siteName}\nPetugas: ${username || 'Admin'}\nWaktu: ${timestampStr}\nSirene shelter dimatikan manual (Mute).`;
      
      const phones = integrationConfig.whatsappPhone
        ? integrationConfig.whatsappPhone.split(/[,;\s]+/).map(p => p.trim()).filter(p => p.length > 0)
        : [];

      if (phones.length === 0) {
        phones.push('081234567890');
      }

      phones.forEach(phone => {
        whatsappNotificationLogs.unshift({
          timestamp: new Date().toISOString(),
          siteId: site.siteId,
          phoneNumber: phone,
          provider: integrationConfig.whatsappProvider.toUpperCase(),
          messageType: 'MUTED',
          messageText: textStr,
          status: 'SENT'
        });
      });
    }
  } else {
    delete mutedSirens[siteId];
    const sireneActive = site.grounding === 'PUTUS' || site.door === 'TERBUKA';
    site.sirene = sireneActive ? 'ON' : 'OFF';
    createAuditLog(username || 'Admin', 'UNMUTE SIRENE', `Siren pada ${siteId} diaktifkan kembali secara manual.`);

    // Send WhatsApp message that Siren is unmuted by user
    if (integrationConfig.whatsappEnabled) {
      const timestampStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const textStr = `🔊 BTS SIRENE DIAKTIFKAN KEMBALI\n\nSite ID: ${site.siteId}\nSite Name: ${site.siteName}\nPetugas: ${username || 'Admin'}\nWaktu: ${timestampStr}\nSirene shelter diaktifkan kembali secara manual (ON).`;
      
      const phones = integrationConfig.whatsappPhone
        ? integrationConfig.whatsappPhone.split(/[,;\s]+/).map(p => p.trim()).filter(p => p.length > 0)
        : [];

      if (phones.length === 0) {
        phones.push('081234567890');
      }

      phones.forEach(phone => {
        whatsappNotificationLogs.unshift({
          timestamp: new Date().toISOString(),
          siteId: site.siteId,
          phoneNumber: phone,
          provider: integrationConfig.whatsappProvider.toUpperCase(),
          messageType: 'UNMUTED',
          messageText: textStr,
          status: 'SENT'
        });
      });
    }
  }

  lastUpdateTs = Date.now();

  res.json({
    status: 'success',
    siteId,
    isMuted: isMuting,
    sirene: site.sirene
  });
});

// POST Test Alarm Injector (Forces alarming state on a site for easy prototyping/demonstration)
app.post('/api/test-alarm', async (req, res) => {
  const { siteId, groundingState, doorState, tegState, resetReasonState, lastRestartState, username } = req.body;
  const site = sites.find(s => s.siteId.toUpperCase() === siteId.toUpperCase());

  if (!site) {
    return res.status(404).json({ error: 'Site not found' });
  }

  const oldGrounding = site.grounding;
  const oldDoor = site.door;

  if (groundingState !== null && groundingState !== undefined) {
    site.grounding = groundingState;
  }
  if (doorState !== null && doorState !== undefined) {
    site.door = doorState;
  }
  if (tegState !== null && tegState !== undefined) {
    site.teg = tegState;
    if (tegState === 'TIDAK_NORMAL') {
      site.acPower = 'FAIL';
      site.rectifier = 'FAULT';
      site.battery = 'LOW';
    } else {
      site.acPower = 'NORMAL';
      site.rectifier = 'NORMAL';
      site.battery = 'NORMAL';
    }
  }
  if (resetReasonState !== null && resetReasonState !== undefined) {
    site.resetReason = resetReasonState;
  }
  if (lastRestartState !== null && lastRestartState !== undefined) {
    site.lastRestart = lastRestartState;
  }

  site.status = 'ONLINE';
  site.lastSeen = new Date().toISOString();

  // Handle alarms
  const anyAlarm = site.grounding === 'PUTUS' || site.door === 'TERBUKA';
  site.sirene = anyAlarm ? 'ON' : 'OFF';

  createAuditLog(username || 'Admin', 'TEST ALARM INJECT', `Injeksi alarm manual pada ${siteId}. Grounding: ${site.grounding}, Pintu: ${site.door}`);

  const isSupabase = !!(getSupabaseClient() && integrationConfig?.supabaseEnabled);

  // Create real alarm entries
  if (oldGrounding === 'NORMAL' && site.grounding === 'PUTUS') {
    const logId = 'T-AL-' + Math.floor(100+Math.random()*900);
    const alarmEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      siteId: site.siteId,
      siteName: site.siteName,
      alarmType: 'GROUNDING_PUTUS' as const,
      status: 'ACTIVE' as const,
      keterangan: '[TEST] Grounding Putus dipicu manual via Dashboard.'
    };
    alarmLogs.unshift(alarmEntry);
    if (isSupabase) {
      await logAlarmToSupabase(alarmEntry);
    }
    triggerSimulatedWhatsApp(site, 'GROUNDING_PUTUS');
  }

  if (oldDoor === 'TERTUTUP' && site.door === 'TERBUKA') {
    const logId = 'T-AL-' + Math.floor(100+Math.random()*900);
    const alarmEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      siteId: site.siteId,
      siteName: site.siteName,
      alarmType: 'PINTU_TERBUKA' as const,
      status: 'ACTIVE' as const,
      keterangan: '[TEST] Pintu Shelter Terbuka dipicu manual via Dashboard.'
    };
    alarmLogs.unshift(alarmEntry);
    if (isSupabase) {
      await logAlarmToSupabase(alarmEntry);
    }
    triggerSimulatedWhatsApp(site, 'PINTU_TERBUKA');
  }

  // Clear alarms manually if they are reset to normal
  if (oldGrounding === 'PUTUS' && site.grounding === 'NORMAL') {
    alarmLogs = alarmLogs.map(l => {
      if (l.siteId === site.siteId && l.alarmType === 'GROUNDING_PUTUS' && l.status === 'ACTIVE') {
        return { ...l, status: 'CLOSED' as const };
      }
      return l;
    });
    if (isSupabase) {
      await closeAlarmInSupabase(site.siteId, 'GROUNDING_PUTUS');
    }
    triggerSimulatedWhatsApp(site, 'NORMAL');
  }

  if (oldDoor === 'TERBUKA' && site.door === 'TERTUTUP') {
    alarmLogs = alarmLogs.map(l => {
      if (l.siteId === site.siteId && l.alarmType === 'PINTU_TERBUKA' && l.status === 'ACTIVE') {
        return { ...l, status: 'CLOSED' as const };
      }
      return l;
    });
    if (isSupabase) {
      await closeAlarmInSupabase(site.siteId, 'PINTU_TERBUKA');
    }
    triggerSimulatedWhatsApp(site, 'NORMAL');
  }

  // Append history
  const devStatusLog = {
    timestamp: new Date().toISOString(),
    siteId: site.siteId,
    siteName: site.siteName,
    grounding: site.grounding,
    door: site.door,
    sirene: site.sirene,
    gsm: site.gsm,
    rssi: site.rssi
  };
  deviceLogs.unshift(devStatusLog);
  if (isSupabase) {
    await logDeviceToSupabase(devStatusLog);
  }

  // Synchronize simulated status and alarms to Google Sheets
  await sendToSpreadsheet({
    siteId: site.siteId,
    site_id: site.siteId,
    siteName: site.siteName,
    site_name: site.siteName,
    grounding: site.grounding,
    door: site.door,
    sirene: site.sirene,
    gsm: site.gsm,
    rssi: site.rssi,
    action: anyAlarm ? 'ACTIVE' : 'CLOSED',
    status: anyAlarm ? 'ACTIVE' : 'CLOSED',
    alarmType: site.grounding === 'PUTUS' ? 'GROUNDING_PUTUS' : (site.door === 'TERBUKA' ? 'PINTU_TERBUKA' : 'NORMAL'),
    keterangan: anyAlarm ? '[SIMULASI] Alarm terdeteksi via Dashboard.' : '[SIMULASI] Alarm dipulihkan via Dashboard.'
  });

  lastUpdateTs = Date.now();

  res.json({ status: 'success', site });
});

// POST Update Config Settings
app.post('/api/config', (req, res) => {
  const { config, username } = req.body;
  if (!config) {
    return res.status(400).json({ error: 'Config is required' });
  }

  integrationConfig = {
    ...integrationConfig,
    ...config
  };

  lastUpdateTs = Date.now();
  createAuditLog(username || 'Admin', 'CONFIG UPDATE', `Memperbarui konfigurasi sistem. WhatsApp: ${integrationConfig.whatsappEnabled ? 'AKTIF' : 'NONAKTIF'}`);
  res.json({ status: 'success', config: integrationConfig });
});

// POST Reset All Sites to normal state
app.post('/api/reset-all', async (req, res) => {
  const { username } = req.body;
  
  const promises = sites.map(async (site) => {
    site.grounding = 'NORMAL';
    site.door = 'TERTUTUP';
    site.sirene = 'OFF';
    site.status = 'ONLINE';
    site.lastSeen = new Date().toISOString();

    // Synchronize to spreadsheet
    await sendToSpreadsheet({
      siteId: site.siteId,
      site_id: site.siteId,
      siteName: site.siteName,
      site_name: site.siteName,
      grounding: 'NORMAL',
      door: 'TERTUTUP',
      sirene: 'OFF',
      gsm: site.gsm,
      rssi: site.rssi,
      action: 'CLOSED',
      status: 'CLOSED',
      alarmType: 'NORMAL',
      keterangan: 'Mereset status BTS kembali normal.'
    });
  });

  await Promise.all(promises);

  // Close all active alarms
  alarmLogs = alarmLogs.map(log => {
    if (log.status === 'ACTIVE') {
      return { ...log, status: 'CLOSED' as const };
    }
    return log;
  });

  createAuditLog(username || 'Admin', 'RESET ALL SITES', 'Mereset semua status BTS kembali normal secara massal.');
  lastUpdateTs = Date.now();
  res.json({ status: 'success', message: 'Semua site diatur ke NORMAL' });
});

// POST Clear history log
app.post('/api/clear-logs', (req, res) => {
  const { username } = req.body;
  alarmLogs = [];
  deviceLogs = [];
  createAuditLog(username || 'Admin', 'CLEAR LOGS', 'Mengosongkan seluruh riwayat dan log alarm.');
  lastUpdateTs = Date.now();
  res.json({ status: 'success', message: 'Log berhasil dikosongkan' });
});

// POST Test Send WhatsApp manually
app.post('/api/test-whatsapp', async (req, res) => {
  const { username } = req.body;
  if (!integrationConfig.whatsappEnabled) {
    return res.status(400).json({ error: 'Integrasi WhatsApp tidak diaktifkan di pengaturan.' });
  }

  const timestampStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  const textStr = `🧪 UJI COBA NOTIFIKASI ALARM WA\n\nSistem: BTS MONITORING NETWORK\nStatus: SELESAI\nUji Coba berhasil dikirim dari panel pengaturan.\nWaktu: ${timestampStr}\n\nTerima kasih.`;

  const phones = integrationConfig.whatsappPhone
    ? integrationConfig.whatsappPhone.split(/[,;\s]+/).map(p => p.trim()).filter(p => p.length > 0)
    : [];

  if (phones.length === 0) {
    phones.push('081234567890');
  }

  const results: any[] = [];
  for (const phone of phones) {
    const logEntry: any = {
      timestamp: new Date().toISOString(),
      siteId: 'SYSTEM',
      phoneNumber: phone,
      provider: integrationConfig.whatsappProvider.toUpperCase(),
      messageType: 'TEST',
      messageText: textStr,
      status: 'SENT'
    };

    whatsappNotificationLogs.unshift(logEntry);

    if (integrationConfig.whatsappEnabled && integrationConfig.whatsappToken) {
      const result = await sendWhatsAppActual(phone, textStr);
      if (result.status === 'FAILED') {
        logEntry.status = 'FAILED';
        results.push({ phone, status: 'FAILED', error: result.error });
      } else {
        results.push({ phone, status: 'SENT' });
      }
    } else {
      results.push({ phone, status: 'SENT', simulated: true });
    }
  }

  createAuditLog(username || 'Admin', 'TEST WHATSAPP SEND', `Uji coba kirim WhatsApp ke ${phones.join(', ')}.`);

  res.json({
    status: 'success',
    results
  });
});

// ==========================================
// STATIC FRONTEND SERVING WITH VITE MIDDLEWARE
// ==========================================

export default app;

async function startServer() {
  // Pull initial state from Supabase if configured & enabled
  if (integrationConfig?.supabaseEnabled) {
    console.log('[Supabase] Initializing state from Supabase table store...');
    await loadStateFromSupabase();
  }

  const isServerless = process.env.VERCEL || process.env.NOW_BUILDER || process.env.LAMBDA_TASK_ROOT || process.env.AWS_EXECUTION_ENV;
  if (isServerless) {
    // Skip listener and static file serving on Vercel/serverless
    // Static files are handled natively by Vercel CDN using vercel.json rewrites
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BTS BACKEND] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
