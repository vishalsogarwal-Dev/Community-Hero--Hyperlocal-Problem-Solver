/**
 * Task 5.2 — Hero Points allocation matrix.
 *
 * Every action that earns points is mapped here. Workers consume events
 * from the message broker and look up the correct delta before persisting.
 */
export const POINTS = {
  REPORT_CREATED: 10,
  REPORT_VERIFIED: 2,
  RESOLUTION_CONFIRMED: 50,
  COMMENT_ADDED: 1,
} as const;

export type GamificationEvent = keyof typeof POINTS;

/**
 * Milestone badges keyed by total-points threshold.
 * First threshold the user crosses unlocks the badge.
 */
export const BADGES: Record<number, string> = {
  10: 'First Reporter',
  50: 'Neighbourhood Watch',
  100: 'Pothole Patrol',
  250: 'Neighbourhood Guardian',
  500: 'Community Hero',
  1000: 'City Legend',
};
