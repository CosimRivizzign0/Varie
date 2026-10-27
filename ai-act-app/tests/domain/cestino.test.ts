import { describe, expect, it } from 'vitest';
import { GIORNI_CESTINO, isScaduto } from '../../src/domain/cestino';

describe('isScaduto', () => {
  const eliminatoIl = '2026-09-01T10:00:00.000Z';
  const base = Date.parse(eliminatoIl);
  const trentaGiorni = 30 * 24 * 60 * 60 * 1000;

  it('GIORNI_CESTINO è 30', () => expect(GIORNI_CESTINO).toBe(30));
  it('30 giorni esatti non scaduto', () => expect(isScaduto(eliminatoIl, new Date(base + trentaGiorni))).toBe(false));
  it('30 giorni + 1 ms scaduto', () => expect(isScaduto(eliminatoIl, new Date(base + trentaGiorni + 1))).toBe(true));
  it('appena eliminato non scaduto', () => expect(isScaduto(eliminatoIl, new Date(base))).toBe(false));
});
