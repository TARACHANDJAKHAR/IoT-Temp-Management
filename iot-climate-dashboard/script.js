/**
 * ====================================================================
 * IoT Smart Climate Monitoring & Automated AC Controller
 * Course: AI457 Internet of Things and Edge Computing
 * Hardware: Raspberry Pi Pico W + DHT22 + ThingSpeak Cloud
 * ====================================================================
 * 
 * This script handles:
 * 1. Fetching live telemetry from ThingSpeak READ API (Field 1: Temp, Field 2: Hum)
 * 2. Real-time statistical analysis (Min, Max, Average)
 * 3. Interactive Chart.js graph rendering for historical trends
 * 4. Intelligent Smart AC Control decision algorithm
 * 5. Automatic (AI/Rule-based) vs Manual AC operation modes
 * 6. Periodic auto-refresh timer with visual countdown
 */

// ====================================================================
// STEP 1: CONFIGURATION (INSERT YOUR THINGSPEAK CREDENTIALS HERE)
// ====================================================================
const DEFAULT_CONFIG = {
  // ------------------------------------------------------------------
  // 1. YOUR THINGSPEAK CHANNEL ID:
  //    Replace "YOUR_CHANNEL_ID" with your numeric ThingSpeak Channel ID.
  //    Example: channelId: "2841923"
  // ------------------------------------------------------------------
  channelId: "3561664",

  // ------------------------------------------------------------------
  // 2. YOUR THINGSPEAK READ API KEY:
  //    If your channel is PUBLIC, you can leave this empty ("").
  //    If your channel is PRIVATE, paste your Read API Key here.
  //    Example: readApiKey: "U8G8X9ABCD1234EF"
  // ------------------------------------------------------------------
  readApiKey: "OMZKPBOF2C8UJRZG",

  // ------------------------------------------------------------------
  // 3. NUMBER OF HISTORICAL FEEDS TO RETRIEVE:
  //    Matches the 30 readings collected by the Raspberry Pi Pico W program.
  // ------------------------------------------------------------------
  resultsCount: 30,

  // ------------------------------------------------------------------
  // 4. AUTO-REFRESH INTERVAL (in seconds):
  //    Pico W uploads data every 20 seconds, so 20 seconds is optimal.
  // ------------------------------------------------------------------
  refreshIntervalSec: 20
};

// ====================================================================
// STEP 2: SMART AC CONTROLLER THRESHOLDS & SETTINGS
// ====================================================================
const SETTINGS = {
  normalTemperature: 25.0,    // < 25°C  => Normal / AC OFF or ECO MODE
  moderateTemperature: 28.0,  // 25 - 28°C => Moderate / AC ON, Low/Med Cooling, Target 24°C
  highTemperature: 32.0,      // 28 - 32°C => High / AC ON, High Cooling, Target 22°C
  // > 32°C => Very High / AC ON, Maximum Cooling, Target 20°C
  highHumidity: 70.0          // > 70%   => Dehumidification Boost
};

// ====================================================================
// STATE MANAGEMENT
// ====================================================================
let appConfig = loadSavedConfig();
let currentMode = "AUTO"; // "AUTO" or "MANUAL"
let refreshCountdown = appConfig.refreshIntervalSec;
let countdownTimerId = null;
let tempChart = null;
let humChart = null;
let isDemoMode = false;

// Manual AC State (for simulation override)
let manualAC = {
  power: "ON",
  mode: "COOLING",
  targetTemperature: 24,
  coolingLevel: "MEDIUM"
};

// ====================================================================
// DOM ELEMENTS REFERENCE
// ====================================================================
const els = {
  // Status indicators
  statusBadge: document.getElementById("statusBadge"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  timerCountdown: document.getElementById("timerCountdown"),
  refreshBtn: document.getElementById("refreshBtn"),
  lastSyncText: document.getElementById("lastSyncText"),
  noticeBanner: document.getElementById("noticeBanner"),
  noticeMessage: document.getElementById("noticeMessage"),
  chartPointsCount: document.getElementById("chartPointsCount"),

  // Temperature Elements
  currentTemp: document.getElementById("currentTemp"),
  minTemp: document.getElementById("minTemp"),
  avgTemp: document.getElementById("avgTemp"),
  maxTemp: document.getElementById("maxTemp"),
  tempStatusTag: document.getElementById("tempStatusTag"),
  tempTimeText: document.getElementById("tempTimeText"),

  // Humidity Elements
  currentHum: document.getElementById("currentHum"),
  minHum: document.getElementById("minHum"),
  avgHum: document.getElementById("avgHum"),
  maxHum: document.getElementById("maxHum"),
  humStatusTag: document.getElementById("humStatusTag"),
  humTimeText: document.getElementById("humTimeText"),

  // AC Virtual Appliance Display
  acPowerBadge: document.getElementById("acPowerBadge"),
  acPowerText: document.getElementById("acPowerText"),
  acModeDisplay: document.getElementById("acModeDisplay"),
  acTargetTempDisplay: document.getElementById("acTargetTempDisplay"),
  acCoolingLevelDisplay: document.getElementById("acCoolingLevelDisplay"),
  acReasonText: document.getElementById("acReasonText"),
  humidityAdvisory: document.getElementById("humidityAdvisory"),
  humidityAdvisoryText: document.getElementById("humidityAdvisoryText"),

  // Mode Selection Elements
  modeAutoBtn: document.getElementById("modeAutoBtn"),
  modeManualBtn: document.getElementById("modeManualBtn"),
  autoModePanel: document.getElementById("autoModePanel"),
  manualModePanel: document.getElementById("manualModePanel"),

  // Manual Controls
  manualPowerOnBtn: document.getElementById("manualPowerOnBtn"),
  manualPowerOffBtn: document.getElementById("manualPowerOffBtn"),
  manualPowerStateText: document.getElementById("manualPowerStateText"),
  manualTempSlider: document.getElementById("manualTempSlider"),
  manualTempSliderVal: document.getElementById("manualTempSliderVal"),
  manualLevelText: document.getElementById("manualLevelText"),

  // Modal & Config Elements
  configModal: document.getElementById("configModal"),
  openConfigBtn: document.getElementById("openConfigBtn"),
  closeConfigBtn: document.getElementById("closeConfigBtn"),
  saveConfigBtn: document.getElementById("saveConfigBtn"),
  useDemoDataBtn: document.getElementById("useDemoDataBtn"),
  quickConfigureBtn: document.getElementById("quickConfigureBtn"),
  quickDemoBtn: document.getElementById("quickDemoBtn"),
  cfgChannelId: document.getElementById("cfgChannelId"),
  cfgApiKey: document.getElementById("cfgApiKey"),
  cfgResults: document.getElementById("cfgResults"),
  cfgInterval: document.getElementById("cfgInterval")
};

// ====================================================================
// SMART AC CONTROL ALGORITHM
// ====================================================================
/**
 * Evaluates current temperature and humidity against environmental comfort thresholds
 * and returns recommended AC operating status, mode, setpoint, and explanation.
 * 
 * @param {number} temperature - Ambient temperature in °C
 * @param {number} humidity - Ambient relative humidity in %
 * @param {object} settings - Threshold configuration
 * @returns {object} Calculated AC decision object
 */
function evaluateSmartAC(temperature, humidity, settings = SETTINGS) {
  let acStatus = "ON";
  let mode = "COOLING";
  let targetTemperature = 24;
  let coolingLevel = "MEDIUM";
  let reason = "";
  let activeRuleId = "";

  // 1. Evaluate Temperature Bands
  if (temperature < settings.normalTemperature) {
    // Normal / Cool condition (< 25°C)
    acStatus = "OFF";
    mode = "ECO MODE";
    targetTemperature = 25;
    coolingLevel = "OFF";
    reason = `Ambient temperature (${temperature.toFixed(1)}°C) is below ${settings.normalTemperature}°C threshold. Climate is comfortable; compressor powered off to conserve energy.`;
    activeRuleId = "ruleNormal";

  } else if (temperature >= settings.normalTemperature && temperature <= settings.moderateTemperature) {
    // Moderate condition (25°C to 28°C)
    acStatus = "ON";
    mode = "COOLING";
    targetTemperature = 24;
    coolingLevel = "LOW";
    reason = `Moderate ambient temperature (${temperature.toFixed(1)}°C) detected. Gentle cooling engaged to maintain steady room comfort.`;
    activeRuleId = "ruleModerate";

  } else if (temperature > settings.moderateTemperature && temperature <= settings.highTemperature) {
    // High condition (28°C to 32°C)
    acStatus = "ON";
    mode = "COOLING";
    targetTemperature = 22;
    coolingLevel = "HIGH";
    reason = `Elevated ambient temperature (${temperature.toFixed(1)}°C) detected. High-efficiency cooling activated to rapidly bring room to 22°C.`;
    activeRuleId = "ruleHigh";

  } else {
    // Very High condition (> 32°C)
    acStatus = "ON";
    mode = "COOLING";
    targetTemperature = 20;
    coolingLevel = "MAXIMUM";
    reason = `Extreme ambient temperature (${temperature.toFixed(1)}°C) detected! Maximum cooling capacity dispatched to protect indoor comfort.`;
    activeRuleId = "ruleVeryHigh";
  }

  // 2. Evaluate Humidity Influence
  const isHighHumidity = humidity > settings.highHumidity;
  if (isHighHumidity) {
    if (acStatus === "OFF") {
      // Even if temperature is cool, high humidity needs active dehumidification
      acStatus = "ON";
      mode = "DEHUMIDIFY";
      targetTemperature = 24;
      coolingLevel = "LOW";
      reason += ` High humidity (${humidity.toFixed(1)}% > ${settings.highHumidity}%) detected. AC switched to Dry/Dehumidify mode to extract excess moisture.`;
    } else {
      // Stronger cooling and dehumidification
      mode = "DEHUMIDIFY + COOL";
      reason += ` High relative humidity (${humidity.toFixed(1)}%) requires accelerated dehumidification cycle alongside thermal cooling.`;
    }
  }

  return {
    acStatus,
    mode,
    targetTemperature,
    coolingLevel,
    reason,
    isHighHumidity,
    activeRuleId
  };
}

// ====================================================================
// UI UPDATE FUNCTIONS
// ====================================================================

/**
 * Updates the virtual AC display based on a decision state object.
 */
function renderACDisplay(decision) {
  // Update Power Badge
  if (decision.acStatus === "ON") {
    els.acPowerBadge.className = "ac-power-badge power-on";
    els.acPowerText.textContent = "AC STATUS: ON";
  } else {
    els.acPowerBadge.className = "ac-power-badge power-off";
    els.acPowerText.textContent = "AC STATUS: OFF";
  }

  // Update Parameters
  els.acModeDisplay.textContent = decision.mode;
  els.acTargetTempDisplay.innerHTML = `${decision.targetTemperature}&deg;C`;
  els.acCoolingLevelDisplay.textContent = decision.coolingLevel;

  // Update Reason Box
  els.acReasonText.textContent = decision.reason;

  // Humidity Advisory Banner
  if (decision.isHighHumidity) {
    els.humidityAdvisory.classList.remove("hidden");
    els.humidityAdvisoryText.textContent = `High Humidity Detected (${decision.humidity ? decision.humidity.toFixed(1) : '>70'}%): Dehumidification Mode Recommended`;
    highlightRule("ruleHumid", true);
  } else {
    els.humidityAdvisory.classList.add("hidden");
    highlightRule("ruleHumid", false);
  }

  // Highlight active rule in Auto Matrix list
  if (currentMode === "AUTO") {
    ["ruleNormal", "ruleModerate", "ruleHigh", "ruleVeryHigh"].forEach(id => {
      highlightRule(id, id === decision.activeRuleId);
    });
  }
}

function highlightRule(ruleId, isActive) {
  const elem = document.getElementById(ruleId);
  if (elem) {
    if (isActive) {
      elem.classList.add("rule-active");
    } else {
      elem.classList.remove("rule-active");
    }
  }
}

/**
 * Updates sensor cards with primary readings and calculated statistics.
 */
function updateSensorCards(lastTemp, lastHum, temps, hums, lastTimestamp) {
  // Temperature Card
  if (lastTemp !== null && !isNaN(lastTemp)) {
    els.currentTemp.textContent = lastTemp.toFixed(1);
    
    // Status Tag logic
    if (lastTemp < 25) {
      els.tempStatusTag.className = "status-tag tag-normal";
      els.tempStatusTag.textContent = "Comfortable";
    } else if (lastTemp <= 30) {
      els.tempStatusTag.className = "status-tag tag-warning";
      els.tempStatusTag.textContent = "Warm";
    } else {
      els.tempStatusTag.className = "status-tag tag-alert";
      els.tempStatusTag.textContent = "High Temp";
    }
  } else {
    els.currentTemp.textContent = "--.-";
  }

  // Humidity Card
  if (lastHum !== null && !isNaN(lastHum)) {
    els.currentHum.textContent = lastHum.toFixed(1);

    // Status Tag logic
    if (lastHum < 30) {
      els.humStatusTag.className = "status-tag tag-warning";
      els.humStatusTag.textContent = "Dry";
    } else if (lastHum <= 65) {
      els.humStatusTag.className = "status-tag tag-normal";
      els.humStatusTag.textContent = "Optimal";
    } else {
      els.humStatusTag.className = "status-tag tag-alert";
      els.humStatusTag.textContent = "Humid";
    }
  } else {
    els.currentHum.textContent = "--.-";
  }

  // Statistics calculation for Temperature
  if (temps.length > 0) {
    const minT = Math.min(...temps);
    const maxT = Math.max(...temps);
    const avgT = temps.reduce((a, b) => a + b, 0) / temps.length;

    els.minTemp.innerHTML = `${minT.toFixed(1)} &deg;C`;
    els.avgTemp.innerHTML = `${avgT.toFixed(1)} &deg;C`;
    els.maxTemp.innerHTML = `${maxT.toFixed(1)} &deg;C`;
  }

  // Statistics calculation for Humidity
  if (hums.length > 0) {
    const minH = Math.min(...hums);
    const maxH = Math.max(...hums);
    const avgH = hums.reduce((a, b) => a + b, 0) / hums.length;

    els.minHum.innerHTML = `${minH.toFixed(1)} %`;
    els.avgHum.innerHTML = `${avgH.toFixed(1)} %`;
    els.maxHum.innerHTML = `${maxH.toFixed(1)} %`;
  }

  // Timestamp updates
  const formattedTime = lastTimestamp ? formatDateTime(lastTimestamp) : new Date().toLocaleTimeString();
  els.tempTimeText.textContent = `Recorded at ${formattedTime}`;
  els.humTimeText.textContent = `Recorded at ${formattedTime}`;
  els.lastSyncText.textContent = `Last Updated: ${formattedTime}`;
}

// ====================================================================
// CHART.JS INITIALIZATION & DATA RENDERING
// ====================================================================

function initCharts() {
  const chartCommonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(17, 24, 39, 0.9)",
        titleFont: { family: "Inter", size: 12 },
        bodyFont: { family: "Inter", size: 12 },
        padding: 10,
        cornerRadius: 6,
        displayColors: false
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: "Inter", size: 11 },
          color: "#9ca3af",
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8
        }
      },
      y: {
        grid: { color: "#f3f4f6" },
        ticks: {
          font: { family: "Inter", size: 11 },
          color: "#9ca3af"
        }
      }
    }
  };

  // Temperature Chart
  const ctxTemp = document.getElementById("temperatureChart").getContext("2d");
  tempChart = new Chart(ctxTemp, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Temperature (°C)",
        data: [],
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.08)",
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: "#ef4444"
      }]
    },
    options: {
      ...chartCommonOptions,
      scales: {
        ...chartCommonOptions.scales,
        y: {
          ...chartCommonOptions.scales.y,
          title: { display: true, text: "°C", color: "#9ca3af", font: { size: 11 } }
        }
      }
    }
  });

  // Humidity Chart
  const ctxHum = document.getElementById("humidityChart").getContext("2d");
  humChart = new Chart(ctxHum, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Humidity (%)",
        data: [],
        borderColor: "#0284c7",
        backgroundColor: "rgba(2, 132, 199, 0.08)",
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: "#0284c7"
      }]
    },
    options: {
      ...chartCommonOptions,
      scales: {
        ...chartCommonOptions.scales,
        y: {
          ...chartCommonOptions.scales.y,
          title: { display: true, text: "%", color: "#9ca3af", font: { size: 11 } }
        }
      }
    }
  });
}

/**
 * Updates both charts with timestamp labels and series points.
 */
function updateCharts(labels, temperatures, humidities) {
  if (!tempChart || !humChart) return;

  // Temperature Chart update
  tempChart.data.labels = labels;
  tempChart.data.datasets[0].data = temperatures;
  tempChart.update("none"); // "none" skips jarring full animations on periodic poll

  // Humidity Chart update
  humChart.data.labels = labels;
  humChart.data.datasets[0].data = humidities;
  humChart.update("none");

  els.chartPointsCount.textContent = `Showing last ${temperatures.length} readings`;
}

// ====================================================================
// THINGSPEAK API CLIENT
// ====================================================================

/**
 * Retrieves latest feeds from ThingSpeak Channel Read API.
 */
async function fetchThingSpeakData() {
  const { channelId, readApiKey, resultsCount } = appConfig;

  // Check if channel is unconfigured
  if (!channelId || channelId === "YOUR_CHANNEL_ID") {
    setSystemStatus("offline", "Channel ID Required");
    showNotice(
      "ThingSpeak Channel ID is not configured yet. Click 'Channel Settings' to connect or click 'Preview Demo Data' to test the dashboard.",
      true
    );
    return;
  }

  setSystemStatus("syncing", "Fetching...");

  // Construct ThingSpeak Read API URL
  // Field 1: Temperature, Field 2: Humidity
  let url = `https://api.thingspeak.com/channels/${encodeURIComponent(channelId)}/feeds.json?results=${resultsCount}`;
  if (readApiKey && readApiKey.trim() !== "") {
    url += `&api_key=${encodeURIComponent(readApiKey.trim())}`;
  }

  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Channel #${channelId} not found. Check Channel ID.`);
      } else if (response.status === 400 || response.status === 403) {
        throw new Error("Access denied. If channel is Private, provide your Read API Key.");
      } else {
        throw new Error(`ThingSpeak HTTP Error: ${response.status}`);
      }
    }

    const data = await response.json();
    processFeeds(data);
    setSystemStatus("online", "Connected");
    hideNotice();
    isDemoMode = false;

  } catch (error) {
    console.warn("ThingSpeak Fetch Error:", error);
    setSystemStatus("offline", "Sync Error");
    showNotice(
      `Unable to fetch data from ThingSpeak (${error.message}). Check your Channel ID / API Key, or verify that your Wokwi simulation is actively transmitting.`,
      true
    );
  }
}

/**
 * Parses and maps ThingSpeak feeds into numerical time-series and triggers updates.
 */
function processFeeds(data) {
  if (!data || !data.feeds || data.feeds.length === 0) {
    showNotice("Connected to Channel, but no feed data has been received yet. Start your Wokwi simulation to generate readings.", true);
    return;
  }

  const labels = [];
  const temps = [];
  const hums = [];

  let lastValidTemp = null;
  let lastValidHum = null;
  let lastTimestamp = null;

  data.feeds.forEach(feed => {
    // ThingSpeak: field1 = Temperature, field2 = Humidity
    const tVal = parseFloat(feed.field1);
    const hVal = parseFloat(feed.field2);

    const hasT = !isNaN(tVal);
    const hasH = !isNaN(hVal);

    if (hasT || hasH) {
      const timeLabel = formatShortTime(feed.created_at);
      labels.push(timeLabel);

      if (hasT) {
        temps.push(tVal);
        lastValidTemp = tVal;
      }

      if (hasH) {
        hums.push(hVal);
        lastValidHum = hVal;
      }

      lastTimestamp = feed.created_at;
    }
  });

  if (temps.length === 0 && hums.length === 0) {
    showNotice("Channel feeds contain no valid temperature (Field 1) or humidity (Field 2) numeric values.", true);
    return;
  }

  // 1. Update Sensor Cards and Secondary Statistics
  updateSensorCards(lastValidTemp, lastValidHum, temps, hums, lastTimestamp);

  // 2. Update Charts
  updateCharts(labels, temps, hums);

  // 3. Evaluate Smart AC Controller (if in AUTO mode)
  if (currentMode === "AUTO" && lastValidTemp !== null && lastValidHum !== null) {
    const decision = evaluateSmartAC(lastValidTemp, lastValidHum);
    decision.humidity = lastValidHum;
    renderACDisplay(decision);
  }
}

// ====================================================================
// DEMO / SIMULATION DATA GENERATOR (FOR TESTING WITHOUT LIVE HARDWARE)
// ====================================================================
/**
 * Generates 30 realistic DHT22 readings matching the Raspberry Pi Pico W behavior.
 * Allows instant verification of graphs, cards, and AC control logic.
 */
function loadMockSimulationData() {
  isDemoMode = true;
  setSystemStatus("online", "Demo Mode");
  hideNotice();

  const labels = [];
  const temps = [];
  const hums = [];

  const now = Date.now();
  const intervalMs = 20 * 1000; // 20s interval matching hardware loop
  const totalPoints = 30;

  // Simulate a gradual temperature rise and realistic humidity variance
  let tempBase = 24.2;
  let humBase = 62.0;

  for (let i = totalPoints - 1; i >= 0; i--) {
    const timePoint = new Date(now - i * intervalMs);
    labels.push(timePoint.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

    // Add mild natural fluctuation
    tempBase += (Math.random() - 0.42) * 0.45;
    humBase += (Math.random() - 0.48) * 0.9;

    // Bound values
    tempBase = Math.max(22.0, Math.min(33.5, tempBase));
    humBase = Math.max(40.0, Math.min(78.0, humBase));

    temps.push(parseFloat(tempBase.toFixed(1)));
    hums.push(parseFloat(humBase.toFixed(1)));
  }

  const lastT = temps[temps.length - 1];
  const lastH = hums[hums.length - 1];

  updateSensorCards(lastT, lastH, temps, hums, new Date().toISOString());
  updateCharts(labels, temps, hums);

  if (currentMode === "AUTO") {
    const decision = evaluateSmartAC(lastT, lastH);
    decision.humidity = lastH;
    renderACDisplay(decision);
  }

  showNotice("Displaying simulated DHT22 test data (30 readings, 20s interval). Click 'Channel Settings' to switch to your real ThingSpeak Channel.", false);
}

// ====================================================================
// AUTO / MANUAL MODE HANDLERS
// ====================================================================

function setControlMode(mode) {
  currentMode = mode;

  if (mode === "AUTO") {
    els.modeAutoBtn.classList.add("active");
    els.modeManualBtn.classList.remove("active");
    els.autoModePanel.classList.remove("hidden");
    els.manualModePanel.classList.add("hidden");

    // Re-evaluate current sensor reading
    const curT = parseFloat(els.currentTemp.textContent);
    const curH = parseFloat(els.currentHum.textContent);
    if (!isNaN(curT) && !isNaN(curH)) {
      const decision = evaluateSmartAC(curT, curH);
      decision.humidity = curH;
      renderACDisplay(decision);
    }

  } else {
    els.modeAutoBtn.classList.remove("active");
    els.modeManualBtn.classList.add("active");
    els.autoModePanel.classList.add("hidden");
    els.manualModePanel.classList.remove("hidden");

    // Render manual override state
    applyManualSettings();
  }
}

function applyManualSettings() {
  const manualDecision = {
    acStatus: manualAC.power,
    mode: manualAC.mode,
    targetTemperature: manualAC.targetTemperature,
    coolingLevel: manualAC.power === "OFF" ? "OFF" : manualAC.coolingLevel,
    reason: `Manual operator override active. Settings enforced by user (Target: ${manualAC.targetTemperature}°C, Level: ${manualAC.coolingLevel}).`,
    isHighHumidity: false,
    activeRuleId: ""
  };

  renderACDisplay(manualDecision);
}

// ====================================================================
// REFRESH & COUNTDOWN TIMERS
// ====================================================================

function startRefreshTimer() {
  if (countdownTimerId) clearInterval(countdownTimerId);

  refreshCountdown = appConfig.refreshIntervalSec;
  updateTimerDisplay();

  countdownTimerId = setInterval(() => {
    refreshCountdown--;
    updateTimerDisplay();

    if (refreshCountdown <= 0) {
      refreshCountdown = appConfig.refreshIntervalSec;
      if (isDemoMode) {
        loadMockSimulationData();
      } else {
        fetchThingSpeakData();
      }
    }
  }, 1000);
}

function updateTimerDisplay() {
  els.timerCountdown.textContent = `${refreshCountdown}s`;
}

function setSystemStatus(type, label) {
  els.statusDot.className = `status-dot status-${type}`;
  els.statusText.textContent = label;
}

function showNotice(msg, isWarning = false) {
  els.noticeBanner.classList.remove("hidden");
  els.noticeMessage.textContent = msg;
  if (isWarning) {
    els.noticeBanner.style.background = "#fffbeb";
    els.noticeBanner.style.color = "#92400e";
    els.noticeBanner.style.borderColor = "#fde68a";
  } else {
    els.noticeBanner.style.background = "#eff6ff";
    els.noticeBanner.style.color = "#1e40af";
    els.noticeBanner.style.borderColor = "#bfdbfe";
  }
}

function hideNotice() {
  els.noticeBanner.classList.add("hidden");
}

// ====================================================================
// HELPER UTILITIES & LOCAL CONFIG
// ====================================================================

function formatShortTime(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch (e) {
    return "";
  }
}

function formatDateTime(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch (e) {
    return new Date().toLocaleTimeString();
  }
}

function loadSavedConfig() {
  try {
    const saved = localStorage.getItem("iot_climate_config");
    if (saved) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn("LocalStorage access failed, using default config.");
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfigToStorage(config) {
  try {
    localStorage.setItem("iot_climate_config", JSON.stringify(config));
  } catch (e) {
    console.warn("Could not save config to localStorage.");
  }
}

// ====================================================================
// EVENT LISTENERS & INITIALIZATION
// ====================================================================

function setupEventListeners() {
  // Manual refresh button
  els.refreshBtn.addEventListener("click", () => {
    refreshCountdown = appConfig.refreshIntervalSec;
    updateTimerDisplay();
    if (isDemoMode) {
      loadMockSimulationData();
    } else {
      fetchThingSpeakData();
    }
  });

  // Mode Switcher (AUTO vs MANUAL)
  els.modeAutoBtn.addEventListener("click", () => setControlMode("AUTO"));
  els.modeManualBtn.addEventListener("click", () => setControlMode("MANUAL"));

  // Manual Power Buttons
  els.manualPowerOnBtn.addEventListener("click", () => {
    manualAC.power = "ON";
    els.manualPowerStateText.textContent = "ON";
    els.manualPowerOnBtn.className = "btn btn-xs btn-primary";
    els.manualPowerOffBtn.className = "btn btn-xs btn-outline";
    applyManualSettings();
  });

  els.manualPowerOffBtn.addEventListener("click", () => {
    manualAC.power = "OFF";
    els.manualPowerStateText.textContent = "OFF";
    els.manualPowerOffBtn.className = "btn btn-xs btn-primary";
    els.manualPowerOnBtn.className = "btn btn-xs btn-outline";
    applyManualSettings();
  });

  // Manual Temperature Setpoint Slider
  els.manualTempSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    manualAC.targetTemperature = val;
    els.manualTempSliderVal.innerHTML = `${val}&deg;C`;
    applyManualSettings();
  });

  // Manual Cooling Level Buttons
  document.querySelectorAll(".level-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".level-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const lvl = btn.getAttribute("data-level");
      manualAC.coolingLevel = lvl;
      els.manualLevelText.textContent = lvl;
      applyManualSettings();
    });
  });

  // Manual Operating Mode Buttons
  document.querySelectorAll(".opmode-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".opmode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      manualAC.mode = btn.getAttribute("data-mode");
      applyManualSettings();
    });
  });

  // Modal Dialog Open/Close
  const openConfig = () => {
    els.cfgChannelId.value = appConfig.channelId === "YOUR_CHANNEL_ID" ? "" : appConfig.channelId;
    els.cfgApiKey.value = appConfig.readApiKey || "";
    els.cfgResults.value = appConfig.resultsCount || 30;
    els.cfgInterval.value = appConfig.refreshIntervalSec || 20;
    els.configModal.classList.remove("hidden");
  };

  const closeConfig = () => {
    els.configModal.classList.add("hidden");
  };

  els.openConfigBtn.addEventListener("click", openConfig);
  els.quickConfigureBtn.addEventListener("click", openConfig);
  els.closeConfigBtn.addEventListener("click", closeConfig);

  // Save Config Button
  els.saveConfigBtn.addEventListener("click", () => {
    const channelId = els.cfgChannelId.value.trim();
    const readApiKey = els.cfgApiKey.value.trim();
    const resultsCount = parseInt(els.cfgResults.value, 10) || 30;
    const refreshIntervalSec = parseInt(els.cfgInterval.value, 10) || 20;

    if (!channelId) {
      alert("Please provide a valid ThingSpeak Channel ID.");
      return;
    }

    appConfig = {
      channelId,
      readApiKey,
      resultsCount,
      refreshIntervalSec
    };

    saveConfigToStorage(appConfig);
    closeConfig();

    isDemoMode = false;
    startRefreshTimer();
    fetchThingSpeakData();
  });

  // Demo Data Buttons
  const triggerDemo = () => {
    closeConfig();
    loadMockSimulationData();
  };
  els.useDemoDataBtn.addEventListener("click", triggerDemo);
  els.quickDemoBtn.addEventListener("click", triggerDemo);
}

// ====================================================================
// INITIALIZATION ENTRY POINT
// ====================================================================
window.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize interactive charts
  initCharts();

  // 2. Attach UI event handlers
  setupEventListeners();

  // 3. Start refresh cycle
  startRefreshTimer();

  // 4. Initial fetch or prompt
  if (appConfig.channelId && appConfig.channelId !== "YOUR_CHANNEL_ID") {
    fetchThingSpeakData();
  } else {
    // Show polite notice and prompt for channel ID or demo
    setSystemStatus("offline", "Unconfigured");
    showNotice(
      "Welcome! Please enter your ThingSpeak Channel ID (in script.js or via 'Channel Settings') to fetch live sensor data.",
      true
    );
  }
});
