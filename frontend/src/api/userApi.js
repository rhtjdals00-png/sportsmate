import { apiClient } from "./client";

export const userApi = {
  me: () => apiClient.get("/users/me").then((res) => res.data),
  updateMe: (payload) => apiClient.patch("/users/me", payload).then((res) => res.data),
  updateProfileIntroPreference: (payload) => apiClient.patch("/users/me/profile-intro-preference", payload).then((res) => res.data),
  linkEmailAccount: (payload) => apiClient.patch("/users/me/account-link", payload).then((res) => res.data),
  verifyPassword: (payload) => apiClient.post("/users/me/verify-password", payload).then((res) => res.data),
  get: (id) => apiClient.get(`/users/${id}`).then((res) => res.data),
  myMeetings: () => apiClient.get("/users/me/meetings").then((res) => res.data),
  myCalendar: () => apiClient.get("/users/me/calendar").then((res) => res.data),
  myReviews: () => apiClient.get("/users/me/reviews").then((res) => res.data),
  myWrittenReviews: () => apiClient.get("/users/me/reviews/written").then((res) => res.data),
  myReceivedReviews: () => apiClient.get("/users/me/reviews/received").then((res) => res.data),
  myPendingReviews: () => apiClient.get("/users/me/reviews/pending").then((res) => res.data),
  updateReview: (id, payload) => apiClient.put(`/users/me/reviews/${id}`, payload).then((res) => res.data),
  deleteReview: (id) => apiClient.delete(`/users/me/reviews/${id}`).then((res) => res.data)
};
