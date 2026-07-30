

// =============================
// Constants
// =============================

const APP_PROFILES = {
    VEHICLE: "VEHICLE",
    MOBILE: "MOBILE"
}

const OPERATING_MODES = {
    PARKED: "PARKED",
    WALKING: "WALKING",
    DRIVING: "DRIVING"
};

const DEFAULT_LATITUDE = 30.3027;
const DEFAULT_LONGITUDE = -93.1907;
const DEFAULT_MAP_ZOOM = 9;
const PARKED_MAP_ZOOM = 17;
const HEADING_SAMPLE_WINDOW_MS = 5000;
const MIN_HEADING_SPEED_MPH = 3;

const FOLLOW_SPEED_MPH = 8;
const SPEED_AVERAGE_DURATION_MS = 30 * 1000

const MAP_LOOK_AHEAD_RATIO = 0.22;

const RADAR_OPACITY = 0.6;
const RADAR_FRAME_DELAY = 2000;
const RADAR_END_PAUSE = 4000;
const RADAR_FRESH_AGE_MS = 8 * 60 * 1000;
const RADAR_AGING_AGE_MS = 15 * 60 * 1000;
const RADAR_STALE_AGE_MS = 25 * 60 * 1000;

const RADAR_STATUS_UPDATE_INTERVAL_MS =
    30 * 1000;

const RADAR_FADE_DURATION = 350
const RADAR_LAYER_CLEANUP_DELAY = 450;
const MIN_MAP_ZOOM = 5;
const MIN_ANIMATED_RADAR_ZOOM = 8;
const RADAR_REFRESH_INTERVAL_MS =
    5 * 60 * 1000;


const SENTINEL_RADIUS_MILES = 250;

const DEFAULT_SYSTEM_ACCENT = "#4fd5ff";
const ALERT_FLASH_DURATION = 3000;


// =============================
// Global Variables
// =============================

let appProfile = APP_PROFILES.VEHICLE;
let operatingMode = OPERATING_MODES.PARKED;

let currentLatitude = null;
let currentLongitude = null;
let currentHeading = null;
let currentSpeedMph = 0;

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
let warningsLayer;
let layerControl;
let radarFrames = [];
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

let tempestSocket;
let tempestReconnectTimer;

/// =============================
// Operating Mode Manager
// =============================

function determineOperatingMode() {
    if (currentSpeedMph >= FOLLOW_SPEED_MPH) {
        return OPERATING_MODES.DRIVING;
    }

    if (
        appProfile === APP_PROFILES.MOBILE &&
        currentSpeedMph >= 2
    ) {
        return OPERATING_MODES.WALKING;
    }

    return OPERATING_MODES.PARKED;
}

function updateOperatingMode() {
    const previousOperatingMode =
        operatingMode;

    const newOperatingMode =
        determineOperatingMode();

    if (newOperatingMode === operatingMode) {
        return;
    }

    operatingMode = newOperatingMode;

    console.log(
        "Operating mode changed:",
        previousOperatingMode,
        "->",
        operatingMode
    );

    diagnosticLog("Operating Mode", {
        event: "Operating mode changed",
        previousMode:
            previousOperatingMode,
        newMode:
            operatingMode,
        currentSpeedMph,
        averageSpeedMph:
            navigationIntelligenceManager
                .averageSpeedMph
    });

    updateMovementIcon();

    if (
        operatingMode ===
        OPERATING_MODES.PARKED
    ) {
        applyParkedMapState();
    } else {
        updateNavigationDisplay();
    }

    updateSystemStatus();
}


// =============================
// Utility Functions
// =============================

function calculateDistanceMiles(
    latitude1,
    longitude1,
    latitude2,
    longitude2
) {
    const earthRadiusMiles = 3958.8;

    const latitudeDifference =
        degreesToRadians(latitude2 - latitude1);

    const longitudeDifference =
        degreesToRadians(longitude2 - longitude1);

    const startLatitude =
        degreesToRadians(latitude1);

    const endLatitude =
        degreesToRadians(latitude2);

    const a =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(startLatitude) *
        Math.cos(endLatitude) *
        Math.sin(longitudeDifference / 2) ** 2;

    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return earthRadiusMiles * c;
}

function calculateBearing(
    latitude1,
    longitude1,
    latitude2,
    longitude2
) {
    const startLatitude =
        degreesToRadians(latitude1);

    const endLatitude =
        degreesToRadians(latitude2);

    const longitudeDifference =
        degreesToRadians(longitude2 - longitude1);

    const y =
        Math.sin(longitudeDifference) *
        Math.cos(endLatitude);

    const x =
        Math.cos(startLatitude) *
        Math.sin(endLatitude) -
        Math.sin(startLatitude) *
        Math.cos(endLatitude) *
        Math.cos(longitudeDifference);

    const bearing =
        Math.atan2(y, x) *
        (180 / Math.PI);

    return (bearing + 360) % 360;
}

function calculateRelativeAngle(
    vehicleHeading,
    targetBearing
) {
    return (
        (targetBearing - vehicleHeading + 540) % 360
    ) - 180;
}

function classifyRelativeDirection(
    vehicleHeading,
    targetBearing
) {
    if (vehicleHeading === null) {
        return "Direction Unknown";
    }

    const relativeAngle =
        calculateRelativeAngle(
            vehicleHeading,
            targetBearing
        );

    if (
        relativeAngle >= -45 &&
        relativeAngle <= 45
    ) {
        return "Ahead";
    }

    if (
        relativeAngle > 45 &&
        relativeAngle < 135
    ) {
        return "Right";
    }

    if (
        relativeAngle < -45 &&
        relativeAngle > -135
    ) {
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
        "NNW"
    ];

    const index =
        Math.round(bearing / 22.5) % 16;

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
    if (
        ageMs === null ||
        !Number.isFinite(ageMs) ||
        ageMs < 0
    ) {
        return "Unknown";
    }

    const totalSeconds =
        Math.floor(ageMs / 1000);

    if (totalSeconds < 60) {
        return "Less than 1 min ago";
    }

    const totalMinutes =
        Math.floor(totalSeconds / 60);

    if (totalMinutes < 60) {
        return `${totalMinutes} min ago`;
    }

    const totalHours =
        Math.floor(totalMinutes / 60);

    const remainingMinutes =
        totalMinutes % 60;

    if (remainingMinutes === 0) {
        return `${totalHours} hr ago`;
    }

    return (
        `${totalHours} hr ` +
        `${remainingMinutes} min ago`
    );
}

function formatRadarCheckAge(ageMs) {
    if (
        ageMs === null ||
        !Number.isFinite(ageMs) ||
        ageMs < 0
    ) {
        return "not yet checked";
    }

    const totalSeconds =
        Math.floor(ageMs / 1000);

    if (totalSeconds < 5) {
        return "just now";
    }

    if (totalSeconds < 60) {
        return `${totalSeconds} sec ago`;
    }

    const totalMinutes =
        Math.floor(totalSeconds / 60);

    if (totalMinutes === 1) {
        return "1 min ago";
    }

    return `${totalMinutes} min ago`;
}

function updateRadarFreshnessDisplay() {
    const radarFreshnessElement =
        document.getElementById(
            "radar-freshness"
        );

    if (!radarFreshnessElement) {
        return;
    }

    radarFreshnessElement.classList.remove(
        "radar-fresh",
        "radar-aging",
        "radar-stale",
        "radar-unavailable",
        "radar-refreshing"
    );

    if (radarRefreshInProgress) {
        radarFreshnessElement.innerHTML =
            `
                <span class="radar-freshness-primary">
                    Synchronizing radar...
                </span>
                <span class="radar-freshness-secondary">
                    Checking for new imagery
                </span>
            `;

        radarFreshnessElement.classList.add(
            "radar-refreshing"
        );

        return;
    }

    const checkAgeMs =
        lastRadarRefreshTime === null
            ? null
            : Date.now() -
                lastRadarRefreshTime;

    const formattedCheckAge =
        formatRadarCheckAge(
            checkAgeMs
        );

    if (lastRadarDataTimestamp === null) {
        radarFreshnessElement.innerHTML =
            `
                <span class="radar-freshness-primary">
                    Radar data unavailable
                </span>
                <span class="radar-freshness-secondary">
                    Last checked ${formattedCheckAge}
                </span>
            `;

        radarFreshnessElement.classList.add(
            "radar-unavailable"
        );

        return;
    }

    const radarAgeMs =
        Date.now() -
        lastRadarDataTimestamp;

    const formattedRadarAge =
        formatRadarAge(
            radarAgeMs
        );

    let primaryText =
        `Radar updated ${formattedRadarAge}`;

    let statusClass =
        "radar-fresh";

    if (
        radarAgeMs >=
        RADAR_STALE_AGE_MS
    ) {
        primaryText =
            `Radar unavailable — ${formattedRadarAge}`;

        statusClass =
            "radar-unavailable";
    } else if (
        radarAgeMs >=
        RADAR_AGING_AGE_MS
    ) {
        primaryText =
            `Radar stale — ${formattedRadarAge}`;

        statusClass =
            "radar-stale";
    } else if (
        radarAgeMs >=
        RADAR_FRESH_AGE_MS
    ) {
        primaryText =
            `Radar aging — ${formattedRadarAge}`;

        statusClass =
            "radar-aging";
    }

    radarFreshnessElement.innerHTML =
        `
            <span class="radar-freshness-primary">
                ${primaryText}
            </span>
            <span class="radar-freshness-secondary">
                Last checked ${formattedCheckAge}
            </span>
        `;

    radarFreshnessElement.classList.add(
        statusClass
    );
}

function startRadarFreshnessMonitor() {
    if (radarStatusTimer !== null) {
        clearInterval(
            radarStatusTimer
        );
    }

    updateRadarFreshnessDisplay();

    radarStatusTimer = setInterval(
        updateRadarFreshnessDisplay,
        RADAR_STATUS_UPDATE_INTERVAL_MS
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
            timestamp: now
        });

        this.speedSamples =
            this.speedSamples.filter(sample => {
                return (
                    now - sample.timestamp <=
                    this.sampleWindowMs
                );
            });

        const totalSpeed =
            this.speedSamples.reduce(
                (sum, sample) => {
                    return sum + sample.speed;
                },
                0
            );

        this.averageSpeedMph =
            this.speedSamples.length > 0
                ? totalSpeed /
                  this.speedSamples.length
                : speedMph;

        this.targetZoom =
            getDrivingZoom(
                this.averageSpeedMph
            );

        this.mode = determineOperatingMode();

        console.log("[Navigation]", {
            currentSpeedMph:
                Number(speedMph.toFixed(1)),

            averageSpeedMph:
                Number(
                    this.averageSpeedMph.toFixed(1)
                ),

            targetZoom:
                this.targetZoom,

            sampleCount:
                this.speedSamples.length,

            mode:
                this.mode
        });
    },

updateHeading(rawHeading, speedMph) {
    if (
        rawHeading == null ||
        speedMph < MIN_HEADING_SPEED_MPH
    ) {
        return this.smoothedHeading;
    }

    const now = Date.now();

    this.headingSamples.push({
        heading: rawHeading,
        timestamp: now
    });

    this.headingSamples =
        this.headingSamples.filter(sample => {
            return (
                now - sample.timestamp <=
                this.headingSampleWindowMs
            );
        });

    let sineTotal = 0;
    let cosineTotal = 0;

    this.headingSamples.forEach(sample => {
        const radians =
            sample.heading * Math.PI / 180;

        sineTotal += Math.sin(radians);
        cosineTotal += Math.cos(radians);
    });

    const averageRadians =
        Math.atan2(
            sineTotal / this.headingSamples.length,
            cosineTotal / this.headingSamples.length
        );

    let averageDegrees =
        averageRadians * 180 / Math.PI;

    if (averageDegrees < 0) {
        averageDegrees += 360;
    }

    this.smoothedHeading = averageDegrees;

    return this.smoothedHeading;
}
}

// =============================
// Map Marker Icons
// =============================

const stationaryLocationIcon = L.divIcon({
    className: "overwatch-location-icon",
    html: `<div class="stationary-marker"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

const vehicleLocationIcon = L.divIcon({
    className: "overwatch-vehicle-icon",
    html: `<div class="vehicle-marker">▲</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

const walkingLocationIcon = L.divIcon({
    className: "overwatch-walking-icon",
    html: `<div class="walking-marker">🚶🏻‍♂️</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
});

// =============================
// Diagnostics Logger
// =============================

const DIAGNOSTIC_STORAGE_KEY =
    "overwatch-diagnostic-log";

const MAX_DIAGNOSTIC_LOG_ENTRIES = 5000;

function loadDiagnosticLogEntries() {
    try {
        const savedLog =
            localStorage.getItem(
                DIAGNOSTIC_STORAGE_KEY
            );

        if (!savedLog) {
            return [];
        }

        const parsedLog = JSON.parse(savedLog);

        return Array.isArray(parsedLog)
            ? parsedLog
            : [];
    } catch (error) {
        console.error(
            "Unable to restore diagnostic log:",
            error
        );

        return [];
    }
}

const diagnosticLogEntries =
    loadDiagnosticLogEntries();

function diagnosticLog(category, data = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        category,
        data
    };

    diagnosticLogEntries.push(entry);

    if (
        diagnosticLogEntries.length >
        MAX_DIAGNOSTIC_LOG_ENTRIES
    ) {
        diagnosticLogEntries.shift();
    }

    try {
        localStorage.setItem(
            DIAGNOSTIC_STORAGE_KEY,
            JSON.stringify(
                diagnosticLogEntries
            )
        );
    } catch (error) {
        console.error(
            "Unable to save diagnostic log:"
        );
    }

    console.log(`[${category}]`, data);
}

function exportDiagnosticLog() {
    diagnosticLog("Diagnostics", {
        event: "Log exported",
        entryCount: diagnosticLogEntries.length
    });

    const logData = {
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        entries: diagnosticLogEntries
    };

    const blob = new Blob(
        [JSON.stringify(logData, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");

    const timestamp = new Date()
        .toISOString()
        .replaceAll(":", "-")
        .replaceAll(".", "-");

    downloadLink.href = url;
    downloadLink.download =
        `overwatch-diagnostics-${timestamp}.json`;

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
        this.alerts.forEach(alert => {
            if (alert.source === source) {
                alert._syncSeen = false;
            }
        });
    },

    endRefresh(source) {
        this.alerts = this.alerts.filter(alert => {
            return (
                alert.source !== source ||
                alert._syncSeen
            );
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
            existing => existing.id === alert.id
        );

        if (existingAlert) {
            Object.assign(existingAlert, alert);
            existingAlert._syncSeen = true;
        } else {
            alert._syncSeen = true;
            this.alerts.push(alert);

            console.log(
                "🚨 New Alert:",
                alert.title || alert.event
            );

            if (initializedAlertSources.has(alert.source)) {
            const alertColor =
                this.getAlertColor(alert.priority);

            flashSystemAccent(alertColor);
        }
    }

        

        updateAlertsPanel();
    },  

    getAlerts() {
        return this.alerts;
    }
};

let alertFlashTimer = null;


function flashSystemAccent(alertColor) {
    console.log("FRAME FLASH:", alertColor);

    const root = document.documentElement;

    root.style.setProperty(
        "--system-accent",
        alertColor
    );

    if (systemAccentFlashTimer) {
        clearTimeout(systemAccentFlashTimer);
    }

    systemAccentFlashTimer = setTimeout(() => {
        root.style.setProperty(
            "--system-accent",
            DEFAULT_SYSTEM_ACCENT
        );

        systemAccentFlashTimer = null;
    }, ALERT_FLASH_DURATION);
}

function getAlertColor(priority) {
    const alertColors = {
        critical: "#ff3030",
        high: "#ff9800",
        medium: "#ffd400",
        low: DEFAULT_SYSTEM_ACCENT
    };

    return (
        alertColors[priority] ||
        DEFAULT_SYSTEM_ACCENT
    );
}

function updateAlertsPanel() {
    
    const alertsHeading =
        document.getElementById("alerts-heading");

    const alertsPanel =
        document.getElementById("alerts-panel");

    const alertsStatus =
        document.getElementById("alerts-status");

    if (!alertsPanel || 
        !alertsHeading ||
        !alertsStatus
    ) {
        return;
    }

    const alerts =
        notificationManager.getAlerts();

    alertsPanel.classList.remove(
        "alert-clear",
        "alert-medium",
        "alert-high",
        "alert-critical"
    );

    alertsHeading.classList.remove(
        "alert-clear",
        "alert-medium",
        "alert-high",
        "alert-critical"
    );

    alertsStatus.classList.remove(
        "alert-clear",
        "alert-medium",
        "alert-high",
        "alert-critical"
    );

    if (alerts.length === 0) {
        alertsPanel.classList.add("alert-clear");
        alertsHeading.classList.add("alert-clear");
        alertsStatus.classList.add("alert-clear");

        alertsStatus.textContent = "🟢 All Clear";
        return;
    }

    const priorityOrder = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1
    };

    const highestAlert = [...alerts].sort(
        function (alertA, alertB) {
            const priorityA =
                alertA.priority ||
                alertA.severity ||
                "low";

            const priorityB =
                alertB.priority ||
                alertB.severity ||
                "low";

            return (
                priorityOrder[priorityB] -
                priorityOrder[priorityA]
            );
        }
    )[0];

    const alertPriority =
        highestAlert.priority ||
        highestAlert.severity ||
        "low";

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

    const alertIcon =
        highestAlert.icon || "🚨";

    const alertTitle =
        highestAlert.title ||
        highestAlert.event ||
        "Active Alert";

    let alertDetails = "";

    if (typeof highestAlert.distance === "number") {
        alertDetails +=
            ` — ${highestAlert.distance.toFixed(1)} miles`;
    }

    if (highestAlert.direction) {
        alertDetails +=
            ` ${highestAlert.direction}`;
    }

    alertsStatus.textContent =
        `${alertIcon} ${alertTitle}${alertDetails}`;
}

// =============================
// Navigation Functions
// =============================

function applyParkedMapState() {
    if (
        !radarMap ||
        currentLatitude === null ||
        currentLongitude === null
    ) {
        return;
    }

    const previousBearing =
        radarMap.getBearing?.() ?? null;

    const previousZoom =
        radarMap.getZoom?.() ?? null;

    diagnosticLog("Navigation Command", {
        event: "Applying parked map state",
        previousBearing,
        targetBearing: 0,
        previousZoom,
        targetZoom: PARKED_MAP_ZOOM
    });

    if (
        typeof radarMap.setBearing ===
        "function"
    ) {
        radarMap.setBearing(0);
    }

    /*
     * Recenter on the vehicle to remove the
     * driving look-ahead offset, then apply
     * the parked zoom level.
     */
    radarMap.setView(
        [
            currentLatitude,
            currentLongitude
        ],
        PARKED_MAP_ZOOM,
        {
            animate: false
        }
    );

    diagnosticLog("Navigation Command", {
        event: "Parked map state applied",
        actualBearing:
            radarMap.getBearing?.() ?? null,
        actualZoom:
            radarMap.getZoom?.() ?? null
    });
}

function updateMovementIcon() {
    if (!locationMarker) {
        return;
    }

    let newIcon;

    if (operatingMode === OPERATING_MODES.DRIVING) {
        newIcon = vehicleLocationIcon;
    } else if (
        operatingMode === OPERATING_MODES.WALKING
    ) {
        newIcon = walkingLocationIcon;
    } else {
        newIcon = stationaryLocationIcon;
    }

    if (locationMarker.options.icon !== newIcon) {
        locationMarker.setIcon(newIcon);
    }

    const markerElement =
        locationMarker.getElement();

    if (!markerElement) {
        return;
    }

    const vehicleMarker =
        markerElement.querySelector(
            ".vehicle-marker"
        );

    if (vehicleMarker) {
        vehicleMarker.style.transform =
            "rotate(0deg)";
    }
}

function applyMapLookAhead() {
    if (
        !radarMap ||
        operatingMode !==
            OPERATING_MODES.DRIVING
    ) {
        return;
    }

    const mapContainer =
        radarMap.getContainer();

    const lookAheadPixels =
        mapContainer.clientHeight *
        MAP_LOOK_AHEAD_RATIO;

    /*
     * The map is rotated so the vehicle heading
     * points toward the top of the display.
     *
     * Panning upward moves the map center ahead
     * of the vehicle, leaving the vehicle marker
     * below center.
     */
    radarMap.panBy(
        [0, -lookAheadPixels],
        {
            animate: false
        }
    );
}

function updateNavigationDisplay() {
    if (
        !radarMap ||
        currentLatitude === null ||
        currentLongitude === null
    ) {
        return;
    }

    if (
        operatingMode !==
        OPERATING_MODES.DRIVING
    ) {
        return;
    }

    const drivingZoom =
        navigationIntelligenceManager
            .targetZoom;

    if (
        currentHeading !== null &&
        typeof radarMap.setBearing ===
            "function"
    ) {
        const mapBearing =
            convertHeadingToMapBearing(
                currentHeading
        );

        const visualMapBearing =
            (360 - mapBearing) % 360;

        radarMap.setBearing(
            visualMapBearing
        );
    }

    radarMap.setView(
        [
            currentLatitude,
            currentLongitude
        ],
        drivingZoom,
        {
            animate: false
        }
    );

    if (currentHeading !== null) {
        applyMapLookAhead();
    }
}


// =============================
// Clock Functions
// =============================

function updateClock() {
    const clockElement =
        document.getElementById("clock");

    if (!clockElement) {
        return;
    }

    const now = new Date();

    clockElement.textContent =
        now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        });

    clockElement.dateTime = now.toISOString();
}
// =============================
// GPS Functions
// =============================

function updateSystemStatus() {
    const systemStatus =
        document.getElementById("system-status-text");

    if (!systemStatus) {
        return;
    }

    const headingText =
        currentHeading === null
            ? "Heading Unavailable"
            : `${Math.round(currentHeading)}° ` +
              `${bearingToCompass(currentHeading)}`;

    const movementText =
        currentSpeedMph < 2
            ? "Stopped"
            : `${Math.round(currentSpeedMph)} MPH`;

    systemStatus.textContent =
        `GPS ONLINE • ${movementText} • ${headingText}`;
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
        99: "Severe Thunderstorms with Hail"
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

        document.getElementById("weather-temperature").textContent = `${Math.round(current.temperature_2m)}°F`;

        document.getElementById("weather-condition").textContent = getWeatherDescription(current.weather_code);
            
        document.getElementById("weather-feels-like").textContent = `${Math.round(current.apparent_temperature)}°F`;
            
        document.getElementById("weather-humidity").textContent = `${Math.round(current.relative_humidity_2m)}%`;    

        document.getElementById("weather-wind").textContent = `${Math.round(current.wind_speed_10m)} mph`;
            
        document.getElementById("weather-gusts").textContent =`${Math.round(current.wind_gusts_10m)} mph`;
            
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
        }
    );
}

// =============================
// Sentinel Functions
// =============================

// Route awareness
// Threat evaluation
// Corridor filtering
// ETA calculations
// Future implementation

// ================================
// Radar Functions
// ================================

function updateMapZoomDisplay() {
    const zoomDisplay =
        document.getElementById(
            "map-zoom-level"
        );

    if (!zoomDisplay || !radarMap) {
        return;
    }

    const currentZoom =
        radarMap.getZoom();

    zoomDisplay.textContent =
        `Z${currentZoom}`;

    diagnosticLog("Map", {
        event: "Zoom changed",
        zoom: currentZoom,
        fullscreen:
            mapPanel.classList.contains(
                "fullscreen-map"
            )
    });
}

function initializeMap() {
    const mapStatus = document.getElementById("map-status");

    const defaultLatitude = DEFAULT_LATITUDE;
    const defaultLongitude = DEFAULT_LONGITUDE;

    radarMap = L.map("map", {
        rotate: true,
        minZoom: MIN_MAP_ZOOM
    }).setView(
        [defaultLatitude, defaultLongitude],
        DEFAULT_MAP_ZOOM
    );

    radarMap.on(
        "zoomend",
        function () {
            updateMapZoomDisplay();
            handleRadarZoomLimit();

            if (
                radarFrames.length > 0 &&
                radarMap.getZoom() <= 7
            ) {
                displayRadarFrame(
                    currentRadarFrame
                );
            }
        }
    );

    updateMapZoomDisplay();

    const streetMap = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }
    ).addTo(radarMap);

    const baseMaps = {
        "Street Map": streetMap
    };

    const overlayMaps = {};

    layerControl = L.control.layers(
        baseMaps,
        overlayMaps,
        {
            collapsed: false
        }
    ).addTo(radarMap)

    radarLayerGroup =
    L.layerGroup().addTo(radarMap);

    layerControl.addOverlay(
        radarLayerGroup,
        "🌧️ Weather Radar"
    );

    radarMap.on("overlayremove", function (event) {
        if (event.layer !== radarLayerGroup) {
            return;
        }

        stopRadarAnimation();

        console.log(
            "[Radar] Overlay hidden. Animation stopped."
        );
    });

    radarMap.on("overlayadd", async function (event) {
        if (event.layer !== radarLayerGroup) {
            return;
        }

        console.log(
            "[Radar] Overlay restored. Loading fresh frames."
        );

        await initializeWeatherRadar();
    });

    radarMap.on("click", function (event) {
        console.log("Map clicked:", event.latlng);

        const clickedLatitude = event.latlng.lat;
        const clickedLongitude = event.latlng.lng;

        L.popup()
            .setLatLng(event.latlng)
            .setContent(`
            <br> 📍 Target Coordinates</br><br><br>
            Latitude: ${clickedLatitude.toFixed(5)}<br>
            Longitude: ${clickedLongitude.toFixed(5)}
            `)
            .openOn(radarMap);
    });

    mapStatus.textContent = "Requesting Location";

    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            function (position) {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                currentLatitude = latitude;
                currentLongitude = longitude;

                const speedMetersPerSecond = 
                    position.coords.speed;

                if (speedMetersPerSecond !== null) {
                    currentSpeedMph =
                        speedMetersPerSecond * 2.23694;
                } else {
                    currentSpeedMph = 0;
                }

                navigationIntelligenceManager.update(
                    currentSpeedMph
                );

                if (position.coords.heading !== null) {
                    const smoothedHeading =
                        navigationIntelligenceManager.updateHeading(
                            position.coords.heading,
                            currentSpeedMph
                        );

                    if (smoothedHeading !== null) {
                        currentHeading = smoothedHeading;
                    }
                }

                if (!initialWarningsLoaded) {
                    initialWarningsLoaded = true;
                    loadNwsWarnings();
                }

                if (!locationMarker) {
                    locationMarker = L.marker(
                        [latitude, longitude],
                        {
                            icon: stationaryLocationIcon
                        }
                    )
                        .addTo(radarMap)
                        .bindPopup("Project Overwatch")
                        .openPopup();

                    radarMap.setView([latitude, longitude], 15);
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

                    accuracyFeet:
                        position.coords.accuracy * 3.28084,

                    rawSpeedMps:
                        position.coords.speed,

                        currentSpeedMph,

                        averageSpeedMph:
                    navigationIntelligenceManager
                        .averageSpeedMph,

                    rawHeading:
                        position.coords.heading,

                    smoothedHeading:
                        navigationIntelligenceManager
                            .smoothedHeading,

                    currentHeading,

                    commandedMapBearing:
                        currentHeading === null
                            ? null
                            : convertHeadingToMapBearing(
                                currentHeading
                            ),

                    mapBearing:
                    radarMap?.getBearing?.() ?? null,

                    actualZoom:
                        radarMap?.getZoom?.() ?? null,

                    targetZoom:
                        navigationIntelligenceManager
                            .targetZoom,

                    operatingMode:
                        navigationIntelligenceManager.mode,

                    radarPlaying:
                        radarIsPlaying,

                    currentZoom:
                        radarMap?.getZoom?.(),
                        
                    currentBearing:
                        radarMap?.getBearing?.(),
                        
                    fullscreen:
                        mapPanel?.classList.contains(
                                "fullscreen-map"
                        )    

                });

                const accuracy = position.coords.accuracy;

                if (!accuracyCircle) {
                    accuracyCircle = L.circle([latitude, longitude], {
                        radius: accuracy,
                        color: "#00ff00",
                        fillColor: "#00ff00",
                        fillOpacity: 0.15
                    }).addTo(radarMap);
                }else {
                    accuracyCircle.setLatLng([latitude, longitude]);
                    accuracyCircle.setRadius(accuracy);
                }
            
                const accuracyFeet = position.coords.accuracy * 3.28084;

                const currentZoom =
                    radarMap.getZoom();

                mapStatus.textContent = 
                    `GPS ONLINE ⏺ Z${currentZoom} ⏺ ACCURACY ±${Math.round(accuracyFeet)} FT`;
            },

            function (error) {
                console.error("GPS error:", error.code, error.message);

                mapStatus.textContent = 
                `GPS ERROR ${error.code} ⏺ ${error.message}`;

                if (!locationMarker) {
                    locationMarker = L.marker([
                        defaultLatitude,
                        defaultLongitude
                    ])
                        .addTo(radarMap)
                        .bindPopup("Default Location")
                        .openPopup();
                }
            },

            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000
            }
        );
    } else {
        mapStatus.textContent = "GPS Unsupported";

        locationMarker = L.marker([
            defaultLatitude,
            defaultLongitude
        ])
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
    console.log(
        "Initializing weather radar"
    );

    await refreshRadarMetadata();

    if (radarFrames.length === 0) {
        console.error(
            "Weather radar could not be initialized."
        );

        const timestampDisplay =
            document.getElementById(
                "radar-timestamp"
            );

        if (timestampDisplay) {
            timestampDisplay.textContent =
                "Radar Unavailable";
        }

        return;
    }

    currentRadarFrame =
        radarFrames.length - 1;

    console.log(
        "[Radar] Loaded frames:",
        radarFrames.length
    );

    console.log(
        "[Radar] Starting frame:",
        currentRadarFrame
    );

    displayRadarFrame(
        currentRadarFrame
    );

    startRadarAnimation();
    startRadarMetadataRefresh();
}   

async function refreshRadarMetadata() {
    if (radarMetadataRefreshInProgress) {
        console.log(
            "Radar metadata refresh already in progress."
        );

        return;
    }

    radarRefreshInProgress = true;
    updateRadarFreshnessDisplay();      

    radarMetadataRefreshInProgress = true;

    try {
        console.log(
            "Refreshing RainViewer radar metadata..."
        );

        const response = await fetch(
            "https://api.rainviewer.com/public/weather-maps.json",
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `RainViewer request failed: ${response.status}`
            );
        }

        const radarData =
            await response.json();

        const updatedFrames =
            radarData?.radar?.past;

        if (
            !Array.isArray(updatedFrames) ||
            updatedFrames.length === 0
        ) {
            throw new Error(
                "RainViewer returned no radar frames."
            );
        }

        const previousLatestFrame =
            radarFrames.length > 0
                ? radarFrames[
                    radarFrames.length - 1
                ]?.time
                : null;

        const updatedLatestFrame =
            updatedFrames[
                updatedFrames.length - 1
            ]?.time;

        const updatedLatestFrameSeconds =
            Number(updatedLatestFrame);

        if (    
            !Number.isFinite(
                updatedLatestFrameSeconds
            )
        ) {
            throw new Error(
                "RainViewer returned an invalid radar timestamp."
            );
        }   

        radarFrames = updatedFrames.map(
            frame => ({
                ...frame,
                host: radarData.host
            })
        );

        lastRadarRefreshTime =
            Date.now();

        lastRadarDataTimestamp =
            updatedLatestFrameSeconds *
            1000;

        updateRadarFreshnessDisplay();

        const newDataAvailable =
            previousLatestFrame !==
            updatedLatestFrame;

        if (newDataAvailable) {
            console.log(
                "New radar frames available.",
                {
                    previousLatestFrame,
                    updatedLatestFrame,
                    frameCount:
                        radarFrames.length
                }
            );
        } else {
            console.log(
                "Radar metadata is current.",
                {
                    latestFrame:
                        updatedLatestFrame,
                    frameCount:
                        radarFrames.length
                }
            );
        }

        /*
         * Keep the animation position valid
         * after replacing the frame array.
         */
        if (
            currentRadarFrame >=
            radarFrames.length
        ) {
            currentRadarFrame =
                radarFrames.length - 1;
        }

        /*
         * When paused on the latest frame,
         * advance to the newly received
         * latest frame immediately.
         */
        
        if (
            !radarIsPlaying &&
            newDataAvailable
        ) {
            currentRadarFrame =
                radarFrames.length - 1;

            displayRadarFrame(
                currentRadarFrame
            );
        }
    } catch (error) {
        console.error(
            "Unable to refresh radar metadata:",
            error
        );

        notificationManager.addAlert({
            id: "radar-refresh-error",
            source: "RainViewer",
            createdBy: "Radar",
            title:
                "Radar data refresh unavailable",
            priority: "low",
            icon: "🔵"
        });
    } finally {
        radarMetadataRefreshInProgress =
            false;

        radarRefreshInProgress =
            false;

        updateRadarFreshnessDisplay();
    }
}

function startRadarMetadataRefresh() {
    if (radarMetadataRefreshTimer) {
        clearInterval(
            radarMetadataRefreshTimer
        );
    }

    radarMetadataRefreshTimer =
        setInterval(
            refreshRadarMetadata,
            RADAR_REFRESH_INTERVAL_MS
        );

    console.log(
        "Automatic radar refresh started."
    );
}

// Rendering
function displayRadarFrame(frameIndex) {
    if (
        !radarMap ||
        radarFrames.length === 0 ||
        !radarFrames[frameIndex]
    ) {
        console.warn(
            "[Radar] Unable to display frame:",
            frameIndex
        );

        console.trace(
            "[Radar] Invalid frame caller"
        );

        return;
    }

    const frame =
        radarFrames[frameIndex];

    const currentZoom =
        radarMap.getZoom();

    const isWideView =
        currentZoom <= 7;

    const radarTileUrl =
        frame.host +
        frame.path +
        "/256/{z}/{x}/{y}/2/1_1.png";

    const newRadarLayer =
        L.tileLayer(radarTileUrl, {
            tileSize: 256,
            opacity:
                isWideView
                    ? RADAR_OPACITY
                    : 0,

            maxNativeZoom: 7,
            maxZoom: 19,
            minZoom: MIN_MAP_ZOOM,

            noWrap: true,
            keepBuffer: 0,
            updateWhenZooming: false,
            updateWhenIdle: true,
            attribution: "RainViewer"
        });

    /*
     * In wide view, replace the layer immediately.
     * Do not wait for the fade animation.
     */
    if (isWideView) {
        if (
            weatherRadar &&
            radarLayerGroup.hasLayer(weatherRadar)
        ) {
            radarLayerGroup.removeLayer(weatherRadar);
        }

        if (
            previousWeatherRadar &&
            radarLayerGroup.hasLayer(
                previousWeatherRadar
            )
        ) {
            radarLayerGroup.removeLayer(
                previousWeatherRadar
            );

            previousWeatherRadar = null;
        }

        previousWeatherRadar = null;
        weatherRadar = newRadarLayer;

        weatherRadar.addTo(radarLayerGroup);
    } else {
        newRadarLayer.addTo(radarLayerGroup);

        newRadarLayer.once(
            "load",
            function () {
                previousWeatherRadar =
                    weatherRadar;

                weatherRadar =
                    newRadarLayer;

                fadeInRadarLayer(
                    weatherRadar
                );

                if (previousWeatherRadar) {
                    fadeOutRadarLayer(
                        previousWeatherRadar
                    );
                }
            }
        );
    }

    updateRadarTimestamp(frame);

    console.log("[Radar]", {
        frame:
            frameIndex + 1,

        zoom:
            currentZoom,

        mode:
            isWideView
                ? "STATIC"
                : "ANIMATED",

        tileSize: 256
    });
}

function fadeInRadarLayer(layer) {
    let opacity = 0;

    const fadeStep = 50;
    const opacityStep =
        RADAR_OPACITY /
        (RADAR_FADE_DURATION / fadeStep);

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

    const fadeStep = 50;
    const opacityStep =
        RADAR_OPACITY /
        (RADAR_FADE_DURATION / fadeStep);

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

    function advanceRadarFrame() {
        currentRadarFrame++;

        if (currentRadarFrame >= radarFrames.length) {
            currentRadarFrame = 0;
        }

        displayRadarFrame(currentRadarFrame);

        const isNewestFrame =
            currentRadarFrame === radarFrames.length - 1;

        const nextDelay = isNewestFrame
            ? RADAR_END_PAUSE
            : RADAR_FRAME_DELAY;

        radarAnimationTimer = setTimeout(
            advanceRadarFrame,
            nextDelay
        );
    }

    radarAnimationTimer = setTimeout(
        advanceRadarFrame,
        RADAR_FRAME_DELAY
    );
}

function stopRadarAnimation() {
    if (radarAnimationTimer) {
        clearTimeout(radarAnimationTimer);
    }

    radarIsPlaying = false;
}

// User Interface
function updateRadarTimestamp(frame) {
    const timestampDisplay =
        document.getElementById(
            "radar-timestamp"
        );

    if (!timestampDisplay) {
        console.error(
            "[Radar] Timestamp element not found."
        );

        return;
    }

    if (
        !frame ||
        typeof frame.time !== "number"
    ) {
        timestampDisplay.textContent =
            "Time Unavailable";

        console.error(
            "[Radar] Invalid frame:",
            frame
        );

        return;
    }

    const timestamp =
        new Date(frame.time * 1000);

    timestampDisplay.textContent =
        timestamp.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
        });
}

function initializeRadarControls() {
    const previousButton =
        document.getElementById("radar-prev");

    const playButton =
        document.getElementById("radar-play");

    const nextButton =
        document.getElementById("radar-next");

    previousButton.addEventListener("click", function () {
        if (radarFrames.length === 0) {
            return;
        }

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

        stopRadarAnimation();

        currentRadarFrame++;

        if (currentRadarFrame >= radarFrames.length) {
            currentRadarFrame = 0;
        }

        displayRadarFrame(currentRadarFrame);
        playButton.textContent = "▶";
    });
}

function handleRadarZoomLimit() {
    if (!radarMap) {
        return;
    }

    const currentZoom = radarMap.getZoom();

    if (
        currentZoom < MIN_ANIMATED_RADAR_ZOOM &&
        radarIsPlaying
    ) {
        radarWasPlayingBeforeZoomPause = true;
        radarPausedForZoom = true;

        stopRadarAnimation();

        const playButton =
            document.getElementById("radar-play");

        if (playButton) {
            playButton.textContent = "▶";
            playButton.title =
                "Radar paused at wide zoom";
        }

        console.log(
            `[Radar] Animation paused at zoom ${currentZoom}`
        );

        return;
    }

    if (
        currentZoom >= MIN_ANIMATED_RADAR_ZOOM &&
        radarPausedForZoom
    ) {
        radarPausedForZoom = false;

        const playButton =
            document.getElementById("radar-play");

        if (radarWasPlayingBeforeZoomPause) {
            startRadarAnimation();

            if (playButton) {
                playButton.textContent = "⏸";
                playButton.title =
                    "Pause radar animation";
            }
        }

        radarWasPlayingBeforeZoomPause = false;

        console.log(
            `[Radar] Animation restored at zoom ${currentZoom}`
        );
    }
}


       

// ====================================
// Lightning Functions
// ====================================

async function initializeLightning() {
    console.log("Loading lightning...");

    lightningLayer = L.layerGroup().addTo(radarMap);

    layerControl.addOverlay(
        lightningLayer,
        "⚡️ Lightning"
    );

    addTestLightningStrike();
    
    console.log("Lightning layer ready.");
}

function clearLightning() {
    lightningLayer.clearLayers ();
}

function addTestLightningStrike() {
    console.log("Adding test lightning strike...");
    
    const testLatitude = 30.35;
    const testLongitude = -93.15;

    const lightningIcon = L.divIcon({
        className: "lightning-marker",
        html: '<span class="lightning-symbol">⚡️</span>',
        iconSize: [48, 48],
        iconAnchor: [24, 24]
    });

    L.marker(
        [testLatitude, testLongitude],
        { icon: lightningIcon }
    )
        .addTo(lightningLayer)
        .bindPopup("Test Lightning Strike");
}

// ===================================
// NWS Warnings
// ===================================

function initializeWarnings() {
    if (warningsLayer) {
        return;
    }

    console.log(
        "Initializing NWS warning layer..."
    );

    warningsLayer =
        L.layerGroup().addTo(radarMap);

    layerControl.addOverlay(
        warningsLayer,
        "🚨 NWS Alerts"
    );

    warningsRefreshTimer =
        setInterval(
            loadNwsWarnings,
            5 * 60 * 1000
        );

    console.log(
        "NWS warning layer registered."
    );
}

async function loadNwsWarnings () {
    if (
        currentLatitude === null ||
        currentLongitude === null
    ) {
        console.log(
            "Sentinel waiting for GPS before loading NWS warnings."
        );

        return;
    }

    const warningsUrl =
        "https://api.weather.gov/alerts/active";

        console.log("NWS warning URL:", warningsUrl);

        try {
            const response = await fetch(warningsUrl, {
                headers: {
                    Accept: "application/geo+json"
                }
            });

            if (!response.ok) {
                throw new Error(
                    `NWS request failed: ${response.status}`
                );
            }

            const warningData = await response.json();

            warningsLayer.clearLayers();
            notificationManager.beginRefresh("NWS");

            let nearbyAlertCount = 0;

            L.geoJSON(warningData, {
                filter: function (feature) {
                    if (feature.geometry === null) {
                        return false;
                    }

                    if (
                        currentLatitude === null ||
                        currentLongitude === null
                    ) {
                        return false;
                    }

                    const featureLayer = L.geoJSON(feature);

                    const warningCenter = 
                        featureLayer.getBounds().getCenter();

                    const warningDistanceMiles = 
                        calculateDistanceMiles(
                            currentLatitude,
                            currentLongitude,
                            warningCenter.lat,
                            warningCenter.lng
                        );

                    const warningBearing = 
                    calculateBearing(
                        currentLatitude,
                        currentLongitude,
                        warningCenter.lat,
                        warningCenter.lng
                    );
                    
                    const warningDirection = 
                        bearingToCompass(warningBearing);

                        
                    feature.properties.distanceMiles = 
                        warningDistanceMiles;

                    feature.properties.bearing = 
                        warningBearing;
                        
                    feature.properties.direction =
                        warningDirection;
                        
                    const isNearby =
                        warningDistanceMiles <= SENTINEL_RADIUS_MILES;

                    if (isNearby) {
                        nearbyAlertCount++;
                    }    
                        
                    return isNearby;

                },

                style: function (feature) {
                    return getWarningStyle(
                        feature.properties.event
                    );
                },

                onEachFeature: function (feature, layer) {
                    const properties = feature.properties;

                    properties.priority = 
                        getAlertPriority(properties.event);

                    function getAlertIcon(priority) {
                        if (priority === "critical") {
                            return "🚨";
                        }        
                        
                        if (priority === "high") {
                            return "⚠️";
                        }
                        
                        if (priority === "medium") {
                            return "🟡";
                        }

                        return "🔵";
                    }

                    notificationManager.addAlert({
                        id: feature.id,
                        
                        source: "NWS",
                        createdBy: "Sentinel",

                        title: properties.event,
                        priority: properties.priority,
                        distance: properties.distanceMiles,
                        direction: properties.direction,
                        expires: properties.expires,
                        icon: getAlertIcon(properties.priority),

                    });  

                    console.log(
                        "[Sentinel]",
                        properties.event,
                        properties.priority,
                        `${properties.distanceMiles.toFixed(1)}`
                    );

                    layer.bindPopup(`
                        <strong>${properties.event}</strong><br>
                        ${properties.headline || ""}<br><br>
                        <strong>Area:</strong>
                        ${properties.areaDesc || "Unknown"}<br>
                        <strong>Expires:</strong>
                        ${formatAlertTime(properties.expires)}
                    `);
                }
            }).addTo(warningsLayer);

            notificationManager.endRefresh("NWS");

            console.log(
                `NWS alerts loaded: ${warningData.features.length}`
            );

            console.log(
                `Nearby alerts displayed: ${nearbyAlertCount}`
            );

            updateAlertsPanel();

        } catch (error) {
            console.error(
                "Unable to load NWS warnings:",
                error
            );

            updateAlertsPanel();
        }
}

function getAlertPriority(eventName) {
    const event = eventName.toLowerCase();

    if (
        event.includes("tornado warning") ||
        event.includes("flash flood warning")
    ) {
        return "critical";
    }

    if (
        event.includes("severe thunderstorm warning") ||
        event.includes("hurricane warning") ||
        event.includes("tropical storm warning")
    ) {
        return "high";
    }

    if (
        event.includes("watch") ||
        event.includes("advisory")
    ) {
        return "medium";
    }

    return "low";
}

function getWarningStyle(eventName) {
    const event = eventName.toLowerCase();

    let borderColor = "#ffd700";
    let fillColor = "#ffd700";

    if (event.includes("tornado warning")) {
        borderColor = "#ff0000";
        fillColor = "#ff0000";
    } else if (
        event.includes("tropical storm warning") ||
        event.includes("hurricane warning")
    ) {
        borderColor = "#ff00ff";
        fillColor = "#ff00ff";
    } else if (
        event.includes("severe thunderstorm warning")
    ) {
        borderColor = "#ff8c00";
        fillColor = "#ff8c00";
    } else if (
        event.includes("flash flood warning")
    ) {
        borderColor = "#00ff00";
        fillColor = "#00ff00";

    } else if (event.includes("watch")) {
        borderColor = "#ffff00";
        fillColor = "#ffff00";
    }

    return {
        color: borderColor,
        weight: 3,
        opacity: 0.95,
        fillColor: fillColor,
        fillOpacity: 0.35
    };
}

function formatAlertTime(timeString) {
    if (!timeString) {
        return "Unknown";
    }

    return new Date(timeString).toLocaleString();
}



const expandMapButton =
    document.getElementById("expand-map-btn");

const mapPanel =
    document.getElementById("map-panel");

expandMapButton.addEventListener("click", function () {
    const isFullscreen =
        mapPanel.classList.toggle("fullscreen-map");

    document.body.classList.toggle(
        "map-open",
        isFullscreen
    );

    expandMapButton.setAttribute(
        "aria-label",
        isFullscreen
            ? "Close full screen map"
            : "Expand map"
    );

    expandMapButton.title =
        isFullscreen
            ? "Close full screen map"
            : "Expand map";

    setTimeout(function () {
        radarMap.invalidateSize();
        updateMapZoomDisplay();
    }, 100);
});

// ===================================
// Application Start Up
// ===================================

updateClock();
setInterval(updateClock, 1000)

updateAlertsPanel();

requestWeatherLocation();

initializeMap();

initializeWarnings();

initializeWeatherRadar();

initializeRadarControls();

initializeLightning();

startRadarFreshnessMonitor();

const exportDiagnosticsButton =
    document.getElementById(
        "export-log-btn"
    );

exportDiagnosticsButton?.addEventListener(
    "click",
    exportDiagnosticLog
);

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