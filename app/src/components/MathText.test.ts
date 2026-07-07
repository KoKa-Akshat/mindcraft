/**
 * MathText runtime verification — real strings from the live question banks.
 *
 * Two invariants:
 *  1. Genuine TeX (generated questions per contract C5, transcribe-scratch
 *     output) renders through KaTeX in every delimiter form MathText supports.
 *  2. Currency prose from the real banks (Eedi, actMaster) must NEVER be
 *     mangled into math — including "$35.19. ... tip?$" spanning pairs that
 *     look like a delimited expression to the regex.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import MathText from './MathText'

function render(text: string): string {
  return renderToString(createElement(MathText, { text }))
}

beforeAll(async () => {
  // MathText lazy-loads KaTeX; wait until a probe expression renders.
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (render('$x^2$').includes('katex')) return
    await new Promise(r => setTimeout(r, 50))
  }
  throw new Error('KaTeX never became available')
})

describe('TeX renders as math', () => {
  it.each([
    ['inline dollar', 'Simplify $\\frac{2}{3} + \\frac{1}{6}$ fully.'],
    ['inline paren', 'Use \\(a^2 + b^2 = c^2\\) here.'],
    ['block dollar', '$$\\frac{a}{b} = \\frac{c}{d}$$'],
    ['block bracket', '\\[x = \\sqrt{16}\\]'],
    ['transcription output shape', '$2x + 4 = 10$\n$x = 3$'],
  ])('%s', (_name, text) => {
    expect(render(text)).toContain('katex')
  })

  it('renders a reingested Eedi factorise question while preserving prose', () => {
    const html = render('Factorise this expression, if possible:\n\\(p^{2}-99p\\)')
    expect(html).toContain('Factorise this expression, if possible:')
    expect(html).toContain('katex')
  })
})

describe('real bank currency prose stays prose', () => {
  it.each([
    [
      'eedi theme park',
      'A theme park charges $ 8 entry fee and then $ 3 for every ride you go on.\nHeena goes on 5 rides.\nHow much does she pay in total?',
    ],
    [
      'eedi call-out fee',
      'Sally the electrician charges a call-out fee of $ 40 and then $ 15 per hour that the job takes.',
    ],
    [
      'actMaster spanning pair',
      'The dinner total with tip came to $35.19. How much did the meal cost without the tip?$',
    ],
    ['actMaster salary', 'He earns $3,200 per month as a teacher for the ten months from September to June.'],
    ['single-dollar choice', '$24'],
  ])('%s', (_name, text) => {
    const html = render(text)
    expect(html).not.toContain('katex')
  })

  it('keeps the currency text intact', () => {
    expect(render('$24')).toContain('$24')
    expect(render('a call-out fee of $ 40 and then $ 15 per hour')).toContain('$ 40')
  })
})

describe('unicode math from the static bank passes through', () => {
  it('renders unchanged without KaTeX', () => {
    const text = 'A fractional exponent 1/2 means square root: √(4/9) = √4/√9 = 2/3.'
    const html = render(text)
    expect(html).not.toContain('katex')
    expect(html).toContain('√4/√9')
  })
})
