import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/services/api'
import axios from 'axios'

type Step = 'email' | 'code' | 'password'

function extractError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (!err.response) return '无法连接到服务器，请检查网络或稍后重试'
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
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
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
      setError(extractError(err, '发送验证码失败，请稍后重试'))
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
      setError(extractError(err, '重新发送失败，请稍后重试'))
    } finally {
      setSending(false)
    }
  }

  // Step 2: verify code (just advance to step 3)
  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (code.length !== 6) {
      setError('请输入 6 位验证码')
      return
    }
    setVerifying(true)
    // Code will be validated server-side on reset
    setVerifying(false)
    setStep('password')
  }

  // Step 3: reset password
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 8) {
      setError('密码长度至少为 8 个字符')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    setResetting(true)
    try {
      await authApi.resetPassword(email, code, newPassword)
      navigate('/login', { state: { message: '密码重置成功，请使用新密码登录' } })
    } catch (err) {
      setError(extractError(err, '重置密码失败，请稍后重试'))
    } finally {
      setResetting(false)
    }
  }

  const stepLabels: Record<Step, string> = {
    email: '输入注册邮箱',
    code: '验证邮箱',
    password: '设置新密码',
  }
  const steps: Step[] = ['email', 'code', 'password']

  return (
    <div className="max-w-md mx-auto px-4 py-10 md:py-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 md:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">找回密码</h1>
        <p className="text-sm text-gray-400 mb-6">{stepLabels[step]}</p>

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
              <label className="block text-sm font-medium text-gray-700 mb-1">注册邮箱</label>
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
              {sending ? '发送中…' : '发送验证码'}
            </button>
          </form>
        )}

        {/* Step 2: Code */}
        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                验证码已发送至 <span className="font-medium text-gray-800">{email}</span>
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">6 位验证码</label>
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
              {verifying ? '验证中…' : '下一步'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || sending}
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

        {/* Step 3: New password */}
        {step === 'password' && (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
                minLength={8}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-gray-400 mt-1">至少 8 个字符</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
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
              {resetting ? '重置中…' : '重置密码'}
            </button>
          </form>
        )}

        <p className="text-sm text-center text-gray-500 mt-6">
          想起密码了？{' '}
          <Link to="/login" className="text-brand-600 hover:underline">
            返回登录
          </Link>
        </p>
      </div>
    </div>
  )
}
