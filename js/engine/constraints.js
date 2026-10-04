/**
 * Skeleton. Hard constraints are applied in a later phase.
 */

/**
 * Keep destinations that satisfy every hard constraint.
 * @param {unknown[]} destinations
 * @param {object} [_constraints]
 * @returns {unknown[]}
 */
export function applyConstraints(destinations, _constraints) {
  return Array.isArray(destinations) ? destinations.slice() : [];
}
