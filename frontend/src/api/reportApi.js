import { apiClient } from "./client";

export const reportApi = {
  create: (payload) => apiClient.post("/reports", payload).then((res) => res.data)
};

