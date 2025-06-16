
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-card text-card-foreground p-4 text-center border-t mt-auto">
      <div className="container mx-auto">
        <p className="text-sm">
          &copy; {new Date().getFullYear()} ParkSim UCP. Simulación con fines educativos.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
