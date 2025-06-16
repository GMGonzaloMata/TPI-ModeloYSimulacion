
import React from 'react';
import { ParkingSquare } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-primary text-primary-foreground p-4 shadow-md">
      <div className="container mx-auto flex items-center">
        <ParkingSquare size={32} className="mr-3" />
        <h1 className="text-2xl font-headline font-bold">ParkSim UCP</h1>
      </div>
    </header>
  );
};

export default Header;
