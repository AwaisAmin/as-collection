/**
 * Order numbers are issued by the API: "AS-261119-7KQ4M" — date (Pakistan time) + 5 characters
 * without 0/O or 1/I/L (they get read out over the phone). Used to reject malformed URLs early.
 */
export const ORDER_NUMBER_PATTERN = /^AS-\d{6}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/;
