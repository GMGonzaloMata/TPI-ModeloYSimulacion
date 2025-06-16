
import React from 'react';
import Image from 'next/image';
import { ParkingSquare } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-primary text-primary-foreground p-4 shadow-md">
      <div className="container mx-auto flex items-center">
        <Image 
          src="https://res.cloudinary.com/dhsx2g5ez/image/upload/v1750040724/cuenca-Photoroom_zzw1rb.png" 
          alt="Logo UCP" 
          width={40} 
          height={40} 
          className="mr-3 rounded-full"
          priority
        />
        <ParkingSquare size={32} className="mr-3 hidden sm:block" />
        <h1 className="text-xl sm:text-2xl font-headline font-bold">ParkSim UCP</h1>
      </div>
    </header>
  );
};

export default Header;
