import { apiClient } from "./client";

export const adminApi = {
  users: () => apiClient.get(`/admin/users?_=${Date.now()}`).then((res) => res.data),
  userDetail: (userId) => apiClient.get(`/admin/users/${userId}?_=${Date.now()}`).then((res) => res.data),
  meetings: () => apiClient.get(`/admin/meetings?_=${Date.now()}`).then((res) => res.data),
  meetingDetail: (meetingId) => apiClient.get(`/admin/meetings/${meetingId}?_=${Date.now()}`).then((res) => res.data),
  reports: () => apiClient.get("/admin/reports").then((res) => res.data),
  deleteMeeting: (meetingId) => apiClient.delete(`/admin/meetings/${meetingId}`).then((res) => res.data),
  kickMember: (meetingId, userId) => apiClient.delete(`/admin/meetings/${meetingId}/members/${userId}`).then((res) => res.data),
  updateMeeting: (meetingId, data) => apiClient.patch(`/admin/meetings/${meetingId}`, data).then((res) => res.data),
  updateUser: (userId, data) => apiClient.patch(`/admin/users/${userId}`, data).then((res) => res.data)
};
