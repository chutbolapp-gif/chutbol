/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { formatPhone, normalizePhone } from '../src/lib/phone';

describe('phone numbers', () => {
  it.each([
    ['050-1234567', '972501234567'],
    ['0501234567', '972501234567'],
    ['+972 50 123 4567', '972501234567'],
    ['00972501234567', '972501234567'],
    ['(050) 000-0001', '972500000001'],
    ['03-1234567', '97231234567'],
    ['+44 7700 900123', '447700900123'],
  ])('%s -> %s', (input, out) => expect(normalizePhone(input)).toBe(out));

  it.each(['', 'abc', '050', '+972 12 345', '05012345678901234'])('rejects %j', input => expect(normalizePhone(input)).toBeNull());

  it('test numbers from supabase/config.toml are valid', () => {
    expect(normalizePhone('0500000001')).toBe('972500000001');
    expect(normalizePhone('0500000003')).toBe('972500000003');
  });

  it('formats for display', () => {
    expect(formatPhone('972501234567')).toBe('050-1234567');
    expect(formatPhone('447700900123')).toBe('+447700900123');
  });
});