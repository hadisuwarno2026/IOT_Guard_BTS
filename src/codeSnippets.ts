/**
 * ============================================================================
 * PERINGATAN PENTING / CRITICAL WARNING:
 * ============================================================================
 * ⚠️ JANGAN SALIN SELURUH FILE INI KE GOOGLE APPS SCRIPT (Kode.gs)!
 * File ini adalah file kode sumber React/TypeScript untuk aplikasi dashboard.
 * Jika Anda menyalin seluruh file ini, Anda akan menemui error:
 * "SyntaxError: Unexpected token 'export' baris: 6" karena Google Apps Script
 * tidak mendukung modul 'export' dari TypeScript.
 * 
 * 👉 CARA MENYALIN KODE YANG BENAR:
 * 1. Jalankan aplikasi ini, masuk ke menu "Settings" (ikon Gerigi) di sebelah kiri.
 * 2. Pilih sub-tab "Skrip Google Apps Script (GAS)".
 * 3. Klik tombol "Salin Kode GAS" — tombol ini akan menyalin kode bersihnya saja.
 * 4. Paste ke editor Google Apps Script Anda (Kode.gs) dan simpan.
 * ============================================================================
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * GOOGLE APPS SCRIPT - BTS MONITORING BACKEND
 * 
 * Instructions:
 * 1. Open your target Google Spreadsheet.
 * 2. Click Extensions -> Apps Script.
 * 3. Delete existing code and paste this script.
 * 4. Update the SPREADSHEET_ID variable below.
 * 5. Update the DASHBOARD_URL to your deployed dashboard link.
 * 6. Click Deploy -> New Deployment -> Web App.
 *    - Execute as: Me (your email)
 *    - Who has access: Anyone (required for ESP32/sim800l to POST data without OAuth login)
 * 7. Copy the Web App URL and paste it into the ESP32 code and Dashboard Settings.
 */

var SPREADSHEET_ID = "1aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890"; // Ganti dengan ID Spreadsheet Anda
var DASHBOARD_URL = "https://your-dashboard-url.co/api/esp32"; // Endpoint sinkronisasi dashboard

function doPost(e) {
  try {
    var jsonString = e.postData.contents;
    var data = JSON.parse(jsonString);
    
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // --- 0. HANDLER UNTUK CRUD TOWER DATA (DARI DASHBOARD) ---
    if (data.action === "CRUD_SITE") {
      var sheetSite = ss.getSheetByName("SITE");
      if (!sheetSite) {
        sheetSite = ss.insertSheet("SITE");
        sheetSite.appendRow(["SiteID", "SiteName", "Lokasi", "Latitude", "Longitude"]);
      }
      
      var siteObj = data.site || data || {};
      var sId = siteObj.siteId || siteObj.site_id || data.siteId || data.site_id;
      if (!sId) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "siteId is missing from payload"
        }))
        .setMimeType(ContentService.MimeType.JSON);
      }
      
      var sName = siteObj.siteName || siteObj.site_name || data.siteName || data.site_name || ("BTS " + sId);
      var sLoc = siteObj.location || data.location || "Lokasi Baru, Indonesia";
      var sLat = Number(siteObj.latitude !== undefined ? siteObj.latitude : data.latitude) || 0;
      var sLng = Number(siteObj.longitude !== undefined ? siteObj.longitude : data.longitude) || 0;
      
      var rows = sheetSite.getDataRange().getValues();
      var foundIndex = -1;
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][0].toString().toUpperCase() === sId.toUpperCase()) {
          foundIndex = i + 1; // 1-indexed for Sheet row
          break;
        }
      }
      
      if (data.method === "DELETE") {
        if (foundIndex !== -1) {
          sheetSite.deleteRow(foundIndex);
        }
      } else if (data.method === "POST" || data.method === "PUT") {
        if (foundIndex === -1) {
          sheetSite.appendRow([sId, sName, sLoc, sLat, sLng]);
        } else {
          sheetSite.getRange(foundIndex, 1, 1, 5).setValues([[sId, sName, sLoc, sLat, sLng]]);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "SITE spreadsheet updated successfully"
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }
    
    var siteId = data.site_id || data.siteId || "BTS-001";
    var grounding = data.grounding || "NORMAL";
    var door = data.door || "TERTUTUP";
    var sirene = data.sirene || "OFF";
    var gsm = data.gsm || "4G";
    var rssi = Number(data.rssi) || -75;
    
    // --- 1. SINKRONISASI SHEET: DEVICE_STATUS ---
    var sheetDevice = ss.getSheetByName("DEVICE_STATUS");
    if (!sheetDevice) {
      sheetDevice = ss.insertSheet("DEVICE_STATUS");
      sheetDevice.appendRow(["Timestamp", "SiteID", "Grounding", "Door", "Sirene", "GSM", "RSSI"]);
    }
    var timestampStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    sheetDevice.appendRow([timestampStr, siteId, grounding, door, sirene, gsm, rssi]);
    
    // Ambil detail Site Name dari sheet SITE
    var siteName = "BTS " + siteId;
    var location = "Sumberjaya, Indonesia";
    var sheetSite = ss.getSheetByName("SITE");
    if (sheetSite) {
      var siteRows = sheetSite.getDataRange().getValues();
      for (var i = 1; i < siteRows.length; i++) {
        if (siteRows[i][0].toString().toUpperCase() === siteId.toUpperCase()) {
          siteName = siteRows[i][1];
          location = siteRows[i][2];
          break;
        }
      }
    } else {
      // Jika sheet SITE belum ada, buatkan template default
      var newSheetSite = ss.insertSheet("SITE");
      newSheetSite.appendRow(["SiteID", "SiteName", "Lokasi", "Latitude", "Longitude"]);
      newSheetSite.appendRow([siteId, "BTS SUMBERJAYA", "Sumberjaya, Indonesia", -6.914744, 107.609810]);
    }
    
    // --- 2. LOG ALARM DAN RIWAYAT KE SHEET: ALARM_LOG ---
    var sheetAlarm = ss.getSheetByName("ALARM_LOG");
    if (!sheetAlarm) {
      sheetAlarm = ss.insertSheet("ALARM_LOG");
      sheetAlarm.appendRow(["Timestamp", "SiteID", "AlarmType", "Status", "Keterangan"]);
    }
    
    // Deteksi jika terjadi alarm baru
    var isAlarmActive = (grounding === "PUTUS" || door === "TERBUKA");
    if (isAlarmActive) {
      var alarmType = grounding === "PUTUS" ? "GROUNDING_PUTUS" : "PINTU_TERBUKA";
      var keterangan = data.keterangan || (grounding === "PUTUS" 
        ? "Kabel ground terputus / hambatan tinggi." 
        : "Pintu shelter BTS terbuka tanpa autorisasi.");
        
      sheetAlarm.appendRow([timestampStr, siteId, alarmType, "ACTIVE", keterangan]);
    } else if (data.action === "CLOSED" || data.status === "CLOSED" || data.status === "NORMAL") {
      sheetAlarm.appendRow([timestampStr, siteId, data.alarmType || "ALARM", "CLOSED", data.keterangan || "Alarm selesai / dipulihkan."]);
    }
    
    // --- 3. FORWARD DATA KE SERVER MONITORING UTAMA (Mencegah Loop dengan source: 'server_simulation') ---
    var dashboardResponseText = "Not Synchronized";
    if (data.source !== "server_simulation" && data.skipForward !== true) {
      try {
        var options = {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({
            site_id: siteId,
            site_name: siteName,
            location: location,
            grounding: grounding,
            door: door,
            sirene: sirene,
            gsm: gsm,
            rssi: rssi
          }),
          muteHttpExceptions: true
        };
        var response = UrlFetchApp.fetch(DASHBOARD_URL, options);
        dashboardResponseText = response.getContentText();
      } catch (e) {
        dashboardResponseText = "Sync failed: " + e.toString();
      }
    } else {
      dashboardResponseText = "Sync skipped (internal simulation)";
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Spreadsheet logged successfully",
      sync_response: dashboardResponseText
    }))
    .setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "GAS Error: " + err.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}`;

export const ESP32_HARDWARE_CODE = `/**
 * ESP32 - MULTI-CONNECTION BTS MONITORING & SECURITY SYSTEM
 * 
 * Mendukung pengiriman data via Wi-Fi lokal atau kartu GSM SIM800L GPRS.
 * Membaca sensor grounding putus (GPIO18) dan pintu shelter terbuka (GPIO19).
 * Mengontrol relay sirene fisik (GPIO23) secara terpusat berdasarkan instruksi dari Website.
 * Mengontrol 2 relay tambahan untuk Lampu Indikator Bahaya (Grounding Putus & Pintu Terbuka).
 * Tidak memerlukan tombol mute fisik pada perangkat; pembungkaman sirene dikendalikan langsung dari Website.
 */

#define MODE_WIFI // Hapus/beri komentar baris ini jika ingin menggunakan GSM SIM800L GPRS sebagai gantinya

// --- PROTOTIPE FUNGSI (PENTING AGAR DAPAT DI-COMPILE DI ARDUINO IDE TANPA ERROR) ---
void sendTelemetry(bool groundBroken, bool doorOpen);
void handleServerCommand(String responseJson);
#ifndef MODE_WIFI
void initSIM800L();
String checkModemResponse(int timeoutMs);
#endif

// --- KONFIGURASI WI-FI (Jika menggunakan MODE_WIFI) ---
#ifdef MODE_WIFI
#include <WiFi.h>
#include <HTTPClient.h>
const char* WIFI_SSID = "WiFi-SSID-Anda";
const char* WIFI_PASS = "WiFi-Password-Anda";
#endif

// --- KONFIGURASI PIN HARDWARE ESP32 ---
#define PIN_GROUNDING_SWITCH     18 // GPIO18 - Input Sensor Grounding
#define PIN_DOOR_SWITCH          19 // GPIO19 - Input Sensor Pintu Shelter
#define PIN_RELAY_SIRENE         23 // GPIO23 - Output Relay Sirene Fisik
#define PIN_RELAY_LIGHT_GROUND   21 // GPIO21 - Output Relay Lampu Bahaya Grounding Putus
#define PIN_RELAY_LIGHT_DOOR     22 // GPIO22 - Output Relay Lampu Bahaya Pintu Terbuka

// --- CONFIG LOGIKA SENSOR & WIRING ---
// - WIRING_GND (INPUT_PULLUP): Sangat direkomendasikan! Hubungkan salah satu kaki saklar ke GPIO, dan kaki satunya ke GND.
//   * Kabel normal/pintu tertutup (sirkuit terhubung ke GND) -> Terbaca LOW.
//   * Kabel putus/pintu terbuka (sirkuit terbuka, ditarik pullup internal) -> Terbaca HIGH (Pemicu Alarm).
// - WIRING_VCC (INPUT_PULLDOWN): Hubungkan salah satu kaki saklar ke GPIO, dan kaki satunya ke 3.3V.
//   * Kabel normal/pintu tertutup (sirkuit terbuka) -> Terbaca LOW.
//   * Kabel putus/pintu terbuka (terhubung ke 3.3V) -> Terbaca HIGH (Pemicu Alarm).
// Pilihlah salah satu konfigurasi di bawah ini dengan mendefinisikan salah satunya:
#define WIRING_GND   // Definisikan ini jika switch terhubung ke GND (SANGAT DIREKOMENDASIKAN!)
// #define WIRING_VCC // Definisikan ini jika switch terhubung ke 3.3V

// --- CONFIG LOGIKA RELAY ---
// Pada modul relay komersial Arduino/ESP32, trigger seringkali bernilai ACTIVE-LOW.
// - Jika modul relay menyala saat pin diberi HIGH, aktifkan RELAY_ACTIVE_HIGH.
// - Jika modul relay menyala saat pin diberi LOW (umum untuk Arduino/ESP32 relay block), aktifkan RELAY_ACTIVE_LOW.
#define RELAY_ACTIVE_LOW  // <--- Ubah ke RELAY_ACTIVE_HIGH jika modul relay Anda aktif saat diberi tegangan HIGH

#ifdef RELAY_ACTIVE_HIGH
  #define RELAY_ON  HIGH
  #define RELAY_OFF LOW
#else
  #define RELAY_ON  LOW
  #define RELAY_OFF HIGH
#endif

// --- KONFIGURASI SERIAL MODEM SIM800L (Jika menggunakan GSM/GPRS) ---
#ifndef MODE_WIFI
#include <HardwareSerial.h>
#define SIM_TX               16 // GPIO16 (RX ESP32 tersambung ke TX SIM800L)
#define SIM_RX               17 // GPIO17 (TX ESP32 tersambung ke RX SIM800L)
HardwareSerial simSerial(2);
const String APN = "internet";  // APN Provider Anda
#endif

// --- KONFIGURASI WEB SERVER ---
const String SITE_ID = "BTS-001";
const String SERVER_URL = "https://tbig-guard.vercel.app/api/esp32";

// State Variables
bool lastGroundingState = false;
bool lastDoorState = false;
bool initialSendDone = false;
String currentSirenState = "OFF";
bool sirenMutedLocally = false; // Meredam sirene secara lokal jika ada perintah MUTE/OFF dari website

// Heartbeat & Polling Timer
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 5000; // Kirim detak jantung / telemetry & cek command setiap 5 detik (5000ms)

// Status lampu bahaya terakhir untuk mencegah interferensi penulisan terus-menerus
int lastLightGroundState = -1; 
int lastLightDoorState = -1;
int lastSirenRelayState = -1; // Status sirene terakhir untuk mencegah penulisan berulang-ulang ke pin relay

// --- FUNGSI HELPER UNTUK MENGONTROL RELAY ---
// Mengontrol relay dengan menuliskan nilai RELAY_ON atau RELAY_OFF ke pin OUTPUT.
// Ini adalah cara standar dan paling andal untuk semua jenis modul relay (Active High / Active Low).
void writeRelay(int pin, bool turnOn) {
  digitalWrite(pin, turnOn ? RELAY_ON : RELAY_OFF);
}

void setup() {
  Serial.begin(115200);
  
  #ifdef WIRING_GND
    pinMode(PIN_GROUNDING_SWITCH, INPUT_PULLUP);
    pinMode(PIN_DOOR_SWITCH, INPUT_PULLUP);
    Serial.println("[SETUP] Menggunakan mode saklar INPUT_PULLUP (Koneksi Switch ke GND)");
  #else
    pinMode(PIN_GROUNDING_SWITCH, INPUT_PULLDOWN);
    pinMode(PIN_DOOR_SWITCH, INPUT_PULLDOWN);
    Serial.println("[SETUP] Menggunakan mode saklar INPUT_PULLDOWN (Koneksi Switch ke VCC 3.3V)");
  #endif
  
  // Set semua pin relay sebagai OUTPUT
  pinMode(PIN_RELAY_SIRENE, OUTPUT);
  pinMode(PIN_RELAY_LIGHT_GROUND, OUTPUT);
  pinMode(PIN_RELAY_LIGHT_DOOR, OUTPUT);
  
  // Set default awal semua relay dalam keadaan OFF (tidak aktif) sesuai tipe active relay
  digitalWrite(PIN_RELAY_SIRENE, RELAY_OFF);
  digitalWrite(PIN_RELAY_LIGHT_GROUND, RELAY_OFF);
  digitalWrite(PIN_RELAY_LIGHT_DOOR, RELAY_OFF);
  
  Serial.println("=========================================");
  Serial.println("  ESP32 DUAL-MODE SECURITY SYSTEM INITIALIZED    ");
  Serial.println("=========================================");
  
  #ifdef MODE_WIFI
    Serial.println("[KONEKSI] Menghubungkan ke Wi-Fi...");
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 15) {
      delay(1000);
      Serial.print(".");
      attempts++;
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\\n[KONEKSI] Wi-Fi Terhubung!");
      Serial.print("[KONEKSI] IP Address: ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("\\n[PENTING] Wi-Fi gagal terhubung. Silakan periksa kredensial.");
    }
  #else
    simSerial.begin(9600, SERIAL_8N1, SIM_RX, SIM_TX);
    delay(3000); // Tunggu modem siap
    initSIM800L();
  #endif
}

void loop() {
  // 1. Membaca nilai sensor lokal sesuai tipe wiring yang dipilih
  #ifdef WIRING_GND
    bool isGroundingPutus = (digitalRead(PIN_GROUNDING_SWITCH) == HIGH); // Sirkuit terbuka = HIGH (Alarm)
    bool isDoorTerbuka    = (digitalRead(PIN_DOOR_SWITCH) == HIGH);      // Sirkuit terbuka = HIGH (Alarm)
  #else
    bool isGroundingPutus = (digitalRead(PIN_GROUNDING_SWITCH) == LOW);  // Sirkuit terbuka = LOW (Alarm)
    bool isDoorTerbuka    = (digitalRead(PIN_DOOR_SWITCH) == LOW);       // Sirkuit terbuka = LOW (Alarm)
  #endif
  
  // Cek transisi alarm baru untuk menyalakan sirene secara otomatis (unmute jika ada kejadian alarm baru terpicu)
  // Ini memastikan jika sebelumnya sirene dimutekan/dimatikan lewat website saat pintu terbuka,
  // lalu tiba-tiba grounding juga putus (alarm baru), maka sirene akan otomatis berbunyi lagi!
  bool newAlarmEvent = (isGroundingPutus && !lastGroundingState) || (isDoorTerbuka && !lastDoorState);
  if (newAlarmEvent) {
    sirenMutedLocally = false; // Reset mute lokal
    currentSirenState = "ON";
    Serial.println("[RELE] Alarm Baru Terdeteksi! Reset pembungkaman lokal agar sirene berbunyi kembali.");
  }
  
  // Kontrol Relay Lampu Penanda Bahaya secara langsung dan responsif (hanya jika ada perubahan status)
  // Menyalakan lampu penanda bahaya (COM-NO) saat alarm aktif, dan mematikan (COM-NC) saat normal
  if (isGroundingPutus != lastLightGroundState) {
    lastLightGroundState = isGroundingPutus;
    writeRelay(PIN_RELAY_LIGHT_GROUND, isGroundingPutus);
    Serial.print("[RELE] Lampu Grounding ");
    Serial.println(isGroundingPutus ? "MENYALA (ON - Hubung COM ke NO)" : "PADAM (OFF - Hubung COM ke NC)");
  }
  
  if (isDoorTerbuka != lastLightDoorState) {
    lastLightDoorState = isDoorTerbuka;
    writeRelay(PIN_RELAY_LIGHT_DOOR, isDoorTerbuka);
    Serial.print("[RELE] Lampu Pintu ");
    Serial.println(isDoorTerbuka ? "MENYALA (ON - Hubung COM ke NO)" : "PADAM (OFF - Hubung COM ke NC)");
  }
  
  // Kontrol sirene berkelanjutan berdasarkan keaktifan alarm dan mute lokal dengan State Guard
  bool anyAlarmActive = isGroundingPutus || isDoorTerbuka;
  bool targetSirenState = false;

  if (anyAlarmActive) {
    // Jika ada alarm aktif, ikuti status mute dari perintah website (sirenMutedLocally)
    if (sirenMutedLocally) {
      targetSirenState = false;
      currentSirenState = "OFF";
    } else {
      targetSirenState = true;
      currentSirenState = "ON";
    }
  } else {
    // Jika semua sensor kembali normal, matikan sirene dan reset status mute lokal
    sirenMutedLocally = false;
    targetSirenState = false;
    currentSirenState = "OFF";
  }

  // Hanya tulis ke pin relay jika status fisik sirene berubah!
  if (targetSirenState != lastSirenRelayState) {
    lastSirenRelayState = targetSirenState;
    writeRelay(PIN_RELAY_SIRENE, targetSirenState);
    Serial.print("[RELE] Status Sirene Berubah! Sekarang: ");
    Serial.println(targetSirenState ? "MENYALA (COM ke NO)" : "OFF (COM ke NC)");
  }
  
  // 2. Deteksi perubahan status sensor untuk pengiriman cepat (triggered event) ATAU pengiriman berkala (heartbeat)
  bool stateChanged = (isGroundingPutus != lastGroundingState) || (isDoorTerbuka != lastDoorState);
  unsigned long now = millis();
  bool timeElapsed = (now - lastTelemetryTime >= TELEMETRY_INTERVAL) || (lastTelemetryTime == 0);
  
  if (stateChanged || timeElapsed || !initialSendDone) {
    lastGroundingState = isGroundingPutus;
    lastDoorState = isDoorTerbuka;
    initialSendDone = true;
    lastTelemetryTime = now;
    
    Serial.println("\n=========================================");
    Serial.print("SiteID : ");
    Serial.println(SITE_ID);
    Serial.print("Grounding : ");
    Serial.println(isGroundingPutus ? "Putus" : "Normal");
    Serial.print("Door : ");
    Serial.println(isDoorTerbuka ? "Terbuka" : "Tertutup");
    Serial.print("Siren State : ");
    Serial.println(currentSirenState);
    Serial.println("=========================================");
    
    sendTelemetry(isGroundingPutus, isDoorTerbuka);
  }
  
  delay(100); // Polling delay yang responsif
}

#ifdef MODE_WIFI
void sendTelemetry(bool groundBroken, bool doorOpen) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WI-FI] Gagal mengirim data, Wi-Fi terputus!");
    return;
  }
  
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  
  String groundingParam = groundBroken ? "PUTUS" : "NORMAL";
  String doorParam      = doorOpen ? "TERBUKA" : "TERTUTUP";
  
  // Format Payload JSON dengan escape double-quote agar valid di C++
  String payload = "{\\"site_id\\":\\"" + SITE_ID + 
                   "\\",\\"grounding\\":\\"" + groundingParam + 
                   "\\",\\"door\\":\\"" + doorParam + 
                   "\\",\\"sirene\\":\\"" + currentSirenState + 
                   "\\",\\"gsm\\":\\"WiFi\\",\\"rssi\\":\\"-50\\"}";
                   
  int httpResponseCode = http.POST(payload);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("[WI-FI] Respons Server (");
    Serial.print(httpResponseCode);
    Serial.println(") OK");
    
    // Parsing instruksi sirene dari respons server
    handleServerCommand(response);
  } else {
    Serial.print("[WI-FI] Error mengirim POST: ");
    Serial.println(httpResponseCode);
  }
  http.end();
}
#else
void initSIM800L() {
  Serial.println("[MODEM] Mengonfigurasi modul GSM SIM800L...");
  simSerial.println("AT");
  checkModemResponse(1000);
  simSerial.println("AT+CFUN=1");
  checkModemResponse(2000);
  simSerial.println("AT+CPIN?");
  checkModemResponse(1000);
  simSerial.println("AT+CREG?");
  checkModemResponse(1000);
  simSerial.println("AT+SAPBR=3,1,\\"CONTYPE\\",\\"GPRS\\"");
  checkModemResponse(1000);
  simSerial.println("AT+SAPBR=3,1,\\"APN\\",\\"" + APN + "\\"");
  checkModemResponse(1000);
  simSerial.println("AT+SAPBR=1,1");
  checkModemResponse(3000);
}

void sendTelemetry(bool groundBroken, bool doorOpen) {
  String groundingParam = groundBroken ? "PUTUS" : "NORMAL";
  String doorParam      = doorOpen ? "TERBUKA" : "TERTUTUP";
  
  String payload = "{\\"site_id\\":\\"" + SITE_ID + 
                   "\\",\\"grounding\\":\\"" + groundingParam + 
                   "\\",\\"door\\":\\"" + doorParam + 
                   "\\",\\"sirene\\":\\"" + currentSirenState + 
                   "\\",\\"gsm\\":\\"2G\\",\\"rssi\\":\\"-75\\"}";
  
  simSerial.println("AT+HTTPINIT");
  checkModemResponse(1000);
  simSerial.println("AT+HTTPPARA=\\"CID\\",1");
  checkModemResponse(1000);
  simSerial.println("AT+HTTPPARA=\\"URL\\",\\"" + SERVER_URL + "\\"");
  checkModemResponse(1000);
  simSerial.println("AT+HTTPPARA=\\"CONTENT\\",\\"application/json\\"");
  checkModemResponse(1000);
  simSerial.println("AT+HTTPDATA=" + String(payload.length()) + ",10000");
  checkModemResponse(1000);
  
  simSerial.print(payload);
  delay(1000);
  
  simSerial.println("AT+HTTPACTION=1"); // POST request
  String responseBuffer = checkModemResponse(5000);
  
  simSerial.println("AT+HTTPREAD");
  String httpResponse = checkModemResponse(2000);
  
  simSerial.println("AT+HTTPTERM");
  checkModemResponse(1000);
  
  // Parsing instruksi sirene dari respons server via GSM
  handleServerCommand(httpResponse);
}

String checkModemResponse(int timeoutMs) {
  String response = "";
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    while (simSerial.available()) {
      char c = simSerial.read();
      response += c;
      Serial.print(c);
    }
  }
  return response;
}
#endif

// Fungsi untuk menangani status sirene dari Web Dashboard
void handleServerCommand(String responseJson) {
  // Parsing tangguh yang mendukung format dengan spasi maupun tanpa spasi setelah titik dua ":"
  bool isSirenON = (responseJson.indexOf("\\"sirene_command\\":\\"ON\\"") != -1) || 
                   (responseJson.indexOf("\\"sirene_command\\": \\"ON\\"") != -1);
                   
  bool isSirenOFF = (responseJson.indexOf("\\"sirene_command\\":\\"OFF\\"") != -1) || 
                    (responseJson.indexOf("\\"sirene_command\\": \\"OFF\\"") != -1);

  if (isSirenON) {
    currentSirenState = "ON";
    sirenMutedLocally = false; // Reset mute jika website menyalakannya manual
    lastSirenRelayState = 1;   // Sinkronkan dengan state guard (1 = ON/true)
    writeRelay(PIN_RELAY_SIRENE, true); // Nyalakan sirene fisik (COM ke NO)
    Serial.println("[RELE] Sirene diaktifkan berdasarkan perintah dari website (Menghubungkan COM ke NO)!");
  } else if (isSirenOFF) {
    currentSirenState = "OFF";
    sirenMutedLocally = true; // Set status mute agar tidak langsung dinyalakan kembali oleh loop()
    lastSirenRelayState = 0;   // Sinkronkan dengan state guard (0 = OFF/false)
    writeRelay(PIN_RELAY_SIRENE, false);  // Matikan/Bungkam sirene fisik (COM ke NC)
    Serial.println("[RELE] Sirene dimatikan/dibungkam berdasarkan perintah dari website (Menghubungkan COM ke NC / COM-NC)!");
  }
}
`;

export const SUPABASE_SQL_DDL = `-- DDL SQL untuk Setup Database Supabase TBIGGuard
-- Salin seluruh kode ini dan jalankan di SQL Editor dashboard Supabase Anda.

-- 1. Membuat tabel SITE (Penyimpanan info stasiun BTS)
CREATE TABLE IF NOT EXISTS SITE (
    SiteID VARCHAR(100) PRIMARY KEY,
    SiteName VARCHAR(255) NOT NULL,
    Lokasi TEXT,
    Latitude NUMERIC,
    Longitude NUMERIC
);

-- 2. Membuat tabel ALARM (Histori kejadian alarm/peringatan aktif & closed)
CREATE TABLE IF NOT EXISTS ALARM (
    id VARCHAR(100) PRIMARY KEY,
    Timestamp TIMESTAMPTZ DEFAULT NOW(),
    SiteID VARCHAR(100) REFERENCES SITE(SiteID) ON DELETE CASCADE,
    AlarmType VARCHAR(100),
    Status VARCHAR(50), -- ACTIVE / CLOSED
    Keterangan TEXT
);

-- 3. Membuat tabel DEVICE (Log data telemetri real-time dari ESP32)
CREATE TABLE IF NOT EXISTS DEVICE (
    id BIGSERIAL PRIMARY KEY,
    Timestamp TIMESTAMPTZ DEFAULT NOW(),
    SiteID VARCHAR(100) REFERENCES SITE(SiteID) ON DELETE CASCADE,
    Grounding VARCHAR(50), -- NORMAL / PUTUS
    Door VARCHAR(50),      -- TERTUTUP / TERBUKA
    Sirene VARCHAR(50),    -- ON / OFF
    GSM VARCHAR(50),
    RSSI NUMERIC
);

-- Tambahkan Data Contoh Awal (Seed Data)
INSERT INTO SITE (SiteID, SiteName, Lokasi, Latitude, Longitude)
VALUES 
  ('BTS-001', 'BTS SUMBERJAYA', 'Sumberjaya, Indonesia', -6.914744, 107.609810),
  ('BTS-002', 'BTS GADOBANGKONG', 'Gadobangkong, Indonesia', -6.873211, 107.519213),
  ('BTS-003', 'BTS NAGREG HIGH', 'Nagreg, Jawa Barat', -7.029812, 107.901121)
ON CONFLICT (SiteID) DO NOTHING;
`;
