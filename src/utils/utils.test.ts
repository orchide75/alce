import { describe, expect, it } from 'vitest';
import { fmtPct, fmtRon, parseNumberInput } from './format';
import { nameFromUrl, safeUrl } from './url';

describe('parseNumberInput', () => {
  it.each([
    ['12,5', 12.5],
    ['12.5', 12.5],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    [' 1 000 ', 1000],
    ['-3', -3],
    ['0,019', 0.019],
  ])('%s → %s', (raw, v) => expect(parseNumberInput(raw)).toBe(v));
  it.each(['abc', '1,2,3', '12a', '', 'NaN', 'Infinity'])('„%s” invalid', (raw) => expect(parseNumberInput(raw)).toBeNull());
});

describe('formatare', () => {
  it('nu afișează NaN / Infinity', () => {
    expect(fmtRon(NaN)).toBe('—');
    expect(fmtRon(Infinity)).toBe('—');
    expect(fmtPct(null)).toBe('—');
  });
  it('evită -0,00', () => expect(fmtRon(-0.001)).not.toContain('-'));
});

describe('URL furnizor', () => {
  it('respinge protocoale nesigure', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('https://x.ro/a')).toBe('https://x.ro/a');
  });
  it('sugerează nume din slug', () => {
    expect(nameFromUrl('https://www.temu.com/ro/set-perii-machiaj-profesionale-g-601099512345678.html')).toBe('Set perii machiaj profesionale');
  });
});
