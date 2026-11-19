import { detectImageType } from './image-signature.js';

const bytes = (...values: number[]) => Buffer.from(values);

describe('detectImageType', () => {
  it('recognizes JPEG, PNG and WEBP by their magic bytes', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe('image/jpeg');
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe(
      'image/png',
    );
    expect(detectImageType(Buffer.from('RIFF\x10\x00\x00\x00WEBPVP8 ', 'latin1'))).toBe(
      'image/webp',
    );
  });

  it('rejects everything else, whatever the file is called', () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectImageType(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(detectImageType(Buffer.from('RIFF\x10\x00\x00\x00WAVEfmt ', 'latin1'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
