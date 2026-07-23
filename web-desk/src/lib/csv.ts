// CSV 다운로드 유틸 — BOM 포함(엑셀 한글 호환). Phase C (2026-07-23)
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]): void {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const content = '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
