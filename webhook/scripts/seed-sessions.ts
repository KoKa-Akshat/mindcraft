/**
 * api/seed-sessions.ts
 *
 * Seeds 10 dummy published session summaries for a student email.
 * POST { email: string, secret: string }
 *
 * Sessions cover: Logarithms (x2), Exponents (x2), Algebra (x2),
 * Calculus 1 (x2), Piano (unrelated), Entrepreneurship (unrelated)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/firebase'
import { setCors } from '../lib/cors'

const SEED_SECRET = 'mindcraft-seed-2026'

const SESSIONS = [
  {
    subject:   'Math',
    tutorName: 'Alex Chen',
    daysAgo:   30,
    summary: {
      title:    'Introduction to Logarithms',
      duration: '55 min',
      bullets: [
        'Logarithm definition: log_b(x) = y means b^y = x',
        'Common log (base 10) and natural log (base e = 2.718)',
        'Converting freely between exponential and logarithmic form',
        'Key values: log(1) = 0, log(b) = 1 for any base b',
        'Graphing y = log_b(x): domain x > 0, vertical asymptote at x = 0',
      ],
    },
  },
  {
    subject:   'Math',
    tutorName: 'Alex Chen',
    daysAgo:   22,
    summary: {
      title:    'Logarithm Properties and Solving Log Equations',
      duration: '60 min',
      bullets: [
        'Product rule: log(MN) = log(M) + log(N)',
        'Quotient rule: log(M/N) = log(M) − log(N)',
        'Power rule: log(M^p) = p · log(M)',
        'Change of base formula: log_b(x) = ln(x) / ln(b)',
        'Solving equations: isolate the log, then exponentiate both sides',
        'Checked: extraneous solutions occur when argument becomes negative',
      ],
    },
  },
  {
    subject:   'Math',
    tutorName: 'Alex Chen',
    daysAgo:   45,
    summary: {
      title:    'Exponent Rules and Laws of Powers',
      duration: '50 min',
      bullets: [
        'Product of powers: a^m · a^n = a^(m+n)',
        'Quotient of powers: a^m / a^n = a^(m−n)',
        'Power of a power: (a^m)^n = a^(mn)',
        'Negative exponents: a^(−n) = 1/a^n',
        'Zero exponent: a^0 = 1 for all a ≠ 0',
        'Exponents and logarithms are inverse operations — key relationship',
      ],
    },
  },
  {
    subject:   'Math',
    tutorName: 'Alex Chen',
    daysAgo:   38,
    summary: {
      title:    'Exponential Functions and Growth/Decay',
      duration: '55 min',
      bullets: [
        'Exponential function f(x) = a^x: always positive, passes through (0,1)',
        'Natural exponential e^x: derivative equals itself — d/dx(e^x) = e^x',
        'Exponential growth: P(t) = P₀ · e^(rt) for continuous growth rate r',
        'Exponential decay: same formula with r < 0 (half-life problems)',
        'Compound interest: A = P(1 + r/n)^(nt) → continuous limit is Pe^(rt)',
        'Connecting back to logarithms: ln(e^x) = x and e^(ln x) = x',
      ],
    },
  },
  {
    subject:   'Math',
    tutorName: 'Sarah Kim',
    daysAgo:   60,
    summary: {
      title:    'Algebra — Linear Equations and Systems',
      duration: '45 min',
      bullets: [
        'Slope-intercept form: y = mx + b; slope m = rise/run',
        'Point-slope form: y − y₁ = m(x − x₁)',
        'Systems of equations: substitution and elimination methods',
        'No solution (parallel lines) vs. infinite solutions (same line)',
        'Real-world modeling: cost = fixed + variable × quantity',
      ],
    },
  },
  {
    subject:   'Math',
    tutorName: 'Sarah Kim',
    daysAgo:   52,
    summary: {
      title:    'Quadratic Equations and Factoring',
      duration: '60 min',
      bullets: [
        'Standard form: ax² + bx + c = 0',
        'Factoring method: find two numbers that multiply to ac and add to b',
        'Quadratic formula: x = (−b ± √(b²−4ac)) / 2a',
        'Discriminant b²−4ac: positive → 2 real roots, zero → 1 root, negative → complex',
        'Vertex form: a(x−h)² + k; vertex at (h, k)',
        'Parabola opens up if a > 0, down if a < 0',
      ],
    },
  },
  {
    subject:   'Math',
    tutorName: 'Sarah Kim',
    daysAgo:   15,
    summary: {
      title:    'Calculus 1 — Limits and Continuity',
      duration: '65 min',
      bullets: [
        'Intuitive limit: lim_{x→a} f(x) = L means f approaches L as x → a',
        'One-sided limits: left-hand lim_{x→a⁻} and right-hand lim_{x→a⁺}',
        "L'Hôpital's Rule: if 0/0 or ∞/∞, differentiate top and bottom",
        'Continuity at a: f(a) exists, limit exists, and they are equal',
        'Intermediate Value Theorem: continuous function hits every value between f(a) and f(b)',
      ],
    },
  },
  {
    subject:   'Math',
    tutorName: 'Sarah Kim',
    daysAgo:   8,
    summary: {
      title:    'Calculus 1 — Introduction to Derivatives',
      duration: '70 min',
      bullets: [
        'Derivative definition: f\'(x) = lim_{h→0} [f(x+h) − f(x)] / h',
        'Power rule: d/dx(xⁿ) = n·xⁿ⁻¹',
        'Sum/difference rule: derivative distributes over addition',
        'Product rule: (fg)\' = f\'g + fg\'',
        'Chain rule: d/dx[f(g(x))] = f\'(g(x)) · g\'(x)',
        'Geometric meaning: derivative = slope of tangent line at a point',
      ],
    },
  },
  // ── UNRELATED — should NOT appear in logs/math graph ──────────────────────
  {
    subject:   'Piano',
    tutorName: 'Maria Santos',
    daysAgo:   90,
    summary: {
      title:    'Piano — Major Scales and Chord Progressions',
      duration: '45 min',
      bullets: [
        'Major scale formula: W-W-H-W-W-W-H (whole and half steps)',
        'C major scale: all white keys, no sharps or flats',
        'Triads: root, major third, perfect fifth',
        'I–IV–V–I progression: the foundation of Western harmony',
        'Practice hands separately before combining',
      ],
    },
  },
  {
    subject:   'Entrepreneurship',
    tutorName: 'Jordan Lee',
    daysAgo:   75,
    summary: {
      title:    'Business Model Canvas and Market Research',
      duration: '50 min',
      bullets: [
        'Business Model Canvas: 9 building blocks from value prop to revenue streams',
        'Customer segments: who are you solving for? Be specific.',
        'Value proposition: what pain do you eliminate or what gain do you create?',
        'Channels: how does your product reach customers?',
        'Conducting customer discovery interviews — never ask leading questions',
      ],
    },
  },
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { email, secret } = req.body as { email: string; secret: string }
  if (secret !== SEED_SECRET) return res.status(401).json({ error: 'Unauthorized' })
  if (!email) return res.status(400).json({ error: 'email required' })

  // Look up student by email
  const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get()
  const studentId = usersSnap.empty ? null : usersSnap.docs[0].id

  const now = Date.now()
  const created: string[] = []

  for (const sess of SESSIONS) {
    const scheduledAt = now - sess.daysAgo * 24 * 60 * 60 * 1000
    const dateStr = new Date(scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    const ref = db.collection('sessions').doc()
    await ref.set({
      studentEmail: email,
      studentId:    studentId ?? null,
      tutorName:    sess.tutorName,
      tutorId:      null,
      subject:      sess.subject,
      scheduledAt,
      status:       'completed',
      summary: {
        title:     sess.summary.title,
        bullets:   sess.summary.bullets,
        date:      dateStr,
        duration:  sess.summary.duration,
        published: true,
      },
    })
    created.push(ref.id)
  }

  // Update lastSession in user doc (most recent math session)
  if (studentId) {
    const recent = SESSIONS[7]  // Calculus 1 derivatives — most recent math
    const scheduledAt = now - recent.daysAgo * 24 * 60 * 60 * 1000
    await db.collection('users').doc(studentId).update({
      lastSession: {
        id:          created[7],
        subject:     recent.subject,
        tutorName:   recent.tutorName,
        date:        new Date(scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        duration:    recent.summary.duration,
        title:       recent.summary.title,
        bullets:     recent.summary.bullets,
        scheduledAt,
      },
    })
  }

  return res.json({ ok: true, created, studentId, count: created.length })
}
