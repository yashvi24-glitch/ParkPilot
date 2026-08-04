import client from "./client";

export const signup = (payload) => client.post("/auth/signup", payload).then((res) => res.data);

export const login = (payload) => client.post("/auth/login", payload).then((res) => res.data);

export const fetchProfile = () => client.get("/auth/profile").then((res) => res.data);

export const updateProfile = (payload) => {
  const isFormData = payload instanceof FormData;
  return client
    .put("/auth/profile", payload, isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined)
    .then((res) => res.data);
};
