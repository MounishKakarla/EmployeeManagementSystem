// src/utils/csvUtils.js
export function exportToCSV(data, fileName = 'export.csv') {
  if (!data || !data.length) return
  const headers = Object.keys(data[0])
  const rows = [
    headers.join(','),
    ...data.map(row => headers.map(field => {
      let val = row[field]
      if (field.toLowerCase().includes('phone') && val) val = `="${val}"`
      else if (field.toLowerCase().includes('date') && val) {
        try {
          const d = new Date(val)
          if (!isNaN(d)) {
            val = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
          }
        } catch {}
      } else if (typeof val === 'boolean') val = val ? 'Yes' : 'No'
      else if (Array.isArray(val)) val = val.join(', ')
      return `"${(val?.toString() || '').replace(/"/g,'""')}"`
    }).join(','))
  ]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.setAttribute('download', fileName)
  document.body.appendChild(link); link.click()
  document.body.removeChild(link); URL.revokeObjectURL(url)
}
