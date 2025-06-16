
'use client';

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SimulationStats, ParkingZoneData } from '@/types';

interface OccupancyPieChartProps {
  stats: SimulationStats;
  zonesData: ParkingZoneData[];
  projectedZoneEnabled: boolean;
}

const OccupancyPieChart: React.FC<OccupancyPieChartProps> = ({ stats, zonesData, projectedZoneEnabled }) => {
  const activeZones = zonesData.filter(zone => !zone.isProjected || projectedZoneEnabled);
  
  const totalCapacity = activeZones.reduce((sum, zone) => sum + zone.capacity, 0);
  
  // Calculate total occupied based on currentOccupancy stats for precision
  let totalOccupied = stats.currentOccupancyInternal + stats.currentOccupancyExternal;
  if (projectedZoneEnabled && stats.currentOccupancyProjected > -1) {
    totalOccupied += stats.currentOccupancyProjected;
  }

  const totalFree = totalCapacity > 0 ? Math.max(0, totalCapacity - totalOccupied) : 0;

  const data = [
    { name: 'Ocupados', value: totalOccupied },
    { name: 'Libres', value: totalFree },
  ];

  const COLORS = ['hsl(var(--destructive))', 'hsl(var(--primary))']; // Destructive for occupied, Primary for free

  if (totalCapacity === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-lg">Ocupación General (Gráfico)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No hay zonas activas o capacidad para mostrar el gráfico.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="font-headline text-lg">Ocupación General (Gráfico)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number, name: string) => [`${value} espacios`, name]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default OccupancyPieChart;
