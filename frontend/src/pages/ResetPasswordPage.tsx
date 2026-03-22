import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '@/services/api'
import { zh } from '@/i18n/zh'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center text-gray-500">
        无效的重置链接。请重新申请{' '}
        <Link to="/forgot-password" className="text-brand-600 hover:underline">密码重置</Link>。
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError('密码长度不能少于8位')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      await authApi.resetPassword(token, newPassword)
      navigate('/login', { state: { message: '密码重置成功，请使用新密码登录。' } })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? '重置失败，链接可能已过期，请重新申请')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{zh.auth.reset_password_title}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {zh.auth.new_password_label}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

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
                confirmPassword && confirmPassword !== newPassword ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-red-500 mt-0.5">两次密码不一致</p>
            )}
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? '重置中…' : zh.auth.reset_password_btn}
          </button>
        </form>
      </div>
    </div>
  )
}
