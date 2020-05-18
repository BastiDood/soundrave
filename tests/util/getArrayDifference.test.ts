import { AssertionError } from 'assert';
import { getArrayDifference } from '../../src/util';

describe('Test Array Difference Algorithm', () => {
  test('Successfully filters out all elements', () => {
    const arr1 = [ 1, 2, 3 ];
    const arr2 = [ 1, 2, 3 ];
    expect(getArrayDifference(arr1, arr2)).toEqual([]);
  });

  test('Remove 2 elements', () => {
    const arr1 = [ 1, 2, 3 ];
    const arr2 = [ 1, 2 ];
    expect(getArrayDifference(arr1, arr2)).toEqual([ 3 ]);
  });

  test('Remove 1 element', () => {
    const arr1 = [ 1, 2, 3 ];
    const arr2 = [ 2 ];
    expect(getArrayDifference(arr1, arr2)).toEqual([ 1, 3 ]);
  });

  test('Throws on invalid input', () => {
    const arr1 = [ 1, 2 ];
    const arr2 = [ 1, 2, 3 ];
    expect(getArrayDifference.bind(null, arr1, arr2)).toThrowError(AssertionError);
  });
});
