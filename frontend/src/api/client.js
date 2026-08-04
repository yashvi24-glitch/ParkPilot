import axios from "axios";

// Derived from the page's own hostname (not hardcoded to localhost) so the same
// build works whether it's opened on this machine or from another device on the
// LAN via this machine's IP.
export const API_BASE_URL = `http://${window.location.hostname}:8000/api`;

const client = axios.create({ baseURL: API_BASE_URL });

// Tokens live in memory only (never localStorage/sessionStorage) so a full
// page reload — including whenever the backend/frontend dev servers are
// restarted — always requires logging in again.
let accessToken = null;
let refreshToken = null;

export const setAuthTokens = ({ access, refresh } = {}) => {
  if (access !== undefined) accessToken = access;
  if (refresh !== undefined) refreshToken = refresh;
};

export const clearAuthTokens = () => {
  accessToken = null;
  refreshToken = null;
};

client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
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

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest?.url?.includes("/auth/login") || originalRequest?.url?.includes("/auth/signup");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (!refreshToken) {
        clearAuthTokens();
        window.location.href = "/app";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh: refreshToken });
        setAuthTokens({ access: data.access });
        processQueue(null, data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuthTokens();
        window.location.href = "/app";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;
