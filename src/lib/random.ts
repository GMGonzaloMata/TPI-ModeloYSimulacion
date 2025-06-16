// Simplified for UI demonstration. Not cryptographically secure.
// For actual simulation, use a library like random-js with seeding.

/**
 * Generates a random number following an exponential distribution.
 * @param mean The mean of the distribution.
 * @returns A random number.
 */
export function exponential(mean: number): number {
  if (mean <= 0) return 0; // Or throw an error
  // Ensure Math.random() is not 0 to avoid Math.log(0) which is -Infinity
  let randomNumber = 0;
  while (randomNumber === 0) {
    randomNumber = Math.random();
  }
  return -mean * Math.log(1 - randomNumber);
}

/**
 * Generates a random number following a normal distribution using the Box-Muller transform.
 * @param mean The mean of the distribution.
 * @param stdDev The standard deviation of the distribution.
 * @returns A random number.
 */
export function normal(mean: number, stdDev: number): number {
  if (stdDev < 0) return mean; // Or throw an error
  
  // Ensure u and v are not 0 for log and to avoid issues.
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); 
  while (v === 0) v = Math.random();
  
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}
