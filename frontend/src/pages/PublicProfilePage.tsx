import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { usersApi, chatsApi } from '@/services/api'
import type { UserPublicProfile } from '@/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
}

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserPublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showMsgForm, setShowMsgForm] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgError, setMsgError] = useState<string | null>(null)

  const isLoggedIn = !!localStorage.getItem('access_token')

  async function handleSendMessage() {
    if (!msgText.trim() || !userId) return
    setMsgSending(true)
    setMsgError(null)
    try {
      await chatsApi.create({ recipient_id: userId, initial_message: msgText.trim() })
      navigate('/inbox')
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setMsgError(detail || '发送失败，请重试')
    } finally {
      setMsgSending(false)
    }
  }

  useEffect(() => {
    if (!userId) return
    usersApi
      .getProfile(userId)
      .then((res) => setProfile(res.data))
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="text-center py-20 text-gray-400">加载中…</div>
  if (notFound) return <div className="text-center py-20 text-gray-400">用户不存在</div>
  if (!profile) return <div className="text-center py-20 text-gray-400">无法加载用户资料</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <p className="text-xs text-gray-400 mb-4">
          <Link to="/" className="hover:underline">首页</Link>
          {' / '}用户主页
        </p>

        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-2xl font-bold select-none">
              {profile.display_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {profile.display_name ?? '匿名用户'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {profile.is_student_verified ? (
                  <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                    认证学生
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    未认证
                  </span>
                )}
                <span className="text-xs text-gray-400">加入于 {formatDate(profile.created_at)}</span>
              </div>
            </div>
          </div>
          {isLoggedIn && (
            <button
              onClick={() => { setShowMsgForm((v) => !v); setMsgError(null) }}
              className="shrink-0 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700 transition-colors"
            >
              发送私信
            </button>
          )}
        </div>

        {showMsgForm && (
          <div className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-xl">
            <textarea
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="输入消息…"
              rows={3}
              className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
              autoFocus
            />
            {msgError && <p className="text-xs text-red-500 mt-1">{msgError}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => { setShowMsgForm(false); setMsgText(''); setMsgError(null) }}
                className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5"
              >
                取消
              </button>
              <button
                onClick={handleSendMessage}
                disabled={msgSending || !msgText.trim()}
                className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {msgSending ? '发送中…' : '发送'}
              </button>
            </div>
          </div>
        )}

        {profile.bio && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-1">个人简介</p>
            <p className="text-gray-700 leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {!profile.bio && (
          <p className="text-gray-400 text-sm">该用户暂未填写个人简介。</p>
        )}
      </div>
    </div>
  )
}
