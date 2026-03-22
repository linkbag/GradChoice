import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import type { Supervisor, Rating, SupervisorRatingCache, User, VoteType } from '@/types'
import { supervisorsApi, ratingsApi, usersApi } from '@/services/api'
import { zh } from '@/i18n/zh'
import RatingForm from '@/components/RatingForm'
import RatingCard from '@/components/RatingCard'
import RatingSummary from '@/components/RatingSummary'

type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest' | 'most_helpful'

const SORT_LABELS: Record<SortOption, string> = {
  newest: '最新',
  oldest: '最早',
  highest: '最高分',
  lowest: '最低分',
  most_helpful: '最有用',
}

const PAGE_SIZE = 10

export default function SupervisorPage() {
  const { id } = useParams<{ id: string }>()

  const [supervisor, setSupervisor] = useState<Supervisor | null>(null)
  const [cache, setCache] = useState<SupervisorRatingCache | null>(null)
  const [ratings, setRatings] = useState<Rating[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortOption>('newest')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingRating, setEditingRating] = useState<Rating | null>(null)

  // Load supervisor info and current user in parallel
  useEffect(() => {
    if (!id) return
    Promise.allSettled([supervisorsApi.get(id), usersApi.getMe()]).then(([supResult, userResult]) => {
      if (supResult.status === 'fulfilled') setSupervisor(supResult.value.data)
      if (userResult.status === 'fulfilled') setCurrentUser(userResult.value.data)
    })
  }, [id])

  const loadRatings = useCallback(
    async (newPage: number, newSort: SortOption, newVerifiedOnly: boolean, append: boolean) => {
      if (!id) return
      if (newPage === 1) setLoading(true)
      else setLoadingMore(true)

      try {
        const ratingsPromise = ratingsApi.getBySupervisor(id, {
          page: newPage,
          page_size: PAGE_SIZE,
          sort: newSort,
          verified_only: newVerifiedOnly,
        })
        const summaryPromise = newPage === 1 ? ratingsApi.getSummary(id) : null

        const [ratingsRes, summaryRes] = await Promise.all([
          ratingsPromise,
          summaryPromise ?? Promise.resolve(null),
        ])

        if (summaryRes) setCache(summaryRes.data)
        setTotal(ratingsRes.data.total)
        setRatings((prev) => (append ? [...prev, ...ratingsRes.data.items] : ratingsRes.data.items))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [id],
  )

  useEffect(() => {
    setPage(1)
    setRatings([])
    loadRatings(1, sort, verifiedOnly, false)
  }, [sort, verifiedOnly, loadRatings])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    loadRatings(nextPage, sort, verifiedOnly, true)
  }

  const handleRatingSuccess = (_rating: Rating) => {
    setShowForm(false)
    setEditingRating(null)
    setPage(1)
    setRatings([])
    loadRatings(1, sort, verifiedOnly, false)
  }

  const handleEdit = (rating: Rating) => {
    setEditingRating(rating)
    setShowForm(true)
  }

  const handleDelete = (ratingId: string) => {
    setRatings((prev) => prev.filter((r) => r.id !== ratingId))
    setTotal((prev) => prev - 1)
    if (id) ratingsApi.getSummary(id).then((res) => setCache(res.data)).catch(() => {})
  }

  const handleVoteChange = (
    ratingId: string,
    newUpvotes: number,
    newDownvotes: number,
    userVote: VoteType | null,
  ) => {
    setRatings((prev) =>
      prev.map((r) =>
        r.id === ratingId ? { ...r, upvotes: newUpvotes, downvotes: newDownvotes, user_vote: userVote } : r,
      ),
    )
  }

  const canWriteReview = currentUser?.is_email_verified ?? false
  const hasMore = ratings.length < total

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Supervisor info header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
        <p className="text-xs text-gray-400 mb-2">导师主页</p>
        {supervisor ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{supervisor.name}</h1>
            <p className="text-gray-600">
              {supervisor.school_name} · {supervisor.department}
            </p>
            {supervisor.title && <p className="text-sm text-gray-500 mt-1">{supervisor.title}</p>}
            {(supervisor.webpage_url_1 || supervisor.webpage_url_2 || supervisor.webpage_url_3) && (
              <div className="flex flex-wrap gap-3 mt-3">
                {[supervisor.webpage_url_1, supervisor.webpage_url_2, supervisor.webpage_url_3]
                  .filter(Boolean)
                  .map((url, i) => (
                    <a
                      key={i}
                      href={url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-600 hover:underline"
                    >
                      个人主页 {i + 1}
                    </a>
                  ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="h-7 bg-gray-100 rounded w-32 mb-2 animate-pulse" />
            <div className="h-4 bg-gray-100 rounded w-48 animate-pulse" />
          </>
        )}
      </div>

      {/* Rating summary */}
      {cache && cache.all_count > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
          <h2 className="font-bold text-gray-800 mb-5">{zh.supervisor.score_labels.overall}</h2>
          <RatingSummary cache={cache} />
        </div>
      )}

      {/* Ratings list */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-gray-800">学生评价</h2>
            {total > 0 && <p className="text-xs text-gray-500 mt-0.5">{zh.supervisor.rating_count(total)}</p>}
          </div>
          {canWriteReview ? (
            <button
              type="button"
              onClick={() => {
                setEditingRating(null)
                setShowForm(true)
              }}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 transition-colors"
            >
              {zh.supervisor.write_review}
            </button>
          ) : (
            <span className="text-xs text-gray-400">
              {currentUser ? '请验证邮箱后评价' : '登录后即可评价'}
            </span>
          )}
        </div>

        {/* Sort + filter */}
        {(total > 0 || loading) && (
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">排序：</span>
              <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
                {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSort(s)}
                    className={`px-2.5 py-1.5 transition-colors ${
                      sort === s ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {SORT_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              仅显示已验证评价
            </label>
          </div>
        )}

        {/* Cards */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : ratings.length === 0 ? (
          <p className="text-gray-400 text-center py-12">{zh.supervisor.no_ratings}</p>
        ) : (
          <div className="space-y-4">
            {ratings.map((r) => (
              <RatingCard
                key={r.id}
                rating={r}
                currentUserId={currentUser?.id ?? null}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onVoteChange={handleVoteChange}
              />
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-3 text-sm text-brand-600 hover:text-brand-700 border border-brand-200 rounded-xl hover:bg-brand-50 transition-colors disabled:opacity-50"
              >
                {loadingMore ? '加载中…' : '加载更多'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Rating form modal */}
      {showForm && id && (
        <RatingForm
          supervisorId={id}
          existingRating={editingRating}
          isVerified={currentUser?.is_student_verified}
          onSuccess={handleRatingSuccess}
          onCancel={() => {
            setShowForm(false)
            setEditingRating(null)
          }}
        />
      )}
    </div>
  )
}
