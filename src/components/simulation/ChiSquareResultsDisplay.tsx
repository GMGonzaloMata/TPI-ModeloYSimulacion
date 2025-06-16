
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CheckCircle, AlertCircle, TestTubeDiagonal } from 'lucide-react';
import type { ChiSquareResult } from '@/types';

interface ChiSquareResultsDisplayProps {
  results: ChiSquareResult;
}

const ChiSquareResultsDisplay: React.FC<ChiSquareResultsDisplayProps> = ({ results }) => {
  const { statistic, degreesOfFreedom, N, K, prngMethodUsed, lcgSeedUsed, interpretation, observedFrequencies, expectedFrequencies } = results;

  const chartData = observedFrequencies && expectedFrequencies ? observedFrequencies.map((obs, index) => ({
    name: `Intervalo ${index + 1}`,
    Observado: obs,
    Esperado: expectedFrequencies[index],
  })) : [];

  const isPotentiallyGoodFit = statistic <= degreesOfFreedom * 2; // Very rough heuristic

  return (
    <Card className="shadow-lg mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="font-headline text-lg flex items-center">
          <TestTubeDiagonal className="mr-2 h-5 w-5 text-blue-500" />
          Resultados Prueba Chi-cuadrado
        </CardTitle>
        <CardDescription>
          PRNG: {prngMethodUsed} {prngMethodUsed === 'LCG' && lcgSeedUsed !== undefined ? `(Semilla: ${lcgSeedUsed})` : ''} | N={N}, K={K}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <div className="flex items-center">
          {isPotentiallyGoodFit ? <CheckCircle className="h-5 w-5 text-green-500 mr-2" /> : <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />}
          <p className="text-sm text-muted-foreground flex-1">{interpretation}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div><span className="font-semibold">Estadístico (χ²):</span> {statistic.toFixed(4)}</div>
          <div><span className="font-semibold">Grados de Libertad (gl):</span> {degreesOfFreedom}</div>
        </div>
        
        {chartData.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2 text-center">Frecuencias Observadas vs. Esperadas</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-30} textAnchor="end" height={50} interval={0} tick={{ fontSize: '10px' }} />
                <YAxis tick={{ fontSize: '10px' }} />
                <Tooltip wrapperStyle={{ fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Observado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Esperado" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChiSquareResultsDisplay;
