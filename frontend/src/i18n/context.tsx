import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { zh, type Translations } from './zh'
import { en } from './en'

type Locale = 'zh' | 'en'

interface I18nContextValue {
  t: Translations
  locale: Locale
  setLocale: (locale: Locale) => void
}

const translations: Record<Locale, Translations> = { zh, en }

const STORAGE_KEY = 'locale'

function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'zh' || stored === 'en') return stored
  } catch {
    // localStorage unavailable (SSR, privacy mode, etc.)
  }
  return 'zh'
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }, [])

  const value: I18nContextValue = {
    t: translations[locale],
    locale,
    setLocale,
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>')
  return ctx
}
