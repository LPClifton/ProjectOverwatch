// =============================
// Constants
// =============================

const DEFAULT_LATITUDE = 30.3027;
const DEFAULT_LONGITUDE = -93.1907;
const DEFAULT_MAP_ZOOM = 9;

const RADAR_OPACITY = 0.6;
const RADAR_FRAME_DELAY = 900;
const RADAR_END_PAUSE = 2000;

const SENTINEL_RADIUS_MILES = 1000;


// =============================
// Global Variables
// =============================

let currentLatitude = null;
let currentLongitude = null;

let radarMap;
let locationMarker;
let accuracyCircle;
let weatherRadar;
let lightningLayer;
let warningsLayer;
let layerControl;
let radarFrames = [];
let currentRadarFrame = 0;
let radarAnimationTimer = null;
let radarAnimationPaused = false;
let radarIsPlaying = true;

let currentHeading = null;


let warningsRefreshTimer;

let tempestSocket;
let tempestReconnectTimer;

// =============================
// Notification Manager
// =============================

const notificationManager = {
    alerts: [],

    clear() {
        this.alerts = [];
    },

    beginRefresh() {
        this.alerts.forEach(alert => {
            alert._syncSeen = false;
        });
    },

    endRefresh() {
        this.alerts = this.alerts.filter(alert => alert._syncSeen);
    },
    
    addAlert(alert) {
        const existingAlert = this.alerts.find(
            a => a.id === alert.id
        );

        if (existingAlert) {

            Object.assign(existingAlert, alert);
            existingAlert._syncSeen = true;
        } else {

            alert._syncSeen = true;
            this.alerts.push(alert);

        }

    },    

    getAlerts() {
        return this.alerts;
    }
}



// =============================
// Clock Functions
// =============================

function updateClock() {
    const now = new Date();

    const time = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    document.getElementById("clock").textContent = time;
}



setInterval(updateClock, 1000);

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

// ================================
// Sentinel Functions
// ================================

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

// ================================
// Radar Functions
// ================================

function initializeRadarMap() {
    const radarStatus = document.getElementById("radar-status");

    const defaultLatitude = DEFAULT_LATITUDE;
    const defaultLongitude = DEFAULT_LONGITUDE;

    radarMap = L.map("radar-map").setView(
        [defaultLatitude, defaultLongitude],
        DEFAULT_MAP_ZOOM
    );

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

    radarStatus.textContent = "Requesting Location";

    if ('geolocation'in navigator) {
        navigator.geolocation.watchPosition(
            function (position) {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                currentLatitude = latitude;
                currentLongitude = longitude;

                if (position.coords.heading !== null) {
                    currentHeading = position.coords.heading;
                } 

                console.log(
                    "Heading:",
                    currentHeading
                );

                if (!warningsRefreshTimer) {
                    initializeWarnings();
                }

                if (!locationMarker) {
                    locationMarker = L.marker([latitude, longitude])
                    .addTo(radarMap)
                    .bindPopup("Project Overwatch")
                    .openPopup();

                    radarMap.setView([latitude, longitude], 15);
                } else {
                    locationMarker.setLatLng([latitude, longitude]);
                } 
                
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

                radarStatus.textContent = 
                    `GPS ONLINE ⏺ ACCURACY ±${Math.round(accuracyFeet)} FT`;
            },

            function (error) {
                console.error("GPS error:", error.code, error.message);

                radarStatus.textContent = 
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
                timeout: 1000
            }
        );
    } else {
        radarStatus.textContent = "GPS Unsupported";

        locationMarker = L.marker([
            defaultLatitude,
            defaultLongitude
        ])
            .addTo(radarMap)
            .bindPopup("Default Location")
            .openPopup();
    }

}  

async function initializeWeatherRadar() {
    console.log("Loading weather radar...");

    try {
        const response = await fetch(
            "https://api.rainviewer.com/public/weather-maps.json"
        );

        const radarData = await response.json();

        radarFrames = radarData.radar.past;

        console.log("Radar frames loaded:", radarFrames);

        currentRadarFrame = 0;

        displayRadarFrame(currentRadarFrame);
        startRadarAnimation();
    } catch (error) {
        console.error("Weather radar failed to load:", error);
    }
}

function displayRadarFrame(frameIndex) {
    const frame = radarFrames[frameIndex];

    if (!frame) {
        return;

    }

    updateRadarTimestamp (frame)

    const radarTileUrl = 
    "https://tilecache.rainviewer.com" +
    frame.path +
    "/256/{z}/{x}/{y}/2/1_1.png";

    if (weatherRadar) {
        radarMap.removeLayer(weatherRadar);

    }

    weatherRadar = L.tileLayer(radarTileUrl, {
        tileSize: 256,
        opacity: RADAR_OPACITY,
        maxNativeZoom: 7,
        maxZoom: 19,
        attribution: "RainViewer"
    });

    weatherRadar.addTo(radarMap);
}

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

        console.log("Displaying radar frame:", currentRadarFrame);

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

function updateRadarTimestamp(frame) {
    const timestamp =
        new Date(frame.time * 1000);

    document.getElementById("radar-timestamp")
        .textContent =
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
        stopRadarAnimation();

        currentRadarFrame--;

        if (currentRadarFrame < 0) {
            currentRadarFrame = radarFrames.length - 1;
        }

        displayRadarFrame(currentRadarFrame);
        playButton.textContent = "▶";
    });

    playButton.addEventListener("click", function () {
        if (radarIsPlaying) {
            stopRadarAnimation();
            playButton.textContent = "▶";
        } else {
            startRadarAnimation();
            playButton.textContent = "⏸";
        }
    });

    nextButton.addEventListener("click", function () {
        stopRadarAnimation();

        currentRadarFrame++;

        if (currentRadarFrame >= radarFrames.length) {
            currentRadarFrame = 0;
        }

        displayRadarFrame(currentRadarFrame);
        playButton.textContent = "▶";
    });
}


// =====================================
// Alerts
// =====================================

function updateAlertsPanel() {
    const alertsStatus =
        document.getElementById("alerts-status");

    const alerts =
        notificationManager.getAlerts();

    if (alerts.length === 0) {
        alertsStatus.textContent = "🟢 All Clear";
        return;
    }

    const priorityOrder = {
        critical: 4,
        high: 3, 
        medium: 2,
        low: 1
    };

    alerts.sort(function (alertA, alertB) {
        return (
            priorityOrder[alertB.priority] -
            priorityOrder[alertA.priority]
        );
    });

    const highestAlert = alerts[0];

    alertsStatus.textContent =
        `${highestAlert.icon} ${highestAlert.title} — ` +
        `${highestAlert.distance.toFixed(1)} miles ${highestAlert.direction}`;

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
    console.log("Loading NWS warnings...");

    warningsLayer = L.layerGroup().addTo(radarMap);

    layerControl.addOverlay(
        warningsLayer,
        "🚨 NWS Alerts"
    );

    loadNwsWarnings();

    warningsRefreshTimer = setInterval(
        loadNwsWarnings,
        5 * 60 * 1000
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
    "https://api.weather.gov/alerts/active?point=" +
    `${currentLatitude},${currentLongitude}`;

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

const radarPanel =
    document.getElementById("radar-panel");

expandMapButton.addEventListener("click", () => {
    const isFullscreen =
        radarPanel.classList.toggle("fullscreen-map");

    document.body.classList.toggle(
        "map-open",
        isFullscreen
    );

    const fullscreenIcon =
        expandMapButton.querySelector(".fullscreen-icon");

    fullscreenIcon.textContent =
        isFullscreen ? "⛶" : "⛶";

    expandMapButton.setAttribute(
        "aria-label",
        isFullscreen
            ? "Close full screen radar map"
            : "Expand radar map"
    );

    expandMapButton.title =
        isFullscreen
            ? "Close full screen radar map"
            : "Expand radar map";

    setTimeout(() => {
        radarMap.invalidateSize();
    }, 100);
});

// ===================================
// Application Start Up
// ===================================

updateClock();

updateAlertsPanel();

requestWeatherLocation();

initializeRadarMap();

initializeWeatherRadar();

initializeRadarControls();

initializeLightning();







