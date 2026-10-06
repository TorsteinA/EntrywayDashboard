// Configure up to 5 favorite locations here
const favoriteLocations = [
  { name: "Helsfyr", lat: 59.9139, lon: 10.8031 },
  { name: "Kongsvinger", lat: 60.1905, lon: 12.0034 },
  { name: "Asker", lat: 59.8338, lon: 10.4354 },
  { name: "Trysil", lat: 61.3158, lon: 12.2647 },
  { name: "Gardermoen", lat: 60.1975, lon: 11.1004 },
];

// Destination to exclude (incoming buses)
const EXCLUDE_DESTINATION = "Vardefjellet";

// Map MET Norway symbol codes to Norwegian labels
const weatherTranslations = {
  clearsky: "Sol",
  fair: "Lettskyet",
  partlycloudy: "Delvis skyet",
  cloudy: "Overskyet",
  rainshowers: "Regnbyger",
  rain: "Regn",
  heavyrain: "Kraftig regn",
  sleet: "Sludd",
  snow: "Snø",
  fog: "Tåke",
};

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
    const feelsLike = calculateFeelsLike(currentTemp, windSpeed, humidity);

    const symbolCode =
      timeseries[0].data.next_1_hours?.summary?.symbol_code ||
      timeseries[0].data.next_6_hours?.summary?.symbol_code;

    document.getElementById("current-temp").textContent = `${currentTemp}°`;
    document.getElementById("condition-text").textContent =
      translateSymbol(symbolCode);
    document.getElementById("feels-like-temp").textContent = `${feelsLike}°`;
    document.getElementById("humidity").textContent = `${humidity}%`;
    document.getElementById("wind-speed").textContent = `${windSpeed} m/s`;

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
          <span class="f-cond">${translateSymbol(condCode)}</span>
          <span class="f-temp">${temp}°</span>
          <span class="f-rain">${formatPrecipRange(pMin, pMax)}</span>
        </div>`;
    }
  } catch (err) {
    console.error("Error fetching home weather:", err);
  }
}

// Fetch travel weather for up to 5 favorite locations
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

      // Check forecast ~1 hour in the future (arrival time)
      const arrivalData = timeseries[1] || timeseries[0];
      const arrivalTemp = Math.round(
        arrivalData.data.instant.details.air_temperature,
      );
      const symbolCode =
        arrivalData.data.next_1_hours?.summary?.symbol_code ||
        arrivalData.data.next_6_hours?.summary?.symbol_code;

      const pMin =
        arrivalData.data.next_1_hours?.details?.precipitation_amount_min ||
        arrivalData.data.next_1_hours?.details?.precipitation_amount ||
        0;
      const pMax =
        arrivalData.data.next_1_hours?.details?.precipitation_amount_max ||
        arrivalData.data.next_1_hours?.details?.precipitation_amount ||
        pMin;
      const precipText = formatPrecipRange(pMin, pMax);

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
          <span class="fav-cond">${translateSymbol(symbolCode)}</span>
          <span class="fav-precip">${precipText}</span>
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
  } catch (err) {
    console.error("Transit error:", err);
  }
}

// Initialize application
updateClock();
setInterval(updateClock, 1000);

fetchHomeWeather();
fetchFavoriteWeather();
fetchTransit();

// Set refresh intervals
setInterval(fetchTransit, 30 * 1000);
setInterval(fetchHomeWeather, 12 * 60 * 1000);
setInterval(fetchFavoriteWeather, 15 * 60 * 1000);
