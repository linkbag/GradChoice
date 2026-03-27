import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/services/api'
import { zh } from '@/i18n/zh'
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

export default function RegisterPage() {
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
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
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
      setError(extractError(err, '发送验证码失败，请稍后重试'))
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
      setError(extractError(err, '重新发送失败，请稍后重试'))
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
      setError(extractError(err, '验证失败，请检查验证码'))
    } finally {
      setVerifyingCode(false)
    }
  }

  // ── Step 3: register ─────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('密码长度至少为 8 个字符')
      return
    }

    if (!tosAgreed) {
      setError('请先同意服务条款与免责声明')
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
            const msg = errors[0].msg || '输入格式有误'
            setError(field ? `${field}: ${msg}` : msg)
          } else {
            setError('输入格式有误，请检查各项信息')
          }
        } else if (!err.response) {
          setError('无法连接到服务器，请检查网络或稍后重试')
        } else {
          setError(`注册失败（${err.response.status}）`)
        }
      } else {
        setError('注册失败，请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{zh.auth.register_title}</h1>
        <p className="text-sm text-gray-400 mb-6">{zh.auth.register_steps[step]}</p>

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
                {zh.auth.email_label}
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
                (可选) 使用 .edu 或 .org 邮箱注册可自动完成学生身份认证，信息严格保密，仅会获得已验证标签以增加评价可信度
              </p>
            </div>

            {error && <ErrorBox message={error} />}

            <button
              type="submit"
              disabled={sendingCode || !email}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
            >
              {sendingCode ? '发送中…' : zh.auth.send_code_btn}
            </button>
          </form>
        )}

        {/* ── Step 2: Code ── */}
        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                {zh.auth.code_sent_to}{' '}
                <span className="font-medium text-gray-800">{maskEmail(email)}</span>
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {zh.auth.verification_code_label}
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
              {verifyingCode ? '验证中…' : zh.auth.verify_code_btn}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || sendingCode}
                className="text-sm text-brand-600 hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {countdown > 0 ? `重新发送 (${countdown}s)` : '重新发送验证码'}
              </button>
              <span className="text-gray-300 mx-2">·</span>
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(null) }}
                className="text-sm text-gray-400 hover:underline"
              >
                更换邮箱
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: Details ── */}
        {step === 'details' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {zh.auth.password_label}
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
              <p className="text-xs text-gray-400 mt-1">至少 8 个字符</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {zh.auth.display_name_label}
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
                我了解并同意本站{' '}
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  服务条款与免责声明
                </Link>
              </label>
            </div>

            {error && <ErrorBox message={error} />}

            <button
              type="submit"
              disabled={loading || !tosAgreed}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? '注册中…' : zh.auth.register_btn}
            </button>
          </form>
        )}

        <p className="text-sm text-center text-gray-500 mt-6">
          {zh.auth.has_account}{' '}
          <Link to="/login" className="text-brand-600 hover:underline">
            {zh.auth.login_btn}
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

function extractError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (!err.response) return '无法连接到服务器，请检查网络或稍后重试'
  }
  return fallback
}
