'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/simulation/Header';
import Footer from '@/components/simulation/Footer';
import ParkingZone from '@/components/simulation/ParkingZone';
import SimulationControls from '@/components/simulation/SimulationControls';
import StatisticsDisplay from '@/components/simulation/StatisticsDisplay';
import EventLog from '@/components/simulation/EventLog';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { ParkingZoneData, ParkingSpaceData, ParkingSpaceStatus, SimulationParams, SimulationStats, EventLogEntry } from '@/types';
import { exponential, normal } from '@/lib/random';
import { PanelLeft } from 'lucide-react';

const MAX_EVENTS = 100;
const SIMULATION_DAY_START_MINUTE = 6 * 60; // 6:00 AM
const PEAK_START_MINUTE = 7.5 * 60; // 7:30 AM
const PEAK_END_MINUTE = 9 * 60; // 9:00 AM

const createSpaces = (idPrefix: string, count: number): ParkingSpaceData[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${idPrefix}-${i + 1}`,
    status: 'free',
  }));
};

const initialZones: ParkingZoneData[] = [
  { id: 'internal', name: 'Internal Zone', capacity: 20, spaces: createSpaces('I', 20) },
  { id: 'external', name: 'External Zone', capacity: 30, spaces: createSpaces('E', 30) },
  { id: 'projected', name: 'Projected Zone (Expansion)', capacity: 24, spaces: createSpaces('P', 24), isProjected: true },
];

const initialParams: SimulationParams = {
  morningArrivalMean: 1.8,
  peakArrivalMean: 1.0,
  afternoonArrivalMean: 3.5,
  parkingDurationMean: 5 * 60, // 5 hours in minutes
  parkingDurationStdDev: 1 * 60, // 1 hour in minutes
  enableReservations: false,
  enableProjectedZone: false,
  simulationSpeed: 10, // 10 simulation minutes per real second by default
};

const initialStats: SimulationStats = {
  totalArrivals: 0,
  totalDepartures: 0,
  totalRejections: 0,
  currentOccupancyInternal: 0,
  currentOccupancyExternal: 0,
  currentOccupancyProjected: -1, // -1 means not active
  occupancyRateInternal: 0,
  occupancyRateExternal: 0,
  occupancyRateProjected: 0,
  overallOccupancyRate: 0,
  rejectionRate: 0,
  avgParkingTime: 0,
  simulationClock: SIMULATION_DAY_START_MINUTE,
};

let eventIdCounter = 0;

export default function ParkSimPage() {
  const [zones, setZones] = useState<ParkingZoneData[]>(JSON.parse(JSON.stringify(initialZones)));
  const [params, setParams] = useState<SimulationParams>(initialParams);
  const [stats, setStats] = useState<SimulationStats>(initialStats);
  const [isRunning, setIsRunning] = useState(false);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const { toast } = useToast();

  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedParkingTimeRef = useRef(0);
  const departedVehiclesCountRef = useRef(0);
  const nextArrivalDueRef = useRef(0); // Stores time until next arrival

  const addEvent = useCallback((message: string) => {
    setEventLog(prev => {
      const newEvent: EventLogEntry = {
        id: `evt-${eventIdCounter++}`,
        timestamp: `${String(Math.floor(stats.simulationClock / 60)).padStart(2, '0')}:${String(stats.simulationClock % 60).padStart(2, '0')}`,
        message,
      };
      const updatedLog = [newEvent, ...prev];
      return updatedLog.length > MAX_EVENTS ? updatedLog.slice(0, MAX_EVENTS) : updatedLog;
    });
  }, [stats.simulationClock]);

  const updateStatistics = useCallback(() => {
    setStats(currentStats => {
      let totalCapacity = 0;
      let totalOccupied = 0;
      
      const updatedOccupancy = {
        internal: 0,
        external: 0,
        projected: params.enableProjectedZone ? 0 : -1,
      };

      zones.forEach(zone => {
        if (zone.isProjected && !params.enableProjectedZone) return;

        const occupiedInZone = zone.spaces.filter(s => s.status === 'occupied' || (s.status === 'reserved' && params.enableReservations)).length;
        totalCapacity += zone.capacity;
        totalOccupied += occupiedInZone;

        if (zone.id === 'internal') updatedOccupancy.internal = occupiedInZone;
        else if (zone.id === 'external') updatedOccupancy.external = occupiedInZone;
        else if (zone.id === 'projected') updatedOccupancy.projected = occupiedInZone;
      });
      
      const internalZoneData = zones.find(z => z.id === 'internal');
      const externalZoneData = zones.find(z => z.id === 'external');
      const projectedZoneData = zones.find(z => z.id === 'projected');

      return {
        ...currentStats,
        currentOccupancyInternal: updatedOccupancy.internal,
        currentOccupancyExternal: updatedOccupancy.external,
        currentOccupancyProjected: updatedOccupancy.projected,
        occupancyRateInternal: internalZoneData && internalZoneData.capacity > 0 ? (updatedOccupancy.internal / internalZoneData.capacity) * 100 : 0,
        occupancyRateExternal: externalZoneData && externalZoneData.capacity > 0 ? (updatedOccupancy.external / externalZoneData.capacity) * 100 : 0,
        occupancyRateProjected: params.enableProjectedZone && projectedZoneData && projectedZoneData.capacity > 0 ? (updatedOccupancy.projected / projectedZoneData.capacity) * 100 : 0,
        overallOccupancyRate: totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0,
        rejectionRate: currentStats.totalArrivals > 0 ? (currentStats.totalRejections / currentStats.totalArrivals) * 100 : 0,
        avgParkingTime: departedVehiclesCountRef.current > 0 ? accumulatedParkingTimeRef.current / departedVehiclesCountRef.current : 0,
      };
    });
  }, [zones, params.enableProjectedZone, params.enableReservations]);


  const simulationTick = useCallback(() => {
    setStats(prevStats => ({ ...prevStats, simulationClock: prevStats.simulationClock + 1 }));

    setZones(currentZones => {
      const newZones = JSON.parse(JSON.stringify(currentZones)) as ParkingZoneData[];
      let vehicleDepartedThisTick = false;

      // Process departures
      newZones.forEach(zone => {
        zone.spaces.forEach(space => {
          if ((space.status === 'occupied' || (space.status === 'reserved' && params.enableReservations)) && space.departureTime !== undefined && space.departureTime <= stats.simulationClock) {
            const parkingDuration = stats.simulationClock - (space.departureTime - (Math.round(normal(params.parkingDurationMean, params.parkingDurationStdDev)))); // Reconstruct approx entry time
            accumulatedParkingTimeRef.current += parkingDuration > 0 ? parkingDuration : params.parkingDurationMean;
            departedVehiclesCountRef.current +=1;
            
            addEvent(`Vehicle ${space.vehicleId || 'N/A'} departed from ${zone.name} space ${space.id}. Parked for ~${(parkingDuration > 0 ? parkingDuration : params.parkingDurationMean).toFixed(0)} min.`);
            space.status = 'free';
            delete space.vehicleId;
            delete space.departureTime;
            vehicleDepartedThisTick = true;
            setStats(prev => ({...prev, totalDepartures: prev.totalDepartures + 1}));
          }
        });
      });

      // Process arrivals
      if (nextArrivalDueRef.current <= 0) {
        setStats(prev => ({...prev, totalArrivals: prev.totalArrivals + 1}));
        let allocated = false;
        const vehicleId = `V-${stats.totalArrivals + 1}`;

        // Determine arrival zone priority: internal, external, projected (if enabled)
        const zonePriority = ['internal', 'external'];
        if (params.enableProjectedZone) {
          zonePriority.push('projected');
        }

        for (const zoneId of zonePriority) {
          const zone = newZones.find(z => z.id === zoneId);
          if (zone) {
            const freeSpace = zone.spaces.find(s => s.status === 'free');
            if (freeSpace) {
              freeSpace.status = 'occupied'; // Simplified: directly to occupied
              freeSpace.vehicleId = vehicleId;
              const duration = Math.max(1, Math.round(normal(params.parkingDurationMean, params.parkingDurationStdDev)));
              freeSpace.departureTime = stats.simulationClock + duration;
              addEvent(`Vehicle ${vehicleId} arrived and parked in ${zone.name} space ${freeSpace.id}. Duration: ${duration} min.`);
              allocated = true;
              break; 
            }
          }
        }

        if (!allocated) {
          setStats(prev => ({...prev, totalRejections: prev.totalRejections + 1}));
          addEvent(`Vehicle ${vehicleId} rejected. No space available.`);
        }
        
        // Schedule next arrival
        let meanArrival;
        if (stats.simulationClock >= PEAK_START_MINUTE && stats.simulationClock < PEAK_END_MINUTE) {
          meanArrival = params.peakArrivalMean;
        } else if (stats.simulationClock < PEAK_START_MINUTE) { // Morning
          meanArrival = params.morningArrivalMean;
        } else { // Afternoon
          meanArrival = params.afternoonArrivalMean;
        }
        nextArrivalDueRef.current = Math.max(1, Math.round(exponential(meanArrival)));

      } else {
         nextArrivalDueRef.current -=1;
      }
      if (vehicleDepartedThisTick || nextArrivalDueRef.current <=0) { // only update stats if something changed
         updateStatistics();
      }
      return newZones;
    });
    
  }, [addEvent, params, stats.simulationClock, stats.totalArrivals, updateStatistics]);


  useEffect(() => {
    if (isRunning) {
      const intervalTime = 1000 / params.simulationSpeed; // Real-time milliseconds per simulation minute
      simulationIntervalRef.current = setInterval(simulationTick, intervalTime);
    } else {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    }
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, [isRunning, simulationTick, params.simulationSpeed]);

  useEffect(() => {
    updateStatistics();
  }, [zones, updateStatistics]);


  const handleParamChange = <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleStart = () => {
    setIsRunning(true);
    addEvent("Simulation started.");
    if(nextArrivalDueRef.current <=0 ) { // Initialize first arrival if not already set
        let meanArrival;
        if (stats.simulationClock >= PEAK_START_MINUTE && stats.simulationClock < PEAK_END_MINUTE) {
          meanArrival = params.peakArrivalMean;
        } else if (stats.simulationClock < PEAK_START_MINUTE) { 
          meanArrival = params.morningArrivalMean;
        } else { 
          meanArrival = params.afternoonArrivalMean;
        }
        nextArrivalDueRef.current = Math.max(1, Math.round(exponential(meanArrival)));
    }
  };
  const handlePause = () => {
    setIsRunning(false);
    addEvent("Simulation paused.");
  };
  const handleReset = () => {
    setIsRunning(false);
    setZones(JSON.parse(JSON.stringify(initialZones)));
    setParams(initialParams);
    setStats(initialStats);
    setEventLog([]);
    accumulatedParkingTimeRef.current = 0;
    departedVehiclesCountRef.current = 0;
    nextArrivalDueRef.current = 0;
    eventIdCounter = 0;
    addEvent("Simulation reset.");
    toast({ title: "Simulation Reset", description: "All parameters and states have been reset to initial values." });
  };
  
  const activeZones = zones.filter(zone => !zone.isProjected || params.enableProjectedZone);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <SidebarProvider defaultOpen={true}>
        <div className="flex flex-1 overflow-hidden">
          <Sidebar collapsible="icon" className="border-r bg-card">
            <SidebarHeader className="p-2 flex justify-between items-center">
              <h2 className="font-semibold text-lg font-headline p-2">Controls & Stats</h2>
               <div className="md:hidden">
                <SidebarTrigger><PanelLeft /></SidebarTrigger>
              </div>
            </SidebarHeader>
            <SidebarContent className="p-2 space-y-4">
              <SimulationControls
                params={params}
                onParamChange={handleParamChange}
                onStart={handleStart}
                onPause={handlePause}
                onReset={handleReset}
                isRunning={isRunning}
              />
              <StatisticsDisplay stats={stats} />
              <EventLog events={eventLog} />
            </SidebarContent>
            <SidebarFooter className="p-2">
              {/* Can add footer content for sidebar here */}
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 lg:p-8">
              <h2 className="text-2xl font-headline mb-6 text-center">Parking Lot Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {activeZones.map((zone) => (
                  <ParkingZone key={zone.id} zone={zone} />
                ))}
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
      <Footer />
    </div>
  );
}
