import client from "./client";

export const listNotifications = () => client.get("/notifications").then((res) => res.data);

export const markNotificationRead = (id) => client.post(`/notifications/${id}/read`).then((res) => res.data);

export const markAllNotificationsRead = () => client.post("/notifications/read-all").then((res) => res.data);
