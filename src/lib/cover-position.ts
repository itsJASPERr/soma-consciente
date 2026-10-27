/** Approved image focal-point presets, kept separate from image upload metadata. */
export const coverPositions = {
  top: 'center 12%',
  upper: 'center 30%',
  center: 'center 50%',
  lower: 'center 70%',
  bottom: 'center 88%'
} as const;
export type CoverPosition = keyof typeof coverPositions;
export function coverObjectPosition(value?: string): string {
  return coverPositions[(value && value in coverPositions ? value : 'center') as CoverPosition];
}
