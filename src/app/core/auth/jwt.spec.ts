import { describe, expect, it } from 'vitest';
import { decodeJwtPayload } from './jwt';

const b64url = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('decodeJwtPayload', () => {
  it('decodes the payload segment', () => {
    const token = `header.${b64url({ sub: 'abc', permissions: ['CARDS_EDIT'] })}.signature`;
    expect(decodeJwtPayload(token)).toEqual({ sub: 'abc', permissions: ['CARDS_EDIT'] });
  });

  it('returns an empty object for malformed tokens', () => {
    expect(decodeJwtPayload('not-a-jwt')).toEqual({});
    expect(decodeJwtPayload('a.%%%.c')).toEqual({});
  });
});
