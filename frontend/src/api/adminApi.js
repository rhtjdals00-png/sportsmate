import { apiClient } from "./client";

export const adminApi = {
  users: () => apiClient.get("/admin/users").then((res) => res.data),
  meetings: () => apiClient.get("/admin/meetings").then((res) => res.data),
  reports: () => apiClient.get("/admin/reports").then((res) => res.data)
};
