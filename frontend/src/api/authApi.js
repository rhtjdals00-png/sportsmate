import { apiClient } from "./client";

export const authApi = {
  register: (payload) => apiClient.post("/auth/register", payload).then((res) => res.data),
  login: (payload) => apiClient.post("/auth/login", payload).then((res) => res.data),
  socialLogin: (payload) => apiClient.post("/auth/social-login", payload).then((res) => res.data),
  me: () => apiClient.get("/auth/me").then((res) => res.data),
  sync: (payload, supabaseAccessToken) => apiClient.post("/auth/sync", payload, {
    headers: { "X-Supabase-Access-Token": supabaseAccessToken }
  }).then((res) => res.data),
  availability: (field, value) => apiClient.get("/auth/availability", { params: { field, value } }).then((res) => res.data),
  requestEmailVerification: (email) => apiClient.post("/auth/email-verification", { email }).then((res) => res.data)
};
