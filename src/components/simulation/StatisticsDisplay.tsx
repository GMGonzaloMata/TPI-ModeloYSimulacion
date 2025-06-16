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
      <CardHeader>
        <CardTitle className="font-headline text-lg flex items-center"><BarChartBig className="mr-2 h-5 w-5" />Statistics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatItem icon={<Clock className="h-4 w-4 text-primary" />} label="Simulation Time" value={formatTime(stats.simulationClock)} />
        <StatItem icon={<Percent className="h-4 w-4 text-accent" />} label="Overall Occupancy" value={`${stats.overallOccupancyRate.toFixed(1)}%`} />
        <StatItem icon={<Users className="h-4 w-4 text-secondary-foreground" />} label="Total Arrivals" value={stats.totalArrivals.toString()} />
        <StatItem icon={<TrendingUp className="h-4 w-4 text-green-500" />} label="Total Departures" value={stats.totalDepartures.toString()} />
        <StatItem icon={<TrendingDown className="h-4 w-4 text-destructive" />} label="Total Rejections" value={stats.totalRejections.toString()} />
        <StatItem icon={<Percent className="h-4 w-4 text-destructive" />} label="Rejection Rate" value={`${stats.rejectionRate.toFixed(1)}%`} />
        <StatItem icon={<Clock className="h-4 w-4 text-muted-foreground" />} label="Avg. Park Time" value={`${stats.avgParkingTime.toFixed(0)} min`} />
        
        <div className="pt-2">
            <h4 className="text-xs font-semibold mb-1 text-muted-foreground">Zone Occupancy:</h4>
            <StatItem icon={<Percent className="h-3 w-3 text-indigo-500"/>} label="Internal" value={`${stats.occupancyRateInternal.toFixed(1)}% (${stats.currentOccupancyInternal})`} small />
            <StatItem icon={<Percent className="h-3 w-3 text-purple-500"/>} label="External" value={`${stats.occupancyRateExternal.toFixed(1)}% (${stats.currentOccupancyExternal})`} small />
            {stats.currentOccupancyProjected > -1 && <StatItem icon={<Percent className="h-3 w-3 text-pink-500"/>} label="Projected" value={`${stats.occupancyRateProjected.toFixed(1)}% (${stats.currentOccupancyProjected})`} small />}
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
