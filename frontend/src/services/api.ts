import axios from 'axios'
import type {
  User,
  UserPublicProfile,
  Supervisor,
  SupervisorAnalytics,
  Rating,
  Comment,
  FlagReason,
  Chat,
  ChatMessage,
  EditProposal,
  Token,
  PaginatedResponse,
  SupervisorSearchResult,
  SchoolAnalytics,
  RankingsResponse,
} from '@/types'


const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

const http = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Redirect to /login on 401
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

// ============================================================
// Auth
// ============================================================
export const authApi = {
  register: (email: string, password: string, display_name?: string) =>
    http.post<User>('/auth/register', { email, password, display_name }),

  login: (email: string, password: string) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    return http.post<Token>('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  },

  verifyEmail: (token: string) =>
    http.post('/auth/verify-email', null, { params: { token } }),

  verifyStudent: (verification_type: string, file?: File) => {
    const form = new FormData()
    form.append('verification_type', verification_type)
    if (file) form.append('file', file)
    return http.post('/auth/verify-student', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// ============================================================
// Users
// ============================================================
export const usersApi = {
  getMe: () => http.get<User>('/users/me'),
  updateMe: (data: Partial<Pick<User, 'display_name' | 'bio' | 'email_notifications_enabled'>>) =>
    http.put<User>('/users/me', data),
  getProfile: (userId: string) => http.get<UserPublicProfile>(`/users/${userId}/profile`),
}

// ============================================================
// Supervisors
// ============================================================
export const supervisorsApi = {
  list: (params?: { page?: number; page_size?: number; school_code?: string; province?: string }) =>
    http.get<PaginatedResponse<SupervisorSearchResult>>('/supervisors', { params }),

  search: (q: string, params?: { province?: string; school_code?: string; page?: number; page_size?: number }) =>
    http.get<PaginatedResponse<SupervisorSearchResult>>('/supervisors/search', { params: { q, ...params } }),

  get: (id: string) => http.get<Supervisor>(`/supervisors/${id}`),

  proposeNew: (proposed_data: Record<string, unknown>) =>
    http.post<EditProposal>('/supervisors', { supervisor_id: null, proposed_data }),
}

// ============================================================
// Ratings
// ============================================================
export const ratingsApi = {
  create: (data: {
    supervisor_id: string
    overall_score: number
    score_academic?: number
    score_mentoring?: number
    score_wellbeing?: number
    score_stipend?: number
    score_resources?: number
    score_ethics?: number
  }) => http.post<Rating>('/ratings', data),

  getBySupervisor: (supervisorId: string, params?: { page?: number; page_size?: number }) =>
    http.get<Rating[]>(`/ratings/supervisor/${supervisorId}`, { params }),

  update: (id: string, data: Partial<Omit<Rating, 'id' | 'user_id' | 'supervisor_id' | 'is_verified_rating' | 'created_at' | 'updated_at' | 'upvotes' | 'downvotes' | 'user_vote'>>) =>
    http.put<Rating>(`/ratings/${id}`, data),

  delete: (id: string) => http.delete(`/ratings/${id}`),

  vote: (id: string, vote_type: 'up' | 'down') =>
    http.post(`/ratings/${id}/vote`, { vote_type }),
}

// ============================================================
// Comments
// ============================================================
export const commentsApi = {
  create: (data: { supervisor_id: string; content: string; parent_comment_id?: string }) =>
    http.post<Comment>('/comments', data),

  getBySupervisor: (
    supervisorId: string,
    params?: {
      page?: number
      page_size?: number
      sort?: 'newest' | 'oldest' | 'most_liked' | 'most_discussed'
    },
  ) => http.get<PaginatedResponse<Comment>>(`/comments/supervisor/${supervisorId}`, { params }),

  get: (commentId: string) => http.get<Comment>(`/comments/${commentId}`),

  getReplies: (commentId: string) =>
    http.get<Comment[]>(`/comments/${commentId}/replies`),

  update: (id: string, content: string) =>
    http.put<Comment>(`/comments/${id}`, { content }),

  delete: (id: string) => http.delete(`/comments/${id}`),

  vote: (id: string, vote_type: 'up' | 'down') =>
    http.post(`/comments/${id}/vote`, { vote_type }),

  flag: (id: string, reason: FlagReason, detail?: string) =>
    http.post(`/comments/${id}/flag`, { reason, detail }),
}

// ============================================================
// Analytics
// ============================================================
export const analyticsApi = {
  getSupervisor: (id: string) =>
    http.get<SupervisorAnalytics>(`/analytics/supervisor/${id}`),

  getSchool: (code: string) =>
    http.get<SchoolAnalytics>(`/analytics/school/${code}`),

  getRankings: () =>
    http.get<RankingsResponse>('/analytics/rankings'),
}

// ============================================================
// Chats
// ============================================================
export const chatsApi = {
  create: (data: { recipient_id: string; supervisor_id?: string; initial_message: string }) =>
    http.post<Chat>('/chats', data),

  list: () => http.get<Chat[]>('/chats'),

  getMessages: (chatId: string, params?: { page?: number; page_size?: number }) =>
    http.get<PaginatedResponse<ChatMessage>>(`/chats/${chatId}/messages`, { params }),

  sendMessage: (chatId: string, content: string) =>
    http.post<ChatMessage>(`/chats/${chatId}/messages`, { content }),
}

// ============================================================
// Edit Proposals
// ============================================================
export const editProposalsApi = {
  create: (data: { supervisor_id?: string; proposed_data: Record<string, unknown> }) =>
    http.post<EditProposal>('/edit-proposals', data),

  getPending: (params?: { page?: number; page_size?: number }) =>
    http.get<PaginatedResponse<EditProposal>>('/edit-proposals/pending', { params }),

  review: (id: string, decision: 'approve' | 'reject', comment?: string) =>
    http.post<EditProposal>(`/edit-proposals/${id}/review`, { decision, comment }),

  get: (id: string) => http.get<EditProposal>(`/edit-proposals/${id}`),
}
