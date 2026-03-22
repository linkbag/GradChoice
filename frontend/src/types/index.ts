// ============================================================
// Core domain types mirroring the backend Pydantic schemas
// ============================================================

export type VerificationType = 'none' | 'email_edu' | 'student_id'
export type VoteType = 'up' | 'down'
export type ProposalStatus = 'pending' | 'approved' | 'rejected'
export type ReviewDecision = 'approve' | 'reject'

export interface User {
  id: string
  email: string
  display_name: string | null
  bio: string | null
  is_email_verified: boolean
  is_student_verified: boolean
  verification_type: VerificationType
  email_notifications_enabled: boolean
  created_at: string
  updated_at: string
}

export interface UserPublicProfile {
  id: string
  display_name: string | null
  bio: string | null
  is_student_verified: boolean
  created_at: string
}

export interface Supervisor {
  id: string
  school_code: string
  school_name: string
  province: string
  name: string
  department: string
  title: string | null
  affiliated_unit: string | null
  webpage_url_1: string | null
  webpage_url_2: string | null
  webpage_url_3: string | null
  created_at: string
  updated_at: string
}

export interface SupervisorSearchResult {
  id: string
  school_name: string
  province: string
  name: string
  department: string
  title: string | null
  avg_overall_score: number | null
  rating_count: number
}

export interface Rating {
  id: string
  user_id: string
  supervisor_id: string
  is_verified_rating: boolean
  overall_score: number
  score_academic: number | null
  score_mentoring: number | null
  score_wellbeing: number | null
  score_stipend: number | null
  score_resources: number | null
  score_ethics: number | null
  upvotes: number
  downvotes: number
  user_vote: VoteType | null
  created_at: string
  updated_at: string
}

export type FlagReason = '虚假信息' | '恶意攻击' | '垃圾信息' | '隐私泄露' | '其他'

export interface CommentAuthor {
  id: string
  display_name: string | null
  is_student_verified: boolean
}

export interface Comment {
  id: string
  supervisor_id: string
  parent_comment_id: string | null
  content: string
  is_deleted: boolean
  is_edited: boolean
  likes_count: number
  dislikes_count: number
  is_flagged: boolean
  user_vote: VoteType | null
  reply_count: number
  author: CommentAuthor | null
  replies: Comment[]
  created_at: string
  updated_at: string
}

export interface Chat {
  id: string
  initiator_id: string
  recipient_id: string
  supervisor_id: string | null
  last_message: string | null
  unread_count: number
  created_at: string
}

export interface ChatMessage {
  id: string
  chat_id: string
  sender_id: string
  content: string
  read_at: string | null
  created_at: string
}

export interface EditProposal {
  id: string
  supervisor_id: string | null
  proposed_by: string
  proposed_data: Record<string, unknown>
  status: ProposalStatus
  reviewer_1_id: string | null
  reviewer_1_decision: ReviewDecision | null
  reviewer_2_id: string | null
  reviewer_2_decision: ReviewDecision | null
  created_at: string
  resolved_at: string | null
}

export interface ScoreBreakdown {
  avg_overall: number | null
  avg_academic: number | null
  avg_mentoring: number | null
  avg_wellbeing: number | null
  avg_stipend: number | null
  avg_resources: number | null
  avg_ethics: number | null
  total_ratings: number
  verified_ratings: number
}

export interface SupervisorAnalytics {
  supervisor_id: string
  supervisor_name: string
  school_name: string
  scores: ScoreBreakdown
  score_distribution: Record<string, number>
  comment_count: number
}

export interface SchoolAnalytics {
  school_code: string
  school_name: string
  province: string
  total_supervisors: number
  rated_supervisors: number
  avg_overall_score: number | null
  top_supervisors: Record<string, unknown>[]
}

export interface RankingEntry {
  rank: number
  supervisor_id: string
  supervisor_name: string
  school_name: string
  avg_score: number
  rating_count: number
}

export interface RankingsResponse {
  by_overall: RankingEntry[]
  by_school: SchoolAnalytics[]
}

// ============================================================
// Pagination wrapper
// ============================================================
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

// ============================================================
// Auth
// ============================================================
export interface Token {
  access_token: string
  token_type: string
}
