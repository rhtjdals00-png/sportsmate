import { apiClient } from "./client";

export const adminApi = {
  users: () => apiClient.get(`/admin/users?_=${Date.now()}`).then((res) => res.data),
  userDetail: (userId) => apiClient.get(`/admin/users/${userId}?_=${Date.now()}`).then((res) => res.data),
  meetings: () => apiClient.get(`/admin/meetings?_=${Date.now()}`).then((res) => res.data),
  meetingDetail: (meetingId) => apiClient.get(`/admin/meetings/${meetingId}?_=${Date.now()}`).then((res) => res.data),
  reports: () => apiClient.get("/admin/reports").then((res) => res.data),
  deleteMeeting: (meetingId) => apiClient.delete(`/admin/meetings/${meetingId}`).then((res) => res.data),
  restoreMeeting: (meetingId) => apiClient.post(`/admin/meetings/${meetingId}/restore`).then((res) => res.data),
  kickMember: (meetingId, userId) => apiClient.delete(`/admin/meetings/${meetingId}/members/${userId}`).then((res) => res.data),
  updateMeeting: (meetingId, data) => apiClient.patch(`/admin/meetings/${meetingId}`, data).then((res) => res.data),
  updateUser: (userId, data) => apiClient.patch(`/admin/users/${userId}`, data).then((res) => res.data),
  getSettings: () => apiClient.get(`/admin/settings?_=${Date.now()}`).then((res) => res.data),
  updateSettings: (data) => apiClient.post("/admin/settings", data).then((res) => res.data),
  getSettingsLogs: () => apiClient.get(`/admin/settings/logs?_=${Date.now()}`).then((res) => res.data),
  sendMessage: (userId, message) => apiClient.post(`/admin/users/${userId}/message`, { message }).then((res) => res.data),
  sendBroadcast: (data) => apiClient.post("/admin/broadcast", data).then((res) => res.data),
  getBroadcastLogs: () => apiClient.get(`/admin/broadcast/logs?_=${Date.now()}`).then((res) => res.data),
  getAuditLogs: () => apiClient.get(`/admin/audit-logs?_=${Date.now()}`).then((res) => res.data)
};
