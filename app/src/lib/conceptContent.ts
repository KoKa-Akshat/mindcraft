/**
 * Rich concept explanations for each atomic concept node.
 * Used in the practice flow to show a concept card before questions start.
 */

export interface ConceptContent {
  id:       string
  label:    string
  emoji:    string
  tagline:  string
  keyRules: string[]
  tips:     string[]
  watchOut: string[]
  formula?: string
  examples: { problem: string; solution: string }[]
  examWeight?: string
}

export const CONCEPT_CONTENT: Record<string, ConceptContent> = {

  linear_equations: {
    id: 'linear_equations', label: 'Linear Equations', emoji: '📈',
    tagline: 'Variables to the first power only. Goal: isolate the variable.',
    keyRules: [
      'Whatever you do to one side, do to the other.',
      'To clear fractions: multiply every term by the LCD.',
      'Distribute before combining like terms.',
      'Variables on both sides: move all variable terms to one side.',
    ],
    tips: [
      'When fractions appear, multiply through by the LCD immediately — eliminates all denominators in one step.',
      '"No solution" happens when variables cancel and you get a FALSE statement (e.g. 3 = 7).',
      '"Infinite solutions" when variables cancel and you get a TRUE statement (e.g. 0 = 0).',
      'For word problems: define your variable, write the equation, THEN solve. Don\'t skip the setup.',
    ],
    watchOut: ['Don\'t move a term without changing its sign.', 'Don\'t distribute before simplifying what\'s inside the parentheses.'],
    examples: [
      { problem: 'Solve: 3(2x − 4) = 2(x + 6)', solution: '6x − 12 = 2x + 12 → 4x = 24 → x = 6' },
      { problem: 'Solve: x/3 + x/4 = 7', solution: 'Multiply by 12: 4x + 3x = 84 → 7x = 84 → x = 12' },
    ],
    examWeight: '~4–5 ACT questions / always on SAT',
  },

  linear_inequalities: {
    id: 'linear_inequalities', label: 'Linear Inequalities', emoji: '↔️',
    tagline: 'Same as equations — with one critical exception: flip the sign when multiplying or dividing by a negative.',
    keyRules: [
      'Flip the inequality sign when you multiply or divide by a NEGATIVE number.',
      'Compound inequalities: operate on all three parts simultaneously.',
      'Graph on a number line: open circle for < / >, closed circle for ≤ / ≥.',
    ],
    tips: [
      'Treat it exactly like an equation until you multiply/divide by a negative — then flip.',
      'Compound: −3 < 2x + 1 < 7 → subtract 1 from all parts → divide all parts by 2.',
    ],
    watchOut: [
      '⚠️ MOST COMMON MISTAKE: Forgetting to flip the sign when multiplying/dividing by a negative.',
      'With "or" inequalities, the solution is the UNION (both regions).',
    ],
    examples: [
      { problem: 'Solve: −2x + 5 > 11', solution: '−2x > 6 → x < −3  (flip sign when dividing by −2)' },
      { problem: 'Solve: −3 < 2x + 1 < 7', solution: 'Subtract 1: −4 < 2x < 6 → divide by 2: −2 < x < 3' },
    ],
    examWeight: '~2–3 ACT questions',
  },

  absolute_value: {
    id: 'absolute_value', label: 'Absolute Value', emoji: '⚖️',
    tagline: 'Distance from zero. Always isolate |expression| before splitting into cases.',
    keyRules: [
      '|x| = a  means  x = a  OR  x = −a  (when a > 0)',
      '|x| < a  means  −a < x < a  (between)',
      '|x| > a  means  x < −a  OR  x > a  (outside)',
      'Always isolate the absolute value expression FIRST before splitting.',
    ],
    tips: [
      '|x − k| < d means "within distance d of k" — useful for interpreting word problems.',
      'Check both solutions in the original — some may be extraneous.',
    ],
    watchOut: [
      '⚠️ |expression| = NEGATIVE NUMBER has NO solution. Absolute value is never negative.',
      '⚠️ Don\'t split into cases before isolating the absolute value.',
    ],
    examples: [
      { problem: 'Solve: |3x − 7| > 11', solution: '3x − 7 > 11 OR 3x − 7 < −11 → x > 6 OR x < −4/3' },
      { problem: 'Solve: |2x + 1| = 5', solution: '2x + 1 = 5 → x = 2, or 2x + 1 = −5 → x = −3' },
    ],
    examWeight: '~2 ACT questions',
  },

  quadratic_equations: {
    id: 'quadratic_equations', label: 'Quadratic Equations', emoji: '🧮',
    tagline: 'Three methods: factor, quadratic formula, completing the square. Know all three.',
    keyRules: [
      'Factoring: set each factor = 0 (fastest when it factors cleanly).',
      'Quadratic formula: x = [−b ± √(b²−4ac)] / (2a) — always works.',
      'Discriminant b²−4ac: positive → 2 real roots, zero → 1 root, negative → no real roots.',
      'Vertex x-coordinate: x = −b/(2a)',
    ],
    tips: [
      "Vieta's formulas: sum of roots = −b/a, product of roots = c/a. No solving needed.",
      'On ACT, if asked for sum or product of roots, use Vieta\'s — no need to find each root.',
      'Completing the square: take half of b, square it, add and subtract inside.',
    ],
    watchOut: [
      '⚠️ In the quadratic formula, compute b²−4ac carefully. Sign errors here are fatal.',
      '⚠️ x²−9 = (x+3)(x−3), NOT (x−3)². Difference of squares ≠ perfect square.',
    ],
    formula: 'x = [−b ± √(b²−4ac)] / (2a)',
    examples: [
      { problem: 'Find vertex of f(x) = 2x²−8x+3', solution: 'x = −(−8)/(2·2) = 2, f(2) = 8−16+3 = −5. Vertex: (2,−5)' },
      { problem: 'Sum of roots of 3x²−12x+9 = 0?', solution: "Vieta's: sum = −(−12)/3 = 4. Done." },
    ],
    examWeight: '~5 ACT questions / heavily tested on IB SL',
  },

  factoring_polynomials: {
    id: 'factoring_polynomials', label: 'Factoring', emoji: '🔍',
    tagline: 'Factor out GCF first. Then recognize the pattern.',
    keyRules: [
      'GCF first: always factor out the greatest common factor before anything else.',
      'Difference of squares: a²−b² = (a+b)(a−b)',
      'Perfect square: a²+2ab+b² = (a+b)²',
      'Sum of cubes: a³+b³ = (a+b)(a²−ab+b²)',
      'Difference of cubes: a³−b³ = (a−b)(a²+ab+b²)',
    ],
    tips: [
      'For ax²+bx+c with a≠1: use the AC method (multiply a·c, find factors, split middle, group).',
      'On ACT, try factoring before expanding — factored forms cancel beautifully.',
    ],
    watchOut: [
      '⚠️ x²−9 is (x+3)(x−3), NOT (x−3)².',
      '⚠️ Don\'t forget to apply factored-out negatives to ALL terms inside the parentheses.',
    ],
    examples: [
      { problem: 'Factor: x²+5x+6', solution: 'Need two numbers: ×6 and +5 → 2 and 3. Answer: (x+2)(x+3)' },
      { problem: 'Factor: 6x²+7x−3', solution: 'AC = −18. Find −2 and 9: 6x²−2x+9x−3 = 2x(3x−1)+3(3x−1) = (2x+3)(3x−1)' },
    ],
  },

  systems_of_linear_equations: {
    id: 'systems_of_linear_equations', label: 'Systems of Equations', emoji: '⚖️',
    tagline: 'Substitution or elimination. Elimination is almost always faster on ACT.',
    keyRules: [
      'Substitution: solve one eq for one variable, plug into the other. Best when coefficient is 1.',
      'Elimination: add/subtract multiples of equations to cancel a variable.',
      'No solution: parallel lines (same slope, different intercepts) — inconsistent.',
      'Infinite solutions: same line (equations are proportional) — dependent.',
    ],
    tips: [
      'Elimination is almost always faster on the ACT. Add a multiple of one eq to the other.',
      'Check answer by plugging back into BOTH original equations.',
      'For special cases: put both in slope-intercept form and compare slopes.',
    ],
    watchOut: [
      '⚠️ When multiplying an equation to match coefficients, multiply EVERY TERM.',
      '⚠️ Parallel lines (no solution) have the SAME slope. Don\'t confuse with perpendicular.',
    ],
    examples: [
      { problem: 'Solve: 2x+3y=12 and 4x−y=10', solution: 'Multiply 2nd by 3: 12x−3y=30. Add to 1st: 14x=42, x=3. Back-sub: y=2. Solution: (3,2)' },
    ],
    examWeight: '~3 ACT questions',
  },

  functions_basics: {
    id: 'functions_basics', label: 'Functions', emoji: '⚡',
    tagline: 'f(x) is a machine: put x in, get output out. Composition = chain the machines.',
    keyRules: [
      'Domain: all valid inputs (x-values). Range: all possible outputs (y-values).',
      'Composition f(g(x)): evaluate g first, then feed result into f.',
      'Inverse f⁻¹: swap x and y, solve for y.',
      'Vertical line test: a graph is a function if every vertical line hits it at most once.',
    ],
    tips: [
      'For domain restrictions: denominators ≠ 0, square roots ≥ 0, logs > 0.',
      'Horizontal shift: f(x−c) shifts RIGHT by c (counterintuitive — but correct).',
      'Vertical shift: f(x)+c shifts UP by c.',
    ],
    watchOut: [
      '⚠️ f(g(x)) ≠ g(f(x)) in general. Order matters in composition.',
      '⚠️ (−3)² = +9, not −9. Exponent applies to the negative too.',
    ],
    examples: [
      { problem: 'If f(x)=2x+1, g(x)=x−3, find f(g(5))', solution: 'g(5)=2, f(2)=5. Answer: 5' },
      { problem: 'Find inverse of f(x)=3x+5', solution: 'Swap: x=3y+5 → y=(x−5)/3. So f⁻¹(x)=(x−5)/3' },
    ],
  },

  exponent_rules: {
    id: 'exponent_rules', label: 'Exponents', emoji: '🔢',
    tagline: 'Six rules. Memorize all six. They appear constantly.',
    keyRules: [
      'Product: aᵐ·aⁿ = aᵐ⁺ⁿ (same base → add exponents)',
      'Quotient: aᵐ/aⁿ = aᵐ⁻ⁿ (same base → subtract)',
      'Power of power: (aᵐ)ⁿ = aᵐⁿ (multiply exponents)',
      'Zero: a⁰ = 1 (for a ≠ 0)',
      'Negative: a⁻ⁿ = 1/aⁿ (flip to denominator)',
      'Fractional: a^(m/n) = (ⁿ√a)ᵐ (root first, then power)',
    ],
    tips: [
      'To compare expressions with different bases, rewrite everything as a power of a common base.',
      '4^(x+1) = 8^x → rewrite as powers of 2 → 2^(2x+2) = 2^(3x) → solve.',
    ],
    watchOut: [
      '⚠️ (2x)³ = 8x³, not 2x³. The exponent applies to EVERYTHING inside.',
      '⚠️ a⁻¹ = 1/a, NOT −a.',
    ],
    examples: [
      { problem: 'Simplify (27x⁶)^(2/3)', solution: '27^(2/3) = (∛27)² = 3² = 9, x^(6·2/3) = x⁴. Answer: 9x⁴' },
      { problem: 'If 4^(x+1) = 8^x, find x.', solution: '2^(2x+2) = 2^(3x) → 2x+2 = 3x → x = 2' },
    ],
  },

  basic_probability: {
    id: 'basic_probability', label: 'Probability', emoji: '🎲',
    tagline: 'P = favorable / total. Know addition rule, multiplication rule, and complements.',
    keyRules: [
      'P(A) = (# favorable outcomes) / (# total outcomes)',
      'Complement: P(not A) = 1 − P(A)',
      'Addition: P(A or B) = P(A) + P(B) − P(A and B)',
      'Multiplication (independent): P(A and B) = P(A) · P(B)',
      'Conditional: P(A|B) = P(A and B) / P(B)',
    ],
    tips: [
      'Mutually exclusive events: P(A and B) = 0, so P(A or B) = P(A) + P(B).',
      'Without replacement: each draw changes the total count — use conditional probability.',
    ],
    watchOut: [
      '⚠️ P(king OR heart) — don\'t double-count the king of hearts. Subtract the overlap.',
      '⚠️ "At least one" problems: use complement. P(at least one) = 1 − P(none).',
    ],
    examples: [
      { problem: 'Bag: 3 red, 7 blue. Draw 2 without replacement. P(both red)?', solution: '(3/10) × (2/9) = 6/90 = 1/15' },
    ],
    examWeight: '~4 ACT questions',
  },

  polynomials: {
    id: 'polynomials', label: 'Polynomials', emoji: '〽️',
    tagline: 'FOIL to expand, factor to simplify. Remainder theorem shortcuts long division.',
    keyRules: [
      'FOIL: (a+b)(c+d) = ac+ad+bc+bd',
      'Degree: the highest exponent tells you the degree.',
      'Remainder theorem: when dividing f(x) by (x−k), remainder = f(k).',
      'Factor theorem: (x−k) is a factor of f(x) if and only if f(k) = 0.',
    ],
    tips: [
      'On ACT, if you see a complex expression, try factoring before expanding.',
      'To check if (x−2) is a factor of x³−3x²+4: compute f(2) = 8−12+4 = 0 ✓',
    ],
    watchOut: [
      '⚠️ (a+b)² = a²+2ab+b², NOT a²+b².',
      '⚠️ When long-dividing polynomials, include placeholders (0x²) for missing terms.',
    ],
    examples: [
      { problem: 'Expand (2x−3)²', solution: '4x²−12x+9 (use perfect square formula: (a−b)²=a²−2ab+b²)' },
      { problem: 'Is (x−3) a factor of x³−2x²−5x+6?', solution: 'f(3) = 27−18−15+6 = 0 ✓ Yes.' },
    ],
  },

  rational_expressions: {
    id: 'rational_expressions', label: 'Rational Expressions', emoji: '➗',
    tagline: 'Factor completely, cancel common factors, state domain restrictions.',
    keyRules: [
      'Simplify: factor numerator AND denominator, then cancel common FACTORS (not terms).',
      'Multiply: multiply numerators, multiply denominators, then simplify.',
      'Divide: multiply by the reciprocal of the second fraction.',
      'Add/subtract: find LCD, convert each fraction, combine numerators.',
      'Domain: exclude any x that makes any denominator zero.',
    ],
    tips: [
      'State restrictions BEFORE canceling — x=3 is excluded even if (x−3)/(x−3) = 1.',
      'Solving rational equations: multiply both sides by LCD, then check for extraneous solutions.',
    ],
    watchOut: [
      '⚠️ Never cancel TERMS. Only cancel common FACTORS. (x+3)/(x+9) ≠ 3/9.',
      '⚠️ Always check for extraneous solutions when solving rational equations.',
    ],
    examples: [
      { problem: 'Simplify: (x²−9)/(x²+5x+6)', solution: 'Factor: (x+3)(x−3)/((x+2)(x+3)) = (x−3)/(x+2), x≠−3' },
    ],
  },

  descriptive_statistics: {
    id: 'descriptive_statistics', label: 'Descriptive Stats', emoji: '📊',
    tagline: 'Mean, median, mode, range, standard deviation — know what each measures.',
    keyRules: [
      'Mean: sum of all values divided by the count.',
      'Median: middle value when sorted. For even count: average of two middle values.',
      'Mode: most frequently appearing value.',
      'Range: max − min.',
      'Standard deviation: measures spread. Higher SD = more spread out.',
    ],
    tips: [
      'Mean is affected by outliers; median is resistant to outliers.',
      'If all values increase by k: mean and median increase by k, SD stays the same.',
      'If all values multiply by k: mean, median, AND SD all multiply by k.',
    ],
    watchOut: [
      '⚠️ Median for even-numbered sets: average the TWO middle values.',
      '⚠️ Adding a constant shifts center measures but does NOT change SD or range.',
    ],
    examples: [
      { problem: 'Find mean and median of {2, 5, 5, 8, 10}', solution: 'Mean = 30/5 = 6. Median = 5 (middle value).' },
    ],
  },
}

export function getConceptContent(conceptId: string): ConceptContent | null {
  return CONCEPT_CONTENT[conceptId] ?? null
}
