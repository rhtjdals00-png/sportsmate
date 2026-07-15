import { apiClient } from "./client";

export const meetingApi = {
  list: (params = {}) => apiClient.get("/meetings", { params }).then((res) => res.data),
  detail: (id) => apiClient.get(`/meetings/${id}`).then((res) => res.data),
  sessions: (id) => apiClient.get(`/meetings/${id}/sessions`).then((res) => res.data),
  create: (payload) => apiClient.post("/meetings", payload).then((res) => res.data),
  update: (id, payload) => apiClient.patch(`/meetings/${id}`, payload).then((res) => res.data),
  updateSession: (meetingId, sessionId, payload) =>
    apiClient.patch(`/meetings/${meetingId}/sessions/${sessionId}`, payload).then((res) => res.data),
  cancelSession: (meetingId, sessionId, reason) =>
    apiClient.patch(`/meetings/${meetingId}/sessions/${sessionId}/cancel`, { reason }).then((res) => res.data),
  cancel: (id) => apiClient.delete(`/meetings/${id}`).then((res) => res.data),
  join: (id, payload = {}) => apiClient.post(`/meetings/${id}/join`, payload).then((res) => res.data),
  cancelJoin: (id) => apiClient.delete(`/meetings/${id}/join`).then((res) => res.data),
  applicants: (id) => apiClient.get(`/meetings/${id}/applicants`).then((res) => res.data),
  approve: (meetingId, userId) =>
    apiClient.patch(`/meetings/${meetingId}/applicants/${userId}/approve`).then((res) => res.data),
  reject: (meetingId, userId) =>
    apiClient.patch(`/meetings/${meetingId}/applicants/${userId}/reject`).then((res) => res.data),
  kickMember: (meetingId, userId) => apiClient.delete(`/meetings/${meetingId}/members/${userId}`).then((res) => res.data),
  reviews: (id) => apiClient.get(`/meetings/${id}/reviews`).then((res) => res.data),
  createReview: (id, payload) => apiClient.post(`/meetings/${id}/reviews`, payload).then((res) => res.data),
  notices: (id) => apiClient.get(`/meetings/${id}/notices`).then((res) => res.data),
  createNotice: (id, payload) => apiClient.post(`/meetings/${id}/notices`, payload).then((res) => res.data),
  votes: (id) => apiClient.get(`/meetings/${id}/votes`).then((res) => res.data),
  createVote: (id, payload) => apiClient.post(`/meetings/${id}/votes`, payload).then((res) => res.data),
  deleteNotice: (meetingId, noticeId) => apiClient.delete(`/meetings/${meetingId}/notices/${noticeId}`).then((res) => res.data),
  deleteVote: (meetingId, voteId) => apiClient.delete(`/meetings/${meetingId}/votes/${voteId}`).then((res) => res.data),
  attendance: (id) => apiClient.get(`/meetings/${id}/attendance`).then((res) => res.data),
  checkAttendance: (id, payload = {}) => apiClient.post(`/meetings/${id}/attendance/check`, payload).then((res) => res.data),
  getConfig: () => apiClient.get("/meetings/config").then((res) => res.data)
};
