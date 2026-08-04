import client from "./client";

export const searchParking = (params) => client.get("/parking/search", { params }).then((res) => res.data);

export const nearbyParking = (params) => client.get("/parking/nearby", { params }).then((res) => res.data);

export const getCities = () => client.get("/parking/cities").then((res) => res.data);

export const getParkingDetail = (id, params) => client.get(`/parking/${id}`, { params }).then((res) => res.data);

export const getParkingFloors = (locationId) => client.get(`/parking/${locationId}/floors`).then((res) => res.data);

export const getFloorSlots = (locationId, floorId) =>
  client.get(`/parking/${locationId}/floors/${floorId}/slots`).then((res) => res.data);
