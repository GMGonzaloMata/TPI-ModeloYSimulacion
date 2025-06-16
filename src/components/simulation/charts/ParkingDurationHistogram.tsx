
'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ParkingDurationHistogramProps {
  durations: number[]; // in minutes
}

const ParkingDurationHistogram: React.FC<ParkingDurationHistogramProps> = ({ durations }) => {
  if (!durations || durations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-lg">Distribución de Tiempos de Estacionamiento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No hay datos de duración de estacionamiento para mostrar.</p>
        </CardContent>
      </Card>
    );
  }

  // Determine bins dynamically, e.g., 60-minute intervals
  const maxDuration = Math.max(...durations);
  const binSize = 60; // 1 hour bins
  const numBins = Math.ceil(maxDuration / binSize);

  const histogramData = Array.from({ length: numBins }, (_, i) => {
    const lowerBound = i * binSize;
    const upperBound = (i + 1) * binSize -1;
    return {
      name: `${lowerBound}-${upperBound} min`,
      count: 0,
    };
  });
  
  // Ensure there's at least one bin if all durations are 0 or very small
  if (histogramData.length === 0 && maxDuration >= 0) {
      histogramData.push({ name: `0-${binSize-1} min`, count: 0});
  }


  durations.forEach(duration => {
    let binIndex = Math.floor(duration / binSize);
    if (binIndex >= numBins && numBins > 0) binIndex = numBins -1; // Put durations >= max into last bin
    else if (binIndex < 0) binIndex = 0; // Should not happen with positive durations

    if (histogramData[binIndex]) {
      histogramData[binIndex].count++;
    }
  });
  
  const filteredHistogramData = histogramData.filter(bin => bin.count > 0 || histogramData.length <= 5 );


  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="font-headline text-lg">Distribución de Tiempos de Estacionamiento</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={filteredHistogramData.length > 0 ? filteredHistogramData : [{name: "N/A", count: 0}]} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-30} textAnchor="end" height={50} interval={0} tick={{ fontSize: '10px' }}/>
            <YAxis allowDecimals={false} tick={{ fontSize: '10px' }} />
            <Tooltip formatter={(value: number) => [value, "Vehículos"]} />
            <Legend formatter={() => "Nº Vehículos"} wrapperStyle={{ fontSize: '12px' }}/>
            <Bar dataKey="count" fill="hsl(var(--chart-1))" name="Vehículos" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ParkingDurationHistogram;
