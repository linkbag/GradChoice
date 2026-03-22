import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { authApi } from '@/services/api'
import { zh } from '@/i18n/zh'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { login, isLoggedIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn) navigate('/', { replace: true })
  }, [isLoggedIn, navigate])

  // Show success message from register redirect
  useEffect(() => {
    const state = location.state as { message?: string } | null
    if (state?.message) setSuccess(state.message)
  }, [location.state])

  // Handle email verification via token in URL
  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) return
    authApi.verifyEmail(token)
      .then(() => setSuccess('邮箱验证成功！请登录。'))
      .catch(() => setError('验证链接无效或已过期，请重新发送验证邮件。'))
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch {
      setError('邮箱或密码错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{zh.auth.login_title}</h1>

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                {zh.auth.password_label}
              </label>
              <Link to="/forgot-password" className="text-xs text-brand-600 hover:underline">
                {zh.auth.forgot_password}
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? '登录中…' : zh.auth.login_btn}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-6">
          {zh.auth.no_account}{' '}
          <Link to="/register" className="text-brand-600 hover:underline">
            {zh.auth.register_btn}
          </Link>
        </p>
      </div>
    </div>
  )
}
