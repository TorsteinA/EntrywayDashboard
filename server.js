const express = require("express");
const path = require("path");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

const LAT = process.env.LAT || "59.9550";
const LON = process.env.LON || "11.0500";
const WORK_LAT = process.env.WORK_LAT || "59.9139";
const WORK_LON = process.env.WORK_LON || "10.8031";
const STOP_PLACE_ID = process.env.STOP_PLACE_ID || "NSR:StopPlace:58211";
const EXCLUDE_DESTINATION = process.env.EXCLUDE_DESTINATION || "";

const POSTAL_CODE = process.env.POSTAL_CODE || "1900";
const COUNTRY_CODE = process.env.COUNTRY_CODE || "NO";
const MYBRING_USER = process.env.MYBRING_USER || "";
const MYBRING_KEY = process.env.MYBRING_KEY || "";
const BRING_CLIENT_URL =
  process.env.BRING_CLIENT_URL || "http://localhost:3000";

const ROAF_KOMMUNENR = process.env.ROAF_KOMMUNENR || "3205";
const ROAF_GATENAVN = process.env.ROAF_GATENAVN || "";
const ROAF_GATEKODE = process.env.ROAF_GATEKODE || "";
const ROAF_HUSNR = process.env.ROAF_HUSNR || "";

const USER_AGENT =
  process.env.USER_AGENT || "MyEntryDashboard/1.0 (admin@local.home)";
const ET_CLIENT_NAME = process.env.ET_CLIENT_NAME || "myhome-entrykiosk";
const FAVORITE_LOCATIONS = process.env.FAVORITE_LOCATIONS
  ? JSON.parse(process.env.FAVORITE_LOCATIONS)
  : [];

// 15-Minute Cache for Single Commute Route
let cachedCommute = null;
let lastCommuteFetch = 0;
const COMMUTE_CACHE_TTL = 15 * 60 * 1000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Endpoint serving app configuration to frontend
app.get("/api/config", (req, res) => {
  res.json({
    favoriteLocations: FAVORITE_LOCATIONS,
    excludeDestination: EXCLUDE_DESTINATION,
  });
});

app.get("/api/commute-eta", async (req, res) => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 6 = Sat
  const hour = now.getHours();
  const mins = now.getMinutes();
  const timeInMins = hour * 60 + mins;

  // Active Window: Mon-Fri between 06:30 (390m) and 09:15 (555m)
  const isWeekday = day >= 1 && day <= 5;
  const isMorningCommute = isWeekday && timeInMins >= 390 && timeInMins <= 555;

  // Serve cache if fresh
  if (cachedCommute && Date.now() - lastCommuteFetch < COMMUTE_CACHE_TTL) {
    return res.json({ active: isMorningCommute, ...cachedCommute });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !isMorningCommute) {
    return res.json({ active: false, data: cachedCommute?.data || null });
  }

  try {
    const originLat = parseFloat(LAT);
    const originLon = parseFloat(LON);
    const destLat = parseFloat(WORK_LAT);
    const destLon = parseFloat(WORK_LON);

    // Google Routes API requires departureTime to be in the future for TRAFFIC_AWARE.
    // Setting 5 minutes into the future aligns with the "Leaving in 5 mins" widget display.
    const departureDate = new Date(Date.now() + 5 * 60 * 1000);

    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: originLat,
            longitude: originLon,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destLat,
            longitude: destLon,
          },
        },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      departureTime: departureDate.toISOString(),
    };

    const response = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.staticDuration",
        },
        body: JSON.stringify(requestBody),
      },
    );

    const responseText = await response.text();

    if (!response.ok) {
      console.error(
        `[Commute ETA Error] HTTP Status: ${response.status} ${response.statusText}`,
      );
      console.error("[Commute ETA Error] Google Response Body:", responseText);
      throw new Error(`Google Routes API returned status ${response.status}`);
    }

    const data = JSON.parse(responseText);
    const route = data.routes?.[0];

    if (route) {
      const durationSec = parseInt(route.duration, 10) || 0;
      const normalSec = parseInt(route.staticDuration, 10) || durationSec;

      const travelMins = Math.round(durationSec / 60);
      const delayMins = Math.max(0, Math.round((durationSec - normalSec) / 60));

      // Expected arrival time: departureDate + travel duration
      const arrivalDate = new Date(
        departureDate.getTime() + travelMins * 60 * 1000,
      );
      const arrivalTimeStr = arrivalDate.toLocaleTimeString("no-NO", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Oslo",
      });

      cachedCommute = {
        data: {
          travelMins,
          delayMins,
          arrivalTimeStr,
          trafficStatus:
            delayMins >= 5 ? "heavy" : delayMins >= 2 ? "moderate" : "normal",
        },
      };
      lastCommuteFetch = Date.now();

      return res.json({ active: true, ...cachedCommute });
    }

    res.json({ active: false, data: null });
  } catch (err) {
    console.error("Commute ETA Proxy Error:", err);
    res.json({ active: false, data: cachedCommute?.data || null });
  }
});

// Proxy for MET Norway Weather API
app.get("/api/weather", async (req, res) => {
  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${LAT}&lon=${LON}`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: "Kunne ikke hente værdata" });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Weather Proxy Error:", err);
    res.status(500).json({ error: "Intern tjenerfeil" });
  }
});

app.get("/api/weather/custom", async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon)
    return res.status(400).json({ error: "Mangler lat/lon parametere" });

  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok)
      return res
        .status(response.status)
        .json({ error: "Kunne ikke hente værdata" });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Intern tjenerfeil" });
  }
});

// Proxy Endpoint for Bring/Posten Delivery Dates API
app.get("/api/post", async (req, res) => {
  try {
    const url = `http://api.bring.com/address/api/${COUNTRY_CODE}/postal-codes/${POSTAL_CODE}/mailbox-delivery-dates?lookAhead=4`;

    console.log(`[Posten Proxy] Fetching URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        "X-Mybring-API-Uid": MYBRING_USER,
        "X-Mybring-API-Key": MYBRING_KEY,
        "X-Bring-Client-URL": BRING_CLIENT_URL,
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(
        `[Posten Proxy Error] Status: ${response.status} ${response.statusText}`,
      );
      console.error(`[Posten Proxy Response]:`, responseText);
      return res.status(response.status).json({
        error: "Failed to fetch mail delivery status",
        status: response.status,
        details: responseText,
      });
    }

    const data = JSON.parse(responseText);
    res.json(data);
  } catch (err) {
    console.error("[Posten Proxy Exception]:", err);
    res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

// Proxy endpoint for Entur / Ruter GraphQL API
app.post("/api/transit", async (req, res) => {
  try {
    const query = `
      query GetDepartures($id: String!) {
        stopPlace(id: $id) {
          name
          estimatedCalls(numberOfDepartures: 10, timeRange: 7200) {
            realtime
            aimedDepartureTime
            expectedDepartureTime
            destinationDisplay {
              frontText
            }
            serviceJourney {
              journeyPattern {
                line {
                  publicCode
                  transportMode
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(
      "https://api.entur.io/journey-planner/v3/graphql",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ET-Client-Name": ET_CLIENT_NAME,
        },
        body: JSON.stringify({
          query,
          variables: { id: STOP_PLACE_ID },
        }),
      },
    );

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: "Failed to fetch transit data" });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Transit Proxy Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Proxy endpoint for ROAF / MinRenovasjon
app.get("/api/waste", async (req, res) => {
  try {
    const kommunenr = ROAF_KOMMUNENR;
    const gatenavn = ROAF_GATENAVN;
    const gatekode = ROAF_GATEKODE;
    const husnr = ROAF_HUSNR;

    if (!kommunenr || !gatenavn || !gatekode || !husnr) {
      console.error("Could not find address keys.");
      return res.status(400).json({ error: "Missing ROAF address parameters" });
    }

    const params = new URLSearchParams({
      kommunenr: kommunenr,
      gatenavn: gatenavn,
      gatekode: gatekode,
      husnr: husnr,
    });

    console.log(`[ROAF Proxy] Trying direct fetch...`);

    const directUrl = `https://komteksky.norkart.no/MinRenovasjon.Api/api/tommekalender?${params.toString()}`;

    const proxyUrl = `https://norkartrenovasjon.azurewebsites.net/proxyserver.ashx?server=${encodeURIComponent(directUrl)}`;

    const headers = {
      RenovasjonAppKey: "AE47EE09-2930-4B9A-B244-96B15B64E026",
      Kommunenr: kommunenr,
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    };

    let response = await fetch(directUrl, { method: "GET", headers });

    if (!response.ok) {
      console.log(
        `[ROAF Proxy] Direct failed (${response.status}), falling back to Azure Proxy...`,
      );
      response = await fetch(proxyUrl, { method: "GET", headers });
    }

    const responseText = await response.text();

    if (!response.ok) {
      console.error(
        `[ROAF Error] Status: ${response.status} ${response.statusText}`,
      );
      console.error(`[ROAF Response]:`, responseText);
      return res.status(response.status).json({
        error: "Failed to fetch waste pickup data",
        status: response.status,
        details: responseText,
      });
    }

    const data = JSON.parse(responseText);
    res.json(data);
  } catch (err) {
    console.error("[ROAF Exception]:", err);
    res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
