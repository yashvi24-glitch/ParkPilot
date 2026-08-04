import client from "./client";

export const geocode = (q) => client.get("/navigation/geocode", { params: { q } }).then((res) => res.data);

export const reverseGeocode = (lat, lng) =>
  client.get("/navigation/reverse", { params: { lat, lng } }).then((res) => res.data);

export const getRoute = ({ fromLat, fromLng, toLat, toLng, mode = "driving" }) =>
  client
    .get("/navigation/route", {
      params: { from_lat: fromLat, from_lng: fromLng, to_lat: toLat, to_lng: toLng, mode },
    })
    .then((res) => res.data);
