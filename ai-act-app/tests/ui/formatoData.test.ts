import { beforeAll, describe, expect, it } from 'vitest';
import { formattaData, giornoLocale } from '../../src/ui/formatoData';

beforeAll(() => {
  process.env.TZ = 'Europe/Rome';
});

describe('formattaData', () => {
  it('data senza orario: gg/mm/aaaa senza spostamenti di fuso', () => {
    expect(formattaData('2027-12-02')).toBe('02/12/2027');
  });

  it('timestamp UTC: data locale (Europe/Rome)', () => {
    expect(formattaData('2026-10-23T22:30:00.000Z')).toBe('24/10/2026');
    expect(formattaData('2026-01-15T23:30:00Z')).toBe('16/01/2026');
    expect(formattaData('2026-10-23T10:00:00.000Z')).toBe('23/10/2026');
  });
});

describe('giornoLocale', () => {
  it('data senza orario invariata, timestamp nel giorno locale, invalido null', () => {
    expect(giornoLocale('2027-12-02')).toBe('2027-12-02');
    expect(giornoLocale('2026-10-23T22:30:00.000Z')).toBe('2026-10-24');
    expect(giornoLocale('boh')).toBeNull();
  });
});
