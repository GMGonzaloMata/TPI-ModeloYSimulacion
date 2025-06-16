
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/simulation/Header';
import Footer from '@/components/simulation/Footer';
import ParkingZone from '@/components/simulation/ParkingZone';
import SimulationControls from '@/components/simulation/SimulationControls';
import StatisticsDisplay from '@/components/simulation/StatisticsDisplay';
import EventLog from '@/components/simulation/EventLog';
import ChiSquareResultsDisplay from '@/components/simulation/ChiSquareResultsDisplay';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { ParkingZoneData, ParkingSpaceData, SimulationParams, SimulationStats, EventLogEntry, ChiSquareResult, PrngMethodType } from '@/types';
import { exponential, normal, setPrng, getLcgSeed as getRandomLcgSeed, setLcgSeed as setRandomLcgSeed, getActiveGenerator } from '@/lib/random';
import { performChiSquareTest } from '@/lib/chiSquare';
import { PanelLeft } from 'lucide-react';

const MAX_EVENTS = 100;
// Constants for peak times, relative to midnight
const PEAK_START_MINUTE = 7.5 * 60; // 7:30 AM
const PEAK_END_MINUTE = 9 * 60; // 9:00 AM

const createSpaces = (idPrefix: string, count: number): ParkingSpaceData[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${idPrefix}-${i + 1}`,
    status: 'free',
  }));
};

const initialZones: ParkingZoneData[] = [
  { id: 'internal', name: 'Zona Interna', capacity: 20, spaces: createSpaces('I', 20) },
  { id: 'external', name: 'Zona Externa', capacity: 30, spaces: createSpaces('E', 30) },
  { id: 'projected', name: 'Zona Proyectada (Expansión)', capacity: 24, spaces: createSpaces('P', 24), isProjected: true },
];

const initialParams: SimulationParams = {
  morningArrivalMean: 1.8,
  peakArrivalMean: 1.0,
  afternoonArrivalMean: 3.5,
  parkingDurationMean: 5 * 60, 
  parkingDurationStdDev: 1 * 60, 
  enableReservations: false,
  enableProjectedZone: false,
  simulationSpeed: 10,
  prngMethod: 'Math.random',
  lcgSeed: 1,
  chiSquareSampleSize: 1000,
  chiSquareNumBins: 10,
  simulationStartTime: 6 * 60, // 6:00 AM
  simulationEndTime: 22 * 60,  // 10:00 PM
};

const getInitialStats = (startTime: number): SimulationStats => ({
  totalArrivals: 0,
  totalDepartures: 0,
  totalRejections: 0,
  currentOccupancyInternal: 0,
  currentOccupancyExternal: 0,
  currentOccupancyProjected: -1,
  occupancyRateInternal: 0,
  occupancyRateExternal: 0,
  occupancyRateProjected: 0,
  overallOccupancyRate: 0,
  rejectionRate: 0,
  avgParkingTime: 0,
  simulationClock: startTime,
});

let eventIdCounter = 0;

export default function ParkSimPage() {
  const [zones, setZones] = useState<ParkingZoneData[]>(JSON.parse(JSON.stringify(initialZones)));
  const [params, setParams] = useState<SimulationParams>(initialParams);
  const [stats, setStats] = useState<SimulationStats>(getInitialStats(initialParams.simulationStartTime));
  const [isRunning, setIsRunning] = useState(false);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [chiSquareResults, setChiSquareResults] = useState<ChiSquareResult | null>(null);
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedParkingTimeRef = useRef(0);
  const departedVehiclesCountRef = useRef(0);
  const nextArrivalDueRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    setPrng(initialParams.prngMethod, initialParams.lcgSeed);
    setStats(getInitialStats(params.simulationStartTime)); // Ensure clock is set based on potentially changed params
  }, []); // Empty dependency to run once on mount

   useEffect(() => {
    // When params related to simulation start time change, update initial stats clock
    setStats(currentStats => ({
        ...currentStats,
        simulationClock: params.simulationStartTime,
    }));
    // If not running, also reset other relevant stats for a fresh start if params change
    if (!isRunning) {
        setEventLog([]);
        accumulatedParkingTimeRef.current = 0;
        departedVehiclesCountRef.current = 0;
        nextArrivalDueRef.current = 0;
        eventIdCounter = 0;
        setZones(JSON.parse(JSON.stringify(initialZones))); // Reset zones too
         // Update statistics display based on reset state
        updateStatistics();
    }
  }, [params.simulationStartTime, params.simulationEndTime]);


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
    if (stats.simulationClock >= params.simulationEndTime) {
      setIsRunning(false);
      addEvent("Simulación finalizada por alcanzar hora de cierre.");
      toast({ title: "Simulación Finalizada", description: "Se alcanzó la hora de cierre configurada." });
      return;
    }

    setStats(prevStats => ({ ...prevStats, simulationClock: prevStats.simulationClock + 1 }));

    setZones(currentZones => {
      const newZones = JSON.parse(JSON.stringify(currentZones)) as ParkingZoneData[];
      let vehicleDepartedThisTick = false;
      let vehicleArrivedThisTick = false;

      newZones.forEach(zone => {
        zone.spaces.forEach(space => {
          if ((space.status === 'occupied' || (space.status === 'reserved' && params.enableReservations)) && space.departureTime !== undefined && space.departureTime <= stats.simulationClock) {
            const durationParked = space.assignedDuration || params.parkingDurationMean; // Use stored duration
            accumulatedParkingTimeRef.current += durationParked;
            departedVehiclesCountRef.current +=1;
            
            addEvent(`Vehículo ${space.vehicleId || 'N/A'} salió de ${zone.name} espacio ${space.id}. Estac. por ~${durationParked.toFixed(0)} min.`);
            space.status = 'free';
            delete space.vehicleId;
            delete space.departureTime;
            delete space.assignedDuration; // Clean up stored duration
            vehicleDepartedThisTick = true;
            setStats(prev => ({...prev, totalDepartures: prev.totalDepartures + 1}));
          }
        });
      });

      if (nextArrivalDueRef.current <= 0) {
        setStats(prev => ({...prev, totalArrivals: prev.totalArrivals + 1}));
        let allocated = false;
        const vehicleId = `V-${stats.totalArrivals + 1}`; // Use current stats.totalArrivals for ID
        const zonePriority = ['internal', 'external'];
        if (params.enableProjectedZone) {
          zonePriority.push('projected');
        }

        for (const zoneId of zonePriority) {
          const zone = newZones.find(z => z.id === zoneId);
          if (zone) {
            const freeSpace = zone.spaces.find(s => s.status === 'free');
            if (freeSpace) {
              freeSpace.status = 'occupied';
              freeSpace.vehicleId = vehicleId;
              const duration = Math.max(1, Math.round(normal(params.parkingDurationMean, params.parkingDurationStdDev)));
              freeSpace.assignedDuration = duration; // Store assigned duration
              freeSpace.departureTime = stats.simulationClock + duration;
              addEvent(`Vehículo ${vehicleId} llegó y estacionó en ${zone.name} espacio ${freeSpace.id}. Duración: ${duration} min.`);
              allocated = true;
              vehicleArrivedThisTick = true;
              break; 
            }
          }
        }

        if (!allocated) {
          setStats(prev => ({...prev, totalRejections: prev.totalRejections + 1}));
          addEvent(`Vehículo ${vehicleId} rechazado. Sin espacio disponible.`);
          vehicleArrivedThisTick = true; // An arrival attempt occurred
        }
        
        let meanArrival;
        // Determine arrival rate based on current simulation clock
        if (stats.simulationClock >= PEAK_START_MINUTE && stats.simulationClock < PEAK_END_MINUTE) {
          meanArrival = params.peakArrivalMean;
        } else if (stats.simulationClock < PEAK_START_MINUTE || stats.simulationClock >= params.simulationEndTime /* handle edge case if clock is already past peak but not at end */) {
           // Default to morning if before peak, or if after peak (afternoon rate applies)
           // This logic might need refinement if there are specific post-peak afternoon rates vs evening rates
          meanArrival = params.morningArrivalMean; // Assuming morning for pre-peak
          if (stats.simulationClock >= PEAK_END_MINUTE) { // Post-peak
            meanArrival = params.afternoonArrivalMean;
          }
        } else { // After peak
            meanArrival = params.afternoonArrivalMean;
        }
        nextArrivalDueRef.current = Math.max(1, Math.round(exponential(meanArrival)));

      } else {
         nextArrivalDueRef.current -=1;
      }

      if (vehicleDepartedThisTick || vehicleArrivedThisTick) {
         updateStatistics();
      }
      return newZones;
    });
    
  }, [addEvent, params, stats.simulationClock, stats.totalArrivals, updateStatistics, toast]);


  useEffect(() => {
    if (isRunning) {
      const intervalTime = 1000 / params.simulationSpeed;
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

  // useEffect(() => {
  //   updateStatistics(); // This might run too often if zones is in dep array.
  // }, [zones, updateStatistics]); 
  // updateStatistics is called within simulationTick when changes occur.

  const handleParamChange = <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => {
    setParams(prev => {
      const newParams = { ...prev, [key]: value };
      if (key === 'prngMethod' || (key === 'lcgSeed' && newParams.prngMethod === 'LCG')) {
        setPrng(newParams.prngMethod, newParams.lcgSeed);
        setChiSquareResults(null); 
      }
      // If simulation time parameters change and simulation is not running, reset clock
      if ((key === 'simulationStartTime' || key === 'simulationEndTime') && !isRunning) {
         setStats(currentStats => ({
            ...getInitialStats(newParams.simulationStartTime), // Reset all stats, set clock to new start time
            totalArrivals: currentStats.totalArrivals, // Preserve some stats if desired, or fully reset
            totalDepartures: currentStats.totalDepartures,
            totalRejections: currentStats.totalRejections,
         }));
         setEventLog([]);
         accumulatedParkingTimeRef.current = 0;
         departedVehiclesCountRef.current = 0;
         nextArrivalDueRef.current = 0; // Reset next arrival too
         eventIdCounter = 0;
         setZones(JSON.parse(JSON.stringify(initialZones)));
      }
      return newParams;
    });
  };

  const handleStart = () => {
    if (stats.simulationClock >= params.simulationEndTime) {
      addEvent("La simulación ya ha alcanzado la hora de finalización. Reinicie para comenzar de nuevo.");
      toast({ title: "Simulación Finalizada", description: "Reinicie para comenzar de nuevo.", variant: "default" });
      setIsRunning(false);
      return;
    }
    if (stats.simulationClock < params.simulationStartTime) {
      setStats(prev => ({...prev, simulationClock: params.simulationStartTime}));
      addEvent(`Reloj ajustado al inicio de la simulación: ${params.simulationStartTime}.`);
    }

    setIsRunning(true);
    addEvent("Simulación iniciada.");
    setPrng(params.prngMethod, params.lcgSeed); 
    if(nextArrivalDueRef.current <=0 ) { // Schedule first arrival if not already scheduled
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
    addEvent("Simulación pausada.");
  };
  const handleReset = () => {
    setIsRunning(false);
    setParams(initialParams); // Reset params to defaults
    setZones(JSON.parse(JSON.stringify(initialZones)));
    setStats(getInitialStats(initialParams.simulationStartTime)); // Reset stats with default start time
    setEventLog([]);
    setChiSquareResults(null);
    accumulatedParkingTimeRef.current = 0;
    departedVehiclesCountRef.current = 0;
    nextArrivalDueRef.current = 0;
    eventIdCounter = 0;
    setPrng(initialParams.prngMethod, initialParams.lcgSeed); // Reset PRNG to defaults
    addEvent("Simulación reiniciada.");
    toast({ title: "Simulación Reiniciada", description: "Todos los parámetros y estados han sido restaurados." });
    updateStatistics(); // Update display after reset
  };
  
  const handleRunChiSquareTest = async () => {
    if (isRunning) {
      toast({ title: "Prueba Chi-cuadrado", description: "Detenga la simulación para ejecutar la prueba.", variant: "destructive" });
      return;
    }
    const currentSeedForTest = params.prngMethod === 'LCG' ? params.lcgSeed : undefined;

    // Ensure the active PRNG for the test is set correctly
    // setPrng(params.prngMethod, currentSeedForTest); // generateSamples in chiSquare.ts handles this temporarily

    const results = await performChiSquareTest(
      params.chiSquareSampleSize,
      params.chiSquareNumBins,
      params.prngMethod,
      currentSeedForTest 
    );
    setChiSquareResults(results);
    toast({ title: "Prueba Chi-cuadrado Completada", description: `Método: ${params.prngMethod}, N=${params.chiSquareSampleSize}, K=${params.chiSquareNumBins}` });
    addEvent(`Prueba Chi-cuadrado ejecutada para ${params.prngMethod}. N=${params.chiSquareSampleSize}, K=${params.chiSquareNumBins}. Estadístico: ${results.statistic.toFixed(3)}.`);
  
    // Restore simulation's PRNG state if it was changed for the test
    // setPrng(params.prngMethod, params.lcgSeed); // generateSamples in chiSquare.ts restores original
  };

  useEffect(() => {
    updateStatistics();
  }, [zones, params.enableProjectedZone, params.enableReservations]);


  const activeZones = zones.filter(zone => !zone.isProjected || params.enableProjectedZone);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <SidebarProvider defaultOpen={true}>
        <div className="flex flex-1 overflow-hidden">
          <Sidebar collapsible="icon" className="border-r bg-card">
            <SidebarHeader className="p-2 flex justify-between items-center">
              <h2 className="font-semibold text-lg font-headline p-2">Controles y Estadísticas</h2>
               <div className="md:hidden">
                {mounted && <SidebarTrigger><PanelLeft /></SidebarTrigger>}
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
                onRunChiSquareTest={handleRunChiSquareTest}
                currentLcgSeed={getRandomLcgSeed()}
              />
              <StatisticsDisplay stats={stats} />
              {chiSquareResults && <ChiSquareResultsDisplay results={chiSquareResults} />}
              <EventLog events={eventLog} />
            </SidebarContent>
            <SidebarFooter className="p-2">
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 lg:p-8">
              <h2 className="text-2xl font-headline mb-6 text-center">Estado del Estacionamiento</h2>
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
