import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { usersApi, chatsApi } from '@/services/api'
import type { UserPublicProfile } from '@/types'
import { useI18n } from '@/i18n'

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' })
}

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { t, locale } = useI18n()
  const pp = t.public_profile
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
      setMsgError(detail || pp.send_error)
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

  if (loading) return <div className="text-center py-20 text-gray-400">{pp.loading}</div>
  if (notFound) return <div className="text-center py-20 text-gray-400">{pp.user_not_found}</div>
  if (!profile) return <div className="text-center py-20 text-gray-400">{pp.load_error}</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <p className="text-xs text-gray-400 mb-4">
          <Link to="/" className="hover:underline">{pp.breadcrumb_home}</Link>
          {' / '}{pp.breadcrumb_profile}
        </p>

        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-2xl font-bold select-none">
              {profile.display_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {profile.display_name ?? pp.anonymous}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {profile.is_student_verified ? (
                  <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                    {pp.verified_student}
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {pp.unverified}
                  </span>
                )}
                <span className="text-xs text-gray-400">{pp.joined(formatDate(profile.created_at, locale))}</span>
              </div>
            </div>
          </div>
          {isLoggedIn && (
            <button
              onClick={() => { setShowMsgForm((v) => !v); setMsgError(null) }}
              className="shrink-0 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700 transition-colors"
            >
              {pp.send_message}
            </button>
          )}
        </div>

        {showMsgForm && (
          <div className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-xl">
            <textarea
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder={pp.message_placeholder}
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
                {pp.cancel}
              </button>
              <button
                onClick={handleSendMessage}
                disabled={msgSending || !msgText.trim()}
                className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {msgSending ? pp.sending : pp.send}
              </button>
            </div>
          </div>
        )}

        {profile.bio && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-1">{pp.bio_label}</p>
            <p className="text-gray-700 leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {!profile.bio && (
          <p className="text-gray-400 text-sm">{pp.no_bio}</p>
        )}
      </div>
    </div>
  )
}
