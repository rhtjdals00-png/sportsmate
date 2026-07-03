import { apiClient } from "./client";

const regionCache = new Map();

function regionCacheKey(params = {}) {
  return JSON.stringify(params);
}

function cachedRegions(params = {}) {
  const key = regionCacheKey(params);
  if (!regionCache.has(key)) {
    regionCache.set(key, apiClient.get("/regions", { params }).then((res) => res.data));
  }
  return regionCache.get(key);
}

export const locationApi = {
  regions: (params = {}) => cachedRegions(params),
  mapConfig: () => apiClient.get("/map/config").then((res) => res.data),
  searchPlaces: (params = {}) => apiClient.get("/map/search", { params }).then((res) => res.data),
  reverseGeocode: (params = {}) => apiClient.get("/map/reverse", { params }).then((res) => res.data)
};
