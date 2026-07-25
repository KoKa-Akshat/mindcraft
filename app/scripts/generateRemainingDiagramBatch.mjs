import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../src/data/generatedDiagrams')

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
}

function svg(body, viewBox = '0 0 420 260') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="420" height="260" role="img">
  <rect width="100%" height="100%" fill="#fff"/>
  <g fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</g>
</svg>
`
}

function text(x, y, value, size = 18, anchor = 'middle', fill = '#111', weight = 600) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" stroke="none">${esc(value)}</text>`
}

function smile(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <circle cx="0" cy="0" r="13" fill="none" stroke="#111" stroke-width="2"/>
    <circle cx="-5" cy="-4" r="1.7" fill="#111" stroke="none"/>
    <circle cx="5" cy="-4" r="1.7" fill="#111" stroke="none"/>
    <path d="M-6 4 Q0 9 6 4"/>
  </g>`
}

function curly(x1, x2, y, label) {
  const mid = (x1 + x2) / 2
  return `<path d="M${x1} ${y} C${x1} ${y + 18} ${mid - 18} ${y + 8} ${mid} ${y + 24} C${mid + 18} ${y + 8} ${x2} ${y + 18} ${x2} ${y}"/>
  ${text(mid, y + 50, label, 18)}`
}

function bar(id, color, parts, subparts, bracketParts, bracketLabel, sectionLabel = '') {
  const x = 40, y = 90, w = 340, h = 44
  const sw = w / parts
  let body = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none"/>`
  for (let i = 1; i < parts; i++) body += `<line x1="${x + i * sw}" y1="${y}" x2="${x + i * sw}" y2="${y + h}"/>`
  body += `<rect x="${x}" y="${y}" width="${sw}" height="${h}" fill="${color}" stroke="none" opacity=".35"/>`
  if (sectionLabel) {
    for (let i = 0; i < parts; i++) body += text(x + i * sw + sw / 2, y + 29, sectionLabel, 17)
  }
  if (subparts) {
    const subW = sw / subparts
    for (let i = 1; i < subparts; i++) body += `<line x1="${x + i * subW}" y1="${y}" x2="${x + i * subW}" y2="${y + h}" stroke-dasharray="4 4"/>`
  }
  const bracketW = subparts ? sw / subparts : sw * bracketParts
  body += curly(x, x + bracketW, y + h + 10, bracketLabel)
  return [id, svg(body)]
}

function numberLine(id, leftLabel, rightLabel) {
  const x = 60, y = 130, step = 75
  let body = `<line x1="${x - 20}" y1="${y}" x2="${x + step * 4 + 20}" y2="${y}"/>`
  for (let i = 0; i < 5; i++) body += `<line x1="${x + i * step}" y1="${y - 11}" x2="${x + i * step}" y2="${y + 11}"/>`
  body += text(x, y + 42, leftLabel, 18)
  body += text(x + step * 4, y + 42, rightLabel, 18)
  const ax = x + step * 3
  body += `<path d="M${ax} ${y - 54} V${y - 16}" marker-end="url(#arrow)"/>
  <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#111" stroke="none"/></marker></defs>`
  return [id, svg(body)]
}

function busStop(id, divisor, dividend, placeholders) {
  const x = 122, y = 128
  const chars = String(dividend).split('')
  const gap = 38
  let body = text(76, y + 8, divisor, 22, 'middle')
  body += `<path d="M98 ${y - 36} Q98 ${y - 10} 98 ${y + 24} H${98 + chars.length * gap + 20}"/>`
  chars.forEach((c, i) => { body += text(x + i * gap, y + 8, c, 24) })
  placeholders.forEach((p, i) => { body += placeholder(x + i * gap, y - 54, p) })
  return [id, svg(body)]
}

function placeholder(x, y, kind) {
  if (kind === 'star' || kind === 'purpleStar') {
    const fill = kind === 'purpleStar' ? '#8d61c8' : '#f5d348'
    return `<path d="M${x} ${y - 13} L${x + 4} ${y - 4} L${x + 14} ${y - 4} L${x + 6} ${y + 2} L${x + 9} ${y + 12} L${x} ${y + 6} L${x - 9} ${y + 12} L${x - 6} ${y + 2} L${x - 14} ${y - 4} L${x - 4} ${y - 4} Z" fill="${fill}" stroke="#111"/>`
  }
  if (kind === 'triangle') return `<path d="M${x} ${y - 14} L${x + 15} ${y + 12} H${x - 15} Z" fill="#8d61c8" stroke="#111"/>`
  return `<rect x="${x - 15}" y="${y - 12}" width="30" height="24" fill="#9fd0ff" stroke="#111"/>`
}

function functionMachine(id, boxes, labels) {
  const x = 38, y = 103, w = 70, h = 44, gap = 25
  let body = ''
  boxes.forEach((box, i) => {
    const bx = x + i * (w + gap)
    if (labels?.[i]) body += text(bx + w / 2, y - 14, labels[i], 14)
    body += `<rect x="${bx}" y="${y}" width="${w}" height="${h}" rx="3" fill="none"/>`
    if (box === 'star') body += placeholder(bx + w / 2, y + h / 2, 'purpleStar')
    if (i < boxes.length - 1) body += `<path d="M${bx + w + 4} ${y + h / 2} H${bx + w + gap - 4}" marker-end="url(#arrow)"/>`
  })
  body += `<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#111" stroke="none"/></marker></defs>`
  return [id, svg(body)]
}

function barModel(id) {
  const x = 70, y = 78, w = 280, h = 36
  let body = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none"/>`
  body += `<line x1="${x + w / 3}" y1="${y}" x2="${x + w / 3}" y2="${y + h}"/><line x1="${x + 2 * w / 3}" y1="${y}" x2="${x + 2 * w / 3}" y2="${y + h}"/>`
  body += text(x + w / 6, y + 24, 'k', 18) + text(x + w / 2, y + 24, 'k', 18) + text(x + 5 * w / 6, y + 24, 'k', 18)
  body += `<rect x="${x}" y="${y + 74}" width="${w}" height="${h}" fill="none"/>`
  body += text(x + w / 2, y + 98, 'm', 18)
  return [id, svg(body)]
}

function fractionCircles(id, a, b, top = '') {
  let body = `<circle cx="210" cy="62" r="32"/>${top ? text(210, 68, top, 18) : ''}
  <circle cx="135" cy="168" r="32"/>${text(135, 174, a, 18)}
  <circle cx="285" cy="168" r="32"/>${text(285, 174, b, 18)}
  <line x1="190" y1="88" x2="154" y2="142"/>
  <line x1="230" y1="88" x2="266" y2="142"/>`
  return [id, svg(body)]
}

function longMultiplication() {
  const topY = 72
  const botY = 116
  const digitX = [152, 182, 212, 242]
  const lowerX = [212, 242]
  let body = ''
  ;['3', '8', '4', '7'].forEach((d, i) => { body += text(digitX[i], topY, d, 28) })
  body += text(178, botY, '×', 28)
  ;['2', '8'].forEach((d, i) => { body += text(lowerX[i], botY, d, 28) })
  body += `<line x1="135" y1="132" x2="262" y2="132"/>`
  body += `<circle cx="${digitX[1]}" cy="${topY - 9}" r="16"/>`
  body += `<circle cx="${lowerX[0]}" cy="${botY - 9}" r="16"/>`
  return ['eedi_205', svg(body)]
}

function thermometer() {
  const x = 210, top = 34, bottom = 202, step = (bottom - top) / 10
  let body = `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}"/>`
  for (let i = 0; i <= 10; i++) {
    const y = top + i * step
    body += `<line x1="${x - 12}" y1="${y}" x2="${x + 12}" y2="${y}"/>`
  }
  body += text(x + 34, top + 5, '10', 16, 'start')
  body += text(x + 34, top + 5 * step + 5, '0', 16, 'start')
  body += text(x + 34, bottom + 5, '-10', 16, 'start')
  const tempY = top + 9 * step
  body += `<path d="M${x - 42} ${tempY} H${x - 15}" marker-end="url(#arrow)"/>
  <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#111" stroke="none"/></marker></defs>`
  return ['eedi_440', svg(body)]
}

function pictogram() {
  let body = text(45, 45, 'Key:', 16, 'start') + smile(110, 40, 0.75) + text(138, 46, '= 12 people', 16, 'start')
  const rows = [['Game 1', 4], ['Game 2', 2], ['Game 3', 3], ['Game 4', 1]]
  rows.forEach(([label, count], r) => {
    const y = 90 + r * 36
    body += text(45, y + 6, label, 15, 'start')
    for (let i = 0; i < count; i++) body += smile(145 + i * 34, y, 0.75)
  })
  return ['eedi_168', svg(body)]
}

const diagrams = [
  thermometer(),
  pictogram(),
  bar('eedi_309', '#4caf50', 4, 2, 1, '?'),
  bar('eedi_622', '#4caf50', 4, 3, 1, '?'),
  bar('eedi_1062', '#4caf50', 5, null, 3, '615', 'P'),
  bar('eedi_1189', '#4b9cff', 5, null, 4, '420', 'M'),
  longMultiplication(),
  busStop('eedi_791', 4, 92, ['star', 'triangle']),
  busStop('eedi_805', 6, 84, ['star', 'triangle']),
  busStop('eedi_1031', 3, 735, ['star', 'triangle', 'rect']),
  busStop('eedi_1534', 3, 771, ['star', 'triangle', 'rect']),
  numberLine('eedi_457', '1/6', '3/6'),
  numberLine('eedi_1587', '1/5', '3/5'),
  functionMachine('eedi_623', ['', '', 'star', ''], []),
  functionMachine('eedi_1839', ['', '', '', 'star'], ['input', '', '', 'output']),
  barModel('eedi_364'),
  barModel('eedi_1791'),
  fractionCircles('eedi_1055', '3/5', '1/4'),
  fractionCircles('eedi_1526', '3/5', '2/7'),
]

fs.mkdirSync(outDir, { recursive: true })
for (const [id, content] of diagrams) {
  fs.writeFileSync(path.join(outDir, `${id}.svg`), content)
}
console.log(`Wrote ${diagrams.length} generated diagram SVGs to ${path.relative(process.cwd(), outDir)}`)
