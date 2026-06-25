import { apiClient } from "./client";

export const chatApi = {
  rooms: () => apiClient.get("/chatrooms").then((res) => res.data),
  messages: (roomId) => apiClient.get(`/chatrooms/${roomId}/messages`).then((res) => res.data),
  send: (roomId, payload) => apiClient.post(`/chatrooms/${roomId}/messages`, payload).then((res) => res.data)
};

