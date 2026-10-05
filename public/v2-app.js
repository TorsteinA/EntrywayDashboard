// Configure favorite locations here
const favoriteLocations = [
  { name: "Helsfyr", lat: 59.9139, lon: 10.8031 },
  { name: "Kongsvinger", lat: 60.1905, lon: 12.0034 },
  { name: "Asker", lat: 59.8338, lon: 10.4354 },
];

const TARGET_DESTINATION = "Blystadlia";

// Map MET Norway symbol codes to Norwegian display labels
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

  // Cold weather wind chill formula
  if (tempC <= 10 && windKmH > 4.8) {
    return Math.round(
      13.12 +
        0.6215 * tempC -
        11.37 * Math.pow(windKmH, 0.16) +
        0.3965 * tempC * Math.pow(windKmH, 0.16),
    );
  }
  // Warm weather apparent temperature formula
  if (tempC >= 20) {
    const e =
      (humidityPct / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
    return Math.round(tempC + 0.33 * e - 0.7 * windSpeedMs - 4.0);
  }

  return Math.round(tempC);
}

// Update clock and Norwegian formatted date
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

    // Calculate high/low for today
    let high = -Infinity,
      low = Infinity;
    timeseries.slice(0, 24).forEach((ts) => {
      const t = ts.data.instant.details.air_temperature;
      if (t > high) high = t;
      if (t < low) low = t;
    });
    document.getElementById("high-temp").textContent = `${Math.round(high)}°`;
    document.getElementById("low-temp").textContent = `${Math.round(low)}°`;

    // Render 3-hour forecast
    const forecastContainer = document.getElementById("forecast-3h");
    forecastContainer.innerHTML = "";
    for (let i = 1; i <= 3; i++) {
      if (!timeseries[i]) break;
      const time = new Date(timeseries[i].time).toLocaleTimeString("no-NO", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const temp = Math.round(
        timeseries[i].data.instant.details.air_temperature,
      );

      forecastContainer.innerHTML += `
        <div class="forecast-item">
          <div class="f-time">${time}</div>
          <div class="f-temp">${temp}°</div>
        </div>`;
    }
  } catch (err) {
    console.error("Error fetching home weather:", err);
  }
}

// Fetch weather cards for secondary favorite locations
async function fetchFavoriteWeather() {
  const container = document.getElementById("favorites-list");
  container.innerHTML = "";

  for (const loc of favoriteLocations) {
    try {
      const res = await fetch(
        `/api/weather/custom?lat=${loc.lat}&lon=${loc.lon}`,
      );
      if (!res.ok) continue;
      const data = await res.json();
      const current = data.properties.timeseries[0].data;
      const temp = Math.round(current.instant.details.air_temperature);

      const next1h = current.next_1_hours;
      const symbolCode =
        next1h?.summary?.symbol_code ||
        current.next_6_hours?.summary?.symbol_code;
      const prob = next1h?.details?.probability_of_precipitation;
      const precipText =
        prob !== undefined ? `${Math.round(prob)}% regn` : "0% regn";

      const item = document.createElement("div");
      item.className = "fav-item";
      item.innerHTML = `
        <div class="fav-left">
          <span class="fav-name">${loc.name}</span>
          <span class="fav-cond">${translateSymbol(symbolCode)}</span>
        </div>
        <div class="fav-right">
          <span class="fav-temp">${temp}°</span>
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

    if (stopPlace?.name) {
      document.getElementById("stop-name").textContent = stopPlace.name;
    }

    // Filter by destination if TARGET_DESTINATION is defined
    if (TARGET_DESTINATION) {
      calls = calls.filter((call) =>
        call.destinationDisplay?.frontText
          ?.toLowerCase()
          .includes(TARGET_DESTINATION.toLowerCase()),
      );
    }

    const listContainer = document.getElementById("transit-list");
    listContainer.innerHTML = "";

    if (!calls.length) {
      listContainer.innerHTML =
        '<div class="loading">Ingen avganger funnet</div>';
      return;
    }

    // Always display top 2 matching departures
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
