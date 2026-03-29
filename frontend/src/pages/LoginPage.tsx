import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { authApi } from '@/services/api'
import { zh } from '@/i18n/zh'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const successMessage = (location.state as { message?: string })?.message || null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await authApi.login(email, password)
      localStorage.setItem('access_token', res.data.access_token)
      navigate('/')
    } catch {
      setError('邮箱或密码错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10 md:py-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 md:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{zh.auth.login_title}</h1>

        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 mb-4">
            {successMessage}
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
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {zh.auth.password_label}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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

          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-gray-400 hover:text-brand-600 hover:underline">
              忘记密码？
            </Link>
          </div>
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
