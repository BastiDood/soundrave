import { strict as assert } from 'assert';

/**
 * This utility function computes the difference (A - B) between
 * the elements of two arrays. The implementation is specialized
 * for finding the difference between a set and its subset.
 * @param superArr - Superset array
 * @param subArr - Subset array
 * @returns Difference of the two arrays (`superArr` - `subArr`)
 */
export function getArrayDifference<T>(superArr: T[], subArr: T[]): T[] {
  if (superArr.length === subArr.length)
    return [];
  assert(subArr.length <= superArr.length);
  return superArr.filter(elem => !subArr.includes(elem));
}
