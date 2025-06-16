
import type { PrngMethodType } from '@/types';

// LCG parameters (simple example - Numerical Recipes)
const LCG_A = 1664525;
const LCG_C = 1013904223;
const LCG_M = 2**32; // 4294967296
let lcgSeedValue = 1; // Default seed

export function setLcgSeed(seed: number) {
  lcgSeedValue = Math.abs(Math.floor(seed)) || 1; // Ensure positive integer, default to 1
}

function lcg(): number {
  lcgSeedValue = (LCG_A * lcgSeedValue + LCG_C) % LCG_M;
  return lcgSeedValue / LCG_M;
}

let currentPrng: PrngMethodType = 'Math.random';
let activeGenerator: () => number = Math.random;

export function getActivePrngMethod(): PrngMethodType {
  return currentPrng;
}

export function getLcgSeed(): number {
    return lcgSeedValue;
}

export function getActiveGenerator(): () => number {
  return activeGenerator;
}

export function setPrng(method: PrngMethodType, seed?: number) {
  currentPrng = method;
  if (method === 'LCG') {
    setLcgSeed(seed !== undefined ? seed : Date.now()); // Use current time as default seed if not provided
    activeGenerator = lcg;
  } else {
    activeGenerator = Math.random; // Default to Math.random
  }
}


/**
 * Generates a random number following an exponential distribution.
 * @param mean The mean of the distribution.
 * @returns A random number.
 */
export function exponential(mean: number): number {
  if (mean <= 0) return 0;
  let randomNumber = 0;
  while (randomNumber === 0) {
    randomNumber = activeGenerator();
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
  if (stdDev < 0) return mean; 
  
  let u = 0, v = 0;
  while (u === 0) u = activeGenerator(); 
  while (v === 0) v = activeGenerator();
  
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}
