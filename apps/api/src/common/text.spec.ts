import { cleanText, clearableText, optionalPlainText, plainText } from './text.js';

describe('cleanText', () => {
  it('collapses whitespace on single-line text and drops invisible characters', () => {
    expect(cleanText('  Ayesha​   Khan ‮ ')).toBe('Ayesha Khan');
    expect(cleanText('a\r\nb\tc')).toBe('a b c');
  });

  it('keeps line breaks in multiline text but at most one blank line', () => {
    expect(cleanText('Line one   \r\n\r\n\r\n\r\nLine two\u0007', { multiline: true })).toBe(
      'Line one\n\nLine two',
    );
  });
});

describe('plainText', () => {
  const title = plainText({ min: 3, max: 10 });

  it('checks length after cleaning, so padding cannot satisfy the minimum', () => {
    expect(title.safeParse('  a​​  ').success).toBe(false);
    expect(title.parse('  Lovely  ')).toBe('Lovely');
    expect(title.safeParse('x'.repeat(11)).success).toBe(false);
  });

  it('treats blank optional text as missing', () => {
    const city = optionalPlainText({ max: 5 });
    expect(city.parse('   ')).toBeUndefined();
    expect(city.parse(null)).toBeUndefined();
    expect(city.parse(undefined)).toBeUndefined();
    expect(city.safeParse('Lahore').success).toBe(false);
    expect(city.parse(' Swat ')).toBe('Swat');
  });
});

describe('clearableText', () => {
  const field = clearableText({ max: 10 });

  it('tells "unchanged", "clear" and a new value apart', () => {
    expect(field.parse(undefined)).toBeUndefined();
    expect(field.parse(null)).toBeNull();
    expect(field.parse('   ')).toBeNull();
    expect(field.parse('  Ruby  Red ')).toBe('Ruby Red');
    expect(field.safeParse('x'.repeat(11)).success).toBe(false);
  });
});
