// =============================
// Constants
// =============================

const APP_PROFILES = {
  VEHICLE: "VEHICLE",
  MOBILE: "MOBILE",
};

const OPERATING_MODES = {
  PARKED: "PARKED",
  WALKING: "WALKING",
  DRIVING: "DRIVING",
};

const MAP_ZOOM_MODES = {
  AUTO: "AUTO",
  MANUAL: "MANUAL",
};

const DEFAULT_LATITUDE = 30.3027;
const DEFAULT_LONGITUDE = -93.1907;
const DEFAULT_MAP_ZOOM = 9;
const PARKED_MAP_ZOOM = 17;
const WALKING_MAP_ZOOM = 18;

const HEADING_SAMPLE_WINDOW_MS = 5000;
const MIN_HEADING_SPEED_MPH = 3;

const WALKING_SPEED_MPH = 1;
const FOLLOW_SPEED_MPH = 10;

const MOVEMENT_VECTOR_WINDOW_MS = 60 * 1000;
const MOVEMENT_VECTOR_MIN_DURATION_MS = 3 * 1000;
const MOVEMENT_VECTOR_MIN_DISTANCE_FEET = 12;

const SPEED_AVERAGE_DURATION_MS = 30 * 1000;
const PARKED_DELAY_MS = 60 * 1000;
const WALKING_PARKED_DELAY_MS = 10 * 1000;

const MAP_LOOK_AHEAD_RATIO = 0.22;

const RADAR_OPACITY = 0.6;
const RADAR_FRAME_DELAY = 1000;
const RADAR_END_PAUSE = 4000;

const RADAR_NOW_PAUSE = 2000;
const RADAR_FORECAST_END_PAUSE = 3000;

const RADAR_FRESH_AGE_MS = 8 * 60 * 1000;
const RADAR_AGING_AGE_MS = 15 * 60 * 1000;
const RADAR_STALE_AGE_MS = 25 * 60 * 1000;

const RADAR_STATUS_UPDATE_INTERVAL_MS = 30 * 1000;

const RADAR_FADE_DURATION = 850;
const RADAR_LAYER_CLEANUP_DELAY = RADAR_FADE_DURATION + 100;
const MIN_MAP_ZOOM = 5;
const MIN_ANIMATED_RADAR_ZOOM = 8;
const RADAR_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const RADAR_PLAYBACK_MODES = {
  PAST: "PAST",
  FORECAST: "FORECAST",
  COMBINED: "COMBINED",
};
const HRRR_METADATA_URL =
  "https://mesonet.agron.iastate.edu/data/gis/images/4326/hrrr/refd_1080.json";

const HRRR_FORECAST_STEP_MINUTES = 15;

const HRRR_FORECAST_MAX_MINUTES = 6 * 60;

/* =========================================
   AIR TRAFFIC
========================================= */

const AIRCRAFT_RADIUS_MILES = 50;

const AIRCRAFT_REFRESH_INTERVAL_MS = 10 * 1000;

let aircraftTrackingStarted = false;

const AIRCRAFT_MOTION_INTERVAL_MS = 1000;

const AIRCRAFT_MAX_EXTRAPOLATION_SECONDS = 90;

const AIRCRAFT_POSITION_CORRECTION_MS = 5 * 1000;

const AIRCRAFT_LOCATE_INSPECTION_MS = 5 * 1000;

const SENTINEL_RADIUS_MILES = 250;
/*
 * Broad first-pass geographic candidates.
 *
 * These are not treated as being within
 * Sentinel range automatically. They only
 * qualify for detailed geometry processing.
 */
const SENTINEL_CANDIDATE_AREAS = new Set(["LA", "TX", "MS", "AR"]);
/*
 * Sentinel first uses SENTINEL_RADIUS_MILES as
 * the absolute collection and safety boundary.
 *
 * These directional limits will later refine
 * which alerts are operationally relevant
 * based on vehicle heading.
 */
const SENTINEL_DIRECTIONAL_LIMITS_MILES = {
  ahead: 250,
  left: 100,
  right: 100,
  behind: 50,
};
const SENTINEL_DIRECTIONAL_OVERRIDE_PRIORITIES = new Set(["critical", "high"]);
const SENTINEL_ALERT_INSPECTION_MS = 5000;

const DEFAULT_SYSTEM_ACCENT = "#4fd5ff";
const ALERT_FLASH_DURATION = 3000;

const SENTINEL_RELEVANCE_WEIGHTS = {
  basePriority: {
    critical: 1000,
    high: 700,
    medium: 400,
    low: 100,
  },

  severity: {
    extreme: 220,
    severe: 150,
    moderate: 75,
    minor: 25,
    unknown: 0,
  },

  urgency: {
    immediate: 180,
    expected: 90,
    future: 30,
    past: -100,
    unknown: 0,
  },

  certainty: {
    observed: 120,
    likely: 75,
    possible: 25,
    unlikely: -40,
    unknown: 0,
  },

  currentLocation: 300,
  aheadOfTravel: 140,
  nearRoute: 80,
  behindTravel: -40,

  expiringSoon: 60,
  longDuration: 15,
};

// =============================
// Global Variables
// =============================

let appProfile = APP_PROFILES.VEHICLE;
let operatingMode = OPERATING_MODES.PARKED;
let drivingStopStartTime = null;
let walkingStopStartTime = null;

let currentLatitude = null;
let currentLongitude = null;
let currentHeading = null;
let currentSpeedMph = 0;
let currentGpsSpeedAvailable = false;

let movementPositionSamples = [];
let movementVectorDetected = false;
let movementVectorSpeedMph = 0;
let movementVectorBearing = null;
let movementVectorDistanceFeet = 0;

let mapZoomMode = MAP_ZOOM_MODES.AUTO;
let manualMapZoom = null;
let mapZoomInspectionActive = false;
let mapAutoZoomUpdateActive = false;

let drivingModeActive = false;
let notificationSystemInitialized = false;
let initializedAlertSources = new Set();

let radarMap;
let radarLayerGroup;
let locationMarker;
let accuracyCircle;
let weatherRadar;
let previousWeatherRadar;
let lightningLayer;
let aircraftLayer;
const aircraftMarkers = new Map();
let aircraftMotionTimer = null;
let aircraftReturnTimer = null;
let warningsLayer;
let layerControl;
let observedRadarFrames = [];
let forecastRadarFrames = [];

let radarFrames = [];

let radarPlaybackMode = RADAR_PLAYBACK_MODES.COMBINED;

let currentRadarFrame = 0;
let radarAnimationTimer = null;
let radarIsPlaying = true;
let lastRadarDataTimestamp = null;
let lastRadarRefreshTime = null;
let radarRefreshInProgress = false;
let radarStatusTimer = null;
let systemAccentFlashTimer = null;
let radarPausedForZoom = false;
let radarWasPlayingBeforeZoomPause = false;
let radarMetadataRefreshTimer = null;
let radarMetadataRefreshInProgress = false;

let warningsRefreshTimer;
let initialWarningsLoaded = false;
let sentinelReturnTimer = null;

const nwsZoneGeometryCache = new Map();
const nwsZoneRequestCache = new Map();

let tempestSocket;
let tempestReconnectTimer;

/// =============================
// Operating Mode Manager
// =============================

function getMovementEvidence() {
  const latestVectorSample =
    movementPositionSamples.length > 0
      ? movementPositionSamples[movementPositionSamples.length - 1]
      : null;

  const vectorIsFresh =
    latestVectorSample !== null &&
    Date.now() - latestVectorSample.timestamp <= MOVEMENT_VECTOR_WINDOW_MS;

  const vectorSpeedMph =
    movementVectorDetected && vectorIsFresh ? movementVectorSpeedMph : 0;

  const effectiveSpeedMph = currentGpsSpeedAvailable
    ? Math.max(currentSpeedMph, vectorSpeedMph)
    : vectorSpeedMph;

  return {
    gpsSpeedAvailable: currentGpsSpeedAvailable,
    gpsSpeedMph: currentSpeedMph,
    vectorDetected: movementVectorDetected && vectorIsFresh,
    vectorSpeedMph,
    effectiveSpeedMph,
  };
}

function determineOperatingMode() {
  const movementEvidence = getMovementEvidence();
  const effectiveSpeedMph = movementEvidence.effectiveSpeedMph;

  if (effectiveSpeedMph >= FOLLOW_SPEED_MPH) {
    drivingStopStartTime = null;
    walkingStopStartTime = null;

    return OPERATING_MODES.DRIVING;
  }

  if (effectiveSpeedMph >= WALKING_SPEED_MPH) {
    drivingStopStartTime = null;
    walkingStopStartTime = null;

    return OPERATING_MODES.WALKING;
  }

  if (operatingMode === OPERATING_MODES.DRIVING) {
    walkingStopStartTime = null;

    if (drivingStopStartTime === null) {
      drivingStopStartTime = Date.now();

      diagnosticLog("Operating Mode", {
        event: "Driving stop timer started",
        effectiveSpeedMph,
        movementEvidence,
      });
    }

    const stoppedDuration = Date.now() - drivingStopStartTime;

    if (stoppedDuration < PARKED_DELAY_MS) {
      return OPERATING_MODES.DRIVING;
    }

    drivingStopStartTime = null;

    return OPERATING_MODES.PARKED;
  }

  if (operatingMode === OPERATING_MODES.WALKING) {
    drivingStopStartTime = null;

    if (walkingStopStartTime === null) {
      walkingStopStartTime = Date.now();

      diagnosticLog("Operating Mode", {
        event: "Walking stop timer started",
        effectiveSpeedMph,
        movementEvidence,
      });
    }

    const stoppedDuration = Date.now() - walkingStopStartTime;

    if (stoppedDuration < WALKING_PARKED_DELAY_MS) {
      return OPERATING_MODES.WALKING;
    }

    walkingStopStartTime = null;

    return OPERATING_MODES.PARKED;
  }

  drivingStopStartTime = null;
  walkingStopStartTime = null;

  return OPERATING_MODES.PARKED;
}

function updateOperatingMode() {
  const previousOperatingMode = operatingMode;

  const newOperatingMode = determineOperatingMode();

  if (newOperatingMode === operatingMode) {
    return;
  }

  operatingMode = newOperatingMode;

  navigationIntelligenceManager.mode = operatingMode;

  console.log(
    "Operating mode changed:",
    previousOperatingMode,
    "->",
    operatingMode,
  );

  diagnosticLog("Operating Mode", {
    event: "Operating mode changed",
    previousMode: previousOperatingMode,
    newMode: operatingMode,
    currentSpeedMph,
    averageSpeedMph: navigationIntelligenceManager.averageSpeedMph,
  });

  updateMovementIcon();

  radarControlsVisibilityManager.setOperatingMode(operatingMode);

  if (operatingMode === OPERATING_MODES.PARKED) {
    applyParkedMapState();
  } else {
    updateNavigationDisplay();
  }

  updateSystemStatus();
}

// =============================
// Context Manager
// =============================

const contextManager = {
  messages: [],

  setStatus(status) {
    this.messages = this.messages.filter(
      (message) => message.source !== status.source,
    );

    this.messages.push(status);

    this.render();
  },

  clearStatus(source) {
    this.messages = this.messages.filter(
      (message) => message.source !== source,
    );

    this.render();
  },

  render() {
    const contextBar = document.getElementById("context-bar");

    if (!contextBar) {
      return;
    }

    if (this.messages.length === 0) {
      contextBar.innerHTML = "⏳ Initializing Systems...";

      contextBar.className = "";

      return;
    }

    const priorityOrder = {
      critical: 5,
      high: 4,
      medium: 3,
      normal: 2,
      low: 1,
    };

    const highestPriority = [...this.messages].sort((messageA, messageB) => {
      const priorityA = priorityOrder[messageA.priority] || 0;

      const priorityB = priorityOrder[messageB.priority] || 0;

      return priorityB - priorityA;
    })[0];

    contextBar.innerHTML = `
            <div class="context-title">
                ${highestPriority.icon}
                ${highestPriority.title}
            </div>

            <div class="context-detail">
                ${highestPriority.detail}
            </div>
        `;

    contextBar.className = "";

    contextBar.classList.add(`context-${highestPriority.priority}`);
  },
};

// =============================
// Utility Functions
// =============================

function calculateDistanceMiles(latitude1, longitude1, latitude2, longitude2) {
  const earthRadiusMiles = 3958.8;

  const latitudeDifference = degreesToRadians(latitude2 - latitude1);

  const longitudeDifference = degreesToRadians(longitude2 - longitude1);

  const startLatitude = degreesToRadians(latitude1);

  const endLatitude = degreesToRadians(latitude2);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMiles * c;
}

function calculateBearing(latitude1, longitude1, latitude2, longitude2) {
  const startLatitude = degreesToRadians(latitude1);

  const endLatitude = degreesToRadians(latitude2);

  const longitudeDifference = degreesToRadians(longitude2 - longitude1);

  const y = Math.sin(longitudeDifference) * Math.cos(endLatitude);

  const x =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) *
      Math.cos(endLatitude) *
      Math.cos(longitudeDifference);

  const bearing = Math.atan2(y, x) * (180 / Math.PI);

  return (bearing + 360) % 360;
}

function updateMovementVector(
  latitude,
  longitude,
  accuracyMeters,
  timestamp = Date.now(),
) {
  const accuracyFeet = Number.isFinite(accuracyMeters)
    ? accuracyMeters * 3.28084
    : null;

  movementPositionSamples.push({
    latitude,
    longitude,
    accuracyFeet,
    timestamp,
  });

  movementPositionSamples = movementPositionSamples.filter((sample) => {
    return timestamp - sample.timestamp <= MOVEMENT_VECTOR_WINDOW_MS;
  });

  if (movementPositionSamples.length < 2) {
    movementVectorDetected = false;
    movementVectorSpeedMph = 0;
    movementVectorBearing = null;
    movementVectorDistanceFeet = 0;
    return;
  }

  const firstSample = movementPositionSamples[0];
  const lastSample =
    movementPositionSamples[movementPositionSamples.length - 1];

  const elapsedMilliseconds = lastSample.timestamp - firstSample.timestamp;

  if (elapsedMilliseconds < MOVEMENT_VECTOR_MIN_DURATION_MS) {
    movementVectorDetected = false;
    movementVectorSpeedMph = 0;
    movementVectorBearing = null;
    movementVectorDistanceFeet = 0;
    return;
  }

  const elapsedHours = elapsedMilliseconds / (60 * 60 * 1000);

  const netDistanceMiles = calculateDistanceMiles(
    firstSample.latitude,
    firstSample.longitude,
    lastSample.latitude,
    lastSample.longitude,
  );

  movementVectorDistanceFeet = netDistanceMiles * 5280;

  let pathDistanceMiles = 0;

  for (let index = 1; index < movementPositionSamples.length; index += 1) {
    const previousSample = movementPositionSamples[index - 1];
    const currentSample = movementPositionSamples[index];

    pathDistanceMiles += calculateDistanceMiles(
      previousSample.latitude,
      previousSample.longitude,
      currentSample.latitude,
      currentSample.longitude,
    );
  }

  const directionalConsistency =
    pathDistanceMiles > 0 ? netDistanceMiles / pathDistanceMiles : 0;

  const accuracyGuardFeet = Math.max(
    MOVEMENT_VECTOR_MIN_DISTANCE_FEET,
    (firstSample.accuracyFeet ?? 0) * 0.75,
    (lastSample.accuracyFeet ?? 0) * 0.75,
  );

  movementVectorSpeedMph = netDistanceMiles / elapsedHours;

  movementVectorDetected =
    movementVectorDistanceFeet >= accuracyGuardFeet &&
    directionalConsistency >= 0.65;

  movementVectorBearing = movementVectorDetected
    ? calculateBearing(
        firstSample.latitude,
        firstSample.longitude,
        lastSample.latitude,
        lastSample.longitude,
      )
    : null;

  console.log("[Movement Vector]", {
    detected: movementVectorDetected,
    distanceFeet: Number(movementVectorDistanceFeet.toFixed(1)),
    derivedSpeedMph: Number(movementVectorSpeedMph.toFixed(1)),
    bearing:
      movementVectorBearing === null ? null : Math.round(movementVectorBearing),
    consistency: Number(directionalConsistency.toFixed(2)),
    accuracyGuardFeet: Number(accuracyGuardFeet.toFixed(1)),
    sampleCount: movementPositionSamples.length,
  });
}

function calculateRelativeAngle(vehicleHeading, targetBearing) {
  return ((targetBearing - vehicleHeading + 540) % 360) - 180;
}

function classifyRelativeDirection(vehicleHeading, targetBearing) {
  if (vehicleHeading === null) {
    return "Direction Unknown";
  }

  const relativeAngle = calculateRelativeAngle(vehicleHeading, targetBearing);

  if (relativeAngle >= -45 && relativeAngle <= 45) {
    return "Ahead";
  }

  if (relativeAngle > 45 && relativeAngle < 135) {
    return "Right";
  }

  if (relativeAngle < -45 && relativeAngle > -135) {
    return "Left";
  }

  return "Behind";
}

function bearingToCompass(bearing) {
  const compassDirections = [
    "North",
    "NNE",
    "NE",
    "ENE",
    "East",
    "ESE",
    "SE",
    "SSE",
    "South",
    "SSW",
    "SW",
    "WSW",
    "West",
    "WNW",
    "NW",
    "NNW",
  ];

  const index = Math.round(bearing / 22.5) % 16;

  return compassDirections[index];
}

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function getDrivingZoom(speedMph) {
  if (speedMph < 15) {
    return 17;
  }

  if (speedMph < 30) {
    return 16;
  }

  if (speedMph < 50) {
    return 15;
  }

  if (speedMph < 70) {
    return 14;
  }

  return 13;
}

function convertHeadingToMapBearing(heading) {
  if (heading === null) {
    return 0;
  }

  return ((heading % 360) + 360) % 360;
}

function formatRadarAge(ageMs) {
  if (ageMs === null || !Number.isFinite(ageMs) || ageMs < 0) {
    return "Unknown";
  }

  const totalSeconds = Math.floor(ageMs / 1000);

  if (totalSeconds < 60) {
    return "Less than 1 min ago";
  }

  const totalMinutes = Math.floor(totalSeconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} min ago`;
  }

  const totalHours = Math.floor(totalMinutes / 60);

  const remainingMinutes = totalMinutes % 60;

  if (remainingMinutes === 0) {
    return `${totalHours} hr ago`;
  }

  return `${totalHours} hr ` + `${remainingMinutes} min ago`;
}

function formatRadarCheckAge(ageMs) {
  if (ageMs === null || !Number.isFinite(ageMs) || ageMs < 0) {
    return "not yet checked";
  }

  const totalSeconds = Math.floor(ageMs / 1000);

  if (totalSeconds < 5) {
    return "just now";
  }

  if (totalSeconds < 60) {
    return `${totalSeconds} sec ago`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);

  if (totalMinutes === 1) {
    return "1 min ago";
  }

  return `${totalMinutes} min ago`;
}

function updateRadarFreshnessDisplay() {
  const radarFreshnessElement = document.getElementById("radar-freshness");

  if (!radarFreshnessElement) {
    return;
  }

  radarFreshnessElement.classList.remove(
    "radar-fresh",
    "radar-aging",
    "radar-stale",
    "radar-unavailable",
    "radar-refreshing",
  );

  if (radarRefreshInProgress) {
    radarFreshnessElement.innerHTML = `
                <span class="radar-freshness-primary">
                    Synchronizing radar...
                </span>
                <span class="radar-freshness-secondary">
                    Checking for new imagery
                </span>
            `;

    radarFreshnessElement.classList.add("radar-refreshing");

    return;
  }

  const checkAgeMs =
    lastRadarRefreshTime === null ? null : Date.now() - lastRadarRefreshTime;

  const formattedCheckAge = formatRadarCheckAge(checkAgeMs);

  if (lastRadarDataTimestamp === null) {
    radarFreshnessElement.innerHTML = `
                <span class="radar-freshness-primary">
                    Radar data unavailable
                </span>
                <span class="radar-freshness-secondary">
                    Last checked ${formattedCheckAge}
                </span>
            `;

    radarFreshnessElement.classList.add("radar-unavailable");

    return;
  }

  const radarAgeMs = Date.now() - lastRadarDataTimestamp;

  const formattedRadarAge = formatRadarAge(radarAgeMs);

  let primaryText = `Radar updated ${formattedRadarAge}`;

  let statusClass = "radar-fresh";

  if (radarAgeMs >= RADAR_STALE_AGE_MS) {
    primaryText = `Radar unavailable — ${formattedRadarAge}`;

    statusClass = "radar-unavailable";
  } else if (radarAgeMs >= RADAR_AGING_AGE_MS) {
    primaryText = `Radar stale — ${formattedRadarAge}`;

    statusClass = "radar-stale";
  } else if (radarAgeMs >= RADAR_FRESH_AGE_MS) {
    primaryText = `Radar aging — ${formattedRadarAge}`;

    statusClass = "radar-aging";
  }

  radarFreshnessElement.innerHTML = `
            <span class="radar-freshness-primary">
                ${primaryText}
            </span>
            <span class="radar-freshness-secondary">
                Last checked ${formattedCheckAge}
            </span>
        `;

  radarFreshnessElement.classList.add(statusClass);
}

function startRadarFreshnessMonitor() {
  if (radarStatusTimer !== null) {
    clearInterval(radarStatusTimer);
  }

  updateRadarFreshnessDisplay();

  radarStatusTimer = setInterval(
    updateRadarFreshnessDisplay,
    RADAR_STATUS_UPDATE_INTERVAL_MS,
  );
}

// =============================
// Navigation Intelligence Manager
// =============================

const navigationIntelligenceManager = {
  mode: "UNKNOWN",
  averageSpeedMph: 0,
  targetZoom: DEFAULT_MAP_ZOOM,
  speedSamples: [],
  sampleWindowMs: SPEED_AVERAGE_DURATION_MS,
  headingSamples: [],
  headingSampleWindowMs: HEADING_SAMPLE_WINDOW_MS,
  smoothedHeading: null,

  update(speedMph) {
    if (speedMph == null) {
      return;
    }

    const now = Date.now();

    this.speedSamples.push({
      speed: speedMph,
      timestamp: now,
    });

    this.speedSamples = this.speedSamples.filter((sample) => {
      return now - sample.timestamp <= this.sampleWindowMs;
    });

    const totalSpeed = this.speedSamples.reduce((sum, sample) => {
      return sum + sample.speed;
    }, 0);

    this.averageSpeedMph =
      this.speedSamples.length > 0
        ? totalSpeed / this.speedSamples.length
        : speedMph;

    this.targetZoom = getDrivingZoom(this.averageSpeedMph);

    this.mode = operatingMode;

    console.log("[Navigation]", {
      currentSpeedMph: Number(speedMph.toFixed(1)),

      averageSpeedMph: Number(this.averageSpeedMph.toFixed(1)),

      targetZoom: this.targetZoom,

      sampleCount: this.speedSamples.length,

      mode: this.mode,
    });
  },

  updateHeading(rawHeading, speedMph) {
    if (rawHeading == null || speedMph < MIN_HEADING_SPEED_MPH) {
      return this.smoothedHeading;
    }

    const now = Date.now();

    this.headingSamples.push({
      heading: rawHeading,
      timestamp: now,
    });

    this.headingSamples = this.headingSamples.filter((sample) => {
      return now - sample.timestamp <= this.headingSampleWindowMs;
    });

    let sineTotal = 0;
    let cosineTotal = 0;

    this.headingSamples.forEach((sample) => {
      const radians = (sample.heading * Math.PI) / 180;

      sineTotal += Math.sin(radians);
      cosineTotal += Math.cos(radians);
    });

    const averageRadians = Math.atan2(
      sineTotal / this.headingSamples.length,
      cosineTotal / this.headingSamples.length,
    );

    let averageDegrees = (averageRadians * 180) / Math.PI;

    if (averageDegrees < 0) {
      averageDegrees += 360;
    }

    this.smoothedHeading = averageDegrees;

    return this.smoothedHeading;
  },
};

// =============================
// Radar Controls Visibility Manager
// =============================

const radarControlsVisibilityManager = {
  hideDelayMs: 4000,
  hideTimer: null,
  isDriving: false,
  isExpanded: false,

  getControls() {
    return document.getElementById("map-controls");
  },

  getToggleButton() {
    return document.getElementById("toggle-radar-controls");
  },

  isFullscreen() {
    const mapPanel = document.getElementById("map-panel");

    return mapPanel?.classList.contains("fullscreen-map") === true;
  },

  clearHideTimer() {
    if (this.hideTimer === null) {
      return;
    }

    clearTimeout(this.hideTimer);

    this.hideTimer = null;
  },

  updateDisplay() {
    const radarControls = this.getControls();

    const toggleButton = this.getToggleButton();

    if (!radarControls || !toggleButton) {
      return;
    }

    const shouldShow = this.isExpanded;

    radarControls.classList.toggle("radar-controls-collapsed", !shouldShow);

    toggleButton.setAttribute("aria-expanded", String(shouldShow));

    toggleButton.title = shouldShow
      ? "Hide radar controls"
      : "Show radar controls";

    toggleButton.setAttribute(
      "aria-label",
      shouldShow ? "Hide radar controls" : "Show radar controls",
    );
  },

  expand() {
    this.isExpanded = true;

    this.clearHideTimer();
    this.updateDisplay();
  },

  collapse() {
    if (this.isFullscreen()) {
      this.isExpanded = true;
    } else {
      this.isExpanded = false;
    }

    this.clearHideTimer();
    this.updateDisplay();
  },

  toggle() {
    if (this.isFullscreen()) {
      const mapControls = this.getControls();

      mapControls?.classList.add("map-controls-hidden");

      return;
    }

    this.isExpanded = !this.isExpanded;

    this.updateDisplay();

    if (this.isDriving && this.isExpanded) {
      this.scheduleHide();
    } else {
      this.clearHideTimer();
    }
  },

  scheduleHide() {
    this.clearHideTimer();

    if (!this.isDriving || !this.isExpanded || this.isFullscreen()) {
      return;
    }

    this.hideTimer = setTimeout(() => {
      this.collapse();
    }, this.hideDelayMs);
  },

  setOperatingMode(mode) {
    this.isDriving = mode === OPERATING_MODES.DRIVING;

    if (this.isFullscreen()) {
      this.isExpanded = true;
    } else {
      this.isExpanded = false;
    }

    this.updateDisplay();
  },

  handleInteraction() {
    if (!this.isDriving || !this.isExpanded) {
      return;
    }

    this.scheduleHide();
  },

  handleFullscreenChange() {
    if (this.isFullscreen()) {
      this.isExpanded = true;
      this.clearHideTimer();
    } else {
      this.isExpanded = false;
    }

    this.updateDisplay();
  },
};

// =============================
// Map Marker Icons
// =============================

const stationaryLocationIcon = L.divIcon({
  className: "overwatch-location-icon",
  html: `<div class="stationary-marker"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const vehicleLocationIcon = L.divIcon({
  className: "overwatch-vehicle-icon",
  html: `<div class="vehicle-marker">▲</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const walkingLocationIcon = L.divIcon({
  className: "overwatch-walking-icon",
  html: `<div class="walking-marker">🚶🏻‍♂️</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// =============================
// Aircraft Tracker
// =============================

function initializeAircraftLayer() {
  console.log("Initializing aircraft layer...");

  aircraftLayer = L.layerGroup().addTo(radarMap);

  layerControl.addOverlay(aircraftLayer, "✈️ Aircraft");

  startAircraftMotionManager();

  console.log("Aircraft layer ready.");
}

function focusAircraftOnMap(icao24) {
  const aircraft = aircraftMarkers.get(icao24);

  if (!aircraft || !radarMap) {
    console.warn(`[Aircraft] Unable to locate ${icao24}`);

    return;
  }

  if (aircraftReturnTimer) {
    clearTimeout(aircraftReturnTimer);

    aircraftReturnTimer = null;
  }

  if (aircraftLayer && !radarMap.hasLayer(aircraftLayer)) {
    aircraftLayer.addTo(radarMap);
  }

  let accuracyCircleWasVisible = false;

  if (accuracyCircle && radarMap.hasLayer(accuracyCircle)) {
    accuracyCircleWasVisible = true;

    radarMap.removeLayer(accuracyCircle);
  }

  mapZoomInspectionActive = true;

  const mapPanelElement = document.getElementById("map-panel");

  const isFullscreen =
    mapPanelElement?.classList.contains("fullscreen-map") === true;

  if (mapPanelElement && !isFullscreen) {
    mapPanelElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }

  const aircraftPosition = aircraft.marker.getLatLng();

  const inspectionZoom = Math.min(radarMap.getZoom(), 11);

  radarMap.flyTo(aircraftPosition, inspectionZoom, {
    animate: true,
    duration: 1.1,
  });

  aircraftReturnTimer = setTimeout(() => {
    aircraftReturnTimer = null;

    if (currentLatitude === null || currentLongitude === null) {
      mapZoomInspectionActive = false;
      return;
    }

    const returnZoom =
      operatingMode === OPERATING_MODES.DRIVING
        ? mapZoomMode === MAP_ZOOM_MODES.MANUAL && manualMapZoom !== null
          ? manualMapZoom
          : navigationIntelligenceManager.targetZoom
        : PARKED_MAP_ZOOM;

    radarMap.closePopup();

    radarMap.flyTo([currentLatitude, currentLongitude], returnZoom, {
      animate: true,
      duration: 1.1,
    });

    setTimeout(() => {
      if (operatingMode === OPERATING_MODES.DRIVING) {
        updateNavigationDisplay();
      } else {
        applyParkedMapState();
      }
      if (accuracyCircleWasVisible && accuracyCircle) {
        if (!radarMap.hasLayer(accuracyCircle)) {
          accuracyCircle.addTo(radarMap);
        }

        accuracyCircle.setLatLng([currentLatitude, currentLongitude]);

        accuracyCircle.bringToFront();
      }

      mapZoomInspectionActive = false;
    }, 1150);
  }, 1100 + AIRCRAFT_LOCATE_INSPECTION_MS);
}

async function fetchNearbyAircraft() {
  if (
    typeof currentLatitude !== "number" ||
    typeof currentLongitude !== "number"
  ) {
    console.log("[Aircraft] Waiting for GPS position...");

    return;
  }

  const url =
    `https://reached-specifically-albums-receptor.trycloudflare.com/aircraft` +
    `?lat=${currentLatitude}` +
    `&lon=${currentLongitude}` +
    `&radiusMiles=${AIRCRAFT_RADIUS_MILES}`;

  console.log("[Aircraft] Requesting nearby aircraft:", {
    latitude: currentLatitude,
    longitude: currentLongitude,
    radiusMiles: AIRCRAFT_RADIUS_MILES,
  });

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    const aircraft = Array.isArray(data.aircraft) ? data.aircraft : [];

    console.log(`[Aircraft] ${aircraft.length} aircraft found`);

    console.table(
      aircraft.map((plane) => ({
        callsign: plane.callsign || "UNKNOWN",

        icao24: plane.icao24 || "UNKNOWN",

        altitude: plane.altitudeFeet ?? "UNKNOWN",

        speed: plane.speedKnots ?? "UNKNOWN",

        heading: plane.trackDegrees ?? "UNKNOWN",

        latitude: plane.latitude ?? "UNKNOWN",

        longitude: plane.longitude ?? "UNKNOWN",

        distanceMiles: plane.distanceMiles ?? "UNKNOWN",

        verticalRate: plane.verticalRateFeetPerMinute ?? "UNKNOWN",

        squawk: plane.squawk ?? "UNKNOWN",
      })),
    );

    displayAircraft(aircraft);

    return aircraft;
  } catch (error) {
    console.error("[Aircraft] Fetch failed:", error);

    return [];
  }
}

function projectAircraftPosition(
  latitude,
  longitude,
  trackDegrees,
  distanceMiles,
) {
  const earthRadiusMiles = 3958.8;

  const angularDistance = distanceMiles / earthRadiusMiles;

  const bearing = (trackDegrees * Math.PI) / 180;

  const latitude1 = (latitude * Math.PI) / 180;

  const longitude1 = (longitude * Math.PI) / 180;

  const latitude2 = Math.asin(
    Math.sin(latitude1) * Math.cos(angularDistance) +
      Math.cos(latitude1) * Math.sin(angularDistance) * Math.cos(bearing),
  );

  const longitude2 =
    longitude1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude1),

      Math.cos(angularDistance) - Math.sin(latitude1) * Math.sin(latitude2),
    );

  return {
    latitude: (latitude2 * 180) / Math.PI,

    longitude: (((longitude2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

function updateAircraftMotion() {
  const nowSeconds = Date.now() / 1000;

  for (const aircraft of aircraftMarkers.values()) {
    const plane = aircraft.data;

    if (
      !plane ||
      typeof plane.latitude !== "number" ||
      typeof plane.longitude !== "number"
    ) {
      continue;
    }

    const observationTime = plane.lastPositionTime ?? plane.lastContactTime;

    if (
      typeof observationTime !== "number" ||
      typeof plane.speedKnots !== "number" ||
      typeof plane.trackDegrees !== "number" ||
      plane.onGround
    ) {
      continue;
    }

    const rawElapsedSeconds = nowSeconds - observationTime;

    const elapsedSeconds = Math.max(
      0,
      Math.min(rawElapsedSeconds, AIRCRAFT_MAX_EXTRAPOLATION_SECONDS),
    );

    const speedMilesPerHour = plane.speedKnots * 1.15078;

    const distanceMiles = (speedMilesPerHour * elapsedSeconds) / 3600;

    const projectedPosition = projectAircraftPosition(
      plane.latitude,
      plane.longitude,
      plane.trackDegrees,
      distanceMiles,
    );

    let displayLatitude = projectedPosition.latitude;

    let displayLongitude = projectedPosition.longitude;

    if (aircraft.correction) {
      const correctionProgress = Math.min(
        1,
        (Date.now() - aircraft.correction.startedAt) /
          AIRCRAFT_POSITION_CORRECTION_MS,
      );

      const easedProgress =
        correctionProgress * correctionProgress * (3 - 2 * correctionProgress);

      displayLatitude =
        aircraft.correction.startLatitude +
        (projectedPosition.latitude - aircraft.correction.startLatitude) *
          easedProgress;

      displayLongitude =
        aircraft.correction.startLongitude +
        (projectedPosition.longitude - aircraft.correction.startLongitude) *
          easedProgress;

      if (correctionProgress >= 1) {
        aircraft.correction = null;
      }
    }

    aircraft.marker.setLatLng([displayLatitude, displayLongitude]);

    aircraft.estimatedPosition = {
      ...projectedPosition,
    };

    aircraft.estimatedAt = Date.now();
  }
}

function startAircraftMotionManager() {
  if (aircraftMotionTimer) {
    return;
  }

  aircraftMotionTimer = setInterval(
    updateAircraftMotion,
    AIRCRAFT_MOTION_INTERVAL_MS,
  );

  console.log("[Aircraft] Motion manager started.");
}

function displayAircraft(aircraft) {
  if (!aircraftLayer) {
    console.warn("[Aircraft] Layer not initialized.");
    return;
  }

  const seenAircraft = new Set();

  aircraft.forEach((plane) => {
    if (
      typeof plane.latitude !== "number" ||
      typeof plane.longitude !== "number" ||
      !plane.icao24
    ) {
      return;
    }

    const icao24 = plane.icao24;

    seenAircraft.add(icao24);

    const trackDegrees =
      typeof plane.trackDegrees === "number" ? plane.trackDegrees : 0;

    const aircraftIcon = L.divIcon({
      className: "aircraft-marker",

      html: `
                <svg
                    width="32"
                    height="32"
                    viewBox="0 0 32 32"
                    style="
                        display: block;
                        transform: rotate(${trackDegrees}deg);
                        transform-origin: 50% 50%;
                    "
                >
                    <path
                        d="
                            M16 2
                            L19 12
                            L28 16
                            L28 19
                            L19 17
                            L18 27
                            L22 29
                            L22 31
                            L16 29
                            L10 31
                            L10 29
                            L14 27
                            L13 17
                            L4 19
                            L4 16
                            L13 12
                            Z
                        "
                        fill="white"
                        stroke="black"
                        stroke-width="1"
                    />
                </svg>
            `,

      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const callsign = plane.callsign || plane.icao24 || "UNKNOWN";

    const altitude =
      plane.altitudeFeet !== null
        ? `${Math.round(plane.altitudeFeet).toLocaleString()} ft`
        : "Unknown";

    const speed =
      plane.speedKnots !== null
        ? `${Math.round(plane.speedKnots)} kt`
        : "Unknown";

    const distance =
      plane.distanceMiles !== null
        ? `${plane.distanceMiles.toFixed(1)} mi`
        : "Unknown";

    const popupContent = `
            <strong>${callsign}</strong><br>
            ICAO: ${plane.icao24}<br>
            Altitude: ${altitude}<br>
            Speed: ${speed}<br>
            Track: ${
              typeof plane.trackDegrees === "number"
                ? `${Math.round(plane.trackDegrees)}°`
                : "Unknown"
            }<br>
            Distance: ${distance}
        `;

    const existingAircraft = aircraftMarkers.get(icao24);

    const observationTime =
      plane.lastPositionTime ?? plane.lastContactTime ?? null;

    const newPosition = {
      latitude: plane.latitude,

      longitude: plane.longitude,

      observationTime,
    };

    if (existingAircraft) {
      const positionChanged =
        existingAircraft.currentPosition.latitude !== plane.latitude ||
        existingAircraft.currentPosition.longitude !== plane.longitude;

      const observationChanged =
        observationTime !== null &&
        observationTime !== existingAircraft.currentPosition.observationTime;

      if (positionChanged || observationChanged) {
        const displayedPosition = existingAircraft.marker.getLatLng();

        existingAircraft.correction = {
          startedAt: Date.now(),

          startLatitude: displayedPosition.lat,

          startLongitude: displayedPosition.lng,
        };
        existingAircraft.previousPosition = {
          ...existingAircraft.currentPosition,
        };

        existingAircraft.currentPosition = {
          ...newPosition,
        };

        existingAircraft.updatedAt = Date.now();

        console.log(`[Aircraft] Position update • ${callsign}`, {
          previous: existingAircraft.previousPosition,

          current: existingAircraft.currentPosition,
        });
      }

      existingAircraft.marker.setIcon(aircraftIcon);

      existingAircraft.marker.setPopupContent(popupContent);

      existingAircraft.data = plane;
    } else {
      const marker = L.marker([plane.latitude, plane.longitude], {
        icon: aircraftIcon,
      })
        .addTo(aircraftLayer)
        .bindPopup(popupContent);

      aircraftMarkers.set(icao24, {
        marker,

        data: plane,

        previousPosition: null,

        currentPosition: {
          ...newPosition,
        },

        updatedAt: Date.now(),

        correction: null,
      });
    }
  });

  for (const [icao24, aircraft] of aircraftMarkers) {
    if (!seenAircraft.has(icao24)) {
      aircraftLayer.removeLayer(aircraft.marker);

      aircraftMarkers.delete(icao24);
    }
  }

  const aviationAircraftCount = document.getElementById(
    "aviation-aircraft-count",
  );

  if (aviationAircraftCount) {
    aviationAircraftCount.textContent = aircraft.length;
  }

  const aviationNearestAircraft = document.getElementById(
    "aviation-nearest-aircraft",
  );

  if (aviationNearestAircraft && aircraft.length > 0) {
    const nearestAircraft = aircraft[0];

    const nearestCallsign =
      nearestAircraft.callsign || nearestAircraft.icao24 || "UNKNOWN";

    const nearestDistance =
      typeof nearestAircraft.distanceMiles === "number"
        ? nearestAircraft.distanceMiles.toFixed(1)
        : "--";

    aviationNearestAircraft.textContent = `${nearestCallsign} • ${nearestDistance} mi`;

    aviationNearestAircraft.style.cursor = "pointer";

    aviationNearestAircraft.onclick = () => {
      focusAircraftOnMap(nearestAircraft.icao24);
    };
  }

  console.log(`[Aircraft] Displayed ${aircraft.length} aircraft`);

  console.log(`[Aircraft] Tracking ${aircraftMarkers.size} persistent markers`);
}

// =============================
// Diagnostics Logger
// =============================

const DIAGNOSTIC_STORAGE_KEY = "overwatch-diagnostic-log";

const MAX_DIAGNOSTIC_LOG_ENTRIES = 5000;

function loadDiagnosticLogEntries() {
  try {
    const savedLog = localStorage.getItem(DIAGNOSTIC_STORAGE_KEY);

    if (!savedLog) {
      return [];
    }

    const parsedLog = JSON.parse(savedLog);

    return Array.isArray(parsedLog) ? parsedLog : [];
  } catch (error) {
    console.error("Unable to restore diagnostic log:", error);

    return [];
  }
}

const diagnosticLogEntries = loadDiagnosticLogEntries();

function diagnosticLog(category, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    category,
    data,
  };

  diagnosticLogEntries.push(entry);

  if (diagnosticLogEntries.length > MAX_DIAGNOSTIC_LOG_ENTRIES) {
    diagnosticLogEntries.shift();
  }

  try {
    localStorage.setItem(
      DIAGNOSTIC_STORAGE_KEY,
      JSON.stringify(diagnosticLogEntries),
    );
  } catch (error) {
    console.error("Unable to save diagnostic log:");
  }

  console.log(`[${category}]`, data);
}

function exportDiagnosticLog() {
  diagnosticLog("Diagnostics", {
    event: "Log exported",
    entryCount: diagnosticLogEntries.length,
  });

  const logData = {
    exportedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    entries: diagnosticLogEntries,
  };

  const blob = new Blob([JSON.stringify(logData, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");

  const timestamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");

  downloadLink.href = url;
  downloadLink.download = `overwatch-diagnostics-${timestamp}.json`;

  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// =============================
// Notification Manager
// =============================

const notificationManager = {
  alerts: [],

  clear() {
    this.alerts = [];
    updateAlertsPanel();
  },

  beginRefresh(source) {
    this.alerts.forEach((alert) => {
      if (alert.source === source) {
        alert._syncSeen = false;
      }
    });
  },

  endRefresh(source) {
    this.alerts = this.alerts.filter((alert) => {
      return alert.source !== source || alert._syncSeen;
    });

    updateAlertsPanel();

    initializedAlertSources.add(source);
  },

  getAlertColor(priority) {
    switch (priority) {
      case "critical":
        return "#ff3030";

      case "high":
        return "#ff9800";

      case "medium":
        return "#ffd400";

      default:
        return DEFAULT_SYSTEM_ACCENT;
    }
  },

  addAlert(alert) {
    const existingAlert = this.alerts.find(
      (existing) => existing.id === alert.id,
    );

    if (existingAlert) {
      Object.assign(existingAlert, alert);

      existingAlert._syncSeen = true;
    } else {
      alert._syncSeen = true;

      this.alerts.push(alert);

      console.log("🚨 New Alert:", alert.title || alert.event);

      const alertColor = this.getAlertColor(alert.priority);

      flashSystemAccent(alertColor);
    }

    updateAlertsPanel();
  },

  getAlerts() {
    return this.alerts;
  },
};

function flashSystemAccent(alertColor) {
  console.log("FRAME FLASH:", alertColor);

  const root = document.documentElement;

  root.style.setProperty("--system-accent", alertColor);

  if (systemAccentFlashTimer) {
    clearTimeout(systemAccentFlashTimer);
  }

  systemAccentFlashTimer = setTimeout(() => {
    root.style.setProperty("--system-accent", DEFAULT_SYSTEM_ACCENT);

    systemAccentFlashTimer = null;
  }, ALERT_FLASH_DURATION);
}

function getAlertColor(priority) {
  const alertColors = {
    critical: "#ff3030",
    high: "#ff9800",
    medium: "#ffd400",
    low: DEFAULT_SYSTEM_ACCENT,
  };

  return alertColors[priority] || DEFAULT_SYSTEM_ACCENT;
}

function updateRadarStatusBorderPriority(alertPriority = "normal") {
  const radarStatusRow = document.getElementById("radar-status-row");

  if (!radarStatusRow) {
    return;
  }

  radarStatusRow.classList.remove(
    "priority-normal",
    "priority-low",
    "priority-medium",
    "priority-high",
    "priority-critical",
  );

  radarStatusRow.classList.add(`priority-${alertPriority}`);
}

function updateAlertsPanel() {
  const alertsHeading = document.getElementById("alerts-heading");

  const alertsPanel = document.getElementById("alerts-panel");

  const alertsStatus = document.getElementById("alerts-status");

  if (!alertsPanel || !alertsHeading || !alertsStatus) {
    return;
  }

  const alerts = notificationManager.getAlerts();

  alertsPanel.classList.remove(
    "alert-clear",
    "alert-medium",
    "alert-high",
    "alert-critical",
  );

  alertsHeading.classList.remove(
    "alert-clear",
    "alert-medium",
    "alert-high",
    "alert-critical",
  );

  alertsStatus.classList.remove(
    "alert-clear",
    "alert-medium",
    "alert-high",
    "alert-critical",
  );

  if (alerts.length === 0) {
    alertsPanel.classList.add("alert-clear");

    alertsHeading.classList.add("alert-clear");

    alertsStatus.classList.add("alert-clear");

    updateRadarStatusBorderPriority("normal");

    alertsStatus.textContent = "🟢 All Clear";

    contextManager.clearStatus("sentinel");

    updateRadarStatusBorderPriority("normal");

    return;
  }

  const priorityOrder = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  /*
   * Refresh each alert's relevance score
   * before ranking the active alerts.
   */
  alerts.forEach((alert) => {
    if (typeof calculateSentinelRelevanceScore === "function") {
      alert.relevanceScore = calculateSentinelRelevanceScore({
        priority: alert.priority || alert.severity || "low",

        severity: alert.capSeverity,

        urgency: alert.urgency,

        certainty: alert.certainty,

        distanceMiles: alert.distance,

        direction: alert.direction,

        expires: alert.expires,

        affectsCurrentLocation: alert.affectsCurrentLocation === true,
      });
    }
  });

  const highestAlert = [...alerts].sort(function (alertA, alertB) {
    const scoreA = Number.isFinite(alertA.relevanceScore)
      ? alertA.relevanceScore
      : 0;

    const scoreB = Number.isFinite(alertB.relevanceScore)
      ? alertB.relevanceScore
      : 0;

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    const priorityA = alertA.priority || alertA.severity || "low";

    const priorityB = alertB.priority || alertB.severity || "low";

    const priorityDifference =
      (priorityOrder[priorityB] || 0) - (priorityOrder[priorityA] || 0);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const distanceA = Number.isFinite(alertA.distance)
      ? alertA.distance
      : Infinity;

    const distanceB = Number.isFinite(alertB.distance)
      ? alertB.distance
      : Infinity;

    return distanceA - distanceB;
  })[0];

  const alertPriority = highestAlert.priority || highestAlert.severity || "low";

  updateRadarStatusBorderPriority(alertPriority);

  switch (alertPriority) {
    case "critical":
      alertsPanel.classList.add("alert-critical");

      alertsHeading.classList.add("alert-critical");

      alertsStatus.classList.add("alert-critical");
      break;

    case "high":
      alertsPanel.classList.add("alert-high");

      alertsHeading.classList.add("alert-high");

      alertsStatus.classList.add("alert-high");
      break;

    case "medium":
      alertsPanel.classList.add("alert-medium");

      alertsHeading.classList.add("alert-medium");

      alertsStatus.classList.add("alert-medium");
      break;

    default:
      alertsPanel.classList.add("alert-clear");

      alertsHeading.classList.add("alert-clear");

      alertsStatus.classList.add("alert-clear");
  }

  const alertIcon = highestAlert.icon || "🚨";

  const alertTitle = highestAlert.title || highestAlert.event || "Active Alert";

  let alertDetails = "";
  let contextDetail = "";

  if (highestAlert.affectsCurrentLocation === true) {
    alertDetails = " — Current Location";

    contextDetail = "Affects current location";
  } else {
    if (
      typeof highestAlert.distance === "number" &&
      Number.isFinite(highestAlert.distance)
    ) {
      alertDetails += ` — ${highestAlert.distance.toFixed(1)} miles`;

      contextDetail = `${highestAlert.distance.toFixed(1)} miles`;
    }

    if (highestAlert.direction) {
      alertDetails += ` ${highestAlert.direction}`;

      contextDetail += `${contextDetail ? " " : ""}${highestAlert.direction}`;
    }
  }

  contextManager.setStatus({
    source: "sentinel",
    priority: alertPriority,
    icon: alertIcon,
    title: alertTitle,
    detail: contextDetail || "Active Sentinel alert",
  });

  alertsStatus.innerHTML = "";

  const alertZoomButton = document.createElement("button");

  alertZoomButton.type = "button";

  alertZoomButton.className = "alert-zoom-link";

  alertZoomButton.textContent = `${alertIcon} ${alertTitle}${alertDetails}`;

  alertZoomButton.title = "Show alert on map";

  alertZoomButton.setAttribute("aria-label", `Show ${alertTitle} on map`);

  alertZoomButton.addEventListener("click", function () {
    if (
      !Array.isArray(highestAlert.geometryFeatures) ||
      highestAlert.geometryFeatures.length === 0
    ) {
      console.warn("[Sentinel] Selected alert has no geometry.");

      return;
    }

    zoomToGeometryFeatures(highestAlert.geometryFeatures);
  });

  alertsStatus.appendChild(alertZoomButton);

  console.log("[Sentinel] Highest-ranked alert:", {
    title: alertTitle,

    priority: alertPriority,

    relevanceScore: highestAlert.relevanceScore,

    distance: highestAlert.distance,

    direction: highestAlert.direction,

    affectsCurrentLocation: highestAlert.affectsCurrentLocation,
  });
}

// =============================
// Navigation Functions
// =============================

function resumeAutomaticMapZoom() {
  mapZoomMode = MAP_ZOOM_MODES.AUTO;
  manualMapZoom = null;
  updateMapZoomModeControl();

  diagnosticLog("Navigation", {
    event: "Automatic zoom resumed",
    targetZoom: navigationIntelligenceManager.targetZoom,
  });

  if (
    operatingMode === OPERATING_MODES.DRIVING ||
    operatingMode === OPERATING_MODES.WALKING
  ) {
    updateNavigationDisplay();
  } else if (operatingMode === OPERATING_MODES.PARKED) {
    applyParkedMapState();
  }
}

function updateMapZoomModeControl() {
  const button = document.getElementById("map-zoom-mode-btn");

  if (!button) {
    return;
  }

  const isManual = mapZoomMode === MAP_ZOOM_MODES.MANUAL;

  button.textContent = isManual ? "MANUAL" : "AUTO";

  button.title = isManual
    ? "Resume automatic driving zoom"
    : "Automatic driving zoom active";

  button.setAttribute(
    "aria-label",
    isManual
      ? "Resume automatic driving zoom"
      : "Automatic driving zoom active",
  );
}

function initializeMapZoomModeControl() {
  const zoomModeControl = L.control({
    position: "bottomleft",
  });

  zoomModeControl.onAdd = function () {
    const container = L.DomUtil.create(
      "div",
      "leaflet-bar overwatch-zoom-mode-control",
    );

    const button = L.DomUtil.create("button", "", container);

    button.type = "button";
    button.id = "map-zoom-mode-btn";
    button.textContent = "AUTO";
    button.title = "Resume automatic driving zoom";
    button.setAttribute("aria-label", "Resume automatic driving zoom");

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    L.DomEvent.on(button, "click", function (event) {
      L.DomEvent.stop(event);

      resumeAutomaticMapZoom();
    });

    return container;
  };

  zoomModeControl.addTo(radarMap);
}

function applyParkedMapState() {
  if (!radarMap || currentLatitude === null || currentLongitude === null) {
    return;
  }

  const previousBearing = radarMap.getBearing?.() ?? null;

  const previousZoom = radarMap.getZoom?.() ?? null;

  diagnosticLog("Navigation Command", {
    event: "Applying parked map state",
    previousBearing,
    targetBearing: 0,
    previousZoom,
    targetZoom: PARKED_MAP_ZOOM,
  });

  if (typeof radarMap.setBearing === "function") {
    radarMap.setBearing(0);
  }

  /*
   * Recenter on the vehicle to remove the
   * driving look-ahead offset, then apply
   * the parked zoom level.
   */
  mapAutoZoomUpdateActive = true;

  radarMap.setView([currentLatitude, currentLongitude], PARKED_MAP_ZOOM, {
    animate: false,
  });

  mapAutoZoomUpdateActive = false;

  diagnosticLog("Navigation Command", {
    event: "Parked map state applied",
    actualBearing: radarMap.getBearing?.() ?? null,
    actualZoom: radarMap.getZoom?.() ?? null,
  });
}

function updateMovementIcon() {
  if (!locationMarker) {
    return;
  }

  let newIcon;

  if (operatingMode === OPERATING_MODES.DRIVING) {
    newIcon = vehicleLocationIcon;
  } else if (operatingMode === OPERATING_MODES.WALKING) {
    newIcon = walkingLocationIcon;
  } else {
    newIcon = stationaryLocationIcon;
  }

  if (locationMarker.options.icon !== newIcon) {
    locationMarker.setIcon(newIcon);
  }

  const markerElement = locationMarker.getElement();

  if (!markerElement) {
    return;
  }

  const vehicleMarker = markerElement.querySelector(".vehicle-marker");

  if (vehicleMarker) {
    vehicleMarker.style.transform = "rotate(0deg)";
  }
}

function applyMapLookAhead() {
  if (!radarMap || operatingMode !== OPERATING_MODES.DRIVING) {
    return;
  }

  const mapContainer = radarMap.getContainer();

  const lookAheadPixels = mapContainer.clientHeight * MAP_LOOK_AHEAD_RATIO;

  /*
   * The map is rotated so the vehicle heading
   * points toward the top of the display.
   *
   * Panning upward moves the map center ahead
   * of the vehicle, leaving the vehicle marker
   * below center.
   */
  radarMap.panBy([0, -lookAheadPixels], {
    animate: false,
  });
}

function updateNavigationDisplay() {
  if (!radarMap || currentLatitude === null || currentLongitude === null) {
    return;
  }

  if (
    operatingMode !== OPERATING_MODES.DRIVING &&
    operatingMode !== OPERATING_MODES.WALKING
  ) {
    return;
  }

  const drivingZoom =
    mapZoomMode === MAP_ZOOM_MODES.MANUAL && manualMapZoom !== null
      ? manualMapZoom
      : operatingMode === OPERATING_MODES.WALKING
        ? WALKING_MAP_ZOOM
        : navigationIntelligenceManager.targetZoom;

  if (currentHeading !== null && typeof radarMap.setBearing === "function") {
    const mapBearing = convertHeadingToMapBearing(currentHeading);

    const visualMapBearing = (360 - mapBearing) % 360;

    radarMap.setBearing(visualMapBearing);
  }

  mapAutoZoomUpdateActive = true;

  radarMap.setView([currentLatitude, currentLongitude], drivingZoom, {
    animate: false,
  });

  mapAutoZoomUpdateActive = false;

  if (currentHeading !== null) {
    applyMapLookAhead();
  }
}

// =============================
// Clock Functions
// =============================

function updateClock() {
  const clockElement = document.getElementById("clock");

  if (!clockElement) {
    return;
  }

  const now = new Date();

  clockElement.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  clockElement.dateTime = now.toISOString();
}
// =============================
// GPS Functions
// =============================

function updateSystemStatus() {
  const systemStatus = document.getElementById("system-status-text");

  if (!systemStatus) {
    return;
  }

  let statusText;

  switch (operatingMode) {
    case OPERATING_MODES.DRIVING:
      statusText = `DRIVING • ${Math.round(currentSpeedMph)} MPH`;
      break;

    case OPERATING_MODES.WALKING:
      statusText = `WALKING • ${Math.round(currentSpeedMph)} MPH`;
      break;

    default:
      statusText = "PARKED";
  }

  systemStatus.textContent = statusText;
}

// =============================
// Weather Functions
// =============================
function getWeatherDescription(code) {
  const weatherCodes = {
    0: "Clear",
    1: "Mostly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Freezing Fog",
    51: "Light Drizzle",
    53: "Drizzle",
    55: "Heavy Drizzle",
    61: "Light Rain",
    63: "Rain",
    65: "Heavy Rain",
    71: "Light Snow",
    73: "Snow",
    75: "Heavy Snow",
    80: "Light Rain Showers",
    81: "Rain Showers",
    82: "Heavy Rain Showers",
    95: "Thunderstorms",
    96: "Thunderstorms with Hail",
    99: "Severe Thunderstorms with Hail",
  };

  return weatherCodes[code] || "Unknown Conditions";
}

async function loadWeather(latitude, longitude) {
  const weatherStatus = document.getElementById("weather-status");

  try {
    weatherStatus.textContent = "Loading weather...";

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

    console.log(weatherUrl);

    const response = await fetch(weatherUrl);

    if (!response.ok) {
      throw new Error(`Weather request failed: ${response.status}`);
    }

    const weather = await response.json();
    const current = weather.current;

    document.getElementById("weather-temperature").textContent =
      `${Math.round(current.temperature_2m)}°F`;

    document.getElementById("weather-condition").textContent =
      getWeatherDescription(current.weather_code);

    document.getElementById("weather-feels-like").textContent =
      `${Math.round(current.apparent_temperature)}°F`;

    document.getElementById("weather-humidity").textContent =
      `${Math.round(current.relative_humidity_2m)}%`;

    document.getElementById("weather-wind").textContent =
      `${Math.round(current.wind_speed_10m)} mph`;

    document.getElementById("weather-gusts").textContent =
      `${Math.round(current.wind_gusts_10m)} mph`;

    weatherStatus.textContent = "Live conditions";
  } catch (error) {
    console.error(error);
    weatherStatus.textContent = "Unable to load weather.";
  }
}

// =================================
// Map Functions
// =================================

function requestWeatherLocation() {
  const weatherStatus = document.getElementById("weather-status");

  if (!navigator.geolocation) {
    weatherStatus.textContent =
      "Location services are not supported by this browser.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      loadWeather(latitude, longitude);
    },

    function (error) {
      console.error(error);
      weatherStatus.textContent =
        "Location permission is required for local weather.";
    },
  );
}

// =============================
// Sentinel Functions
// =============================

function getAlertAreaCodes(feature) {
  const properties = feature?.properties || {};

  const areaCodes = new Set();

  const geocode = properties.geocode || {};

  /*
   * UGC identifiers usually begin with a
   * two-letter state or marine-zone prefix.
   */
  const ugcCodes = Array.isArray(geocode.UGC) ? geocode.UGC : [];

  ugcCodes.forEach((code) => {
    if (typeof code === "string" && code.length >= 2) {
      areaCodes.add(code.slice(0, 2).toUpperCase());
    }
  });

  /*
   * Use affected-zone URLs as a fallback.
   */
  const affectedZones = Array.isArray(properties.affectedZones)
    ? properties.affectedZones
    : [];

  affectedZones.forEach((zoneUrl) => {
    const zoneId = getNwsZoneId(zoneUrl);

    if (typeof zoneId === "string" && zoneId.length >= 2) {
      areaCodes.add(zoneId.slice(0, 2).toUpperCase());
    }
  });

  return Array.from(areaCodes);
}

function isSentinelCandidateArea(feature) {
  const areaCodes = getAlertAreaCodes(feature);

  return areaCodes.some((code) => {
    return SENTINEL_CANDIDATE_AREAS.has(code);
  });
}

function isPointInsideRing(latitude, longitude, ring) {
  let isInside = false;

  for (
    let currentIndex = 0, previousIndex = ring.length - 1;
    currentIndex < ring.length;
    previousIndex = currentIndex++
  ) {
    const currentPoint = ring[currentIndex];

    const previousPoint = ring[previousIndex];

    const currentLongitude = currentPoint[0];

    const currentLatitude = currentPoint[1];

    const previousLongitude = previousPoint[0];

    const previousLatitude = previousPoint[1];

    const crossesLatitude =
      currentLatitude > latitude !== previousLatitude > latitude;

    const intersectionLongitude =
      ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
        (previousLatitude - currentLatitude) +
      currentLongitude;

    if (crossesLatitude && longitude < intersectionLongitude) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function isPointInsidePolygonCoordinates(
  latitude,
  longitude,
  polygonCoordinates,
) {
  if (!Array.isArray(polygonCoordinates) || polygonCoordinates.length === 0) {
    return false;
  }

  /*
   * The first ring is the outer boundary.
   */
  const outerRing = polygonCoordinates[0];

  if (!isPointInsideRing(latitude, longitude, outerRing)) {
    return false;
  }

  /*
   * Remaining rings represent holes.
   */
  for (let ringIndex = 1; ringIndex < polygonCoordinates.length; ringIndex++) {
    if (isPointInsideRing(latitude, longitude, polygonCoordinates[ringIndex])) {
      return false;
    }
  }

  return true;
}

function calculateNearestPointOnSegment(
  latitude,
  longitude,
  segmentStart,
  segmentEnd,
) {
  const referenceLatitudeRadians = degreesToRadians(latitude);

  const milesPerLatitudeDegree = 69.0;

  const milesPerLongitudeDegree = 69.172 * Math.cos(referenceLatitudeRadians);

  const startX = (segmentStart[0] - longitude) * milesPerLongitudeDegree;

  const startY = (segmentStart[1] - latitude) * milesPerLatitudeDegree;

  const endX = (segmentEnd[0] - longitude) * milesPerLongitudeDegree;

  const endY = (segmentEnd[1] - latitude) * milesPerLatitudeDegree;

  const segmentX = endX - startX;

  const segmentY = endY - startY;

  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  let projection = 0;

  if (segmentLengthSquared > 0) {
    projection =
      (-startX * segmentX + -startY * segmentY) / segmentLengthSquared;

    projection = Math.max(0, Math.min(1, projection));
  }

  const nearestX = startX + projection * segmentX;

  const nearestY = startY + projection * segmentY;

  const nearestLongitude = longitude + nearestX / milesPerLongitudeDegree;

  const nearestLatitude = latitude + nearestY / milesPerLatitudeDegree;

  return {
    distanceMiles: Math.hypot(nearestX, nearestY),

    nearestLatitude,
    nearestLongitude,
  };
}

function measurePointAgainstRing(latitude, longitude, ring) {
  if (!Array.isArray(ring) || ring.length < 2) {
    return {
      distanceMiles: Infinity,
      nearestLatitude: null,
      nearestLongitude: null,
    };
  }

  let nearestMeasurement = {
    distanceMiles: Infinity,
    nearestLatitude: null,
    nearestLongitude: null,
  };

  function inspectSegment(segmentStart, segmentEnd) {
    const measurement = calculateNearestPointOnSegment(
      latitude,
      longitude,
      segmentStart,
      segmentEnd,
    );

    if (measurement.distanceMiles < nearestMeasurement.distanceMiles) {
      nearestMeasurement = measurement;
    }
  }

  for (let pointIndex = 0; pointIndex < ring.length - 1; pointIndex++) {
    inspectSegment(ring[pointIndex], ring[pointIndex + 1]);
  }

  const firstPoint = ring[0];

  const lastPoint = ring[ring.length - 1];

  if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
    inspectSegment(lastPoint, firstPoint);
  }

  return nearestMeasurement;
}

function measurePointAgainstGeometry(latitude, longitude, geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) {
    return {
      affectsCurrentLocation: false,
      distanceMiles: Infinity,
      nearestLatitude: null,
      nearestLongitude: null,
    };
  }

  let polygons = [];

  if (geometry.type === "Polygon") {
    polygons = [geometry.coordinates];
  } else if (geometry.type === "MultiPolygon") {
    polygons = geometry.coordinates;
  } else {
    return {
      affectsCurrentLocation: false,
      distanceMiles: Infinity,
      nearestLatitude: null,
      nearestLongitude: null,
    };
  }

  let nearestMeasurement = {
    affectsCurrentLocation: false,
    distanceMiles: Infinity,
    nearestLatitude: null,
    nearestLongitude: null,
  };

  for (const polygonCoordinates of polygons) {
    if (
      isPointInsidePolygonCoordinates(latitude, longitude, polygonCoordinates)
    ) {
      return {
        affectsCurrentLocation: true,
        distanceMiles: 0,
        nearestLatitude: latitude,
        nearestLongitude: longitude,
      };
    }

    for (const ring of polygonCoordinates) {
      const ringMeasurement = measurePointAgainstRing(
        latitude,
        longitude,
        ring,
      );

      if (ringMeasurement.distanceMiles < nearestMeasurement.distanceMiles) {
        nearestMeasurement = {
          affectsCurrentLocation: false,

          ...ringMeasurement,
        };
      }
    }
  }

  return nearestMeasurement;
}

function measureAlertGeometryFeatures(latitude, longitude, geometryFeatures) {
  let nearestMeasurement = {
    affectsCurrentLocation: false,
    distanceMiles: Infinity,
    nearestLatitude: null,
    nearestLongitude: null,
  };

  geometryFeatures.forEach((geometryFeature) => {
    const measurement = measurePointAgainstGeometry(
      latitude,
      longitude,
      geometryFeature.geometry,
    );

    if (measurement.affectsCurrentLocation) {
      nearestMeasurement = measurement;

      return;
    }

    if (measurement.distanceMiles < nearestMeasurement.distanceMiles) {
      nearestMeasurement = measurement;
    }
  });

  return nearestMeasurement;
}

function describeAlertDirection(measurement) {
  if (measurement.affectsCurrentLocation) {
    return {
      bearing: null,
      compassDirection: "Current Location",
      relativeDirection: "Current Location",
    };
  }

  if (
    !Number.isFinite(measurement.nearestLatitude) ||
    !Number.isFinite(measurement.nearestLongitude)
  ) {
    return {
      bearing: null,
      compassDirection: "Direction Unknown",
      relativeDirection: "Direction Unknown",
    };
  }

  const bearing = calculateBearing(
    currentLatitude,
    currentLongitude,
    measurement.nearestLatitude,
    measurement.nearestLongitude,
  );

  const compassDirection = bearingToCompass(bearing);

  let relativeDirection = compassDirection;

  if (operatingMode === OPERATING_MODES.DRIVING && currentHeading !== null) {
    relativeDirection = classifyRelativeDirection(currentHeading, bearing);
  }

  return {
    bearing,
    compassDirection,
    relativeDirection,
  };
}

async function getNearbySentinelAlerts() {
  const nationalAlerts = await fetchAllActiveNwsAlerts();

  const regionalCandidates = nationalAlerts.filter(isSentinelCandidateArea);

  const nearbyAlerts = [];

  for (const feature of regionalCandidates) {
    const geometryFeatures = await resolveAlertGeometryFeatures(feature);

    if (geometryFeatures.length === 0) {
      continue;
    }

    const measurement = measureAlertGeometryFeatures(
      currentLatitude,
      currentLongitude,
      geometryFeatures,
    );

    if (
      !Number.isFinite(measurement.distanceMiles) ||
      measurement.distanceMiles > SENTINEL_RADIUS_MILES
    ) {
      continue;
    }

    const direction = describeAlertDirection(measurement);

    nearbyAlerts.push({
      feature,
      geometryFeatures,
      measurement,
      direction,
    });
  }

  console.log("[Sentinel] Nearby alert processing complete:", {
    nationalAlerts: nationalAlerts.length,

    regionalCandidates: regionalCandidates.length,

    withinRadius: nearbyAlerts.length,
  });

  return nearbyAlerts;
}

// Route awareness
// Threat evaluation
// Corridor filtering
// ETA calculations
// Future implementation

// ================================
// Radar Functions
// ================================

function updateMapZoomDisplay() {
  const zoomDisplay = document.getElementById("map-zoom-level");

  if (!zoomDisplay || !radarMap) {
    return;
  }

  const currentZoom = radarMap.getZoom();

  zoomDisplay.textContent = `Z${currentZoom}`;

  diagnosticLog("Map", {
    event: "Zoom changed",
    zoom: currentZoom,
    fullscreen: mapPanel.classList.contains("fullscreen-map"),
  });
}

function initializeMap() {
  const mapStatus = document.getElementById("map-status");

  const defaultLatitude = DEFAULT_LATITUDE;
  const defaultLongitude = DEFAULT_LONGITUDE;

  radarMap = L.map("map", {
    rotate: true,
    minZoom: MIN_MAP_ZOOM,
  }).setView([defaultLatitude, defaultLongitude], DEFAULT_MAP_ZOOM);

  radarMap.on("zoomend", function () {
    updateMapZoomDisplay();
    handleRadarZoomLimit();

    if (!mapAutoZoomUpdateActive && !mapZoomInspectionActive) {
      mapZoomMode = MAP_ZOOM_MODES.MANUAL;
      manualMapZoom = radarMap.getZoom();

      updateMapZoomModeControl();

      console.log("[Navigation] Manual zoom override:", {
        zoom: manualMapZoom,
      });
    }

    if (radarFrames.length > 0 && radarMap.getZoom() <= 7) {
      displayRadarFrame(currentRadarFrame);
    }
  });

  updateMapZoomDisplay();

  const streetMap = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  ).addTo(radarMap);

  const baseMaps = {
    "Street Map": streetMap,
  };

  const overlayMaps = {};

  layerControl = L.control
    .layers(baseMaps, overlayMaps, {
      collapsed: true,
      position: "topleft",
    })
    .addTo(radarMap);

  initializeMapZoomModeControl();

  radarLayerGroup = L.layerGroup().addTo(radarMap);

  layerControl.addOverlay(radarLayerGroup, "🌧️ Weather Radar");

  radarMap.on("overlayremove", function (event) {
    if (event.layer !== radarLayerGroup) {
      return;
    }

    stopRadarAnimation();

    console.log("[Radar] Overlay hidden. Animation stopped.");
  });

  radarMap.on("overlayadd", async function (event) {
    if (event.layer !== radarLayerGroup) {
      return;
    }

    console.log("[Radar] Overlay restored. Loading fresh frames.");

    await initializeWeatherRadar();
  });

  radarMap.on("click", function (event) {
    radarControlsVisibilityManager.handleInteraction();

    console.log("Map clicked:", event.latlng);

    const clickedLatitude = event.latlng.lat;
    const clickedLongitude = event.latlng.lng;

    L.popup()
      .setLatLng(event.latlng)
      .setContent(
        `
            <br> 📍 Target Coordinates</br><br><br>
            Latitude: ${clickedLatitude.toFixed(5)}<br>
            Longitude: ${clickedLongitude.toFixed(5)}
            `,
      )
      .openOn(radarMap);
  });

  mapStatus.hidden = false;
  mapStatus.textContent = "Requesting Location";

  if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(
      function (position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        updateMovementVector(
          latitude,
          longitude,
          position.coords.accuracy,
          position.timestamp,
        );

        currentLatitude = latitude;
        currentLongitude = longitude;

        if (!aircraftTrackingStarted) {
          aircraftTrackingStarted = true;

          fetchNearbyAircraft();

          setInterval(fetchNearbyAircraft, AIRCRAFT_REFRESH_INTERVAL_MS);
        }

        const speedMetersPerSecond = position.coords.speed;

        currentGpsSpeedAvailable = speedMetersPerSecond !== null;

        if (currentGpsSpeedAvailable) {
          currentSpeedMph = speedMetersPerSecond * 2.23694;
        } else {
          currentSpeedMph = 0;
        }

        const movementEvidence = getMovementEvidence();

        navigationIntelligenceManager.update(
          movementEvidence.effectiveSpeedMph,
        );

        if (position.coords.heading !== null) {
          const smoothedHeading = navigationIntelligenceManager.updateHeading(
            position.coords.heading,
            movementEvidence.effectiveSpeedMph,
          );

          if (smoothedHeading !== null) {
            currentHeading = smoothedHeading;
          }
        } else if (movementVectorDetected && movementVectorBearing !== null) {
          currentHeading = movementVectorBearing;
        }

        if (!initialWarningsLoaded) {
          initialWarningsLoaded = true;
          loadNwsWarnings();
        }

        if (!locationMarker) {
          locationMarker = L.marker([latitude, longitude], {
            icon: stationaryLocationIcon,
          }).addTo(radarMap);

          mapAutoZoomUpdateActive = true;

          radarMap.setView([latitude, longitude], PARKED_MAP_ZOOM, {
            animate: false,
          });

          mapAutoZoomUpdateActive = false;
        } else {
          locationMarker.setLatLng([latitude, longitude]);
        }

        updateOperatingMode();

        updateMovementIcon();
        updateNavigationDisplay();
        updateSystemStatus();

        diagnosticLog("Navigation", {
          latitude: currentLatitude,
          longitude: currentLongitude,

          accuracyFeet: position.coords.accuracy * 3.28084,

          rawSpeedMps: position.coords.speed,

          currentSpeedMph,

          averageSpeedMph: navigationIntelligenceManager.averageSpeedMph,

          rawHeading: position.coords.heading,

          smoothedHeading: navigationIntelligenceManager.smoothedHeading,

          currentHeading,

          commandedMapBearing:
            currentHeading === null
              ? null
              : convertHeadingToMapBearing(currentHeading),

          mapBearing: radarMap?.getBearing?.() ?? null,

          actualZoom: radarMap?.getZoom?.() ?? null,

          targetZoom: navigationIntelligenceManager.targetZoom,

          operatingMode: navigationIntelligenceManager.mode,

          radarPlaying: radarIsPlaying,

          currentZoom: radarMap?.getZoom?.(),

          currentBearing: radarMap?.getBearing?.(),

          fullscreen: mapPanel?.classList.contains("fullscreen-map"),
        });

        const accuracy = position.coords.accuracy;

        if (!accuracyCircle) {
          accuracyCircle = L.circle([latitude, longitude], {
            radius: accuracy,
            color: "#00ff00",
            fillColor: "#00ff00",
            fillOpacity: 0.15,
          }).addTo(radarMap);
        } else {
          accuracyCircle.setLatLng([latitude, longitude]);
          accuracyCircle.setRadius(accuracy);
        }

        const accuracyFeet = position.coords.accuracy * 3.28084;

        const currentZoom = radarMap.getZoom();

        mapStatus.textContent = "";
        mapStatus.hidden = true;

        contextManager.setStatus({
          source: "gps",
          priority: "critical",
          icon: "🔴",
          title: "GPS Signal Lost",
          detail: "Location unavailable",
        });

        contextManager.setStatus({
          source: "gps",
          priority: "normal",
          icon: "🛰️",
          title: "GPS Locked",
          detail: "Navigation ready",
        });
      },

      function (error) {
        console.error("GPS error:", error.code, error.message);

        mapStatus.hidden = false;

        mapStatus.textContent = `GPS ERROR ${error.code} • ${error.message}`;

        if (!locationMarker) {
          locationMarker = L.marker([defaultLatitude, defaultLongitude])
            .addTo(radarMap)
            .bindPopup("Default Location")
            .openPopup();
        }
      },

      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );
  } else {
    mapStatus.hidden = false;
    mapStatus.textContent = "GPS Unsupported";

    contextManager.setStatus({
      source: "gps",
      priority: "critical",
      icon: "🔴",
      title: "GPS Unsupported",
      detail: "Location services unavailable",
    });

    locationMarker = L.marker([defaultLatitude, defaultLongitude])
      .addTo(radarMap)
      .bindPopup("Default Location")
      .openPopup();
  }
}

// =============================
// Weather Radar
// =============================

// Initialization
async function initializeWeatherRadar() {
  console.log("Initializing weather radar");

  await refreshRadarMetadata();

  try {
    forecastRadarFrames = await fetchHrrrForecastFrames();

    rebuildRadarFrames();

    console.log("[HRRR] Forecast initialized:", forecastRadarFrames.length);
  } catch (error) {
    console.error("[HRRR] Forecast initialization failed:", error);
  }

  if (radarFrames.length === 0) {
    console.error("Weather radar could not be initialized.");

    const timestampDisplay = document.getElementById("radar-timestamp");

    if (timestampDisplay) {
      timestampDisplay.textContent = "Radar Unavailable";
    }

    return;
  }

  currentRadarFrame = observedRadarFrames.length - 1;

  console.log("[Radar] Loaded frames:", radarFrames.length);

  console.log("[Radar] Starting frame:", currentRadarFrame);

  displayRadarFrame(currentRadarFrame);

  startRadarAnimation();
  startRadarMetadataRefresh();
}

function rebuildRadarFrames() {
  switch (radarPlaybackMode) {
    case RADAR_PLAYBACK_MODES.PAST:
      radarFrames = [...observedRadarFrames];
      break;

    case RADAR_PLAYBACK_MODES.FORECAST:
      radarFrames = [...forecastRadarFrames];
      break;

    case RADAR_PLAYBACK_MODES.COMBINED:
    default:
      radarFrames = [...observedRadarFrames, ...forecastRadarFrames];
      break;
  }
}

function setRadarPlaybackMode(mode) {
  const previousMode = radarPlaybackMode;

  radarPlaybackMode = mode;

  rebuildRadarFrames();

  if (radarFrames.length === 0) {
    console.warn("[Radar] No frames available for mode:", mode);

    radarPlaybackMode = previousMode;

    rebuildRadarFrames();

    return;
  }

  if (mode === RADAR_PLAYBACK_MODES.FORECAST) {
    currentRadarFrame = 0;
  } else {
    currentRadarFrame = observedRadarFrames.length - 1;
  }

  displayRadarFrame(currentRadarFrame);

  console.log("[Radar] Playback mode:", radarPlaybackMode);
}

function buildHrrrTileUrl(modelInitUtc, forecastMinute) {
  const modelInit = new Date(modelInitUtc);

  const modelStamp = [
    modelInit.getUTCFullYear(),

    String(modelInit.getUTCMonth() + 1).padStart(2, "0"),

    String(modelInit.getUTCDate()).padStart(2, "0"),

    String(modelInit.getUTCHours()).padStart(2, "0"),

    String(modelInit.getUTCMinutes()).padStart(2, "0"),
  ].join("");

  const forecastCode = String(forecastMinute).padStart(4, "0");

  return (
    "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/" +
    `hrrr::REFD-F${forecastCode}-${modelStamp}/` +
    "{z}/{x}/{y}.png"
  );
}

function buildHrrrForecastFrames(modelInitUtc) {
  const modelInit = new Date(modelInitUtc);

  const frames = [];

  for (
    let forecastMinute = HRRR_FORECAST_STEP_MINUTES;
    forecastMinute <= HRRR_FORECAST_MAX_MINUTES;
    forecastMinute += HRRR_FORECAST_STEP_MINUTES
  ) {
    const validTime = modelInit.getTime() + forecastMinute * 60 * 1000;

    frames.push({
      time: Math.floor(validTime / 1000),

      frameType: "FORECAST",

      source: "HRRR",

      forecastMinute,

      tileUrl: buildHrrrTileUrl(modelInitUtc, forecastMinute),
    });
  }

  return frames;
}

async function fetchHrrrForecastFrames() {
  const response = await fetch(HRRR_METADATA_URL);

  if (!response.ok) {
    throw new Error(`HRRR metadata request failed: ${response.status}`);
  }

  const metadata = await response.json();

  const frames = buildHrrrForecastFrames(metadata.model_init_utc);

  const currentTimeSeconds = Date.now() / 1000;

  const futureFrames = frames.filter(
    (frame) => frame.time > currentTimeSeconds,
  );

  console.log("[HRRR] Forecast frames:", {
    modelInit: metadata.model_init_utc,

    frameCount: frames.length,

    firstFrame: frames[0],

    lastFrame: frames[frames.length - 1],
  });

  return futureFrames;
}

async function refreshRadarMetadata() {
  if (radarMetadataRefreshInProgress) {
    console.log("Radar metadata refresh already in progress.");

    return;
  }

  radarRefreshInProgress = true;
  updateRadarFreshnessDisplay();

  radarMetadataRefreshInProgress = true;

  try {
    console.log("Refreshing RainViewer radar metadata...");

    const response = await fetch(
      "https://api.rainviewer.com/public/weather-maps.json",
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`RainViewer request failed: ${response.status}`);
    }

    const radarData = await response.json();

    const updatedObservedFrames = radarData?.radar?.past;

    const updatedForecastFrames = Array.isArray(radarData?.radar?.nowcast)
      ? radarData.radar.nowcast
      : [];

    const updatedFrames = updatedObservedFrames;

    console.log("[Radar] Source frames:", {
      observed: updatedObservedFrames?.length ?? 0,

      forecast: updatedForecastFrames.length,
    });

    if (!Array.isArray(updatedFrames) || updatedFrames.length === 0) {
      throw new Error("RainViewer returned no radar frames.");
    }

    const previousLatestFrame =
      observedRadarFrames.length > 0
        ? observedRadarFrames[observedRadarFrames.length - 1]?.time
        : null;

    const updatedLatestFrame = updatedFrames[updatedFrames.length - 1]?.time;

    const updatedLatestFrameSeconds = Number(updatedLatestFrame);

    if (!Number.isFinite(updatedLatestFrameSeconds)) {
      throw new Error("RainViewer returned an invalid radar timestamp.");
    }

    observedRadarFrames = updatedObservedFrames.map((frame) => ({
      ...frame,
      host: radarData.host,
      frameType: "OBSERVED",
    }));

    rebuildRadarFrames();

    lastRadarRefreshTime = Date.now();

    lastRadarDataTimestamp = updatedLatestFrameSeconds * 1000;

    updateRadarFreshnessDisplay();

    const newDataAvailable = previousLatestFrame !== updatedLatestFrame;

    if (newDataAvailable) {
      console.log("New radar frames available.", {
        previousLatestFrame,
        updatedLatestFrame,
        frameCount: radarFrames.length,
      });
    } else {
      console.log("Radar metadata is current.", {
        latestFrame: updatedLatestFrame,
        frameCount: radarFrames.length,
      });
    }

    /*
     * Keep the animation position valid
     * after replacing the frame array.
     */
    if (currentRadarFrame >= radarFrames.length) {
      currentRadarFrame = radarFrames.length - 1;
    }

    /*
     * When paused on the latest frame,
     * advance to the newly received
     * latest frame immediately.
     */

    if (!radarIsPlaying && newDataAvailable) {
      if (radarPlaybackMode === RADAR_PLAYBACK_MODES.FORECAST) {
        currentRadarFrame = 0;
      } else {
        currentRadarFrame = observedRadarFrames.length - 1;
      }

      displayRadarFrame(currentRadarFrame);
    }
  } catch (error) {
    console.error("Unable to refresh radar metadata:", error);

    notificationManager.addAlert({
      id: "radar-refresh-error",
      source: "RainViewer",
      createdBy: "Radar",
      title: "Radar data refresh unavailable",
      priority: "low",
      icon: "🔵",
    });
  } finally {
    radarMetadataRefreshInProgress = false;

    radarRefreshInProgress = false;

    updateRadarFreshnessDisplay();
  }
}

function startRadarMetadataRefresh() {
  if (radarMetadataRefreshTimer) {
    clearInterval(radarMetadataRefreshTimer);
  }

  radarMetadataRefreshTimer = setInterval(
    refreshRadarMetadata,
    RADAR_REFRESH_INTERVAL_MS,
  );

  console.log("Automatic radar refresh started.");
}

// Rendering
function displayRadarFrame(frameIndex) {
  if (!radarMap || radarFrames.length === 0 || !radarFrames[frameIndex]) {
    console.warn("[Radar] Unable to display frame:", frameIndex);

    console.trace("[Radar] Invalid frame caller");

    return;
  }

  const frame = radarFrames[frameIndex];

  const currentZoom = radarMap.getZoom();

  const isWideView = currentZoom <= 7;

  const radarTileUrl = frame.tileUrl
    ? frame.tileUrl
    : frame.host + frame.path + "/256/{z}/{x}/{y}/2/1_1.png";

  const newRadarLayer = L.tileLayer(radarTileUrl, {
    opacity: isWideView ? RADAR_OPACITY : 0,

    maxNativeZoom: frame.source === "HRRR" ? undefined : 7,
    maxZoom: 19,
    minZoom: MIN_MAP_ZOOM,

    noWrap: true,
    keepBuffer: 0,
    updateWhenZooming: false,
    updateWhenIdle: true,
    attribution: "RainViewer",
  });

  /*
   * In wide view, replace the layer immediately.
   * Do not wait for the fade animation.
   */
  if (isWideView) {
    if (weatherRadar && radarLayerGroup.hasLayer(weatherRadar)) {
      radarLayerGroup.removeLayer(weatherRadar);
    }

    if (
      previousWeatherRadar &&
      radarLayerGroup.hasLayer(previousWeatherRadar)
    ) {
      radarLayerGroup.removeLayer(previousWeatherRadar);

      previousWeatherRadar = null;
    }

    previousWeatherRadar = null;
    weatherRadar = newRadarLayer;

    weatherRadar.addTo(radarLayerGroup);
  } else {
    newRadarLayer.once("load", function () {
      previousWeatherRadar = weatherRadar;

      weatherRadar = newRadarLayer;

      fadeInRadarLayer(weatherRadar);

      if (previousWeatherRadar) {
        fadeOutRadarLayer(previousWeatherRadar);
      }
    });

    newRadarLayer.addTo(radarLayerGroup);
  }

  updateRadarTimestamp(frame);

  console.log("[Radar]", {
    frame: frameIndex + 1,

    zoom: currentZoom,

    mode: isWideView ? "STATIC" : "ANIMATED",

    tileSize: 256,
  });
}

function fadeInRadarLayer(layer) {
  let opacity = 0;

  const fadeStep = 16;
  const opacityStep = RADAR_OPACITY / (RADAR_FADE_DURATION / fadeStep);

  const fadeTimer = setInterval(() => {
    opacity += opacityStep;

    if (opacity >= RADAR_OPACITY) {
      opacity = RADAR_OPACITY;
      clearInterval(fadeTimer);
    }

    layer.setOpacity(opacity);
  }, fadeStep);
}

function fadeOutRadarLayer(layer) {
  let opacity = RADAR_OPACITY;

  const fadeStep = 16;
  const opacityStep = RADAR_OPACITY / (RADAR_FADE_DURATION / fadeStep);

  const fadeTimer = setInterval(() => {
    opacity -= opacityStep;

    if (opacity <= 0) {
      opacity = 0;
      clearInterval(fadeTimer);
    }

    layer.setOpacity(opacity);
  }, fadeStep);

  setTimeout(() => {
    if (radarLayerGroup.hasLayer(layer)) {
      radarLayerGroup.removeLayer(layer);
    }
  }, RADAR_LAYER_CLEANUP_DELAY);
}

// Animation

function startRadarAnimation() {
  if (radarAnimationTimer) {
    clearTimeout(radarAnimationTimer);
  }

  radarIsPlaying = true;

  /*
   * PAST and FORECAST retain the normal
   * linear playback behavior.
   */
  if (radarPlaybackMode !== RADAR_PLAYBACK_MODES.COMBINED) {
    function advanceRadarFrame() {
      currentRadarFrame++;

      if (currentRadarFrame >= radarFrames.length) {
        currentRadarFrame = 0;
      }

      displayRadarFrame(currentRadarFrame);

      const isNewestFrame = currentRadarFrame === radarFrames.length - 1;

      const nextDelay = isNewestFrame ? RADAR_END_PAUSE : RADAR_FRAME_DELAY;

      radarAnimationTimer = setTimeout(advanceRadarFrame, nextDelay);
    }

    radarAnimationTimer = setTimeout(advanceRadarFrame, RADAR_FRAME_DELAY);

    return;
  }

  /*
   * COMBINED playback:
   *
   * NOW
   * pause
   * oldest observed
   * play forward to NOW
   * pause
   * forecast
   * pause
   * repeat
   */

  const newestObservedIndex = observedRadarFrames.length - 1;

  const firstForecastIndex = observedRadarFrames.length;

  const lastFrameIndex = radarFrames.length - 1;

  function startCombinedCycle() {
    // Anchor the viewer on current conditions.
    currentRadarFrame = newestObservedIndex;

    displayRadarFrame(currentRadarFrame);

    radarAnimationTimer = setTimeout(startObservedPlayback, RADAR_NOW_PAUSE);
  }

  function startObservedPlayback() {
    // Rewind to oldest observed frame.
    currentRadarFrame = 0;

    displayRadarFrame(currentRadarFrame);

    radarAnimationTimer = setTimeout(advanceObservedFrame, RADAR_FRAME_DELAY);
  }

  function advanceObservedFrame() {
    currentRadarFrame++;

    displayRadarFrame(currentRadarFrame);

    if (currentRadarFrame >= newestObservedIndex) {
      /*
       * We've reached NOW again.
       * Hold here before forecast.
       */
      radarAnimationTimer = setTimeout(startForecastPlayback, RADAR_NOW_PAUSE);

      return;
    }

    radarAnimationTimer = setTimeout(advanceObservedFrame, RADAR_FRAME_DELAY);
  }

  function startForecastPlayback() {
    /*
     * If forecast data isn't available,
     * simply restart the cycle.
     */
    if (firstForecastIndex > lastFrameIndex) {
      radarAnimationTimer = setTimeout(
        startCombinedCycle,
        RADAR_FORECAST_END_PAUSE,
      );

      return;
    }

    currentRadarFrame = firstForecastIndex;

    displayRadarFrame(currentRadarFrame);

    radarAnimationTimer = setTimeout(advanceForecastFrame, RADAR_FRAME_DELAY);
  }

  function advanceForecastFrame() {
    currentRadarFrame++;

    /*
     * Forecast is complete.
     * Hold the endpoint, then return
     * directly to NOW.
     */
    if (currentRadarFrame > lastFrameIndex) {
      currentRadarFrame = lastFrameIndex;

      radarAnimationTimer = setTimeout(
        startCombinedCycle,
        RADAR_FORECAST_END_PAUSE,
      );

      return;
    }

    displayRadarFrame(currentRadarFrame);

    if (currentRadarFrame === lastFrameIndex) {
      radarAnimationTimer = setTimeout(
        startCombinedCycle,
        RADAR_FORECAST_END_PAUSE,
      );

      return;
    }

    radarAnimationTimer = setTimeout(advanceForecastFrame, RADAR_FRAME_DELAY);
  }

  /*
   * Begin every new COMBINED animation
   * from current observed conditions.
   */
  startCombinedCycle();
}

function stopRadarAnimation() {
  if (radarAnimationTimer) {
    clearTimeout(radarAnimationTimer);
  }

  radarIsPlaying = false;
}

// User Interface

function updateRadarTimestamp(frame) {
  const timestampDisplay = document.getElementById("radar-timestamp");

  if (!timestampDisplay) {
    console.error("[Radar] Timestamp element not found.");

    return;
  }

  if (!frame || typeof frame.time !== "number") {
    timestampDisplay.textContent = "Time Unavailable";

    console.error("[Radar] Invalid frame:", frame);

    return;
  }

  const timestamp = new Date(frame.time * 1000);

  const timeText = timestamp.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const newestObservedFrame =
    observedRadarFrames[observedRadarFrames.length - 1];

  const anchorTime = newestObservedFrame?.time;

  /*
   * Fallback if we don't yet have
   * an observed-frame anchor.
   */
  if (typeof anchorTime !== "number") {
    const frameLabel = frame.frameType === "FORECAST" ? "FORECAST" : "OBSERVED";

    timestampDisplay.innerHTML = `
                <span class="radar-time-primary">
                    <span class="radar-time-value">
                        ${timeText}
                    </span>
                    <span class="radar-time-layer">
                        ${frameLabel}
                    </span>
                </span>
            `;

    return;
  }

  const offsetMinutes = Math.round((frame.time - anchorTime) / 60);

  /*
   * Latest observed frame = NOW.
   */
  if (frame.frameType === "OBSERVED" && offsetMinutes === 0) {
    timestampDisplay.innerHTML = `
                <span class="radar-time-primary">
                    <span class="radar-time-value">
                        ${timeText}
                    </span>
                    <span class="radar-time-layer">
                        NOW
                    </span>
                </span>
            `;

    return;
  }

  /*
   * Historical observed radar.
   */
  if (frame.frameType === "OBSERVED") {
    const absoluteMinutes = Math.abs(offsetMinutes);

    timestampDisplay.innerHTML = `
                <span class="radar-time-primary">
                    <span class="radar-time-value">
                        ${timeText}
                    </span>
                    <span class="radar-time-layer">
                        OBSERVED
                    </span>
                </span>

                <span class="radar-time-offset">
                    -${formatRadarOffset(absoluteMinutes)}
                </span>
            `;

    return;
  }

  /*
   * Forecast radar.
   */
  timestampDisplay.innerHTML = `
            <span class="radar-time-primary">
                <span class="radar-time-value">
                    ${timeText}
                </span>
                <span class="radar-time-layer">
                    FORECAST
                </span>
            </span>

            <span class="radar-time-offset">
                +${formatRadarOffset(Math.max(0, offsetMinutes))}
            </span>
        `;
}

function formatRadarOffset(totalMinutes) {
  if (totalMinutes < 60) {
    return `${totalMinutes} MIN`;
  }

  const hours = Math.floor(totalMinutes / 60);

  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return hours === 1 ? "1 HR" : `${hours} HR`;
  }

  return `${hours} HR ${minutes} MIN`;
}

function initializeRadarControls() {
  const radarControls = document.getElementById("radar-controls");

  const toggleButton = document.getElementById("toggle-radar-controls");

  const previousButton = document.getElementById("radar-prev");

  const playButton = document.getElementById("radar-play");

  const nextButton = document.getElementById("radar-next");

  const modeSelect = document.getElementById("radar-mode-select");

  if (
    !radarControls ||
    !toggleButton ||
    !previousButton ||
    !playButton ||
    !nextButton ||
    !modeSelect
  ) {
    console.error("[Radar Controls] Required controls not found.");

    return;
  }

  /*
   * Prevent taps on either the toggle button
   * or radar controls from reaching the map.
   */
  L.DomEvent.disableClickPropagation(radarControls);

  L.DomEvent.disableScrollPropagation(radarControls);

  L.DomEvent.disableClickPropagation(toggleButton);

  L.DomEvent.disableScrollPropagation(toggleButton);

  toggleButton.addEventListener("click", function () {
    radarControlsVisibilityManager.toggle();
  });

  /*
   * Touching the expanded control group
   * restarts the driving-mode hide timer.
   */
  radarControls.addEventListener("pointerdown", function () {
    radarControlsVisibilityManager.handleInteraction();
  });

  modeSelect.addEventListener("change", function () {
    setRadarPlaybackMode(modeSelect.value);

    modeSelect.value = radarPlaybackMode;
  });

  previousButton.addEventListener("click", function () {
    if (radarFrames.length === 0) {
      return;
    }

    radarControlsVisibilityManager.handleInteraction();

    stopRadarAnimation();

    currentRadarFrame--;

    if (currentRadarFrame < 0) {
      currentRadarFrame = radarFrames.length - 1;
    }

    displayRadarFrame(currentRadarFrame);

    playButton.textContent = "▶";
  });

  playButton.addEventListener("click", function () {
    if (radarFrames.length === 0) {
      return;
    }

    radarControlsVisibilityManager.handleInteraction();

    if (radarIsPlaying) {
      stopRadarAnimation();

      playButton.textContent = "▶";
    } else {
      startRadarAnimation();

      playButton.textContent = "⏸";
    }
  });

  nextButton.addEventListener("click", function () {
    if (radarFrames.length === 0) {
      return;
    }

    radarControlsVisibilityManager.handleInteraction();

    stopRadarAnimation();

    currentRadarFrame++;

    if (currentRadarFrame >= radarFrames.length) {
      currentRadarFrame = 0;
    }

    displayRadarFrame(currentRadarFrame);

    playButton.textContent = "▶";
  });

  radarControlsVisibilityManager.setOperatingMode(operatingMode);
}

function handleRadarZoomLimit() {
  if (!radarMap) {
    return;
  }

  const currentZoom = radarMap.getZoom();

  if (currentZoom < MIN_ANIMATED_RADAR_ZOOM && radarIsPlaying) {
    radarWasPlayingBeforeZoomPause = true;
    radarPausedForZoom = true;

    stopRadarAnimation();

    const playButton = document.getElementById("radar-play");

    if (playButton) {
      playButton.textContent = "▶";
      playButton.title = "Radar paused at wide zoom";
    }

    console.log(`[Radar] Animation paused at zoom ${currentZoom}`);

    return;
  }

  if (currentZoom >= MIN_ANIMATED_RADAR_ZOOM && radarPausedForZoom) {
    radarPausedForZoom = false;

    const playButton = document.getElementById("radar-play");

    if (radarWasPlayingBeforeZoomPause) {
      startRadarAnimation();

      if (playButton) {
        playButton.textContent = "⏸";
        playButton.title = "Pause radar animation";
      }
    }

    radarWasPlayingBeforeZoomPause = false;

    console.log(`[Radar] Animation restored at zoom ${currentZoom}`);
  }
}

// ====================================
// Lightning Functions
// ====================================

async function initializeLightning() {
  console.log("Loading lightning...");

  lightningLayer = L.layerGroup().addTo(radarMap);

  layerControl.addOverlay(lightningLayer, "⚡️ Lightning");

  addTestLightningStrike();

  console.log("Lightning layer ready.");
}

function clearLightning() {
  lightningLayer.clearLayers();
}

function addTestLightningStrike() {
  console.log("Adding test lightning strike...");

  const testLatitude = 30.35;
  const testLongitude = -93.15;

  const lightningIcon = L.divIcon({
    className: "lightning-marker",
    html: '<span class="lightning-symbol">⚡️</span>',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });

  L.marker([testLatitude, testLongitude], { icon: lightningIcon })
    .addTo(lightningLayer)
    .bindPopup("Test Lightning Strike");
}

// ===================================
// NWS Warnings
// ===================================

async function fetchAllActiveNwsAlerts() {
  const alertsUrl = "https://api.weather.gov/alerts/active";

  console.log("[Sentinel] Requesting national active alerts:", alertsUrl);

  const response = await fetch(alertsUrl, {
    headers: {
      Accept: "application/geo+json",
    },

    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`NWS national alert request failed: ${response.status}`);
  }

  const alertData = await response.json();

  const features = Array.isArray(alertData.features) ? alertData.features : [];

  console.log("[Sentinel] National active alerts received:", features.length);

  return features;
}

async function testNationalNwsAlertRetrieval() {
  try {
    const features = await fetchAllActiveNwsAlerts();

    console.table(
      features.map((feature) => {
        const properties = feature.properties || {};

        return {
          event: properties.event,

          area: properties.areaDesc,

          severity: properties.severity,

          urgency: properties.urgency,

          hasGeometry: Boolean(feature.geometry),

          affectedZones: Array.isArray(properties.affectedZones)
            ? properties.affectedZones.length
            : 0,
        };
      }),
    );

    return features;
  } catch (error) {
    console.error("[Sentinel] National alert test failed:", error);

    return [];
  }
}

const NWS_ALERT_PRIORITY_RULES = {
  critical: [
    "tornado emergency",
    "tornado warning",
    "flash flood emergency",
    "extreme wind warning",
    "hurricane warning",
    "storm surge warning",
    "tsunami warning",
    "civil danger warning",
    "nuclear power plant warning",
    "radiological hazard warning",
    "hazardous materials warning",
    "evacuation immediate",
    "shelter in place warning",
  ],

  high: [
    "severe thunderstorm warning",
    "flash flood warning",
    "flood warning",
    "coastal flood warning",
    "lakeshore flood warning",
    "excessive heat warning",
    "extreme heat warning",
    "tropical storm warning",
    "typhoon warning",
    "blizzard warning",
    "ice storm warning",
    "winter storm warning",
    "snow squall warning",
    "dust storm warning",
    "high wind warning",
    "red flag warning",
    "fire warning",
    "special marine warning",
    "avalanche warning",
    "volcano warning",
    "law enforcement warning",
    "local area emergency",
    "911 telephone outage emergency",
  ],

  medium: [
    // Heat
    "heat advisory",
    "excessive heat watch",
    "extreme heat watch",

    // Severe weather watches
    "tornado watch",
    "severe thunderstorm watch",
    "flash flood watch",
    "flood watch",
    "hurricane watch",
    "tropical storm watch",
    "storm surge watch",
    "typhoon watch",

    // Winter weather
    "winter storm watch",
    "winter weather advisory",
    "freeze warning",
    "freeze watch",
    "frost advisory",
    "cold weather advisory",
    "extreme cold warning",
    "extreme cold watch",
    "wind chill warning",
    "wind chill watch",
    "wind chill advisory",
    "freezing rain advisory",
    "freezing fog advisory",

    // Wind and visibility
    "high wind watch",
    "wind advisory",
    "lake wind advisory",
    "dense fog advisory",
    "dense smoke advisory",
    "dust advisory",
    "ashfall advisory",

    // Flooding, coastal and beach
    "flood advisory",
    "urban and small stream flood advisory",
    "small stream flood advisory",
    "coastal flood advisory",
    "lakeshore flood advisory",
    "lakeshore flood watch",
    "high surf warning",
    "high surf advisory",
    "rip current statement",
    "beach hazards statement",

    // Fire and air quality
    "fire weather watch",
    "air quality alert",
    "air stagnation advisory",

    // Marine
    "small craft advisory",
    "hazardous seas warning",
    "hazardous seas watch",
    "gale warning",
    "gale watch",
    "storm warning",
    "storm watch",
    "hurricane force wind warning",
    "hurricane force wind watch",
    "heavy freezing spray warning",
    "heavy freezing spray watch",
    "low water advisory",
    "brisk wind advisory",
    "marine weather statement",

    // Avalanche
    "avalanche watch",
    "avalanche advisory",
  ],

  low: [
    "special weather statement",
    "significant weather advisory",
    "hazardous weather outlook",
    "hydrologic outlook",
    "short term forecast",
    "administrative message",
    "test message",
  ],
};

function normalizeNwsEventName(eventName) {
  return String(eventName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function initializeWarnings() {
  if (warningsLayer) {
    return;
  }

  console.log("Initializing NWS warning layer...");

  warningsLayer = L.layerGroup().addTo(radarMap);

  layerControl.addOverlay(warningsLayer, "🚨 NWS Alerts");

  warningsRefreshTimer = setInterval(loadNwsWarnings, 5 * 60 * 1000);

  console.log("NWS warning layer registered.");
}

function getNwsZoneId(zoneUrl) {
  if (!zoneUrl) {
    return null;
  }

  const urlParts = String(zoneUrl).split("/").filter(Boolean);

  return urlParts[urlParts.length - 1] || null;
}

function getNwsZoneType(zoneUrl) {
  if (!zoneUrl) {
    return "zone";
  }

  const urlParts = String(zoneUrl).split("/").filter(Boolean);

  const zonesIndex = urlParts.indexOf("zones");

  if (zonesIndex !== -1 && urlParts[zonesIndex + 1]) {
    return urlParts[zonesIndex + 1];
  }

  return "zone";
}

async function fetchNwsZoneGeometry(zoneUrl) {
  if (!zoneUrl) {
    return null;
  }

  if (nwsZoneGeometryCache.has(zoneUrl)) {
    return nwsZoneGeometryCache.get(zoneUrl);
  }

  if (nwsZoneRequestCache.has(zoneUrl)) {
    return nwsZoneRequestCache.get(zoneUrl);
  }

  const zoneRequest = (async function () {
    try {
      console.log("[Sentinel] Fetching NWS zone:", zoneUrl);

      const response = await fetch(zoneUrl, {
        headers: {
          Accept: "application/geo+json",
        },
        cache: "force-cache",
      });

      if (!response.ok) {
        throw new Error(`NWS zone request failed: ${response.status}`);
      }

      const zoneData = await response.json();

      if (!zoneData.geometry) {
        console.warn("[Sentinel] Zone has no geometry:", zoneUrl);

        return null;
      }

      nwsZoneGeometryCache.set(zoneUrl, zoneData);

      return zoneData;
    } catch (error) {
      console.error("[Sentinel] Unable to load zone geometry:", zoneUrl, error);

      return null;
    } finally {
      nwsZoneRequestCache.delete(zoneUrl);
    }
  })();

  nwsZoneRequestCache.set(zoneUrl, zoneRequest);

  return zoneRequest;
}

async function resolveAlertGeometryFeatures(feature) {
  if (feature?.geometry) {
    return [
      {
        type: "Feature",
        properties: feature.properties || {},
        geometry: feature.geometry,
      },
    ];
  }

  const properties = feature?.properties || {};

  const affectedZones = Array.isArray(properties.affectedZones)
    ? properties.affectedZones
    : [];

  if (affectedZones.length === 0) {
    return [];
  }

  const zoneResults = await Promise.all(
    affectedZones.map(fetchNwsZoneGeometry),
  );

  return zoneResults
    .filter((zoneData) => {
      return Boolean(zoneData?.geometry);
    })
    .map((zoneData) => {
      return {
        type: "Feature",
        properties: zoneData.properties || {},
        geometry: zoneData.geometry,
      };
    });
}

async function loadNwsWarnings() {
  if (currentLatitude === null || currentLongitude === null) {
    console.log("[Sentinel] Waiting for GPS before loading NWS alerts.");

    return;
  }

  if (!warningsLayer) {
    console.warn("[Sentinel] Warning layer is not initialized.");

    return;
  }

  try {
    const sentinelAlerts = await getNearbySentinelAlerts();

    warningsLayer.clearLayers();

    notificationManager.beginRefresh("NWS");

    let activeAlertCount = 0;
    let directPolygonCount = 0;
    let zoneBasedAlertCount = 0;
    let zonePolygonCount = 0;

    for (const sentinelAlert of sentinelAlerts) {
      const feature = sentinelAlert.feature;

      const geometryFeatures = sentinelAlert.geometryFeatures;

      const measurement = sentinelAlert.measurement;

      const directionData = sentinelAlert.direction;

      const properties = feature.properties || {};

      const eventName = properties.event || "Weather Alert";

      const priority = getAlertPriority(eventName, properties);

      const icon = getNwsAlertIcon(eventName);

      const alertId =
        feature.id ||
        properties.id ||
        ["nws", eventName, properties.sent, properties.areaDesc].join("-");

      const displayDirection = measurement.affectsCurrentLocation
        ? "Current Location"
        : directionData.relativeDirection;

      const relevanceScore = calculateSentinelRelevanceScore({
        priority,

        severity: properties.severity,

        urgency: properties.urgency,

        certainty: properties.certainty,

        distanceMiles: measurement.distanceMiles,

        direction: displayDirection,

        expires: properties.expires,

        affectsCurrentLocation: measurement.affectsCurrentLocation,
      });

      notificationManager.addAlert({
        id: alertId,

        source: "NWS",

        createdBy: "Sentinel",

        title: eventName,

        priority,

        geometryFeatures: geometryFeatures,

        capSeverity: properties.severity,

        urgency: properties.urgency,

        certainty: properties.certainty,

        distance: measurement.distanceMiles,

        direction: displayDirection,

        compassDirection: directionData.compassDirection,

        bearing: directionData.bearing,

        nearestLatitude: measurement.nearestLatitude,

        nearestLongitude: measurement.nearestLongitude,

        affectsCurrentLocation: measurement.affectsCurrentLocation,

        expires: properties.expires,

        relevanceScore,

        icon,
      });

      activeAlertCount++;

      if (feature.geometry) {
        directPolygonCount++;
      } else {
        zoneBasedAlertCount++;
      }

      geometryFeatures.forEach((geometryFeature) => {
        const alertLayer = L.geoJSON(geometryFeature, {
          style: function () {
            return getWarningStyle(eventName, properties);
          },

          onEachFeature: function (mappedFeature, layer) {
            const distanceText = measurement.affectsCurrentLocation
              ? "Current Location"
              : `${measurement.distanceMiles.toFixed(1)} miles`;

            layer.bindPopup(`
                                            <strong>
                                                ${icon} ${eventName}
                                            </strong>
                                            <br>

                                            ${properties.headline || ""}
                                            <br><br>

                                            <strong>Area:</strong>
                                            ${properties.areaDesc || "Unknown"}
                                            <br>

                                            <strong>Distance:</strong>
                                            ${distanceText}
                                            <br>

                                            <strong>Direction:</strong>
                                            ${displayDirection}
                                            <br>

                                            <strong>Bearing:</strong>
                                            ${
                                              directionData.bearing === null
                                                ? "Current Location"
                                                : `${directionData.bearing.toFixed(
                                                    1,
                                                  )}°`
                                            }
                                            <br>

                                            <strong>Severity:</strong>
                                            ${properties.severity || "Unknown"}
                                            <br>

                                            <strong>Urgency:</strong>
                                            ${properties.urgency || "Unknown"}
                                            <br>

                                            <strong>Expires:</strong>
                                            ${formatAlertTime(
                                              properties.expires,
                                            )}
                                        `);
          },
        });

        alertLayer.addTo(warningsLayer);

        if (!feature.geometry) {
          zonePolygonCount++;
        }
      });

      console.log("[Sentinel] Live alert added:", {
        event: eventName,

        area: properties.areaDesc,

        priority,

        distanceMiles: Number(measurement.distanceMiles.toFixed(1)),

        direction: displayDirection,

        compassDirection: directionData.compassDirection,

        bearing: directionData.bearing,

        affectsCurrentLocation: measurement.affectsCurrentLocation,

        geometryCount: geometryFeatures.length,
      });
    }

    notificationManager.endRefresh("NWS");

    console.log("[Sentinel] NWS refresh complete:", {
      alertsReturned: sentinelAlerts.length,

      activeAlerts: activeAlertCount,

      directAlertPolygons: directPolygonCount,

      zoneBasedAlerts: zoneBasedAlertCount,

      zonePolygonsDrawn: zonePolygonCount,

      cachedZones: nwsZoneGeometryCache.size,
    });
  } catch (error) {
    console.error("[Sentinel] Unable to load NWS alerts:", error);

    notificationManager.addAlert({
      id: "nws-refresh-error",

      source: "NWS-System",

      createdBy: "Sentinel",

      title: "NWS alert data unavailable",

      priority: "low",

      icon: "🔵",
    });

    updateAlertsPanel();
  }
}

function getAlertPriority(eventName, properties = {}) {
  const event = normalizeNwsEventName(eventName);

  for (const priority of ["critical", "high", "medium", "low"]) {
    const matchedRule = NWS_ALERT_PRIORITY_RULES[priority].some((rule) => {
      return event.includes(rule);
    });

    if (matchedRule) {
      return priority;
    }
  }

  /*
   * Generic product-name fallbacks ensure
   * newly introduced or uncommon NWS
   * products are still classified.
   */

  if (event.includes("emergency")) {
    return "critical";
  }

  if (event.includes("warning")) {
    return "high";
  }

  if (
    event.includes("watch") ||
    event.includes("advisory") ||
    event.includes("statement") ||
    event.includes("outlook") ||
    event.includes("alert")
  ) {
    return "medium";
  }

  /*
   * CAP metadata fallback for event names
   * that Sentinel does not yet recognize.
   */

  const severity = String(properties.severity || "").toLowerCase();

  const urgency = String(properties.urgency || "").toLowerCase();

  if (severity === "extreme" || urgency === "immediate") {
    return "critical";
  }

  if (severity === "severe") {
    return "high";
  }

  if (severity === "moderate" || urgency === "expected") {
    return "medium";
  }

  return "low";
}

function normalizeSentinelMetadataValue(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return normalized || "unknown";
}

function getAlertExpirationScore(expires) {
  if (!expires) {
    return 0;
  }

  const expirationTime = new Date(expires).getTime();

  if (!Number.isFinite(expirationTime)) {
    return 0;
  }

  const remainingMs = expirationTime - Date.now();

  if (remainingMs <= 0) {
    return -500;
  }

  const remainingMinutes = remainingMs / (60 * 1000);

  /*
   * Active alerts nearing expiration receive
   * a modest urgency boost. Long-duration
   * products receive only a small bonus.
   */
  if (remainingMinutes <= 30) {
    return SENTINEL_RELEVANCE_WEIGHTS.expiringSoon;
  }

  if (remainingMinutes <= 120) {
    return 30;
  }

  if (remainingMinutes >= 720) {
    return SENTINEL_RELEVANCE_WEIGHTS.longDuration;
  }

  return 0;
}

function getAlertDistanceScore(distanceMiles) {
  const distance = Number(distanceMiles);

  if (!Number.isFinite(distance)) {
    return 0;
  }

  if (distance <= 0) {
    return SENTINEL_RELEVANCE_WEIGHTS.currentLocation;
  }

  if (distance <= 10) {
    return 250;
  }

  if (distance <= 25) {
    return 200;
  }

  if (distance <= 50) {
    return 140;
  }

  if (distance <= 100) {
    return 80;
  }

  if (distance <= 150) {
    return 40;
  }

  if (distance <= SENTINEL_RADIUS_MILES) {
    return 10;
  }

  return -100;
}

function getAlertDirectionScore(direction) {
  const normalizedDirection = String(direction || "")
    .trim()
    .toLowerCase();

  if (normalizedDirection === "current location") {
    return SENTINEL_RELEVANCE_WEIGHTS.currentLocation;
  }

  if (normalizedDirection.includes("ahead")) {
    return SENTINEL_RELEVANCE_WEIGHTS.aheadOfTravel;
  }

  if (
    normalizedDirection.includes("left") ||
    normalizedDirection.includes("right")
  ) {
    return SENTINEL_RELEVANCE_WEIGHTS.nearRoute;
  }

  if (normalizedDirection.includes("behind")) {
    return SENTINEL_RELEVANCE_WEIGHTS.behindTravel;
  }

  return 0;
}

function calculateSentinelRelevanceScore({
  priority = "low",
  severity,
  urgency,
  certainty,
  distanceMiles,
  direction,
  expires,
  affectsCurrentLocation = false,
}) {
  const normalizedPriority = String(priority || "low").toLowerCase();

  const normalizedSeverity = normalizeSentinelMetadataValue(severity);

  const normalizedUrgency = normalizeSentinelMetadataValue(urgency);

  const normalizedCertainty = normalizeSentinelMetadataValue(certainty);

  let score = SENTINEL_RELEVANCE_WEIGHTS.basePriority[normalizedPriority] || 0;

  score += SENTINEL_RELEVANCE_WEIGHTS.severity[normalizedSeverity] || 0;

  score += SENTINEL_RELEVANCE_WEIGHTS.urgency[normalizedUrgency] || 0;

  score += SENTINEL_RELEVANCE_WEIGHTS.certainty[normalizedCertainty] || 0;

  score += getAlertDistanceScore(distanceMiles);

  score += getAlertDirectionScore(direction);

  score += getAlertExpirationScore(expires);

  if (affectsCurrentLocation) {
    score += SENTINEL_RELEVANCE_WEIGHTS.currentLocation;
  }

  return Math.round(score);
}

function getNwsAlertIcon(eventName) {
  const event = normalizeNwsEventName(eventName);

  if (event.includes("tornado")) {
    return "🌪️";
  }

  if (
    event.includes("hurricane") ||
    event.includes("tropical storm") ||
    event.includes("typhoon") ||
    event.includes("storm surge")
  ) {
    return "🌀";
  }

  if (event.includes("thunderstorm") || event.includes("lightning")) {
    return "⛈️";
  }

  if (
    event.includes("flash flood") ||
    event.includes("flood") ||
    event.includes("high surf") ||
    event.includes("rip current") ||
    event.includes("beach hazards")
  ) {
    return "🌊";
  }

  if (event.includes("heat") || event.includes("hot")) {
    return "🌡️";
  }

  if (
    event.includes("winter") ||
    event.includes("snow") ||
    event.includes("blizzard") ||
    event.includes("ice") ||
    event.includes("freeze") ||
    event.includes("frost") ||
    event.includes("cold") ||
    event.includes("wind chill")
  ) {
    return "❄️";
  }

  if (event.includes("wind") || event.includes("gale")) {
    return "💨";
  }

  if (
    event.includes("fire") ||
    event.includes("red flag") ||
    event.includes("smoke")
  ) {
    return "🔥";
  }

  if (
    event.includes("fog") ||
    event.includes("air quality") ||
    event.includes("air stagnation")
  ) {
    return "🌫️";
  }

  if (
    event.includes("marine") ||
    event.includes("small craft") ||
    event.includes("hazardous seas") ||
    event.includes("freezing spray")
  ) {
    return "⚓";
  }

  if (event.includes("dust") || event.includes("ashfall")) {
    return "🏜️";
  }

  if (event.includes("avalanche")) {
    return "🏔️";
  }

  return "⚠️";
}

function getWarningStyle(eventName, properties = {}) {
  const event = normalizeNwsEventName(eventName);

  const priority = getAlertPriority(eventName, properties);

  let borderColor;
  let fillColor;

  switch (priority) {
    case "critical":
      borderColor = "#ff3030";
      fillColor = "#ff3030";
      break;

    case "high":
      borderColor = "#ff9800";
      fillColor = "#ff9800";
      break;

    case "medium":
      borderColor = "#ffd400";
      fillColor = "#ffd400";
      break;

    default:
      borderColor = DEFAULT_SYSTEM_ACCENT;

      fillColor = DEFAULT_SYSTEM_ACCENT;
  }

  /*
   * Preserve familiar hazard colors for
   * several major weather families.
   */

  if (event.includes("tornado")) {
    borderColor = "#ff0000";
    fillColor = "#ff0000";
  } else if (
    event.includes("hurricane") ||
    event.includes("tropical storm") ||
    event.includes("storm surge")
  ) {
    borderColor = "#ff00ff";
    fillColor = "#ff00ff";
  } else if (event.includes("flash flood")) {
    borderColor = "#00ff00";
    fillColor = "#00ff00";
  } else if (event.includes("heat")) {
    borderColor = "#ff5a1f";
    fillColor = "#ff5a1f";
  } else if (
    event.includes("winter") ||
    event.includes("snow") ||
    event.includes("ice") ||
    event.includes("freeze") ||
    event.includes("cold")
  ) {
    borderColor = "#55cfff";
    fillColor = "#55cfff";
  }

  return {
    color: borderColor,
    weight: priority === "critical" ? 4 : 3,
    opacity: 0.95,
    fillColor,
    fillOpacity: priority === "low" ? 0.18 : 0.35,
  };
}

function zoomToGeometryFeatures(geometryFeatures) {
  if (
    !radarMap ||
    !Array.isArray(geometryFeatures) ||
    geometryFeatures.length === 0
  ) {
    return;
  }

  if (sentinelReturnTimer) {
    clearTimeout(sentinelReturnTimer);

    sentinelReturnTimer = null;
  }

  const geometryLayer = L.geoJSON(geometryFeatures);

  const bounds = geometryLayer.getBounds();

  if (!bounds.isValid()) {
    console.warn("[Sentinel] Invalid alert bounds.");

    return;
  }

  mapZoomInspectionActive = true;

  const mapPanelElement = document.getElementById("map-panel");

  const isFullscreen =
    mapPanelElement?.classList.contains("fullscreen-map") === true;

  const isMobilePortrait = window.matchMedia(
    "(max-width: 768px) and (orientation: portrait)",
  ).matches;

  const isMobileLandscape = window.matchMedia(
    "(max-width: 900px) and (orientation: landscape)",
  ).matches;

  let accuracyCircleWasVisible = false;

  if (accuracyCircle && radarMap.hasLayer(accuracyCircle)) {
    accuracyCircleWasVisible = true;

    radarMap.removeLayer(accuracyCircle);
  }

  function restoreAccuracyCircle() {
    if (!accuracyCircleWasVisible || !accuracyCircle) {
      return;
    }

    if (!radarMap.hasLayer(accuracyCircle)) {
      accuracyCircle.addTo(radarMap);
    }

    if (currentLatitude !== null && currentLongitude !== null) {
      accuracyCircle.setLatLng([currentLatitude, currentLongitude]);
    }

    accuracyCircle.bringToFront();
  }

  function restoreMapOrientation() {
    if (operatingMode === OPERATING_MODES.DRIVING) {
      if (
        currentHeading !== null &&
        typeof radarMap.setBearing === "function"
      ) {
        const mapBearing = convertHeadingToMapBearing(currentHeading);

        const visualMapBearing = (360 - mapBearing) % 360;

        radarMap.setBearing(visualMapBearing);
      }

      if (currentHeading !== null) {
        applyMapLookAhead();
      }
    } else if (typeof radarMap.setBearing === "function") {
      radarMap.setBearing(0);
    }

    restoreAccuracyCircle();

    mapZoomInspectionActive = false;
  }

  function flyBackToVehicle() {
    if (currentLatitude === null || currentLongitude === null) {
      restoreAccuracyCircle();

      mapZoomInspectionActive = false;

      return;
    }

    const returnZoom =
      operatingMode === OPERATING_MODES.DRIVING
        ? mapZoomMode === MAP_ZOOM_MODES.MANUAL && manualMapZoom !== null
          ? manualMapZoom
          : navigationIntelligenceManager.targetZoom
        : PARKED_MAP_ZOOM;

    radarMap.flyTo([currentLatitude, currentLongitude], returnZoom, {
      animate: true,
      duration: isMobilePortrait ? 0.8 : 1.1,
    });

    setTimeout(restoreMapOrientation, isMobilePortrait ? 850 : 1150);
  }

  function beginReturnSequence() {
    const returnSearchZoom = Math.max(MIN_MAP_ZOOM, radarMap.getZoom() - 3);

    /*
     * Return stage 1:
     * Pull back while remaining centered on
     * the alert area.
     */
    radarMap.flyTo(radarMap.getCenter(), returnSearchZoom, {
      animate: true,
      duration: isMobilePortrait ? 0.6 : 0.7,
    });

    /*
     * Return stage 2:
     * After the pullback completes, fly back
     * to the vehicle and restore its zoom.
     */
    setTimeout(flyBackToVehicle, isMobilePortrait ? 650 : 750);
  }

  function beginAlertInspection() {
    /*
     * Scrolling or rotating the device can
     * change the map dimensions. Recalculate
     * before positioning the alert.
     */
    radarMap.invalidateSize({
      animate: false,
    });

    /*
     * Portrait:
     * Center the full alert immediately.
     * Avoid competing page and map animations.
     */
    if (isMobilePortrait) {
      radarMap.fitBounds(bounds, {
        paddingTopLeft: [20, 20],

        paddingBottomRight: [20, 70],

        animate: false,
        maxZoom: 10,
      });

      sentinelReturnTimer = setTimeout(() => {
        beginReturnSequence();

        sentinelReturnTimer = null;
      }, SENTINEL_ALERT_INSPECTION_MS);

      return;
    }

    /*
     * Landscape and desktop:
     * Preserve the cinematic two-stage
     * inspection sequence.
     */
    const outboundSearchZoom = Math.max(MIN_MAP_ZOOM, radarMap.getZoom() - 3);

    radarMap.flyTo(radarMap.getCenter(), outboundSearchZoom, {
      animate: true,
      duration: 0.7,
    });

    setTimeout(() => {
      radarMap.flyToBounds(bounds, {
        padding: isMobileLandscape ? [24, 24] : [40, 40],

        animate: true,
        duration: isMobileLandscape ? 0.9 : 1.1,

        maxZoom: isMobileLandscape ? 10 : 11,
      });

      sentinelReturnTimer = setTimeout(() => {
        beginReturnSequence();

        sentinelReturnTimer = null;
      }, 1150 + SENTINEL_ALERT_INSPECTION_MS);
    }, 750);
  }

  /*
   * In tile view, bring the map into view
   * before starting Sentinel inspection.
   */
  if (
    !isFullscreen &&
    mapPanelElement &&
    (isMobilePortrait || isMobileLandscape)
  ) {
    mapPanelElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    setTimeout(beginAlertInspection, isMobilePortrait ? 700 : 500);

    return;
  }

  beginAlertInspection();
}

function formatAlertTime(timeString) {
  if (!timeString) {
    return "Unknown";
  }

  const alertTime = new Date(timeString);

  if (Number.isNaN(alertTime.getTime())) {
    return "Unknown";
  }

  return alertTime.toLocaleString();
}

const expandMapButton = document.getElementById("expand-map-btn");

const mapPanel = document.getElementById("map-panel");

const fullscreenMapMenuButton = document.getElementById(
  "fullscreen-map-menu-btn",
);

fullscreenMapMenuButton?.addEventListener("click", function () {
  const mapControls = document.getElementById("map-controls");

  mapControls?.classList.toggle("map-controls-hidden");
});

expandMapButton.addEventListener("click", function () {
  const isFullscreen = mapPanel.classList.toggle("fullscreen-map");

  document.body.classList.toggle("map-open", isFullscreen);

  const mapControls = document.getElementById("map-controls");

  mapControls?.classList.toggle("map-controls-hidden", isFullscreen);

  expandMapButton.setAttribute(
    "aria-label",
    isFullscreen ? "Close full screen map" : "Expand map",
  );

  expandMapButton.title = isFullscreen ? "Close full screen map" : "Expand map";

  setTimeout(function () {
    radarMap.invalidateSize();
    updateMapZoomDisplay();
  }, 100);
});

// ===================================
// Application Start Up
// ===================================

updateClock();
setInterval(updateClock, 1000);

updateAlertsPanel();

requestWeatherLocation();

initializeMap();

initializeWarnings();

initializeWeatherRadar();

initializeRadarControls();

initializeLightning();

initializeAircraftLayer();

startRadarFreshnessMonitor();

const exportDiagnosticsButton = document.getElementById("export-log-btn");

exportDiagnosticsButton?.addEventListener("click", exportDiagnosticLog);

// navigationIntelligenceManager.update();

// ==================================
// Developer Tests
// ==================================

/*
notificationManager.addAlert({
    id: "housekeeping-test",
    source: "TEST",
    title: "Housekeeping Test Alert",
    priority: "medium",
    icon: "🚨"
});


currentSpeedMph = 3;
updateOperatingMode();

console.log({
    appProfile,
    operatingMode
});

setTimeout(function () {
    flashSystemAccent("#ff3030");
}, 2000);

*/
