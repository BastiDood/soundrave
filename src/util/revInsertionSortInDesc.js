/**
 * Sorts a partially sorted array via insertion sort.
 * @template T
 * @param {T[]} arr
 * @param {(obj: T) => any} transformFunc 
 */
export function revInsertionSortInDesc(arr, transformFunc = x => x) {
  const { length } = arr;

  for (let i = length - 2; i >= 0; --i) {
    const temp = arr[i];
    let j = i + 1;

    while (j < length && transformFunc(temp) < transformFunc(arr[j])) {
      arr[j - 1] = arr[j];
      ++j;
    }

    arr[j - 1] = temp;
  }

  return arr;
}
