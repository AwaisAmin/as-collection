import sharp from 'sharp';

import { ImageRejectedError, MAX_DIMENSION, processImage } from './image-processing.js';

const image = (width: number, height: number, format: 'jpeg' | 'png' = 'jpeg') =>
  sharp({ create: { width, height, channels: 3, background: '#a0522d' } })
    [format]()
    .toBuffer();

describe('processImage', () => {
  it('makes a WebP with smaller responsive copies', async () => {
    const result = await processImage(await image(1000, 1500));
    expect(result.full).toMatchObject({ width: 1000, height: 1500 });
    expect(result.variants.map((v) => v.width)).toEqual([320, 640, 960]);
    expect(result.variants[0]?.height).toBe(480);
    const meta = await sharp(result.full.body).metadata();
    expect(meta.format).toBe('webp');
  });

  it('scales very large images down', async () => {
    const result = await processImage(await image(4000, 2000, 'png'));
    expect(result.full).toMatchObject({ width: MAX_DIMENSION, height: MAX_DIMENSION / 2 });
    expect(result.variants.at(-1)?.width).toBe(1920);
  });

  it('applies the EXIF orientation and strips all metadata', async () => {
    const rotated = await sharp(await image(300, 200))
      .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'secret-camera-serial' } } })
      .jpeg()
      .toBuffer();
    const result = await processImage(rotated);
    expect(result.full).toMatchObject({ width: 200, height: 300 });
    const meta = await sharp(result.full.body).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(result.full.body.includes('secret-camera-serial')).toBe(false);
  });

  it('rejects tiny, damaged and oversized images', async () => {
    await expect(processImage(await image(40, 40))).rejects.toBeInstanceOf(ImageRejectedError);
    const broken = (await image(400, 400)).subarray(0, 200);
    await expect(processImage(broken)).rejects.toBeInstanceOf(ImageRejectedError);
    // 10 000 × 6 000 = 60 MP: refused from the header, without decoding.
    const huge = await sharp({
      create: { width: 10_000, height: 6_000, channels: 3, background: '#000' },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    await expect(processImage(huge)).rejects.toBeInstanceOf(ImageRejectedError);
  });
});
