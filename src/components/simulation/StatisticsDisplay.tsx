
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Users, Clock, Percent, BarChartBig } from 'lucide-react';
import type { SimulationStats } from '@/types';

interface StatisticsDisplayProps {
  stats: SimulationStats;
}

const formatTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};


const StatisticsDisplay: React.FC<StatisticsDisplayProps> = ({ stats }) => {
  return (
    <Card className="shadow-lg mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="font-headline text-lg flex items-center"><BarChartBig className="mr-2 h-5 w-5" />Estadísticas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <StatItem icon={<Clock className="h-4 w-4 text-primary" />} label="Tiempo Simulación" value={formatTime(stats.simulationClock)} />
        <StatItem icon={<Percent className="h-4 w-4 text-accent" />} label="Ocupación General" value={`${stats.overallOccupancyRate.toFixed(1)}%`} />
        <StatItem icon={<Users className="h-4 w-4 text-secondary-foreground" />} label="Llegadas Totales" value={stats.totalArrivals.toString()} />
        <StatItem icon={<TrendingUp className="h-4 w-4 text-green-500" />} label="Salidas Totales" value={stats.totalDepartures.toString()} />
        <StatItem icon={<TrendingDown className="h-4 w-4 text-destructive" />} label="Rechazos Totales" value={stats.totalRejections.toString()} />
        <StatItem icon={<Percent className="h-4 w-4 text-destructive" />} label="Tasa de Rechazo" value={`${stats.rejectionRate.toFixed(1)}%`} />
        <StatItem icon={<Clock className="h-4 w-4 text-muted-foreground" />} label="Tiempo Prom. Estac." value={`${stats.avgParkingTime.toFixed(0)} min`} />
        
        <div className="pt-2">
            <h4 className="text-xs font-semibold mb-1 text-muted-foreground">Ocupación por Zona:</h4>
            <StatItem icon={<Percent className="h-3 w-3 text-indigo-500"/>} label="Interna" value={`${stats.occupancyRateInternal.toFixed(1)}% (${stats.currentOccupancyInternal})`} small />
            <StatItem icon={<Percent className="h-3 w-3 text-purple-500"/>} label="Externa" value={`${stats.occupancyRateExternal.toFixed(1)}% (${stats.currentOccupancyExternal})`} small />
            {stats.currentOccupancyProjected > -1 && <StatItem icon={<Percent className="h-3 w-3 text-pink-500"/>} label="Proyectada" value={`${stats.occupancyRateProjected.toFixed(1)}% (${stats.currentOccupancyProjected})`} small />}
        </div>
      </CardContent>
    </Card>
  );
};

const StatItem: React.FC<{ icon: React.ReactNode; label: string; value: string; small?: boolean }> = ({ icon, label, value, small }) => (
  <div className={`flex items-center justify-between ${small ? 'text-xs py-0.5' : 'text-sm py-1'}`}>
    <div className="flex items-center">
      {icon}
      <span className="ml-2 text-muted-foreground">{label}:</span>
    </div>
    <span className="font-semibold">{value}</span>
  </div>
);

export default StatisticsDisplay;
