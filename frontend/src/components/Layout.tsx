import { Link, Outlet, useNavigate } from 'react-router-dom'
import { zh } from '@/i18n/zh'

export default function Layout() {
  const navigate = useNavigate()
  const isLoggedIn = !!localStorage.getItem('access_token')

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-brand-700">研选</span>
              <span className="text-sm text-gray-500 hidden sm:inline">GradChoice</span>
            </Link>

            {/* Nav links */}
            <div className="flex items-center gap-6">
              <Link to="/" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">
                {zh.nav.home}
              </Link>
              <Link to="/search" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">
                {zh.nav.search}
              </Link>
              <Link to="/rankings" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">
                {zh.nav.rankings}
              </Link>
              <Link to="/about" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">
                {zh.nav.about}
              </Link>
              <Link to="/add-supervisor" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">
                {zh.nav.add_supervisor}
              </Link>

              {isLoggedIn ? (
                <>
                  <Link to="/inbox" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">
                    {zh.nav.inbox}
                  </Link>
                  <Link to="/profile" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">
                    {zh.nav.profile}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                  >
                    {zh.nav.logout}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm text-gray-600 hover:text-brand-600 transition-colors"
                  >
                    {zh.nav.login}
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm bg-brand-600 text-white px-4 py-1.5 rounded-full hover:bg-brand-700 transition-colors"
                  >
                    {zh.nav.register}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>研选 GradChoice — 中立 · 公开 · 免费 · 开源</p>
          <p className="mt-1">
            <a
              href="https://github.com/your-org/gradchoice"
              className="hover:text-brand-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            {' · '}
            <Link to="/about" className="hover:text-brand-600 transition-colors">
              关于我们
            </Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
