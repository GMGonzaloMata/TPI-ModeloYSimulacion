
import React from 'react';
import Image from 'next/image';

const Header: React.FC = () => {
  return (
    <header className="bg-card text-card-foreground p-4 shadow-md">
      <div className="container mx-auto flex items-center">
        <Image 
          src="https://res.cloudinary.com/dhsx2g5ez/image/upload/v1750040724/cuenca-Photoroom_zzw1rb.png" 
          alt="Logo UCP" 
          width={60} // Increased size
          height={60} // Increased size
          className="mr-4 rounded-full" // Added more margin
          priority
        />
        <h1 className="text-xl sm:text-2xl font-headline font-bold">Estacionamiento UCP</h1>
      </div>
    </header>
  );
};

export default Header;
