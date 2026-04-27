import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { chatsApi } from '@/services/api'

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, locale, setLocale } = useI18n()
  const isLoggedIn = !!localStorage.getItem('access_token')
  const [unreadCount, setUnreadCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchUnread = async () => {
    try {
      const res = await chatsApi.getUnreadCount()
      setUnreadCount(res.data.unread_count)
    } catch {
      // silently fail — don't disrupt layout on error
    }
  }

  useEffect(() => {
    if (!isLoggedIn) return

    // Only poll while the tab is visible. Hidden tabs don't need a fresh badge,
    // and skipping their polls is the single biggest reduction in DB traffic.
    const tick = () => {
      if (document.visibilityState === 'visible') fetchUnread()
    }
    tick()
    intervalRef.current = setInterval(tick, 90_000)

    // Refresh immediately when the user comes back to the tab.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchUnread()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isLoggedIn])

  // Clear badge when user is on the inbox page
  useEffect(() => {
    if (location.pathname === '/inbox') {
      setUnreadCount(0)
    }
  }, [location.pathname])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    setMobileMenuOpen(false)
    navigate('/login')
  }

  const closeMobileMenu = () => setMobileMenuOpen(false)

  const toggleLocale = () => setLocale(locale === 'zh' ? 'en' : 'zh')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2" onClick={closeMobileMenu}>
              <span className="text-xl font-bold text-brand-700">{t.nav.brand}</span>
              {t.nav.brand_sub && (
                <span className="text-sm text-gray-500 hidden sm:inline">{t.nav.brand_sub}</span>
              )}
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-6">
              <Link to="/" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">
                {t.nav.home}
              </Link>
              <Link to="/search" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">
                {t.nav.search}
              </Link>
              <Link to="/add-supervisor" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">
                {t.nav.add_supervisor}
              </Link>
              <Link to="/rankings" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">
                {t.nav.rankings}
              </Link>

              {isLoggedIn ? (
                <>
                  <Link to="/inbox" className="relative text-sm text-gray-600 hover:text-brand-600 transition-colors">
                    {t.nav.inbox}
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link to="/my-reviews" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">
                    {t.nav.my_reviews}
                  </Link>
                  <Link to="/profile" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">
                    {t.nav.profile}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                  >
                    {t.nav.logout}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm text-gray-600 hover:text-brand-600 transition-colors"
                  >
                    {t.nav.login}
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm bg-brand-600 text-white px-4 py-1.5 rounded-full hover:bg-brand-700 transition-colors"
                  >
                    {t.nav.register}
                  </Link>
                </>
              )}

              {/* Desktop locale toggle */}
              <button
                onClick={toggleLocale}
                className="text-sm text-gray-500 hover:text-brand-600 transition-colors flex items-center gap-1"
                aria-label="Switch language"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
                  <path strokeWidth={1.5} d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                {locale === 'zh' ? 'EN' : '中'}
              </button>
            </div>

            {/* Mobile: locale toggle + hamburger */}
            <div className="md:hidden flex items-center gap-1">
              <button
                onClick={toggleLocale}
                className="p-2 rounded-md text-gray-600 hover:text-brand-600 hover:bg-gray-100 transition-colors text-sm font-medium"
                aria-label="Switch language"
              >
                {locale === 'zh' ? 'EN' : '中'}
              </button>
              <button
                className="p-2 rounded-md text-gray-600 hover:text-brand-600 hover:bg-gray-100 transition-colors"
                onClick={() => setMobileMenuOpen(prev => !prev)}
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-200 ${
            mobileMenuOpen ? 'max-h-96' : 'max-h-0'
          }`}
        >
          <div className="border-t border-gray-100 px-4 py-3 flex flex-col gap-1">
            <Link
              to="/"
              className="text-sm text-gray-700 hover:text-brand-600 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors"
              onClick={closeMobileMenu}
            >
              {t.nav.home}
            </Link>
            <Link
              to="/search"
              className="text-sm text-gray-700 hover:text-brand-600 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors"
              onClick={closeMobileMenu}
            >
              {t.nav.search}
            </Link>
            <Link
              to="/add-supervisor"
              className="text-sm text-gray-700 hover:text-brand-600 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors"
              onClick={closeMobileMenu}
            >
              {t.nav.add_supervisor}
            </Link>
            <Link
              to="/rankings"
              className="text-sm text-gray-700 hover:text-brand-600 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors"
              onClick={closeMobileMenu}
            >
              {t.nav.rankings}
            </Link>

            {isLoggedIn ? (
              <>
                <Link
                  to="/inbox"
                  className="relative text-sm text-gray-700 hover:text-brand-600 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors flex items-center gap-2"
                  onClick={closeMobileMenu}
                >
                  {t.nav.inbox}
                  {unreadCount > 0 && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  to="/my-reviews"
                  className="text-sm text-gray-700 hover:text-brand-600 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors"
                  onClick={closeMobileMenu}
                >
                  {t.nav.my_reviews}
                </Link>
                <Link
                  to="/profile"
                  className="text-sm text-gray-700 hover:text-brand-600 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors"
                  onClick={closeMobileMenu}
                >
                  {t.nav.profile}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-left text-sm text-gray-500 hover:text-red-600 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors"
                >
                  {t.nav.logout}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-gray-700 hover:text-brand-600 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors"
                  onClick={closeMobileMenu}
                >
                  {t.nav.login}
                </Link>
                <Link
                  to="/register"
                  className="text-sm text-brand-600 hover:text-brand-700 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors"
                  onClick={closeMobileMenu}
                >
                  {t.nav.register}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 md:px-8 text-center text-sm text-gray-500">
          <p>{t.footer.tagline}</p>
          <p className="mt-1">
            <a
              href="https://github.com/linkbag/GradChoice"
              className="hover:text-brand-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            {' · '}
            <Link to="/about" className="hover:text-brand-600 transition-colors">
              {t.footer.about}
            </Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
