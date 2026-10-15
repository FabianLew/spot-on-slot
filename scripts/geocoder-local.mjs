#!/usr/bin/env node
/**
 * Offline stand-in for the Photon geocoder, for local development and demos when photon.komoot.io is slow or
 * unreachable. It knows a list of Polish towns: /reverse answers the nearest one, /api suggests towns whose name
 * starts with the query. Streets and house numbers are not known, so venue addresses keep the point they are given.
 *
 *   pnpm geocoder:local                                   (listens on http://localhost:2322, PORT changes it)
 *   LOCATION_GEOCODER_URL=http://localhost:2322 ./gradlew bootRun
 */
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 2322);

// [name, region, latitude, longitude]
const TOWNS = [
  ["Kraków", "małopolskie", 50.0619, 19.9369],
  ["Wieliczka", "małopolskie", 49.9871, 20.0647],
  ["Skawina", "małopolskie", 49.9750, 19.8283],
  ["Niepołomice", "małopolskie", 50.0340, 20.2180],
  ["Zielonki", "małopolskie", 50.1186, 19.9206],
  ["Tarnów", "małopolskie", 50.0121, 20.9858],
  ["Nowy Sącz", "małopolskie", 49.6249, 20.6914],
  ["Zakopane", "małopolskie", 49.2992, 19.9496],
  ["Katowice", "śląskie", 50.2649, 19.0238],
  ["Gliwice", "śląskie", 50.2945, 18.6714],
  ["Warszawa", "mazowieckie", 52.2297, 21.0122],
  ["Łódź", "łódzkie", 51.7592, 19.4560],
  ["Wrocław", "dolnośląskie", 51.1079, 17.0385],
  ["Poznań", "wielkopolskie", 52.4064, 16.9252],
  ["Gdańsk", "pomorskie", 54.3520, 18.6466],
  ["Gdynia", "pomorskie", 54.5189, 18.5305],
  ["Szczecin", "zachodniopomorskie", 53.4285, 14.5528],
  ["Bydgoszcz", "kujawsko-pomorskie", 53.1235, 18.0084],
  ["Toruń", "kujawsko-pomorskie", 53.0138, 18.5984],
  ["Lublin", "lubelskie", 51.2465, 22.5684],
  ["Rzeszów", "podkarpackie", 50.0412, 21.9991],
  ["Białystok", "podlaskie", 53.1325, 23.1688],
  ["Olsztyn", "warmińsko-mazurskie", 53.7784, 20.4801],
  ["Kielce", "świętokrzyskie", 50.8661, 20.6286],
  ["Opole", "opolskie", 50.6751, 17.9213],
  ["Zielona Góra", "lubuskie", 51.9356, 15.5062],
];

const fold = (text) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");

function feature([name, region, latitude, longitude]) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [longitude, latitude] },
    properties: { osm_key: "place", osm_value: "city", type: "city", name, state: `województwo ${region}`, country: "Polska", countrycode: "PL" },
  };
}

function nearest(latitude, longitude) {
  const distance = ([, , lat, lon]) => (lat - latitude) ** 2 + ((lon - longitude) * Math.cos((latitude * Math.PI) / 180)) ** 2;
  return TOWNS.reduce((best, town) => (distance(town) < distance(best) ? town : best));
}

createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  let features = [];
  if (url.pathname === "/reverse") {
    const latitude = Number(url.searchParams.get("lat"));
    const longitude = Number(url.searchParams.get("lon"));
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) features = [feature(nearest(latitude, longitude))];
  } else if (url.pathname === "/api") {
    const query = fold(url.searchParams.get("q") ?? "").trim();
    const limit = Number(url.searchParams.get("limit") ?? 5);
    features = TOWNS.filter(([name]) => query && fold(name).startsWith(query.split(/[\s,]/)[0])).slice(0, limit).map(feature);
  }
  response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ type: "FeatureCollection", features }));
}).listen(PORT, () => {
  console.log(`Local geocoder on http://localhost:${PORT}. Start the backend with LOCATION_GEOCODER_URL=http://localhost:${PORT}`);
});
