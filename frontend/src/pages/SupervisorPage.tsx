import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { zh } from '@/i18n/zh'
import { supervisorsApi, analyticsApi, ratingsApi, commentsApi } from '@/services/api'
import type { Supervisor, SupervisorAnalytics, ScoreBreakdown, Rating, Comment } from '@/types'
import RadarChart from '@/components/RadarChart'
import DistributionChart from '@/components/DistributionChart'
import PercentileDisplay from '@/components/PercentileDisplay'

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
          <span className="text-sm font-medium text-gray-700">{rating.display_name || '匿名'}</span>
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

function CommentCard({ comment }: { comment: Comment }) {
  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {comment.author?.display_name || '匿名'}
          </span>
          {comment.author?.is_student_verified && (
            <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">
              {zh.supervisor.verified_badge}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
      </div>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.content}</p>
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        <span>👍 {comment.likes_count}</span>
        <span>👎 {comment.dislikes_count}</span>
        {comment.reply_count > 0 && <span>💬 {comment.reply_count} 条回复</span>}
      </div>
      {comment.replies?.length > 0 && (
        <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200">
          {comment.replies.map((r) => (
            <div key={r.id} className="text-sm">
              <span className="font-medium text-gray-600">{r.author?.display_name || '匿名'}：</span>
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
  const [ratings, setRatings] = useState<Rating[]>([])
  const [ratingsTotal, setRatingsTotal] = useState(0)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsTotal, setCommentsTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const isLoggedIn = !!localStorage.getItem('access_token')

  useEffect(() => {
    if (!id) return
    Promise.allSettled([
      supervisorsApi.get(id),
      analyticsApi.getSupervisor(id),
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
  const hasScores = scores != null && scores.total_ratings > 0

  function handleWriteReview() {
    if (!isLoggedIn) {
      navigate('/login')
    } else {
      navigate(`/supervisor/${id}/rate`)
    }
  }

  return (
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

            {hasScores ? (
              <>
                <div className="flex items-end gap-2 mb-6">
                  <span className="text-5xl font-bold text-teal-600">
                    {scores!.avg_overall?.toFixed(2)}
                  </span>
                  <span className="text-gray-400 mb-1">/ 5.00</span>
                  <span className="text-sm text-gray-400 mb-1 ml-2">综合评分</span>
                </div>

                <RadarChart
                  scores={scores!}
                  schoolAvg={analytics!.school_avg_scores}
                  nationalAvg={analytics!.national_avg_scores}
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
            学生评价
            {ratingsTotal > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                {zh.supervisor.rating_count(ratingsTotal)}
              </span>
            )}
          </h2>
          <button
            onClick={handleWriteReview}
            className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700 transition-colors"
          >
            {zh.supervisor.write_review}
          </button>
        </div>

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

        {/* Comments section */}
        {commentsTotal > 0 && (
          <>
            <h3 className="font-semibold text-gray-700 mb-4 mt-2">
              讨论区
              <span className="ml-2 text-sm font-normal text-gray-400">{commentsTotal} 条</span>
            </h3>
            <div className="space-y-4">
              {comments.map((c) => (
                <CommentCard key={c.id} comment={c} />
              ))}
              {commentsTotal > comments.length && (
                <p className="text-xs text-gray-400 text-center">显示前 {comments.length} 条，共 {commentsTotal} 条</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
