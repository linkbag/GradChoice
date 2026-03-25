import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AutocompleteInput from '@/components/AutocompleteInput'
import { supervisorsApi } from '@/services/api'
import { zh } from '@/i18n/zh'

const TITLE_OPTIONS = ['教授', '副教授', '讲师', '助理教授', '研究员', '其他']

export default function AddSupervisorPage() {
  const navigate = useNavigate()
  const isLoggedIn = !!localStorage.getItem('access_token')

  const [schoolNames, setSchoolNames] = useState<string[]>([])
  const [form, setForm] = useState({
    school_name: '',
    department: '',
    name: '',
    title: '',
    website_url: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supervisorsApi.getSchoolNames().then((res) => {
      setSchoolNames(res.data.map((s) => s.school_name))
    })
  }, [])

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.school_name.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      const res = await supervisorsApi.submit({
        name: form.name.trim(),
        school_name: form.school_name.trim(),
        department: form.department.trim() || undefined,
        title: form.title || undefined,
        website_url: form.website_url.trim() || undefined,
      })
      navigate(`/supervisor/${res.data.id}`)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (detail === '该导师可能已存在') {
        setError(zh.addSupervisor.error_duplicate)
      } else {
        setError(zh.addSupervisor.error_generic)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{zh.addSupervisor.page_title}</h1>

      {/* Guidance */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6 space-y-1.5 text-sm text-teal-800">
        <p>{zh.addSupervisor.guidance_language}</p>
        <p>{zh.addSupervisor.guidance_duplicate}</p>
      </div>

      {!isLoggedIn && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          {zh.addSupervisor.login_required}{' '}
          <Link to="/login" className="underline font-medium hover:text-amber-900">
            {zh.auth.login_btn}
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* School name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {zh.addSupervisor.field_school}
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <AutocompleteInput
            options={schoolNames}
            value={form.school_name}
            onChange={(v) => handleChange('school_name', v)}
            placeholder={zh.addSupervisor.field_school_placeholder}
          />
        </div>

        {/* Department */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {zh.addSupervisor.field_department}
          </label>
          <input
            type="text"
            value={form.department}
            onChange={(e) => handleChange('department', e.target.value)}
            placeholder={zh.addSupervisor.field_department_placeholder}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
        </div>

        {/* Supervisor name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {zh.addSupervisor.field_name}
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder={zh.addSupervisor.field_name_placeholder}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {zh.addSupervisor.field_title}
          </label>
          <select
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
          >
            <option value="">{zh.addSupervisor.field_title_placeholder}</option>
            {TITLE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Website */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {zh.addSupervisor.field_website}
          </label>
          <input
            type="url"
            value={form.website_url}
            onChange={(e) => handleChange('website_url', e.target.value)}
            placeholder={zh.addSupervisor.field_website_placeholder}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !isLoggedIn || !form.name.trim() || !form.school_name.trim()}
          className="w-full bg-teal-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? zh.addSupervisor.submitting : zh.addSupervisor.submit_btn}
        </button>
      </form>
    </div>
  )
}
