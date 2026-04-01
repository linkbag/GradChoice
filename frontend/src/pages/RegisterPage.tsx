import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/services/api'
import { useI18n } from '@/i18n'
import axios from 'axios'

type Step = 'email' | 'code' | 'details'

function maskEmail(email: string): string {
  const atIdx = email.indexOf('@')
  if (atIdx < 1) return email
  const local = email.slice(0, atIdx)
  const domain = email.slice(atIdx + 1)
  const dotIdx = domain.lastIndexOf('.')
  const domainName = dotIdx > 0 ? domain.slice(0, dotIdx) : domain
  const tld = dotIdx > 0 ? domain.slice(dotIdx) : ''
  const maskedLocal = local.charAt(0) + '***'
  const maskedDomain = domainName.charAt(0) + '***' + tld
  return `${maskedLocal}@${maskedDomain}`
}

function extractError(err: unknown, fallback: string, noConnectionMsg?: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (!err.response) return noConnectionMsg ?? fallback
  }
  return fallback
}

export default function RegisterPage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [tosAgreed, setTosAgreed] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [sendingCode, setSendingCode] = useState(false)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [loading, setLoading] = useState(false)

  // Resend countdown
  const [countdown, setCountdown] = useState(0)
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  // ── Step 1: send verification code ──────────────────────────
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSendingCode(true)
    try {
      await authApi.sendSignupVerification(email)
      setStep('code')
      setCountdown(60)
    } catch (err) {
      setError(extractError(err, t.auth.error_send_code, t.auth.error_no_connection))
    } finally {
      setSendingCode(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0) return
    setError(null)
    setSendingCode(true)
    try {
      await authApi.sendSignupVerification(email)
      setCountdown(60)
    } catch (err) {
      setError(extractError(err, t.auth.error_resend, t.auth.error_no_connection))
    } finally {
      setSendingCode(false)
    }
  }

  // ── Step 2: verify code ──────────────────────────────────────
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setVerifyingCode(true)
    try {
      await authApi.verifySignupCode(email, code)
      setStep('details')
    } catch (err) {
      setError(extractError(err, t.auth.error_verify_code, t.auth.error_no_connection))
    } finally {
      setVerifyingCode(false)
    }
  }

  // ── Step 3: register ─────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(t.auth.error_password_length)
      return
    }

    if (!tosAgreed) {
      setError(t.auth.error_tos_required)
      return
    }

    setLoading(true)
    try {
      const res = await authApi.register(email, password, displayName || undefined, true)
      const { access_token } = res.data
      localStorage.setItem('access_token', access_token)
      navigate('/', { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail
        if (typeof detail === 'string') {
          setError(detail)
        } else if (err.response?.status === 422) {
          const errors = err.response?.data?.detail
          if (Array.isArray(errors) && errors.length > 0) {
            const field = errors[0].loc?.slice(-1)[0] || ''
            const msg = errors[0].msg || t.auth.error_invalid_format
            setError(field ? `${field}: ${msg}` : msg)
          } else {
            setError(t.auth.error_invalid_format_full)
          }
        } else if (!err.response) {
          setError(t.auth.error_no_connection)
        } else {
          setError(t.auth.error_register_with_status(err.response.status))
        }
      } else {
        setError(t.auth.error_register)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto px-4 py-10 md:py-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 md:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.auth.register_title}</h1>
        <p className="text-sm text-gray-400 mb-6">{t.auth.register_steps[step]}</p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {(['email', 'code', 'details'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  step === s
                    ? 'bg-brand-600 text-white'
                    : i < ['email', 'code', 'details'].indexOf(step)
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

        {/* ── Step 1: Email ── */}
        {step === 'email' && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.auth.email_label}
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
              <p className="text-xs text-gray-400 mt-1">
                {t.auth.edu_email_hint}
              </p>
            </div>

            {error && <ErrorBox message={error} />}

            <button
              type="submit"
              disabled={sendingCode || !email}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
            >
              {sendingCode ? t.auth.sending : t.auth.send_code_btn}
            </button>
          </form>
        )}

        {/* ── Step 2: Code ── */}
        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-3">
                {t.auth.code_sent_to}{' '}
                <span className="font-medium text-gray-800">{maskEmail(email)}</span>
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                <p className="text-amber-800 text-sm font-medium">{t.auth.spam_check_hint}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-blue-800 text-sm">{t.auth.school_block_hint}</p>
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.auth.verification_code_label}
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
              disabled={verifyingCode || code.length !== 6}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
            >
              {verifyingCode ? t.auth.verifying : t.auth.verify_code_btn}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || sendingCode}
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

        {/* ── Step 3: Details ── */}
        {step === 'details' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.auth.password_label}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                minLength={8}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-gray-400 mt-1">{t.auth.password_min_chars}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.auth.display_name_label}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-start gap-2">
              <input
                id="tos-agree"
                type="checkbox"
                checked={tosAgreed}
                onChange={(e) => setTosAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 shrink-0"
              />
              <label htmlFor="tos-agree" className="text-sm text-gray-600 leading-snug cursor-pointer">
                {t.auth.tos_agreement}{' '}
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  {t.auth.tos_link}
                </Link>
              </label>
            </div>

            {error && <ErrorBox message={error} />}

            <button
              type="submit"
              disabled={loading || !tosAgreed}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? t.auth.registering : t.auth.register_btn}
            </button>
          </form>
        )}

        <p className="text-sm text-center text-gray-500 mt-6">
          {t.auth.has_account}{' '}
          <Link to="/login" className="text-brand-600 hover:underline">
            {t.auth.login_btn}
          </Link>
        </p>
      </div>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  )
}
