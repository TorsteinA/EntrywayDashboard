const express = require("express");
const path = require("path");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// Default configuration (Lillestrøm bussterminal / specific stop)
const LAT = process.env.LAT || "59.9550";
const LON = process.env.LON || "11.0500";
const STOP_PLACE_ID = process.env.STOP_PLACE_ID || "NSR:StopPlace:58211";

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
    res.status(500).json({ error: "Interne tjenerfeil" });
  }
});

// Proxy for Entur GraphQL API (Fetch 2 departures for the specific stop)
app.post("/api/transit", async (req, res) => {
  try {
    const query = `
      query GetDepartures($id: String!) {
        stopPlace(id: $id) {
          name
          estimatedCalls(numberOfDepartures: 2, timeRange: 7200) {
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
        .json({ error: "Kunne ikke hente kollektivdata" });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Transit Proxy Error:", err);
    res.status(500).json({ error: "Interne tjenerfeil" });
  }
});

app.listen(PORT, () => {
  console.log(`Server kjører på port ${PORT}`);
});
