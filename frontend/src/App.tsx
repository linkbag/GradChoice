import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import HomePage from '@/pages/HomePage'
import SearchPage from '@/pages/SearchPage'
import SupervisorPage from '@/pages/SupervisorPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ProfilePage from '@/pages/ProfilePage'
import InboxPage from '@/pages/InboxPage'
import AboutPage from '@/pages/AboutPage'
import NotFoundPage from '@/pages/NotFoundPage'
import RankingsPage from '@/pages/RankingsPage'
import SchoolAnalyticsPage from '@/pages/SchoolAnalyticsPage'
import RatePage from '@/pages/RatePage'
import PublicProfilePage from '@/pages/PublicProfilePage'
import AddSupervisorPage from '@/pages/AddSupervisorPage'
import TermsPage from '@/pages/TermsPage'
import MyReviewsPage from '@/pages/MyReviewsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="supervisor/:id" element={<SupervisorPage />} />
          <Route path="supervisor/:id/rate" element={<RatePage />} />
          <Route path="rankings" element={<RankingsPage />} />
          <Route path="school/:code/analytics" element={<SchoolAnalyticsPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="users/:userId/profile" element={<PublicProfilePage />} />
          <Route path="add-supervisor" element={<AddSupervisorPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="my-reviews" element={<MyReviewsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
