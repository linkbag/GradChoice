import { useState } from 'react'
import type { Rating } from '@/types'
import { ratingsApi } from '@/services/api'

// Half-star increments: 1.0, 1.5, 2.0 … 5.0
const HALF_STARS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]

const SUB_SCORES: Array<{
  key: keyof Pick<
    Rating,
    | 'score_academic'
    | 'score_mentoring'
    | 'score_wellbeing'
    | 'score_stipend'
    | 'score_resources'
    | 'score_ethics'
  >
  label: string
  tooltip: string
}> = [
  { key: 'score_academic', label: '学术水平 / 科研实力', tooltip: '导师的学术研究水平与科研成果' },
  { key: 'score_mentoring', label: '学生培养 / 教育指导', tooltip: '导师对学生学习和成长的指导质量' },
  { key: 'score_wellbeing', label: '学生身心健康发展', tooltip: '导师对学生心理健康和工作生活平衡的关注' },
  { key: 'score_stipend', label: '生活补助', tooltip: '助研补贴、奖学金等经济支持情况' },
  { key: 'score_resources', label: '学术研究资源保障', tooltip: '科研经费、设备、合作机会等资源' },
  { key: 'score_ethics', label: '学术道德 / 学术诚信', tooltip: '导师遵守学术规范和诚信的情况' },
]

interface StarSelectorProps {
  value: number | null
  onChange: (v: number | null) => void
  optional?: boolean
}

function StarSelector({ value, onChange, optional }: StarSelectorProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? value

  return (
    <div className="flex items-center gap-1">
      <div className="flex" onMouseLeave={() => setHovered(null)}>
        {[1, 2, 3, 4, 5].map((star) => {
          const full = display !== null && display >= star
          const half = display !== null && display >= star - 0.5 && display < star
          return (
            <div key={star} className="relative w-7 h-7 cursor-pointer flex">
              {/* left half */}
              <div
                className="absolute left-0 top-0 w-1/2 h-full z-10"
                onMouseEnter={() => setHovered(star - 0.5)}
                onClick={() => onChange(star - 0.5)}
              />
              {/* right half */}
              <div
                className="absolute right-0 top-0 w-1/2 h-full z-10"
                onMouseEnter={() => setHovered(star)}
                onClick={() => onChange(star)}
              />
              {/* star icon */}
              <svg viewBox="0 0 24 24" className="w-7 h-7">
                <defs>
                  <linearGradient id={`grad-${star}`}>
                    <stop offset="50%" stopColor={half ? '#FBBF24' : full ? '#FBBF24' : '#D1D5DB'} />
                    <stop offset="50%" stopColor={full ? '#FBBF24' : '#D1D5DB'} />
                  </linearGradient>
                </defs>
                <path
                  fill={`url(#grad-${star})`}
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                />
              </svg>
            </div>
          )
        })}
      </div>
      {display !== null && (
        <span className="text-sm text-amber-600 font-medium w-8">{display.toFixed(1)}</span>
      )}
      {optional && value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-gray-400 hover:text-gray-600 ml-1"
        >
          不评价
        </button>
      )}
      {optional && value === null && (
        <span className="text-xs text-gray-400 ml-1">不评价</span>
      )}
    </div>
  )
}

interface RatingFormProps {
  supervisorId: string
  existingRating?: Rating | null
  isVerified?: boolean
  onSuccess: (rating: Rating) => void
  onCancel: () => void
}

export default function RatingForm({
  supervisorId,
  existingRating,
  isVerified,
  onSuccess,
  onCancel,
}: RatingFormProps) {
  const [overallScore, setOverallScore] = useState<number | null>(
    existingRating ? existingRating.overall_score : null,
  )
  const [subScores, setSubScores] = useState<
    Record<(typeof SUB_SCORES)[number]['key'], number | null>
  >({
    score_academic: existingRating?.score_academic ?? null,
    score_mentoring: existingRating?.score_mentoring ?? null,
    score_wellbeing: existingRating?.score_wellbeing ?? null,
    score_stipend: existingRating?.score_stipend ?? null,
    score_resources: existingRating?.score_resources ?? null,
    score_ethics: existingRating?.score_ethics ?? null,
  })

  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (overallScore === null) {
      setError('请选择综合评分')
      return
    }
    setConfirming(true)
  }

  const handleConfirm = async () => {
    if (overallScore === null) return
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        supervisor_id: supervisorId,
        overall_score: overallScore,
        ...Object.fromEntries(
          Object.entries(subScores).filter(([, v]) => v !== null),
        ),
      }
      let response
      if (existingRating) {
        response = await ratingsApi.update(existingRating.id, payload)
      } else {
        response = await ratingsApi.create(payload as Parameters<typeof ratingsApi.create>[0])
      }
      onSuccess(response.data)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        '提交失败，请稍后重试'
      setError(msg)
      setConfirming(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              {existingRating ? '编辑评价' : '写评价'}
            </h2>
            {isVerified && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
                已验证评价
              </span>
            )}
          </div>

          {!confirming ? (
            <>
              {/* Overall score */}
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  综合评分 <span className="text-red-500">*</span>
                </label>
                <StarSelector value={overallScore} onChange={setOverallScore} />
              </div>

              {/* Sub-scores */}
              <div className="space-y-4 mb-6">
                <p className="text-sm text-gray-500">以下维度为选填，可点击"不评价"跳过</p>
                {SUB_SCORES.map(({ key, label, tooltip }) => (
                  <div key={key}>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      title={tooltip}
                    >
                      {label}
                    </label>
                    <StarSelector
                      value={subScores[key]}
                      onChange={(v) => setSubScores((prev) => ({ ...prev, [key]: v }))}
                      optional
                    />
                  </div>
                ))}
              </div>

              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 transition-colors"
                >
                  提交评价
                </button>
              </div>
            </>
          ) : (
            /* Confirmation dialog */
            <div>
              <p className="text-gray-700 mb-4">
                确认提交以下评分？提交后可以修改，但每位导师只能评价一次。
              </p>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">综合评分</span>
                  <span className="font-semibold text-amber-600">{overallScore?.toFixed(1)} ★</span>
                </div>
                {SUB_SCORES.map(({ key, label }) =>
                  subScores[key] !== null ? (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600">{label}</span>
                      <span className="font-medium text-amber-600">{subScores[key]?.toFixed(1)} ★</span>
                    </div>
                  ) : null,
                )}
              </div>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  返回修改
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? '提交中…' : '确认提交'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
