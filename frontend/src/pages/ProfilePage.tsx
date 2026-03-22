import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { usersApi, authApi } from '@/services/api'
import type { Rating, Comment } from '@/types'
import { zh } from '@/i18n/zh'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, isLoading, isLoggedIn, refreshUser, logout } = useAuth()

  // Edit form state
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [emailNotif, setEmailNotif] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Change password state
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmNewPw, setConfirmNewPw] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  // Student verification state
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // My ratings / comments
  const [ratings, setRatings] = useState<Rating[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  // Populate form when user loads
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name ?? '')
      setBio(user.bio ?? '')
      setEmailNotif(user.email_notifications_enabled)
    }
  }, [user])

  // Load user's ratings & comments
  useEffect(() => {
    if (!user || dataLoaded) return
    Promise.all([usersApi.getMyRatings(), usersApi.getMyComments()])
      .then(([r, c]) => {
        setRatings(r.data)
        setComments(c.data)
        setDataLoaded(true)
      })
      .catch(() => setDataLoaded(true))
  }, [user, dataLoaded])

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      navigate('/login', { replace: true })
    }
  }, [isLoading, isLoggedIn, navigate])

  if (isLoading) return <div className="text-center py-20 text-gray-400">加载中…</div>
  if (!user) return null

  const handleSaveProfile = async () => {
    setSaveStatus('saving')
    try {
      await usersApi.updateMe({ display_name: displayName, bio, email_notifications_enabled: emailNotif })
      await refreshUser()
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(null)
    if (newPw.length < 8) { setPwError('新密码长度不能少于8位'); return }
    if (newPw !== confirmNewPw) { setPwError('两次输入的密码不一致'); return }
    setPwLoading(true)
    try {
      await usersApi.changePassword(currentPw, newPw)
      setPwSuccess(true)
      setCurrentPw(''); setNewPw(''); setConfirmNewPw('')
      setTimeout(() => setPwSuccess(false), 3000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setPwError(msg ?? '修改失败，请检查当前密码是否正确')
    } finally {
      setPwLoading(false)
    }
  }

  const handleVerifyEduEmail = async () => {
    setVerifyLoading(true)
    setVerifyMsg(null)
    try {
      const res = await authApi.verifyStudent('email_edu')
      setVerifyMsg((res.data as { message: string }).message)
      await refreshUser()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setVerifyMsg(msg ?? '验证失败')
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleUploadStudentId = async (file: File) => {
    setVerifyLoading(true)
    setVerifyMsg(null)
    try {
      const res = await authApi.verifyStudent('student_id', file)
      setVerifyMsg((res.data as { message: string }).message)
      await refreshUser()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setVerifyMsg(msg ?? '上传失败，请重试')
    } finally {
      setVerifyLoading(false)
    }
  }

  const isEduEmail = user.email.endsWith('.edu.cn') || user.email.endsWith('.ac.cn')

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      {/* ── Profile Header ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{zh.profile.title}</h1>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            {zh.nav.logout}
          </button>
        </div>

        {/* Verification badges */}
        <div className="flex flex-wrap gap-2 mb-6">
          {user.is_email_verified ? (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ {zh.profile.email_verified}</span>
          ) : (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⚠ {zh.profile.email_unverified}</span>
          )}
          {user.is_student_verified ? (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">🎓 {zh.profile.student_verified}</span>
          ) : user.verification_type === 'student_id' ? (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">⏳ {zh.profile.student_id_pending}</span>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{zh.profile.student_unverified}</span>
          )}
        </div>

        {/* Edit form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{zh.profile.display_name}</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{zh.profile.email}</label>
            <p className="text-sm text-gray-500 py-2">{user.email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{zh.profile.bio}</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={zh.profile.bio_placeholder}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="email-notif"
              type="checkbox"
              checked={emailNotif}
              onChange={(e) => setEmailNotif(e.target.checked)}
              className="accent-brand-600"
            />
            <label htmlFor="email-notif" className="text-sm text-gray-700 cursor-pointer">
              {zh.profile.email_notifications}
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveProfile}
              disabled={saveStatus === 'saving'}
              className="bg-brand-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {saveStatus === 'saving' ? zh.profile.saving : saveStatus === 'saved' ? '✓ ' + zh.profile.save_success : zh.profile.save}
            </button>
            {saveStatus === 'error' && <span className="text-red-500 text-sm">保存失败，请重试</span>}
          </div>
        </div>
      </div>

      {/* ── Student Verification ── */}
      {!user.is_student_verified && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{zh.profile.student_verification_section}</h2>

          {verifyMsg && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
              {verifyMsg}
            </div>
          )}

          <div className="space-y-3">
            {isEduEmail && user.verification_type !== 'email_edu' && (
              <button
                onClick={handleVerifyEduEmail}
                disabled={verifyLoading}
                className="w-full border border-brand-300 text-brand-700 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-50 transition-colors disabled:opacity-50"
              >
                {verifyLoading ? '验证中…' : `🎓 ${zh.profile.verify_edu_email} (${user.email})`}
              </button>
            )}

            {user.verification_type !== 'student_id' && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUploadStudentId(f)
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={verifyLoading}
                  className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {verifyLoading ? '上传中…' : `📎 ${zh.profile.upload_student_id}`}
                </button>
                <p className="text-xs text-gray-400 mt-1">{zh.profile.upload_student_id_desc}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Change Password ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{zh.profile.change_password_section}</h2>

        {pwSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            密码修改成功
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{zh.profile.current_password}</label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{zh.profile.new_password}</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{zh.auth.confirm_password_label}</label>
            <input
              type="password"
              value={confirmNewPw}
              onChange={(e) => setConfirmNewPw(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {pwError && <p className="text-red-600 text-sm">{pwError}</p>}
          <button
            type="submit"
            disabled={pwLoading}
            className="bg-gray-800 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
          >
            {pwLoading ? '修改中…' : '修改密码'}
          </button>
        </form>
      </div>

      {/* ── My Ratings ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{zh.profile.my_ratings}</h2>
        {ratings.length === 0 ? (
          <p className="text-sm text-gray-400">暂无评价记录</p>
        ) : (
          <ul className="space-y-3">
            {ratings.map((r) => (
              <li key={r.id} className="border border-gray-100 rounded-lg p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-brand-700">综合评分：{r.overall_score}/5</span>
                  <span className="text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString('zh-CN')}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── My Comments ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{zh.profile.my_comments}</h2>
        {comments.length === 0 ? (
          <p className="text-sm text-gray-400">暂无评论记录</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="border border-gray-100 rounded-lg p-4 text-sm">
                <p className="text-gray-700 line-clamp-3">{c.content}</p>
                <p className="text-gray-400 text-xs mt-1">
                  {new Date(c.created_at).toLocaleDateString('zh-CN')}
                  {' · '}
                  👍 {c.likes_count}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
