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
  school_email: string | null
  school_email_verified: boolean
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
  school_code: string
  school_name: string
  province: string
  name: string
  department: string
  title: string | null
  avg_overall_score: number | null
  rating_count: number
}

export interface RecentComment {
  id: string
  content: string
  likes_count: number
  created_at: string
}

export interface SupervisorDetail extends Supervisor {
  avg_overall: number | null
  avg_academic: number | null
  avg_mentoring: number | null
  avg_wellbeing: number | null
  avg_stipend: number | null
  avg_resources: number | null
  avg_ethics: number | null
  rating_count: number
  verified_rating_count: number
  verified_avg_overall: number | null
  rating_distribution: Record<string, number>
  recent_comments: RecentComment[]
}

// ── School directory ──────────────────────────────────────────

export interface SchoolListItem {
  school_code: string
  school_name: string
  province: string
  supervisor_count: number
  rated_supervisor_count: number
  avg_overall_score: number | null
}

export interface SchoolListResponse {
  items: SchoolListItem[]
  total: number
}

export interface ProvinceListItem {
  province: string
  school_count: number
  supervisor_count: number
}

export interface DepartmentGroup {
  department: string
  supervisors: SupervisorSearchResult[]
}

export interface SchoolSupervisorsResponse {
  school_code: string
  school_name: string
  province: string
  total_count: number
  departments: DepartmentGroup[]
}

export interface Rating {
  id: string
  user_id: string
  supervisor_id: string
  display_name: string
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

export interface RatingListResponse {
  items: Rating[]
  total: number
  page: number
  page_size: number
}

export interface SupervisorRatingCache {
  supervisor_id: string
  all_avg_overall: number | null
  all_avg_academic: number | null
  all_avg_mentoring: number | null
  all_avg_wellbeing: number | null
  all_avg_stipend: number | null
  all_avg_resources: number | null
  all_avg_ethics: number | null
  verified_avg_overall: number | null
  verified_avg_academic: number | null
  verified_avg_mentoring: number | null
  verified_avg_wellbeing: number | null
  verified_avg_stipend: number | null
  verified_avg_resources: number | null
  verified_avg_ethics: number | null
  all_count: number
  verified_count: number
  distribution_1: number
  distribution_2: number
  distribution_3: number
  distribution_4: number
  distribution_5: number
  updated_at: string | null
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
  is_verified_comment: boolean
  is_deleted: boolean
  is_edited: boolean
  is_anonymous: boolean
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
  // Computed fields populated by backend
  other_user_id: string | null
  other_user_display_name: string | null
  supervisor_name: string | null
  school_name: string | null
  last_message: string | null
  last_message_at: string | null
  unread_count: number
  created_at: string
}

export interface ChatMessage {
  id: string
  chat_id: string
  sender_id: string
  content: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface ChatMessagesResponse {
  items: ChatMessage[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

export interface UnreadCountResponse {
  unread_count: number
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

// ============================================================
// Analytics types
// ============================================================

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

export interface PercentileRankings {
  dept_percentile: number | null
  school_percentile: number | null
  province_percentile: number | null
  national_percentile: number | null
}

export interface ScoreTrend {
  month: string // e.g. "2024-01"
  avg_overall: number
  rating_count: number
}

export interface DepartmentStats {
  department: string
  avg_overall: number | null
  rating_count: number
  supervisor_count: number
}

export interface SupervisorAnalytics {
  supervisor_id: string
  supervisor_name: string
  school_name: string
  department: string
  scores: ScoreBreakdown
  verified_scores: ScoreBreakdown
  score_distribution: Record<string, number>
  comment_count: number
  percentiles: PercentileRankings | null
  score_trends: ScoreTrend[]
  school_avg_scores: ScoreBreakdown
  national_avg_scores: ScoreBreakdown
}

export interface SchoolAnalytics {
  school_code: string
  school_name: string
  province: string
  total_supervisors: number
  rated_supervisors: number
  unrated_supervisors: number
  avg_overall_score: number | null
  avg_sub_scores: ScoreBreakdown
  departments: DepartmentStats[]
  total_ratings: number
  recent_ratings: number
  school_percentile: number | null
  top_supervisors: {
    supervisor_id: string
    supervisor_name: string
    department: string
    avg_score: number
    rating_count: number
  }[]
}

export interface RankingEntry {
  rank: number
  supervisor_id: string
  supervisor_name: string
  school_name: string
  school_code: string
  department: string
  avg_score: number
  rating_count: number
}

export interface RankingsResponse {
  items: RankingEntry[]
  total: number
  page: number
  page_size: number
}

export interface OverviewStats {
  total_supervisors: number
  total_ratings: number
  total_users: number
  rated_supervisors: number
  most_active_schools: { school_name: string; school_code: string; rating_count: number }[]
  recent_ratings_30d: number
}

// ============================================================
// Supervisor submission
// ============================================================

export interface SupervisorSubmit {
  name: string
  school_name: string
  department?: string
  school_code?: string
  province?: string
  title?: string
  website_url?: string
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
  refresh_token?: string
}

export interface RegisterResponse extends User {
  access_token: string
  token_type: string
}
