/**
 * Rich concept explanations for each atomic concept node.
 * Used in the practice flow to show a concept card before questions start.
 */
import { canonicalConceptId } from './conceptAliases'

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
    tagline: 'Same as equations, with one critical exception: flip the sign when multiplying or dividing by a negative.',
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

  word_problems: {
    id: 'word_problems', label: 'Word Problems', emoji: '🧩',
    tagline: 'Translate the story into equations before touching the answer choices.',
    keyRules: [
      'Define the variable first: write exactly what x represents.',
      'Turn totals into equations: part + part = total.',
      'Use rate × time = distance and price × quantity = revenue.',
      'For two unknowns, express one in terms of the other when a total is given.',
      'Check units: dollars, hours, miles, and items should not get mixed.',
    ],
    tips: [
      'Underline what the question actually asks for before solving.',
      'If answer choices are numeric, back-solve only after you know the setup.',
      'For mixture, ticket, and item-count problems, combine a count equation with a value equation.',
      'When a problem says "more than" or "less than," place the comparison carefully.',
    ],
    watchOut: [
      'ACT trap: solving for the smaller group when the question asks for the larger group.',
      'ACT trap: charging every item/text/mile when only the extra amount is charged.',
      'ACT trap: using perimeter when the final question asks for area.',
    ],
    formula: 'distance = rate × time; total value = unit value × quantity',
    examples: [
      { problem: '37 items cost $344. Mugs are $11, candles are $8. How many mugs?', solution: 'Let m = mugs. 11m + 8(37−m) = 344 → 3m = 48 → m = 16.' },
      { problem: 'A ride costs $6 plus $2 per mile. Cost for 9 miles?', solution: '6 + 2(9) = 24.' },
    ],
    examWeight: '~5–7 ACT questions, often blended with algebra',
  },

  percent_ratio: {
    id: 'percent_ratio', label: 'Percents & Ratios', emoji: '%',
    tagline: 'Percents are multipliers; ratios are scaled parts of the same whole.',
    keyRules: [
      'p% means p/100, so 15% = 0.15.',
      'Percent increase: new = original × (1 + rate).',
      'Percent decrease: new = original × (1 − rate).',
      'Ratios scale by multiplying every part by the same factor.',
      'Part-to-part ratios must be converted to total parts when the total is given.',
    ],
    tips: [
      'For successive discounts, multiply the remaining percents; do not add the discounts.',
      'For "percent greater than," use 1 + percent as a decimal.',
      'When two ratios share a variable, scale them until the shared part matches.',
      'Write ratio labels over every part to avoid swapping numerator and denominator.',
    ],
    watchOut: [
      'ACT trap: a 20% discount followed by 10% off is not a 30% discount.',
      'ACT trap: "25% greater than x" means 1.25x, not 0.25x.',
      'ACT trap: using one ratio part as the whole when total parts should be added first.',
    ],
    formula: 'new = original × (1 ± rate); part = total × part ratio / total ratio parts',
    examples: [
      { problem: 'A $120 item is 10% off, then 20% off.', solution: '120 × 0.90 × 0.80 = 86.40.' },
      { problem: 'Juniors:seniors = 4:7 and total is 88.', solution: '11 parts = 88, so 1 part = 8. Seniors = 7×8 = 56.' },
    ],
    examWeight: '~4–6 ACT questions / common SAT calculator questions',
  },

  number_properties: {
    id: 'number_properties', label: 'Number Properties', emoji: '#️⃣',
    tagline: 'Odd/even, primes, factors, multiples, and divisibility patterns.',
    keyRules: [
      'Prime numbers have exactly two positive factors: 1 and themselves.',
      'Even ± even = even; odd ± odd = even; odd ± even = odd.',
      'Odd × odd = odd; any product with an even factor is even.',
      'GCF uses shared prime factors; LCM uses the highest needed prime powers.',
      'Among any n consecutive integers, one is divisible by n.',
    ],
    tips: [
      'Test odd/even claims with small values like 1, 2, 3, and 4.',
      'Use prime factorization for must-be-true divisibility questions.',
      'For consecutive integer sums, the average is the middle value.',
      'A counterexample is enough to eliminate an "always true" choice.',
    ],
    watchOut: [
      'ACT trap: treating 1 as prime. It is neither prime nor composite.',
      'ACT trap: assuming n² divisible by 12 means n divisible by 12; n = 6 disproves it.',
      'ACT trap: forgetting that negative integers can be even, odd, prime-related, or factors in different ways.',
    ],
    examples: [
      { problem: 'LCM of 12 and 18?', solution: '12 = 2²·3, 18 = 2·3², so LCM = 2²·3² = 36.' },
      { problem: 'Product of 3 consecutive integers is always divisible by?', solution: 'One is even and one is divisible by 3, so the product is divisible by 6.' },
    ],
    examWeight: '~2–4 ACT questions / frequent SAT no-calculator logic',
  },

  function_transformations: {
    id: 'function_transformations', label: 'Function Transformations', emoji: '🔁',
    tagline: 'Inside changes move x; outside changes move or scale y.',
    keyRules: [
      'f(x) + k shifts up k; f(x) − k shifts down k.',
      'f(x − h) shifts right h; f(x + h) shifts left h.',
      '−f(x) reflects across the x-axis; f(−x) reflects across the y-axis.',
      'a·f(x) vertically stretches by |a| when |a| > 1 and compresses when 0 < |a| < 1.',
      'Transform points by matching the inside input, then applying the outside output change.',
    ],
    tips: [
      'Separate transformations into inside-the-parentheses and outside-the-function.',
      'Horizontal shifts look backwards because x must compensate inside the input.',
      'For transformed points, solve the inside expression equal to the original x-value.',
      'Apply vertical stretch/reflection before vertical shift when transforming y-values.',
    ],
    watchOut: [
      'ACT trap: f(x−3) moves right 3, not left 3.',
      'ACT trap: −f(x) and f(−x) are different reflections.',
      'ACT trap: transforming only the graph shape but forgetting to transform the vertex or listed point.',
    ],
    formula: 'g(x) = a·f(x − h) + k moves points by x → x+h and y → ay+k',
    examples: [
      { problem: 'Point (−1,4) on f. Find point on −2f(x+3)+1.', solution: 'x+3 = −1 → x = −4; y = −2(4)+1 = −7. New point: (−4,−7).' },
      { problem: 'Transform y = |x| to y = −|x−4|+6.', solution: 'Right 4, reflect over x-axis, up 6.' },
    ],
    examWeight: '~2–3 ACT questions / core SAT functions skill',
  },

  area_volume: {
    id: 'area_volume', label: 'Area & Volume', emoji: '▣',
    tagline: 'Know your formulas cold. The ACT provides none of them.',
    keyRules: [
      'Rectangle: A = lw. Triangle: A = ½bh. Circle: A = πr², C = 2πr.',
      'Trapezoid: A = ½(b₁+b₂)h. Parallelogram: A = bh.',
      'Rectangular prism: V = lwh. Cylinder: V = πr²h. Cone: V = ⅓πr²h.',
      'Sphere: V = 4/3 πr³. Pyramid: V = ⅓Bh (B = base area).',
      'When a shape is "inside" another, subtract areas.',
    ],
    tips: [
      'Draw and label before computing — label every dimension you know.',
      'Check whether the question gives diameter or radius (r = d/2).',
      'Composite shapes: break them into rectangles, triangles, semicircles.',
      'Units matter: area answers are units², volume answers are units³.',
    ],
    watchOut: [
      'ACT trap: using diameter instead of radius in circle formulas.',
      'ACT trap: forgetting the ½ in triangle area.',
      'ACT trap: confusing perimeter (border length) with area (interior).',
    ],
    formula: 'A_circle = πr² | V_cylinder = πr²h | V_cone = ⅓πr²h',
    examples: [
      { problem: 'A circle has diameter 10. What is its area?', solution: 'r = 5, A = π(5²) = 25π ≈ 78.5' },
      { problem: 'A rectangular box is 4×3×6. What is the volume?', solution: 'V = 4×3×6 = 72 cubic units' },
    ],
    examWeight: '~4–6 ACT questions; appears in nearly every test',
  },

  coordinate_geometry: {
    id: 'coordinate_geometry', label: 'Coordinate Geometry', emoji: '🗺️',
    tagline: 'Slope and distance are the two workhorses of the coordinate plane.',
    keyRules: [
      'Slope: m = (y₂−y₁)/(x₂−x₁). Positive = rises, negative = falls.',
      'Distance: d = √((x₂−x₁)²+(y₂−y₁)²).',
      'Midpoint: ((x₁+x₂)/2, (y₁+y₂)/2).',
      'Parallel lines: same slope. Perpendicular lines: slopes are negative reciprocals (m₁×m₂ = −1).',
      'y = mx + b: m is slope, b is the y-intercept.',
    ],
    tips: [
      'To find x-intercept: set y = 0 and solve.',
      'To find y-intercept: set x = 0 and solve.',
      'Verify your slope sign by visual check — if the line goes up-right, slope > 0.',
      'Midpoint is the average — intuitive sanity check.',
    ],
    watchOut: [
      'ACT trap: flipping Δy and Δx in slope formula.',
      'ACT trap: forgetting to square both differences under the radical in distance.',
      'ACT trap: writing x-intercept when asked for y-intercept.',
    ],
    formula: 'm = (y₂−y₁)/(x₂−x₁) | d = √(Δx²+Δy²) | mid = ((x₁+x₂)/2,(y₁+y₂)/2)',
    examples: [
      { problem: 'Slope of line through (1,2) and (3,8)?', solution: 'm = (8−2)/(3−1) = 6/2 = 3' },
      { problem: 'Midpoint of (0,4) and (6,−2)?', solution: '((0+6)/2, (4+(−2))/2) = (3, 1)' },
    ],
    examWeight: '~4–6 ACT questions; key for graph reading too',
  },

  trigonometry_basics: {
    id: 'trigonometry_basics', label: 'Trigonometry', emoji: '📐',
    tagline: 'SOH-CAH-TOA is your best friend, so memorize it cold.',
    keyRules: [
      'sin θ = opposite/hypotenuse | cos θ = adjacent/hypotenuse | tan θ = opposite/adjacent.',
      'Special triangles: 30-60-90 (sides 1:√3:2) and 45-45-90 (sides 1:1:√2).',
      'sin²θ + cos²θ = 1 (Pythagorean identity).',
      'To find an angle, use inverse trig: θ = sin⁻¹(opp/hyp).',
      'Unit circle: 0°→(1,0), 90°→(0,1), 180°→(−1,0), 270°→(0,−1).',
    ],
    tips: [
      'Always identify which angle is θ, then label opposite and adjacent from that angle.',
      'For word problems, draw the right triangle first.',
      'ACT rarely asks for exact unit-circle values — SOH-CAH-TOA covers ~90% of trig questions.',
    ],
    watchOut: [
      'ACT trap: mixing up which side is opposite vs adjacent (it depends on which angle).',
      'ACT trap: using sin where cos is needed because you labeled sides from the wrong angle.',
      'ACT trap: forgetting that the hypotenuse is always opposite the right angle.',
    ],
    formula: 'sin = opp/hyp | cos = adj/hyp | tan = opp/adj | sin²+cos²=1',
    examples: [
      { problem: 'In a right triangle, opposite=3, hypotenuse=5. Find sin θ.', solution: 'sin θ = 3/5 = 0.6' },
      { problem: '30-60-90 triangle, hypotenuse = 10. Side opposite 30°?', solution: 'Side = 10×(1/2) = 5' },
    ],
    examWeight: '~3–4 ACT questions; tested every test',
  },

  lines_angles: {
    id: 'lines_angles', label: 'Lines & Angles', emoji: '∠',
    tagline: 'Parallel lines cut by a transversal create eight angles, but only two distinct measures.',
    keyRules: [
      'Supplementary angles: sum = 180°. Complementary angles: sum = 90°.',
      'Vertical angles are equal.',
      'When parallel lines are cut by a transversal: corresponding angles are equal, alternate interior angles are equal.',
      'Co-interior (same-side interior) angles are supplementary.',
      'Angles in a triangle sum to 180°. Exterior angle = sum of the two non-adjacent interior angles.',
    ],
    tips: [
      'Mark all known angle measures directly on the diagram.',
      'If the figure says lines are parallel, immediately mark all equal angle pairs.',
      'Look for vertical angles first — they give you a free measurement.',
    ],
    watchOut: [
      'ACT trap: assuming lines are parallel when the problem does not state it.',
      'ACT trap: confusing corresponding and alternate angles (one is same-side, one is opposite-side).',
      'ACT trap: thinking supplementary means equal — it means they sum to 180°.',
    ],
    formula: 'Supp: a+b=180 | Comp: a+b=90 | Triangle: a+b+c=180',
    examples: [
      { problem: 'Two angles are supplementary. One is 73°. What is the other?', solution: '180−73 = 107°' },
      { problem: 'Parallel lines cut by transversal; one angle is 55°. Find the alternate interior angle.', solution: '55° (equal by alternate interior angle theorem)' },
    ],
    examWeight: '~3–5 ACT questions; usually as part of geometry figures',
  },

  circles_geometry: {
    id: 'circles_geometry', label: 'Circles', emoji: '○',
    tagline: 'All circle questions come back to the radius and the central angle.',
    keyRules: [
      'Area = πr². Circumference = 2πr. Diameter d = 2r.',
      'Arc length = (θ/360°)×2πr. Sector area = (θ/360°)×πr².',
      'Inscribed angle = ½ × central angle subtending the same arc.',
      'Tangent line is perpendicular to the radius at the point of tangency.',
      'A chord through the center is a diameter — the longest chord.',
    ],
    tips: [
      'Central angle = arc degree measure (they match).',
      'To find arc length, you need both radius AND central angle.',
      'An inscribed angle in a semicircle (diameter as side) is always 90°.',
    ],
    watchOut: [
      'ACT trap: using diameter where radius is needed.',
      'ACT trap: forgetting the ½ multiplier for inscribed angles.',
      'ACT trap: confusing arc length (distance) with arc measure (angle).',
    ],
    formula: 'A=πr² | C=2πr | Arc=(θ/360)×2πr | Sector=(θ/360)×πr²',
    examples: [
      { problem: 'Circle with r=6, central angle 60°. Arc length?', solution: '(60/360)×2π×6 = (1/6)×12π = 2π' },
      { problem: 'Inscribed angle is 35°. What is the central angle for same arc?', solution: 'Central angle = 2×35 = 70°' },
    ],
    examWeight: '~3–4 ACT questions; often combined with area/arc questions',
  },

  measurement_units: {
    id: 'measurement_units', label: 'Measurement & Units', emoji: '📏',
    tagline: 'Unit conversion is always multiplication or division: set up the fraction so units cancel.',
    keyRules: [
      'Conversion factor: multiply by (new unit / old unit) = 1.',
      '1 mile = 5280 ft. 1 ft = 12 in. 1 kg = 1000 g. 1 hour = 60 min = 3600 sec.',
      'Rate × Time = Distance. Work Rate × Time = Work Done.',
      'For area conversions: square the linear conversion factor (1 ft² = 144 in²).',
      'For volume conversions: cube the linear factor (1 ft³ = 1728 in³).',
    ],
    tips: [
      'Set up the conversion as a fraction so the old unit cancels on top and bottom.',
      'For speed/rate: check that the units of the answer match what the question asks.',
      'Draw a quick unit-analysis line to track what cancels.',
    ],
    watchOut: [
      'ACT trap: forgetting to square/cube the conversion factor for area/volume problems.',
      'ACT trap: mixing hours and minutes in rate problems.',
      'ACT trap: doing a rate problem with wrong unit (answer in mph but calculated in km/h).',
    ],
    formula: 'Rate × Time = Distance | Unit conversion: multiply by conversion fraction',
    examples: [
      { problem: '72 inches = ? feet', solution: '72 × (1 ft / 12 in) = 6 ft' },
      { problem: 'Car travels 60 mph for 2.5 hours. How far?', solution: '60 × 2.5 = 150 miles' },
    ],
    examWeight: '~2–3 ACT questions; often embedded in word problems',
  },

  right_triangle_geometry: {
    id: 'right_triangle_geometry', label: 'Right Triangles', emoji: '◢',
    tagline: 'Pythagorean theorem + special triangles solve almost every right triangle question.',
    keyRules: [
      'Pythagorean theorem: a² + b² = c² (c = hypotenuse, always the longest side).',
      'Common Pythagorean triples: 3-4-5, 5-12-13, 8-15-17 (and multiples of these).',
      '30-60-90 triangle: sides are x, x√3, 2x opposite to 30°, 60°, 90°.',
      '45-45-90 triangle: sides are x, x, x√2.',
      'Area of a right triangle = ½ × leg₁ × leg₂.',
    ],
    tips: [
      'Check for Pythagorean triple before doing full Pythagorean theorem algebra.',
      'For 30-60-90: the shortest side is opposite 30°, the longest is the hypotenuse.',
      'For 45-45-90: hypotenuse = leg × √2 (both legs are equal).',
    ],
    watchOut: [
      'ACT trap: plugging legs into a²+b²=c² then solving for a leg rather than the hypotenuse.',
      'ACT trap: assuming all right triangles are special triangles.',
      'ACT trap: forgetting to take the square root at the end of the Pythagorean theorem.',
    ],
    formula: 'a²+b²=c² | 3-4-5, 5-12-13 triples | 30-60-90: x,x√3,2x | 45-45-90: x,x,x√2',
    examples: [
      { problem: 'Right triangle legs 6 and 8. Hypotenuse?', solution: 'c² = 36+64 = 100, c = 10. (Triple: 3-4-5 scaled by 2)' },
      { problem: '45-45-90 triangle, legs = 5. Hypotenuse?', solution: 'h = 5√2' },
    ],
    examWeight: '~3–4 ACT questions; overlaps with trig and area',
  },

  logarithmic_functions: {
    id: 'logarithmic_functions', label: 'Logarithms', emoji: 'log',
    tagline: 'log_b(x) = y means b^y = x, and that one conversion unlocks everything.',
    keyRules: [
      'log_b(x) = y ↔ b^y = x. Switch freely between log and exponential form.',
      'log(xy) = log x + log y. log(x/y) = log x − log y. log(xⁿ) = n·log x.',
      'log_b(b) = 1. log_b(1) = 0.',
      'Natural log: ln(x) = log_e(x). ln(e) = 1.',
      'Change of base: log_b(x) = log(x)/log(b).',
    ],
    tips: [
      'To solve log₂(x) = 5, rewrite as 2⁵ = x → x = 32.',
      'When stuck: convert log form to exponential form (or vice versa).',
      'Product rule runs forward and backward: split a log of a product or combine a sum of logs.',
    ],
    watchOut: [
      'ACT trap: thinking log(x+y) = log(x) + log(y) — that is WRONG.',
      'ACT trap: confusing log(xy) with log(x)·log(y).',
      'ACT trap: forgetting that the base in log₂ must stay consistent in the rules.',
    ],
    formula: 'log_b(x)=y ↔ b^y=x | log(xy)=log x+log y | log(xⁿ)=n·log x',
    examples: [
      { problem: 'log₂(32) = ?', solution: '2^? = 32 = 2⁵, so answer = 5' },
      { problem: 'log(100) + log(10) = ?', solution: 'log(1000) = 3 (since 10³=1000)' },
    ],
    examWeight: '~1–2 ACT questions; appears more often on IB/AP',
  },

  algebraic_manipulation: {
    id: 'algebraic_manipulation', label: 'Algebraic Manipulation', emoji: '🔧',
    tagline: 'Every algebra step is one of three moves: add/subtract, multiply/divide, or substitute.',
    keyRules: [
      'Isolate the variable by performing inverse operations on both sides.',
      'For literal equations: treat every other letter as a constant, solve for the target variable.',
      'Factoring shortcut for expressions: look for common factors first, then special patterns.',
      'When given a specific value, substitute FIRST, then simplify.',
      'Clearing fractions: multiply every term by the LCD.',
    ],
    tips: [
      'Speed strategy: if asked which expression equals a given value, compute numerically first.',
      'Simplify before expanding when possible — fewer arithmetic errors.',
      'Literal equation = isolate one variable using the same algebra rules as usual.',
    ],
    watchOut: [
      'ACT trap: distributing a negative incorrectly — watch every sign when expanding.',
      'ACT trap: dividing both sides by a variable without checking it could be zero.',
      'ACT trap: stopping one step early — always check the question asks for x, not 2x+1.',
    ],
    formula: 'Literal equation: isolate target var using inverse ops | Substitute then simplify',
    examples: [
      { problem: 'If pq − 3r = 2, solve for q.', solution: 'pq = 2+3r → q = (2+3r)/p' },
      { problem: '(n−3)² when n=11', solution: '(11−3)² = 8² = 64' },
    ],
    examWeight: '~6–8 ACT questions; the most common non-word algebra form',
  },

  fractions_decimals: {
    id: 'fractions_decimals', label: 'Fractions & Decimals', emoji: '½',
    tagline: 'Move freely between fractions, decimals, and percents. Same amount, different clothes.',
    keyRules: [
      'Percent → decimal: divide by 100 (803% → 8.03). Decimal → percent: multiply by 100.',
      'Fraction → decimal: divide numerator by denominator.',
      'To compare fractions: cross-multiply, or convert both to decimals.',
      'a/b + c/d needs a common denominator. a/b × c/d = (a×c)/(b×d).',
      'Dividing by a fraction: multiply by its reciprocal (keep-change-flip).',
    ],
    tips: [
      'Write messy percents as decimals first, then compare or compute.',
      'Benchmark fractions (1/2, 1/3, 1/4, 1/5) make estimation fast.',
      'On ACT, answer choices often mix forms. Convert everything to one form.',
    ],
    watchOut: [
      'ACT trap: 803% is 8.03, not 0.803.',
      'ACT trap: dividing decimals without lining up place value.',
      'ACT trap: flipping the wrong fraction when dividing.',
    ],
    formula: '% ÷ 100 = decimal | a/b ÷ c/d = a/b × d/c | common denominator for +/−',
    examples: [
      { problem: 'Write 803% as a decimal.', solution: '803 ÷ 100 = 8.03' },
      { problem: '0.9 ÷ 0.3 = ?', solution: '0.9 ÷ 0.3 = 3' },
    ],
    examWeight: '~3–5 ACT questions; foundational for almost every word problem',
  },

  order_of_operations: {
    id: 'order_of_operations', label: 'Order of Operations', emoji: '🔢',
    tagline: 'Parentheses, powers, multiply/divide left to right, add/subtract left to right.',
    keyRules: [
      'PEMDAS / GEMDAS: grouping first, then exponents, then ×÷, then +−.',
      'Multiply and divide share priority. Same for add and subtract. Go left to right.',
      'Absolute value bars and fraction bars act like grouping symbols.',
    ],
    tips: [
      'Rewrite the expression after each step so you do not skip a layer.',
      'On calculator questions, still respect order. Parentheses save you.',
    ],
    watchOut: [
      'ACT trap: doing addition before multiplication.',
      'ACT trap: evaluating exponents after multiplying.',
    ],
    formula: 'Grouping → Exponents → ×÷ (L→R) → +− (L→R)',
    examples: [
      { problem: '3 + 4 × 2²', solution: '2²=4 → 4×4=16 → 3+16=19' },
    ],
    examWeight: '~1–2 ACT questions; often embedded inside larger expressions',
  },

  basic_equations: {
    id: 'basic_equations', label: 'Basic Equations', emoji: '⚖️',
    tagline: 'Whatever you do to one side, do to the other until x stands alone.',
    keyRules: [
      'Undo operations in reverse order: add/subtract first, then multiply/divide.',
      'Distribute before combining like terms when parentheses appear.',
      'Check by substituting your answer back into the original equation.',
    ],
    tips: [
      'Keep the equation balanced. Write each step on a new line.',
      'Clear fractions early by multiplying every term by the LCD.',
    ],
    watchOut: [
      'ACT trap: forgetting to distribute a negative sign.',
      'ACT trap: dividing only one term instead of every term.',
    ],
    formula: 'ax + b = c → ax = c − b → x = (c − b)/a',
    examples: [
      { problem: 'Solve 2x + 5 = 17', solution: '2x = 12 → x = 6' },
    ],
    examWeight: '~2–4 ACT questions; foundation for linear equations',
  },

  radical_expressions: {
    id: 'radical_expressions', label: 'Radicals', emoji: '√',
    tagline: 'Simplify roots the way you simplify fractions: clean the inside first.',
    keyRules: [
      '√(ab) = √a × √b when a,b ≥ 0. Pull perfect-square factors out.',
      '√(a/b) = √a / √b. Rationalize denominators when needed.',
      '√a × √a = a (for a ≥ 0).',
    ],
    tips: [
      'Factor the radicand and look for perfect squares (4, 9, 16, 25…).',
      'Do not cancel terms across a + or − inside a radical.',
    ],
    watchOut: [
      'ACT trap: √(a+b) is not √a + √b.',
      'ACT trap: dropping the absolute value when simplifying √(x²).',
    ],
    formula: '√(ab)=√a√b | √(a/b)=√a/√b | √(a²)=|a|',
    examples: [
      { problem: 'Simplify √72', solution: '√(36×2) = 6√2' },
    ],
    examWeight: '~2–3 ACT questions',
  },

  exponential_functions: {
    id: 'exponential_functions', label: 'Exponential Functions', emoji: '📈',
    tagline: 'Growth and decay multiply, they do not add.',
    keyRules: [
      'Form y = a · bˣ. a is the start value; b is the growth/decay factor.',
      'b > 1 means growth. 0 < b < 1 means decay.',
      'a^m · a^n = a^(m+n). (a^m)^n = a^(mn). a^0 = 1 (a ≠ 0).',
    ],
    tips: [
      'Translate “increases by 5%” to multiply by 1.05 each period.',
      'Translate “decreases by 20%” to multiply by 0.80.',
    ],
    watchOut: [
      'ACT trap: adding the percent instead of multiplying by (1 ± r).',
      'ACT trap: mixing up growth factor and growth rate.',
    ],
    formula: 'y = a(1+r)ᵗ growth | y = a(1−r)ᵗ decay',
    examples: [
      { problem: '$200 grows 5% per year for 3 years. Amount?', solution: '200(1.05)³ ≈ 231.53' },
    ],
    examWeight: '~2–4 ACT questions',
  },

  sequences_series: {
    id: 'sequences_series', label: 'Sequences & Series', emoji: '⋯',
    tagline: 'Find the pattern, then the next term, or the sum.',
    keyRules: [
      'Arithmetic: common difference d. aₙ = a₁ + (n−1)d.',
      'Geometric: common ratio r. aₙ = a₁ · rⁿ⁻¹.',
      'Sum of first n arithmetic terms: Sₙ = n/2 · (a₁ + aₙ).',
    ],
    tips: [
      'Write the first few terms before choosing a formula.',
      'Check whether the problem wants a term or a sum.',
    ],
    watchOut: [
      'ACT trap: off-by-one on the (n−1) exponent or term index.',
      'ACT trap: treating an arithmetic sequence as geometric.',
    ],
    formula: 'aₙ = a₁+(n−1)d | aₙ = a₁ rⁿ⁻¹ | Sₙ = n/2 (first+last)',
    examples: [
      { problem: '2, 5, 8, 11… What is the 10th term?', solution: 'a₁₀ = 2 + 9×3 = 29' },
    ],
    examWeight: '~1–3 ACT questions',
  },

  triangles_congruence: {
    id: 'triangles_congruence', label: 'Triangles & Congruence', emoji: '△',
    tagline: 'Same shape and size: matching sides and angles tell the story.',
    keyRules: [
      'Triangle angle sum is 180°.',
      'Congruence shortcuts: SSS, SAS, ASA, AAS. SSA is not a shortcut.',
      'Corresponding parts of congruent triangles are congruent (CPCTC).',
    ],
    tips: [
      'Mark equal sides and angles on the figure before you write a proof.',
      'Isosceles: base angles are equal.',
    ],
    watchOut: [
      'ACT trap: assuming SSA proves congruence.',
      'ACT trap: mixing up corresponding vertices in the congruence statement.',
    ],
    formula: '∠A+∠B+∠C = 180° | SSS / SAS / ASA / AAS',
    examples: [
      { problem: 'Angles 40° and 65°. Third angle?', solution: '180−40−65 = 75°' },
    ],
    examWeight: '~2–4 ACT questions',
  },

  geometric_transformations: {
    id: 'geometric_transformations', label: 'Transformations', emoji: '🔄',
    tagline: 'Slide, flip, and turn: the figure moves, the measures stay.',
    keyRules: [
      'Translation: every point moves the same distance and direction.',
      'Reflection: flip over a line. Distance to the line is preserved.',
      'Rotation: turn about a point by a given angle.',
      'Dilation: scale from a center by factor k. Angles stay; lengths × k.',
    ],
    tips: [
      'Track one vertex through the transformation, then check a second.',
      'On the coordinate plane, write the rule (x,y) → (…) explicitly.',
    ],
    watchOut: [
      'ACT trap: reflecting over the wrong axis.',
      'ACT trap: confusing rotation direction (CW vs CCW).',
    ],
    formula: 'Reflection over y-axis: (x,y)→(−x,y) | over x-axis: (x,y)→(x,−y)',
    examples: [
      { problem: 'Reflect (3,−2) over the y-axis.', solution: '(−3,−2)' },
    ],
    examWeight: '~1–3 ACT questions',
  },

  ratios_proportions: {
    id: 'ratios_proportions', label: 'Ratios & Proportions', emoji: '⚖️',
    tagline: 'A ratio is a fraction, so set up two equal fractions and cross-multiply.',
    keyRules: [
      'Proportion: a/b = c/d → ad = bc (cross-multiply).',
      'Part-to-part ratio → convert to part-to-whole: ratio 2:3 means 2/5 and 3/5 of the total.',
      'Percent = part/whole × 100.',
      'Percent change = (new−old)/old × 100.',
      'Scale factor: if ratio is a:b, multiply or divide consistently.',
    ],
    tips: [
      'Set up the proportion carefully — units must match across both fractions.',
      'For "part of a whole" questions, find the total by adding all ratio parts.',
      'Always double-check whether the question asks for a part or the whole.',
    ],
    watchOut: [
      'ACT trap: using a part-to-part ratio as if it were a fraction of the total.',
      'ACT trap: forgetting to add ratio parts to get the whole before finding each part.',
      'ACT trap: mixing up percent change and percent of — "what percent OF" vs "what percent INCREASE".',
    ],
    formula: 'a/b = c/d → ad=bc | % = part/whole×100 | %Δ = (new−old)/old×100',
    examples: [
      { problem: 'Ratio of boys to girls is 3:5. 160 students total. How many boys?', solution: '3/(3+5) × 160 = 3/8 × 160 = 60' },
      { problem: 'Price rose from $40 to $50. Percent increase?', solution: '(50−40)/40 × 100 = 25%' },
    ],
    examWeight: '~5–7 ACT questions; appears in nearly every section',
  },

  statistics_data: {
    id: 'statistics_data', label: 'Statistics & Data', emoji: '📈',
    tagline: 'Read the graph carefully. ACT loves tricking you with scale and axis labels.',
    keyRules: [
      'Mean = sum/count. Median = middle value (sorted). Mode = most frequent.',
      'Range = max − min. IQR = Q3 − Q1.',
      'When reading bar/line graphs: always check axis labels and units.',
      'Scatter plot trend: positive slope = positive correlation; negative slope = negative correlation.',
      'Outliers pull the mean more than the median.',
    ],
    tips: [
      'For two-way tables: find the correct row AND column before computing.',
      'Double-check you are reading the correct bar or line in multi-series graphs.',
      'When a set gains a value: recompute the mean from scratch with new total.',
    ],
    watchOut: [
      'ACT trap: reading the wrong axis or forgetting the scale (e.g., axis in thousands).',
      'ACT trap: finding median before sorting the data.',
      'ACT trap: confusing frequency with relative frequency (percent vs count).',
    ],
    formula: 'Mean = Σx/n | Median = middle (sorted) | Range = max−min',
    examples: [
      { problem: 'Data set: {3,7,7,9,14}. Mean and median?', solution: 'Mean = 40/5 = 8. Median = 7.' },
      { problem: 'Table shows 40 students; 18 prefer math. What percent?', solution: '18/40 × 100 = 45%' },
    ],
    examWeight: '~3–5 ACT questions; always appears with charts or tables',
  },

  probability_statistics: {
    id: 'probability_statistics', label: 'Probability', emoji: '🎲',
    tagline: 'Probability = favorable outcomes / total outcomes, so always count carefully.',
    keyRules: [
      'P(event) = (# favorable outcomes) / (# total outcomes). Always between 0 and 1.',
      'Complement: P(A) + P(not A) = 1.',
      'Independent events: P(A and B) = P(A) × P(B).',
      'Mutually exclusive events: P(A or B) = P(A) + P(B).',
      'Non-mutually exclusive: P(A or B) = P(A) + P(B) − P(A and B).',
    ],
    tips: [
      'List all possible outcomes when the sample space is small.',
      'Use the complement when P(not A) is easier to find than P(A).',
      'For "at least one" problems: P(at least one) = 1 − P(none).',
    ],
    watchOut: [
      'ACT trap: adding probabilities for AND instead of multiplying.',
      'ACT trap: forgetting to subtract the overlap in non-mutually exclusive events.',
      'ACT trap: computing probability > 1 — always a sign of error; max is 1.',
    ],
    formula: 'P = favourable/total | P(A∩B)=P(A)×P(B) | P(AᶜÙ)=1−P(A)',
    examples: [
      { problem: 'Bag has 3 red, 5 blue. P(red)?', solution: '3/(3+5) = 3/8' },
      { problem: 'P(no rain Mon AND Tue) if P(rain each day)=0.3?', solution: '(0.7)(0.7) = 0.49' },
    ],
    examWeight: '~2–3 ACT questions; often combined with counting problems',
  },

  descriptive_statistics: {
    id: 'descriptive_statistics', label: 'Descriptive Stats', emoji: '📊',
    tagline: 'Mean, median, range, and standard deviation tell different stories about the same data.',
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
      'Work backward from mean by using total sum = mean × count.',
    ],
    watchOut: [
      'ACT trap: finding the median before sorting the data.',
      'ACT trap: for even-numbered sets, forgetting to average the two middle values.',
      'ACT trap: adding a constant shifts center measures but does not change SD or range.',
    ],
    examples: [
      { problem: 'Find mean and median of {2, 5, 5, 8, 10}', solution: 'Mean = 30/5 = 6. Median = 5 (middle value).' },
      { problem: 'Mean of 6 numbers is 15 and five sum to 74. Missing value?', solution: 'Total must be 6×15 = 90. Missing value = 90−74 = 16.' },
    ],
    examWeight: '~3–5 ACT questions / often appears in chart and table form',
  },
}

export function getConceptContent(conceptId: string): ConceptContent | null {
  const id = canonicalConceptId(conceptId)
  return CONCEPT_CONTENT[id] ?? CONCEPT_CONTENT[conceptId] ?? null
}

/** Always returns a notes sheet — curated content when we have it, else a
 *  short structured fallback so chapter / weekly never skip the notes page. */
export function resolveConceptNotes(conceptId: string): ConceptContent {
  const hit = getConceptContent(conceptId)
  if (hit) return hit
  const id = canonicalConceptId(conceptId)
  const label = id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return {
    id,
    label,
    emoji: '📗',
    tagline: `Core moves for ${label}. Read these, then work the batch.`,
    keyRules: [
      `Name the quantity you need before you compute.`,
      `Write one clear equation or diagram, then solve.`,
      `Check units and whether the answer matches the question asked.`,
    ],
    tips: [
      `Underline what the question is asking for.`,
      `Estimate first so a wild answer stands out.`,
    ],
    watchOut: [
      `ACT trap: solving for the wrong unknown.`,
      `ACT trap: stopping one step early and picking a distractor.`,
    ],
    examples: [],
  }
}
