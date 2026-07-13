import { apiClient } from "./client";

export const notificationApi = {
  list: () => apiClient.get("/notifications").then((res) => res.data),
  summary: () => apiClient.get("/notifications/summary").then((res) => res.data),
  read: (id) => apiClient.patch(`/notifications/${id}/read`).then((res) => res.data),
  readAll: () => apiClient.patch("/notifications/read-all").then((res) => res.data),
  readChatRoom: (roomId) => apiClient.patch(`/notifications/chatrooms/${roomId}/read`).then((res) => res.data),
  pushPublicKey: () => apiClient.get("/push-public-key").then((res) => res.data),
  savePushSubscription: (payload) => apiClient.post("/push-subscriptions", payload).then((res) => res.data)
};
