/**
 * Removes all duplicate elements given a list of string arrays.
 * @returns All non-duplicate elements of all arrays
 */
export function removeDuplicatesFromArrays(...arrays: string[][]): string[] {
  // Initialize a lookup table for caching duplicates
  const lookupTable: { [item: string]: number } = Object.create(null);

  // Traverse the arrays and count occurrences
  for (const _ of arrays)
    for (const item of _)
      // Ignore entries with more than 2 occurrences
      if (!lookupTable[item])
        lookupTable[item] = 1;
      else if (lookupTable[item] < 2)
        ++lookupTable[item];

  // Filter entries with more than two instances
  const difference: string[] = [];
  for (const [ key, value ] of Object.entries(lookupTable))
    if (value < 2)
      difference.push(key);

  return difference;
}
