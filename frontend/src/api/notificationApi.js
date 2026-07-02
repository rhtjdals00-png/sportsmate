import { apiClient } from "./client";

export const notificationApi = {
  list: () => apiClient.get("/notifications").then((res) => res.data),
  read: (id) => apiClient.patch(`/notifications/${id}/read`).then((res) => res.data),
  pushPublicKey: () => apiClient.get("/push-public-key").then((res) => res.data),
  savePushSubscription: (payload) => apiClient.post("/push-subscriptions", payload).then((res) => res.data)
};
