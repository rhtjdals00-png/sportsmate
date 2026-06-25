import { apiClient } from "./client";

export const locationApi = {
  regions: (params = {}) => apiClient.get("/regions", { params }).then((res) => res.data),
  searchPlaces: (params = {}) => apiClient.get("/map/search", { params }).then((res) => res.data)
};
