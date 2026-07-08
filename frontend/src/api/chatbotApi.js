import { apiClient } from "./client";

export const chatbotApi = {
  sessions: () => apiClient.get("/chatbot/sessions").then((res) => res.data),
  createSession: (payload) => apiClient.post("/chatbot/sessions", payload).then((res) => res.data),
  messages: (sessionId) => apiClient.get(`/chatbot/sessions/${sessionId}/messages`).then((res) => res.data),
  sendMessage: (sessionId, payload) => apiClient.post(`/chatbot/sessions/${sessionId}/message`, payload).then((res) => res.data),
  deleteSession: (sessionId) => apiClient.delete(`/chatbot/sessions/${sessionId}`).then((res) => res.data)
};
