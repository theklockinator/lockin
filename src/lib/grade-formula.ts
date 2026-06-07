/**
 * Grade formula: y = <expr>, where x is marks % and y is the grade label.
 *
 * Supports math (min, max, floor, ceil, round, abs, ^, pow, exp, ln, log, log[a](b)),
 * CHAR(n) → ASCII code n,
 * LABEL(i,"A*","A",…) → 1-based pick from labels, piecewise, k-expr"suffix".
 */

export type FormulaParseError = { message: string; index?: number }

export type FormulaFunctionDoc = {
  name: string
  syntax: string
  description: string
}

/** Reference for formula editor help — keep in sync with the evaluator. */
export const FORMULA_FUNCTION_REFERENCE: FormulaFunctionDoc[] = [
  { name: 'x', syntax: 'x', description: 'Marks % (0–100), the input value.' },
  {
    name: 'y = …',
    syntax: 'y = <expr>',
    description: 'Optional prefix; only the expression after = is evaluated.',
  },
  {
    name: '+ − * / ^',
    syntax: 'a + b, a - b, a * b, a / b, a ^ b',
    description:
      'Arithmetic. ^ is right-associative power. Implicit multiply: 0.08x and 3(x+1) mean 0.08 * x and 3 * (x+1).',
  },
  {
    name: 'pow',
    syntax: 'pow(a, b)',
    description: 'a raised to the power b (same as a ^ b).',
  },
  {
    name: 'exp',
    syntax: 'exp(n)',
    description: 'e raised to the power n.',
  },
  {
    name: 'ln',
    syntax: 'ln(n)',
    description: 'Natural logarithm. Undefined for n ≤ 0 returns 0.',
  },
  {
    name: 'log',
    syntax: 'log(n), log[a](b)',
    description:
      'log(n) is base 10. log[a](b) is the logarithm of b to base a. Undefined inputs return 0.',
  },
  {
    name: 'min',
    syntax: 'min(a, b, …)',
    description: 'Smallest of the given numbers.',
  },
  {
    name: 'max',
    syntax: 'max(a, b, …)',
    description: 'Largest of the given numbers.',
  },
  {
    name: 'floor',
    syntax: 'floor(n)',
    description: 'Round down to integer.',
  },
  {
    name: 'ceil',
    syntax: 'ceil(n)',
    description: 'Round up to integer.',
  },
  {
    name: 'round',
    syntax: 'round(n), round(x, n)',
    description:
      'round(n) rounds to integer; round(x, n) rounds to the nearest 10^-n (n may be negative or fractional).',
  },
  {
    name: 'abs',
    syntax: 'abs(n)',
    description: 'Absolute value.',
  },
  {
    name: 'CHAR',
    syntax: 'CHAR(code)',
    description: 'Character from raw ASCII code (e.g. CHAR(65) → A).',
  },
  {
    name: 'LABEL',
    syntax: 'LABEL(i, "A*", "A", "B", …)',
    description: 'Pick label by 1-based index i from the listed strings.',
  },
  {
    name: 'piecewise',
    syntax: '{0<=x<30:x, x>=90:8082.01} or {x<50:"F", "U"}',
    description:
      'Conditional branches; each branch is grouped separately in the preview. Conditions: x<50, 0<=x<30, 40<=x<160/3, (280/3)<=x<100, etc. Default (else) may be numeric or quoted.',
  },
  {
    name: 'k-format',
    syntax: 'k0.04x" GPA"',
    description: 'Evaluate expression, format as number, append quoted suffix.',
  },
  {
    name: 'strings',
    syntax: '"A*" or \'A*\'',
    description: 'Quoted grade labels (symbols and spaces allowed).',
  },
]

type Expr =
  | { kind: 'num'; value: number }
  | { kind: 'var' }
  | { kind: 'str'; value: string }
  | { kind: 'bin'; op: '+' | '-' | '*' | '/' | '^'; left: Expr; right: Expr }
  | { kind: 'unary'; op: '-'; expr: Expr }
  | { kind: 'call'; name: string; args: Expr[] }
  | { kind: 'piecewise'; cases: PieceCase[] }
  | { kind: 'format'; expr: Expr; suffix: string }

type PieceCase = {
  condition: CompareCond | null
  value: Expr
}

type BoundOp = '<' | '<=' | '>' | '>='

type CompareCond = {
  op: BoundOp | '==' | '='
  value: number
  /** Chained range, e.g. 0<=x<30 → lower 0, lowerOp <=, op <, value 30 */
  lower?: number
  lowerOp?: BoundOp
}

type Token =
  | { type: 'num'; value: number }
  | { type: 'ident'; name: string }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'lbrace' }
  | { type: 'rbrace' }
  | { type: 'lbracket' }
  | { type: 'rbracket' }
  | { type: 'comma' }
  | { type: 'colon' }
  | { type: 'str'; value: string }
  | { type: 'eof' }

function tokenize(input: string): Token[] | FormulaParseError {
  const tokens: Token[] = []
  let i = 0
  const s = input.trim()

  while (i < s.length) {
    const ch = s[i]!
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' })
      i++
      continue
    }
    if (ch === '{') {
      tokens.push({ type: 'lbrace' })
      i++
      continue
    }
    if (ch === '}') {
      tokens.push({ type: 'rbrace' })
      i++
      continue
    }
    if (ch === '[') {
      tokens.push({ type: 'lbracket' })
      i++
      continue
    }
    if (ch === ']') {
      tokens.push({ type: 'rbracket' })
      i++
      continue
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' })
      i++
      continue
    }
    if (ch === ':') {
      tokens.push({ type: 'colon' })
      i++
      continue
    }
    if (ch === '"' || ch === "'") {
      const quote = ch
      i++
      let value = ''
      while (i < s.length && s[i] !== quote) {
        value += s[i]
        i++
      }
      if (i >= s.length) return { message: 'Unclosed string literal' }
      i++
      tokens.push({ type: 'str', value })
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let num = ''
      while (i < s.length && /[0-9.]/.test(s[i]!)) {
        num += s[i]
        i++
      }
      const value = Number.parseFloat(num)
      if (!Number.isFinite(value)) return { message: `Invalid number: ${num}` }
      tokens.push({ type: 'num', value })
      continue
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let name = ''
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i]!)) {
        name += s[i]
        i++
        if (
          name.length === 1 &&
          /^[kK]$/.test(name) &&
          i < s.length &&
          /[0-9.(xX]/.test(s[i]!)
        ) {
          break
        }
      }
      tokens.push({ type: 'ident', name })
      continue
    }
    const two = s.slice(i, i + 2)
    if (two === '<=' || two === '>=' || two === '==' || two === '**') {
      tokens.push({ type: 'op', value: two === '**' ? '^' : two })
      i += 2
      continue
    }
    if ('+-*/<>=^'.includes(ch)) {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }
    return { message: `Unexpected character "${ch}"`, index: i }
  }
  tokens.push({ type: 'eof' })
  return tokens
}

function exprContainsVar(expr: Expr): boolean {
  switch (expr.kind) {
    case 'var':
      return true
    case 'num':
    case 'str':
      return false
    case 'unary':
      return exprContainsVar(expr.expr)
    case 'bin':
      return exprContainsVar(expr.left) || exprContainsVar(expr.right)
    case 'call':
      return expr.args.some(exprContainsVar)
    case 'piecewise':
      return expr.cases.some((c) => exprContainsVar(c.value))
    case 'format':
      return exprContainsVar(expr.expr)
  }
}

class Parser {
  private pos = 0
  constructor(private tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos] ?? { type: 'eof' }
  }

  private peekIdentName(): string | null {
    const t = this.peek()
    return t.type === 'ident' ? t.name : null
  }

  private peekAhead(offset: number): Token {
    return this.tokens[this.pos + offset] ?? { type: 'eof' }
  }

  private isRangeConditionAhead(): boolean {
    const t = this.peek().type
    if (t !== 'num' && t !== 'lparen') return false
    const saved = this.pos
    const lower = this.parseConstantBound()
    if (typeof lower === 'object' && 'message' in lower) {
      this.pos = saved
      return false
    }
    const next = this.peek()
    const xTok = this.peekAhead(1)
    const valid =
      next.type === 'op' &&
      ['<', '<=', '>', '>='].includes(next.value) &&
      xTok.type === 'ident' &&
      xTok.name === 'x'
    this.pos = saved
    return valid
  }

  /** Constant bound for piecewise conditions, e.g. 40, 160/3, (280/3). */
  private parseConstantBound(): number | FormulaParseError {
    const expr = this.parseExpr()
    if ('message' in expr) return expr
    if (exprContainsVar(expr)) {
      return { message: 'Bound expressions must not use x' }
    }
    const value = Number(evalExpr(expr, 0))
    if (!Number.isFinite(value)) {
      return { message: 'Invalid bound value' }
    }
    return value
  }

  private consume(): Token {
    return this.tokens[this.pos++] ?? { type: 'eof' }
  }

  private expect(type: Token['type'], label?: string): Token | FormulaParseError {
    const t = this.consume()
    if (t.type !== type) {
      return { message: `Expected ${label ?? type}` }
    }
    return t
  }

  parse(): Expr | FormulaParseError {
    const expr = this.parseExpr()
    if ('message' in expr) return expr
    if (this.peek().type !== 'eof') {
      return { message: 'Unexpected tokens after expression' }
    }
    return expr
  }

  private parseExpr(): Expr | FormulaParseError {
    return this.parseAddSub()
  }

  private parseAddSub(): Expr | FormulaParseError {
    let left = this.parseMulDiv()
    if ('message' in left) return left
    while (this.peek().type === 'op' && (this.peek() as { value: string }).value.match(/^[+-]$/)) {
      const op = (this.consume() as { type: 'op'; value: string }).value as '+' | '-'
      const right = this.parseMulDiv()
      if ('message' in right) return right
      left = { kind: 'bin', op, left, right }
    }
    return left
  }

  private parseMulDiv(): Expr | FormulaParseError {
    let left = this.parsePow()
    if ('message' in left) return left
    while (true) {
      if (this.peek().type === 'op' && (this.peek() as { value: string }).value.match(/^[*/]$/)) {
        const op = (this.consume() as { type: 'op'; value: string }).value as '*' | '/'
        const right = this.parsePow()
        if ('message' in right) return right
        left = { kind: 'bin', op, left, right }
        continue
      }
      if (this.peek().type === 'lparen') {
        const right = this.parsePow()
        if ('message' in right) return right
        left = { kind: 'bin', op: '*', left, right }
        continue
      }
      break
    }
    return left
  }

  private parsePow(): Expr | FormulaParseError {
    let left = this.parseUnary()
    if ('message' in left) return left
    if (this.peek().type === 'op' && (this.peek() as { value: string }).value === '^') {
      this.consume()
      const right = this.parsePow()
      if ('message' in right) return right
      return { kind: 'bin', op: '^', left, right }
    }
    return left
  }

  private parseUnary(): Expr | FormulaParseError {
    if (this.peek().type === 'op' && (this.peek() as { value: string }).value === '-') {
      this.consume()
      const expr = this.parseUnary()
      if ('message' in expr) return expr
      return { kind: 'unary', op: '-', expr }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Expr | FormulaParseError {
    const t = this.peek()

    if (t.type === 'ident' && t.name.toLowerCase() === 'k') {
      this.consume()
      const expr = this.parseFormatExpr()
      if ('message' in expr) return expr
      if (this.peek().type !== 'str') {
        return { message: 'Expected quoted suffix after k-format expression' }
      }
      const strTok = this.consume() as { type: 'str'; value: string }
      return { kind: 'format', expr, suffix: strTok.value }
    }

    if (t.type === 'lbrace') {
      return this.parsePiecewise()
    }

    if (t.type === 'num') {
      this.consume()
      let expr: Expr = { kind: 'num', value: t.value }
      if (this.peekIdentName() === 'x') {
        this.consume()
        expr = { kind: 'bin', op: '*', left: expr, right: { kind: 'var' } }
      }
      return expr
    }

    if (t.type === 'ident' && t.name === 'x') {
      this.consume()
      return { kind: 'var' }
    }

    if (t.type === 'str') {
      this.consume()
      return { kind: 'str', value: t.value }
    }

    if (t.type === 'ident') {
      const name = t.name
      this.consume()

      if (name.toLowerCase() === 'log' && this.peek().type === 'lbracket') {
        this.consume()
        const base = this.parseExpr()
        if ('message' in base) return base
        const rb = this.expect('rbracket', ']')
        if ('message' in rb) return rb
        const lp = this.expect('lparen', '(')
        if ('message' in lp) return lp
        const value = this.parseExpr()
        if ('message' in value) return value
        const rp = this.expect('rparen', ')')
        if ('message' in rp) return rp
        return { kind: 'call', name: 'LOG', args: [base, value] }
      }

      const lp = this.expect('lparen', '(')
      if ('message' in lp) return lp
      const args: Expr[] = []
      if (this.peek().type !== 'rparen') {
        const first = this.parseExpr()
        if ('message' in first) return first
        args.push(first)
        while (this.peek().type === 'comma') {
          this.consume()
          const arg = this.parseExpr()
          if ('message' in arg) return arg
          args.push(arg)
        }
      }
      const rp = this.expect('rparen', ')')
      if ('message' in rp) return rp
      return { kind: 'call', name: name.toUpperCase(), args }
    }

    if (t.type === 'lparen') {
      this.consume()
      const expr = this.parseExpr()
      if ('message' in expr) return expr
      const rp = this.expect('rparen', ')')
      if ('message' in rp) return rp
      return expr
    }

    return { message: `Unexpected token in expression` }
  }

  /** Expression inside k-format until a quoted suffix (no nested k). */
  private parseFormatExpr(): Expr | FormulaParseError {
    return this.parseAddSub()
  }

  private parsePiecewise(): Expr | FormulaParseError {
    const lb = this.expect('lbrace', '{')
    if ('message' in lb) return lb
    const cases: PieceCase[] = []

    while (this.peek().type !== 'rbrace' && this.peek().type !== 'eof') {
      const cond = this.parseCondition()
      if (cond === 'needColon') {
        const value = this.parseExpr()
        if ('message' in value) return value
        cases.push({ condition: null, value })
        if (this.peek().type === 'comma') this.consume()
        continue
      }
      if (typeof cond === 'object' && 'message' in cond) return cond
      let value: Expr | FormulaParseError
      const colon = this.expect('colon', ':')
      if ('message' in colon) return colon
      value = this.parseExpr()
      if ('message' in value) return value
      cases.push({ condition: cond, value })

      if (this.peek().type === 'comma') this.consume()
    }

    const rb = this.expect('rbrace', '}')
    if ('message' in rb) return rb
    if (cases.length === 0) return { message: 'Empty piecewise' }
    return { kind: 'piecewise', cases }
  }

  private parseCondition():
    | CompareCond
    | 'needColon'
    | FormulaParseError {
    if (this.isRangeConditionAhead()) {
      const lower = this.parseConstantBound()
      if (typeof lower === 'object' && 'message' in lower) return lower
      if (this.peek().type !== 'op') {
        return { message: 'Expected comparison in range condition' }
      }
      const lowerOp = (this.consume() as { type: 'op'; value: string }).value
      if (!['<', '<=', '>', '>='].includes(lowerOp)) {
        return { message: `Invalid comparison operator: ${lowerOp}` }
      }
      if (this.peekIdentName() !== 'x') {
        return { message: 'Expected x in range condition' }
      }
      this.consume()
      if (this.peek().type !== 'op') {
        return { message: 'Expected comparison after x' }
      }
      const upperOp = (this.consume() as { type: 'op'; value: string }).value
      if (!['<', '<=', '>', '>='].includes(upperOp)) {
        return { message: `Invalid comparison operator: ${upperOp}` }
      }
      const upper = this.parseConstantBound()
      if (typeof upper === 'object' && 'message' in upper) return upper
      return {
        lower,
        lowerOp: lowerOp as BoundOp,
        op: upperOp as BoundOp,
        value: upper,
      }
    }

    if (this.peek().type === 'num' || this.peek().type === 'lparen') {
      return 'needColon'
    }
    if (this.peekIdentName() !== 'x') {
      return 'needColon'
    }
    this.consume()
    if (this.peek().type !== 'op') return { message: 'Expected comparison after x' }
    const op = (this.consume() as { type: 'op'; value: string }).value
    if (!['<', '<=', '>', '>=', '==', '='].includes(op)) {
      return { message: `Invalid comparison operator: ${op}` }
    }
    const bound = this.parseConstantBound()
    if (typeof bound === 'object' && 'message' in bound) return bound
    return {
      op: op as CompareCond['op'],
      value: bound,
    }
  }
}

const INPUT_PERCENT_SCALE = 10

function snapInputPercent(percent: number): number {
  return Math.round(Math.min(100, Math.max(0, percent)) * INPUT_PERCENT_SCALE) /
    INPUT_PERCENT_SCALE
}

function safePow(base: number, exp: number): number {
  if (!Number.isFinite(base) || !Number.isFinite(exp)) return 0
  if (Number.isInteger(exp) && exp >= 0 && exp <= 20) {
    const baseScaled = Math.round(base * INPUT_PERCENT_SCALE)
    if (Math.abs(base * INPUT_PERCENT_SCALE - baseScaled) < 1e-6) {
      let result = 1
      let b = baseScaled
      let e = exp
      while (e > 0) {
        if (e & 1) result *= b
        b *= b
        e >>= 1
      }
      return result / INPUT_PERCENT_SCALE ** exp
    }
  }
  const value = Math.pow(base, exp)
  return Number.isFinite(value) ? value : 0
}

function formatNumericGrade(n: number): string {
  if (!Number.isFinite(n)) return '0'
  for (let dp = 0; dp <= 8; dp++) {
    const snapped = Math.round(n * 10 ** dp) / 10 ** dp
    if (Math.abs(n - snapped) < 1e-6) {
      if (Number.isInteger(snapped)) return String(snapped)
      return String(snapped).replace(/\.?0+$/, '')
    }
  }
  const snapped = Math.round(n * 1e8) / 1e8
  if (Number.isInteger(snapped)) return String(snapped)
  return String(snapped).replace(/\.?0+$/, '')
}

function exprValueToGrade(value: string | number): string {
  return typeof value === 'string' ? value : formatNumericGrade(value)
}

/** Round x to the nearest multiple of 10^-n. */
function roundToPrecision(x: number, n: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(n)) return 0
  const unit = Math.pow(10, -n)
  if (!Number.isFinite(unit) || unit === 0) return 0
  return Math.round(x / unit) * unit
}

function safeLog(n: number, base?: number): number {
  if (n <= 0) return 0
  if (base !== undefined && (base <= 0 || Math.abs(base - 1) < 1e-9)) return 0
  const value = base === undefined ? Math.log(n) : Math.log(n) / Math.log(base)
  return Number.isFinite(value) ? value : 0
}

function compareBound(
  left: number,
  op: CompareCond['op'] | CompareCond['lowerOp'],
  right: number,
): boolean {
  switch (op) {
    case '<':
      return left < right
    case '<=':
      return left <= right
    case '>':
      return left > right
    case '>=':
      return left >= right
    case '==':
    case '=':
      return Math.abs(left - right) < 1e-9
    default:
      return false
  }
}

function evalCondition(cond: CompareCond, x: number): boolean {
  const upperOk = compareBound(x, cond.op, cond.value)
  if (cond.lower === undefined || cond.lowerOp === undefined) return upperOk
  const lowerOk = compareBound(cond.lower, cond.lowerOp, x)
  return lowerOk && upperOk
}

function evalExpr(expr: Expr, x: number): string | number {
  switch (expr.kind) {
    case 'num':
      return expr.value
    case 'var':
      return x
    case 'str':
      return expr.value
    case 'unary':
      return -Number(evalExpr(expr.expr, x))
    case 'bin': {
      const l = Number(evalExpr(expr.left, x))
      const r = Number(evalExpr(expr.right, x))
      switch (expr.op) {
        case '+':
          return l + r
        case '-':
          return l - r
        case '*':
          return l * r
        case '/':
          return r === 0 ? 0 : l / r
        case '^':
          return safePow(l, r)
      }
    }
    case 'call': {
      switch (expr.name) {
        case 'CHAR': {
          const code = Math.round(Number(evalExpr(expr.args[0]!, x)))
          return String.fromCharCode(code)
        }
        case 'LABEL': {
          if (expr.args.length < 2) return ''
          const index = Math.round(Number(evalExpr(expr.args[0]!, x)))
          const labels = expr.args.slice(1).map((arg) => {
            const v = evalExpr(arg, x)
            return typeof v === 'string' ? v : String(v)
          })
          if (labels.length === 0) return ''
          const pick =
            index < 1
              ? labels[0]!
              : index > labels.length
                ? labels[labels.length - 1]!
                : labels[index - 1]!
          return pick
        }
        case 'MIN':
        case 'MAX':
        case 'FLOOR':
        case 'CEIL':
        case 'ROUND':
        case 'ABS':
        case 'POW':
        case 'EXP':
        case 'LN':
        case 'LOG': {
          const args = expr.args.map((a) => Number(evalExpr(a, x)))
          switch (expr.name) {
            case 'MIN':
              return args.length === 0 ? 0 : Math.min(...args)
            case 'MAX':
              return args.length === 0 ? 0 : Math.max(...args)
            case 'FLOOR': {
              const n = args[0] ?? 0
              return Math.floor(n + 1e-9)
            }
            case 'CEIL':
              return Math.ceil(args[0] ?? 0)
            case 'ROUND':
              return args.length >= 2
                ? roundToPrecision(args[0] ?? 0, args[1] ?? 0)
                : Math.round(args[0] ?? 0)
            case 'ABS':
              return Math.abs(args[0] ?? 0)
            case 'POW':
              return safePow(args[0] ?? 0, args[1] ?? 0)
            case 'EXP': {
              const value = Math.exp(args[0] ?? 0)
              return Number.isFinite(value) ? value : 0
            }
            case 'LN':
              return safeLog(args[0] ?? 0)
            case 'LOG':
              return args.length >= 2
                ? safeLog(args[1] ?? 0, args[0])
                : safeLog(args[0] ?? 0, 10)
            default:
              return 0
          }
        }
        default:
          return 0
      }
    }
    case 'piecewise': {
      for (const c of expr.cases) {
        if (c.condition !== null && evalCondition(c.condition, x)) {
          return exprValueToGrade(evalExpr(c.value, x))
        }
      }
      for (let i = expr.cases.length - 1; i >= 0; i--) {
        const c = expr.cases[i]!
        if (c.condition === null) {
          return exprValueToGrade(evalExpr(c.value, x))
        }
      }
      const last = expr.cases[expr.cases.length - 1]!
      return exprValueToGrade(evalExpr(last.value, x))
    }
    case 'format': {
      const raw = evalExpr(expr.expr, x)
      const n = Number(raw)
      return `${formatNumericGrade(n)}${expr.suffix}`
    }
  }
}

export function parseGradeFormulaRhs(rhs: string): Expr | FormulaParseError {
  const tokens = tokenize(rhs)
  if ('message' in tokens) return tokens
  return new Parser(tokens).parse()
}

/** Parse full formula "y = ..." or bare RHS. */
export function parseGradeFormula(formula: string): Expr | FormulaParseError {
  const trimmed = formula.trim()
  const m = trimmed.match(/^y\s*=\s*(.+)$/i)
  const rhs = m ? m[1]!.trim() : trimmed
  return parseGradeFormulaRhs(rhs)
}

export function evaluateGradeFormula(
  formula: string,
  percent: number,
): { ok: true; grade: string } | { ok: false; error: string } {
  const parsed = parseGradeFormula(formula)
  if ('message' in parsed) {
    return { ok: false, error: parsed.message }
  }
  const x = snapInputPercent(percent)
  try {
    const result = evalExpr(parsed, x)
    const grade = exprValueToGrade(result)
    return { ok: true, grade }
  } catch {
    return { ok: false, error: 'Evaluation failed' }
  }
}

export type FormulaGradeBand = {
  grade: string
  fromPercent: number
  toPercent: number
}

const BAND_STEP_TENTHS = 1

type PiecewiseExpr = Extract<Expr, { kind: 'piecewise' }>

function findPiecewiseExpr(expr: Expr): PiecewiseExpr | null {
  if (expr.kind === 'piecewise') return expr
  switch (expr.kind) {
    case 'bin':
      return findPiecewiseExpr(expr.left) ?? findPiecewiseExpr(expr.right)
    case 'unary':
      return findPiecewiseExpr(expr.expr)
    case 'call':
      for (const arg of expr.args) {
        const found = findPiecewiseExpr(arg)
        if (found) return found
      }
      return null
    case 'format':
      return findPiecewiseExpr(expr.expr)
    default:
      return null
  }
}

function scanFormulaBandsByPiecewise(
  formula: string,
  piecewise: PiecewiseExpr,
  options: FormulaBandOptions,
): FormulaGradeBand[] | { error: string } {
  const ranges = piecewiseCaseRanges(piecewise.cases)
  const allBands: FormulaGradeBand[] = []
  for (const range of ranges) {
    const segment = scanFormulaBandsInRange(
      formula,
      range.fromPercent,
      range.toPercent,
    )
    if ('error' in segment) return segment
    allBands.push(...applyNumericGrouping(segment, options))
  }
  return allBands
}

function activePiecewiseCaseIndex(cases: PieceCase[], x: number): number {
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]!
    if (c.condition !== null && evalCondition(c.condition, x)) return i
  }
  for (let i = cases.length - 1; i >= 0; i--) {
    if (cases[i]!.condition === null) return i
  }
  return cases.length - 1
}

function piecewiseCaseRanges(
  cases: PieceCase[],
): { caseIndex: number; fromPercent: number; toPercent: number }[] {
  const ranges: {
    caseIndex: number
    fromPercent: number
    toPercent: number
  }[] = []
  let current: {
    caseIndex: number
    fromPercent: number
    toPercent: number
  } | null = null

  for (let p = 0; p <= 1000; p += BAND_STEP_TENTHS) {
    const percent = Math.round(p) / 10
    const caseIndex = activePiecewiseCaseIndex(cases, percent)
    if (!current || current.caseIndex !== caseIndex) {
      if (current) ranges.push(current)
      current = { caseIndex, fromPercent: percent, toPercent: percent }
    } else {
      current.toPercent = percent
    }
  }
  if (current) ranges.push(current)
  return ranges
}

function stepsToBands(
  steps: { percent: number; grade: string }[],
  rangeEndPercent = 100,
): FormulaGradeBand[] {
  const bands: FormulaGradeBand[] = []
  let i = 0

  while (i < steps.length) {
    const grade = steps[i]!.grade
    let j = i + 1
    while (j < steps.length && steps[j]!.grade === grade) j++
    const fromPercent = steps[i]!.percent
    const toPercent =
      j < steps.length
        ? Math.round((steps[j]!.percent - 0.1) * 10) / 10
        : rangeEndPercent
    bands.push({ grade, fromPercent, toPercent })
    i = j
  }

  return bands
}

/** Scan at 0.1% steps; band ends one step before the next grade change. */
function scanFormulaBandsInRange(
  formula: string,
  fromPercent: number,
  toPercent: number,
): FormulaGradeBand[] | { error: string } {
  const start = Math.round(fromPercent * 10)
  const end = Math.round(toPercent * 10)
  const steps: { percent: number; grade: string }[] = []

  for (let p = start; p <= end; p += BAND_STEP_TENTHS) {
    const percent = Math.round(p) / 10
    const ev = evaluateGradeFormula(formula, percent)
    if (!ev.ok) return { error: ev.error }
    steps.push({ percent, grade: ev.grade })
  }

  return stepsToBands(steps, toPercent)
}

function scanFormulaBands(
  formula: string,
): FormulaGradeBand[] | { error: string } {
  return scanFormulaBandsInRange(formula, 0, 100)
}

function applyNumericGrouping(
  bands: FormulaGradeBand[],
  options: FormulaBandOptions,
): FormulaGradeBand[] {
  if (options.groupNonLinear) {
    return mergeNumericGradeBands(bands, 'monotonic')
  }
  if (options.groupLinear !== false) {
    return mergeNumericGradeBands(bands, 'constantStep')
  }
  return bands
}

function parseNumericGradeLabel(
  grade: string,
): { num: number; suffix: string } | null {
  const m = grade.match(/^(-?\d+(?:\.\d+)?)(.*)$/)
  if (!m) return null
  const num = Number.parseFloat(m[1]!)
  if (!Number.isFinite(num)) return null
  return { num, suffix: m[2]! }
}

const NUMERIC_STEP_ABS_EPS = 1e-5
const NUMERIC_STEP_REL_EPS = 1e-4

/** Compare grade steps from formatted labels; allow float/format noise. */
function constantStepsMatch(expected: number, step: number): boolean {
  const scale = Math.max(Math.abs(expected), Math.abs(step), 1e-6)
  return Math.abs(step - expected) <= Math.max(NUMERIC_STEP_ABS_EPS, scale * NUMERIC_STEP_REL_EPS)
}

/** Merge adjacent numeric labels (same suffix, strictly rising). */
function mergeNumericGradeBands(
  bands: FormulaGradeBand[],
  mode: 'constantStep' | 'monotonic',
): FormulaGradeBand[] {
  if (bands.length <= 1) return bands

  const merged: FormulaGradeBand[] = []
  let i = 0

  while (i < bands.length) {
    const start = bands[i]!
    const startParsed = parseNumericGradeLabel(start.grade)
    if (!startParsed) {
      merged.push(start)
      i++
      continue
    }

    let j = i + 1
    let expectedStep: number | null = null
    while (j < bands.length) {
      const prev = bands[j - 1]!
      const curr = bands[j]!
      const prevParsed = parseNumericGradeLabel(prev.grade)
      const currParsed = parseNumericGradeLabel(curr.grade)
      if (
        !prevParsed ||
        !currParsed ||
        currParsed.suffix !== startParsed.suffix
      ) {
        break
      }
      const step = currParsed.num - prevParsed.num
      if (step <= 0) break
      if (mode === 'constantStep') {
        if (expectedStep === null) expectedStep = step
        else if (!constantStepsMatch(expectedStep, step)) break
      }
      j++
    }

    if (j === i + 1) {
      merged.push(start)
      i++
      continue
    }

    const end = bands[j - 1]!
    merged.push({
      grade:
        start.grade === end.grade
          ? start.grade
          : `${start.grade}–${end.grade}`,
      fromPercent: start.fromPercent,
      toPercent: end.toPercent,
    })
    i = j
  }

  return merged
}

export type FormulaBandOptions = {
  /** Merge constant-step numeric labels (e.g. 0GPA, 0.5GPA → 0GPA–4GPA). */
  groupLinear?: boolean
  /** Merge monotonic numeric labels with varying step (e.g. 0, 1, 4, 9 → 0–81). */
  groupNonLinear?: boolean
}

/** Grade bands across 0–100% wherever the formula output changes (0.1% precision). */
export function formulaGradeBands(
  formula: string,
  options: FormulaBandOptions = {},
): FormulaGradeBand[] | { error: string } {
  const parsed = parseGradeFormula(formula)
  if ('message' in parsed) return { error: parsed.message }

  const piecewise = findPiecewiseExpr(parsed)
  if (piecewise) {
    return scanFormulaBandsByPiecewise(formula, piecewise, options)
  }

  const bands = scanFormulaBands(formula)
  if ('error' in bands) return bands
  return applyNumericGrouping(bands, options)
}

export function formatFormulaBandPercent(n: number): string {
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function boundariesToPiecewiseFormula(
  boundaries: { grade: string; minPercent: number }[],
): string {
  const sorted = [...boundaries].sort((a, b) => b.minPercent - a.minPercent)
  const parts = sorted.map((b) => {
    const label = b.grade.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `x>=${b.minPercent}:"${label}"`
  })
  return `y = {${parts.join(',')}}`
}
