const PARSER_URL = import.meta.env.VITE_PARSER_URL || 'http://localhost:8000'

export async function parseResume(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${PARSER_URL}/api/resume/upload`, { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Resume parsing failed')
  return res.json()
}
