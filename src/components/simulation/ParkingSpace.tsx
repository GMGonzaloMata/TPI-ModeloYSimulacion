'use client';

import React from 'react';
import { CarFront, ParkingCircle, ParkingSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ParkingSpaceStatus } from '@/types';

interface ParkingSpaceProps {
  status: ParkingSpaceStatus;
  id: string;
}

const ParkingSpace: React.FC<ParkingSpaceProps> = ({ status, id }) => {
  const baseClasses = "w-10 h-10 md:w-12 md:h-12 rounded-md flex items-center justify-center border-2 transition-all duration-300 ease-in-out shadow-sm";
  
  let content;
  let SvgIcon;
  let statusText;
  let colorClasses = "";

  switch (status) {
    case 'occupied':
      SvgIcon = CarFront;
      statusText = "Occupied";
      colorClasses = "bg-destructive/20 border-destructive text-destructive-foreground hover:bg-destructive/30";
      break;
    case 'reserved':
      SvgIcon = ParkingCircle;
      statusText = "Reserved";
      colorClasses = "bg-primary/20 border-primary text-primary-foreground hover:bg-primary/30";
      break;
    case 'free':
    default:
      SvgIcon = ParkingSquare; // Represents an empty, available square
      statusText = "Free";
      colorClasses = "bg-accent/20 border-accent text-accent-foreground hover:bg-accent/30";
      break;
  }

  // For occupied/reserved, the icon color needs to contrast with its specific background,
  // but text-destructive-foreground/primary-foreground might be too light for a light background.
  // Let's use text-destructive, text-primary for icons on their respective light backgrounds for clarity.
  const iconColorClass = status === 'occupied' ? 'text-destructive' : status === 'reserved' ? 'text-primary' : 'text-accent';


  content = <SvgIcon className={cn("w-5 h-5 md:w-6 md:h-6", iconColorClass)} />;
  
  return (
    <div 
      className={cn(baseClasses, colorClasses)}
      aria-label={`Parking space ${id}: ${statusText}`}
      role="img" // More appropriate for visual representation of state
    >
      {content}
    </div>
  );
};

export default ParkingSpace;
