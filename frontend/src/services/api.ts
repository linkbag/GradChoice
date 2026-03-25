import axios from 'axios'
import type {
  User,
  UserPublicProfile,
  SupervisorDetail,
  SupervisorAnalytics,
  Rating,
  RatingListResponse,
  SupervisorRatingCache,
  Comment,
  FlagReason,
  Chat,
  ChatMessage,
  ChatMessagesResponse,
  UnreadCountResponse,
  EditProposal,
  Token,
  RegisterResponse,
  PaginatedResponse,
  SupervisorSearchResult,
  SupervisorSubmit,
  Supervisor,
  SchoolListResponse,
  ProvinceListItem,
  SchoolSupervisorsResponse,
  SchoolAnalytics,
  RankingsResponse,
  OverviewStats,
} from '@/types'

// Extend AxiosRequestConfig to support skipAuthRedirect
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    skipAuthRedirect?: boolean
  }
}

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

// Redirect to /login on 401, unless the caller opts out via skipAuthRedirect
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
      if (!err.config?.skipAuthRedirect) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)

// ============================================================
// Auth
// ============================================================
export const authApi = {
  register: (email: string, password: string, display_name?: string, tos_agreed?: boolean) =>
    http.post<RegisterResponse>('/auth/register', { email, password, display_name, tos_agreed }),

  login: (email: string, password: string) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    return http.post<Token>('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  },

  sendSignupVerification: (email: string) =>
    http.post<{ message: string }>('/auth/send-signup-verification', { email }),

  verifySignupCode: (email: string, code: string) =>
    http.post<{ message: string }>('/auth/verify-signup-code', { email, code }),

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

  forgotPassword: (email: string) =>
    http.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, new_password: string) =>
    http.post('/auth/reset-password', { token, new_password }),

  refresh: (refresh_token: string) =>
    http.post<Token>('/auth/refresh', { refresh_token }),

  sendVerification: (school_email: string) =>
    http.post<{ message: string }>('/auth/send-verification', { school_email }),

  verifySchoolEmail: (code: string) =>
    http.post<{ message: string }>('/auth/verify-school-email', { code }),
}

// ============================================================
// Users
// ============================================================
export const usersApi = {
  getMe: () => http.get<User>('/users/me'),

  // Safe probe: returns null on 401 instead of redirecting to /login
  getMeOptional: () =>
    http.get<User>('/users/me', { skipAuthRedirect: true } as Parameters<typeof http.get>[1]),

  updateMe: (data: Partial<Pick<User, 'display_name' | 'bio' | 'email_notifications_enabled'>>) =>
    http.put<User>('/users/me', data),

  changePassword: (current_password: string, new_password: string) =>
    http.post('/users/me/change-password', { current_password, new_password }),

  getMyRatings: (params?: { page?: number; page_size?: number }) =>
    http.get<RatingListResponse>('/users/me/ratings', { params }),

  getMyComments: (params?: { page?: number; page_size?: number }) =>
    http.get<PaginatedResponse<Comment>>('/users/me/comments', { params }),

  getProfile: (userId: string) => http.get<UserPublicProfile>(`/users/${userId}/profile`),
}

// ============================================================
// Supervisors
// ============================================================
export const supervisorsApi = {
  list: (params?: {
    page?: number
    page_size?: number
    school_code?: string
    school_name?: string
    province?: string
    department?: string
    title?: string
    sort_by?: string
  }) => http.get<PaginatedResponse<SupervisorSearchResult>>('/supervisors', { params }),

  search: (q: string, params?: { province?: string; school_code?: string; school_name?: string; department?: string; page?: number; page_size?: number }) =>
    http.get<PaginatedResponse<SupervisorSearchResult>>('/supervisors/search', { params: { q, ...params } }),

  get: (id: string) => http.get<SupervisorDetail>(`/supervisors/${id}`),

  proposeNew: (proposed_data: Record<string, unknown>) =>
    http.post<EditProposal>('/edit-proposals', { supervisor_id: null, proposed_data }),

  getSchools: (params?: { province?: string }) =>
    http.get<SchoolListResponse>('/supervisors/schools', { params }),

  getProvinces: () => http.get<ProvinceListItem[]>('/supervisors/provinces'),

  getSchoolNames: () =>
    http.get<{ school_name: string; school_code: string }[]>('/supervisors/school-names'),

  getSchoolSupervisors: (school_code: string) =>
    http.get<SchoolSupervisorsResponse>(`/supervisors/school/${school_code}`),

  getDepartments: (school_code: string) =>
    http.get<{ department: string }[]>('/supervisors/departments', { params: { school_code } }),

  submit: (data: SupervisorSubmit) =>
    http.post<Supervisor>('/supervisors/submit', data),
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

  getBySupervisor: (
    supervisorId: string,
    params?: {
      page?: number
      page_size?: number
      sort?: 'newest' | 'oldest' | 'most_helpful'
    },
  ) => http.get<RatingListResponse>(`/ratings/supervisor/${supervisorId}`, { params }),

  getSummary: (supervisorId: string) =>
    http.get<SupervisorRatingCache>(`/ratings/supervisor/${supervisorId}/summary`),

  getMine: (params?: { page?: number; page_size?: number }) =>
    http.get<RatingListResponse>('/ratings/mine', { params }),

  update: (
    id: string,
    data: Partial<
      Pick<
        Rating,
        | 'overall_score'
        | 'score_academic'
        | 'score_mentoring'
        | 'score_wellbeing'
        | 'score_stipend'
        | 'score_resources'
        | 'score_ethics'
      >
    >,
  ) => http.put<Rating>(`/ratings/${id}`, data),

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
  getSupervisor: (id: string, params?: { user_status?: 'all' | 'verified' | 'unverified' }) =>
    http.get<SupervisorAnalytics>(`/analytics/supervisor/${id}`, { params }),

  getSchool: (code: string) =>
    http.get<SchoolAnalytics>(`/analytics/school/${code}`),

  getRankings: (params?: {
    dimension?: string
    school_code?: string
    province?: string
    department?: string
    sort_order?: 'asc' | 'desc'
    page?: number
    page_size?: number
    min_ratings?: number
    user_status?: 'all' | 'verified' | 'unverified'
  }) => http.get<RankingsResponse>('/analytics/rankings', { params }),

  getOverview: () => http.get<OverviewStats>('/analytics/overview'),
}

// ============================================================
// Chats
// ============================================================
export const chatsApi = {
  create: (data: { recipient_id: string; supervisor_id?: string; initial_message: string }) =>
    http.post<Chat>('/chats', data),

  list: (params?: { page?: number; page_size?: number }) =>
    http.get<Chat[]>('/chats', { params }),

  get: (chatId: string) =>
    http.get<Chat>(`/chats/${chatId}`),

  getMessages: (chatId: string, params?: { page?: number; page_size?: number; before_id?: string }) =>
    http.get<ChatMessagesResponse>(`/chats/${chatId}/messages`, { params }),

  sendMessage: (chatId: string, content: string) =>
    http.post<ChatMessage>(`/chats/${chatId}/messages`, { content }),

  markRead: (chatId: string) =>
    http.put(`/chats/${chatId}/read`),

  getUnreadCount: () =>
    http.get<UnreadCountResponse>('/chats/unread-count'),
}

// ============================================================
// Edit Proposals
// ============================================================
export const editProposalsApi = {
  create: (data: { supervisor_id?: string; proposed_data: Record<string, unknown> }) =>
    http.post<EditProposal>('/edit-proposals', data),

  getPending: (params?: { page?: number; page_size?: number }) =>
    http.get<PaginatedResponse<EditProposal>>('/edit-proposals/pending', { params }),

  getMine: (params?: { page?: number; page_size?: number }) =>
    http.get<PaginatedResponse<EditProposal>>('/edit-proposals/mine', { params }),

  review: (id: string, decision: 'approve' | 'reject', comment?: string) =>
    http.post<EditProposal>(`/edit-proposals/${id}/review`, { decision, comment }),

  get: (id: string) => http.get<EditProposal>(`/edit-proposals/${id}`),
}
