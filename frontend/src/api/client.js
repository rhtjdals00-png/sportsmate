import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("sportsmate_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const msg = error.response.data?.message || error.response.data?.msg;
      if (msg === "정지된 회원입니다.") {
        if (!window.hasAlertedSuspended) {
          window.hasAlertedSuspended = true;
          alert("정지된 회원입니다.");
          localStorage.removeItem("sportsmate_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

