const express = require("express");
const path = require("path");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// Default configuration (Lillestrøm bussterminal / specific stop)
const LAT = process.env.LAT || "59.9550";
const LON = process.env.LON || "11.0500";
const STOP_PLACE_ID = process.env.STOP_PLACE_ID || "NSR:StopPlace:58211";

// Postal code configuration
const POSTAL_CODE = process.env.POSTAL_CODE || "1900";
const COUNTRY_CODE = process.env.COUNTRY_CODE || "NO";
const MYBRING_USER = process.env.MYBRING_USER || "";
const MYBRING_KEY = process.env.MYBRING_KEY || "";
const BRING_CLIENT_URL =
  process.env.BRING_CLIENT_URL || "http://localhost:3000";

// Waste service configuration
const ROAF_KOMMUNENR = process.env.ROAF_KOMMUNENR || "3205";
const ROAF_GATENAVN = process.env.ROAF_GATENAVN || "";
const ROAF_GATEKODE = process.env.ROAF_GATEKODE || "";
const ROAF_HUSNR = process.env.ROAF_HUSNR || "";

const USER_AGENT =
  process.env.USER_AGENT || "MyEntryDashboard/1.0 (admin@local.home)";
const ET_CLIENT_NAME = process.env.ET_CLIENT_NAME || "myhome-entrykiosk";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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
    res.status(500).json({ error: "Interne tjenerfeil" });
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
    // You can pass either a StopPlace ID (NSR:StopPlace:...) or a Quay ID (NSR:Quay:...)
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
    const kommunenr = process.env.ROAF_KOMMUNENR || "3205";
    const gatenavn = process.env.ROAF_GATENAVN || "";
    const gatekode = process.env.ROAF_GATEKODE || "";
    const husnr = process.env.ROAF_HUSNR || "";

    if (!kommunenr || !gatenavn || !gatekode || !husnr) {
      console.error("Could not find address keys.");
      return res.status(400).json({ error: "Missing ROAF address parameters" });
    }

    // 1. Build the inner URL parameters securely
    const params = new URLSearchParams({
      kommunenr: kommunenr,
      gatenavn: gatenavn,
      gatekode: gatekode,
      husnr: husnr,
    });

    // 2. Direct Backend API URL
    const directUrl = `https://komteksky.norkart.no/MinRenovasjon.Api/api/tommekalender?${params.toString()}`;

    // 3. Azure Proxy URL (The ENTIRE directUrl must be URL-encoded so the '&'s don't break the proxy)
    const proxyUrl = `https://norkartrenovasjon.azurewebsites.net/proxyserver.ashx?server=${encodeURIComponent(directUrl)}`;

    console.log(`[ROAF Proxy] Trying direct fetch...`);

    // **CRITICAL FIX**: Norkart strictly requires 'Kommunenr' in the HTTP headers now.
    const headers = {
      RenovasjonAppKey: "AE47EE09-2930-4B9A-B244-96B15B64E026",
      Kommunenr: kommunenr,
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    };

    // Try Direct API First
    let response = await fetch(directUrl, { method: "GET", headers });

    // Fallback to Azure Proxy if Direct blocks us
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
