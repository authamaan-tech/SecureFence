// Firebase imports and initialization
let firebaseDatabase = null;

// Application State
let currentPage = 'login';
let isLoggedIn = false;
let timeInterval;
let updateInterval;
let currentTimeSeconds = 0;
let firebaseListeners = [];
let isFirebaseConnected = false;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;

// Credentials from provided data
const credentials = {
    username: "admin",
    password: "password123"
};

// Application data structure
let appData = {
    fenceControl: {
        energizer_status: true,
        energizer_command: false,
        current_reading: 2.2,
        voltage_reading: 12.5,
        battery_level: 86.99,
        motion_detected: false,
        device_online: true,
        last_update: "2025-09-29T02:18:00Z",
        signal_strength: "4/5"
    },
    alerts: {},
    alertCounts: {
        critical: 0,
        warning: 0,
        info: 0,
        total: 0
    },
    recentActivity: []
};

// DOM Elements
const loginPage = document.getElementById('loginPage');
const dashboardPage = document.getElementById('dashboardPage');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const connectionStatus = document.getElementById('connectionStatus');
const errorModal = document.getElementById('errorModal');

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    console.log('SecureFence Pro - Initializing...');
    
    // Wait for Firebase to be available
    setTimeout(() => {
        if (window.firebaseDatabase) {
            firebaseDatabase = window.firebaseDatabase;
            console.log('Firebase database available');
        }
        initializeApp();
        setupEventListeners();
    }, 500);
});

function initializeApp() {
    // Check if user is already logged in
    const savedLoginState = sessionStorage.getItem('secureFenceLoggedIn');
    if (savedLoginState === 'true') {
        isLoggedIn = true;
        showPage('dashboard');
        initializeFirebase();
        startTimeDisplay();
    } else {
        showPage('login');
    }
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Login form
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Controls
    const mainToggle = document.getElementById('mainToggle');
    if (mainToggle) {
        mainToggle.addEventListener('change', handleMainToggle);
    }
    
    const energizerBtn = document.getElementById('energizerBtn');
    if (energizerBtn) {
        energizerBtn.addEventListener('click', handleEnergizerBtn);
    }
    
    const emergencyStopBtn = document.getElementById('emergencyStopBtn');
    if (emergencyStopBtn) {
        emergencyStopBtn.addEventListener('click', handleEmergencyStop);
    }
    
    const testModeBtn = document.getElementById('testModeBtn');
    if (testModeBtn) {
        testModeBtn.addEventListener('click', handleTestMode);
    }
    
    const systemResetBtn = document.getElementById('systemResetBtn');
    if (systemResetBtn) {
        systemResetBtn.addEventListener('click', handleSystemReset);
    }
    
    // Error modal
    const closeErrorModal = document.getElementById('closeErrorModal');
    if (closeErrorModal) {
        closeErrorModal.addEventListener('click', hideErrorModal);
    }
    
    const retryConnection = document.getElementById('retryConnection');
    if (retryConnection) {
        retryConnection.addEventListener('click', retryFirebaseConnection);
    }
    
    // Filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// Firebase Integration Functions
function initializeFirebase() {
    console.log('Initializing Firebase connection...');
    showConnectionStatus('connecting');
    
    try {
        if (!firebaseDatabase) {
            console.log('Firebase not available, using demo mode');
            simulateFirebaseData();
            updateConnectionStatus(true);
            return;
        }
        
        setupRealtimeListeners();
        setupInitialData();
        
    } catch (error) {
        console.error('Firebase initialization error:', error);
        simulateFirebaseData();
        updateConnectionStatus(true);
    }
}

function simulateFirebaseData() {
    console.log('Running in demo mode with simulated data');
    
    // Set initial demo data
    appData.alerts = {
        "1727570280": {
            type: "System Online",
            message: "Electric fence system activated successfully",
            timestamp: "2025-09-29T02:18:00Z",
            severity: "info"
        }
    };
    
    processAlerts();
    updateDashboard();
    
    // Simulate real-time updates
    setInterval(() => {
        simulateDataUpdates();
        updateDashboard();
    }, 5000);
}

function simulateDataUpdates() {
    // Simulate minor power variations
    if (Math.random() < 0.3) {
        appData.fenceControl.current_reading = parseFloat((2.0 + Math.random() * 0.5).toFixed(1));
        appData.fenceControl.voltage_reading = parseFloat((12.3 + Math.random() * 0.4).toFixed(1));
    }
    
    // Update timestamp
    appData.fenceControl.last_update = new Date().toISOString();
    
    // Randomly generate motion detection
    if (Math.random() < 0.05 && appData.fenceControl.energizer_status) {
        const timestamp = Date.now();
        appData.alerts[timestamp] = {
            type: "Motion Detected",
            message: `Motion detected at sector ${Math.floor(Math.random() * 5) + 1}`,
            timestamp: new Date().toISOString(),
            severity: "warning"
        };
        processAlerts();
    }
}

async function setupRealtimeListeners() {
    console.log('Setting up Firebase real-time listeners...');
    
    try {
        // Import Firebase functions dynamically
        const { ref, onValue, off } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js');
        
        // Listen to fence control data
        const fenceControlRef = ref(firebaseDatabase, 'fence_control');
        const fenceControlListener = onValue(fenceControlRef, (snapshot) => {
            if (snapshot.exists()) {
                console.log('Fence control data updated:', snapshot.val());
                appData.fenceControl = { ...appData.fenceControl, ...snapshot.val() };
                updateDashboard();
                updateConnectionStatus(true);
            }
        }, (error) => {
            console.error('Fence control listener error:', error);
            handleFirebaseError(error);
        });
        
        // Listen to alerts
        const alertsRef = ref(firebaseDatabase, 'alerts');
        const alertsListener = onValue(alertsRef, (snapshot) => {
            if (snapshot.exists()) {
                console.log('Alerts data updated:', snapshot.val());
                appData.alerts = snapshot.val();
                processAlerts();
                updateDashboard();
            }
        }, (error) => {
            console.error('Alerts listener error:', error);
            handleFirebaseError(error);
        });
        
        // Store listeners for cleanup
        firebaseListeners = [
            { ref: fenceControlRef, listener: fenceControlListener },
            { ref: alertsRef, listener: alertsListener }
        ];
        
        updateConnectionStatus(true);
        
    } catch (error) {
        console.error('Error setting up Firebase listeners:', error);
        handleFirebaseError(error);
    }
}

async function setupInitialData() {
    console.log('Setting up initial Firebase data...');
    
    try {
        const { ref, set } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js');
        
        // Set initial fence control data
        const initialFenceData = {
            energizer_status: true,
            energizer_command: false,
            current_reading: 2.2,
            voltage_reading: 12.5,
            battery_level: 86.99,
            motion_detected: false,
            device_online: true,
            last_update: new Date().toISOString(),
            signal_strength: "4/5"
        };
        
        // Set initial alert
        const initialAlert = {
            type: "System Online",
            message: "Electric fence system activated successfully",
            timestamp: new Date().toISOString(),
            severity: "info"
        };
        
        // Write initial data
        const fenceControlRef = ref(firebaseDatabase, 'fence_control');
        await set(fenceControlRef, initialFenceData);
        
        const alertRef = ref(firebaseDatabase, `alerts/${Date.now()}`);
        await set(alertRef, initialAlert);
        
    } catch (error) {
        console.error('Error setting up initial Firebase data:', error);
    }
}

async function sendCommand(command, value) {
    console.log(`Sending command: ${command} = ${value}`);
    
    try {
        if (!firebaseDatabase) {
            console.log('Demo mode: simulating command', command, value);
            // Simulate command in demo mode
            appData.fenceControl[command] = value;
            appData.fenceControl.last_update = new Date().toISOString();
            addActivityLog(command, value);
            return Promise.resolve();
        }
        
        const { ref, set } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js');
        
        const commandRef = ref(firebaseDatabase, `fence_control/${command}`);
        const lastUpdateRef = ref(firebaseDatabase, 'fence_control/last_update');
        
        await Promise.all([
            set(commandRef, value),
            set(lastUpdateRef, new Date().toISOString())
        ]);
        
        console.log(`Command ${command} sent successfully`);
        addActivityLog(command, value);
        
    } catch (error) {
        console.error(`Error sending command ${command}:`, error);
        throw error;
    }
}

async function addActivityLog(action, value) {
    const timestamp = Date.now();
    let activityData;
    
    switch(action) {
        case 'energizer_command':
            activityData = {
                type: value ? "System Armed" : "System Disarmed",
                message: `Electric fence system ${value ? 'activated' : 'deactivated'} remotely`,
                timestamp: new Date().toISOString(),
                severity: "info"
            };
            break;
        case 'emergency_stop':
            activityData = {
                type: "Emergency Stop",
                message: "Emergency stop activated by operator",
                timestamp: new Date().toISOString(),
                severity: "critical"
            };
            break;
        case 'test_mode':
            activityData = {
                type: "Test Mode",
                message: "System entered test mode for maintenance",
                timestamp: new Date().toISOString(),
                severity: "warning"
            };
            break;
        case 'system_reset':
            activityData = {
                type: "System Reset",
                message: "System reset completed successfully",
                timestamp: new Date().toISOString(),
                severity: "info"
            };
            break;
        default:
            return;
    }
    
    try {
        if (firebaseDatabase) {
            const { ref, set } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js');
            const alertRef = ref(firebaseDatabase, `alerts/${timestamp}`);
            await set(alertRef, activityData);
        } else {
            // Demo mode: add to local data
            appData.alerts[timestamp] = activityData;
            processAlerts();
        }
    } catch (error) {
        console.error('Error adding activity log:', error);
    }
}

function processAlerts() {
    const alerts = appData.alerts;
    const activity = [];
    let counts = { critical: 0, warning: 0, info: 0, total: 0 };
    
    // Convert alerts object to array and process
    Object.entries(alerts).forEach(([timestamp, alert]) => {
        // Add to activity list
        activity.push({
            id: timestamp,
            type: alert.type,
            description: alert.message,
            timestamp: formatTimestamp(alert.timestamp),
            severity: alert.severity,
            color: getSeverityColor(alert.severity)
        });
        
        // Count by severity
        if (alert.severity === 'critical') counts.critical++;
        else if (alert.severity === 'warning') counts.warning++;
        else if (alert.severity === 'info') counts.info++;
        counts.total++;
    });
    
    // Sort by timestamp (newest first)
    activity.sort((a, b) => parseInt(b.id) - parseInt(a.id));
    
    // Keep only recent 10 activities
    appData.recentActivity = activity.slice(0, 10);
    appData.alertCounts = counts;
}

function getSeverityColor(severity) {
    switch(severity) {
        case 'critical': return 'red';
        case 'warning': return 'yellow';
        case 'info': return 'blue';
        default: return 'blue';
    }
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Connection Management
function updateConnectionStatus(connected) {
    isFirebaseConnected = connected;
    reconnectAttempts = connected ? 0 : reconnectAttempts;
    
    const headerStatusDot = document.getElementById('headerStatusDot');
    const headerStatusText = document.getElementById('headerStatusText');
    
    if (headerStatusDot && headerStatusText) {
        if (connected) {
            headerStatusDot.className = 'status-dot online';
            headerStatusText.textContent = 'ONLINE';
            headerStatusText.className = 'status-text';
            showConnectionStatus('online');
            hideErrorModal();
        } else {
            headerStatusDot.className = 'status-dot offline';
            headerStatusText.textContent = 'OFFLINE';
            headerStatusText.className = 'status-text offline';
            showConnectionStatus('offline');
        }
    }
}

function showConnectionStatus(status) {
    if (!connectionStatus) return;
    
    const indicator = connectionStatus.querySelector('.connection-indicator');
    const statusText = connectionStatus.querySelector('.status-text');
    
    if (status === 'online') {
        connectionStatus.classList.add('hidden');
    } else {
        connectionStatus.classList.remove('hidden');
        
        if (indicator && statusText) {
            if (status === 'connecting') {
                indicator.className = 'connection-indicator offline';
                statusText.textContent = 'Connecting to Firebase...';
            } else if (status === 'offline') {
                indicator.className = 'connection-indicator offline';
                statusText.textContent = 'Connection Lost - Reconnecting...';
            }
        }
    }
}

function handleFirebaseError(error) {
    console.error('Firebase error:', error);
    updateConnectionStatus(false);
    
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
        setTimeout(() => {
            retryFirebaseConnection();
        }, 2000 * reconnectAttempts);
    } else {
        showErrorModal(`Firebase connection failed: ${error.message}`);
    }
}

function retryFirebaseConnection() {
    console.log('Retrying Firebase connection...');
    showConnectionStatus('connecting');
    
    // Clean up existing listeners
    cleanupFirebaseListeners();
    
    // Retry initialization
    setTimeout(() => {
        initializeFirebase();
    }, 1000);
}

function cleanupFirebaseListeners() {
    // Clean up listeners if Firebase is available
    if (firebaseListeners.length > 0) {
        console.log('Cleaning up Firebase listeners...');
        firebaseListeners = [];
    }
}

function showErrorModal(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage && errorModal) {
        errorMessage.textContent = message;
        errorModal.classList.remove('hidden');
    }
}

function hideErrorModal() {
    if (errorModal) {
        errorModal.classList.add('hidden');
    }
}

// Authentication Functions
function handleLogin(e) {
    e.preventDefault();
    console.log('Login attempt...');
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    console.log('Login credentials:', { username: username, password: password ? '[PROVIDED]' : '[EMPTY]' });
    
    if (username === credentials.username && password === credentials.password) {
        console.log('Login successful');
        isLoggedIn = true;
        sessionStorage.setItem('secureFenceLoggedIn', 'true');
        hideLoginError();
        showPage('dashboard');
        startTimeDisplay();
        initializeFirebase();
    } else {
        console.log('Login failed - invalid credentials');
        showLoginError('Invalid username or password. Try admin/password123');
    }
}

function handleLogout() {
    console.log('Logout requested');
    isLoggedIn = false;
    sessionStorage.removeItem('secureFenceLoggedIn');
    stopTimeDisplay();
    cleanupFirebaseListeners();
    showPage('login');
    
    // Clear form fields
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    if (usernameField) usernameField.value = '';
    if (passwordField) passwordField.value = '';
}

function showLoginError(message) {
    if (loginError) {
        loginError.textContent = message;
        loginError.classList.remove('hidden');
        setTimeout(() => hideLoginError(), 5000);
    }
}

function hideLoginError() {
    if (loginError) {
        loginError.classList.add('hidden');
    }
}

// Page Management
function showPage(pageName) {
    console.log('Showing page:', pageName);
    
    if (loginPage) loginPage.classList.add('hidden');
    if (dashboardPage) dashboardPage.classList.add('hidden');
    
    currentPage = pageName;
    switch(pageName) {
        case 'login':
            if (loginPage) loginPage.classList.remove('hidden');
            break;
        case 'dashboard':
            if (dashboardPage) dashboardPage.classList.remove('hidden');
            updateDashboard();
            break;
    }
}

// Time Display Functions
function startTimeDisplay() {
    updateTimeDisplay();
    timeInterval = setInterval(() => {
        currentTimeSeconds++;
        updateTimeDisplay();
    }, 1000);
}

function stopTimeDisplay() {
    if (timeInterval) {
        clearInterval(timeInterval);
        timeInterval = null;
    }
}

function updateTimeDisplay() {
    const baseTime = new Date(`2025-09-29T02:18:00Z`);
    const currentTime = new Date(baseTime.getTime() + (currentTimeSeconds * 1000));
    
    const timeString = currentTime.toTimeString().split(' ')[0];
    const currentTimeEl = document.getElementById('currentTime');
    const currentDateEl = document.getElementById('currentDate');
    
    if (currentTimeEl) currentTimeEl.textContent = timeString;
    if (currentDateEl) currentDateEl.textContent = 'Monday, September 29, 2025';
}

// Dashboard Update Functions
function updateDashboard() {
    if (currentPage !== 'dashboard') return;
    
    updateWelcomeMessage();
    updateFenceStatus();
    updatePowerMonitoring();
    updateSystemHealth();
    updateAlertCounts();
    updateRecentActivity();
    updateSystemStats();
}

function updateWelcomeMessage() {
    const welcomeText = document.getElementById('welcomeText');
    if (welcomeText) {
        welcomeText.textContent = 'Welcome back, Amaan01';
    }
}

function updateFenceStatus() {
    const isActive = appData.fenceControl.energizer_status;
    
    // Update status text and indicators
    const fenceStatusText = document.getElementById('fenceStatusText');
    const fenceStatusDot = document.getElementById('fenceStatusDot');
    const energizerBtn = document.getElementById('energizerBtn');
    const energizedBtn = document.getElementById('energizedBtn');
    const mainToggle = document.getElementById('mainToggle');
    const statusMessage = document.getElementById('statusMessage');
    
    if (isActive) {
        if (fenceStatusText) {
            fenceStatusText.textContent = 'FENCE ACTIVE';
            fenceStatusText.classList.remove('inactive');
        }
        if (fenceStatusDot) fenceStatusDot.className = 'status-dot active';
        if (energizerBtn) {
            energizerBtn.textContent = 'ENERGIZER ON';
            energizerBtn.className = 'energizer-btn active';
        }
        if (energizedBtn) {
            energizedBtn.textContent = 'ENERGIZED';
            energizedBtn.className = 'status-button energized';
        }
        if (mainToggle) mainToggle.checked = true;
        if (statusMessage) {
            statusMessage.textContent = '🟢 Fence is energized and operational';
            statusMessage.className = 'status-message active';
        }
    } else {
        if (fenceStatusText) {
            fenceStatusText.textContent = 'FENCE INACTIVE';
            fenceStatusText.classList.add('inactive');
        }
        if (fenceStatusDot) fenceStatusDot.className = 'status-dot inactive';
        if (energizerBtn) {
            energizerBtn.textContent = 'ENERGIZER OFF';
            energizerBtn.className = 'energizer-btn inactive';
        }
        if (energizedBtn) {
            energizedBtn.textContent = 'DE-ENERGIZED';
            energizedBtn.className = 'status-button de-energized';
        }
        if (mainToggle) mainToggle.checked = false;
        if (statusMessage) {
            statusMessage.textContent = '🔴 Fence is de-energized';
            statusMessage.className = 'status-message inactive';
        }
    }
}

function updatePowerMonitoring() {
    const currentReading = document.getElementById('currentReading');
    const voltageReading = document.getElementById('voltageReading');
    const batteryLevel = document.getElementById('batteryLevel');
    const batteryPercent = document.getElementById('batteryPercent');
    
    if (currentReading) currentReading.textContent = `${appData.fenceControl.current_reading} A`;
    if (voltageReading) voltageReading.textContent = `${appData.fenceControl.voltage_reading} V`;
    
    const batteryLevelValue = Math.round(appData.fenceControl.battery_level);
    if (batteryLevel) batteryLevel.style.width = `${batteryLevelValue}%`;
    if (batteryPercent) batteryPercent.textContent = `${batteryLevelValue}%`;
}

function updateSystemHealth() {
    const deviceOnline = appData.fenceControl.device_online;
    const deviceStatusDot = document.getElementById('deviceStatusDot');
    const deviceStatusText = document.getElementById('deviceStatusText');
    const systemHealthMessage = document.getElementById('systemHealthMessage');
    const lastUpdateText = document.getElementById('lastUpdateText');
    const signalStrengthText = document.getElementById('signalStrengthText');
    
    if (deviceOnline && isFirebaseConnected) {
        if (deviceStatusDot) deviceStatusDot.className = 'status-dot online';
        if (deviceStatusText) deviceStatusText.textContent = 'Online';
        if (systemHealthMessage) {
            systemHealthMessage.textContent = 'All Systems Operational';
            systemHealthMessage.className = 'health-status-message';
        }
    } else {
        if (deviceStatusDot) deviceStatusDot.className = 'status-dot offline';
        if (deviceStatusText) deviceStatusText.textContent = 'Offline';
        if (systemHealthMessage) {
            systemHealthMessage.textContent = 'System Connection Issues';
            systemHealthMessage.className = 'health-status-message warning';
        }
    }
    
    // Update other health indicators
    if (lastUpdateText) lastUpdateText.textContent = formatTimestamp(appData.fenceControl.last_update);
    if (signalStrengthText) signalStrengthText.textContent = `📶 ${appData.fenceControl.signal_strength}`;
}

function updateAlertCounts() {
    const counts = appData.alertCounts;
    
    const criticalCount = document.getElementById('criticalCount');
    const warningCount = document.getElementById('warningCount');
    const infoCount = document.getElementById('infoCount');
    const alertBadge = document.getElementById('alertBadge');
    
    if (criticalCount) criticalCount.textContent = counts.critical;
    if (warningCount) warningCount.textContent = counts.warning;
    if (infoCount) infoCount.textContent = counts.info;
    
    if (alertBadge) {
        alertBadge.textContent = counts.total;
        alertBadge.className = counts.total > 0 ? 'alert-badge' : 'alert-badge zero';
    }
}

function updateRecentActivity() {
    const activityList = document.getElementById('activityList');
    const activityCountBadge = document.getElementById('activityCountBadge');
    
    if (!activityList) return;
    
    activityList.innerHTML = '';
    
    if (appData.recentActivity.length === 0) {
        activityList.innerHTML = '<div class="loading-message">Loading activity data...</div>';
        if (activityCountBadge) activityCountBadge.textContent = '0';
        return;
    }
    
    appData.recentActivity.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        activityItem.innerHTML = `
            <div class="activity-dot ${activity.color}"></div>
            <div class="activity-content">
                <div class="activity-title-text">${activity.type}</div>
                <div class="activity-description">${activity.description}</div>
                <div class="activity-timestamp">${activity.timestamp}</div>
            </div>
        `;
        
        activityList.appendChild(activityItem);
    });
    
    if (activityCountBadge) activityCountBadge.textContent = appData.recentActivity.length;
}

function updateSystemStats() {
    // Update output voltage display
    const outputValue = document.getElementById('outputValue');
    if (outputValue) {
        outputValue.textContent = `${appData.fenceControl.voltage_reading}kV`;
    }
}

// Control Functions
function handleMainToggle(e) {
    const isOn = e.target.checked;
    console.log('Toggle switch changed:', isOn);
    
    sendCommand('energizer_command', isOn)
        .then(() => {
            console.log('Energizer command sent successfully');
            // Update local state immediately for responsive UI
            appData.fenceControl.energizer_status = isOn;
            updateDashboard();
        })
        .catch(error => {
            console.error('Failed to send energizer command:', error);
            // Revert toggle if command failed
            e.target.checked = !isOn;
        });
}

function handleEnergizerBtn() {
    const mainToggle = document.getElementById('mainToggle');
    if (mainToggle) {
        mainToggle.click();
    }
}

function handleEmergencyStop() {
    if (confirm('Are you sure you want to activate emergency stop? This will immediately shut down the fence system.')) {
        sendCommand('energizer_command', false)
            .then(() => {
                appData.fenceControl.energizer_status = false;
                addActivityLog('emergency_stop', true);
                updateDashboard();
                alert('Emergency stop activated. System is now offline.');
            })
            .catch(error => {
                console.error('Failed to send emergency stop:', error);
                alert('Failed to activate emergency stop. Please check connection.');
            });
    }
}

function handleTestMode() {
    if (confirm('Activate test mode? This will temporarily disable normal operations.')) {
        addActivityLog('test_mode', true);
        alert('Test mode activated. System running in test configuration.');
    }
}

function handleSystemReset() {
    if (confirm('Are you sure you want to reset the system? This will restart all monitoring services.')) {
        Promise.all([
            sendCommand('energizer_status', true),
            sendCommand('device_online', true)
        ]).then(() => {
            appData.fenceControl.energizer_status = true;
            appData.fenceControl.device_online = true;
            addActivityLog('system_reset', true);
            updateDashboard();
            alert('System reset completed successfully.');
        }).catch(error => {
            console.error('Failed to reset system:', error);
            alert('Failed to reset system. Please check connection.');
        });
    }
}

// Initialize time tracking
currentTimeSeconds = 0;

// Error handling
window.addEventListener('error', function(e) {
    console.error('Application error:', e.error);
});

// Prevent memory leaks on page unload
window.addEventListener('beforeunload', function() {
    cleanupFirebaseListeners();
    stopTimeDisplay();
});

console.log('SecureFence Pro - Application loaded successfully');