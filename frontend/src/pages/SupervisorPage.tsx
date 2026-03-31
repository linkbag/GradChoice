import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { supervisorsApi, analyticsApi, ratingsApi, commentsApi, editProposalsApi, usersApi, chatsApi } from '@/services/api'
import type { Supervisor, SupervisorAnalytics, ScoreBreakdown, Rating, Comment } from '@/types'
import RadarChart from '@/components/RadarChart'
import DistributionChart from '@/components/DistributionChart'
import PercentileDisplay from '@/components/PercentileDisplay'

type UserStatus = 'all' | 'verified' | 'unverified'

const SUB_SCORE_KEYS = ['academic', 'mentoring', 'wellbeing', 'stipend', 'resources', 'ethics'] as const
type SubScoreKey = typeof SUB_SCORE_KEYS[number]

// Unified feed item type
type FeedItem =
  | { type: 'rating'; data: Rating; created_at: string }
  | { type: 'comment'; data: Comment; created_at: string }
  | { type: 'combined'; rating: Rating; comment: Comment; created_at: string }

function PopupStarPicker({
  label,
  value,
  onChange,
  required,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  required?: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700 w-24 shrink-0">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(value === star && !required ? null : star)}
            className={`text-2xl transition-colors ${
              value != null && star <= value ? 'text-yellow-400' : 'text-gray-300'
            } hover:text-yellow-400`}
            aria-label={t.supervisor.star_aria(star)}
          >
            ★
          </button>
        ))}
        {!required && value != null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-gray-400 hover:text-gray-600 ml-1"
          >
            {t.supervisor.clear}
          </button>
        )}
        {value != null && (
          <span className="text-sm font-medium text-teal-600 ml-2 w-6">{value}.0</span>
        )}
      </div>
    </div>
  )
}

const KEY_TO_SCORE_FIELD: Record<string, keyof ScoreBreakdown> = {
  academic: 'avg_academic',
  mentoring: 'avg_mentoring',
  wellbeing: 'avg_wellbeing',
  stipend: 'avg_stipend',
  resources: 'avg_resources',
  ethics: 'avg_ethics',
}

function scoreForKey(scores: ScoreBreakdown, key: string): string {
  const field = KEY_TO_SCORE_FIELD[key]
  if (!field) return '—'
  const val = scores[field]
  return val != null ? Number(val).toFixed(1) : '—'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

function StarRow({ score }: { score: number }) {
  return (
    <span className="text-yellow-400 text-sm" aria-label={`${score}`}>
      {'★'.repeat(score)}{'☆'.repeat(5 - score)}
    </span>
  )
}

function RatingCard({ rating }: { rating: Rating }) {
  const { t } = useI18n()
  const subScores = Object.entries(t.supervisor.score_labels)
    .filter(([k]) => k !== 'overall')
    .map(([k, label]) => {
      const val = rating[`score_${k}` as keyof Rating] as number | null
      return { label, val }
    })
    .filter(({ val }) => val != null)

  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Link
            to={`/users/${rating.user_id}/profile`}
            className="text-sm font-medium text-teal-600 hover:underline cursor-pointer"
          >
            {rating.display_name || t.supervisor.anonymous}
          </Link>
          {rating.is_verified_rating && (
            <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">
              {t.supervisor.verified_badge}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{formatDate(rating.created_at)}</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <StarRow score={Math.round(rating.overall_score)} />
        <span className="text-sm font-bold text-teal-600">{rating.overall_score.toFixed(1)}</span>
      </div>
      {subScores.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {subScores.map(({ label, val }) => (
            <span key={label} className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">
              {label} {(val as number).toFixed(1)}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        <span>👍 {rating.upvotes}</span>
        <span>👎 {rating.downvotes}</span>
      </div>
    </div>
  )
}

interface CommentCardProps {
  comment: Comment
  isLoggedIn: boolean
  currentUserId?: string | null
  onVote: (id: string, type: 'up' | 'down') => void
  onReply: (id: string, authorName: string) => void
  onChat: (comment: Comment) => void
}

function CommentCard({ comment, isLoggedIn, currentUserId, onVote, onReply, onChat }: CommentCardProps) {
  const { t } = useI18n()
  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {comment.is_anonymous ? (
            <span className="text-sm font-medium text-gray-700">{t.supervisor.anonymous_user}</span>
          ) : comment.author?.id ? (
            <Link
              to={`/users/${comment.author.id}/profile`}
              className="text-sm font-medium text-teal-600 hover:underline cursor-pointer"
            >
              {comment.author.display_name || t.supervisor.anonymous}
            </Link>
          ) : (
            <span className="text-sm font-medium text-gray-700">{t.supervisor.anonymous}</span>
          )}
          {comment.is_verified_comment ? (
            <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">
              ✅ {t.supervisor.verified_badge}
            </span>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
              {t.supervisor.unverified_badge}
            </span>
          )}
          {comment.is_edited && (
            <span className="text-xs text-gray-400">{t.supervisor.edited_badge}</span>
          )}
        </div>
        <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
      </div>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.content}</p>
      <div className="flex items-center gap-3 mt-2 text-xs">
        <button
          onClick={() => onVote(comment.id, 'up')}
          className={`flex items-center gap-1 transition-colors hover:text-teal-600 ${
            comment.user_vote === 'up' ? 'text-teal-600 font-medium' : 'text-gray-400'
          }`}
          title={isLoggedIn ? t.supervisor.upvote : t.supervisor.upvote_login}
        >
          👍 {comment.likes_count}
        </button>
        <button
          onClick={() => onVote(comment.id, 'down')}
          className={`flex items-center gap-1 transition-colors hover:text-red-500 ${
            comment.user_vote === 'down' ? 'text-red-500 font-medium' : 'text-gray-400'
          }`}
          title={isLoggedIn ? t.supervisor.downvote : t.supervisor.downvote_login}
        >
          👎 {comment.dislikes_count}
        </button>
        <button
          onClick={() => onReply(comment.id, comment.author?.display_name || t.supervisor.anonymous)}
          className="text-gray-400 hover:text-teal-600 transition-colors"
        >
          {t.supervisor.reply}
        </button>
        {isLoggedIn && !comment.is_anonymous && comment.author?.id && comment.author.id !== currentUserId && (
          <button
            onClick={() => onChat(comment)}
            className="text-gray-400 hover:text-teal-600 transition-colors"
          >
            {t.supervisor.dm}
          </button>
        )}
        {comment.reply_count > 0 && (
          <span className="text-gray-400">{t.supervisor.reply_count(comment.reply_count)}</span>
        )}
      </div>
      {comment.replies?.length > 0 && (
        <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200">
          {comment.replies.map((r) => (
            <div key={r.id} className="text-sm">
              {r.is_anonymous ? (
                <span className="font-medium text-gray-600">{t.supervisor.anonymous_user}</span>
              ) : r.author?.id ? (
                <Link
                  to={`/users/${r.author.id}/profile`}
                  className="font-medium text-teal-600 hover:underline cursor-pointer"
                >
                  {r.author.display_name || t.supervisor.anonymous}
                </Link>
              ) : (
                <span className="font-medium text-gray-600">{t.supervisor.anonymous}</span>
              )}
              {r.is_verified_comment ? (
                <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full mx-1">
                  ✅ {t.supervisor.verified_badge}
                </span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full mx-1">
                  {t.supervisor.unverified_badge}
                </span>
              )}
              <span className="text-gray-600">{t.supervisor.reply_separator}</span>
              <span className="text-gray-700">{r.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Combined card: shows rating stars + comment text in one card
interface CombinedCardProps {
  rating: Rating
  comment: Comment
  isLoggedIn: boolean
  currentUserId?: string | null
  onVote: (id: string, type: 'up' | 'down') => void
  onReply: (id: string, authorName: string) => void
  onChat: (comment: Comment) => void
}

function CombinedCard({ rating, comment, isLoggedIn, currentUserId, onVote, onReply, onChat }: CombinedCardProps) {
  const { t } = useI18n()
  const subScores = Object.entries(t.supervisor.score_labels)
    .filter(([k]) => k !== 'overall')
    .map(([k, label]) => {
      const val = rating[`score_${k}` as keyof Rating] as number | null
      return { label, val }
    })
    .filter(({ val }) => val != null)

  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
      {/* Header: author info + date */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {comment.is_anonymous ? (
            <span className="text-sm font-medium text-gray-700">{t.supervisor.anonymous_user}</span>
          ) : comment.author?.id ? (
            <Link
              to={`/users/${comment.author.id}/profile`}
              className="text-sm font-medium text-teal-600 hover:underline cursor-pointer"
            >
              {comment.author.display_name || t.supervisor.anonymous}
            </Link>
          ) : (
            <span className="text-sm font-medium text-gray-700">{t.supervisor.anonymous}</span>
          )}
          {comment.is_verified_comment ? (
            <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">
              ✅ {t.supervisor.verified_badge}
            </span>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
              {t.supervisor.unverified_badge}
            </span>
          )}
          {comment.is_edited && (
            <span className="text-xs text-gray-400">{t.supervisor.edited_badge}</span>
          )}
        </div>
        <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
      </div>

      {/* Rating stars */}
      <div className="flex items-center gap-2 mb-2">
        <StarRow score={Math.round(rating.overall_score)} />
        <span className="text-sm font-bold text-teal-600">{rating.overall_score.toFixed(1)}</span>
      </div>

      {/* Sub-scores */}
      {subScores.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {subScores.map(({ label, val }) => (
            <span key={label} className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">
              {label} {(val as number).toFixed(1)}
            </span>
          ))}
        </div>
      )}

      {/* Comment text */}
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.content}</p>

      {/* Vote / reply / chat */}
      <div className="flex items-center gap-3 mt-2 text-xs">
        <button
          onClick={() => onVote(comment.id, 'up')}
          className={`flex items-center gap-1 transition-colors hover:text-teal-600 ${
            comment.user_vote === 'up' ? 'text-teal-600 font-medium' : 'text-gray-400'
          }`}
          title={isLoggedIn ? t.supervisor.upvote : t.supervisor.upvote_login}
        >
          👍 {comment.likes_count}
        </button>
        <button
          onClick={() => onVote(comment.id, 'down')}
          className={`flex items-center gap-1 transition-colors hover:text-red-500 ${
            comment.user_vote === 'down' ? 'text-red-500 font-medium' : 'text-gray-400'
          }`}
          title={isLoggedIn ? t.supervisor.downvote : t.supervisor.downvote_login}
        >
          👎 {comment.dislikes_count}
        </button>
        <button
          onClick={() => onReply(comment.id, comment.author?.display_name || t.supervisor.anonymous)}
          className="text-gray-400 hover:text-teal-600 transition-colors"
        >
          {t.supervisor.reply}
        </button>
        {isLoggedIn && !comment.is_anonymous && comment.author?.id && comment.author.id !== currentUserId && (
          <button
            onClick={() => onChat(comment)}
            className="text-gray-400 hover:text-teal-600 transition-colors"
          >
            {t.supervisor.dm}
          </button>
        )}
        {comment.reply_count > 0 && (
          <span className="text-gray-400">{t.supervisor.reply_count(comment.reply_count)}</span>
        )}
      </div>

      {/* Replies */}
      {comment.replies?.length > 0 && (
        <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200">
          {comment.replies.map((r) => (
            <div key={r.id} className="text-sm">
              {r.is_anonymous ? (
                <span className="font-medium text-gray-600">{t.supervisor.anonymous_user}</span>
              ) : r.author?.id ? (
                <Link
                  to={`/users/${r.author.id}/profile`}
                  className="font-medium text-teal-600 hover:underline cursor-pointer"
                >
                  {r.author.display_name || t.supervisor.anonymous}
                </Link>
              ) : (
                <span className="font-medium text-gray-600">{t.supervisor.anonymous}</span>
              )}
              {r.is_verified_comment ? (
                <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full mx-1">
                  ✅ {t.supervisor.verified_badge}
                </span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full mx-1">
                  {t.supervisor.unverified_badge}
                </span>
              )}
              <span className="text-gray-600">{t.supervisor.reply_separator}</span>
              <span className="text-gray-700">{r.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SupervisorPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null)
  const [analytics, setAnalytics] = useState<SupervisorAnalytics | null>(null)
  const [analyticsUserStatus, setAnalyticsUserStatus] = useState<UserStatus>('all')
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [ratings, setRatings] = useState<Rating[]>([])
  const [ratingsTotal, setRatingsTotal] = useState(0)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsTotal, setCommentsTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Comment creation
  const [commentText, setCommentText] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const [commentTosAgreed, setCommentTosAgreed] = useState(false)
  const [commentAnonymous, setCommentAnonymous] = useState(false)

  const COMMENT_MAX_LENGTH = 4500

  // Score popup state
  const [showScorePopup, setShowScorePopup] = useState(false)
  const [popupOverallScore, setPopupOverallScore] = useState<number | null>(null)
  const [popupSubScores, setPopupSubScores] = useState<Record<SubScoreKey, number | null>>({
    academic: null, mentoring: null, wellbeing: null, stipend: null, resources: null, ethics: null,
  })
  const [popupFirstYearIncome, setPopupFirstYearIncome] = useState('')
  const [popupSubmitting, setPopupSubmitting] = useState(false)
  const [popupError, setPopupError] = useState<string | null>(null)

  // Reply state
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string } | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

  // Vote feedback
  const [voteError, setVoteError] = useState<string | null>(null)

  // Suggest-edit form state
  const [showEditForm, setShowEditForm] = useState(false)
  const [editFields, setEditFields] = useState({ title: '', affiliated_unit: '', webpage_url_1: '', webpage_url_2: '', webpage_url_3: '' })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editDone, setEditDone] = useState(false)

  const isLoggedIn = !!localStorage.getItem('access_token')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Ref for scrolling to comment form
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)

  // User status tabs — computed from translations
  const USER_STATUS_TABS: { key: UserStatus; label: string }[] = [
    { key: 'all', label: t.supervisor.user_status_all },
    { key: 'verified', label: t.supervisor.user_status_verified },
    { key: 'unverified', label: t.supervisor.user_status_unverified },
  ]

  // Edit form field definitions
  const editFormFields = [
    { key: 'title', label: t.supervisor.edit_field_title },
    { key: 'affiliated_unit', label: t.supervisor.edit_field_unit },
    { key: 'webpage_url_1', label: t.supervisor.edit_field_url1 },
    { key: 'webpage_url_2', label: t.supervisor.edit_field_url2 },
    { key: 'webpage_url_3', label: t.supervisor.edit_field_url3 },
  ]

  useEffect(() => {
    if (!isLoggedIn) return
    usersApi.getMeOptional().then((res) => setCurrentUserId(res.data.id)).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshComments = useCallback(async () => {
    if (!id) return
    const res = await commentsApi.getBySupervisor(id, { page_size: 20 })
    setComments(res.data.items)
    setCommentsTotal(res.data.total)
  }, [id])

  // Re-fetch analytics when user_status filter changes (but not on initial load)
  useEffect(() => {
    if (!id || loading) return
    setAnalyticsLoading(true)
    analyticsApi.getSupervisor(id, { user_status: analyticsUserStatus })
      .then((res) => setAnalytics(res.data))
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false))
  }, [analyticsUserStatus, id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) return
    Promise.allSettled([
      supervisorsApi.get(id),
      analyticsApi.getSupervisor(id, { user_status: analyticsUserStatus }),
      ratingsApi.getBySupervisor(id, { page_size: 20 }),
      commentsApi.getBySupervisor(id, { page_size: 20 }),
    ]).then(([supResult, analyticsResult, ratingsResult, commentsResult]) => {
      if (supResult.status === 'fulfilled') setSupervisor(supResult.value.data)
      if (analyticsResult.status === 'fulfilled') setAnalytics(analyticsResult.value.data)
      if (ratingsResult.status === 'fulfilled') {
        setRatings(ratingsResult.value.data.items)
        setRatingsTotal(ratingsResult.value.data.total)
      }
      if (commentsResult.status === 'fulfilled') {
        setComments(commentsResult.value.data.items)
        setCommentsTotal(commentsResult.value.data.total)
      }
    }).finally(() => setLoading(false))
  }, [id])

  // Build unified chronological feed: match ratings+comments by user_id
  const feedItems = useMemo((): FeedItem[] => {
    // Only top-level comments (no replies) go in the feed
    const topLevel = comments.filter((c) => c.parent_comment_id === null)

    // Map author id → comment for fast lookup
    const commentByUserId = new Map<string, Comment>()
    topLevel.forEach((c) => {
      if (c.author?.id) commentByUserId.set(c.author.id, c)
    })

    const matchedCommentIds = new Set<string>()
    const items: FeedItem[] = []

    // Process ratings — combine with matching comment if found
    ratings.forEach((r) => {
      const matched = commentByUserId.get(r.user_id)
      if (matched) {
        matchedCommentIds.add(matched.id)
        items.push({ type: 'combined', rating: r, comment: matched, created_at: matched.created_at })
      } else {
        items.push({ type: 'rating', data: r, created_at: r.created_at })
      }
    })

    // Add unmatched top-level comments
    topLevel.forEach((c) => {
      if (!matchedCommentIds.has(c.id)) {
        items.push({ type: 'comment', data: c, created_at: c.created_at })
      }
    })

    // Sort newest first
    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [ratings, comments])

  const scores = analytics?.scores
  const verifiedScores = analytics?.verified_scores
  const hasScores = scores != null && scores.total_ratings > 0
  const hasVerifiedScores = verifiedScores != null && verifiedScores.total_ratings > 0

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supervisor) return
    const proposed_data: Record<string, string> = {}
    for (const [k, v] of Object.entries(editFields)) {
      if (v.trim()) proposed_data[k] = v.trim()
    }
    if (Object.keys(proposed_data).length === 0) return
    setEditSubmitting(true)
    try {
      await editProposalsApi.create({ supervisor_id: supervisor.id, proposed_data })
      setEditDone(true)
      setShowEditForm(false)
      setEditFields({ title: '', affiliated_unit: '', webpage_url_1: '', webpage_url_2: '', webpage_url_3: '' })
    } catch {
      // ignore — user will see nothing happened
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleSubmitComment() {
    if (!commentText.trim() || !id) return
    if (!isLoggedIn) {
      navigate('/login')
      return
    }
    if (!commentTosAgreed) {
      setCommentError(t.supervisor.error_tos)
      return
    }
    // Reset and show score popup
    setPopupOverallScore(null)
    setPopupSubScores({ academic: null, mentoring: null, wellbeing: null, stipend: null, resources: null, ethics: null })
    setPopupFirstYearIncome('')
    setPopupError(null)
    setShowScorePopup(true)
  }

  async function handlePopupSubmit(skipScores: boolean) {
    if (!id) return
    setPopupSubmitting(true)
    setPopupError(null)
    try {
      if (!skipScores && popupOverallScore != null) {
        try {
          await ratingsApi.create({
            supervisor_id: id,
            overall_score: popupOverallScore,
            score_academic: popupSubScores.academic ?? undefined,
            score_mentoring: popupSubScores.mentoring ?? undefined,
            score_wellbeing: popupSubScores.wellbeing ?? undefined,
            score_stipend: popupSubScores.stipend ?? undefined,
            score_resources: popupSubScores.resources ?? undefined,
            score_ethics: popupSubScores.ethics ?? undefined,
            first_year_income: popupFirstYearIncome !== '' ? parseInt(popupFirstYearIncome, 10) : undefined,
          })
          // Refresh ratings list after new rating
          const ratingsRes = await ratingsApi.getBySupervisor(id, { page_size: 20 })
          setRatings(ratingsRes.data.items)
          setRatingsTotal(ratingsRes.data.total)
        } catch (e: unknown) {
          const axiosErr = e as { response?: { status?: number } }
          if (axiosErr.response?.status !== 409) throw e
          // 409 = already rated this supervisor — proceed with comment only
        }
      }
      await commentsApi.create({ supervisor_id: id, content: commentText.trim(), is_anonymous: commentAnonymous })
      setCommentText('')
      setCommentAnonymous(false)
      setCommentTosAgreed(false)
      setShowScorePopup(false)
      await refreshComments()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setPopupError(detail || t.supervisor.error_post)
    } finally {
      setPopupSubmitting(false)
    }
  }

  async function handleSubmitReply() {
    if (!replyText.trim() || !id || !replyingTo) return
    if (!isLoggedIn) {
      navigate('/login')
      return
    }
    setSubmittingReply(true)
    setReplyError(null)
    try {
      await commentsApi.create({
        supervisor_id: id,
        content: replyText.trim(),
        parent_comment_id: replyingTo.id,
      })
      setReplyText('')
      setReplyingTo(null)
      await refreshComments()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setReplyError(detail || t.supervisor.error_reply)
    } finally {
      setSubmittingReply(false)
    }
  }

  async function handleVote(commentId: string, voteType: 'up' | 'down') {
    if (!isLoggedIn) {
      navigate('/login')
      return
    }
    setVoteError(null)
    try {
      await commentsApi.vote(commentId, voteType)
      await refreshComments()
    } catch {
      setVoteError(t.supervisor.error_vote)
    }
  }

  function handleReply(commentId: string, authorName: string) {
    if (!isLoggedIn) {
      navigate('/login')
      return
    }
    setReplyingTo({ id: commentId, authorName })
    setReplyText('')
  }

  async function handleChat(comment: Comment) {
    if (!isLoggedIn) { navigate('/login'); return }
    if (!comment.author?.id) return
    try {
      const quoteContent = `${t.supervisor.quote_prefix}\n${comment.content}\n${t.supervisor.quote_suffix}`
      const res = await chatsApi.create({
        recipient_id: comment.author.id,
        supervisor_id: id,
        initial_message: quoteContent,
      })
      navigate('/inbox', { state: { chatId: res.data.id } })
    } catch {
      // ignore — user already sees no feedback, navigate to inbox anyway
      navigate('/inbox')
    }
  }

  return (
    <>
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-12">
      {/* Supervisor info header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-8 mb-4 md:mb-6">
        <p className="text-xs text-gray-400 mb-2">{t.supervisor.page_breadcrumb}</p>
        {loading ? (
          <h1 className="text-2xl font-bold text-gray-400">{t.supervisor.loading}</h1>
        ) : supervisor ? (
          <>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">{supervisor.name}</h1>
            <p className="text-gray-600">
              {supervisor.school_name} · {supervisor.department}
            </p>
            {supervisor.title && (
              <p className="text-sm text-gray-400 mt-1">{supervisor.title}</p>
            )}
            <Link
              to={`/school/${supervisor.school_code}/analytics`}
              className="mt-3 inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition-colors"
            >
              {t.supervisor.view_school_analytics}
            </Link>
          </>
        ) : (
          <h1 className="text-xl text-red-500">{t.supervisor.not_found}</h1>
        )}
      </div>

      {/* Analytics section */}
      {!loading && (
        <>
          {/* Score overview + radar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-8 mb-4 md:mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">{t.supervisor.score_overview}</h2>
              {hasScores && (
                <span className="text-xs text-gray-400">
                  {t.supervisor.rating_verified_count(scores!.total_ratings, scores!.verified_ratings)}
                </span>
              )}
            </div>

            {/* User status filter toggle */}
            <div className="flex gap-1 mb-4">
              {USER_STATUS_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setAnalyticsUserStatus(key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    analyticsUserStatus === key
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
              {analyticsLoading && (
                <span className="text-xs text-gray-400 self-center ml-2">{t.supervisor.updating}</span>
              )}
            </div>

            <div className="flex items-start gap-1.5 text-xs text-sky-600 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 mb-4">
              <span className="shrink-0 mt-px">ℹ</span>
              <span>{t.supervisor.score_disclaimer}</span>
            </div>

            {hasScores ? (
              <>
                <div className="flex flex-wrap items-end gap-4 mb-6">
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-bold text-teal-600">
                      {scores!.avg_overall?.toFixed(2)}
                    </span>
                    <span className="text-gray-400 mb-1">/ 5.00</span>
                    <span className="text-sm text-gray-400 mb-1 ml-1">{t.supervisor.score_labels.overall}</span>
                  </div>
                  {analyticsUserStatus === 'all' && hasVerifiedScores && verifiedScores!.avg_overall != null && (
                    <div className="flex items-end gap-1.5 bg-teal-50 border border-teal-100 rounded-xl px-3 py-1.5">
                      <span className="text-2xl font-bold text-teal-700">
                        {verifiedScores!.avg_overall.toFixed(2)}
                      </span>
                      <div className="mb-0.5">
                        <div className="text-xs text-teal-600 font-medium leading-tight">{t.supervisor.verified_student}</div>
                        <div className="text-xs text-teal-500 leading-tight">{t.supervisor.verified_count(verifiedScores!.total_ratings)}</div>
                      </div>
                    </div>
                  )}
                </div>

                <RadarChart
                  scores={scores!}
                  schoolAvg={analytics!.school_avg_scores.avg_overall != null ? analytics!.school_avg_scores : undefined}
                  avgFirstYearIncome={analytics!.avg_first_year_income}
                />

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 mt-4 md:mt-6">
                  {Object.entries(t.supervisor.score_labels).map(([key, label]) =>
                    key !== 'overall' ? (
                      <div key={key} className="text-center bg-gray-50 rounded-xl p-3">
                        <div className="text-xl font-bold text-gray-800">
                          {scoreForKey(scores!, key)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                      </div>
                    ) : null,
                  )}
                </div>

                {analytics!.school_avg_scores.avg_overall != null && (
                  <div className="mt-4 text-xs text-gray-400 text-center">
                    {t.supervisor.school_comparison
                      .replace('{school}', analytics!.school_avg_scores.avg_overall.toFixed(2))
                      .replace('{national}', analytics!.national_avg_scores.avg_overall?.toFixed(2) ?? '—')}
                  </div>
                )}
              </>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400 gap-2">
                <span className="text-3xl">📊</span>
                <span>{t.supervisor.no_data}</span>
              </div>
            )}
          </div>

          {/* Percentile rankings */}
          {analytics?.percentiles && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-8 mb-4 md:mb-6">
              <h2 className="font-bold text-gray-800 mb-4">{t.supervisor.percentile_title}</h2>
              <PercentileDisplay percentiles={analytics.percentiles} />
              <p className="text-xs text-gray-400 mt-3 text-center">
                {t.supervisor.percentile_note}
              </p>
            </div>
          )}

          {/* Score distribution */}
          {analytics && hasScores && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-8 mb-4 md:mb-6">
              <h2 className="font-bold text-gray-800 mb-4">{t.supervisor.distribution_title}</h2>
              <DistributionChart distribution={analytics.score_distribution} />
            </div>
          )}
        </>
      )}

      {/* Discussion feed */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-8">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h2 className="font-bold text-gray-800">
            {t.supervisor.discussion_title}
            {(ratingsTotal + commentsTotal) > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                {t.supervisor.discussion_count(ratingsTotal + commentsTotal)}
              </span>
            )}
          </h2>
          {isLoggedIn && supervisor && (
            <button
              onClick={() => { setShowEditForm((v) => !v); setEditDone(false) }}
              className="text-xs text-gray-400 hover:text-teal-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              {t.supervisor.suggest_edit}
            </button>
          )}
        </div>

        {/* Inline suggest-edit form */}
        {showEditForm && (
          <form onSubmit={handleEditSubmit} className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <p className="text-xs text-gray-500 mb-2">
              {t.supervisor.edit_hint}
            </p>
            {editFormFields.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <label className="text-xs text-gray-500 w-24 shrink-0">{label}</label>
                <input
                  type="text"
                  value={editFields[key as keyof typeof editFields]}
                  onChange={(e) => setEditFields((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={supervisor?.[key as keyof Supervisor] as string || ''}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={editSubmitting}
                className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {editSubmitting ? t.supervisor.submitting : t.supervisor.edit_submit}
              </button>
              <button
                type="button"
                onClick={() => setShowEditForm(false)}
                className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5"
              >
                {t.supervisor.cancel}
              </button>
            </div>
          </form>
        )}

        {editDone && (
          <p className="text-sm text-teal-600 mb-4">{t.supervisor.edit_success}</p>
        )}

        {/* Comment creation form */}
        {isLoggedIn ? (
          <div className="mb-6">
            <textarea
              ref={commentTextareaRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
              placeholder={t.supervisor.comment_placeholder}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder-gray-400"
            />
            <div className="flex justify-end text-xs text-gray-400 mt-0.5">
              {commentText.length} / {COMMENT_MAX_LENGTH}
            </div>

            {/* Anonymous option */}
            <div className="flex items-center gap-2 mt-2">
              <input
                id="comment-anon"
                type="checkbox"
                checked={commentAnonymous}
                onChange={(e) => setCommentAnonymous(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="comment-anon" className="text-sm text-gray-600 cursor-pointer">
                {t.supervisor.post_anonymous}
              </label>
            </div>

            {/* ToS agreement */}
            <div className="flex items-start gap-2 mt-2">
              <input
                id="comment-tos"
                type="checkbox"
                checked={commentTosAgreed}
                onChange={(e) => setCommentTosAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 shrink-0"
              />
              <label htmlFor="comment-tos" className="text-sm text-gray-600 leading-snug cursor-pointer">
                {t.supervisor.tos_agree}{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 hover:underline"
                >
                  {t.supervisor.tos_link}
                </a>
              </label>
            </div>

            {/* Privacy notice */}
            <div className="mt-3 text-xs text-gray-400 space-y-1 leading-relaxed">
              <p>{t.supervisor.privacy_note1}</p>
              <p>{t.supervisor.privacy_note2}</p>
              <p>{t.supervisor.privacy_note3}</p>
            </div>

            {commentError && (
              <p className="text-xs text-red-500 mt-2">{commentError}</p>
            )}
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSubmitComment}
                disabled={!commentText.trim() || !commentTosAgreed}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.supervisor.submit_comment}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6 py-4 px-4 bg-gray-50 rounded-xl text-sm text-gray-500 text-center">
            <Link to="/login" className="text-teal-600 hover:underline font-medium">{t.nav.login}</Link>
            {' '}{t.supervisor.login_to_discuss}
          </div>
        )}

        {/* Unified feed */}
        {feedItems.length > 0 ? (
          <div className="space-y-4 mb-8">
            {feedItems.map((item) => {
              if (item.type === 'combined') {
                return (
                  <CombinedCard
                    key={`combined-${item.rating.id}-${item.comment.id}`}
                    rating={item.rating}
                    comment={item.comment}
                    isLoggedIn={isLoggedIn}
                    currentUserId={currentUserId}
                    onVote={handleVote}
                    onReply={handleReply}
                    onChat={handleChat}
                  />
                )
              }
              if (item.type === 'rating') {
                return <RatingCard key={item.data.id} rating={item.data} />
              }
              return (
                <CommentCard
                  key={item.data.id}
                  comment={item.data}
                  isLoggedIn={isLoggedIn}
                  currentUserId={currentUserId}
                  onVote={handleVote}
                  onReply={handleReply}
                  onChat={handleChat}
                />
              )
            })}
            {(ratingsTotal > ratings.length || commentsTotal > comments.length) && (
              <p className="text-xs text-gray-400 text-center">
                {t.supervisor.partial_feed(ratingsTotal + commentsTotal)}
              </p>
            )}
          </div>
        ) : (
          !loading && (
            <p className="text-gray-400 text-center py-6">{t.supervisor.no_reviews}</p>
          )
        )}

        {/* Reply form */}
        {replyingTo && (
          <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-teal-700">{t.supervisor.reply_label_for.replace('{name}', replyingTo.authorName)}</span>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                {t.supervisor.cancel}
              </button>
            </div>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={t.supervisor.reply_placeholder}
              rows={2}
              className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
              autoFocus
            />
            {replyError && (
              <p className="text-xs text-red-500 mt-1">{replyError}</p>
            )}
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSubmitReply}
                disabled={submittingReply || !replyText.trim()}
                className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingReply ? t.supervisor.replying : t.supervisor.reply}
              </button>
            </div>
          </div>
        )}

        {/* Vote error feedback */}
        {voteError && (
          <p className="text-xs text-red-500 mt-3">{voteError}</p>
        )}
      </div>

      {/* Legal Disclaimer */}
      <div className="px-1 pt-6 pb-2">
        <p className="text-sm font-semibold text-gray-400 mb-1.5">{t.supervisor.disclaimer_title}</p>
        <p className="text-sm text-gray-400 leading-relaxed">
          {t.supervisor.disclaimer_body}
        </p>
      </div>
    </div>

    {/* Score Popup Modal */}
    {showScorePopup && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => { if (!popupSubmitting) setShowScorePopup(false) }}
        />
        {/* Card */}
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">{t.supervisor.score_popup_title}</h2>
          <p className="text-xs text-gray-500 mb-4">{t.supervisor.score_popup_hint}</p>

          {/* Overall score */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 mb-3">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              {t.supervisor.score_popup_overall_section} <span className="text-red-500">*</span>
            </p>
            <PopupStarPicker
              label={t.supervisor.score_labels.overall}
              value={popupOverallScore}
              onChange={setPopupOverallScore}
              required
            />
          </div>

          {/* Sub-scores */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              {t.supervisor.score_popup_sub_section}
            </p>
            <div className="divide-y divide-gray-100">
              {SUB_SCORE_KEYS.map((key) => (
                <PopupStarPicker
                  key={key}
                  label={t.supervisor.score_labels[key]}
                  value={popupSubScores[key]}
                  onChange={(v) => setPopupSubScores((prev) => ({ ...prev, [key]: v }))}
                />
              ))}
            </div>
          </div>

          {/* First-year income */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              {t.supervisor.first_year_income_label}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">¥</span>
              <input
                type="number"
                value={popupFirstYearIncome}
                onChange={(e) => setPopupFirstYearIncome(e.target.value)}
                placeholder={t.supervisor.income_placeholder}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
              <span className="text-sm text-gray-400">{t.supervisor.income_unit}</span>
            </div>
          </div>

          {popupError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-3">
              {popupError}
            </div>
          )}

          <button
            type="button"
            onClick={() => handlePopupSubmit(false)}
            disabled={popupSubmitting || popupOverallScore == null}
            className="w-full bg-teal-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-2"
          >
            {popupSubmitting ? t.supervisor.submitting : t.supervisor.score_popup_submit}
          </button>
          <button
            type="button"
            onClick={() => handlePopupSubmit(true)}
            disabled={popupSubmitting}
            className="w-full text-sm text-gray-500 hover:text-teal-600 py-2 transition-colors disabled:opacity-40"
          >
            {t.supervisor.score_popup_skip}
          </button>
        </div>
      </div>
    )}
    </>
  )
}
