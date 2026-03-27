import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usersApi, ratingsApi, commentsApi } from '@/services/api'
import type { Rating, Comment } from '@/types'
import { zh } from '@/i18n/zh'

const SCORE_LABELS: Record<string, string> = {
  overall_score: zh.supervisor.score_labels.overall,
  score_academic: zh.supervisor.score_labels.academic,
  score_mentoring: zh.supervisor.score_labels.mentoring,
  score_wellbeing: zh.supervisor.score_labels.wellbeing,
  score_stipend: zh.supervisor.score_labels.stipend,
  score_resources: zh.supervisor.score_labels.resources,
  score_ethics: zh.supervisor.score_labels.ethics,
}

function ScoreDot({ value }: { value: number }) {
  const color =
    value >= 4 ? 'bg-green-500' : value >= 3 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${color} mr-1`} />
  )
}

// ─── Ratings Tab ────────────────────────────────────────────────────────────

interface EditRatingState {
  overall_score: number
  score_academic: number | null
  score_mentoring: number | null
  score_wellbeing: number | null
  score_stipend: number | null
  score_resources: number | null
  score_ethics: number | null
}

function RatingCard({
  rating,
  onDeleted,
  onUpdated,
}: {
  rating: Rating
  onDeleted: (id: string) => void
  onUpdated: (r: Rating) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [draft, setDraft] = useState<EditRatingState>({
    overall_score: rating.overall_score,
    score_academic: rating.score_academic,
    score_mentoring: rating.score_mentoring,
    score_wellbeing: rating.score_wellbeing,
    score_stipend: rating.score_stipend,
    score_resources: rating.score_resources,
    score_ethics: rating.score_ethics,
  })

  const startEdit = () => {
    setDraft({
      overall_score: rating.overall_score,
      score_academic: rating.score_academic,
      score_mentoring: rating.score_mentoring,
      score_wellbeing: rating.score_wellbeing,
      score_stipend: rating.score_stipend,
      score_resources: rating.score_resources,
      score_ethics: rating.score_ethics,
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const res = await ratingsApi.update(rating.id, draft)
      onUpdated(res.data)
      setEditing(false)
    } catch {
      // keep editing
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('确认删除这条评分？')) return
    setDeleting(true)
    try {
      await ratingsApi.delete(rating.id)
      onDeleted(rating.id)
    } catch {
      setDeleting(false)
    }
  }

  const setScore = (field: keyof EditRatingState, val: number) => {
    setDraft((d) => ({ ...d, [field]: val }))
  }

  const subScores: Array<{ key: keyof EditRatingState; label: string }> = [
    { key: 'score_academic', label: SCORE_LABELS.score_academic },
    { key: 'score_mentoring', label: SCORE_LABELS.score_mentoring },
    { key: 'score_wellbeing', label: SCORE_LABELS.score_wellbeing },
    { key: 'score_stipend', label: SCORE_LABELS.score_stipend },
    { key: 'score_resources', label: SCORE_LABELS.score_resources },
    { key: 'score_ethics', label: SCORE_LABELS.score_ethics },
  ]

  const date = new Date(rating.created_at).toLocaleDateString('zh-CN')

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <Link
            to={`/supervisor/${rating.supervisor_id}`}
            className="font-semibold text-gray-900 hover:text-brand-600 transition-colors"
          >
            {rating.supervisor_name ?? '未知导师'}
          </Link>
          <p className="text-xs text-gray-400 mt-0.5">{date}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={startEdit}
            disabled={editing || deleting}
            className="text-xs text-brand-600 hover:underline disabled:opacity-40"
          >
            编辑
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-500 hover:underline disabled:opacity-40"
          >
            {deleting ? '删除中…' : '删除'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          {/* Overall score */}
          <div>
            <p className="text-xs text-gray-500 mb-1">{SCORE_LABELS.overall_score}（必填）</p>
            <ScoreInput
              value={draft.overall_score}
              onChange={(v) => setScore('overall_score', v)}
            />
          </div>
          {/* Sub scores */}
          <div className="grid grid-cols-2 gap-2">
            {subScores.map(({ key, label }) => (
              <div key={key}>
                <p className="text-xs text-gray-500 mb-1">{label}（可选）</p>
                <ScoreInput
                  value={draft[key] ?? null}
                  onChange={(v) => setScore(key, v)}
                  nullable
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="text-sm bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ScoreDot value={rating.overall_score} />
            <span className="text-sm font-medium text-gray-800">
              {SCORE_LABELS.overall_score}：{rating.overall_score.toFixed(1)}
            </span>
            {rating.is_verified_rating && (
              <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">已认证</span>
            )}
          </div>
          {subScores.some(({ key }) => rating[key] != null) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {subScores.map(({ key, label }) =>
                rating[key] != null ? (
                  <span key={key} className="text-xs text-gray-500">
                    {label} {(rating[key] as number).toFixed(1)}
                  </span>
                ) : null,
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScoreInput({
  value,
  onChange,
  nullable = false,
}: {
  value: number | null
  onChange: (v: number) => void
  nullable?: boolean
}) {
  return (
    <div className="flex gap-1">
      {nullable && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className={`text-xs px-2 py-1 rounded border ${
            value === null || value === 0
              ? 'border-gray-400 bg-gray-100 text-gray-500'
              : 'border-gray-200 text-gray-400 hover:border-gray-300'
          }`}
        >
          不评
        </button>
      )}
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-8 h-8 text-sm rounded border transition-colors ${
            value === n
              ? 'bg-brand-600 text-white border-brand-600'
              : 'border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

// ─── Comments Tab ────────────────────────────────────────────────────────────

function CommentCard({
  comment,
  onDeleted,
  onUpdated,
}: {
  comment: Comment
  onDeleted: (id: string) => void
  onUpdated: (c: Comment) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const saveEdit = async () => {
    if (!draft.trim()) return
    setSaving(true)
    try {
      const res = await commentsApi.update(comment.id, draft.trim())
      onUpdated(res.data)
      setEditing(false)
    } catch {
      // keep editing
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('确认删除这条评论？')) return
    setDeleting(true)
    try {
      await commentsApi.delete(comment.id)
      onDeleted(comment.id)
    } catch {
      setDeleting(false)
    }
  }

  const date = new Date(comment.created_at).toLocaleDateString('zh-CN')

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <Link
            to={`/supervisor/${comment.supervisor_id}`}
            className="font-semibold text-gray-900 hover:text-brand-600 transition-colors"
          >
            {comment.supervisor_name ?? '未知导师'}
          </Link>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-gray-400">{date}</p>
            {comment.is_anonymous && (
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">匿名</span>
            )}
            {comment.is_edited && (
              <span className="text-xs text-gray-400">（已编辑）</span>
            )}
            {comment.is_verified_comment && (
              <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">已认证</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setDraft(comment.content); setEditing(true) }}
            disabled={editing || deleting}
            className="text-xs text-brand-600 hover:underline disabled:opacity-40"
          >
            编辑
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-500 hover:underline disabled:opacity-40"
          >
            {deleting ? '删除中…' : '删除'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              disabled={saving || !draft.trim()}
              className="text-sm bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type Tab = 'ratings' | 'comments'

export default function MyReviewsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('ratings')

  const [ratings, setRatings] = useState<Rating[]>([])
  const [ratingsTotal, setRatingsTotal] = useState(0)
  const [ratingsPage, setRatingsPage] = useState(1)
  const [ratingsLoading, setRatingsLoading] = useState(false)

  const [comments, setComments] = useState<Comment[]>([])
  const [commentsTotal, setCommentsTotal] = useState(0)
  const [commentsPage, setCommentsPage] = useState(1)
  const [commentsLoading, setCommentsLoading] = useState(false)

  const PAGE_SIZE = 20

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
    }
  }, [navigate])

  useEffect(() => {
    setRatingsLoading(true)
    usersApi
      .getMyRatings({ page: ratingsPage, page_size: PAGE_SIZE })
      .then((res) => {
        setRatings(res.data.items)
        setRatingsTotal(res.data.total)
      })
      .catch(() => {})
      .finally(() => setRatingsLoading(false))
  }, [ratingsPage])

  useEffect(() => {
    setCommentsLoading(true)
    usersApi
      .getMyComments({ page: commentsPage, page_size: PAGE_SIZE })
      .then((res) => {
        setComments(res.data.items)
        setCommentsTotal(res.data.total)
      })
      .catch(() => {})
      .finally(() => setCommentsLoading(false))
  }, [commentsPage])

  const totalRatingPages = Math.ceil(ratingsTotal / PAGE_SIZE)
  const totalCommentPages = Math.ceil(commentsTotal / PAGE_SIZE)

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">我的评价</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {([
          { key: 'ratings', label: `我的评分（${ratingsTotal}）` },
          { key: 'comments', label: `我的评论（${commentsTotal}）` },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Ratings Tab */}
      {tab === 'ratings' && (
        <div>
          {ratingsLoading ? (
            <p className="text-center py-16 text-gray-400">加载中…</p>
          ) : ratings.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="mb-3">还没有提交过评分</p>
              <Link to="/search" className="text-sm text-brand-600 hover:underline">
                去搜索导师并评分
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {ratings.map((r) => (
                <RatingCard
                  key={r.id}
                  rating={r}
                  onDeleted={(id) => {
                    setRatings((prev) => prev.filter((x) => x.id !== id))
                    setRatingsTotal((t) => t - 1)
                  }}
                  onUpdated={(updated) =>
                    setRatings((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                  }
                />
              ))}
              {totalRatingPages > 1 && (
                <Pagination
                  page={ratingsPage}
                  totalPages={totalRatingPages}
                  onChange={setRatingsPage}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Comments Tab */}
      {tab === 'comments' && (
        <div>
          {commentsLoading ? (
            <p className="text-center py-16 text-gray-400">加载中…</p>
          ) : comments.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="mb-3">还没有发表过评论</p>
              <Link to="/search" className="text-sm text-brand-600 hover:underline">
                去搜索导师并评论
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((c) => (
                <CommentCard
                  key={c.id}
                  comment={c}
                  onDeleted={(id) => {
                    setComments((prev) => prev.filter((x) => x.id !== id))
                    setCommentsTotal((t) => t - 1)
                  }}
                  onUpdated={(updated) =>
                    setComments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                  }
                />
              ))}
              {totalCommentPages > 1 && (
                <Pagination
                  page={commentsPage}
                  totalPages={totalCommentPages}
                  onChange={setCommentsPage}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  return (
    <div className="flex justify-center gap-2 pt-4">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:border-brand-400 hover:text-brand-600"
      >
        上一页
      </button>
      <span className="px-3 py-1.5 text-sm text-gray-500">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:border-brand-400 hover:text-brand-600"
      >
        下一页
      </button>
    </div>
  )
}
