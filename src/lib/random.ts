
import type { PrngMethodType } from '@/types';
import { Random, MersenneTwister19937, AleaAlgorithm } from 'random-js';

// LCG parameters
const LCG_A = 1664525;
const LCG_C = 1013904223;
const LCG_M = 2**32;
let lcgInternalSeed = 1; // Specific to custom LCG

let currentPrngMethod: PrngMethodType = 'Math.random';
let currentPrngInitSeed: number | undefined = undefined; // General seed used for PRNG initialization

export let activeGenerator: () => number = Math.random;
let randomJsInstance: Random | null = null;

export function getActivePrngMethod(): PrngMethodType {
  return currentPrngMethod;
}

export function getPrngInitializationSeed(): number | undefined {
  return currentPrngInitSeed;
}

// This function is mostly for the LCG specific case if its internal state is needed elsewhere,
// for random-js instances, the state is encapsulated.
export function getLcgInternalSeedValue(): number {
    return lcgInternalSeed;
}


export function setPrng(method: PrngMethodType, seed?: number) {
  currentPrngMethod = method;
  currentPrngInitSeed = seed; // Store the seed used for this PRNG setup

  const effectiveSeed = seed !== undefined ? seed : Date.now();

  if (method === 'LCG') {
    lcgInternalSeed = Math.abs(Math.floor(effectiveSeed)) || 1;
    activeGenerator = () => {
      lcgInternalSeed = (LCG_A * lcgInternalSeed + LCG_C) % LCG_M;
      return lcgInternalSeed / LCG_M;
    };
    randomJsInstance = null;
  } else if (method === 'Mersenne-Twister') {
    const engine = MersenneTwister19937.seed(effectiveSeed);
    randomJsInstance = new Random(engine);
    activeGenerator = () => randomJsInstance!.realZeroToOneExclusive();
  } else if (method === 'ALEA') {
    const engine = AleaAlgorithm.seed(effectiveSeed); // AleaAlgorithm is an engine function
    randomJsInstance = new Random(engine);
    activeGenerator = () => randomJsInstance!.realZeroToOneExclusive();
  } else { // Math.random
    activeGenerator = Math.random;
    randomJsInstance = null;
    currentPrngInitSeed = undefined; // Math.random is not seeded externally
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
