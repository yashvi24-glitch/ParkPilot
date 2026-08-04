import client from "./client";

export const listVehicles = () => client.get("/vehicles").then((res) => res.data);

export const addVehicle = (payload) => client.post("/vehicles", payload).then((res) => res.data);
