import { reviewOrderBy, summarize } from './reviews.mapper.js';
import { submitReviewSchema } from './reviews.schemas.js';

describe('summarize', () => {
  it('builds the per-star distribution and a one-decimal average', () => {
    expect(
      summarize([
        { rating: 5, count: 6 },
        { rating: 4, count: 3 },
        { rating: 1, count: 1 },
      ]),
    ).toEqual({ average: 4.3, count: 10, distribution: [1, 0, 0, 3, 6] });
  });

  it('is zero for no reviews', () => {
    expect(summarize([])).toEqual({ average: 0, count: 0, distribution: [0, 0, 0, 0, 0] });
  });
});

describe('reviewOrderBy', () => {
  it('always breaks ties by newest, then id', () => {
    expect(reviewOrderBy('helpful')).toEqual([
      { helpfulCount: 'desc' },
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
    expect(reviewOrderBy('newest')).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });
});

describe('submitReviewSchema', () => {
  const valid = {
    rating: 5,
    title: '  Beautiful  ',
    body: 'Lovely fabric,\r\n\r\n\r\nperfect stitching.',
    author: 'Ayesha',
    city: '   ',
  };

  it('cleans text and drops a blank city', () => {
    expect(submitReviewSchema.parse(valid)).toEqual({
      rating: 5,
      title: 'Beautiful',
      body: 'Lovely fabric,\n\nperfect stitching.',
      author: 'Ayesha',
      city: undefined,
    });
  });

  it('rejects unknown fields and out-of-range ratings', () => {
    expect(submitReviewSchema.safeParse({ ...valid, status: 'APPROVED' }).success).toBe(false);
    expect(submitReviewSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false);
    expect(submitReviewSchema.safeParse({ ...valid, rating: 4.5 }).success).toBe(false);
  });
});
