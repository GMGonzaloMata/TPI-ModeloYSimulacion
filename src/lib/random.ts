
import type { PrngMethodType } from '@/types';
// According to random-js@2.1.0 type definitions, Alea (uppercase) is the correct export.
// If this line causes "Export Alea doesn't exist", there might be an issue with
// the random-js package's ESM build or its resolution in your Next.js environment.
import { Random, MersenneTwister19937 } from 'random-js'; // Removed Alea from import

// LCG parameters
const LCG_A = 1664525;
const LCG_C = 1013904223;
const LCG_M = 2**32;
let lcgInternalSeed = 1; // Specific to custom LCG

let currentPrngMethod: PrngMethodType = 'Math.random';
let currentPrngInitSeed: number | undefined = undefined; // General seed used for PRNG initialization

// Initialize with a deterministic placeholder to prevent Math.random usage before setPrng.
let activeGeneratorInternal: () => number = () => {
  // This function should not be called before setPrng initializes it.
  // Returning a constant ensures server/client consistency if it's called prematurely.
  return 0.5;
};
let randomJsInstance: Random | null = null;

export function getActivePrngMethod(): PrngMethodType {
  return currentPrngMethod;
}

export function getPrngInitializationSeed(): number | undefined {
  return currentPrngInitSeed;
}

export function getLcgInternalSeedValue(): number {
    return lcgInternalSeed;
}

export function getActiveGenerator(): () => number {
    return activeGeneratorInternal;
}

export function setPrng(method: PrngMethodType, seed?: number) {
  currentPrngMethod = method;
  currentPrngInitSeed = seed;

  const effectiveSeed = seed !== undefined ? seed : Date.now();

  if (method === 'LCG') {
    lcgInternalSeed = Math.abs(Math.floor(effectiveSeed)) || 1;
    activeGeneratorInternal = () => {
      lcgInternalSeed = (LCG_A * lcgInternalSeed + LCG_C) % LCG_M;
      return lcgInternalSeed / LCG_M;
    };
    randomJsInstance = null;
  } else if (method === 'Mersenne-Twister') {
    const engine = MersenneTwister19937.seed(effectiveSeed);
    randomJsInstance = new Random(engine);
    activeGeneratorInternal = () => randomJsInstance!.realZeroToOneExclusive();
  } else { // Math.random
    activeGeneratorInternal = Math.random;
    randomJsInstance = null;
    currentPrngInitSeed = undefined;
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
  const generator = getActiveGenerator();
  while (randomNumber === 0) {
    randomNumber = generator();
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
  const generator = getActiveGenerator();
  while (u === 0) u = generator();
  while (v === 0) v = generator();

  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

