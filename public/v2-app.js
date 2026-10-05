// Configure favorite locations here
const favoriteLocations = [
  { name: "Helsfyr", lat: 59.9139, lon: 10.8031 },
  { name: "Kongsvinger", lat: 60.1905, lon: 12.0034 },
  { name: "Asker", lat: 59.8338, lon: 10.4354 },
];

// Destination to filter OUT (incoming buses)
const EXCLUDE_DESTINATION = "Vardefjellet";

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

    // High / Low for today
    let high = -Infinity,
      low = Infinity;
    timeseries.slice(0, 24).forEach((ts) => {
      const t = ts.data.instant.details.air_temperature;
      if (t > high) high = t;
      if (t < low) low = t;
    });
    document.getElementById("high-temp").textContent = `${Math.round(high)}°`;
    document.getElementById("low-temp").textContent = `${Math.round(low)}°`;

    // 3-hour forecast
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

// Fetch travel weather for favorite locations (+2h forecast & today's range)
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
      const timeseries = data.properties.timeseries;
      if (!timeseries?.length) continue;

      // Arrival forecast (~2 hours ahead)
      const arrivalData = timeseries[2] || timeseries[0];
      const arrivalTemp = Math.round(
        arrivalData.data.instant.details.air_temperature,
      );
      const symbolCode =
        arrivalData.data.next_1_hours?.summary?.symbol_code ||
        arrivalData.data.next_6_hours?.summary?.symbol_code;

      const prob =
        arrivalData.data.next_1_hours?.details?.probability_of_precipitation;
      const precipText =
        prob !== undefined ? `${Math.round(prob)}% regn` : "0% regn";

      // Calculate today's High / Low for packing advice
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
        <div class="fav-left">
          <span class="fav-name">${loc.name}</span>
          <span class="fav-arrival-info">Kl. ${arrivalTime}: ${translateSymbol(symbolCode)}</span>
        </div>
        <div class="fav-right">
          <span class="fav-temp">${arrivalTemp}°</span>
          <span class="fav-range">Dag: ${Math.round(high)}° / ${Math.round(low)}°</span>
          <span class="fav-precip">${precipText}</span>
        </div>
      `;
      container.appendChild(item);
    } catch (err) {
      console.error(`Error loading weather for ${loc.name}:`, err);
    }
  }
}

// Fetch public transit departures (skipping incoming buses)
async function fetchTransit() {
  try {
    const res = await fetch("/api/transit", { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    const stopPlace = data.data?.stopPlace;
    let calls = stopPlace?.estimatedCalls || [];

    if (stopPlace?.name)
      document.getElementById("stop-name").textContent = stopPlace.name;

    // Invert check: Filter out incoming buses heading to Vardefjellet
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

// Initializing
updateClock();
setInterval(updateClock, 1000);

fetchHomeWeather();
fetchFavoriteWeather();
fetchTransit();

// Intervals
setInterval(fetchTransit, 30 * 1000);
setInterval(fetchHomeWeather, 12 * 60 * 1000);
setInterval(fetchFavoriteWeather, 15 * 60 * 1000);
