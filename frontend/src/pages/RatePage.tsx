import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supervisorsApi, ratingsApi } from '@/services/api'
import { zh } from '@/i18n/zh'
import type { Supervisor } from '@/types'

const SUB_SCORE_KEYS = [
  'academic',
  'mentoring',
  'wellbeing',
  'stipend',
  'resources',
  'ethics',
] as const

type SubScoreKey = typeof SUB_SCORE_KEYS[number]

function StarPicker({
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

export default function RatePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [supervisor, setSupervisor] = useState<Supervisor | null>(null)
  const [loadError, setLoadError] = useState(false)

  const [overallScore, setOverallScore] = useState<number | null>(null)
  const [subScores, setSubScores] = useState<Record<SubScoreKey, number | null>>({
    academic: null,
    mentoring: null,
    wellbeing: null,
    stipend: null,
    resources: null,
    ethics: null,
  })
  const [firstYearIncome, setFirstYearIncome] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auth guard
  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  // Load supervisor info
  useEffect(() => {
    if (!id) return
    supervisorsApi.get(id).then((res) => setSupervisor(res.data)).catch(() => setLoadError(true))
  }, [id])

  function setSubScore(key: SubScoreKey, value: number | null) {
    setSubScores((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id || overallScore == null) return

    setSubmitting(true)
    setError(null)
    try {
      await ratingsApi.create({
        supervisor_id: id,
        overall_score: overallScore,
        score_academic: subScores.academic ?? undefined,
        score_mentoring: subScores.mentoring ?? undefined,
        score_wellbeing: subScores.wellbeing ?? undefined,
        score_stipend: subScores.stipend ?? undefined,
        score_resources: subScores.resources ?? undefined,
        score_ethics: subScores.ethics ?? undefined,
        first_year_income: firstYearIncome !== '' ? parseInt(firstYearIncome, 10) : undefined,
      })
      navigate(`/supervisor/${id}`, { replace: true })
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } }
      if (axiosErr.response?.status === 409) {
        setError('您已评价过该导师，每位导师只能评价一次')
      } else if (axiosErr.response?.data?.detail) {
        setError(axiosErr.response.data.detail)
      } else {
        setError(zh.errors.network)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-12 text-center text-red-500">
        导师不存在或加载失败
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-12">
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-8">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-1">写评价</p>
          {supervisor ? (
            <>
              <h1 className="text-xl font-bold text-gray-900">{supervisor.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {supervisor.school_name} · {supervisor.department}
              </p>
            </>
          ) : (
            <div className="h-10 bg-gray-100 rounded animate-pulse w-48" />
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Overall score */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              综合评分 <span className="text-red-500">*</span>
            </p>
            <StarPicker
              label={zh.supervisor.score_labels.overall}
              value={overallScore}
              onChange={setOverallScore}
              required
            />
          </div>

          {/* Sub-scores */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              分项评分（可选）
            </p>
            <div className="divide-y divide-gray-100">
              {SUB_SCORE_KEYS.map((key) => (
                <StarPicker
                  key={key}
                  label={zh.supervisor.score_labels[key]}
                  value={subScores[key]}
                  onChange={(v) => setSubScore(key, v)}
                />
              ))}
            </div>
          </div>

          {/* First-year income */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              毕业首年收入（可选）
            </p>
            <div className="flex flex-col gap-1">
              <input
                type="number"
                min={0}
                value={firstYearIncome}
                onChange={(e) => setFirstYearIncome(e.target.value)}
                placeholder="请输入数字，单位：人民币"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              />
              <p className="text-xs text-gray-400">仅供参考，严格保密</p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(`/supervisor/${id}`)}
              className="w-full sm:flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={overallScore == null || submitting}
              className="w-full sm:flex-1 bg-teal-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? '提交中…' : '提交评价'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
