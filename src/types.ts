/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Site {
  siteId: string;
  siteName: string;
  location: string;
  latitude: number;
  longitude: number;
  grounding: 'NORMAL' | 'PUTUS';
  door: 'TERTUTUP' | 'TERBUKA';
  sirene: 'ON' | 'OFF';
  gsm: string;
  rssi: number;
  status: 'ONLINE' | 'OFFLINE';
  lastSeen: string; // ISO string or format
  rectifier: 'NORMAL' | 'FAULT';
  battery: 'NORMAL' | 'LOW';
  acPower: 'NORMAL' | 'FAIL';
  temperature: number; // in Celsius
  lastRestart?: string;
  resetReason?: string;
  teg?: 'NORMAL' | 'TIDAK_NORMAL';
  isMuted?: boolean;
  mutedRemaining?: number;
  phoneNo?: string;
  packageType?: string;
  packageRefillDate?: string;
  packageExpiryDate?: string;
}

export interface AlarmLog {
  id: string; // unique log ID
  timestamp: string;
  siteId: string;
  siteName: string;
  alarmType: 'NORMAL' | 'GROUNDING_PUTUS' | 'PINTU_TERBUKA' | 'ESP32_OFFLINE' | 'TEMPERATURE_HIGH' | 'AC_POWER_FAIL';
  status: 'ACTIVE' | 'CLOSED';
  keterangan: string;
}

export interface DeviceStatusLog {
  timestamp: string;
  siteId: string;
  siteName: string;
  grounding: 'NORMAL' | 'PUTUS';
  door: 'TERTUTUP' | 'TERBUKA';
  sirene: 'ON' | 'OFF';
  gsm: string;
  rssi: number;
}

export interface AuditTrail {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface IntegrationConfig {
  gasUrl: string;
  whatsappProvider: 'fonnte' | 'wablas' | 'whatsapp_cloud_api';
  whatsappToken: string;
  whatsappPhone: string;
  whatsappEnabled: boolean;
  muteDurationMin: number;
  supabaseUrl?: string;
  supabaseKey?: string;
  supabaseEnabled?: boolean;
}

export type UserRole = 'admin' | 'viewer';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  permissions?: string[];
  isReadOnly?: boolean;
}
