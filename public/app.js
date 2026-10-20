// Configure up to 5 favorite locations here
const favoriteLocations = [
  { name: "Kongsvinger", lat: 60.1905, lon: 12.0034, travelTimeMins: 70 },
  { name: "Skarnes", lat: 60.26884, lon: 11.68211, travelTimeMins: 40 },
  { name: "Helsfyr", lat: 59.9139, lon: 10.8031, travelTimeMins: 25 },
  { name: "Bygdøy", lat: 59.91356, lon: 10.68312, travelTimeMins: 30 },
  { name: "Asker", lat: 59.8338, lon: 10.4354, travelTimeMins: 60 },
];
// Destination to exclude (incoming buses)
const EXCLUDE_DESTINATION = "Vardefjellet";

// Map MET Norway symbol codes to Norwegian labels
const weatherTranslations = {
  clearsky: "Klarvær",
  fair: "Lettskyet",
  partlycloudy: "Delvis skyet",
  cloudy: "Overskyet",

  // Rain
  lightrainshowers: "Lette regnbyger",
  rainshowers: "Regnbyger",
  heavyrainshowers: "Kraftige regnbyger",
  lightrain: "Lett regn",
  rain: "Regn",
  heavyrain: "Kraftig regn",

  // Sleet
  lightsleetshowers: "Lette sluddbyger",
  sleetshowers: "Sluddbyger",
  heavysleetshowers: "Kraftige sluddbyger",
  lightsleet: "Lett sludd",
  sleet: "Sludd",
  heavysleet: "Kraftig sludd",

  // Snow
  lightsnowshowers: "Lette snøbyger",
  snowshowers: "Snøbyger",
  heavysnowshowers: "Kraftige snøbyger",
  lightsnow: "Lett snø",
  snow: "Snø",
  heavysnow: "Kraftig snø",

  // Thunder variants (Rain)
  lightrainshowersandthunder: "Lette regnbyger og torden",
  rainshowersandthunder: "Regnbyger og torden",
  heavyrainshowersandthunder: "Kraftige regnbyger og torden",
  lightrainandthunder: "Lett regn og torden",
  rainandthunder: "Regn og torden",
  heavyrainandthunder: "Kraftig regn og torden",

  // Thunder variants (Sleet)
  lightsleetshowersandthunder: "Lette sluddbyger og torden",
  sleetshowersandthunder: "Sluddbyger og torden",
  heavysleetshowersandthunder: "Kraftige sluddbyger og torden",
  lightsleetandthunder: "Lett sludd og torden",
  sleetandthunder: "Sludd og torden",
  heavysleetandthunder: "Kraftig sludd og torden",

  // Thunder variants (Snow)
  lightsnowshowersandthunder: "Lette snøbyger og torden",
  snowshowersandthunder: "Snøbyger og torden",
  heavysnowshowersandthunder: "Kraftige snøbyger og torden",
  lightsnowandthunder: "Lett snø og torden",
  snowandthunder: "Snø og torden",
  heavysnowandthunder: "Kraftig snø og torden",

  // Fog
  fog: "Tåke",
};

// Get SVG icon URL from MET Norway's official GitHub / CDN repo
function getWeatherIconUrl(symbolCode) {
  if (!symbolCode) return "";
  return `https://raw.githubusercontent.com/metno/weathericons/main/weather/svg/${symbolCode}.svg`;
}

function translateSymbol(code) {
  if (!code) return "";
  const cleanCode = code.replace(/_(night|day|polarnight)/g, "").toLowerCase();
  return weatherTranslations[cleanCode] || cleanCode.replace(/_/g, " ");
}

// Calculate perceived temperature ("Føles som")
function calculateFeelsLike(tempC, windSpeedMs, humidityPct) {
  const windKmH = windSpeedMs * 3.6;
  if (tempC <= 10 && windKmH > 4.8) {
    return Math.round(
      13.12 +
        0.6215 * tempC -
        11.37 * Math.pow(windKmH, 0.16) +
        0.3965 * tempC * Math.pow(windKmH, 0.16),
    );
  }
  if (tempC >= 20) {
    const e =
      (humidityPct / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
    return Math.round(tempC + 0.33 * e - 0.7 * windSpeedMs - 4.0);
  }
  return Math.round(tempC);
}

// Format precipitation range (min-max mm)
function formatPrecipRange(minVal, maxVal) {
  if (minVal === undefined && maxVal === undefined) return "0 mm";
  const min = minVal || 0;
  const max = maxVal !== undefined ? maxVal : min;
  if (min === max) return `${min.toFixed(1)} mm`;
  return `${min.toFixed(1)} - ${max.toFixed(1)} mm`;
}

// Helper: Find timeseries entry closest to target arrival time
function getClosestTimeseries(timeseries, travelTimeMins = 60) {
  const targetTime = new Date(Date.now() + travelTimeMins * 60 * 1000);
  let closestEntry = timeseries[0];
  let smallestDiff = Infinity;

  for (const entry of timeseries.slice(0, 12)) {
    const entryTime = new Date(entry.time);
    const diff = Math.abs(entryTime - targetTime);

    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestEntry = entry;
    }
  }

  return closestEntry;
}

// Update clock and date
function updateClock() {
  const now = new Date();
  document.getElementById("time").textContent = now.toLocaleTimeString(
    "no-NO",
    { hour: "2-digit", minute: "2-digit", hour12: false },
  );
  document.getElementById("date").textContent = now.toLocaleDateString(
    "no-NO",
    { weekday: "long", month: "long", day: "numeric" },
  );
}

// Update the last refreshed timestamp
function updateLastRefreshed(elementId) {
  const now = new Date();
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent =
      "Oppdatert: " +
      now.toLocaleTimeString("no-NO", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
  }
}

async function fetchPostStatus() {
  try {
    const res = await fetch("/api/post");
    if (!res.ok) throw new Error("Post status fetch failed");

    const data = await res.json();

    // Extract array from delivery_dates property
    const dates = data.delivery_dates || [];

    // Select the first upcoming delivery date string
    const nextDelivery = dates[0] || null;

    updatePostStatus(nextDelivery);
  } catch (err) {
    console.error("Error fetching post status:", err);
    updatePostStatus(null);
  }
}

function updatePostStatus(deliveryDateStr) {
  const pill = document.getElementById("post-status");
  const text = document.getElementById("post-text");

  if (!deliveryDateStr) {
    pill.className = "post-pill na";
    text.textContent = "N/A";
    return;
  }

  const today = new Date();
  const delivery = new Date(deliveryDateStr);

  // Calculate relative day difference
  const diffDays = Math.round(
    (delivery.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) /
      (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    pill.className = "post-pill today";
    text.textContent = "i dag";
  } else if (diffDays === 1) {
    pill.className = "post-pill tomorrow";
    text.textContent = "i morgen";
  } else if (diffDays > 1 && diffDays < 7) {
    const weekday = delivery.toLocaleDateString("no-NO", { weekday: "long" });
    pill.className = "post-pill later";
    text.textContent = `på ${weekday}`;
  } else {
    pill.className = "post-pill na";
    text.textContent = "N/A";
  }
}

// Fetch primary weather data for home location
async function fetchHomeWeather() {
  try {
    const res = await fetch("/api/weather");
    if (!res.ok) return;
    const data = await res.json();
    const timeseries = data.properties.timeseries;
    if (!timeseries?.length) return;

    const currentInstant = timeseries[0].data.instant.details;
    const currentTemp = Math.round(currentInstant.air_temperature);
    const humidity = Math.round(currentInstant.relative_humidity || 0);
    const windSpeed = Math.round(currentInstant.wind_speed || 0);
    const cloudCover = Math.round(currentInstant.cloud_area_fraction || 0);
    const feelsLike = calculateFeelsLike(currentTemp, windSpeed, humidity);

    const symbolCode =
      timeseries[0].data.next_1_hours?.summary?.symbol_code ||
      timeseries[0].data.next_6_hours?.summary?.symbol_code;

    document.getElementById("current-temp").textContent = `${currentTemp}°`;
    document.getElementById("condition-text").textContent =
      translateSymbol(symbolCode);
    document.getElementById("feels-like-temp").textContent = `${feelsLike}°`;

    const iconEl = document.getElementById("weather-icon");
    if (iconEl && symbolCode) {
      iconEl.src = getWeatherIconUrl(symbolCode);
      iconEl.alt = translateSymbol(symbolCode);
    }

    // Left column metrics
    document.getElementById("wind-speed").textContent = `${windSpeed} m/s`;
    document.getElementById("humidity").textContent = `${humidity}%`;
    document.getElementById("cloud-cover").textContent = `${cloudCover}%`;

    // Today's High/Low & Rain totals
    let high = -Infinity,
      low = Infinity;
    let maxRainProb = 0;
    let minRainTotal = 0;
    let maxRainTotal = 0;

    const todaySeries = timeseries.slice(0, 24);
    todaySeries.forEach((ts) => {
      const t = ts.data.instant.details.air_temperature;
      if (t > high) high = t;
      if (t < low) low = t;

      const prob = ts.data.next_1_hours?.details?.probability_of_precipitation;
      if (prob !== undefined && prob > maxRainProb) maxRainProb = prob;

      const pMin =
        ts.data.next_1_hours?.details?.precipitation_amount_min ||
        ts.data.next_1_hours?.details?.precipitation_amount ||
        0;
      const pMax =
        ts.data.next_1_hours?.details?.precipitation_amount_max ||
        ts.data.next_1_hours?.details?.precipitation_amount ||
        pMin;
      minRainTotal += pMin;
      maxRainTotal += pMax;
    });

    // Next 60 minutes rain
    const nextHourDetails = timeseries[0].data.next_1_hours?.details;
    const nextHourMin =
      nextHourDetails?.precipitation_amount_min ||
      nextHourDetails?.precipitation_amount ||
      0;
    const nextHourMax =
      nextHourDetails?.precipitation_amount_max ||
      nextHourDetails?.precipitation_amount ||
      nextHourMin;

    document.getElementById("high-temp").textContent = `${Math.round(high)}°`;
    document.getElementById("low-temp").textContent = `${Math.round(low)}°`;

    // Right column metrics
    document.getElementById("rain-prob-today").textContent =
      `${Math.round(maxRainProb)}%`;
    document.getElementById("rain-amount-today").textContent =
      formatPrecipRange(minRainTotal, maxRainTotal);
    document.getElementById("rain-next-hour").textContent = formatPrecipRange(
      nextHourMin,
      nextHourMax,
    );

    // Render 3-hour forecast with condition text & rain
    const forecastContainer = document.getElementById("forecast-3h");
    forecastContainer.innerHTML = "";
    for (let i = 1; i <= 3; i++) {
      if (!timeseries[i]) break;
      const entry = timeseries[i];
      const time = new Date(entry.time).toLocaleTimeString("no-NO", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const temp = Math.round(entry.data.instant.details.air_temperature);
      const condCode =
        entry.data.next_1_hours?.summary?.symbol_code ||
        entry.data.next_6_hours?.summary?.symbol_code;

      const pMin =
        entry.data.next_1_hours?.details?.precipitation_amount_min ||
        entry.data.next_1_hours?.details?.precipitation_amount ||
        0;
      const pMax =
        entry.data.next_1_hours?.details?.precipitation_amount_max ||
        entry.data.next_1_hours?.details?.precipitation_amount ||
        pMin;

      forecastContainer.innerHTML += `
        <div class="forecast-item">
          <span class="f-time">${time}</span>
          <img class="f-icon" src="${getWeatherIconUrl(condCode)}" alt="" />
          <span class="f-cond">${translateSymbol(condCode)}</span>
          <span class="f-temp">${temp}°</span>
          <span class="f-rain">${formatPrecipRange(pMin, pMax)}</span>
        </div>`;

      updateLastRefreshed("weather-last-refreshed");
    }
  } catch (err) {
    console.error("Error fetching home weather:", err);
  }
}

// Fetch travel weather dynamically based on travelTimeMins
async function fetchFavoriteWeather() {
  const container = document.getElementById("favorites-list");
  container.innerHTML = "";

  for (const loc of favoriteLocations.slice(0, 5)) {
    try {
      const res = await fetch(
        `/api/weather/custom?lat=${loc.lat}&lon=${loc.lon}`,
      );
      if (!res.ok) continue;
      const data = await res.json();
      const timeseries = data.properties.timeseries;
      if (!timeseries?.length) continue;

      // Select timeseries entry closest to calculated arrival time
      const travelMins = loc.travelTimeMins || 60;
      const arrivalData = getClosestTimeseries(timeseries, travelMins);
      const arrivalIndex = timeseries.indexOf(arrivalData);

      const arrivalTemp = Math.round(
        arrivalData.data.instant.details.air_temperature,
      );
      const symbolCode =
        arrivalData.data.next_1_hours?.summary?.symbol_code ||
        arrivalData.data.next_6_hours?.summary?.symbol_code;

      // Expected arrival hour precipitation amount (mm)
      const pMin =
        arrivalData.data.next_1_hours?.details?.precipitation_amount_min ||
        arrivalData.data.next_1_hours?.details?.precipitation_amount ||
        0;
      const pMax =
        arrivalData.data.next_1_hours?.details?.precipitation_amount_max ||
        arrivalData.data.next_1_hours?.details?.precipitation_amount ||
        pMin;
      const precipText = formatPrecipRange(pMin, pMax);

      // Calculate max rain probability over the next 6 hours after arrival
      let maxRainProb6h = 0;
      const arrivalWindow = timeseries.slice(arrivalIndex, arrivalIndex + 6);
      arrivalWindow.forEach((entry) => {
        const prob1h =
          entry.data.next_1_hours?.details?.probability_of_precipitation;
        const prob6h =
          entry.data.next_6_hours?.details?.probability_of_precipitation;
        const prob =
          prob1h !== undefined ? prob1h : prob6h !== undefined ? prob6h : 0;
        if (prob > maxRainProb6h) maxRainProb6h = prob;
      });

      // Calculate today's High / Low
      let high = -Infinity,
        low = Infinity;
      timeseries.slice(0, 24).forEach((ts) => {
        const t = ts.data.instant.details.air_temperature;
        if (t > high) high = t;
        if (t < low) low = t;
      });

      const arrivalTime = new Date(arrivalData.time).toLocaleTimeString(
        "no-NO",
        { hour: "2-digit", minute: "2-digit" },
      );

      const item = document.createElement("div");
      item.className = "fav-card-item";
      item.innerHTML = `
        <div class="fav-col-left">
          <span class="fav-name">${loc.name}</span>
          <span class="fav-time">Kl. ${arrivalTime}</span>
        </div>
        <div class="fav-col-mid">
          <span class="fav-temp">${arrivalTemp}°</span>
          <span class="fav-range">${Math.round(high)}° / ${Math.round(low)}°</span>
        </div>
        <div class="fav-col-right">
          <div class="fav-cond-wrapper">
            <img class="fav-icon" src="${getWeatherIconUrl(symbolCode)}" alt="" />
            <span class="fav-cond">${translateSymbol(symbolCode)}</span>
          </div>
          <span class="fav-precip">${precipText}</span>
          <span class="fav-precip-prob">Regn 6t: ${Math.round(maxRainProb6h)}%</span>
        </div>
      `;
      container.appendChild(item);
    } catch (err) {
      console.error(`Error loading weather for ${loc.name}:`, err);
    }
  }
}

// Fetch public transit departures
async function fetchTransit() {
  try {
    const res = await fetch("/api/transit", { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    const stopPlace = data.data?.stopPlace;
    let calls = stopPlace?.estimatedCalls || [];

    if (stopPlace?.name)
      document.getElementById("stop-name").textContent = stopPlace.name;

    // Filter out incoming buses heading to Vardefjellet
    if (EXCLUDE_DESTINATION) {
      calls = calls.filter((call) => {
        const dest = call.destinationDisplay?.frontText || "";
        return !dest.toLowerCase().includes(EXCLUDE_DESTINATION.toLowerCase());
      });
    }

    const listContainer = document.getElementById("transit-list");
    listContainer.innerHTML = "";

    if (!calls.length) {
      listContainer.innerHTML =
        '<div class="loading">Ingen utgående avganger funnet</div>';
      return;
    }

    // Render next 2 outward departures
    calls.slice(0, 2).forEach((call) => {
      const lineCode = call.serviceJourney.journeyPattern.line.publicCode || "";
      const destination = call.destinationDisplay?.frontText || "Ukjent";

      const now = new Date();
      const depTime = new Date(call.expectedDepartureTime);
      const diffMin = Math.round((depTime - now) / 60000);

      let timeText = diffMin <= 0 ? "Nå" : `${diffMin} min`;
      const isDue = diffMin <= 2;

      listContainer.innerHTML += `
        <div class="transit-item">
          <div class="transit-left">
            <span class="line-number">${lineCode}</span>
            <span class="destination">${destination}</span>
          </div>
          <span class="time-until ${isDue ? "due" : ""}">${timeText}</span>
        </div>`;
    });

    updateLastRefreshed("transit-last-refreshed");
  } catch (err) {
    console.error("Transit error:", err);
  }
}

function fetchAllWeather() {
  fetchHomeWeather();
  fetchFavoriteWeather();
}

function sToMs(s) {
  return s * 1000;
}

function minToMs(m) {
  return m * 60 * 1000;
}

// Initialize application and set refresh intervals
updateClock();
setInterval(updateClock, sToMs(1));

fetchPostStatus();
setInterval(fetchPostStatus, minToMs(60));

fetchAllWeather();
setInterval(fetchAllWeather, minToMs(15));

fetchTransit();
setInterval(fetchTransit, sToMs(30));
