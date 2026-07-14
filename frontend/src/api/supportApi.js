import { apiClient } from "./client";

export const supportApi = {
  inquiries: () => apiClient.get(`/support/inquiries?_=${Date.now()}`).then((res) => res.data),
  createInquiry: (data) => apiClient.post("/support/inquiries", data).then((res) => res.data),
  createPublicInquiry: (data) => apiClient.post("/support/public-inquiries", data).then((res) => res.data),
  getNotices: () => apiClient.get(`/support/notices?_=${Date.now()}`).then((res) => res.data)
};
