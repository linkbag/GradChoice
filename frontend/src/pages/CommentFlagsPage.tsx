import React from 'react'
import { useI18n } from '@/i18n'

const CommentFlagsPage: React.FC = () => {
  const { t } = useI18n()
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">{t.comment_flags.title}</h1>
      <p>{t.comment_flags.under_construction}</p>
    </div>
  )
}

export default CommentFlagsPage
