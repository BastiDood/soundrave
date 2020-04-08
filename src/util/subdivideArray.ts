/**
 * This utility function subdivides an array into smaller
 * sub-arrays with a maximum length of `count`.
 * @param arr - Array to be subdivided
 * @param count - Maximum length per subdivision
 */
export function subdivideArray<T>(arr: T[], count: number): T[][] {
  if (count < 1)
    throw new Error('Array cannot be subdivided less than 1 time.');

  const { length } = arr;
  const accumulator: T[][] = [];
  let begin = 0;
  let end = Math.min(begin + count, length);

  do {
    const chunk = arr.slice(begin, end);
    accumulator.push(chunk);
    begin = end;
    end = Math.min(begin + count, length);
  } while (begin < length);

  return accumulator;
}
