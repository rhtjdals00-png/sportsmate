import { apiClient } from "./client";

export const voteApi = {
  participate: (voteId, payload) => apiClient.post(`/votes/${voteId}/participate`, payload).then((res) => res.data)
};
