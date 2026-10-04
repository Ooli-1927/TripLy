/**
 * Skeleton. Situation scoring is applied in a later phase.
 */

/**
 * Score each destination against a situation. Scores stay at 0 until the model exists.
 * @param {Array<{ id?: string }>} destinations
 * @param {object} [_situation]
 * @returns {Array<{ id: string, score: number }>}
 */
export function scoreDestinations(destinations, _situation) {
  if (!Array.isArray(destinations)) return [];
  return destinations.map((destination) => ({
    id: destination && typeof destination.id === 'string' ? destination.id : '',
    score: 0,
  }));
}
