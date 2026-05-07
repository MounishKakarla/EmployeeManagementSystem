const normalizeResumeEndpoint = (url) => {
  const base = (url || '/api').trim().replace(/\/+$/, '')
  return base.endsWith('/api') ? `${base}/resume/upload` : `${base}/api/resume/upload`
}

const RESUME_UPLOAD_URL = normalizeResumeEndpoint(import.meta.env.VITE_PARSER_URL)

export async function parseResume(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(RESUME_UPLOAD_URL, { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Resume parsing failed')
  return res.json()
}
