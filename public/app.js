// Clock and Date updates
function updateClock() {
  const now = new Date();

  const timeStr = now.toLocaleTimeString("no-NO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  document.getElementById("time").textContent = timeStr;
  document.getElementById("date").textContent = dateStr;
}

// Format API condition codes into cleaner labels
function formatSymbol(code) {
  if (!code) return "";
  return code
    .replace(/_/g, " ")
    .replace(/night|day|polarnight/g, "")
    .trim();
}

// Fetch and Render Weather Data
async function fetchWeather() {
  try {
    const res = await fetch("/api/weather");
    if (!res.ok) throw new Error("Weather fetch failed");

    const data = await res.json();
    const timeseries = data.properties.timeseries;

    if (!timeseries || timeseries.length === 0) return;

    // Current weather
    const current = timeseries[0].data;
    const currentTemp = Math.round(current.instant.details.air_temperature);
    const symbolCode =
      current.next_1_hours?.summary?.symbol_code ||
      current.next_6_hours?.summary?.symbol_code;
    const conditionText = formatSymbol(symbolCode);

    document.getElementById("current-temp").textContent = `${currentTemp}°`;
    document.getElementById("header-temp").textContent = `${currentTemp}°C`;
    document.getElementById("condition-text").textContent = conditionText;
    document.getElementById("header-condition").textContent = conditionText;

    // Today High / Low calculation (from first 24 hours of forecast)
    const todaySeries = timeseries.slice(0, 24);
    let high = -Infinity;
    let low = Infinity;

    todaySeries.forEach((ts) => {
      const temp = ts.data.instant.details.air_temperature;
      if (temp > high) high = temp;
      if (temp < low) low = temp;
    });

    document.getElementById("high-temp").textContent = `${Math.round(high)}°`;
    document.getElementById("low-temp").textContent = `${Math.round(low)}°`;

    // 3-Hour Forecast Summary
    const forecastContainer = document.getElementById("forecast-3h");
    forecastContainer.innerHTML = "";

    for (let i = 1; i <= 3; i++) {
      const entry = timeseries[i];
      if (!entry) break;

      const time = new Date(entry.time).toLocaleTimeString("no-NO", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const temp = Math.round(entry.data.instant.details.air_temperature);

      const item = document.createElement("div");
      item.className = "forecast-item";
      item.innerHTML = `
        <div class="f-time">${time}</div>
        <div class="f-temp">${temp}°</div>
      `;
      forecastContainer.appendChild(item);
    }
  } catch (err) {
    console.error("Error loading weather:", err);
  }
}

// Format Departure Countdown
function formatDepartureTime(expectedTimeStr) {
  const now = new Date();
  const depTime = new Date(expectedTimeStr);
  const diffMinutes = Math.round((depTime - now) / 60000);

  if (diffMinutes <= 0) return { text: "Now", isDue: true };
  if (diffMinutes < 60)
    return { text: `${diffMinutes} min`, isDue: diffMinutes <= 2 };

  return {
    text: depTime.toLocaleTimeString("no-NO", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    isDue: false,
  };
}

// Fetch and Render Public Transit Data
async function fetchTransit() {
  try {
    const res = await fetch("/api/transit", { method: "POST" });
    if (!res.ok) throw new Error("Transit fetch failed");

    const data = await res.json();
    const stopPlace = data.data?.stopPlace;
    const calls = stopPlace?.estimatedCalls || [];

    if (stopPlace?.name) {
      document.getElementById("stop-name").textContent = stopPlace.name;
    }

    const listContainer = document.getElementById("transit-list");
    listContainer.innerHTML = "";

    if (calls.length === 0) {
      listContainer.innerHTML =
        '<div class="loading">No upcoming departures found</div>';
      return;
    }

    calls.forEach((call) => {
      const line = call.serviceJourney.journeyPattern.line;
      const lineCode = line.publicCode || "";
      const transportMode = (line.transportMode || "bus").toLowerCase();
      const destination = call.destinationDisplay?.frontText || "Unknown";
      const timeInfo = formatDepartureTime(call.expectedDepartureTime);

      const item = document.createElement("div");
      item.className = `transit-item ${transportMode}`;
      item.innerHTML = `
        <div class="transit-left">
          <span class="line-number">${lineCode}</span>
          <span class="destination">${destination}</span>
        </div>
        <span class="time-until ${timeInfo.isDue ? "due" : ""}">${timeInfo.text}</span>
      `;
      listContainer.appendChild(item);
    });
  } catch (err) {
    console.error("Error loading transit data:", err);
  }
}

// Initial Loading & Auto-refresh Schedule
updateClock();
setInterval(updateClock, 1000);

fetchWeather();
fetchTransit();

// Periodic Refreshes
setInterval(fetchTransit, 30 * 1000); // Refresh transit every 30 seconds
setInterval(fetchWeather, 12 * 60 * 1000); // Refresh weather every 12 minutes
