import ownerClient from "./ownerClient";

export const ownerSignup = (payload) => ownerClient.post("/owner/auth/signup", payload).then((res) => res.data);

export const ownerLogin = (payload) => ownerClient.post("/owner/auth/login", payload).then((res) => res.data);

export const fetchOwnerProfile = () => ownerClient.get("/owner/auth/profile").then((res) => res.data);

export const updateOwnerProfile = (payload) =>
  ownerClient
    .patch("/owner/auth/profile", payload, payload instanceof FormData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined)
    .then((res) => res.data);

export const getOwnerDashboard = () => ownerClient.get("/owner/parking/dashboard").then((res) => res.data);

export const listOwnerParking = () => ownerClient.get("/owner/parking/locations").then((res) => res.data);

export const getOwnerParking = (id) => ownerClient.get(`/owner/parking/locations/${id}`).then((res) => res.data);

export const createOwnerParking = (payload) =>
  ownerClient.post("/owner/parking/locations", payload).then((res) => res.data);

export const updateOwnerParking = (id, payload) =>
  ownerClient.patch(`/owner/parking/locations/${id}`, payload).then((res) => res.data);

export const deleteOwnerParking = (id) => ownerClient.delete(`/owner/parking/locations/${id}`);

export const uploadOwnerParkingImage = (locationId, file) => {
  const formData = new FormData();
  formData.append("image", file);
  return ownerClient
    .post(`/owner/parking/locations/${locationId}/images`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data);
};

export const deleteOwnerParkingImage = (imageId) => ownerClient.delete(`/owner/parking/images/${imageId}`);

export const addOwnerFloor = (locationId, payload) =>
  ownerClient.post(`/owner/parking/locations/${locationId}/floors`, payload).then((res) => res.data);

export const deleteOwnerFloor = (floorId) => ownerClient.delete(`/owner/parking/floors/${floorId}`);

export const addOwnerSlot = (locationId, floorId, payload) =>
  ownerClient
    .post(`/owner/parking/locations/${locationId}/floors/${floorId}/slots`, payload)
    .then((res) => res.data);

export const listOwnerSlots = (locationId, floorId) =>
  ownerClient.get(`/owner/parking/locations/${locationId}/floors/${floorId}/slots`).then((res) => res.data);

export const updateOwnerSlot = (slotId, payload) =>
  ownerClient.patch(`/owner/parking/slots/${slotId}`, payload).then((res) => res.data);

export const deleteOwnerSlot = (slotId) => ownerClient.delete(`/owner/parking/slots/${slotId}`);

export const duplicateOwnerSlot = (slotId) =>
  ownerClient.post(`/owner/parking/slots/${slotId}/duplicate`).then((res) => res.data);

export const generateOwnerSlots = (locationId, floorId, payload) =>
  ownerClient
    .post(`/owner/parking/locations/${locationId}/floors/${floorId}/slots/generate`, payload)
    .then((res) => res.data);

const importCsv = (path, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return ownerClient
    .post(path, formData, { headers: { "Content-Type": "multipart/form-data" } })
    .then((res) => res.data)
    .catch((err) => {
      if (err.response?.data?.errors) return err.response.data;
      throw err;
    });
};

export const importOwnerLocations = (file) => importCsv("/owner/parking/import/locations", file);
export const importOwnerFloors = (file) => importCsv("/owner/parking/import/floors", file);
export const importOwnerSlots = (file) => importCsv("/owner/parking/import/slots", file);
export const importOwnerPricing = (file) => importCsv("/owner/parking/import/pricing", file);
export const importOwnerFacilities = (file) => importCsv("/owner/parking/import/facilities", file);

// Bookings
export const listOwnerBookings = (params) => ownerClient.get("/owner/bookings/", { params }).then((res) => res.data);

export const getOwnerBookingsSummary = () => ownerClient.get("/owner/bookings/summary").then((res) => res.data);

export const getOwnerBooking = (id) => ownerClient.get(`/owner/bookings/${id}`).then((res) => res.data);

export const completeOwnerBooking = (id) => ownerClient.post(`/owner/bookings/${id}/complete`).then((res) => res.data);

export const cancelOwnerBooking = (id) => ownerClient.post(`/owner/bookings/${id}/cancel`).then((res) => res.data);

// Payments
export const getOwnerPaymentsSummary = () => ownerClient.get("/owner/payments/summary").then((res) => res.data);

export const getOwnerRevenueAnalytics = (range) =>
  ownerClient.get("/owner/payments/revenue", { params: { range } }).then((res) => res.data);

export const listOwnerPaymentHistory = (params) =>
  ownerClient.get("/owner/payments/history", { params }).then((res) => res.data);

// Reports & Analytics
export const getOwnerReportsSummary = () => ownerClient.get("/owner/reports/summary").then((res) => res.data);

export const getOwnerBookingTrends = (range) =>
  ownerClient.get("/owner/reports/booking-trends", { params: { range } }).then((res) => res.data);

export const getOwnerOccupancyWeekday = () => ownerClient.get("/owner/reports/occupancy-weekday").then((res) => res.data);

export const getOwnerPeakHours = () => ownerClient.get("/owner/reports/peak-hours").then((res) => res.data);

export const getOwnerVehicleDistribution = () => ownerClient.get("/owner/reports/vehicle-distribution").then((res) => res.data);

export const getOwnerParkingPerformance = () => ownerClient.get("/owner/reports/parking-performance").then((res) => res.data);

export const getOwnerFloorPerformance = () => ownerClient.get("/owner/reports/floor-performance").then((res) => res.data);

// Notifications
export const listOwnerNotifications = () => ownerClient.get("/owner/notifications/").then((res) => res.data);

export const markOwnerNotificationRead = (id) => ownerClient.post(`/owner/notifications/${id}/read`).then((res) => res.data);

export const markAllOwnerNotificationsRead = () => ownerClient.post("/owner/notifications/read-all").then((res) => res.data);

// Security
export const changeOwnerPassword = (payload) =>
  ownerClient.post("/owner/auth/change-password", payload).then((res) => res.data);
