import { subdivideArray } from '../../src/util/subdivideArray';

describe('Divide into equal partitions', () => {
  test('Empty array', () => {
    const MAX_LENGTH = 2;
    const input: number[] = [];
    expect(subdivideArray(input, MAX_LENGTH)).toEqual([ [] ]);
  });

  test('Two equal partitions of two elements', () => {
    const MAX_LENGTH = 2;
    const input = [ 1, 2, 3, 4 ];
    const expected = [ [ 1, 2 ], [ 3, 4 ] ];
    expect(subdivideArray(input, MAX_LENGTH)).toEqual(expected);
  });

  test('Two partitions of maximum length 3', () => {
    const MAX_LENGTH = 3;
    const input = [ 1, 2, 3, 4, 5 ];
    const expected = [ [ 1, 2, 3 ], [ 4, 5 ] ];
    expect(subdivideArray(input, MAX_LENGTH)).toEqual(expected);
  });
});
