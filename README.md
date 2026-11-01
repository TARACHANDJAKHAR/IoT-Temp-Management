# 🌡️ IoT Smart Climate Monitoring & Automated AC Controller

A modern, minimal, and responsive local web dashboard for real-time temperature and humidity monitoring, historical telemetry visualization, and automated climate control decision-making.

This project connects to **ThingSpeak Cloud** to retrieve live sensor telemetry uploaded from a **Raspberry Pi Pico W** connected to a **DHT22 sensor** simulated in **Wokwi**.

---

## 🏗️ System Architecture & Workflow

```text
       +---------------------------------------------+
       |   Wokwi Hardware Simulation                 |
       |   - Raspberry Pi Pico W                     |
       |   - DHT22 Sensor (DATA -> GP0)              |
       |   - Optional Alert LED (GP1)                |
       +----------------------+----------------------+
                              | MicroPython (urequests)
                              v (every 20 seconds)
       +---------------------------------------------+
       |   ThingSpeak IoT Cloud                      |
       |   - Field 1: Ambient Temperature (°C)       |
       |   - Field 2: Relative Humidity (%)          |
       +----------------------+----------------------+
                              | ThingSpeak Read API (JSON)
                              v
       +---------------------------------------------+
       |   Local Laptop Dashboard                    |
       |   - HTML5, CSS3, JavaScript (Chart.js)      |
       |   - Real-time KPIs & Statistical Analytics  |
       |   - Historical Interactive Charts           |
       +----------------------+----------------------+
                              |
                              v
       +---------------------------------------------+
       |   Smart AC Control Decision Algorithm       |
       |   - Dual-variable Climate Analysis          |
       |   - Automated Mode vs Manual Operator Mode  |
       |   - Energy-Efficient Thermal Regulation     |
       +---------------------------------------------+
```

---

## 📁 Project Directory Structure

```text
iot-climate-dashboard/
│
├── index.html        # Clean, responsive user interface and layout
├── style.css         # Minimalist theme (inspired by Cricket Analytics dashboard)
├── script.js         # ThingSpeak API client, Chart.js logic, and Smart AC engine
└── README.md         # Comprehensive project guide and documentation
```

---

## 🚀 Quick Start Guide: How to Run the Dashboard

You do **not** need a complicated backend or external database. The dashboard runs directly in your laptop's web browser using client-side JavaScript.

### Option 1: Direct Browser Launch (Easiest)
1. Open your file explorer and navigate into the `iot-climate-dashboard/` folder.
2. Double-click **`index.html`** to open it in Google Chrome, Microsoft Edge, Firefox, or Safari.

### Option 2: Python Local Server (Recommended for Development)
Running through a local web server avoids browser file-origin restrictions:

```bash
# Open terminal in the project directory:
cd "iot-climate-dashboard"

# Start Python's built-in HTTP server:
python3 -m http.server 8000
```

Now open your browser and navigate to:
```text
http://localhost:8000
```

---

## 🔑 ThingSpeak Configuration

You can configure your ThingSpeak credentials in **two easy ways**:

### Method A: Through the Browser User Interface (No code editing needed)
1. Open the dashboard in your browser.
2. Click the **"Channel Settings"** button in the top right header (or the alert banner).
3. Enter your:
   - **Channel ID** (e.g., `2891234`)
   - **Read API Key** (optional if your channel is set to Public)
4. Click **"Save & Connect"**. The dashboard will immediately connect and save your settings in your browser (`localStorage`).

---

### Method B: In `script.js` (Permanent default)
Open `iot-climate-dashboard/script.js` and locate lines 25–40:

```javascript
// ====================================================================
// STEP 1: CONFIGURATION (INSERT YOUR THINGSPEAK CREDENTIALS HERE)
// ====================================================================
const DEFAULT_CONFIG = {
  // 1. Enter your numeric ThingSpeak Channel ID:
  channelId: "YOUR_CHANNEL_ID",     // <-- Replace with e.g. "2891234"

  // 2. Enter your ThingSpeak Read API Key (if Private):
  readApiKey: "",                    // <-- Replace with e.g. "U8G8X9ABCD1234EF"

  // 3. Number of historical feeds to retrieve (default: 30):
  resultsCount: 30,

  // 4. Auto-refresh interval in seconds (default: 20):
  refreshIntervalSec: 20
};
```

#### Where to find these on ThingSpeak:
1. Log in to [ThingSpeak](https://thingspeak.com/) and click on your Channel.
2. **Channel ID**: Visible right below your channel name at the top of the page.
3. **Read API Key**: Click on the **"API Keys"** tab $\rightarrow$ copy the **"Read API Key"**.
   > *Note:* If your channel is public (Channel Settings $\rightarrow$ Sharing $\rightarrow$ "Share channel view with everyone"), you do not even need a Read API Key!

---

## 🤖 How the Smart AC Control Algorithm Works

The automated AC controller simulates an intelligent energy-saving climate management system. It continuously takes the latest **temperature** and **humidity** readings from ThingSpeak and determines the optimal appliance settings.

### Decision Matrix & Thresholds

Defined in `script.js`:
```javascript
const SETTINGS = {
  normalTemperature: 25.0,    // < 25°C
  moderateTemperature: 28.0,  // 25°C - 28°C
  highTemperature: 32.0,      // 28°C - 32°C
  highHumidity: 70.0          // > 70%
};
```

| Ambient Temperature ($T$) | Relative Humidity ($H$) | AC Status | Operating Mode | Target Setpoint | Cooling Level | Decision Rationale |
|---|---|---|---|---|---|---|
| **$T < 25^\circ\text{C}$** | $H \le 70\%$ | **OFF** | ECO MODE | $25^\circ\text{C}$ | OFF | Ambient temperature is within optimal comfort. Compressor turned off to save electricity. |
| **$25^\circ\text{C} \le T \le 28^\circ\text{C}$** | $H \le 70\%$ | **ON** | COOLING | $24^\circ\text{C}$ | LOW | Mild cooling engaged to maintain steady room temperature. |
| **$28^\circ\text{C} < T \le 32^\circ\text{C}$** | $H \le 70\%$ | **ON** | COOLING | $22^\circ\text{C}$ | HIGH | Elevated temperature detected. High cooling activated to quickly lower indoor temperature. |
| **$T > 32^\circ\text{C}$** | $H \le 70\%$ | **ON** | COOLING | $20^\circ\text{C}$ | MAXIMUM | Extreme heat condition! Maximum cooling capacity dispatched. |
| **Any $T$** | **$H > 70\%$** | **ON** | **DEHUMIDIFY** (+ COOL) | Adjusted | Increased | **High humidity detected**. Moisture extraction mode activated to prevent mugginess and mold. |

### Decision Function Output
The core JavaScript function `evaluateSmartAC(temperature, humidity)` returns a structured decision payload:

```javascript
{
  acStatus: "ON",
  mode: "COOLING",
  targetTemperature: 22,
  coolingLevel: "HIGH",
  reason: "Elevated ambient temperature (29.4°C) detected. High-efficiency cooling activated to rapidly bring room to 22°C.",
  isHighHumidity: false,
  activeRuleId: "ruleHigh"
}
```

---

## 🎛️ Switching Between AUTO and MANUAL Modes

The dashboard features a **Segmented Mode Switcher** located right above the AC Controller section:

### 1. AUTO MODE (`[ ⚡ AUTO ]`)
- The algorithm continuously computes the AC state in real-time.
- The **Automated Decision Matrix** table highlights which temperature/humidity threshold is currently being triggered.
- No user intervention is required.

### 2. MANUAL MODE (`[ 🎛️ MANUAL ]`)
- Allows the user to simulate operator control or override the automatic algorithm.
- Interactive controls become active:
  - **AC Power Button**: Turn AC unit ON or OFF.
  - **Target Setpoint Slider**: Adjust target temperature between $16^\circ\text{C}$ (Cold) and $30^\circ\text{C}$ (Warm).
  - **Cooling Level Buttons**: Select `LOW`, `MED`, `HIGH`, or `MAX`.
  - **Operating Mode Buttons**: Choose `Cooling`, `Eco`, `Dehumidify`, or `Fan Only`.
- The Virtual AC display reflects operator choices in real-time.

---

## 🔄 Live Auto-Refresh Mechanism

1. **Background Polling Cycle**: A JavaScript countdown timer counts down from 20 seconds down to 0:
   $$\text{20s} \rightarrow \text{19s} \rightarrow \dots \rightarrow \text{0s} \rightarrow \text{Fetch Data}$$
2. **Synchronized Interval**: The 20-second interval matches the `INTERVAL = 20` seconds programmed in your Raspberry Pi Pico W `main.py`.
3. **Manual Trigger**: Click the **"Refresh"** button at any time in the header for an immediate on-demand sync.
4. **Visual Status Dot**:
   - 🟢 **Green (Connected)**: Recent live feeds successfully loaded.
   - 🟡 **Amber (Fetching)**: Network request in progress.
   - 🔴 **Red (Offline / Unconfigured)**: Invalid Channel ID or network error.

---

## 🧪 Built-in Demo / Preview Mode

If your Wokwi simulation is not currently running or you want to demonstrate the dashboard offline during a presentation or review:
1. Click **"Channel Settings"** $\rightarrow$ Click **"Load Demo Data"** (or click **"Preview Demo Data"** on the alert banner).
2. The dashboard will generate **30 realistic DHT22 readings** matching your Pico W data logger format.
3. You can watch the charts render, inspect the statistics (Min, Avg, Max), and test both Auto and Manual AC modes immediately.

---

## 🛠️ Verification with Your Existing Wokwi Setup

Your existing MicroPython script in `Temperature and Humidity Monitoring/main.py` remains **100% intact and unchanged**:

1. In Wokwi, start your simulation.
2. The Pico W connects to `Wokwi-GUEST` Wi-Fi and begins uploading readings:
   ```text
   Reading : 1
   Temp    : 26.5 °C
   Humidity: 55.0 %
   Uploading to ThingSpeak...
   ThingSpeak Response: 1
   ```
3. Open your local dashboard in Chrome/Firefox.
4. Enter your ThingSpeak Channel ID in the dashboard settings.
5. Watch the live temperature card, humidity card, interactive charts, and smart AC controller update automatically every 20 seconds!
