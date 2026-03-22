import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { zh } from '@/i18n/zh'
import { chatsApi } from '@/services/api'

interface ContactModalProps {
  recipientId: string
  supervisorId: string
  supervisorName: string
  onClose: () => void
  onSent: (chatId: string) => void
}

function ContactModal({ recipientId, supervisorId, supervisorName, onClose, onSent }: ContactModalProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    const text = message.trim()
    if (!text) return
    setSending(true)
    setError(null)
    try {
      const res = await chatsApi.create({
        recipient_id: recipientId,
        supervisor_id: supervisorId,
        initial_message: text,
      })
      onSent(res.data.id)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setError(axiosErr.response?.data?.detail ?? '发送失败，请重试')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="font-bold text-gray-900 text-lg mb-2">联系该用户</h3>
        <p className="text-sm text-gray-500 mb-4">
          您将匿名联系此评论者，对方不会看到您的邮箱。
          <br />
          <span className="text-brand-600">关于导师：{supervisorName}</span>
        </p>

        <textarea
          value={message}
          onChange={(e) => { setMessage(e.target.value); setError(null) }}
          placeholder="请输入您的消息…"
          rows={4}
          maxLength={2000}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 mb-1"
        />
        <p className="text-xs text-gray-300 text-right mb-3">{message.length}/2000</p>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="px-5 py-2 bg-brand-600 text-white text-sm rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? '发送中…' : '发送'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SupervisorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [contactModal, setContactModal] = useState<{
    recipientId: string
    supervisorName: string
  } | null>(null)

  const isLoggedIn = !!localStorage.getItem('access_token')

  // TODO: fetch supervisor data, ratings, comments, analytics

  const handleContactClick = (recipientId: string, supervisorName: string) => {
    if (!isLoggedIn) {
      navigate('/login')
      return
    }
    setContactModal({ recipientId, supervisorName })
  }

  const handleChatSent = (chatId: string) => {
    setContactModal(null)
    navigate(`/inbox?chat=${chatId}`)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Supervisor info header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
        <p className="text-xs text-gray-400 mb-2">导师主页</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">加载中…</h1>
        <p className="text-gray-600">院校 · 院系</p>
      </div>

      {/* Score radar placeholder */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
        <h2 className="font-bold text-gray-800 mb-4">评分概览</h2>
        <div className="h-48 flex items-center justify-center text-gray-400">
          {/* TODO: Recharts RadarChart */}
          雷达图（待实现）
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          {Object.entries(zh.supervisor.score_labels).map(([key, label]) => (
            key !== 'overall' && (
              <div key={key} className="text-center">
                <div className="text-lg font-bold text-gray-400">—</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Ratings & Comments */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-gray-800">学生评价</h2>
          <button className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 transition-colors">
            {zh.supervisor.write_review}
          </button>
        </div>
        <p className="text-gray-400 text-center py-8">{zh.supervisor.no_ratings}</p>

        {/*
          Comment cards with "联系该用户" button will be rendered here when comments API is implemented.
          Each card should include:
            <button
              onClick={() => handleContactClick(comment.user_id, supervisorName)}
              className="text-xs text-brand-600 hover:text-brand-700 border border-brand-200 hover:border-brand-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              联系该用户
            </button>
        */}
      </div>

      {/* Contact modal */}
      {contactModal && id && (
        <ContactModal
          recipientId={contactModal.recipientId}
          supervisorId={id}
          supervisorName={contactModal.supervisorName}
          onClose={() => setContactModal(null)}
          onSent={handleChatSent}
        />
      )}
    </div>
  )
}
