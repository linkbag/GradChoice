import { useState } from 'react'
import { commentsApi } from '@/services/api'
import type { FlagReason } from '@/types'

const FLAG_REASONS: { value: FlagReason; label: string }[] = [
  { value: '虚假信息', label: '虚假信息' },
  { value: '恶意攻击', label: '恶意攻击' },
  { value: '垃圾信息', label: '垃圾信息' },
  { value: '隐私泄露', label: '隐私泄露' },
  { value: '其他', label: '其他' },
]

interface Props {
  commentId: string
  onClose: () => void
}

export default function FlagModal({ commentId, onClose }: Props) {
  const [reason, setReason] = useState<FlagReason | null>(null)
  const [detail, setDetail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) return
    setLoading(true)
    setError(null)
    try {
      await commentsApi.flag(commentId, reason, detail.trim() || undefined)
      setSubmitted(true)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        '举报失败，请稍后再试'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        {submitted ? (
          <div className="text-center py-4">
            <div className="text-2xl mb-3">✓</div>
            <p className="text-gray-800 font-medium">举报已提交，感谢您的反馈</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
            >
              关闭
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">举报评论</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-3">请选择举报原因：</p>
                <div className="space-y-2">
                  {FLAG_REASONS.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="accent-brand-600"
                      />
                      <span className="text-sm text-gray-800">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600 block mb-1">补充说明（可选）</label>
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="请描述具体情况..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  disabled={loading}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading || !reason}
                  className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '提交中…' : '提交举报'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
