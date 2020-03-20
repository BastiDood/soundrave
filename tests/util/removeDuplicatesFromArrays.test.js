const { removeDuplicatesFromArrays } = require('../../src/util/removeDuplicatesFromArrays');

describe('Two arrays', () => {
  test('Remove 3 of 5 strings from first array', () => {
    const arr1 = [ 'abc', 'def', 'ghi', 'jkl', 'mno' ];
    const arr2 = [ 'abc', 'def', 'ghi' ];
    const expected = [ 'jkl', 'mno' ];
    expect(removeDuplicatesFromArrays(arr1, arr2)).toEqual(expected);
  });
  test('Remove 2 of 3 strings from first array', () => {
    const arr1 = [ 'abc', 'def', 'ghi' ];
    const arr2 = [ 'def', 'ghi' ];
    const expected = [ 'abc' ];
    expect(removeDuplicatesFromArrays(arr1, arr2)).toEqual(expected);
  });
  test('Remove 1 of 2 strings from first array', () => {
    const arr1 = [ 'abc', 'def' ];
    const arr2 = [ 'def' ];
    const expected = [ 'abc' ];
    expect(removeDuplicatesFromArrays(arr1, arr2)).toEqual(expected);
  });
});

describe('Three arrays', () => {
  test('Find elements that have not been duplicated from 3 arrays of length 3', () => {
    const arr1 = [ '1', '2', '3' ];
    const arr2 = [ '2', '3', '4' ];
    const arr3 = [ '3', '4', '5' ];
    const expected = [ '1', '5' ];
    expect(removeDuplicatesFromArrays(arr1, arr2, arr3)).toEqual(expected);
  });
  test('Find elements that have not been duplicated from 3 arrays of length 2', () => {
    const arr1 = [ '1', '2' ];
    const arr2 = [ '2', '3' ];
    const arr3 = [ '3', '3' ];
    const expected = [ '1' ];
    expect(removeDuplicatesFromArrays(arr1, arr2, arr3)).toEqual(expected);
  });
});

describe('Blank arrays', () => {
  test('One blank array', () => {
    expect(removeDuplicatesFromArrays([])).toEqual([]);
  });
  test('Two blank arrays', () => {
    expect(removeDuplicatesFromArrays([], [])).toEqual([]);
  });
  test('Blank arrays do not alter other arrays', () => {
    const arr1 = [ 'id1', 'id2', 'id3' ];
    expect(removeDuplicatesFromArrays(arr1, [])).toEqual(arr1);
  });
});
