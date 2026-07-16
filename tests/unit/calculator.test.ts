import { describe, expect, it } from 'vitest';
import { evaluateExpression } from '@shared/utils';

describe('evaluateExpression', () => {
  it('respects arithmetic precedence and grouping', () => {
    expect(evaluateExpression('2 + 3 * 4')?.value).toBe(14);
    expect(evaluateExpression('(2 + 3) * 4')?.value).toBe(20);
    expect(evaluateExpression('10 / 4')?.value).toBe(2.5);
    expect(evaluateExpression('17 % 5')?.value).toBe(2);
  });

  it('supports powers (right associative), unary minus and functions', () => {
    expect(evaluateExpression('2 ^ 10')?.value).toBe(1024);
    expect(evaluateExpression('-5 + 3')?.value).toBe(-2);
    expect(evaluateExpression('sqrt(144)')?.value).toBe(12);
    expect(evaluateExpression('round(3.7)')?.value).toBe(4);
  });

  it('knows constants', () => {
    expect(evaluateExpression('pi * 2')?.value).toBeCloseTo(Math.PI * 2, 6);
  });

  it('rejects non-arithmetic and unsafe input', () => {
    expect(evaluateExpression('hello there')).toBeNull();
    expect(evaluateExpression('alert(1)')).toBeNull();
    expect(evaluateExpression('2 +')).toBeNull();
  });
});
