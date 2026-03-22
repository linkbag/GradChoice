import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { zh } from '@/i18n/zh'

function getPasswordStrength(pw: string): 'weak' | 'medium' | 'strong' | null {
  if (!pw) return null
  if (pw.length < 8) return 'weak'
  const hasLower = /[a-z]/.test(pw)
  const hasUpper = /[A-Z]/.test(pw)
  const hasDigit = /\d/.test(pw)
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw)
  const score = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length
  if (score <= 2) return 'weak'
  if (score === 3) return 'medium'
  return 'strong'
}

const strengthColor = {
  weak: 'bg-red-400',
  medium: 'bg-yellow-400',
  strong: 'bg-green-500',
}

const strengthWidth = {
  weak: 'w-1/3',
  medium: 'w-2/3',
  strong: 'w-full',
}

function isEduEmail(email: string): boolean {
  const domain = email.toLowerCase().split('@')[1] ?? ''
  return domain.endsWith('.edu.cn') || domain.endsWith('.ac.cn')
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { isLoggedIn, register } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isLoggedIn) navigate('/', { replace: true })
  }, [isLoggedIn, navigate])

  const strength = getPasswordStrength(password)
  const showEduHint = email.includes('@') && isEduEmail(email)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    if (password.length < 8) {
      setError('密码长度不能少于8位')
      return
    }
    if (!termsAccepted) {
      setError('请先阅读并同意用户协议')
      return
    }

    setLoading(true)
    try {
      await register(email, password, displayName || undefined)
      navigate('/login', { state: { message: '注册成功！请检查您的邮箱以完成验证。' } })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? '注册失败，该邮箱可能已被注册')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{zh.auth.register_title}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {zh.auth.email_label}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {showEduHint && (
              <p className="mt-1 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
                🎓 {zh.auth.edu_hint}
              </p>
            )}
          </div>

          {/* Display name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {zh.auth.display_name_label}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {zh.auth.password_label}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {/* Strength indicator */}
            {strength && (
              <div className="mt-1.5">
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${strengthColor[strength]} ${strengthWidth[strength]}`}
                  />
                </div>
                <p className={`text-xs mt-0.5 ${strength === 'weak' ? 'text-red-500' : strength === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                  {zh.auth.password_strength[strength]}
                </p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {zh.auth.confirm_password_label}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                confirmPassword && confirmPassword !== password
                  ? 'border-red-300'
                  : 'border-gray-300'
              }`}
            />
            {confirmPassword && confirmPassword !== password && (
              <p className="text-xs text-red-500 mt-0.5">两次密码不一致</p>
            )}
          </div>

          {/* Terms */}
          <div className="flex items-start gap-2">
            <input
              id="terms"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 accent-brand-600"
            />
            <label htmlFor="terms" className="text-sm text-gray-600 cursor-pointer">
              {zh.auth.terms_agree}{' '}
              <Link to="/about" className="text-brand-600 hover:underline">
                {zh.auth.terms_link}
              </Link>
            </label>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? '注册中…' : zh.auth.register_btn}
          </button>
        </form>

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
