import { useEffect } from 'react'

export default function useDocumentTitle(title, description) {
  useEffect(() => {
    const metaDescription = document.querySelector('meta[name="description"]')
    const previousDescription = metaDescription?.getAttribute('content') || ''

    if (description && metaDescription) {
      metaDescription.setAttribute('content', description)
    }

    return () => {
      if (description && metaDescription) {
        metaDescription.setAttribute('content', previousDescription)
      }
    }
  }, [description])
}
