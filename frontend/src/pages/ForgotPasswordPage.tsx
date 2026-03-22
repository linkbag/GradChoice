import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/services/api'
import { zh } from '@/i18n/zh'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSubmitted(true)
    } catch {
      setError('发送失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">📧</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">邮件已发送</h1>
          <p className="text-gray-500 text-sm mb-6">
            如果 <strong>{email}</strong> 已注册，您将收到一封包含密码重置链接的邮件。请检查您的收件箱（包括垃圾邮件文件夹）。
          </p>
          <Link to="/login" className="text-brand-600 hover:underline text-sm">
            返回登录
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{zh.auth.forgot_password_title}</h1>
        <p className="text-sm text-gray-500 mb-6">{zh.auth.forgot_password_desc}</p>

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

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? '发送中…' : zh.auth.send_reset_link}
          </button>
        </form>

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
