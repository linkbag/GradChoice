import { createContext, useContext, useEffect, useState, ReactNode, createElement } from 'react'
import { authApi, usersApi } from '@/services/api'
import type { User } from '@/types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isLoggedIn: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (email: string, password: string, display_name?: string) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

/** Decode JWT payload without a library */
function decodeJwt(token: string): { exp?: number } | null {
  try {
    const part = token.split('.')[1]
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token)
  if (!payload?.exp) return true
  return payload.exp * 1000 < Date.now()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadUser = async () => {
    const token = localStorage.getItem('access_token')
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem('access_token')
      setUser(null)
      setIsLoading(false)
      return
    }
    try {
      const res = await usersApi.getMe()
      setUser(res.data)
    } catch {
      localStorage.removeItem('access_token')
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUser()
  }, [])

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    localStorage.setItem('access_token', res.data.access_token)
    if (res.data.refresh_token) {
      localStorage.setItem('refresh_token', res.data.refresh_token)
    }
    await loadUser()
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }

  const register = async (email: string, password: string, display_name?: string) => {
    await authApi.register(email, password, display_name)
  }

  const refreshUser = async () => {
    setIsLoading(true)
    await loadUser()
  }

  return createElement(
    AuthContext.Provider,
    { value: { user, isLoading, isLoggedIn: !!user, login, logout, register, refreshUser } },
    children,
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
