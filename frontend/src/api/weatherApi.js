import { apiClient } from "./client";

export const weatherApi = {
  forecast: (params) => apiClient.get("/weather/forecast", { params }).then((res) => res.data),
  daily: (params) => apiClient.get("/weather/daily", { params }).then((res) => res.data),
};
