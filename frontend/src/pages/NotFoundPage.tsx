import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'

export default function NotFoundPage() {
  const { t } = useI18n()
  return (
    <div className="max-w-md mx-auto px-4 py-32 text-center">
      <h1 className="text-6xl font-bold text-brand-200 mb-4">404</h1>
      <p className="text-gray-600 mb-8">{t.not_found.message}</p>
      <Link
        to="/"
        className="inline-block bg-brand-600 text-white px-6 py-2.5 rounded-lg hover:bg-brand-700 transition-colors"
      >
        {t.not_found.back_home}
      </Link>
    </div>
  )
}
