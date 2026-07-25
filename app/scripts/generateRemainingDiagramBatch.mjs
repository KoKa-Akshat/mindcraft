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

function lines(x, y, value, size = 14, anchor = 'middle', fill = '#111', weight = 600, maxChars = 18, gap = 16) {
  const words = String(value).split(/\s+/)
  const out = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxChars && line) {
      out.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) out.push(line)
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" stroke="none">
    ${out.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : gap}">${esc(l)}</tspan>`).join('')}
  </text>`
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

function venn(id, leftLabel, rightLabel, regions) {
  const body = `
    <rect x="25" y="25" width="370" height="210" rx="8" fill="none"/>
    <circle cx="175" cy="132" r="76"/>
    <circle cx="245" cy="132" r="76"/>
    ${lines(145, 44, leftLabel, 12, 'middle', '#111', 600, 20, 14)}
    ${lines(275, 44, rightLabel, 12, 'middle', '#111', 600, 20, 14)}
    ${lines(125, 137, regions.left, 15, 'middle', '#111', 700, 14, 17)}
    ${lines(210, 137, regions.intersection, 15, 'middle', '#111', 700, 13, 17)}
    ${lines(295, 137, regions.right, 15, 'middle', '#111', 700, 14, 17)}
    ${regions.outside ? lines(350, 212, regions.outside, 14, 'middle', '#111', 700, 16, 16) : ''}
  `
  return [id, svg(body)]
}

function sideLabel(x, y, value, anchor = 'middle') {
  return text(x, y, value, 15, anchor, '#111', 700)
}

function vSideLabel(x, y, value) {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#111" stroke="none" transform="rotate(-90 ${x} ${y})">${esc(value)}</text>`
}

function compoundShape(id, labels, kind = 'standard') {
  const left = 110
  const top = 55
  const low = 205
  const right = 315
  const stepX = kind === 'wideTop' ? 230 : 205
  const stepY = kind === 'lowStep' ? 150 : 130
  const body = `
    <path d="M${left} ${top} H${stepX} V${stepY} H${right} V${low} H${left} Z" fill="#f9fbf3"/>
    ${labels.top ? sideLabel((left + stepX) / 2, top - 14, labels.top) : ''}
    ${labels.left ? vSideLabel(left - 28, (top + low) / 2, labels.left) : ''}
    ${labels.innerV ? vSideLabel(stepX - 16, (top + stepY) / 2, labels.innerV) : ''}
    ${labels.innerH ? sideLabel((stepX + right) / 2, stepY - 14, labels.innerH) : ''}
    ${labels.right ? vSideLabel(right + 26, (stepY + low) / 2, labels.right) : ''}
    ${labels.bottom ? sideLabel((left + right) / 2, low + 28, labels.bottom) : ''}
    ${labels.star ? placeholder(left + 45, low - 14, 'star') : ''}
  `
  return [id, svg(body)]
}

function grid(x, y, cols, rows, cell = 18) {
  let body = ''
  for (let c = 0; c <= cols; c++) body += `<line x1="${x + c * cell}" y1="${y}" x2="${x + c * cell}" y2="${y + rows * cell}" stroke="#cfd8d1" stroke-width="1"/>`
  for (let r = 0; r <= rows; r++) body += `<line x1="${x}" y1="${y + r * cell}" x2="${x + cols * cell}" y2="${y + r * cell}" stroke="#cfd8d1" stroke-width="1"/>`
  return body
}

function triangle(points, fill = '#f9fbf3') {
  return `<polygon points="${points}" fill="${fill}"/>`
}

function shapePairGrid(id, kind) {
  let body = ''
  if (kind === 'reflection') {
    body += grid(54, 32, 16, 10)
    body += `<line x1="54" y1="140" x2="342" y2="140" stroke="#111" stroke-width="2.5"/>`
    body += triangle('126,68 198,104 126,104')
    body += triangle('126,212 198,176 126,176', '#eef8ee')
    body += text(346, 146, 'mirror line', 13, 'start', '#111', 600)
  } else if (kind === 'congruent') {
    body += text(105, 45, 'Tom', 15) + triangle('78,142 145,142 100,82')
    body += `<g transform="translate(284 116) rotate(35)"><polygon points="-36,28 36,28 -12,-36" fill="#f9fbf3"/></g>`
    body += text(285, 45, 'same size', 15)
    body += text(105, 224, 'Katie', 15) + triangle('82,198 128,198 96,158')
    body += triangle('248,210 334,210 274,132', '#eef8ee')
  } else if (kind === 'enlargement') {
    body += grid(48, 42, 17, 9)
    body += text(95, 220, 'A', 16) + triangle('82,168 118,168 82,150')
    body += text(265, 220, 'B', 16) + triangle('220,168 328,168 220,114', '#eef8ee')
  } else {
    body += text(105, 45, 'Tom', 15) + `<rect x="78" y="82" width="54" height="54" fill="#f9fbf3"/>`
    body += `<rect x="212" y="64" width="92" height="92" fill="#eef8ee"/>`
    body += text(286, 45, 'Katie', 15) + `<rect x="82" y="174" width="46" height="46" fill="#f9fbf3"/>`
    body += `<rect x="228" y="158" width="78" height="78" fill="#eef8ee"/>`
  }
  return [id, svg(body)]
}

function coneDiagram() {
  const body = `
    <ellipse cx="210" cy="195" rx="72" ry="22"/>
    <path d="M138 195 L210 45 L282 195"/>
    <path d="M210 45 V195" stroke-dasharray="5 5"/>
    <line x1="210" y1="195" x2="282" y2="195"/>
    ${text(198, 123, 'h', 18, 'end')}
    ${text(247, 215, 'r', 18)}
  `
  return ['eedi_1149', svg(body)]
}

function cylinderDiagram() {
  const body = `
    <ellipse cx="210" cy="62" rx="72" ry="24"/>
    <path d="M138 62 V188 M282 62 V188"/>
    <ellipse cx="210" cy="188" rx="72" ry="24"/>
    <line x1="210" y1="188" x2="282" y2="188"/>
    <path d="M300 74 V176" marker-end="url(#arrow)"/>
    ${text(304, 127, '9 cm', 15, 'start')}
    ${text(250, 210, '5 cm', 15)}
    ${text(210, 193, 'F', 18)}
    <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#111" stroke="none"/></marker></defs>
  `
  return ['eedi_1626', svg(body)]
}

function additionPyramid() {
  const body = `
    <rect x="93" y="167" width="78" height="42" fill="#f9fbf3"/>
    <rect x="171" y="167" width="78" height="42" fill="#f9fbf3"/>
    <rect x="249" y="167" width="78" height="42" fill="#f9fbf3"/>
    <rect x="132" y="125" width="78" height="42" fill="#eef8ee"/>
    <rect x="210" y="125" width="78" height="42" fill="#eef8ee"/>
    ${text(132, 193, '2a', 18)}
    ${text(210, 193, '-b', 18)}
    ${text(288, 193, '2a-2b', 16)}
    ${placeholder(171, 146, 'star')}
    ${text(249, 151, '2a-3b', 16)}
  `
  return ['eedi_1660', svg(body)]
}

function triangularPrism() {
  const body = `
    <polygon points="95,168 95,76 170,168" fill="#f9fbf3"/>
    <polygon points="220,142 220,50 295,142" fill="#eef8ee"/>
    <line x1="95" y1="168" x2="220" y2="142"/>
    <line x1="95" y1="76" x2="220" y2="50"/>
    <line x1="170" y1="168" x2="295" y2="142"/>
    <path d="M52 122 H86" marker-end="url(#arrow)"/>
    ${text(46, 126, 'B', 16, 'end')}
    <path d="M318 78 H282" marker-end="url(#arrow)"/>
    ${text(324, 82, 'A', 16, 'start')}
    <path d="M318 170 H282" marker-end="url(#arrow)"/>
    ${text(324, 174, 'D', 16, 'start')}
    <path d="M190 222 V184" marker-end="url(#arrow)"/>
    ${text(190, 240, 'C', 16)}
    <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#111" stroke="none"/></marker></defs>
  `
  return ['eedi_1670', svg(body)]
}

function irregularPolygon(id, kind) {
  if (kind === 'quad') {
    const body = `
      <polygon points="116,62 306,82 260,206 94,176" fill="#f9fbf3"/>
      ${text(134, 94, 's', 17)}
      ${text(276, 108, '2s', 17)}
      ${text(239, 182, '2s', 17)}
      ${text(122, 160, '3s', 17)}
    `
    return [id, svg(body)]
  }
  return [id, svg(`<polygon points="176,45 300,91 277,206 137,220 78,118" fill="#f9fbf3"/>`)]
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
  venn('eedi_53', 'exactly two lines of symmetry', 'rotational symmetry of order 2', { left: 'A', intersection: 'B', right: 'C', outside: 'D' }),
  venn('eedi_276', 'Set P', 'Set Q', { left: 'crisps', intersection: 'sweets', right: 'pizza', outside: 'chocolate' }),
  venn('eedi_736', 'exactly one line of symmetry', 'rotational symmetry of order 3', { left: 'A', intersection: 'B', right: 'C', outside: 'D' }),
  venn('eedi_747', 'Line of symmetry at x = 3', 'y intercept is negative', { left: 'A', intersection: 'B', right: 'C', outside: 'D' }),
  venn('eedi_823', 'Owns a 4x4', 'Owns a Black Car', { left: '27', intersection: '15', right: '8', outside: '' }),
  venn('eedi_848', 'Prime factors of 36', 'Prime factors of 90', { left: '2', intersection: '2, 3, 3', right: '5', outside: '' }),
  venn('eedi_1022', 'Owns a 4x4', 'Owns a Black Car', { left: '27', intersection: '15', right: '8', outside: '' }),
  venn('eedi_1077', 'x+5.3 is less than or equal to 0', '-(5.3+x)/2 is greater than 0', { left: 'A', intersection: 'B', right: 'C', outside: 'D' }),
  compoundShape('eedi_102', { top: 'p cm', left: '15 cm', innerH: '7 cm', right: '7 cm', bottom: '12 cm' }),
  compoundShape('eedi_320', { top: '10 cm', left: '7 cm', innerH: '4 cm', right: '3 cm' }, 'wideTop'),
  compoundShape('eedi_726', { left: '15 cm', innerH: '7 cm', right: '7 cm', bottom: '12 cm' }),
  compoundShape('eedi_871', { top: '5 m', left: '10 m', right: '6 m', bottom: '9 m' }, 'wideTop'),
  compoundShape('eedi_1230', { top: 'p cm', left: '10 cm', innerH: '7 cm', right: '3 cm', bottom: '4 cm' }),
  compoundShape('eedi_1521', { top: '3x+4', left: '5', innerH: 'x+4', right: '3', star: true }, 'wideTop'),
  compoundShape('eedi_1726', { top: '3x+4', left: '5', innerH: '2x', right: '2', star: true }, 'wideTop'),
  compoundShape('eedi_1862', { top: '12 m', left: '6 m', innerH: '8 m', right: '4 m' }, 'wideTop'),
  shapePairGrid('eedi_543', 'reflection'),
  shapePairGrid('eedi_843', 'congruent'),
  shapePairGrid('eedi_1705', 'enlargement'),
  shapePairGrid('eedi_1867', 'similarSquares'),
  coneDiagram(),
  cylinderDiagram(),
  additionPyramid(),
  triangularPrism(),
  irregularPolygon('eedi_589', 'quad'),
  irregularPolygon('eedi_785', 'pentagon'),
]

fs.mkdirSync(outDir, { recursive: true })
for (const [id, content] of diagrams) {
  fs.writeFileSync(path.join(outDir, `${id}.svg`), content.replace(/[ \t]+$/gm, ''))
}
console.log(`Wrote ${diagrams.length} generated diagram SVGs to ${path.relative(process.cwd(), outDir)}`)
