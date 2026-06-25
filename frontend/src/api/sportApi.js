import { apiClient } from "./client";

export const sportApi = {
  categories: () => apiClient.get("/sport-categories").then((res) => res.data),
  sports: (params = {}) => apiClient.get("/sports", { params }).then((res) => res.data),
  purposes: () => apiClient.get("/sport-purposes").then((res) => res.data)
};
