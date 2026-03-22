import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/services/api'
import { zh } from '@/i18n/zh'
import axios from 'axios'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('密码长度至少为 8 个字符')
      return
    }

    setLoading(true)
    try {
      await authApi.register(email, password, displayName || undefined)
      const isEdu = email.endsWith('.edu.cn')
      navigate('/login', {
        state: {
          message: isEdu
            ? '注册成功！您的 .edu.cn 邮箱已自动完成验证，请登录。'
            : '注册成功！请登录。',
        },
      })
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail
        if (typeof detail === 'string') {
          setError(detail)
        } else if (err.response?.status === 422) {
          // Validation error — extract first message
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

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{zh.auth.register_title}</h1>

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
            <p className="text-xs text-gray-400 mt-1">
              使用 .edu.cn 邮箱注册可自动完成学生身份认证
            </p>
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

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

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
