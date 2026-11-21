import { describe, expect, it } from 'vitest';
import { imageKey, shineUrlOf } from './card-shine';

describe('card shine', () => {
  it('finds the shine next to an editor render, with its version', () => {
    expect(shineUrlOf('/api/cards/abc/render?v=card-render%2Fabc%2F1.jpeg')).toBe(
      '/api/cards/abc/shine?v=card-render%2Fabc%2F1.jpeg',
    );
    expect(shineUrlOf('https://api.example/api/cards/abc/render')).toBe('https://api.example/api/cards/abc/shine');
  });

  it('has none for other images', () => {
    expect(shineUrlOf('https://pub.r2.dev/cards/E1-B01.jpg?v=3')).toBeNull();
    expect(shineUrlOf('blob:http://localhost/123')).toBeNull();
    expect(shineUrlOf(null)).toBeNull();
  });

  it('keys an image without its version', () => {
    expect(imageKey('https://pub.r2.dev/cards/E1-B01.jpg?v=3')).toBe('https://pub.r2.dev/cards/E1-B01.jpg');
    expect(imageKey(null)).toBe('');
  });
});
