import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { zh } from '@/i18n/zh'
import { supervisorsApi, analyticsApi, ratingsApi, commentsApi, editProposalsApi, usersApi, chatsApi } from '@/services/api'
import type { Supervisor, SupervisorAnalytics, ScoreBreakdown, Rating, Comment } from '@/types'
import RadarChart from '@/components/RadarChart'
import DistributionChart from '@/components/DistributionChart'
import PercentileDisplay from '@/components/PercentileDisplay'

type UserStatus = 'all' | 'verified' | 'unverified'

const SUB_SCORE_KEYS = ['academic', 'mentoring', 'wellbeing', 'stipend', 'resources', 'ethics'] as const
type SubScoreKey = typeof SUB_SCORE_KEYS[number]

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
            aria-label={`${star}星`}
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
            清除
          </button>
        )}
        {value != null && (
          <span className="text-sm font-medium text-teal-600 ml-2 w-6">{value}.0</span>
        )}
      </div>
    </div>
  )
}

const USER_STATUS_TABS: { key: UserStatus; label: string }[] = [
  { key: 'all', label: zh.supervisor.user_status_all },
  { key: 'verified', label: zh.supervisor.user_status_verified },
  { key: 'unverified', label: zh.supervisor.user_status_unverified },
]

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
    <span className="text-yellow-400 text-sm" aria-label={`${score}分`}>
      {'★'.repeat(score)}{'☆'.repeat(5 - score)}
    </span>
  )
}

function RatingCard({ rating }: { rating: Rating }) {
  const subScores = Object.entries(zh.supervisor.score_labels)
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
            {rating.display_name || '匿名'}
          </Link>
          {rating.is_verified_rating && (
            <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">
              {zh.supervisor.verified_badge}
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
  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {comment.is_anonymous ? (
            <span className="text-sm font-medium text-gray-700">匿名用户</span>
          ) : comment.author?.id ? (
            <Link
              to={`/users/${comment.author.id}/profile`}
              className="text-sm font-medium text-teal-600 hover:underline cursor-pointer"
            >
              {comment.author.display_name || '匿名'}
            </Link>
          ) : (
            <span className="text-sm font-medium text-gray-700">匿名</span>
          )}
          {comment.is_verified_comment ? (
            <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">
              ✅ {zh.supervisor.verified_badge}
            </span>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
              {zh.supervisor.unverified_badge}
            </span>
          )}
          {comment.is_edited && (
            <span className="text-xs text-gray-400">（已编辑）</span>
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
          title={isLoggedIn ? '点赞' : '登录后点赞'}
        >
          👍 {comment.likes_count}
        </button>
        <button
          onClick={() => onVote(comment.id, 'down')}
          className={`flex items-center gap-1 transition-colors hover:text-red-500 ${
            comment.user_vote === 'down' ? 'text-red-500 font-medium' : 'text-gray-400'
          }`}
          title={isLoggedIn ? '踩' : '登录后踩'}
        >
          👎 {comment.dislikes_count}
        </button>
        <button
          onClick={() => onReply(comment.id, comment.author?.display_name || '匿名')}
          className="text-gray-400 hover:text-teal-600 transition-colors"
        >
          回复
        </button>
        {isLoggedIn && !comment.is_anonymous && comment.author?.id && comment.author.id !== currentUserId && (
          <button
            onClick={() => onChat(comment)}
            className="text-gray-400 hover:text-teal-600 transition-colors"
          >
            私信
          </button>
        )}
        {comment.reply_count > 0 && (
          <span className="text-gray-400">💬 {comment.reply_count} 条回复</span>
        )}
      </div>
      {comment.replies?.length > 0 && (
        <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200">
          {comment.replies.map((r) => (
            <div key={r.id} className="text-sm">
              {r.is_anonymous ? (
                <span className="font-medium text-gray-600">匿名用户</span>
              ) : r.author?.id ? (
                <Link
                  to={`/users/${r.author.id}/profile`}
                  className="font-medium text-teal-600 hover:underline cursor-pointer"
                >
                  {r.author.display_name || '匿名'}
                </Link>
              ) : (
                <span className="font-medium text-gray-600">匿名</span>
              )}
              {r.is_verified_comment ? (
                <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full mx-1">
                  ✅ {zh.supervisor.verified_badge}
                </span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full mx-1">
                  {zh.supervisor.unverified_badge}
                </span>
              )}
              <span className="text-gray-600">：</span>
              <span className="text-gray-700">{r.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SupervisorPage() {
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

  const scores = analytics?.scores
  const verifiedScores = analytics?.verified_scores
  const hasScores = scores != null && scores.total_ratings > 0
  const hasVerifiedScores = verifiedScores != null && verifiedScores.total_ratings > 0

  function handleWriteReview() {
    if (!isLoggedIn) {
      navigate('/login')
    } else {
      navigate(`/supervisor/${id}/rate`)
    }
  }

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
      setCommentError('请先同意服务条款与免责声明')
      return
    }
    // Reset and show score popup
    setPopupOverallScore(null)
    setPopupSubScores({ academic: null, mentoring: null, wellbeing: null, stipend: null, resources: null, ethics: null })
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
      setPopupError(detail || '发布失败，请重试')
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
      setReplyError(detail || '回复失败，请重试')
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
      setVoteError('投票失败，请重试')
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
      const quoteContent = `【引用评论】\n${comment.content}\n【/引用评论】`
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
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Supervisor info header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
        <p className="text-xs text-gray-400 mb-2">导师主页</p>
        {loading ? (
          <h1 className="text-2xl font-bold text-gray-400">加载中…</h1>
        ) : supervisor ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{supervisor.name}</h1>
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
              查看院校数据 →
            </Link>
          </>
        ) : (
          <h1 className="text-xl text-red-500">导师不存在</h1>
        )}
      </div>

      {/* Analytics section */}
      {!loading && (
        <>
          {/* Score overview + radar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">评分概览</h2>
              {hasScores && (
                <span className="text-xs text-gray-400">
                  {scores!.total_ratings} 条评价（{scores!.verified_ratings} 条认证）
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
                <span className="text-xs text-gray-400 self-center ml-2">更新中…</span>
              )}
            </div>

            <div className="flex items-start gap-1.5 text-xs text-sky-600 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 mb-4">
              <span className="shrink-0 mt-px">ℹ</span>
              <span>{zh.supervisor.score_disclaimer}</span>
            </div>

            {hasScores ? (
              <>
                <div className="flex flex-wrap items-end gap-4 mb-6">
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-bold text-teal-600">
                      {scores!.avg_overall?.toFixed(2)}
                    </span>
                    <span className="text-gray-400 mb-1">/ 5.00</span>
                    <span className="text-sm text-gray-400 mb-1 ml-1">综合评分</span>
                  </div>
                  {analyticsUserStatus === 'all' && hasVerifiedScores && verifiedScores!.avg_overall != null && (
                    <div className="flex items-end gap-1.5 bg-teal-50 border border-teal-100 rounded-xl px-3 py-1.5">
                      <span className="text-2xl font-bold text-teal-700">
                        {verifiedScores!.avg_overall.toFixed(2)}
                      </span>
                      <div className="mb-0.5">
                        <div className="text-xs text-teal-600 font-medium leading-tight">认证学生</div>
                        <div className="text-xs text-teal-500 leading-tight">({verifiedScores!.total_ratings} 条)</div>
                      </div>
                    </div>
                  )}
                </div>

                <RadarChart
                  scores={scores!}
                  schoolAvg={analytics!.school_avg_scores.avg_overall != null ? analytics!.school_avg_scores : undefined}
                  avgFirstYearIncome={analytics!.avg_first_year_income}
                />

                <div className="grid grid-cols-3 gap-3 mt-6">
                  {Object.entries(zh.supervisor.score_labels).map(([key, label]) =>
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
                    与校均值对比 · 校均 {analytics!.school_avg_scores.avg_overall.toFixed(2)} ·
                    全国均 {analytics!.national_avg_scores.avg_overall?.toFixed(2) ?? '—'}
                  </div>
                )}
              </>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400 gap-2">
                <span className="text-3xl">📊</span>
                <span>新导师，暂无足够评价数据</span>
              </div>
            )}
          </div>

          {/* Percentile rankings */}
          {analytics?.percentiles && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
              <h2 className="font-bold text-gray-800 mb-4">百分位排名</h2>
              <PercentileDisplay percentiles={analytics.percentiles} />
              <p className="text-xs text-gray-400 mt-3 text-center">
                * 超过 X% 的导师 = 该导师评分高于 X% 的同类导师（至少 3 条评价才计入排名）
              </p>
            </div>
          )}

          {/* Score distribution */}
          {analytics && hasScores && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
              <h2 className="font-bold text-gray-800 mb-4">评分分布</h2>
              <DistributionChart distribution={analytics.score_distribution} />
            </div>
          )}
        </>
      )}

      {/* Ratings & Comments */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-gray-800">
            学生评分
            {ratingsTotal > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                {zh.supervisor.rating_count(ratingsTotal)}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {isLoggedIn && supervisor && (
              <button
                onClick={() => { setShowEditForm((v) => !v); setEditDone(false) }}
                className="text-xs text-gray-400 hover:text-teal-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                建议修改信息
              </button>
            )}
            <button
              onClick={handleWriteReview}
              className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700 transition-colors"
            >
              {zh.supervisor.write_review}
            </button>
          </div>
        </div>

        {/* Inline suggest-edit form */}
        {showEditForm && (
          <form onSubmit={handleEditSubmit} className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <p className="text-xs text-gray-500 mb-2">
              填写需要修改的字段（留空的字段不会被修改），提交后由两位认证学生审核通过才会生效。
            </p>
            {[
              { key: 'title', label: '职称' },
              { key: 'affiliated_unit', label: '所属单位' },
              { key: 'webpage_url_1', label: '主页链接 1' },
              { key: 'webpage_url_2', label: '主页链接 2' },
              { key: 'webpage_url_3', label: '主页链接 3' },
            ].map(({ key, label }) => (
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
                {editSubmitting ? '提交中…' : '提交修改建议'}
              </button>
              <button
                type="button"
                onClick={() => setShowEditForm(false)}
                className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5"
              >
                取消
              </button>
            </div>
          </form>
        )}

        {editDone && (
          <p className="text-sm text-teal-600 mb-4">修改建议已提交，感谢你的贡献！</p>
        )}

        {/* Ratings list */}
        {ratings.length > 0 ? (
          <div className="space-y-4 mb-8">
            {ratings.map((r) => (
              <RatingCard key={r.id} rating={r} />
            ))}
            {ratingsTotal > ratings.length && (
              <p className="text-xs text-gray-400 text-center">显示前 {ratings.length} 条，共 {ratingsTotal} 条</p>
            )}
          </div>
        ) : (
          !loading && (
            <p className="text-gray-400 text-center py-6">{zh.supervisor.no_ratings}</p>
          )
        )}

        {/* Comments section — always visible */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">
            讨论区
            {commentsTotal > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">{commentsTotal} 条</span>
            )}
          </h3>

          {/* Comment creation form */}
          {isLoggedIn ? (
            <div className="mb-6">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
                placeholder="建议从以下方面分享：&#10;1. 自证与导师的关系（如导师的口头禅/特征辨识）&#10;2. 学术水平&#10;3. 学生培养&#10;4. 身心健康（工作时间、师生关系）&#10;5. 科研资源&#10;6. 生活补助&#10;7. 学术道德"
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
                  匿名发布
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
                  我了解并同意本站{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:underline"
                  >
                    服务条款与免责声明
                  </a>
                </label>
              </div>

              {/* Privacy notice */}
              <div className="mt-3 text-xs text-gray-400 space-y-1 leading-relaxed">
                <p>
                  研选尊重并保护所有用户的个人隐私权，用户的个人资料，非经用户许可或根据相关法律法规的强制性规定，研选不会主动地泄露给第三方。
                </p>
                <p>用户在研选发布的言论仅代表其个人意见和观点，与研选立场无关。</p>
                <p>用户因其使用研选产生的一切后果由其自己承担，研选不承担任何责任。</p>
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
                  发布
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6 py-4 px-4 bg-gray-50 rounded-xl text-sm text-gray-500 text-center">
              <Link to="/login" className="text-teal-600 hover:underline font-medium">登录</Link>
              {' '}后参与讨论
            </div>
          )}

          {/* Reply form */}
          {replyingTo && (
            <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-teal-700">回复 {replyingTo.authorName}</span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  取消
                </button>
              </div>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="输入回复…"
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
                  {submittingReply ? '回复中…' : '回复'}
                </button>
              </div>
            </div>
          )}

          {/* Vote error feedback */}
          {voteError && (
            <p className="text-xs text-red-500 mb-3">{voteError}</p>
          )}

          {/* Comments list */}
          {comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((c) => (
                <CommentCard
                  key={c.id}
                  comment={c}
                  isLoggedIn={isLoggedIn}
                  currentUserId={currentUserId}
                  onVote={handleVote}
                  onReply={handleReply}
                  onChat={handleChat}
                />
              ))}
              {commentsTotal > comments.length && (
                <p className="text-xs text-gray-400 text-center">显示前 {comments.length} 条，共 {commentsTotal} 条</p>
              )}
            </div>
          ) : (
            !loading && (
              <p className="text-gray-400 text-sm text-center py-4">暂无讨论，来发起第一条吧</p>
            )
          )}
        </div>
      </div>
      {/* Legal Disclaimer */}
      <div className="px-1 pt-6 pb-2">
        <p className="text-sm font-semibold text-gray-400 mb-1.5">⚖️ 免责声明</p>
        <p className="text-sm text-gray-400 leading-relaxed">
          本平台所有评价内容均为用户个人观点，仅代表发布者本人立场，不代表研选 GradChoice 平台立场。平台不对评价内容的真实性、准确性或合法性承担责任。如您认为某条评价侵犯了您的合法权益，请通过平台举报功能联系我们，我们将在核实后依法处理。
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
          <h2 className="text-lg font-bold text-gray-900 mb-1">{zh.supervisor.score_popup_title}</h2>
          <p className="text-xs text-gray-500 mb-4">{zh.supervisor.score_popup_hint}</p>

          {/* Overall score */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 mb-3">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              {zh.supervisor.score_popup_overall_section} <span className="text-red-500">*</span>
            </p>
            <PopupStarPicker
              label={zh.supervisor.score_labels.overall}
              value={popupOverallScore}
              onChange={setPopupOverallScore}
              required
            />
          </div>

          {/* Sub-scores */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              {zh.supervisor.score_popup_sub_section}
            </p>
            <div className="divide-y divide-gray-100">
              {SUB_SCORE_KEYS.map((key) => (
                <PopupStarPicker
                  key={key}
                  label={zh.supervisor.score_labels[key]}
                  value={popupSubScores[key]}
                  onChange={(v) => setPopupSubScores((prev) => ({ ...prev, [key]: v }))}
                />
              ))}
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
            {popupSubmitting ? '提交中…' : zh.supervisor.score_popup_submit}
          </button>
          <button
            type="button"
            onClick={() => handlePopupSubmit(true)}
            disabled={popupSubmitting}
            className="w-full text-sm text-gray-500 hover:text-teal-600 py-2 transition-colors disabled:opacity-40"
          >
            {zh.supervisor.score_popup_skip}
          </button>
        </div>
      </div>
    )}
    </>
  )
}
