import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { zh } from '@/i18n/zh'
import { supervisorsApi, ratingsApi, commentsApi, editProposalsApi } from '@/services/api'
import type { SupervisorDetail, Rating, Comment, PaginatedResponse } from '@/types'

// ─── Score display helpers ─────────────────────────────────────────────────

const SCORE_RING = (score: number | null) => {
  if (score === null) return 'ring-gray-200 bg-gray-50 text-gray-400'
  if (score >= 4.5) return 'ring-emerald-400 bg-emerald-50 text-emerald-700'
  if (score >= 3.5) return 'ring-brand-400 bg-brand-50 text-brand-700'
  if (score >= 2.5) return 'ring-yellow-400 bg-yellow-50 text-yellow-700'
  return 'ring-red-400 bg-red-50 text-red-700'
}

function ScoreBadge({ score, label }: { score: number | null; label: string }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${score !== null ? '' : 'text-gray-300'}`}>
        {score !== null ? score.toFixed(1) : '—'}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

// ─── Rating form ──────────────────────────────────────────────────────────

type ScoreField = 'overall_score' | 'score_academic' | 'score_mentoring' | 'score_wellbeing' | 'score_stipend' | 'score_resources' | 'score_ethics'

const SCORE_FIELDS: { key: ScoreField; label: string; required: boolean }[] = [
  { key: 'overall_score', label: zh.supervisor.score_labels.overall, required: true },
  { key: 'score_academic', label: zh.supervisor.score_labels.academic, required: false },
  { key: 'score_mentoring', label: zh.supervisor.score_labels.mentoring, required: false },
  { key: 'score_wellbeing', label: zh.supervisor.score_labels.wellbeing, required: false },
  { key: 'score_stipend', label: zh.supervisor.score_labels.stipend, required: false },
  { key: 'score_resources', label: zh.supervisor.score_labels.resources, required: false },
  { key: 'score_ethics', label: zh.supervisor.score_labels.ethics, required: false },
]

function StarInput({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onChange(star)}
          className={`text-2xl transition-colors ${(hover ?? value ?? 0) >= star ? 'text-yellow-400' : 'text-gray-200'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function RatingForm({ supervisorId, onSubmitted }: { supervisorId: string; onSubmitted: () => void }) {
  const [scores, setScores] = useState<Partial<Record<ScoreField, number>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scores.overall_score) { setError('请至少填写综合评分'); return }
    setSubmitting(true)
    setError('')
    try {
      await ratingsApi.create({ supervisor_id: supervisorId, ...scores } as Parameters<typeof ratingsApi.create>[0])
      onSubmitted()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {SCORE_FIELDS.map(({ key, label, required }) => (
        <div key={key} className="flex items-center justify-between">
          <label className="text-sm text-gray-700">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <StarInput value={scores[key] ?? null} onChange={(v) => setScores((p) => ({ ...p, [key]: v }))} />
        </div>
      ))}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors text-sm font-medium"
      >
        {submitting ? '提交中…' : '提交评分'}
      </button>
    </form>
  )
}

// ─── Edit proposal form ────────────────────────────────────────────────────

const EDITABLE_FIELDS = [
  { key: 'title', label: '职级' },
  { key: 'affiliated_unit', label: '合作/挂名单位' },
  { key: 'webpage_url_1', label: '相关网页 1' },
  { key: 'webpage_url_2', label: '相关网页 2' },
  { key: 'webpage_url_3', label: '相关网页 3' },
]

function EditProposalForm({ supervisorId, onSubmitted }: { supervisorId: string; onSubmitted: () => void }) {
  const [fields, setFields] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nonEmpty = Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim()))
    if (Object.keys(nonEmpty).length === 0) { setError('请至少修改一个字段'); return }
    setSubmitting(true)
    setError('')
    try {
      await editProposalsApi.create({ supervisor_id: supervisorId, proposed_data: nonEmpty })
      setSuccess(true)
      setTimeout(onSubmitted, 1500)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) return <p className="text-sm text-emerald-600 py-2">修改建议已提交，等待社区审核。</p>

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {EDITABLE_FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label className="block text-xs text-gray-500 mb-1">{label}</label>
          <input
            type="text"
            value={fields[key] ?? ''}
            onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
      ))}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors text-sm"
      >
        {submitting ? '提交中…' : '提交修改建议'}
      </button>
    </form>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────

type Tab = 'ratings' | 'comments' | 'info'

export default function SupervisorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [sup, setSup] = useState<SupervisorDetail | null>(null)
  const [ratings, setRatings] = useState<Rating[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('ratings')
  const [showRatingForm, setShowRatingForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)

  const isLoggedIn = !!localStorage.getItem('access_token')

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [supRes, ratingsRes, commentsRes] = await Promise.all([
        supervisorsApi.get(id),
        ratingsApi.getBySupervisor(id),
        commentsApi.getBySupervisor(id),
      ])
      setSup(supRes.data)
      setRatings(ratingsRes.data as Rating[])
      const cRes = commentsRes.data as PaginatedResponse<Comment>
      setComments(cRes.items ?? [])
    } catch {
      setSup(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [id])  // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!sup) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500 mb-4">导师不存在或已删除</p>
        <button onClick={() => navigate(-1)} className="text-brand-600 hover:underline text-sm">
          返回
        </button>
      </div>
    )
  }

  // Radar chart data
  const radarData = [
    { subject: zh.supervisor.score_labels.academic, value: sup.avg_academic ?? 0 },
    { subject: zh.supervisor.score_labels.mentoring, value: sup.avg_mentoring ?? 0 },
    { subject: zh.supervisor.score_labels.wellbeing, value: sup.avg_wellbeing ?? 0 },
    { subject: zh.supervisor.score_labels.stipend, value: sup.avg_stipend ?? 0 },
    { subject: zh.supervisor.score_labels.resources, value: sup.avg_resources ?? 0 },
    { subject: zh.supervisor.score_labels.ethics, value: sup.avg_ethics ?? 0 },
  ]

  const hasSubScores = radarData.some((d) => d.value > 0)

  // Distribution histogram data
  const distData = [1, 2, 3, 4, 5].map((star) => ({
    star: `${star}星`,
    count: sup.rating_distribution[String(star)] ?? 0,
  }))

  const subScoreLabels: [keyof SupervisorDetail, string][] = [
    ['avg_academic', zh.supervisor.score_labels.academic],
    ['avg_mentoring', zh.supervisor.score_labels.mentoring],
    ['avg_wellbeing', zh.supervisor.score_labels.wellbeing],
    ['avg_stipend', zh.supervisor.score_labels.stipend],
    ['avg_resources', zh.supervisor.score_labels.resources],
    ['avg_ethics', zh.supervisor.score_labels.ethics],
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-4 flex items-center gap-1 flex-wrap">
        <Link to="/" className="hover:text-brand-600">首页</Link>
        <span>/</span>
        <Link to={`/school/${sup.school_code}`} className="hover:text-brand-600">{sup.school_name}</Link>
        <span>/</span>
        <span className="text-gray-600">{sup.name}</span>
      </nav>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{sup.name}</h1>
              {sup.title && (
                <span className="text-sm text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                  {sup.title}
                </span>
              )}
            </div>
            <p className="text-gray-600">
              <Link to={`/school/${sup.school_code}`} className="hover:text-brand-600 hover:underline">
                {sup.school_name}
              </Link>
              <span className="mx-2 text-gray-300">·</span>
              {sup.department}
            </p>
            {sup.affiliated_unit && (
              <p className="text-sm text-gray-400 mt-1">合作单位：{sup.affiliated_unit}</p>
            )}
            {/* Webpage links */}
            <div className="flex gap-3 mt-2 flex-wrap">
              {[sup.webpage_url_1, sup.webpage_url_2, sup.webpage_url_3].filter(Boolean).map((url, i) => (
                <a
                  key={i}
                  href={url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-600 hover:underline"
                >
                  个人主页 {i + 1} ↗
                </a>
              ))}
            </div>
          </div>

          {/* Overall score */}
          <div className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl ring-4 shrink-0 ${SCORE_RING(sup.avg_overall)}`}>
            <span className="text-3xl font-bold">
              {sup.avg_overall !== null ? sup.avg_overall.toFixed(1) : '—'}
            </span>
            <span className="text-xs mt-0.5 opacity-70">综合评分</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-6 flex-wrap">
          <span className="text-sm text-gray-500">{zh.supervisor.rating_count(sup.rating_count)}</span>
          {sup.verified_rating_count > 0 && (
            <span className="text-sm text-emerald-600">
              {sup.verified_rating_count} 条认证评价
              {sup.verified_avg_overall !== null && ` · 认证均分 ${sup.verified_avg_overall.toFixed(1)}`}
            </span>
          )}
          <div className="flex gap-2 ml-auto flex-wrap">
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => { setShowRatingForm(!showRatingForm); setShowEditForm(false) }}
                  className="text-sm bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
                >
                  {zh.supervisor.write_review}
                </button>
                <button
                  onClick={() => { setShowEditForm(!showEditForm); setShowRatingForm(false) }}
                  className="text-sm border border-gray-300 text-gray-600 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  建议修改信息
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="text-sm bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
              >
                登录后评价
              </Link>
            )}
          </div>
        </div>

        {/* Inline rating form */}
        {showRatingForm && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="font-medium text-gray-800 mb-3">为此导师评分</h3>
            <RatingForm
              supervisorId={sup.id}
              onSubmitted={() => { setShowRatingForm(false); loadData() }}
            />
          </div>
        )}

        {/* Inline edit proposal form */}
        {showEditForm && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="font-medium text-gray-800 mb-1">建议修改信息</h3>
            <p className="text-xs text-gray-400 mb-3">修改建议需经社区审核后生效</p>
            <EditProposalForm
              supervisorId={sup.id}
              onSubmitted={() => setShowEditForm(false)}
            />
          </div>
        )}
      </div>

      {/* Score breakdown card */}
      {sup.rating_count > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
          <h2 className="font-bold text-gray-800 mb-4">评分详情</h2>
          <div className="flex gap-6 flex-wrap">
            {/* Sub-scores */}
            <div className="grid grid-cols-3 gap-4 flex-1 min-w-48">
              {subScoreLabels.map(([key, label]) => (
                <ScoreBadge key={key as string} score={sup[key] as number | null} label={label} />
              ))}
            </div>

            {/* Radar chart */}
            {hasSubScores && (
              <div className="w-52 h-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#6b7280' }} />
                    <Radar dataKey="value" fill="#4f46e5" fillOpacity={0.25} stroke="#4f46e5" strokeWidth={1.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Distribution histogram */}
          <div className="mt-5">
            <p className="text-xs text-gray-500 mb-2">评分分布</p>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distData} barSize={32}>
                  <XAxis dataKey="star" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v: number) => [`${v} 条`, '评价']} />
                  <Bar dataKey="count" fill="#818cf8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {(['ratings', 'comments', 'info'] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = { ratings: '评分', comments: '评论', info: '基本信息' }
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-6 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                  tab === t
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {labels[t]}
                {t === 'ratings' && ratings.length > 0 && (
                  <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {ratings.length}
                  </span>
                )}
                {t === 'comments' && comments.length > 0 && (
                  <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {comments.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="p-6">
          {/* Ratings tab */}
          {tab === 'ratings' && (
            <div>
              {ratings.length === 0 ? (
                <p className="text-gray-400 text-center py-10">{zh.supervisor.no_ratings}</p>
              ) : (
                <div className="space-y-4">
                  {ratings.map((r) => (
                    <div key={r.id} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold text-brand-600">{Number(r.overall_score).toFixed(1)}</span>
                        {r.is_verified_rating && (
                          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                            {zh.supervisor.verified_badge}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">
                          {new Date(r.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {(
                          [
                            ['academic', r.score_academic],
                            ['mentoring', r.score_mentoring],
                            ['wellbeing', r.score_wellbeing],
                            ['stipend', r.score_stipend],
                            ['resources', r.score_resources],
                            ['ethics', r.score_ethics],
                          ] as [keyof typeof zh.supervisor.score_labels, number | null][]
                        ).filter(([, v]) => v !== null).map(([key, val]) => (
                          <span key={key} className="text-xs text-gray-500">
                            {zh.supervisor.score_labels[key]}：{Number(val).toFixed(1)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comments tab */}
          {tab === 'comments' && (
            <div>
              {isLoggedIn && (
                <CommentInput supervisorId={sup.id} onPosted={loadData} />
              )}
              {comments.length === 0 ? (
                <p className="text-gray-400 text-center py-10">暂无评论</p>
              ) : (
                <div className="space-y-4 mt-4">
                  {comments.map((c) => (
                    <div key={c.id} className="border-b border-gray-50 pb-4 last:border-0">
                      <p className="text-sm text-gray-700">{c.content}</p>
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-xs text-gray-400">
                          {new Date(c.created_at).toLocaleDateString('zh-CN')}
                        </span>
                        <span className="text-xs text-gray-400">👍 {c.likes_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Info tab */}
          {tab === 'info' && (
            <div className="space-y-3">
              <InfoRow label="院校" value={sup.school_name} />
              <InfoRow label="省份" value={sup.province} />
              <InfoRow label="院系" value={sup.department} />
              {sup.title && <InfoRow label="职级" value={sup.title} />}
              {sup.affiliated_unit && <InfoRow label="合作/挂名单位" value={sup.affiliated_unit} />}
              {sup.webpage_url_1 && <InfoRow label="主页 1" value={sup.webpage_url_1} isLink />}
              {sup.webpage_url_2 && <InfoRow label="主页 2" value={sup.webpage_url_2} isLink />}
              {sup.webpage_url_3 && <InfoRow label="主页 3" value={sup.webpage_url_3} isLink />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helper components ────────────────────────────────────────────────────

function InfoRow({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="text-sm text-gray-400 w-28 shrink-0">{label}</span>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline break-all">
          {value}
        </a>
      ) : (
        <span className="text-sm text-gray-700">{value}</span>
      )}
    </div>
  )
}

function CommentInput({ supervisorId, onPosted }: { supervisorId: string; onPosted: () => void }) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    try {
      await commentsApi.create({ supervisor_id: supervisorId, content: content.trim() })
      setContent('')
      onPosted()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="写下你的评论…"
        rows={3}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      <div className="flex justify-end mt-2">
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="text-sm bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? '发送中…' : '发送'}
        </button>
      </div>
    </form>
  )
}
