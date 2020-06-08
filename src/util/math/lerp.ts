/**
 * This is a utility function that implements linear interpolation.
 * @param from - Represents the input range
 * @param to - Represents the output range
 * @returns Function to be used for interpolating values from the input range to the output range
 */
export function lerp(from: [ number, number ], to: [ number, number ]): (x: number) => number {
  const fromRange = from[1] - from[0];
  const toRange = to[1] - to[0];
  const ratio = toRange / fromRange;
  return x => (x - from[0]) * ratio + to[0];
}
