import { apiClient } from "./client";

export const userApi = {
  me: () => apiClient.get("/users/me").then((res) => res.data),
  updateMe: (payload) => apiClient.patch("/users/me", payload).then((res) => res.data),
  myMeetings: () => apiClient.get("/users/me/meetings").then((res) => res.data),
  myReviews: () => apiClient.get("/users/me/reviews").then((res) => res.data)
};

