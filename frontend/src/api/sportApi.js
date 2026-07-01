import { apiClient } from "./client";

const cache = new Map();

function cacheKey(name, params = {}) {
  return `${name}:${JSON.stringify(params)}`;
}

function cachedGet(name, path, params = {}) {
  const key = cacheKey(name, params);
  if (!cache.has(key)) {
    cache.set(key, apiClient.get(path, { params }).then((res) => res.data));
  }
  return cache.get(key);
}

export const sportApi = {
  categories: () => cachedGet("categories", "/sport-categories"),
  sports: (params = {}) => cachedGet("sports", "/sports", params),
  purposes: () => cachedGet("purposes", "/sport-purposes")
};
