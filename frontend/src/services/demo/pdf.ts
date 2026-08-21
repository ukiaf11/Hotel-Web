/**
 * Tiny dependency-free PDF writer used by the demo backend so "Download invoice"
 * and "Export PDF" produce real .pdf files with no server round-trip.
 * Supports Helvetica / Helvetica-Bold text lines and filled rectangles.
 */

type Align = 'left' | 'right' | 'center'

interface TextOp {
  kind: 'text'
  x: number
  y: number
  size: number
  bold: boolean
  value: string
  align: Align
}

interface RectOp {
  kind: 'rect'
  x: number
  y: number
  w: number
  h: number
  color: [number, number, number]
}

interface LineOp {
  kind: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
}

type Op = TextOp | RectOp | LineOp

const PAGE_W = 595.28
const PAGE_H = 841.89

/** Helvetica average glyph width factor — good enough for right/centre alignment. */
const textWidth = (value: string, size: number) => value.length * size * 0.5

const escapePdf = (value: string) =>
  value
    // the base-14 fonts are Latin-1; drop anything outside it rather than emit mojibake
    .replace(/[^\x20-\x7E]/g, (char) => (char === '—' || char === '–' ? '-' : ''))
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')

export class PdfDoc {
  private ops: Op[] = []
  cursor = PAGE_H - 60

  text(value: string, x: number, y: number, opts: { size?: number; bold?: boolean; align?: Align } = {}) {
    this.ops.push({
      kind: 'text',
      x,
      y,
      size: opts.size ?? 10,
      bold: opts.bold ?? false,
      value,
      align: opts.align ?? 'left',
    })
    return this
  }

  /** Writes at the current cursor and advances it downward by `advance` points. */
  line(value: string, opts: { size?: number; bold?: boolean; x?: number; advance?: number; align?: Align } = {}) {
    this.text(value, opts.x ?? 56, this.cursor, opts)
    this.cursor -= opts.advance ?? (opts.size ?? 10) + 6
    return this
  }

  rule(y = this.cursor + 4, x1 = 56, x2 = PAGE_W - 56) {
    this.ops.push({ kind: 'line', x1, y1: y, x2, y2: y })
    return this
  }

  rect(x: number, y: number, w: number, h: number, color: [number, number, number]) {
    this.ops.push({ kind: 'rect', x, y, w, h, color })
    return this
  }

  gap(amount = 12) {
    this.cursor -= amount
    return this
  }

  private content(): string {
    return this.ops
      .map((op) => {
        if (op.kind === 'rect') {
          const [r, g, b] = op.color
          return `${r} ${g} ${b} rg ${op.x} ${op.y} ${op.w} ${op.h} re f`
        }
        if (op.kind === 'line') {
          return `0.75 w 0.8 0.8 0.8 RG ${op.x1} ${op.y1} m ${op.x2} ${op.y2} l S`
        }
        let x = op.x
        if (op.align === 'right') x = op.x - textWidth(op.value, op.size)
        if (op.align === 'center') x = op.x - textWidth(op.value, op.size) / 2
        const font = op.bold ? '/F2' : '/F1'
        return `BT 0 0 0 rg ${font} ${op.size} Tf 1 0 0 1 ${x.toFixed(2)} ${op.y.toFixed(2)} Tm (${escapePdf(op.value)}) Tj ET`
      })
      .join('\n')
  }

  toBlob(): Blob {
    const stream = this.content()
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ]

    let body = '%PDF-1.4\n'
    const offsets: number[] = []
    objects.forEach((object, index) => {
      offsets.push(body.length)
      body += `${index + 1} 0 obj\n${object}\nendobj\n`
    })

    const xrefStart = body.length
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    offsets.forEach((offset) => {
      xref += `${String(offset).padStart(10, '0')} 00000 n \n`
    })
    body += `${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

    const bytes = new Uint8Array(body.length)
    for (let i = 0; i < body.length; i += 1) bytes[i] = body.charCodeAt(i) & 0xff
    return new Blob([bytes], { type: 'application/pdf' })
  }
}

export const PAGE = { width: PAGE_W, height: PAGE_H, left: 56, right: PAGE_W - 56 }
