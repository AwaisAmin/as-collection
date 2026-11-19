/** Body measurements in inches for stitched garments. */
export const sizeChart = {
  columns: ['Size', 'Bust', 'Waist', 'Hips', 'Shirt length'] as const,
  rows: [
    ['XS', '32', '26', '35', '44'],
    ['S', '34', '28', '37', '45'],
    ['M', '36', '30', '39', '46'],
    ['L', '38', '32', '41', '47'],
    ['XL', '40', '34', '43', '48'],
  ] as const,
  tips: [
    'Bust — measure around the fullest part of your chest, keeping the tape level.',
    'Waist — measure around your natural waistline, the narrowest part of your torso.',
    'Hips — measure around the widest part of your hips.',
    'Between two sizes? Choose the larger size for a relaxed fit.',
  ],
};
