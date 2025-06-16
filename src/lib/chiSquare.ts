
'use server';
import type { ChiSquareResult, PrngMethodType } from '@/types';
import { setPrng, getActivePrngMethod, getPrngInitializationSeed, getActiveGenerator } from './random';

export async function generateSamples(count: number, method: PrngMethodType, seed?: number): Promise<number[]> {
  const originalMethod = getActivePrngMethod();
  const originalSeed = getPrngInitializationSeed();

  setPrng(method, seed); // Temporarily set PRNG for sample generation

  const samples: number[] = [];
  const currentGeneratorForTest = getActiveGenerator(); 

  for (let i = 0; i < count; i++) {
    samples.push(currentGeneratorForTest());
  }
  
  setPrng(originalMethod, originalSeed); // Restore original PRNG state
  return samples;
}

export async function performChiSquareTest(
  N: number, 
  K: number, 
  prngMethod: PrngMethodType,
  prngSeedForTest?: number 
): Promise<ChiSquareResult> {
  if (N <= 0 || K <= 1 || N < K * 5) { 
    return {
      statistic: 0,
      degreesOfFreedom: 0,
      N,
      K,
      prngMethodUsed: prngMethod,
      prngSeedUsed: (prngMethod !== 'Math.random' && prngSeedForTest !== undefined) ? prngSeedForTest : undefined,
      interpretation: "N debe ser mayor que 0, K mayor que 1, y N >= K*5 para una prueba válida.",
      observedFrequencies: [],
      expectedFrequencies: [],
    };
  }

  const samples = await generateSamples(N, prngMethod, (prngMethod !== 'Math.random') ? prngSeedForTest : undefined);

  const observedFrequencies = new Array(K).fill(0);
  const expectedFrequency = N / K;

  if (expectedFrequency === 0) { 
     return {
      statistic: 0,
      degreesOfFreedom: K - 1,
      N,
      K,
      prngMethodUsed: prngMethod,
      prngSeedUsed: (prngMethod !== 'Math.random' && prngSeedForTest !== undefined) ? prngSeedForTest : undefined,
      interpretation: "La frecuencia esperada es 0, no se puede calcular Chi-cuadrado. Verifique N y K.",
      observedFrequencies,
      expectedFrequencies: new Array(K).fill(expectedFrequency),
    };
  }

  for (const sample of samples) {
    const binIndex = Math.min(Math.floor(sample * K), K - 1); 
    observedFrequencies[binIndex]++;
  }

  let chiSquareStatistic = 0;
  for (let i = 0; i < K; i++) {
    chiSquareStatistic += Math.pow(observedFrequencies[i] - expectedFrequency, 2) / expectedFrequency;
  }

  const degreesOfFreedom = K - 1;
  
  let interpretation = `Estadístico χ²: ${chiSquareStatistic.toFixed(3)}, Grados de Libertad: ${degreesOfFreedom}. `;
  interpretation += `Un valor de χ² más bajo en relación con los grados de libertad (K-1 = ${degreesOfFreedom}) sugiere que el generador PRNG (${prngMethod}`;
  if (prngMethod !== 'Math.random' && prngSeedForTest !== undefined) {
    interpretation += `, semilla ${prngSeedForTest}`;
  }
  interpretation += `) se ajusta bien a una distribución uniforme. `;
  interpretation += `Consulte una tabla de Chi-cuadrado para determinar la significancia (p.ej., para α=0.05).`;
  
  return {
    statistic: chiSquareStatistic,
    degreesOfFreedom,
    N,
    K,
    prngMethodUsed: prngMethod,
    prngSeedUsed: (prngMethod !== 'Math.random' && prngSeedForTest !== undefined) ? prngSeedForTest : undefined,
    interpretation,
    observedFrequencies,
    expectedFrequencies: new Array(K).fill(expectedFrequency),
  };
}
