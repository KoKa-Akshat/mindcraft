export interface Question {
  id:           string
  conceptId:    string
  level:        1 | 2 | 3
  question:     string
  choices:      [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation:  string
  hints:        [string, string, string]
  examTag?:     string
}

const Q: Question[] = [

  // ── LINEAR EQUATIONS ────────────────────────────────────────────────────────

  // L1
  { id:'le-1-1', conceptId:'linear_equations', level:1,
    question:'Solve for x:  4x − 6 = 22',
    choices:['x = 4','x = 7','x = 8','x = 11'],
    correctIndex:1,
    explanation:'Add 6 to both sides: 4x = 28. Divide by 4: x = 7.',
    hints:['Move the constant to the right side first','Add 6 to both sides to get 4x = 28','Now divide both sides by 4'],
    examTag:'ACT' },

  { id:'le-1-2', conceptId:'linear_equations', level:1,
    question:'If 3x + 9 = 0, what is x?',
    choices:['x = −9','x = −3','x = 3','x = 9'],
    correctIndex:1,
    explanation:'Subtract 9: 3x = −9. Divide by 3: x = −3.',
    hints:['Subtract 9 from both sides','You get 3x = −9','Divide both sides by 3'],
    examTag:'ACT' },

  { id:'le-1-3', conceptId:'linear_equations', level:1,
    question:'What is x if  x/4 + 3 = 7?',
    choices:['x = 1','x = 10','x = 16','x = 28'],
    correctIndex:2,
    explanation:'Subtract 3: x/4 = 4. Multiply both sides by 4: x = 16.',
    hints:['Subtract 3 from both sides first','You get x/4 = 4','Multiply both sides by 4 to isolate x'] },

  { id:'le-1-4', conceptId:'linear_equations', level:1,
    question:'Solve:  2(x − 3) = 10',
    choices:['x = 2','x = 5','x = 7','x = 8'],
    correctIndex:3,
    explanation:'Divide both sides by 2: x − 3 = 5. Add 3: x = 8.',
    hints:['Divide both sides by 2 first','Or distribute: 2x − 6 = 10','Either way, isolate x'] },

  // L2
  { id:'le-2-1', conceptId:'linear_equations', level:2,
    question:'A plumber charges a $45 flat fee plus $25 per hour. A customer\'s bill is $145. How many hours did the plumber work?',
    choices:['3 hours','4 hours','5 hours','6 hours'],
    correctIndex:1,
    explanation:'Set up: 45 + 25h = 145. Subtract 45: 25h = 100. Divide: h = 4.',
    hints:['Write an equation: flat fee + (rate × hours) = total bill','45 + 25h = 145','Subtract 45, then divide by 25'],
    examTag:'ACT' },

  { id:'le-2-2', conceptId:'linear_equations', level:2,
    question:'Two numbers have a sum of 56. One number is 3 times the other. What is the smaller number?',
    choices:['12','14','18','42'],
    correctIndex:1,
    explanation:'Let smaller = x, larger = 3x. Then x + 3x = 56 → 4x = 56 → x = 14.',
    hints:['Let the smaller number be x, then the larger is 3x','Write the equation: x + 3x = 56','Combine like terms: 4x = 56'],
    examTag:'ACT' },

  { id:'le-2-3', conceptId:'linear_equations', level:2,
    question:'Solve:  3(2x − 4) = 2(x + 6)',
    choices:['x = 3','x = 6','x = 7.5','x = 9'],
    correctIndex:1,
    explanation:'Expand: 6x − 12 = 2x + 12. Subtract 2x: 4x − 12 = 12. Add 12: 4x = 24. Divide: x = 6.',
    hints:['Distribute on both sides first','After expanding: 6x − 12 = 2x + 12','Collect x terms on one side'] },

  { id:'le-2-4', conceptId:'linear_equations', level:2,
    question:'If 5x − 3 = 2x + 9, what is the value of 3x?',
    choices:['4','12','18','36'],
    correctIndex:1,
    explanation:'Subtract 2x: 3x − 3 = 9. Add 3: 3x = 12. (The question asks for 3x, not x!)',
    hints:['Subtract 2x from both sides','You get 3x − 3 = 9','Add 3 — and notice the question asks for 3x directly'] },

  // L3
  { id:'le-3-1', conceptId:'linear_equations', level:3,
    question:'Train A leaves a station at 60 mph. Train B leaves 2 hours later from the same station at 90 mph in the same direction. How many hours after Train B departs will it catch Train A?',
    choices:['3 hours','4 hours','5 hours','6 hours'],
    correctIndex:1,
    explanation:'When Train B has traveled t hours, Train A has traveled t+2. Equal distances: 90t = 60(t+2) → 30t = 120 → t = 4.',
    hints:['When B leaves, A has a 2-hour head start','Set the distances equal: 90t = 60(t + 2)','Solve for t'],
    examTag:'ACT' },

  { id:'le-3-2', conceptId:'linear_equations', level:3,
    question:'The width of a rectangle is 4 less than its length. If the perimeter is 48, what is the area?',
    choices:['100','110','128','140'],
    correctIndex:3,
    explanation:'Let L = length, W = L − 4. Perimeter: 2L + 2(L−4) = 48 → 4L = 56 → L = 14, W = 10. Area = 14 × 10 = 140.',
    hints:['Let W = L − 4 and write the perimeter equation','2L + 2(L − 4) = 48 → solve for L','Area = length × width'],
    examTag:'ACT' },

  { id:'le-3-3', conceptId:'linear_equations', level:3,
    question:'If 3x − 2y = 2 and y = x + 1, what is x + y?',
    choices:['5','7','9','11'],
    correctIndex:2,
    explanation:'Substitute y = x+1: 3x − 2(x+1) = 2 → x − 2 = 2 → x = 4. Then y = 5. So x + y = 9.',
    hints:['Substitute the second equation into the first','3x − 2(x + 1) = 2','Solve for x, then find y, then add them'] },

  // ── QUADRATIC EQUATIONS ──────────────────────────────────────────────────────

  // L1
  { id:'qe-1-1', conceptId:'quadratic_equations', level:1,
    question:'Solve:  x² − 9 = 0',
    choices:['x = 3 only','x = −3 only','x = 3 or x = −3','x = 9'],
    correctIndex:2,
    explanation:'Add 9: x² = 9. Take square roots: x = ±3. Both solutions are valid.',
    hints:['Add 9 to both sides','You get x² = 9 — what numbers squared give 9?','Don\'t forget the negative solution'],
    examTag:'SAT' },

  { id:'qe-1-2', conceptId:'quadratic_equations', level:1,
    question:'Factor completely:  x² + 6x + 8',
    choices:['(x + 1)(x + 8)','(x + 2)(x + 4)','(x + 3)(x + 3)','(x − 2)(x − 4)'],
    correctIndex:1,
    explanation:'Find two numbers that multiply to 8 and add to 6: 2 × 4 = 8 and 2 + 4 = 6. So (x + 2)(x + 4).',
    hints:['Look for two numbers that multiply to 8','Those same numbers must also add to 6','2 and 4 satisfy both conditions'],
    examTag:'SAT' },

  { id:'qe-1-3', conceptId:'quadratic_equations', level:1,
    question:'What are the solutions to  x² − 5x + 6 = 0?',
    choices:['x = 1 and x = 6','x = 2 and x = 3','x = −2 and x = −3','x = 3 and x = 4'],
    correctIndex:1,
    explanation:'Factor: (x − 2)(x − 3) = 0. Set each factor to zero: x = 2 or x = 3.',
    hints:['Try factoring the left side','Find two numbers that multiply to 6 and add to −5','−2 and −3 work: now set each factor to zero'] },

  { id:'qe-1-4', conceptId:'quadratic_equations', level:1,
    question:'Solve by factoring:  x² + x − 12 = 0',
    choices:['x = −4 and x = 3','x = 4 and x = −3','x = 6 and x = −2','x = 2 and x = 6'],
    correctIndex:0,
    explanation:'Factor: (x + 4)(x − 3) = 0. So x = −4 or x = 3.',
    hints:['Find two numbers that multiply to −12 and add to +1','4 × (−3) = −12 and 4 + (−3) = 1','(x + 4)(x − 3) = 0'] },

  // L2
  { id:'qe-2-1', conceptId:'quadratic_equations', level:2,
    question:'A ball\'s height (ft) is h = −16t² + 64t. At what time(s) does it reach 48 feet?',
    choices:['t = 1 only','t = 1 and t = 3','t = 2 only','t = 4 only'],
    correctIndex:1,
    explanation:'Set −16t² + 64t = 48 → t² − 4t + 3 = 0 (divide by −16) → (t−1)(t−3) = 0 → t = 1 and t = 3.',
    hints:['Set the height equation equal to 48','Rearrange and divide through by −16 to simplify','Factor the resulting quadratic'],
    examTag:'ACT' },

  { id:'qe-2-2', conceptId:'quadratic_equations', level:2,
    question:'The product of two consecutive positive integers is 72. What is the smaller integer?',
    choices:['7','8','9','10'],
    correctIndex:1,
    explanation:'Let n and n+1 be the integers. n(n+1) = 72 → n² + n − 72 = 0 → (n+9)(n−8) = 0. Since n > 0, n = 8.',
    hints:['If smaller = n, then larger = n + 1','Write: n(n+1) = 72 → n² + n − 72 = 0','Factor: which two numbers multiply to −72 and add to 1?'] },

  { id:'qe-2-3', conceptId:'quadratic_equations', level:2,
    question:'Solve:  2x² − 7x − 15 = 0. What is the positive solution?',
    choices:['3/2','5','3','15/2'],
    correctIndex:1,
    explanation:'Factor: (2x + 3)(x − 5) = 0. Solutions: x = −3/2 or x = 5. The positive solution is x = 5.',
    hints:['Try factoring 2x² − 7x − 15','Look for the form (2x + ?)(x − ?)','The factors are (2x + 3)(x − 5)'],
    examTag:'ACT' },

  { id:'qe-2-4', conceptId:'quadratic_equations', level:2,
    question:'Use the quadratic formula to solve  x² − 6x + 5 = 0.',
    choices:['x = 1 and x = 5','x = −1 and x = −5','x = 2 and x = 3','x = 1 and x = 6'],
    correctIndex:0,
    explanation:'Discriminant: 36 − 20 = 16. x = (6 ± 4)/2 → x = 5 or x = 1.',
    hints:['Identify a=1, b=−6, c=5','Discriminant = b² − 4ac = 36 − 20 = 16','x = (−b ± √discriminant) / (2a)'] },

  // L3
  { id:'qe-3-1', conceptId:'quadratic_equations', level:3,
    question:'A company\'s weekly profit is P = −2x² + 80x − 600 where x is the unit price ($). What price maximizes profit?',
    choices:['$15','$20','$25','$40'],
    correctIndex:1,
    explanation:'Maximum of a downward parabola occurs at x = −b/(2a) = −80/(2×(−2)) = 80/4 = $20.',
    hints:['This parabola opens downward — maximum is at the vertex','Vertex x-coordinate: x = −b/(2a)','Here a = −2 and b = 80'],
    examTag:'ACT' },

  { id:'qe-3-2', conceptId:'quadratic_equations', level:3,
    question:'For what values of k does  x² + kx + 16 = 0  have exactly one real solution?',
    choices:['k = 4','k = 8','k = 8 or k = −8','k = 16'],
    correctIndex:2,
    explanation:'One solution means discriminant = 0: k² − 4(1)(16) = 0 → k² = 64 → k = ±8.',
    hints:['A quadratic has exactly one solution when the discriminant = 0','Discriminant: b² − 4ac = 0','k² − 64 = 0 → k = ?'],
    examTag:'IB' },

  { id:'qe-3-3', conceptId:'quadratic_equations', level:3,
    question:'A rectangle\'s length is 3 more than twice its width. Its area is 65. What is its perimeter?',
    choices:['30','34','36','38'],
    correctIndex:2,
    explanation:'Let w = width, L = 2w+3. Area: w(2w+3) = 65 → 2w²+3w−65=0 → (w−5)(2w+13)=0 → w=5, L=13. Perimeter = 2(5+13) = 36.',
    hints:['Let width = w, then length = 2w + 3','Write the area equation: w(2w + 3) = 65','Expand and factor to find w = 5'] },

  // ── FUNCTIONS BASICS ─────────────────────────────────────────────────────────

  // L1
  { id:'fn-1-1', conceptId:'functions_basics', level:1,
    question:'If f(x) = 3x − 2, what is f(5)?',
    choices:['13','15','17','28'],
    correctIndex:0,
    explanation:'Substitute x = 5: f(5) = 3(5) − 2 = 15 − 2 = 13.',
    hints:['Replace every x with 5','Calculate 3 × 5 first','Then subtract 2'] },

  { id:'fn-1-2', conceptId:'functions_basics', level:1,
    question:'What is the domain of  f(x) = 1/(x − 3)?',
    choices:['All real numbers','x ≠ 0','x ≠ 3','x > 3'],
    correctIndex:2,
    explanation:'Division by zero is undefined, so x − 3 ≠ 0, meaning x ≠ 3.',
    hints:['When does a fraction break?','A fraction is undefined when the denominator equals zero','Set x − 3 = 0 and exclude that value'] },

  { id:'fn-1-3', conceptId:'functions_basics', level:1,
    question:'If g(x) = x² + 1, what is g(−3)?',
    choices:['−8','7','10','16'],
    correctIndex:2,
    explanation:'g(−3) = (−3)² + 1 = 9 + 1 = 10. Remember: (−3)² = +9, not −9.',
    hints:['Substitute x = −3','(−3)² is positive — squaring removes the negative','9 + 1 = ?'] },

  { id:'fn-1-4', conceptId:'functions_basics', level:1,
    question:'Which function has a range of all real numbers y ≥ 0?',
    choices:['f(x) = x − 2','f(x) = x²','f(x) = −x²','f(x) = x³'],
    correctIndex:1,
    explanation:'x² is always non-negative regardless of x, so its range is y ≥ 0.',
    hints:['Think about what outputs each function can produce','Which function can never give a negative result?','Squaring any real number gives a non-negative value'] },

  // L2
  { id:'fn-2-1', conceptId:'functions_basics', level:2,
    question:'Given f(x) = 2x + 1 and g(x) = x − 3, what is f(g(4))?',
    choices:['1','3','5','9'],
    correctIndex:1,
    explanation:'Work inside-out. g(4) = 4 − 3 = 1. Then f(1) = 2(1) + 1 = 3.',
    hints:['Evaluate the inner function first','g(4) = 4 − 3 = 1','Now evaluate f(1) = 2(1) + 1'] },

  { id:'fn-2-2', conceptId:'functions_basics', level:2,
    question:'If f(x) = x² − 4x + 3 and f(a) = 0, what are the possible values of a?',
    choices:['a = 0 or a = 4','a = 1 or a = 3','a = −1 or a = −3','a = 2 only'],
    correctIndex:1,
    explanation:'Set x² − 4x + 3 = 0 → factor: (x−1)(x−3) = 0 → x = 1 or x = 3.',
    hints:['Set f(a) = 0 and solve the quadratic','Factor x² − 4x + 3','Look for two numbers that multiply to 3 and add to −4'] },

  { id:'fn-2-3', conceptId:'functions_basics', level:2,
    question:'The function g(x) = f(x − 3) represents what transformation of f?',
    choices:['f shifted 3 units left','f shifted 3 units right','f stretched by 3','f shifted 3 units down'],
    correctIndex:1,
    explanation:'Replacing x with (x − 3) shifts the graph horizontally 3 units to the right.',
    hints:['Think about how replacing x with (x − c) affects the graph','It\'s a horizontal shift — but which direction?','Replacing x with (x − 3) shifts right by 3 (counterintuitive!)'],
    examTag:'IB' },

  { id:'fn-2-4', conceptId:'functions_basics', level:2,
    question:'If f(x) = 3x + 5 and f(g(x)) = x, what is g(x)?',
    choices:['g(x) = (x − 5)/3','g(x) = 3x − 5','g(x) = x/3 + 5','g(x) = (x + 5)/3'],
    correctIndex:0,
    explanation:'g is the inverse of f. Swap x and y in y = 3x+5: x = 3y+5 → y = (x−5)/3.',
    hints:['If f(g(x)) = x, then g is the inverse of f','To find the inverse, swap x and y in y = 3x + 5','Solve x = 3y + 5 for y'] },

  // L3
  { id:'fn-3-1', conceptId:'functions_basics', level:3,
    question:'A function f is defined by f(x) = (x+2)/(x−1). What is f(f(3))?',
    choices:['3','5/2','7/3','5'],
    correctIndex:0,
    explanation:'First: f(3) = (3+2)/(3−1) = 5/2. Then: f(5/2) = (5/2+2)/(5/2−1) = (9/2)/(3/2) = 3.',
    hints:['Evaluate f(3) first','f(3) = 5/2 — use this as your new input','f(5/2) = (5/2 + 2) ÷ (5/2 − 1)'],
    examTag:'IB' },

  { id:'fn-3-2', conceptId:'functions_basics', level:3,
    question:'For f(x) = √(2x − 4), what is the minimum value in the domain of f?',
    choices:['x ≥ 0','x ≥ 1','x ≥ 2','x ≥ 4'],
    correctIndex:2,
    explanation:'Square roots require a non-negative input: 2x − 4 ≥ 0 → 2x ≥ 4 → x ≥ 2.',
    hints:['The expression under a square root must be ≥ 0','Set 2x − 4 ≥ 0','Solve the inequality for x'] },

  { id:'fn-3-3', conceptId:'functions_basics', level:3,
    question:'If f(x) = 2x and g(x) = x + 3, what is (f∘g)(x) − (g∘f)(x)?',
    choices:['−3','3','x − 3','6'],
    correctIndex:1,
    explanation:'f(g(x)) = 2(x+3) = 2x+6. g(f(x)) = 2x+3. Difference: (2x+6)−(2x+3) = 3.',
    hints:['Find f(g(x)) = f(x+3) first','Then find g(f(x)) = g(2x)','Subtract and simplify'],
    examTag:'IB' },

  // ── EXPONENT RULES ───────────────────────────────────────────────────────────

  // L1
  { id:'ex-1-1', conceptId:'exponent_rules', level:1,
    question:'Simplify:  2³ × 2⁴',
    choices:['2⁷','2¹²','4⁷','64'],
    correctIndex:0,
    explanation:'Multiplying same base: add exponents. 2³ × 2⁴ = 2^(3+4) = 2⁷ = 128.',
    hints:['What\'s the rule for multiplying powers with the same base?','Same base → add the exponents','3 + 4 = ?'] },

  { id:'ex-1-2', conceptId:'exponent_rules', level:1,
    question:'What is the value of  (3²)³?',
    choices:['3⁵','3⁶','9³','81'],
    correctIndex:1,
    explanation:'Power of a power: multiply exponents. (3²)³ = 3^(2×3) = 3⁶ = 729.',
    hints:['For a power raised to another power, multiply the exponents','2 × 3 = 6','(3²)³ = 3^?'] },

  { id:'ex-1-3', conceptId:'exponent_rules', level:1,
    question:'Simplify:  x⁶ ÷ x²',
    choices:['x³','x⁴','x⁸','x¹²'],
    correctIndex:1,
    explanation:'Dividing same base: subtract exponents. x⁶ ÷ x² = x^(6−2) = x⁴.',
    hints:['Same base, dividing — what do you do with the exponents?','Subtract: 6 − 2 = 4','x⁶ ÷ x² = x^?'] },

  { id:'ex-1-4', conceptId:'exponent_rules', level:1,
    question:'What is  5⁰?',
    choices:['0','1','5','Undefined'],
    correctIndex:1,
    explanation:'Any nonzero number raised to the power 0 equals 1. So 5⁰ = 1.',
    hints:['This is a special exponent rule','Any base raised to the power of zero equals...','...1 (as long as the base isn\'t 0)'] },

  // L2
  { id:'ex-2-1', conceptId:'exponent_rules', level:2,
    question:'Evaluate:  (4/9)^(1/2)',
    choices:['2/3','4/3','2/9','8/27'],
    correctIndex:0,
    explanation:'A fractional exponent 1/2 means square root: √(4/9) = √4/√9 = 2/3.',
    hints:['A power of 1/2 means square root','Take the square root of numerator and denominator separately','√4 = 2 and √9 = 3'] },

  { id:'ex-2-2', conceptId:'exponent_rules', level:2,
    question:'Simplify:  (2x²y³)³',
    choices:['6x⁵y⁶','8x⁶y⁹','2x⁶y⁹','8x⁵y⁶'],
    correctIndex:1,
    explanation:'Raise each factor to power 3: 2³ × x^(2×3) × y^(3×3) = 8x⁶y⁹.',
    hints:['Raise every factor inside the parentheses to the power of 3','2³ = 8, and multiply each exponent by 3','2³ · x^(2·3) · y^(3·3)'] },

  { id:'ex-2-3', conceptId:'exponent_rules', level:2,
    question:'What is  5⁰ + 5⁻¹?',
    choices:['0','1','6/5','5'],
    correctIndex:2,
    explanation:'5⁰ = 1 and 5⁻¹ = 1/5 (negative exponent = reciprocal). Sum: 1 + 1/5 = 6/5.',
    hints:['What is any nonzero number to the power 0?','What does a negative exponent mean?','5⁻¹ = 1/5, then add'] },

  { id:'ex-2-4', conceptId:'exponent_rules', level:2,
    question:'If 2^x = 32 and 3^y = 81, what is x + y?',
    choices:['7','8','9','10'],
    correctIndex:2,
    explanation:'2⁵ = 32 so x = 5. 3⁴ = 81 so y = 4. Therefore x + y = 9.',
    hints:['Express 32 and 81 as powers of 2 and 3','32 = 2^? and 81 = 3^?','2⁵ = 32 and 3⁴ = 81'] },

  // L3
  { id:'ex-3-1', conceptId:'exponent_rules', level:3,
    question:'Simplify:  (27x⁶)^(2/3)',
    choices:['9x⁴','9x³','3x⁴','18x⁴'],
    correctIndex:0,
    explanation:'27^(2/3) = (∛27)² = 3² = 9. x^(6 × 2/3) = x⁴. Result: 9x⁴.',
    hints:['Apply the 2/3 power to 27 and x⁶ separately','27^(2/3): take the cube root of 27 first, then square it','∛27 = 3, then 3² = 9'],
    examTag:'IB' },

  { id:'ex-3-2', conceptId:'exponent_rules', level:3,
    question:'If  4^(x+1) = 8^x, what is x?',
    choices:['1','2','3','4'],
    correctIndex:1,
    explanation:'Rewrite as powers of 2: 2^(2x+2) = 2^(3x). Set exponents equal: 2x+2 = 3x → x = 2.',
    hints:['Rewrite 4 and 8 as powers of 2','4 = 2² and 8 = 2³','Set the exponents equal: 2(x+1) = 3x'],
    examTag:'ACT' },

  { id:'ex-3-3', conceptId:'exponent_rules', level:3,
    question:'Simplify:  (x³ · x^(−1/2)) / x^(1/2)',
    choices:['x','x²','x³','x⁴'],
    correctIndex:1,
    explanation:'Numerator: x^(3−1/2) = x^(5/2). Divide by x^(1/2): x^(5/2−1/2) = x² .',
    hints:['Combine the numerator by adding exponents','x³ · x^(−1/2) = x^(3 − 1/2) = x^(5/2)','Divide by x^(1/2): subtract exponents'],
    examTag:'IB' },

  // ── BASIC PROBABILITY ────────────────────────────────────────────────────────

  // L1
  { id:'pr-1-1', conceptId:'basic_probability', level:1,
    question:'A bag has 3 red and 7 blue marbles. What is the probability of drawing a red marble?',
    choices:['3/10','3/7','7/10','1/3'],
    correctIndex:0,
    explanation:'P = favorable / total = 3 / (3+7) = 3/10.',
    hints:['Count total marbles first','Total = red + blue = 10','P(red) = red count / total'] },

  { id:'pr-1-2', conceptId:'basic_probability', level:1,
    question:'A fair die is rolled. What is the probability of rolling an even number?',
    choices:['1/6','1/3','1/2','2/3'],
    correctIndex:2,
    explanation:'Even numbers on a die: {2, 4, 6} — 3 out of 6. P = 3/6 = 1/2.',
    hints:['List all outcomes: {1, 2, 3, 4, 5, 6}','Which of those are even?','3 favorable out of 6 total'] },

  { id:'pr-1-3', conceptId:'basic_probability', level:1,
    question:'P(rain) = 0.3. What is P(no rain)?',
    choices:['0.03','0.3','0.7','1.3'],
    correctIndex:2,
    explanation:'Complement rule: P(not A) = 1 − P(A). So P(no rain) = 1 − 0.3 = 0.7.',
    hints:['P(event) + P(not event) = 1','Use the complement rule','1 − 0.3 = ?'] },

  { id:'pr-1-4', conceptId:'basic_probability', level:1,
    question:'A spinner has 8 equal sections numbered 1–8. What is the probability of landing on a number greater than 5?',
    choices:['3/8','4/8','5/8','3/5'],
    correctIndex:0,
    explanation:'Numbers greater than 5: {6, 7, 8} — that\'s 3 out of 8. P = 3/8.',
    hints:['List numbers greater than 5','Count them and divide by total sections','Favorable: {6, 7, 8}'] },

  // L2
  { id:'pr-2-1', conceptId:'basic_probability', level:2,
    question:'A card is drawn from a 52-card deck. What is P(king OR heart)?',
    choices:['13/52','16/52','17/52','4/52'],
    correctIndex:1,
    explanation:'P(king) + P(heart) − P(king of hearts) = 4/52 + 13/52 − 1/52 = 16/52.',
    hints:['Use the addition rule: P(A or B) = P(A) + P(B) − P(A and B)','P(king) = 4/52 and P(heart) = 13/52','Subtract 1/52 for the king of hearts — it was counted twice'],
    examTag:'SAT' },

  { id:'pr-2-2', conceptId:'basic_probability', level:2,
    question:'You flip a fair coin twice. What is the probability of exactly one head?',
    choices:['1/4','1/2','3/4','1'],
    correctIndex:1,
    explanation:'Sample space: {HH, HT, TH, TT}. Exactly one head: {HT, TH} = 2/4 = 1/2.',
    hints:['Write all possible outcomes for 2 flips','Sample space: {HH, HT, TH, TT}','Count outcomes with exactly one H'] },

  { id:'pr-2-3', conceptId:'basic_probability', level:2,
    question:'Events A and B are independent. P(A) = 0.4 and P(B) = 0.5. What is P(A and B)?',
    choices:['0.1','0.2','0.45','0.9'],
    correctIndex:1,
    explanation:'For independent events: P(A and B) = P(A) × P(B) = 0.4 × 0.5 = 0.2.',
    hints:['Multiplication rule for independent events','P(A and B) = P(A) × P(B)','0.4 × 0.5 = ?'] },

  { id:'pr-2-4', conceptId:'basic_probability', level:2,
    question:'In a class of 30, 18 play soccer and 12 play basketball. 6 play both. What is P(a student plays neither)?',
    choices:['1/5','1/6','1/3','2/5'],
    correctIndex:0,
    explanation:'By inclusion-exclusion: n(soccer or basketball) = 18+12−6 = 24. Neither = 30−24 = 6. P = 6/30 = 1/5.',
    hints:['Use inclusion-exclusion: n(A or B) = n(A) + n(B) − n(A and B)','n(soccer or basketball) = 18+12−6 = 24','Students playing neither = 30 − 24'],
    examTag:'IB' },

  // L3
  { id:'pr-3-1', conceptId:'basic_probability', level:3,
    question:'A box has 5 red and 3 blue balls. Two are drawn without replacement. What is P(both red)?',
    choices:['25/64','5/14','5/16','10/28'],
    correctIndex:1,
    explanation:'P(1st red) = 5/8. Given 1st is red: P(2nd red) = 4/7. P(both red) = 5/8 × 4/7 = 20/56 = 5/14.',
    hints:['This is sampling without replacement — the second draw depends on the first','P(first red) = 5/8','After one red is removed: 4 red remain out of 7 total'],
    examTag:'IB' },

  { id:'pr-3-2', conceptId:'basic_probability', level:3,
    question:'A shooter makes 60% of free throws (independently). What is the probability of making all 3 in a row?',
    choices:['0.06','0.216','0.36','0.6'],
    correctIndex:1,
    explanation:'P(all 3) = 0.6 × 0.6 × 0.6 = 0.6³ = 0.216.',
    hints:['Since each shot is independent, multiply','P(make) = 0.6 for each shot','0.6³ = ?'] },

  { id:'pr-3-3', conceptId:'basic_probability', level:3,
    question:'A and B are mutually exclusive. P(A) = 0.3 and P(A or B) = 0.7. What is P(B)?',
    choices:['0.2','0.4','0.5','0.6'],
    correctIndex:1,
    explanation:'Mutually exclusive means P(A and B) = 0. P(A or B) = P(A) + P(B) → 0.7 = 0.3 + P(B) → P(B) = 0.4.',
    hints:['For mutually exclusive events, P(A and B) = 0','So P(A or B) = P(A) + P(B) (no overlap)','0.7 = 0.3 + P(B)'],
    examTag:'ACT' },

  // ── SYSTEMS OF EQUATIONS ─────────────────────────────────────────────────────

  // L1
  { id:'sy-1-1', conceptId:'systems_of_linear_equations', level:1,
    question:'Solve the system: x + y = 10 and x − y = 2. What is x?',
    choices:['4','6','8','10'],
    correctIndex:1,
    explanation:'Add the equations: 2x = 12 → x = 6. Then y = 10 − 6 = 4.',
    hints:['Try adding the two equations','Adding eliminates y: (x+y) + (x−y) = 10+2','2x = 12, so x = ?'] },

  { id:'sy-1-2', conceptId:'systems_of_linear_equations', level:1,
    question:'Given the system 2x + y = 7 and y = 3, what is x?',
    choices:['1','2','3','4'],
    correctIndex:1,
    explanation:'Substitute y = 3 into first equation: 2x + 3 = 7 → 2x = 4 → x = 2.',
    hints:['Substitute y = 3 directly into the first equation','2x + 3 = 7','Subtract 3, then divide by 2'] },

  { id:'sy-1-3', conceptId:'systems_of_linear_equations', level:1,
    question:'If 3x − 2y = 8 and x = 0, what is y?',
    choices:['−4','−3','4','8'],
    correctIndex:0,
    explanation:'Substitute x = 0: −2y = 8 → y = −4.',
    hints:['Substitute x = 0 directly into the equation','You get −2y = 8','Divide both sides by −2'] },

  // L2
  { id:'sy-2-1', conceptId:'systems_of_linear_equations', level:2,
    question:'Solve the system: 2x + 3y = 12 and 4x − 3y = 6. What is x + y?',
    choices:['3','4','5','6'],
    correctIndex:2,
    explanation:'Add equations (3y cancels): 6x = 18 → x = 3. Substitute: 6 + 3y = 12 → y = 2. x + y = 5.',
    hints:['Notice 3y and −3y cancel when added','After adding: 6x = 18 → x = 3','Substitute x = 3 to find y'],
    examTag:'ACT' },

  { id:'sy-2-2', conceptId:'systems_of_linear_equations', level:2,
    question:'Tickets cost $5 for students and $8 for adults. 100 tickets sold for $620 total. How many student tickets?',
    choices:['40','50','60','80'],
    correctIndex:2,
    explanation:'s + a = 100 and 5s + 8a = 620. Substitute s = 100−a: 5(100−a) + 8a = 620 → 3a = 120 → a = 40 → s = 60.',
    hints:['Write 2 equations: one for count, one for money','s + a = 100 and 5s + 8a = 620','Substitute s = 100 − a into the second equation'],
    examTag:'ACT' },

  { id:'sy-2-3', conceptId:'systems_of_linear_equations', level:2,
    question:'The system 2x + ky = 6 and 4x + 8y = 12 has infinitely many solutions. What is k?',
    choices:['2','4','6','8'],
    correctIndex:1,
    explanation:'Infinite solutions: equations must be proportional. Multiply first by 2: 4x + 2ky = 12. Compare: 2k = 8 → k = 4.',
    hints:['Infinite solutions means the two equations are multiples of each other','Multiply the first equation by 2','Match the coefficients'],
    examTag:'IB' },

  // L3
  { id:'sy-3-1', conceptId:'systems_of_linear_equations', level:3,
    question:'A boat travels 60 km downstream in 3 hours and returns in 5 hours. What is the speed of the current?',
    choices:['2 km/h','4 km/h','6 km/h','10 km/h'],
    correctIndex:1,
    explanation:'b+c = 60/3 = 20 and b−c = 60/5 = 12. Subtract: 2c = 8 → c = 4 km/h.',
    hints:['Let b = boat speed, c = current speed','Downstream: b+c = 20, Upstream: b−c = 12','Subtract one equation from the other'],
    examTag:'ACT' },

  { id:'sy-3-2', conceptId:'systems_of_linear_equations', level:3,
    question:'A chemist mixes a 20% and 50% acid solution to make 90 mL of 30% solution. How many mL of 50% solution are needed?',
    choices:['20 mL','30 mL','45 mL','60 mL'],
    correctIndex:1,
    explanation:'x + y = 90 and 0.2x + 0.5y = 27. Substitute x = 90−y: 18 + 0.3y = 27 → y = 30 mL.',
    hints:['Write equations for volume and acid content','x + y = 90 and 0.2x + 0.5y = 0.3(90) = 27','Substitute x = 90 − y into the acid equation'],
    examTag:'ACT' },

  { id:'sy-3-3', conceptId:'systems_of_linear_equations', level:3,
    question:'The sum of the digits of a 2-digit number is 9. Reversing the digits gives a number 27 more than the original. What is the original number?',
    choices:['27','36','45','54'],
    correctIndex:1,
    explanation:'Let tens = t, units = u. t+u=9 and (10u+t)−(10t+u)=27 → 9(u−t)=27 → u−t=3. Solve: u=6, t=3. Number = 36.',
    hints:['Let t = tens digit, u = units digit','Equations: t+u=9 and the reversed number is 27 more','(10u+t) − (10t+u) = 9(u−t) = 27 → u−t = 3'],
    examTag:'ACT' },

  // ── ABSOLUTE VALUE ───────────────────────────────────────────────────────────

  // L1
  { id:'av-1-1', conceptId:'absolute_value', level:1,
    question:'What is  |−15| + |3|?',
    choices:['−18','−12','12','18'],
    correctIndex:3,
    explanation:'|−15| = 15 and |3| = 3. Sum = 18. Absolute value is always non-negative.',
    hints:['Absolute value removes the negative sign','|−15| = 15 (distance from zero)','Add the two absolute values'] },

  { id:'av-1-2', conceptId:'absolute_value', level:1,
    question:'Solve:  |x| = 8',
    choices:['x = 8 only','x = −8 only','x = 8 or x = −8','No solution'],
    correctIndex:2,
    explanation:'|x| = 8 means x is 8 units from zero: x = 8 or x = −8.',
    hints:['Absolute value asks: what values are 8 units from zero?','There are TWO directions on the number line','x = 8 (right) and x = −8 (left)'],
    examTag:'ACT' },

  { id:'av-1-3', conceptId:'absolute_value', level:1,
    question:'Solve:  |x − 2| = 5',
    choices:['x = 3 only','x = 7 only','x = 7 or x = −3','x = 3 or x = 7'],
    correctIndex:2,
    explanation:'Split into two cases: x − 2 = 5 → x = 7, and x − 2 = −5 → x = −3.',
    hints:['Set up two equations: x − 2 = 5 and x − 2 = −5','Solve each separately','Case 1 gives x = 7, Case 2 gives x = −3'] },

  { id:'av-1-4', conceptId:'absolute_value', level:1,
    question:'Solve:  |2x + 6| = 10',
    choices:['x = 2 only','x = 2 or x = −8','x = 8 or x = −2','x = 4 or x = −8'],
    correctIndex:1,
    explanation:'Case 1: 2x + 6 = 10 → 2x = 4 → x = 2. Case 2: 2x + 6 = −10 → 2x = −16 → x = −8.',
    hints:['Write two equations: 2x+6 = 10 and 2x+6 = −10','Solve each independently','x = 2 or x = −8'] },

  // L2
  { id:'av-2-1', conceptId:'absolute_value', level:2,
    question:'Solve:  |2x − 4| ≤ 6',
    choices:['x ≤ 5','−1 ≤ x ≤ 5','x ≥ −1 or x ≥ 5','x < −1 or x > 5'],
    correctIndex:1,
    explanation:'|expression| ≤ a means −a ≤ expression ≤ a. So −6 ≤ 2x−4 ≤ 6 → −2 ≤ 2x ≤ 10 → −1 ≤ x ≤ 5.',
    hints:['|2x−4| ≤ 6 means −6 ≤ 2x−4 ≤ 6 (sandwich)','Add 4 to all three parts: −2 ≤ 2x ≤ 10','Divide all parts by 2'],
    examTag:'ACT' },

  { id:'av-2-2', conceptId:'absolute_value', level:2,
    question:'Solve:  |x + 5| > 3',
    choices:['−8 < x < −2','x > −2 only','x < −8 or x > −2','x < −2 or x > −8'],
    correctIndex:2,
    explanation:'|expression| > a means expression > a OR expression < −a. So x+5 > 3 → x > −2, or x+5 < −3 → x < −8.',
    hints:['|x+5| > 3 creates TWO separate inequalities','Case 1: x+5 > 3 → x > −2','Case 2: x+5 < −3 → x < −8'] },

  { id:'av-2-3', conceptId:'absolute_value', level:2,
    question:'A city\'s temperature T (°F) satisfies |T − 65| ≤ 10. Which shows the full temperature range?',
    choices:['T ≥ 55 only','55 ≤ T ≤ 75','T ≤ 75 only','60 ≤ T ≤ 70'],
    correctIndex:1,
    explanation:'|T − 65| ≤ 10 → −10 ≤ T − 65 ≤ 10 → 55 ≤ T ≤ 75. The temperature stays within 10° of 65°.',
    hints:['This says T is within 10 degrees of 65','Rewrite: −10 ≤ T − 65 ≤ 10','Add 65 to all parts'],
    examTag:'ACT' },

  { id:'av-2-4', conceptId:'absolute_value', level:2,
    question:'Solve:  |3x − 9| = 6',
    choices:['x = 1 or x = 5','x = 1 or x = 3','x = 5 only','x = 1 only'],
    correctIndex:0,
    explanation:'Case 1: 3x − 9 = 6 → 3x = 15 → x = 5. Case 2: 3x − 9 = −6 → 3x = 3 → x = 1.',
    hints:['Set up two cases: 3x−9 = 6 and 3x−9 = −6','For case 1: add 9 → 3x = 15 → x = 5','For case 2: add 9 → 3x = 3 → x = 1'] },

  // L3
  { id:'av-3-1', conceptId:'absolute_value', level:3,
    question:'Solve:  |2x − 3| = |x + 4|',
    choices:['x = 7 only','x = −1/3 only','x = 7 or x = −1/3','x = −7 or x = 1/3'],
    correctIndex:2,
    explanation:'Two cases: (1) 2x−3 = x+4 → x = 7. (2) 2x−3 = −(x+4) → 3x = −1 → x = −1/3.',
    hints:['When two absolute values are equal: either the expressions are equal OR they\'re negatives of each other','Case 1: 2x−3 = x+4','Case 2: 2x−3 = −(x+4) = −x−4 → solve for x'],
    examTag:'IB' },

  { id:'av-3-2', conceptId:'absolute_value', level:3,
    question:'Solve:  2|x + 1| − 3 = 7',
    choices:['x = 4 or x = −6','x = 4 only','x = 5 or x = −7','x = 2 or x = −4'],
    correctIndex:0,
    explanation:'Isolate the absolute value first: 2|x+1| = 10 → |x+1| = 5. Then x+1 = 5 → x = 4, or x+1 = −5 → x = −6.',
    hints:['Isolate |x+1| before splitting into cases','Add 3, then divide by 2: |x+1| = 5','Now split: x+1 = 5 or x+1 = −5'],
    examTag:'ACT' },

  { id:'av-3-3', conceptId:'absolute_value', level:3,
    question:'How many integers n satisfy  |n − 5| < 3?',
    choices:['3','4','5','6'],
    correctIndex:2,
    explanation:'|n−5| < 3 → −3 < n−5 < 3 → 2 < n < 8. Integers: {3, 4, 5, 6, 7} — that\'s 5 integers.',
    hints:['Rewrite as a compound inequality: −3 < n−5 < 3','Add 5 to all parts: 2 < n < 8','List the integers strictly between 2 and 8'],
    examTag:'IB' },

  // ── LINEAR INEQUALITIES ──────────────────────────────────────────────────────

  // L1
  { id:'li-1-1', conceptId:'linear_inequalities', level:1,
    question:'Solve:  3x − 5 > 7',
    choices:['x > 4','x > 2','x < 4','x > 12'],
    correctIndex:0,
    explanation:'Add 5: 3x > 12. Divide by 3: x > 4. (Positive divisor — no sign flip.)',
    hints:['Add 5 to both sides','Divide both sides by 3 (positive — no flip)','3x > 12 → x > 4'] },

  { id:'li-1-2', conceptId:'linear_inequalities', level:1,
    question:'Solve:  −2x ≤ 8',
    choices:['x ≤ −4','x ≥ −4','x ≤ 4','x ≥ 4'],
    correctIndex:1,
    explanation:'Divide by −2. FLIP the sign because dividing by a NEGATIVE: x ≥ −4.',
    hints:['Divide both sides by −2','CRITICAL: dividing by a negative number flips the inequality sign','−2x ≤ 8 → x ≥ −4'],
    examTag:'ACT' },

  { id:'li-1-3', conceptId:'linear_inequalities', level:1,
    question:'Solve:  x/3 + 1 < 4',
    choices:['x < 1','x < 9','x < 15','x < 3'],
    correctIndex:1,
    explanation:'Subtract 1: x/3 < 3. Multiply by 3 (positive — no flip): x < 9.',
    hints:['Subtract 1 from both sides first','Then multiply both sides by 3','x/3 < 3 → x < 9'] },

  { id:'li-1-4', conceptId:'linear_inequalities', level:1,
    question:'Which correctly solves  −4x > 20?',
    choices:['x > −5','x < −5','x > 5','x < 5'],
    correctIndex:1,
    explanation:'Divide both sides by −4. Dividing by negative → FLIP the sign: x < −5.',
    hints:['Divide both sides by −4','Remember: dividing by a negative number flips the sign','−4x > 20 → x < −5'],
    examTag:'ACT' },

  // L2
  { id:'li-2-1', conceptId:'linear_inequalities', level:2,
    question:'Solve the compound inequality:  −4 < 3x + 2 ≤ 11',
    choices:['−2 < x ≤ 3','−2 ≤ x ≤ 3','x > −2','−6 < x ≤ 9'],
    correctIndex:0,
    explanation:'Subtract 2 from all parts: −6 < 3x ≤ 9. Divide all parts by 3: −2 < x ≤ 3.',
    hints:['Apply operations to all THREE parts simultaneously','Subtract 2: −6 < 3x ≤ 9','Divide by 3: −2 < x ≤ 3'],
    examTag:'ACT' },

  { id:'li-2-2', conceptId:'linear_inequalities', level:2,
    question:'Luis has $80 saved and earns $15 per hour. He needs at least $200. What is the minimum number of full hours he must work?',
    choices:['6','7','8','9'],
    correctIndex:2,
    explanation:'Set up: 80 + 15h ≥ 200 → 15h ≥ 120 → h ≥ 8. He needs at least 8 hours.',
    hints:['Write: savings + earnings ≥ goal','80 + 15h ≥ 200','Subtract 80: 15h ≥ 120 → h ≥ 8'],
    examTag:'ACT' },

  { id:'li-2-3', conceptId:'linear_inequalities', level:2,
    question:'Solve:  2(3x − 1) > 4(x + 2)',
    choices:['x > 1','x > 3','x > 5','x > 7'],
    correctIndex:2,
    explanation:'Expand: 6x − 2 > 4x + 8. Subtract 4x: 2x − 2 > 8. Add 2: 2x > 10. Divide by 2: x > 5.',
    hints:['Distribute on both sides first','6x − 2 > 4x + 8','Subtract 4x, then isolate x'] },

  // L3
  { id:'li-3-1', conceptId:'linear_inequalities', level:3,
    question:'Solve:  −1 ≤ (2x − 3)/3 ≤ 5',
    choices:['0 ≤ x ≤ 9','0 < x < 9','−3 ≤ x ≤ 15','1 ≤ x ≤ 7'],
    correctIndex:0,
    explanation:'Multiply all parts by 3: −3 ≤ 2x−3 ≤ 15. Add 3: 0 ≤ 2x ≤ 18. Divide by 2: 0 ≤ x ≤ 9.',
    hints:['Multiply all three parts by 3 to clear the denominator','Add 3 to all parts','Divide all parts by 2'],
    examTag:'IB' },

  { id:'li-3-2', conceptId:'linear_inequalities', level:3,
    question:'What is the largest integer satisfying  3(2x − 4) ≤ 2(x + 7)?',
    choices:['5','6','7','8'],
    correctIndex:1,
    explanation:'Expand: 6x − 12 ≤ 2x + 14. Subtract 2x: 4x − 12 ≤ 14. Add 12: 4x ≤ 26. Divide: x ≤ 6.5. Largest integer is 6.',
    hints:['Distribute both sides first','Collect x terms on the left: 4x ≤ 26','x ≤ 6.5 — what is the largest whole number at or below 6.5?'],
    examTag:'ACT' },

  { id:'li-3-3', conceptId:'linear_inequalities', level:3,
    question:'The perimeter of a rectangle must be at most 60 cm. The length is twice the width. What is the maximum possible width?',
    choices:['8 cm','10 cm','12 cm','15 cm'],
    correctIndex:1,
    explanation:'Let w = width, L = 2w. Perimeter: 2(w + 2w) ≤ 60 → 6w ≤ 60 → w ≤ 10. Max width = 10 cm.',
    hints:['Let w = width, then length = 2w','Write the perimeter inequality: 2(w + 2w) ≤ 60','Simplify: 6w ≤ 60'],
    examTag:'ACT' },

  // ── POLYNOMIALS ──────────────────────────────────────────────────────────────

  // L1
  { id:'po-1-1', conceptId:'polynomials', level:1,
    question:'Expand:  (x + 4)(x − 3)',
    choices:['x² + x − 12','x² − x − 12','x² + 7x − 12','x² − 12'],
    correctIndex:0,
    explanation:'FOIL: x·x + x·(−3) + 4·x + 4·(−3) = x² − 3x + 4x − 12 = x² + x − 12.',
    hints:['Use FOIL: First, Outer, Inner, Last','First: x·x = x², Last: 4·(−3) = −12','Outer + Inner: −3x + 4x = +x'] },

  { id:'po-1-2', conceptId:'polynomials', level:1,
    question:'Expand:  (2x + 5)(x − 2)',
    choices:['2x² + x − 10','2x² − x − 10','2x² + x + 10','2x² + 9x − 10'],
    correctIndex:0,
    explanation:'FOIL: 2x·x + 2x·(−2) + 5·x + 5·(−2) = 2x² − 4x + 5x − 10 = 2x² + x − 10.',
    hints:['FOIL each term pair','2x·x = 2x², 5·(−2) = −10','Middle terms: −4x + 5x = +x'] },

  { id:'po-1-3', conceptId:'polynomials', level:1,
    question:'What is the degree of  5x³ − 2x⁴ + x − 7?',
    choices:['1','3','4','5'],
    correctIndex:2,
    explanation:'The degree is the highest exponent present. Scanning all terms: 3, 4, 1, 0. Highest is 4.',
    hints:['Look at the exponent on each term','Find the largest exponent','−2x⁴ has exponent 4'] },

  { id:'po-1-4', conceptId:'polynomials', level:1,
    question:'Expand:  (x + 3)²',
    choices:['x² + 9','x² + 3x + 9','x² + 6x + 9','x² + 6x + 6'],
    correctIndex:2,
    explanation:'(a+b)² = a² + 2ab + b². So (x+3)² = x² + 2(x)(3) + 9 = x² + 6x + 9.',
    hints:['(a+b)² = a² + 2ab + b²','Here a = x and b = 3','Middle term: 2·x·3 = 6x'] },

  // L2
  { id:'po-2-1', conceptId:'polynomials', level:2,
    question:'What is the remainder when  x³ − 3x² + 4x − 5  is divided by  (x − 2)?',
    choices:['−3','−1','1','3'],
    correctIndex:1,
    explanation:'Remainder theorem: remainder = f(2) = 8 − 12 + 8 − 5 = −1.',
    hints:['Remainder theorem: the remainder when dividing by (x−k) is f(k)','Evaluate f(2): substitute x = 2','2³ − 3(2²) + 4(2) − 5 = 8 − 12 + 8 − 5'],
    examTag:'IB' },

  { id:'po-2-2', conceptId:'polynomials', level:2,
    question:'Is  (x + 2)  a factor of  x³ + 3x² − 4?',
    choices:['Yes, because f(2) = 0','No, because f(2) ≠ 0','Yes, because f(−2) = 0','No, because f(−2) ≠ 0'],
    correctIndex:2,
    explanation:'Factor theorem: (x+2) is a factor if f(−2) = 0. f(−2) = −8 + 12 − 4 = 0 ✓. Yes, it is a factor.',
    hints:['Factor theorem: (x−k) is a factor if f(k) = 0','For (x+2), test x = −2','f(−2) = (−2)³ + 3(−2)² − 4 = −8 + 12 − 4 = 0'],
    examTag:'IB' },

  { id:'po-2-3', conceptId:'polynomials', level:2,
    question:'If  p(x) = 2x³ − x² + 3x + k  and  p(1) = 5,  find k.',
    choices:['k = 0','k = 1','k = 2','k = 4'],
    correctIndex:1,
    explanation:'p(1) = 2(1) − 1 + 3 + k = 4 + k = 5 → k = 1.',
    hints:['Substitute x = 1 into p(x)','p(1) = 2 − 1 + 3 + k = 4 + k','Set 4 + k = 5'] },

  // L3
  { id:'po-3-1', conceptId:'polynomials', level:3,
    question:'If  x = 3  is a root of  2x³ − kx² + 5x − 6 = 0,  what is k?',
    choices:['5','7','9','11'],
    correctIndex:1,
    explanation:'Substitute x = 3: 2(27) − 9k + 15 − 6 = 0 → 54 − 9k + 9 = 0 → 9k = 63 → k = 7.',
    hints:['If x = 3 is a root, then substituting x = 3 makes the equation equal 0','2(3³) − k(3²) + 5(3) − 6 = 0','54 − 9k + 15 − 6 = 0 → solve for k'],
    examTag:'IB' },

  { id:'po-3-2', conceptId:'polynomials', level:3,
    question:'Expand:  (x − 2)³',
    choices:['x³ − 6x² + 12x − 8','x³ − 8','x³ − 6x² − 12x − 8','x³ + 6x² − 12x − 8'],
    correctIndex:0,
    explanation:'Use (a−b)³ = a³ − 3a²b + 3ab² − b³ with a=x, b=2: x³ − 6x² + 12x − 8.',
    hints:['(a−b)³ = a³ − 3a²b + 3ab² − b³','Here a = x and b = 2','Terms: x³, −3x²(2) = −6x², 3x(4) = 12x, −8'] },

  { id:'po-3-3', conceptId:'polynomials', level:3,
    question:'When  2x³ + 3x² − 11x − 6  is divided by  (x + 3),  what is the quotient?',
    choices:['2x² − 3x − 2','2x² + 3x − 2','2x² − 9x − 2','x² − 3x − 2'],
    correctIndex:0,
    explanation:'Synthetic division with root −3: coefficients 2, 3, −11, −6 → 2, −3, −2, 0. Quotient: 2x² − 3x − 2.',
    hints:['Use synthetic division with x = −3','Start with coefficients: 2 | 3 | −11 | −6','Bring down 2, multiply by −3, add to next coefficient'],
    examTag:'ACT' },

  // ── RATIONAL EXPRESSIONS ─────────────────────────────────────────────────────

  // L1
  { id:'re-1-1', conceptId:'rational_expressions', level:1,
    question:'Simplify:  (x² − 9) / (x + 3)',
    choices:['x − 3','x + 3','x − 9','(x+3)(x−3)'],
    correctIndex:0,
    explanation:'Factor: (x+3)(x−3) / (x+3) = x − 3, provided x ≠ −3.',
    hints:['Factor the numerator first: x² − 9 = (x+3)(x−3)','Cancel the common factor (x+3)','State restriction: x ≠ −3'] },

  { id:'re-1-2', conceptId:'rational_expressions', level:1,
    question:'For what values of x is  (x + 2)/(x² − 16)  undefined?',
    choices:['x = 4 only','x = −4 only','x = 4 or x = −4','x = 2 or x = −2'],
    correctIndex:2,
    explanation:'A fraction is undefined when the denominator = 0. x²−16 = 0 → (x+4)(x−4) = 0 → x = 4 or x = −4.',
    hints:['Set the denominator equal to zero','x² − 16 = 0 → x² = 16','Take the square root: x = ±4'] },

  { id:'re-1-3', conceptId:'rational_expressions', level:1,
    question:'Simplify:  (6x³) / (9x²)',
    choices:['2x/3','3x/2','6x/9','2x²/3'],
    correctIndex:0,
    explanation:'Cancel common factors: (6x³)/(9x²) = (6/9)(x³/x²) = (2/3)(x) = 2x/3.',
    hints:['Simplify the coefficients: 6/9 = 2/3','Simplify the x terms: x³/x² = x','Combine: (2/3)·x = 2x/3'] },

  // L2
  { id:'re-2-1', conceptId:'rational_expressions', level:2,
    question:'Simplify:  (x² + 5x + 6) / (x² − x − 6)',
    choices:['(x+3)/(x−3)','(x+2)/(x−3)','(x+3)/(x+2)','1'],
    correctIndex:1,
    explanation:'Factor: numerator = (x+2)(x+3). Denominator = (x+3)(x−2). Cancel (x+3): result = (x+2)/(x−2), x ≠ −3.',
    hints:['Factor both the numerator and denominator','Numerator: (x+2)(x+3). Denominator: (x+3)(x−2)','Cancel the common factor (x+3)'],
    examTag:'SAT' },

  { id:'re-2-2', conceptId:'rational_expressions', level:2,
    question:'Solve:  3/(x − 1) = 6/(x + 2)',
    choices:['x = 3','x = 4','x = 5','x = 6'],
    correctIndex:1,
    explanation:'Cross-multiply: 3(x+2) = 6(x−1) → 3x+6 = 6x−6 → −3x = −12 → x = 4.',
    hints:['Cross-multiply to clear the fractions','3(x+2) = 6(x−1)','Expand and solve: 3x+6 = 6x−6'] },

  { id:'re-2-3', conceptId:'rational_expressions', level:2,
    question:'Simplify:  2/(x + 1) + 3/(x − 1)',
    choices:['5/(x²−1)','(5x+1)/(x²−1)','5/(2x)','(5x−1)/(x²−1)'],
    correctIndex:1,
    explanation:'LCD = (x+1)(x−1). Rewrite: [2(x−1) + 3(x+1)] / (x²−1) = (2x−2+3x+3)/(x²−1) = (5x+1)/(x²−1).',
    hints:['Find the LCD: (x+1)(x−1) = x²−1','Rewrite each fraction with the LCD','Combine numerators: 2(x−1) + 3(x+1)'],
    examTag:'ACT' },

  // L3
  { id:'re-3-1', conceptId:'rational_expressions', level:3,
    question:'Solve:  3/(x − 2) + 1/(x + 2) = 4/(x² − 4)',
    choices:['x = 0','x = 1','x = 2 (extraneous — no solution)','No solution'],
    correctIndex:0,
    explanation:'Multiply by (x−2)(x+2): 3(x+2) + (x−2) = 4 → 4x+4 = 4 → x = 0. Check: x=0 makes no denominator zero. x = 0.',
    hints:['Multiply every term by (x−2)(x+2) to clear denominators','Left side: 3(x+2) + (x−2) = 4x+4','4x+4 = 4 → x = 0; verify x=0 doesn\'t make any denominator zero'],
    examTag:'IB' },

  { id:'re-3-2', conceptId:'rational_expressions', level:3,
    question:'Find all values of x such that  (x² − 3x − 4)/(x² − 2x − 8) = 0',
    choices:['x = 4 or x = −1','x = −1 only','x = 4 only','x = −2 or x = 4'],
    correctIndex:1,
    explanation:'A fraction = 0 when numerator = 0 AND denominator ≠ 0. Numerator: (x−4)(x+1) = 0 → x=4 or x=−1. Denominator: (x−4)(x+2) = 0 → x=4 or x=−2. x=4 is excluded. Answer: x = −1 only.',
    hints:['A fraction equals zero when the numerator equals zero (and denominator ≠ 0)','Factor both: numerator = (x−4)(x+1), denominator = (x−4)(x+2)','x=4 makes the denominator zero — must exclude it'],
    examTag:'IB' },

  { id:'re-3-3', conceptId:'rational_expressions', level:3,
    question:'Simplify:  [(x²−4)/(x²+x−6)] × [(x+3)/(x−2)]',
    choices:['(x+2)/(x−2)','(x−2)/(x+2)','1','(x+2)(x−2)²/(x+3)'],
    correctIndex:0,
    explanation:'Factor: (x+2)(x−2)/[(x+3)(x−2)] × (x+3)/(x−2) = (x+2)(x−2)(x+3) / [(x+3)(x−2)(x−2)] = (x+2)/(x−2).',
    hints:['Factor everything first: x²−4 = (x+2)(x−2), x²+x−6 = (x+3)(x−2)','Write as a single fraction and cancel','(x−2) and (x+3) each cancel once'],
    examTag:'ACT' },
]

// ── Concept metadata ──────────────────────────────────────────────────────────

export const PRACTICE_CONCEPTS: { id: string; label: string; category: string; emoji: string }[] = [
  { id:'linear_equations',           label:'Linear Equations',     category:'Algebra',      emoji:'📈' },
  { id:'linear_inequalities',        label:'Linear Inequalities',  category:'Algebra',      emoji:'↔️' },
  { id:'absolute_value',             label:'Absolute Value',       category:'Algebra',      emoji:'📐' },
  { id:'quadratic_equations',        label:'Quadratic Equations',  category:'Algebra',      emoji:'🧮' },
  { id:'functions_basics',           label:'Functions',            category:'Algebra',      emoji:'⚡' },
  { id:'systems_of_linear_equations',label:'Systems of Equations', category:'Algebra',      emoji:'⚖️' },
  { id:'exponent_rules',             label:'Exponents',            category:'Algebra',      emoji:'🔢' },
  { id:'polynomials',                label:'Polynomials',          category:'Algebra',      emoji:'〽️' },
  { id:'rational_expressions',       label:'Rational Expressions', category:'Algebra',      emoji:'➗' },
  { id:'basic_probability',          label:'Probability',          category:'Statistics',   emoji:'🎲' },
]

export const LEVEL_META = {
  1: { label:'Foundation', sub:'Direct application',   xp:10, color:'#A8E063', colorSoft:'rgba(168,224,99,0.15)',  stars:1 },
  2: { label:'Applied',    sub:'Problem-solving',      xp:20, color:'#38BDF8', colorSoft:'rgba(56,189,248,0.15)', stars:2 },
  3: { label:'Exam Ready', sub:'ACT / IB difficulty',  xp:35, color:'#F4A261', colorSoft:'rgba(244,162,97,0.15)', stars:3 },
}

// Return questions for a concept + level, shuffled, up to `count`
export function getQuestions(conceptId: string, level: 1|2|3, count = 5): Question[] {
  const pool = Q.filter(q => q.conceptId === conceptId && q.level === level)
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// Total question count for a concept + level
export function questionCount(conceptId: string, level: 1|2|3): number {
  return Q.filter(q => q.conceptId === conceptId && q.level === level).length
}
