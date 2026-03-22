import { useEffect, useState } from 'react'
import { usersApi, authApi } from '@/services/api'
import type { User } from '@/types'

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Editable username state
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  // School email verification state
  const [schoolEmail, setSchoolEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    usersApi.getMe()
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-20 text-gray-400">加载中…</div>
  if (!user) return <div className="text-center py-20 text-gray-400">请先登录</div>

  // ---------- Username editing ----------
  const startEditName = () => {
    setNameDraft(user.display_name ?? '')
    setEditingName(true)
  }

  const cancelEditName = () => setEditingName(false)

  const saveName = async () => {
    setNameSaving(true)
    try {
      await usersApi.updateMe({ display_name: nameDraft || null })
      const updatedUser = await usersApi.getMe()
      setUser(updatedUser.data)
      setEditingName(false)
    } catch {
      // silently fail — keep editing state
    } finally {
      setNameSaving(false)
    }
  }

  // ---------- School email verification ----------
  const isSchoolEmail = (email: string) =>
    email.endsWith('.edu') || email.endsWith('.edu.cn') || email.endsWith('.org')

  const handleSendCode = async () => {
    setVerifyMsg(null)
    if (!isSchoolEmail(schoolEmail)) {
      setVerifyMsg({ type: 'err', text: '仅支持 .edu / .edu.cn / .org 邮箱' })
      return
    }
    setSendingCode(true)
    try {
      await authApi.sendVerification(schoolEmail)
      setVerifyMsg({ type: 'ok', text: '验证码已发送，请查看邮箱' })
      // Refresh user to get school_email stored
      const res = await usersApi.getMe()
      setUser(res.data)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setVerifyMsg({ type: 'err', text: detail || '发送失败，请稍后重试' })
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerifyCode = async () => {
    setVerifyMsg(null)
    if (verificationCode.length !== 6) {
      setVerifyMsg({ type: 'err', text: '请输入 6 位验证码' })
      return
    }
    setVerifying(true)
    try {
      await authApi.verifySchoolEmail(verificationCode)
      setVerifyMsg({ type: 'ok', text: '学校邮箱验证成功！' })
      const res = await usersApi.getMe()
      setUser(res.data)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setVerifyMsg({ type: 'err', text: detail || '验证失败，请重试' })
    } finally {
      setVerifying(false)
    }
  }

  const handleResendCode = async () => {
    setVerifyMsg(null)
    setSendingCode(true)
    try {
      await authApi.sendVerification(user.school_email!)
      setVerifyMsg({ type: 'ok', text: '验证码已重新发送' })
    } catch {
      setVerifyMsg({ type: 'err', text: '发送失败，请稍后重试' })
    } finally {
      setSendingCode(false)
    }
  }

  // Determine school email verification UI state
  const schoolVerified = user.school_email_verified && user.school_email
  const schoolPending = user.school_email && !user.school_email_verified
  const schoolNone = !user.school_email

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">我的主页</h1>

        <div className="space-y-4">
          {/* 昵称 — editable */}
          <div>
            <p className="text-sm text-gray-500">昵称</p>
            {editingName ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="输入昵称"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName()
                    if (e.key === 'Escape') cancelEditName()
                  }}
                />
                <button
                  onClick={saveName}
                  disabled={nameSaving}
                  className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {nameSaving ? '保存中…' : '保存'}
                </button>
                <button
                  onClick={cancelEditName}
                  className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="font-medium">{user.display_name ?? '未设置'}</p>
                <button
                  onClick={startEditName}
                  className="text-xs text-brand-600 hover:text-brand-700 hover:underline"
                >
                  编辑
                </button>
              </div>
            )}
          </div>

          {/* 邮箱 — personal, no verification badge needed */}
          <div>
            <p className="text-sm text-gray-500">邮箱</p>
            <p className="font-medium">{user.email}</p>
          </div>

          {/* 认证状态 */}
          <div>
            <p className="text-sm text-gray-500">认证状态</p>
            <div className="flex gap-2 mt-1">
              {user.is_student_verified && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">认证学生</span>
              )}
              {!user.is_student_verified && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">未认证</span>
              )}
            </div>
          </div>

          {user.bio && (
            <div>
              <p className="text-sm text-gray-500">个人简介</p>
              <p className="text-gray-700">{user.bio}</p>
            </div>
          )}
        </div>

        {/* 学校邮箱认证 section */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">学校邮箱认证</h2>

          {schoolVerified && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">{user.school_email}</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">已认证</span>
            </div>
          )}

          {schoolPending && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">{user.school_email}</span>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">待验证</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="输入 6 位验证码"
                  maxLength={6}
                  className="w-40 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyCode() }}
                />
                <button
                  onClick={handleVerifyCode}
                  disabled={verifying}
                  className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {verifying ? '验证中…' : '验证'}
                </button>
                <button
                  onClick={handleResendCode}
                  disabled={sendingCode}
                  className="text-xs text-brand-600 hover:underline disabled:opacity-50"
                >
                  重新发送
                </button>
              </div>
            </div>
          )}

          {schoolNone && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                添加学校邮箱（.edu / .edu.cn / .org）完成学生身份认证
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={schoolEmail}
                  onChange={(e) => setSchoolEmail(e.target.value)}
                  placeholder="yourname@university.edu.cn"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendCode() }}
                />
                <button
                  onClick={handleSendCode}
                  disabled={sendingCode}
                  className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {sendingCode ? '发送中…' : '发送验证码'}
                </button>
              </div>
            </div>
          )}

          {verifyMsg && (
            <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${
              verifyMsg.type === 'ok'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {verifyMsg.text}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
