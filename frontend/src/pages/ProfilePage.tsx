import { useEffect, useState } from 'react'
import { usersApi, authApi } from '@/services/api'
import { useI18n } from '@/i18n'
import type { User } from '@/types'

export default function ProfilePage() {
  const { t } = useI18n()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Editable username state
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  // Email notifications toggle
  const [togglingNotif, setTogglingNotif] = useState(false)

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

  if (loading) return <div className="text-center py-20 text-gray-400">{t.profile.loading}</div>
  if (!user) return <div className="text-center py-20 text-gray-400">{t.profile.login_required}</div>

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

  // ---------- Email notifications toggle ----------
  const toggleNotifications = async () => {
    setTogglingNotif(true)
    try {
      const res = await usersApi.updateMe({ email_notifications_enabled: !user.email_notifications_enabled })
      setUser(res.data)
    } catch {
      // silently fail
    } finally {
      setTogglingNotif(false)
    }
  }

  // ---------- School email verification ----------
  const isSchoolEmail = (email: string) => {
    const lower = email.toLowerCase()
    const domain = lower.split('@')[1] || ''
    return domain.endsWith('.edu') || domain.includes('.edu.') || domain.endsWith('.org')
  }

  const handleSendCode = async () => {
    setVerifyMsg(null)
    if (!isSchoolEmail(schoolEmail)) {
      setVerifyMsg({ type: 'err', text: t.profile.school_email_only })
      return
    }
    setSendingCode(true)
    try {
      await authApi.sendVerification(schoolEmail)
      setVerifyMsg({ type: 'ok', text: t.profile.code_sent })
      // Refresh user to get school_email stored
      const res = await usersApi.getMe()
      setUser(res.data)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setVerifyMsg({ type: 'err', text: detail || t.profile.send_failed })
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerifyCode = async () => {
    setVerifyMsg(null)
    if (verificationCode.length !== 6) {
      setVerifyMsg({ type: 'err', text: t.auth.error_enter_6_digit })
      return
    }
    setVerifying(true)
    try {
      await authApi.verifySchoolEmail(verificationCode)
      setVerifyMsg({ type: 'ok', text: t.profile.school_email_verified })
      const res = await usersApi.getMe()
      setUser(res.data)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setVerifyMsg({ type: 'err', text: detail || t.profile.verify_failed })
    } finally {
      setVerifying(false)
    }
  }

  const handleResendCode = async () => {
    setVerifyMsg(null)
    setSendingCode(true)
    try {
      await authApi.sendVerification(user.school_email!)
      setVerifyMsg({ type: 'ok', text: t.profile.code_resent })
    } catch {
      setVerifyMsg({ type: 'err', text: t.profile.send_failed })
    } finally {
      setSendingCode(false)
    }
  }

  // Determine school email verification UI state
  const schoolVerified = user.school_email_verified && user.school_email
  const schoolPending = user.school_email && !user.school_email_verified
  const schoolNone = !user.school_email

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-12">
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t.profile.page_title}</h1>

        <div className="space-y-4">
          {/* Display name — editable */}
          <div>
            <p className="text-sm text-gray-500">{t.profile.display_name}</p>
            {editingName ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder={t.profile.display_name_placeholder}
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
                  {nameSaving ? t.profile.saving : t.profile.save}
                </button>
                <button
                  onClick={cancelEditName}
                  className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5"
                >
                  {t.profile.cancel}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="font-medium">{user.display_name ?? t.profile.not_set}</p>
                <button
                  onClick={startEditName}
                  className="text-xs text-brand-600 hover:text-brand-700 hover:underline"
                >
                  {t.profile.edit}
                </button>
              </div>
            )}
          </div>

          {/* Email */}
          <div>
            <p className="text-sm text-gray-500">{t.profile.email}</p>
            <p className="font-medium">{user.email}</p>
          </div>

          {/* Email notifications toggle */}
          <div>
            <p className="text-sm text-gray-500">{t.profile.email_notifications}</p>
            <div className="flex items-center gap-3 mt-1">
              <button
                role="switch"
                aria-checked={user.email_notifications_enabled}
                onClick={toggleNotifications}
                disabled={togglingNotif}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 ${
                  user.email_notifications_enabled ? 'bg-brand-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    user.email_notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-600">
                {user.email_notifications_enabled ? t.profile.notif_on : t.profile.notif_off}
              </span>
            </div>
          </div>

          {/* Verification status */}
          <div>
            <p className="text-sm text-gray-500">{t.profile.verification_status}</p>
            <div className="flex gap-2 mt-1">
              {user.is_student_verified && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t.profile.verified_student}</span>
              )}
              {!user.is_student_verified && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t.profile.unverified}</span>
              )}
            </div>
          </div>

          {user.bio && (
            <div>
              <p className="text-sm text-gray-500">{t.profile.bio}</p>
              <p className="text-gray-700">{user.bio}</p>
            </div>
          )}
        </div>

        {/* School email verification section */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.profile.school_email_section}</h2>

          {schoolVerified && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">{user.school_email}</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{t.profile.verified}</span>
            </div>
          )}

          {schoolPending && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-amber-800 text-sm font-medium">{t.auth.spam_check_hint}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">{user.school_email}</span>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{t.profile.pending_verification}</span>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t.profile.enter_code_placeholder}
                  maxLength={6}
                  className="w-40 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyCode() }}
                />
                <button
                  onClick={handleVerifyCode}
                  disabled={verifying}
                  className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {verifying ? t.profile.verifying : t.profile.verify}
                </button>
                <button
                  onClick={handleResendCode}
                  disabled={sendingCode}
                  className="text-xs text-brand-600 hover:underline disabled:opacity-50"
                >
                  {t.profile.resend}
                </button>
              </div>
            </div>
          )}

          {schoolNone && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                {t.profile.add_school_email_hint}
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <input
                  type="email"
                  value={schoolEmail}
                  onChange={(e) => setSchoolEmail(e.target.value)}
                  placeholder="yourname@university.edu.cn"
                  className="w-full sm:flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendCode() }}
                />
                <button
                  onClick={handleSendCode}
                  disabled={sendingCode}
                  className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {sendingCode ? t.profile.sending : t.profile.send_code}
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
