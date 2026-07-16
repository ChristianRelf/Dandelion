/**
 * A safe arithmetic evaluator for the omnibox. Implemented as a recursive-descent
 * parser over a hand-written tokenizer — it never uses `eval`/`Function`, so
 * arbitrary input cannot execute code.
 *
 * Supports: `+ - * / % ^`, unary sign, parentheses, the constants `pi`, `e`,
 * `tau`, and the functions `sqrt abs round floor ceil sin cos tan log ln exp`.
 */

export interface CalculatorResult {
  expression: string;
  value: number;
  formatted: string;
}

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log10,
  ln: Math.log,
  exp: Math.exp,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
};

type Tok =
  | { t: 'num'; v: number }
  | { t: 'op'; v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'id'; v: string };

function tokenize(src: string): Tok[] {
  const s = src.replace(/,/g, '');
  const tokens: Tok[] = [];
  const numRe = /\d*\.?\d+(?:[eE][+-]?\d+)?/y;
  const idRe = /[a-z]+/iy;
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === ' ' || c === '\t') {
      i += 1;
      continue;
    }
    numRe.lastIndex = i;
    const num = numRe.exec(s);
    if (num) {
      tokens.push({ t: 'num', v: Number(num[0]) });
      i = numRe.lastIndex;
      continue;
    }
    idRe.lastIndex = i;
    const id = idRe.exec(s);
    if (id) {
      tokens.push({ t: 'id', v: id[0].toLowerCase() });
      i = idRe.lastIndex;
      continue;
    }
    if ('+-*/%^'.includes(c)) {
      tokens.push({ t: 'op', v: c });
      i += 1;
      continue;
    }
    if (c === '(') {
      tokens.push({ t: 'lp' });
      i += 1;
      continue;
    }
    if (c === ')') {
      tokens.push({ t: 'rp' });
      i += 1;
      continue;
    }
    throw new Error(`Unexpected character: ${c}`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Tok[]) {}

  parse(): number {
    const value = this.expr();
    if (this.pos < this.tokens.length) throw new Error('Trailing tokens');
    return value;
  }

  private peek(): Tok | undefined {
    return this.tokens[this.pos];
  }

  private expect(type: Tok['t']): void {
    const token = this.peek();
    if (!token || token.t !== type) throw new Error(`Expected ${type}`);
    this.pos += 1;
  }

  private expr(): number {
    let value = this.term();
    for (;;) {
      const token = this.peek();
      if (token?.t === 'op' && (token.v === '+' || token.v === '-')) {
        this.pos += 1;
        const rhs = this.term();
        value = token.v === '+' ? value + rhs : value - rhs;
      } else break;
    }
    return value;
  }

  private term(): number {
    let value = this.power();
    for (;;) {
      const token = this.peek();
      if (token?.t === 'op' && (token.v === '*' || token.v === '/' || token.v === '%')) {
        this.pos += 1;
        const rhs = this.power();
        if (token.v === '*') value *= rhs;
        else if (token.v === '/') value /= rhs;
        else value %= rhs;
      } else break;
    }
    return value;
  }

  private power(): number {
    const base = this.unary();
    const token = this.peek();
    if (token?.t === 'op' && token.v === '^') {
      this.pos += 1;
      return base ** this.power(); // right-associative
    }
    return base;
  }

  private unary(): number {
    const token = this.peek();
    if (token?.t === 'op' && (token.v === '+' || token.v === '-')) {
      this.pos += 1;
      const value = this.unary();
      return token.v === '-' ? -value : value;
    }
    return this.primary();
  }

  private primary(): number {
    const token = this.peek();
    if (!token) throw new Error('Unexpected end of input');
    if (token.t === 'num') {
      this.pos += 1;
      return token.v;
    }
    if (token.t === 'lp') {
      this.pos += 1;
      const value = this.expr();
      this.expect('rp');
      return value;
    }
    if (token.t === 'id') {
      this.pos += 1;
      if (Object.hasOwn(CONSTANTS, token.v)) return CONSTANTS[token.v]!;
      const fn = FUNCTIONS[token.v];
      if (fn) {
        this.expect('lp');
        const arg = this.expr();
        this.expect('rp');
        return fn(arg);
      }
      throw new Error(`Unknown identifier: ${token.v}`);
    }
    throw new Error('Unexpected token');
  }
}

function isCalculatorInput(expr: string): boolean {
  if (!/^[0-9a-z+\-*/%^().\s]+$/i.test(expr)) return false;
  // Require an operator or a function/constant, plus a numeric or constant operand.
  if (!/[+\-*/%^]/.test(expr) && !/[a-z]/i.test(expr)) return false;
  return /[0-9]/.test(expr) || /(pi|tau|e)\b/i.test(expr);
}

function formatResult(value: number): string {
  const rounded = Math.round(value * 1e10) / 1e10;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 10 }).format(rounded);
}

/** Evaluate an omnibox expression, or return `null` if it is not arithmetic. */
export function evaluateExpression(input: string): CalculatorResult | null {
  const expression = input.trim();
  if (!isCalculatorInput(expression)) return null;
  try {
    const tokens = tokenize(expression);
    if (tokens.length === 0) return null;
    const value = new Parser(tokens).parse();
    if (!Number.isFinite(value)) return null;
    return { expression, value, formatted: formatResult(value) };
  } catch {
    return null;
  }
}
