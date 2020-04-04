/**
 * This function sorts a partially sorted array via insertion sort.
 * It traverses the array in reverse (tail to head) under the assumption
 * that the array must be sorted in descending order. In the context of
 * dates, this means from "most recent" to "oldest".
 */
export function revInsertionSortInDesc<T>(arr: T[], transformFunc: (obj: T) => number): T[] {
  const { length } = arr;

  for (let i = length - 2; i >= 0; --i) {
    const temp = arr[i];
    const transformedTemp = transformFunc(temp);
    let j = i + 1;

    while (j < length && transformedTemp < transformFunc(arr[j])) {
      arr[j - 1] = arr[j];
      ++j;
    }

    arr[j - 1] = temp;
  }

  return arr;
}
