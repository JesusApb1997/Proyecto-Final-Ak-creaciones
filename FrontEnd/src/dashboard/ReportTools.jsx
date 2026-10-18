import { useMemo, useState } from 'react'

const dateValue = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

export function useReportFilter(records, fields) {
  const [searchField, setSearchField] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const filteredRecords = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    if (!term) return records
    const activeFields = searchField === 'all' ? fields : fields.filter((field) => field.value === searchField)
    return records.filter((record) => activeFields.some((field) => {
      const value = field.getValue(record)
      if (field.type === 'date') return dateValue(value) === term
      return String(value ?? '').toLocaleLowerCase().includes(term)
    }))
  }, [records, fields, searchField, query])

  const selectedRecords = useMemo(
    () => records.filter((record) => selectedIds.has(String(record.id))),
    [records, selectedIds]
  )
  const visibleIds = filteredRecords.map((record) => String(record.id))
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

  const toggleRow = (id) => {
    const key = String(id)
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  return {
    searchField,
    setSearchField,
    query,
    setQuery,
    filteredRecords,
    selectedRecords,
    selectedIds,
    allVisibleSelected,
    toggleRow,
    toggleVisible,
    clearSelection: () => setSelectedIds(new Set()),
  }
}

function reportRecords(report) {
  return report.selectedRecords.length ? report.selectedRecords : report.filteredRecords
}

async function downloadPdf(title, columns, records) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const pdf = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' })
  const generatedAt = new Date().toLocaleString('es-VE')
  pdf.setFontSize(18)
  pdf.setTextColor(31, 119, 145)
  pdf.text(title, 14, 18)
  pdf.setFontSize(9)
  pdf.setTextColor(100)
  pdf.text(`Generado: ${generatedAt} · Registros: ${records.length}`, 14, 24)
  autoTable(pdf, {
    startY: 29,
    head: [columns.map((column) => column.label)],
    body: records.map((record) => columns.map((column) => String(column.getValue(record) ?? '—'))),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 162, 199], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 250, 252] },
    margin: { left: 14, right: 14, bottom: 16 },
  })
  pdf.save(`${title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`)
}

async function downloadWord(title, columns, records) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx')
  const children = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: `Generado: ${new Date().toLocaleString('es-VE')} · Registros: ${records.length}` }),
    new Paragraph({ text: '' }),
  ]
  records.forEach((record, index) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: `${index + 1}. ${columns[0].getValue(record) || 'Registro'}`, bold: true })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 180, after: 80 },
    }))
    columns.slice(1).forEach((column) => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${column.label}: `, bold: true }),
          new TextRun(String(column.getValue(record) ?? '—')),
        ],
        spacing: { after: 40 },
      }))
    })
  })
  const document = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(document)
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = `${title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}.docx`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function downloadExcel(title, columns, records) {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(title)

  // Add title row
  worksheet.addRow([title])
  worksheet.getRow(1).font = { bold: true, size: 14 }
  worksheet.mergeCells(1, 1, columns.length, 1)

  // Add generated at row
  const generatedAt = new Date().toLocaleString('es-VE')
  worksheet.addRow([`Generado: ${generatedAt} · Registros: ${records.length}`])
  worksheet.getRow(2).font = { italic: true, size: 10 }

  // Add column headers
  const headerRow = worksheet.addRow([])
  columns.forEach((column) => {
    headerRow.addColumn(column.label)
  })
  headerRow.font = { bold: true, color: { rgb: 'FFFFFF' } }
  headerRow.fill = { fgColor: { rgb: '1FA2C7' } }

  // Add data rows
  records.forEach((record, index) => {
    const row = worksheet.addRow([])
    columns.forEach((column) => {
      const value = column.getValue(record)
      row.addCell(String(value ?? '—'))
    })
    // Style data rows
    row.eachCell((cell) => {
      cell.font = { size: 11 }
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    })
  })

  // Set column widths based on label length
  columns.forEach((column, colIndex) => {
    const maxLength = column.label.length
    worksheet.getColumn(colIndex + 1).width = Math.max(15, Math.min(60, maxLength + 5))
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = window.document.createElement('a')
  link.href = url
  link.download = `${title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ReportToolbar({ title, fields, columns, report }) {
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)
  const records = reportRecords(report)
  const searchField = fields.find((field) => field.value === report.searchField)

  const exportFile = async (format) => {
    if (!records.length) return
    setExportError('')
    setExporting(true)
    try {
      if (format === 'pdf') await downloadPdf(title, columns, records)
      else if (format === 'excel') await downloadExcel(title, columns, records)
      else await downloadWord(title, columns, records)
    } catch (error) {
      console.error(`No se pudo generar el reporte ${format.toUpperCase()}:`, error)
      setExportError(`No se pudo generar el archivo ${format.toUpperCase()}. Intenta nuevamente.`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="report-tools" aria-label={`Buscar y exportar ${title}`}>
      <label className="report-search-select">
        <span>Buscar por</span>
        <select value={report.searchField} onChange={(event) => report.setSearchField(event.target.value)}>
          <option value="all">Todos los campos</option>
          {fields.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
        </select>
      </label>
      <label className="report-search-input">
        <span className="sr-only">Buscar {title}</span>
        <i className="bi bi-search" aria-hidden="true"></i>
        <input
          type={searchField?.type === 'date' ? 'date' : 'search'}
          value={report.query}
          onChange={(event) => report.setQuery(event.target.value)}
          placeholder={searchField?.type === 'date' ? 'Seleccionar fecha' : `Buscar en ${title.toLocaleLowerCase()}…`}
        />
      </label>
      <div className="report-tools-summary">
        <label className="report-select-visible">
          <input type="checkbox" checked={report.allVisibleSelected} onChange={report.toggleVisible} disabled={!report.filteredRecords.length} />
          Seleccionar resultados
        </label>
        <span>{report.selectedRecords.length ? `${report.selectedRecords.length} seleccionados` : `${report.filteredRecords.length} resultados`}</span>
      </div>
      <div className="report-export-actions" aria-label="Descargar reporte">
        <button type="button" className="btn-icon report-export-pdf" title="Descargar reporte PDF" aria-label="Descargar reporte PDF" onClick={() => exportFile('pdf')} disabled={!records.length || exporting}>
          <i className={exporting ? 'bi bi-hourglass-split' : 'bi bi-file-earmark-pdf-fill'} aria-hidden="true"></i>
        </button>
        <button type="button" className="btn-icon report-export-word" title="Descargar reporte Word" aria-label="Descargar reporte Word" onClick={() => exportFile('word')} disabled={!records.length || exporting}>
          <i className={exporting ? 'bi bi-hourglass-split' : 'bi bi-file-earmark-word-fill'} aria-hidden="true"></i>
        </button>
        <button type="button" className="btn-icon report-export-excel" title="Descargar reporte Excel" aria-label="Descargar reporte Excel" onClick={() => exportFile('excel')} disabled={!records.length || exporting}>
          <i className={exporting ? 'bi bi-hourglass-split' : 'bi bi-file-earmark-excel-fill'} aria-hidden="true"></i>
        </button>
      </div>
      {report.selectedRecords.length > 0 && (
        <button type="button" className="report-clear-selection" onClick={report.clearSelection}>Quitar selección</button>
      )}
      {exportError && <p className="report-export-error" role="alert">{exportError}</p>}
    </div>
  )
}
