import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-32 text-center">
      <h1 className="text-6xl font-bold text-brand-200 mb-4">404</h1>
      <p className="text-gray-600 mb-8">页面不存在</p>
      <Link
        to="/"
        className="inline-block bg-brand-600 text-white px-6 py-2.5 rounded-lg hover:bg-brand-700 transition-colors"
      >
        返回首页
      </Link>
    </div>
  )
}
