import { apiClient } from "./client";

export const chatApi = {
  rooms: () => apiClient.get(`/chatrooms?_=${Date.now()}`).then((res) => res.data),
  messages: (roomId, params = {}) => apiClient.get(`/chatrooms/${roomId}/messages`, { params }).then((res) => res.data),
  send: (roomId, payload) => apiClient.post(`/chatrooms/${roomId}/messages`, payload).then((res) => res.data),
  leave: (roomId) => apiClient.post(`/chatrooms/${roomId}/leave`).then((res) => res.data),
  directRooms: () => apiClient.get("/chatrooms/direct").then((res) => res.data),
  createDirectRoom: (userId) => apiClient.post("/chatrooms/direct", { user_id: userId }).then((res) => res.data),
  directMessages: (roomId, params = {}) => apiClient.get(`/chatrooms/direct/${roomId}/messages`, { params }).then((res) => res.data),
  sendDirect: (roomId, payload) => apiClient.post(`/chatrooms/direct/${roomId}/messages`, payload).then((res) => res.data),
  uploadImage: (file, { roomId, roomType }) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("room_id", String(roomId));
    formData.append("room_type", roomType);
    return apiClient.post("/chatrooms/uploads", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    }).then((res) => res.data);
  },
  mute: (roomId, roomType = "meeting") => apiClient.post("/chatrooms/mute", { room_id: roomId, room_type: roomType }).then((res) => res.data),
  unmute: (roomId, roomType = "meeting") => apiClient.post("/chatrooms/unmute", { room_id: roomId, room_type: roomType }).then((res) => res.data),
  mutedRooms: () => apiClient.get("/chatrooms/muted").then((res) => res.data)
};

