
'use client';

import React from 'react';
import ParkingSpace from './ParkingSpace';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { ParkingZoneData } from '@/types';

interface ParkingZoneProps {
  zone: ParkingZoneData;
}

const ParkingZone: React.FC<ParkingZoneProps> = ({ zone }) => {
  const occupiedCount = zone.spaces.filter(s => s.status === 'occupied' || s.status === 'reserved').length;
  const occupancyPercentage = zone.capacity > 0 ? (occupiedCount / zone.capacity) * 100 : 0;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-xl">{zone.name}</CardTitle>
        <CardDescription>
          {occupiedCount} / {zone.capacity} espacios ocupados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={occupancyPercentage} className="mb-4 h-3" />
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3">
          {zone.spaces.map((space) => (
            <ParkingSpace key={space.id} id={space.id} status={space.status} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ParkingZone;

