import axios from "axios";
import { API_BASE_URL } from "./client";

// A fully separate axios instance from api/client.js — the Owner Portal's
// session never shares token state with the User Portal's, so the two can
// coexist in the same browser tab without any risk of cross-contamination.
const ownerClient = axios.create({ baseURL: API_BASE_URL });

// Tokens live in memory only (never localStorage/sessionStorage) — same
// no-persistence philosophy as the User Portal's client.js, so any full page
// reload always requires logging in again.
let ownerAccessToken = null;
let ownerRefreshToken = null;

export const setOwnerAuthTokens = ({ access, refresh } = {}) => {
  if (access !== undefined) ownerAccessToken = access;
  if (refresh !== undefined) ownerRefreshToken = refresh;
};

export const clearOwnerAuthTokens = () => {
  ownerAccessToken = null;
  ownerRefreshToken = null;
};

ownerClient.interceptors.request.use((config) => {
  if (ownerAccessToken) {
    config.headers.Authorization = `Bearer ${ownerAccessToken}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue = [];

const processQueue = (error, token) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
};

ownerClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint =
      originalRequest?.url?.includes("/owner/auth/login") || originalRequest?.url?.includes("/owner/auth/signup");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (!ownerRefreshToken) {
        clearOwnerAuthTokens();
        window.location.href = "/owner/login";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return ownerClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE_URL}/owner/auth/refresh`, { refresh: ownerRefreshToken });
        setOwnerAuthTokens({ access: data.access });
        processQueue(null, data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return ownerClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearOwnerAuthTokens();
        window.location.href = "/owner/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default ownerClient;
