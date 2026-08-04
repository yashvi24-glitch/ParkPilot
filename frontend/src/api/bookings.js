import client from "./client";

export const listBookings = (params) => client.get("/bookings", { params }).then((res) => res.data);

export const getBooking = (id) => client.get(`/bookings/${id}`).then((res) => res.data);

export const createBooking = (payload) => client.post("/bookings", payload).then((res) => res.data);

export const cancelBooking = (id) => client.post(`/bookings/${id}/cancel`).then((res) => res.data);

export const checkInParked = (id) => client.post(`/bookings/${id}/check-in`).then((res) => res.data);

export const markFoundCar = (id) => client.post(`/bookings/${id}/found-car`).then((res) => res.data);
