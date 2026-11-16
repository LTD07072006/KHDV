export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  downloadBlob(fileName, new Blob([content], { type: `${mimeType};charset=utf-8` }))
}

export function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
