import { describe, expect, it } from 'vitest';
import { riferimentiDi, valuta } from '../../src/regole/condizioni';
import type { Condizione } from '../../src/regole/tipi';

const si = (r: string): Condizione => ({ risposta: r, uguale: 'si' });

describe('valuta', () => {
  it('uguale vero e falso', () => {
    expect(valuta(si('a'), { a: 'si' })).toBe(true);
    expect(valuta(si('a'), { a: 'no' })).toBe(false);
    expect(valuta({ risposta: 'a', uguale: 'non_so' }, { a: 'non_so' })).toBe(true);
  });
  it('risposta mancante => uguale falso', () => {
    expect(valuta(si('a'), {})).toBe(false);
    expect(valuta({ risposta: 'a', uguale: 'no' }, {})).toBe(false);
  });
  it('tutte vuoto => vero; almenoUna vuoto => falso', () => {
    expect(valuta({ tutte: [] }, {})).toBe(true);
    expect(valuta({ almenoUna: [] }, {})).toBe(false);
  });
  it('tutte e almenoUna', () => {
    const r = { a: 'si', b: 'no' } as const;
    expect(valuta({ tutte: [si('a'), { risposta: 'b', uguale: 'no' }] }, r)).toBe(true);
    expect(valuta({ tutte: [si('a'), si('b')] }, r)).toBe(false);
    expect(valuta({ almenoUna: [si('b'), si('a')] }, r)).toBe(true);
    expect(valuta({ almenoUna: [si('b'), si('c')] }, r)).toBe(false);
  });
  it('non, anche su risposta mancante', () => {
    expect(valuta({ non: si('a') }, { a: 'no' })).toBe(true);
    expect(valuta({ non: si('a') }, { a: 'si' })).toBe(false);
    expect(valuta({ non: si('a') }, {})).toBe(true);
  });
  it('annidamento', () => {
    const c: Condizione = {
      tutte: [si('a'), { almenoUna: [si('b'), { non: si('c') }] }],
    };
    expect(valuta(c, { a: 'si', c: 'no' })).toBe(true);
    expect(valuta(c, { a: 'si', c: 'si' })).toBe(false);
    expect(valuta(c, { a: 'si', b: 'si', c: 'si' })).toBe(true);
  });
});

describe('riferimentiDi', () => {
  it('raccoglie gli id citati, anche annidati', () => {
    const c: Condizione = { tutte: [si('a'), { non: { almenoUna: [si('b'), si('a')] } }] };
    expect(riferimentiDi(c).sort()).toEqual(['a', 'a', 'b']);
  });
});
