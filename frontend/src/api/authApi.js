import { apiClient } from "./client";

export const authApi = {
  me: () => apiClient.get("/auth/me").then((res) => res.data),
  sync: (payload, supabaseAccessToken) => apiClient.post("/auth/sync", payload, {
    headers: { "X-Supabase-Access-Token": supabaseAccessToken }
  }).then((res) => res.data),
  availability: (field, value) => apiClient.get("/auth/availability", { params: { field, value } }).then((res) => res.data),
  requestEmailVerification: (email) => apiClient.post("/auth/email-verification", { email }).then((res) => res.data),
  restore: () => apiClient.post("/auth/restore").then((res) => res.data)
};
