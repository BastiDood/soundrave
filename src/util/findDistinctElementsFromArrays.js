/**
 * Finds all distinct elements given a list of string arrays.
 * @param {string[][]} arrays
 * @returns {string[]} - All distinct elements of all arrays
 */
function findDistinctElementsFromArrays(...arrays) {
  // Initialize a lookup table for caching duplicates
  /** @type {{ [item: string]: string }} */
  const lookupTable = {};

  // Traverse the arrays and count occurrences
  for (const array of arrays)
    for (const item of array)
      // Ignore entries with more than 2 occurrences
      if (typeof lookupTable[item] === 'undefined' || lookupTable[item] < 2)
        lookupTable[item] = typeof lookupTable[item] !== 'undefined'
          ? lookupTable[item] + 1
          : 1;

  // Filter entries with more than two instances
  const difference = [];
  for (const [ key, value ] of Object.entries(lookupTable))
    if (value < 2)
      difference.push(key);
  return difference;
}

module.exports = { findDistinctElementsFromArrays };
