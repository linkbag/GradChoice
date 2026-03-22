import { useState } from 'react'
import { commentsApi } from '@/services/api'
import type { Comment } from '@/types'

const MAX_LENGTH = 5000

interface Props {
  supervisorId: string
  parentComment?: Comment | null
  onSubmitted: (comment: Comment) => void
  onCancel?: () => void
}

export default function CommentForm({ supervisorId, parentComment, onSubmitted, onCancel }: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remaining = MAX_LENGTH - content.length
  const isReply = !!parentComment

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    try {
      const res = await commentsApi.create({
        supervisor_id: supervisorId,
        content: trimmed,
        parent_comment_id: parentComment?.id,
      })
      setContent('')
      onSubmitted(res.data)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        '发表失败，请稍后再试'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {isReply && (
        <div className="text-sm text-brand-600 font-medium">
          回复 @{parentComment!.author?.display_name ?? '匿名用户'}
        </div>
      )}

      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={MAX_LENGTH}
          rows={isReply ? 3 : 5}
          placeholder="分享您对这位导师的看法..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          disabled={loading}
        />
        <span
          className={`absolute bottom-2 right-3 text-xs ${remaining < 100 ? 'text-red-500' : 'text-gray-400'}`}
        >
          {remaining}
        </span>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">匿名发表</span>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              disabled={loading}
            >
              取消
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="px-4 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '发表中…' : isReply ? '发表回复' : '发表评论'}
          </button>
        </div>
      </div>
    </form>
  )
}
