import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/services/api'
import { useI18n } from '@/i18n'
import axios from 'axios'

type Step = 'email' | 'code' | 'password'

function extractError(err: unknown, fallback: string, noConnectionMsg?: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (!err.response) return noConnectionMsg ?? fallback
  }
  return fallback
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  )
}

export default function ForgotPasswordPage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  // Step 1: send reset code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      await authApi.sendResetVerification(email)
      setStep('code')
      setCountdown(60)
    } catch (err) {
      setError(extractError(err, t.auth.error_send_code, t.auth.error_no_connection))
    } finally {
      setSending(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0) return
    setError(null)
    setSending(true)
    try {
      await authApi.sendResetVerification(email)
      setCountdown(60)
    } catch (err) {
      setError(extractError(err, t.auth.error_resend, t.auth.error_no_connection))
    } finally {
      setSending(false)
    }
  }

  // Step 2: verify code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (code.length !== 6) {
      setError(t.auth.error_enter_6_digit)
      return
    }
    setVerifying(true)
    try {
      await authApi.verifyResetCode(email, code)
      setStep('password')
    } catch (err) {
      setError(extractError(err, t.auth.error_code_wrong, t.auth.error_no_connection))
    } finally {
      setVerifying(false)
    }
  }

  // Step 3: reset password
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 8) {
      setError(t.auth.error_password_length)
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t.auth.error_password_mismatch)
      return
    }
    setResetting(true)
    try {
      await authApi.resetPassword(email, code, newPassword)
      navigate('/login', { state: { message: t.auth.reset_password_success } })
    } catch (err) {
      setError(extractError(err, t.auth.error_reset_password, t.auth.error_no_connection))
    } finally {
      setResetting(false)
    }
  }

  const steps: Step[] = ['email', 'code', 'password']

  return (
    <div className="max-w-md mx-auto px-4 py-10 md:py-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 md:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.auth.forgot_password_title}</h1>
        <p className="text-sm text-gray-400 mb-6">{t.auth.forgot_steps[step]}</p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  step === s
                    ? 'bg-brand-600 text-white'
                    : i < steps.indexOf(step)
                    ? 'bg-brand-100 text-brand-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && <div className="flex-1 h-px w-8 bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* Step 1: Email */}
        {step === 'email' && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.auth.registered_email_label}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="your@email.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {error && <ErrorBox message={error} />}

            <button
              type="submit"
              disabled={sending || !email}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
            >
              {sending ? t.auth.sending : t.auth.send_code_btn}
            </button>
          </form>
        )}

        {/* Step 2: Code */}
        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-3">
                {t.auth.code_sent_to} <span className="font-medium text-gray-800">{email}</span>
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-amber-800 text-sm font-medium">{t.auth.spam_check_hint}</p>
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.auth.six_digit_code_label}
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                maxLength={6}
                placeholder="123456"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {error && <ErrorBox message={error} />}

            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
            >
              {verifying ? t.auth.verifying : t.auth.next_step}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || sending}
                className="text-sm text-brand-600 hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {countdown > 0 ? t.auth.resend_countdown(countdown) : t.auth.resend_code}
              </button>
              <span className="text-gray-300 mx-2">·</span>
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(null) }}
                className="text-sm text-gray-400 hover:underline"
              >
                {t.auth.change_email}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: New password */}
        {step === 'password' && (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.auth.new_password_label}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
                minLength={8}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-gray-400 mt-1">{t.auth.password_min_chars}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.auth.confirm_password_label}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {error && <ErrorBox message={error} />}

            <button
              type="submit"
              disabled={resetting}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
            >
              {resetting ? t.auth.resetting : t.auth.reset_password_btn}
            </button>
          </form>
        )}

        <p className="text-sm text-center text-gray-500 mt-6">
          {t.auth.remembered_password}{' '}
          <Link to="/login" className="text-brand-600 hover:underline">
            {t.auth.back_to_login}
          </Link>
        </p>
      </div>
    </div>
  )
}
