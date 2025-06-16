
import type { PrngMethodType } from '@/types';
import { Random, MersenneTwister19937 } from 'random-js';

// LCG parameters
const LCG_A = 1664525;
const LCG_C = 1013904223;
const LCG_M = 2**32;
let lcgInternalSeed = 1; // Specific to custom LCG or MCG current value X_n

// MCG parameters - these are the actual a, c, m for MCG
let mcg_a_internal = 1664525; // Default, can be configured
let mcg_c_internal = 1013904223; // Default, can be configured
let mcg_m_internal = 2**32;    // Default, can be configured

let currentPrngMethod: PrngMethodType = 'Math.random';
let currentPrngInitSeed: number | undefined = undefined; // General seed used for PRNG initialization (X0 for LCG/MCG, or seed for MT)

let activeGeneratorInternal: () => number = () => 0.5; // Deterministic placeholder
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

export interface McgConfig {
  a: number;
  c: number;
  m: number;
}

export function setPrng(method: PrngMethodType, seed?: number, mcgConfig?: McgConfig) {
  currentPrngMethod = method;
  currentPrngInitSeed = seed;

  const effectiveSeed = seed !== undefined ? Math.abs(Math.floor(seed)) || 1 : Date.now();

  if (method === 'LCG') {
    lcgInternalSeed = effectiveSeed; // This is X0, then X_n for LCG
    activeGeneratorInternal = () => {
      lcgInternalSeed = (LCG_A * lcgInternalSeed + LCG_C) % LCG_M;
      return lcgInternalSeed / LCG_M;
    };
    randomJsInstance = null;
  } else if (method === 'Mersenne-Twister') {
    const engine = MersenneTwister19937.seed(effectiveSeed);
    randomJsInstance = new Random(engine);
    activeGeneratorInternal = () => randomJsInstance!.realZeroToOneExclusive();
  } else if (method === 'MixedCongruential') {
    if (mcgConfig) {
      mcg_a_internal = mcgConfig.a >= 0 ? mcgConfig.a : 1664525;
      mcg_c_internal = mcgConfig.c >= 0 ? mcgConfig.c : 1013904223;
      mcg_m_internal = mcgConfig.m > 0 ? mcgConfig.m : 2**32;
    } else {
      // Fallback to defaults if no config provided, though UI should ensure it is.
      mcg_a_internal = 1664525;
      mcg_c_internal = 1013904223;
      mcg_m_internal = 2**32;
    }
    lcgInternalSeed = effectiveSeed % mcg_m_internal; // This is X0, then X_n for MCG. Ensure seed is < m.
    if (lcgInternalSeed < 0) lcgInternalSeed += mcg_m_internal;


    activeGeneratorInternal = () => {
      lcgInternalSeed = (mcg_a_internal * lcgInternalSeed + mcg_c_internal) % mcg_m_internal;
      return lcgInternalSeed / mcg_m_internal;
    };
    randomJsInstance = null;
  } else { // Math.random
    activeGeneratorInternal = Math.random;
    randomJsInstance = null;
    currentPrngInitSeed = undefined; // Math.random doesn't use a configurable seed
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

