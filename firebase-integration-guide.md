# Firebase Configuration Integration Guide
**Complete Step-by-Step Setup for SecureFence Pro Dashboard & ESP32**

## 📋 Overview
This guide will help you integrate your Firebase configuration into both the web dashboard and ESP32 hardware for real-time fence monitoring and control.

---

## 🔥 PART 1: Firebase Project Setup

### Step 1: Verify Firebase Console Access
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Login with your Google account
3. You should see your project: `fence-5db16`

### Step 2: Get Your Configuration
Your Firebase config is:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyA_-crpAPh4hVt6tv5V7WO96dbMj26lLZM",
  authDomain: "fence-5db16.firebaseapp.com",
  databaseURL: "https://fence-5db16-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fence-5db16",
  storageBucket: "fence-5db16.firebasestorage.app",
  messagingSenderId: "250832247561",
  appId: "1:250832247561:web:b0febfcafb1cc9fb77d1d8",
  measurementId: "G-G7JN5VTXGV"
};
```

### Step 3: Configure Database Rules
1. In Firebase Console, go to **Realtime Database**
2. Click on **Rules** tab
3. Replace with these rules (for development):
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
4. Click **Publish**

### Step 4: Set Up Database Structure
1. Go to **Realtime Database** → **Data** tab
2. Click on **+** to add data
3. Create this structure:

```json
{
  "fence_control": {
    "energizer_status": true,
    "energizer_command": false,
    "current_reading": 2.2,
    "voltage_reading": 12.5,
    "battery_level": 86.99,
    "motion_detected": false,
    "device_online": true,
    "last_update": "2025-09-29T02:05:00Z"
  },
  "alerts": {
    "sample_alert": {
      "type": "System Online",
      "message": "Firebase connection established",
      "timestamp": "2025-09-29T02:05:00Z",
      "severity": "info"
    }
  }
}
```

---

## 🌐 PART 2: Web Dashboard Integration

### Step 1: Download Website Files
1. Download the fixed dashboard from: 
   [SecureFence Dashboard](https://ppl-ai-code-interpreter-files.s3.amazonaws.com/web/direct-files/ebf33e7a99af06953bec9d2777cb5820/b44d8017-fc0e-40a9-8f10-8ab744aa11c9/index.html)
2. Right-click → "Save as" → Save all files (index.html, style.css, app.js)

### Step 2: Verify Firebase Integration in HTML
Open `index.html` and ensure this code is in the `<head>` section:

```html
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SecureFence Pro - Security Control Center</title>
    <link rel="stylesheet" href="style.css">
    
    <!-- Firebase SDK -->
    <script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-database-compat.js"></script>
</head>
```

### Step 3: Update JavaScript Configuration
In `app.js`, ensure your Firebase config is correctly set:

```javascript
// Firebase Configuration - UPDATE THIS SECTION
const firebaseConfig = {
  apiKey: "AIzaSyA_-crpAPh4hVt6tv5V7WO96dbMj26lLZM",
  authDomain: "fence-5db16.firebaseapp.com",
  databaseURL: "https://fence-5db16-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fence-5db16",
  storageBucket: "fence-5db16.firebasestorage.app",
  messagingSenderId: "250832247561",
  appId: "1:250832247561:web:b0febfcafb1cc9fb77d1d8",
  measurementId: "G-G7JN5VTXGV"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
```

### Step 4: Test Web Dashboard
1. Open `index.html` in a web browser
2. Login with: Username: `admin`, Password: `password123`
3. Check browser console (F12) for any Firebase errors
4. You should see real-time data from Firebase

---

## 🔧 PART 3: ESP32 Hardware Integration

### Step 1: Install Required Libraries
In Arduino IDE, install these libraries:
1. **FirebaseESP32** by Mobizt (v4.4.12 or newer)
2. **ArduinoJson** by Benoit Blanchon
3. **WiFi** (built-in ESP32 library)

### Step 2: ESP32 Code Implementation
Create new Arduino sketch with this code:

```cpp
#include <WiFi.h>
#include <FirebaseESP32.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// WiFi credentials - UPDATE THESE
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Firebase configuration - YOUR ACTUAL CONFIG
#define FIREBASE_HOST "fence-5db16-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "AIzaSyA_-crpAPh4hVt6tv5V7WO96dbMj26lLZM"

// Hardware pins
#define RELAY1_PIN 2    // Fence energizer control
#define RELAY2_PIN 4    // Alert/alarm control
#define PIR_SENSOR_PIN 5
#define LED_PIN 23

// Firebase objects
FirebaseData firebaseData;
FirebaseAuth auth;
FirebaseConfig config;

// System variables
bool energizerStatus = false;
bool lastEnergizerCommand = false;
float currentReading = 2.2;
float voltageReading = 12.5;
float batteryLevel = 86.99;
bool motionDetected = false;
unsigned long lastUpdate = 0;
const unsigned long UPDATE_INTERVAL = 3000;

void setup() {
  Serial.begin(115200);
  
  // Initialize pins
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  pinMode(PIR_SENSOR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  
  // Start with relays OFF
  digitalWrite(RELAY1_PIN, LOW);
  digitalWrite(RELAY2_PIN, LOW);
  
  // Connect to WiFi
  connectToWiFi();
  
  // Configure Firebase
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  Serial.println("Firebase connected!");
  
  // Initial status update
  updateFirebaseStatus();
}

void loop() {
  unsigned long currentTime = millis();
  
  // Read sensors
  readSensors();
  
  // Check for commands from Firebase
  checkFirebaseCommands();
  
  // Control hardware
  controlHardware();
  
  // Update Firebase status
  if (currentTime - lastUpdate >= UPDATE_INTERVAL) {
    updateFirebaseStatus();
    lastUpdate = currentTime;
  }
  
  delay(100);
}

void connectToWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  
  Serial.println();
  Serial.println("WiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void readSensors() {
  // Read PIR sensor
  motionDetected = digitalRead(PIR_SENSOR_PIN);
  
  // Simulate current reading (replace with actual sensor)
  currentReading = 2.2 + (random(-5, 5) / 10.0);
  
  // Simulate battery level decrease
  batteryLevel = batteryLevel - 0.001;
  if (batteryLevel < 80.0) batteryLevel = 90.0;
  
  // Send motion alert if detected
  if (motionDetected) {
    sendMotionAlert();
  }
}

void checkFirebaseCommands() {
  // Check for energizer control command
  if (Firebase.getBool(firebaseData, "/fence_control/energizer_command")) {
    bool command = firebaseData.boolData();
    
    if (command != lastEnergizerCommand) {
      energizerStatus = command;
      lastEnergizerCommand = command;
      
      Serial.println("Command received: " + String(energizerStatus ? "ON" : "OFF"));
      
      // Clear the command after processing
      Firebase.setBool(firebaseData, "/fence_control/energizer_command", false);
    }
  }
}

void controlHardware() {
  // Control energizer relay
  digitalWrite(RELAY1_PIN, energizerStatus ? HIGH : LOW);
  digitalWrite(LED_PIN, energizerStatus ? HIGH : LOW);
}

void updateFirebaseStatus() {
  // Update all system parameters
  Firebase.setBool(firebaseData, "/fence_control/energizer_status", energizerStatus);
  Firebase.setFloat(firebaseData, "/fence_control/current_reading", currentReading);
  Firebase.setFloat(firebaseData, "/fence_control/voltage_reading", voltageReading);
  Firebase.setFloat(firebaseData, "/fence_control/battery_level", batteryLevel);
  Firebase.setBool(firebaseData, "/fence_control/motion_detected", motionDetected);
  Firebase.setBool(firebaseData, "/fence_control/device_online", true);
  Firebase.setString(firebaseData, "/fence_control/last_update", getCurrentTimestamp());
  
  Serial.println("Status updated to Firebase - Energizer: " + String(energizerStatus ? "ON" : "OFF"));
}

void sendMotionAlert() {
  String alertId = String(millis());
  String alertPath = "/alerts/" + alertId;
  
  Firebase.setString(firebaseData, alertPath + "/type", "Motion Detected");
  Firebase.setString(firebaseData, alertPath + "/message", "PIR sensor detected movement near fence");
  Firebase.setString(firebaseData, alertPath + "/timestamp", getCurrentTimestamp());
  Firebase.setString(firebaseData, alertPath + "/severity", "warning");
  
  Serial.println("Motion alert sent to Firebase");
  
  // Trigger local alarm
  for (int i = 0; i < 3; i++) {
    digitalWrite(RELAY2_PIN, HIGH);
    delay(200);
    digitalWrite(RELAY2_PIN, LOW);
    delay(200);
  }
}

String getCurrentTimestamp() {
  return String(millis() / 1000) + "s";
}
```

### Step 3: Update WiFi Credentials
In the ESP32 code, replace:
```cpp
const char* ssid = "YOUR_WIFI_SSID";        // Your actual WiFi name
const char* password = "YOUR_WIFI_PASSWORD"; // Your actual WiFi password
```

### Step 4: Upload to ESP32
1. Connect ESP32 to computer
2. Select **Board**: "ESP32 Dev Module" in Arduino IDE
3. Select **Port**: Your ESP32 COM port
4. Click **Upload**

---

## 🔗 PART 4: Testing Integration

### Step 1: Test ESP32 Connection
1. Open **Serial Monitor** (Ctrl+Shift+M)
2. Set baud rate to **115200**
3. You should see:
   ```
   Connecting to WiFi....
   WiFi connected!
   IP address: 192.168.x.x
   Firebase connected!
   Status updated to Firebase - Energizer: OFF
   ```

### Step 2: Test Web Dashboard Control
1. Open web dashboard in browser
2. Login with credentials
3. Click the **ENERGIZER ON/OFF** toggle
4. Check Serial Monitor - should show: "Command received: ON"
5. Check Firebase Console - data should update in real-time

### Step 3: Test Real-time Sync
1. In Firebase Console, manually change `energizer_status` to `true`
2. ESP32 should receive command and turn ON relay
3. Web dashboard should show updated status
4. Serial Monitor should show status updates every 3 seconds

### Step 4: Test Motion Detection
1. Trigger PIR sensor (wave hand in front)
2. Check Serial Monitor: "Motion alert sent to Firebase"
3. Check Firebase Console: New alert should appear in `/alerts/`
4. Web dashboard should show new alert in activity feed

---

## ⚠️ Troubleshooting

### Common Issues & Solutions:

#### 🚫 **Firebase Connection Failed**
- **Check WiFi credentials** in ESP32 code
- **Verify Firebase config** matches exactly
- **Check Firebase database rules** (should allow read/write)

#### 🚫 **Web Dashboard Shows "Demo Mode"**
- **Check browser console** (F12) for JavaScript errors
- **Verify Firebase SDK** is loading correctly
- **Clear browser cache** and reload page

#### 🚫 **ESP32 Not Receiving Commands**
- **Check Serial Monitor** for Firebase connection status
- **Verify database structure** matches expected format
- **Ensure `energizer_command` path exists** in Firebase

#### 🚫 **Data Not Updating**
- **Check Firebase database rules**
- **Verify internet connection** on both devices
- **Check Serial Monitor** for error messages

---

## 📊 PART 5: Monitoring & Maintenance

### Firebase Console Monitoring
1. **Realtime Database** → **Data**: View live data
2. **Usage** tab: Monitor database reads/writes
3. **Rules** tab: Update security rules for production

### ESP32 Monitoring
- **Serial Monitor**: Real-time status and error messages
- **LED indicator**: Shows energizer ON/OFF status
- **Relay clicking**: Audible feedback when commands received

### Web Dashboard Features
- **Real-time status**: Live updates every 3 seconds
- **Control panel**: Remote ON/OFF control
- **Alert system**: Motion detection and system alerts
- **Activity log**: Historical events and status changes

---

## ✅ Success Checklist

- [ ] Firebase project setup complete
- [ ] Database rules configured
- [ ] Web dashboard displays real data
- [ ] ESP32 connects to WiFi and Firebase
- [ ] Remote control works (web → ESP32)
- [ ] Status updates work (ESP32 → web)
- [ ] Motion detection sends alerts
- [ ] All data syncs in real-time

**🎉 Once all items are checked, your SecureFence Pro system is fully operational with Firebase integration!**

---

## 📞 Support

If you encounter issues:
1. **Check Serial Monitor** output for ESP32 errors
2. **Check browser console** (F12) for web errors  
3. **Verify Firebase Console** data is updating
4. **Test each component individually** before integration

Your Firebase configuration is now fully integrated for real-time fence monitoring and control!