
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/simulation/Header';
import Footer from '@/components/simulation/Footer';
import ParkingZone from '@/components/simulation/ParkingZone';
import SimulationControls from '@/components/simulation/SimulationControls';
import StatisticsDisplay from '@/components/simulation/StatisticsDisplay';
import EventLog from '@/components/simulation/EventLog';
import ChiSquareResultsDisplay from '@/components/simulation/ChiSquareResultsDisplay';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { ParkingZoneData, ParkingSpaceData, SimulationParams, SimulationStats, EventLogEntry, ChiSquareResult } from '@/types';
import { exponential, normal, setPrng, getPrngInitializationSeed } from '@/lib/random';
import { performChiSquareTest } from '@/lib/chiSquare';
import { ArrowRight, BarChartBig, MonitorPlay, Pause, Play, RefreshCcw, RotateCcw, Settings2 } from 'lucide-react';

const MAX_EVENTS = 100;
const PEAK_START_MINUTE = 7.5 * 60; 
const PEAK_END_MINUTE = 9 * 60; 

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
  prngSeed: 1, 
  chiSquareSampleSize: 1000,
  chiSquareNumBins: 10,
  simulationStartTime: 6 * 60, 
  simulationEndTime: 22 * 60, 
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
  const [currentStep, setCurrentStep] = useState<number>(1); // 1: Config, 2: Sim, 3: Results

  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedParkingTimeRef = useRef(0);
  const departedVehiclesCountRef = useRef(0);
  const nextArrivalDueRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    // Initialize PRNG when component mounts, using a deterministic placeholder if no seed is set
    // This ensures server and client have a consistent starting point if random numbers are needed before user interaction.
    setPrng(initialParams.prngMethod, initialParams.prngSeed);
    setStats(getInitialStats(params.simulationStartTime)); 
  }, []); 

   useEffect(() => {
    setStats(currentStats => ({
        ...currentStats,
        simulationClock: params.simulationStartTime,
    }));
    // Reset simulation state only if not running and currently in config step (step 1)
    // This prevents resetting if params are changed while viewing results (step 3)
    if (!isRunning && currentStep === 1) { 
        setEventLog([]);
        accumulatedParkingTimeRef.current = 0;
        departedVehiclesCountRef.current = 0;
        nextArrivalDueRef.current = 0; // Reset next arrival due time
        eventIdCounter = 0;
        setZones(JSON.parse(JSON.stringify(initialZones))); // Reset zones to initial state
        updateStatistics(); // Update stats based on reset state
    }
  }, [params.simulationStartTime, params.simulationEndTime, params.prngMethod, params.prngSeed]);


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
      setCurrentStep(3); // Automatically go to results step
      return;
    }

    setStats(prevStats => ({ ...prevStats, simulationClock: prevStats.simulationClock + 1 }));

    setZones(currentZones => {
      const newZones = JSON.parse(JSON.stringify(currentZones)) as ParkingZoneData[];
      let vehicleDepartedThisTick = false;
      let vehicleArrivedThisTick = false;

      // Vehicle departures
      newZones.forEach(zone => {
        zone.spaces.forEach(space => {
          if ((space.status === 'occupied' || (space.status === 'reserved' && params.enableReservations)) && space.departureTime !== undefined && space.departureTime <= stats.simulationClock) {
            const durationParked = space.assignedDuration || params.parkingDurationMean; // Fallback if assignedDuration is somehow undefined
            accumulatedParkingTimeRef.current += durationParked;
            departedVehiclesCountRef.current +=1;
            
            addEvent(`Vehículo ${space.vehicleId || 'N/A'} salió de ${zone.name} espacio ${space.id}. Estac. por ~${durationParked.toFixed(0)} min.`);
            space.status = 'free';
            delete space.vehicleId;
            delete space.departureTime;
            delete space.assignedDuration; // Clear assigned duration on departure
            vehicleDepartedThisTick = true;
            setStats(prev => ({...prev, totalDepartures: prev.totalDepartures + 1}));
          }
        });
      });

      // Vehicle arrivals
      if (nextArrivalDueRef.current <= 0) {
        setStats(prev => ({...prev, totalArrivals: prev.totalArrivals + 1}));
        let allocated = false;
        const vehicleId = `V-${stats.totalArrivals + 1 - stats.totalRejections}`; // Ensures unique ID even with rejections
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
              freeSpace.assignedDuration = duration; // Store the actual duration
              freeSpace.departureTime = stats.simulationClock + duration;
              addEvent(`Vehículo ${vehicleId} llegó y estacionó en ${zone.name} espacio ${freeSpace.id}. Duración: ${duration} min.`);
              allocated = true;
              vehicleArrivedThisTick = true;
              break; // Vehicle allocated, stop searching zones
            }
          }
        }

        if (!allocated) {
          setStats(prev => ({...prev, totalRejections: prev.totalRejections + 1}));
          addEvent(`Vehículo (ID Rechazo ${stats.totalRejections +1}) rechazado. Sin espacio disponible.`);
          vehicleArrivedThisTick = true; // Still counts as an arrival attempt for event log clarity
        }
        
        // Schedule next arrival
        let meanArrival;
        if (stats.simulationClock >= PEAK_START_MINUTE && stats.simulationClock < PEAK_END_MINUTE) {
          meanArrival = params.peakArrivalMean;
        } else if (stats.simulationClock < PEAK_START_MINUTE || stats.simulationClock >= params.simulationEndTime) {
          // Use morning arrival mean if before peak or after simulation end (though latter shouldn't trigger new arrivals)
          meanArrival = params.morningArrivalMean; 
          // If after peak but before simulation end, use afternoon mean
          if (stats.simulationClock >= PEAK_END_MINUTE && stats.simulationClock < params.simulationEndTime) { 
            meanArrival = params.afternoonArrivalMean;
          }
        } else { // This covers after peak and before end time, which is afternoon
            meanArrival = params.afternoonArrivalMean;
        }
        nextArrivalDueRef.current = Math.max(1, Math.round(exponential(meanArrival)));

      } else {
         nextArrivalDueRef.current -=1;
      }

      // Update statistics if any relevant event occurred
      if (vehicleDepartedThisTick || vehicleArrivedThisTick) {
         updateStatistics();
      }
      return newZones;
    });
    
  }, [addEvent, params, stats.simulationClock, stats.totalArrivals, stats.totalRejections, updateStatistics, toast]);


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


  const handleParamChange = <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => {
    setParams(prev => {
      const newParams = { ...prev, [key]: value };
      if (key === 'prngMethod' || (key === 'prngSeed' && (newParams.prngMethod === 'LCG' || newParams.prngMethod === 'Mersenne-Twister'))) {
        setPrng(newParams.prngMethod, newParams.prngSeed);
        setChiSquareResults(null); // Invalidate Chi-Square results if PRNG/seed changes
      }
      // If simulation time range changes WHILE IN CONFIG STEP and NOT RUNNING, reset key simulation variables
      if ((key === 'simulationStartTime' || key === 'simulationEndTime') && !isRunning && currentStep === 1) {
         setStats(getInitialStats(newParams.simulationStartTime)); // Reset stats with new start time
         setEventLog([]);
         accumulatedParkingTimeRef.current = 0;
         departedVehiclesCountRef.current = 0;
         nextArrivalDueRef.current = 0; 
         eventIdCounter = 0;
         setZones(JSON.parse(JSON.stringify(initialZones)));
         updateStatistics();
      }
      return newParams;
    });
  };

  const handleActualStart = () => { 
    // Validate simulation times
    if (params.simulationStartTime >= params.simulationEndTime) {
        toast({ title: "Error de Configuración", description: "La hora de inicio debe ser anterior a la hora de fin.", variant: "destructive"});
        setIsRunning(false); // Ensure it's not set to running
        return;
    }
    // Check if simulation has already reached its end time
    if (stats.simulationClock >= params.simulationEndTime) {
      addEvent("La simulación ya ha alcanzado la hora de finalización. Reinicie para comenzar de nuevo.");
      toast({ title: "Simulación Finalizada", description: "Reinicie para comenzar de nuevo.", variant: "default" });
      setIsRunning(false);
      setCurrentStep(3); // Go to results if already ended
      return;
    }
    // If simulation clock is before start time, adjust it
    if (stats.simulationClock < params.simulationStartTime) {
      setStats(prev => ({...prev, simulationClock: params.simulationStartTime}));
      addEvent(`Reloj ajustado al inicio de la simulación: ${formatTime(params.simulationStartTime)}.`);
    }

    setIsRunning(true);
    addEvent("Simulación iniciada/continuada.");
    setPrng(params.prngMethod, params.prngSeed); // Re-seed PRNG on every start/resume for consistency if seed is used
    // Recalculate next arrival if it was 0 (e.g., on first start or after reset)
    if(nextArrivalDueRef.current <=0 ) { 
        let meanArrival;
        if (stats.simulationClock >= PEAK_START_MINUTE && stats.simulationClock < PEAK_END_MINUTE) {
          meanArrival = params.peakArrivalMean;
        } else if (stats.simulationClock < PEAK_START_MINUTE) { // Before peak
          meanArrival = params.morningArrivalMean;
        } else { // After peak (includes afternoon)
          meanArrival = params.afternoonArrivalMean;
        }
        nextArrivalDueRef.current = Math.max(1, Math.round(exponential(meanArrival)));
    }
  };

  const handleStartSimulationAndGoToStep2 = () => {
    if (params.simulationStartTime >= params.simulationEndTime) {
        toast({ title: "Error al Iniciar", description: "La hora de inicio debe ser anterior a la hora de fin.", variant: "destructive"});
        return;
    }
    // Full reset of simulation state for a fresh start
    setStats(getInitialStats(params.simulationStartTime));
    setEventLog([]);
    setZones(JSON.parse(JSON.stringify(initialZones)));
    accumulatedParkingTimeRef.current = 0;
    departedVehiclesCountRef.current = 0;
    nextArrivalDueRef.current = 0;
    eventIdCounter = 0;
    
    handleActualStart(); // Attempt to start the simulation logic
    if (stats.simulationClock < params.simulationEndTime) { // Check again in case handleActualStart set isRunning to false
      setCurrentStep(2);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
    addEvent("Simulación pausada.");
  };

  const handleFullReset = () => { 
    setIsRunning(false);
    setParams(initialParams); // Reset parameters to their defaults
    setZones(JSON.parse(JSON.stringify(initialZones)));
    setStats(getInitialStats(initialParams.simulationStartTime)); // Reset stats to defaults
    setEventLog([]);
    setChiSquareResults(null);
    accumulatedParkingTimeRef.current = 0;
    departedVehiclesCountRef.current = 0;
    nextArrivalDueRef.current = 0;
    eventIdCounter = 0;
    setPrng(initialParams.prngMethod, initialParams.prngSeed); // Reset PRNG to defaults
    addEvent("Simulación reiniciada a valores por defecto.");
    toast({ title: "Simulación Reiniciada", description: "Todos los parámetros y estados han sido restaurados." });
    updateStatistics(); // Update display with reset stats
  };

  const handleResetAndGoToConfig = () => {
    handleFullReset();
    setCurrentStep(1);
  };
  
  const handleRunChiSquareTest = async () => {
    if (isRunning) {
      toast({ title: "Prueba Chi-cuadrado", description: "Detenga la simulación para ejecutar la prueba.", variant: "destructive" });
      return;
    }
    // Use the currently configured seed for the test if the PRNG method is seedable
    const seedForTest = (params.prngMethod !== 'Math.random') ? params.prngSeed : undefined;
    const results = await performChiSquareTest(
      params.chiSquareSampleSize,
      params.chiSquareNumBins,
      params.prngMethod,
      seedForTest 
    );
    setChiSquareResults(results);
    toast({ title: "Prueba Chi-cuadrado Completada", description: `Método: ${params.prngMethod}, N=${params.chiSquareSampleSize}, K=${params.chiSquareNumBins}` });
    addEvent(`Prueba Chi-cuadrado ejecutada para ${params.prngMethod}. N=${params.chiSquareSampleSize}, K=${params.chiSquareNumBins}. Estadístico: ${results.statistic.toFixed(3)}.`);
  };

  const goToStep = (step: number) => {
    if (step === 1 && currentStep !== 1) {
      // If moving to config from sim/results, pause if running. Full reset handled by dedicated button.
      if(isRunning) handlePause();
    }
    if (currentStep === 2 && step === 3) { // Moving from Sim to Results
      if (isRunning) {
        handlePause(); // Pause if running
      }
    }
    setCurrentStep(step);
  };

  // Effect to ensure statistics are updated whenever zones or relevant params change.
  useEffect(() => {
    updateStatistics();
  }, [zones, params.enableProjectedZone, params.enableReservations, updateStatistics]);


  const activeZones = zones.filter(zone => !zone.isProjected || params.enableProjectedZone);
  
  const formatTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  if (!mounted) {
    return <div className="flex justify-center items-center min-h-screen">Cargando Simulador...</div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        {currentStep === 1 && (
          <div>
            <h2 className="text-3xl font-headline mb-6 text-center">Paso 1: Configurar Simulación</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <SimulationControls
                params={params}
                onParamChange={handleParamChange}
                onRunChiSquareTest={handleRunChiSquareTest}
              />
              <div>
                {chiSquareResults && <ChiSquareResultsDisplay results={chiSquareResults} />}
              </div>
            </div>
            <div className="mt-8 flex flex-col items-center space-y-4">
              <Button onClick={handleStartSimulationAndGoToStep2} size="lg" className="w-full max-w-xs">
                Iniciar Simulación <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button onClick={handleFullReset} variant="outline" className="w-full max-w-xs">
                <RotateCcw className="mr-2 h-4 w-4" /> Restaurar Valores por Defecto
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-headline text-center">Paso 2: Simulación en Curso</h2>
                <div className="flex space-x-2">
                    <Button onClick={isRunning ? handlePause : handleActualStart} variant="outline" size="sm" disabled={stats.simulationClock >= params.simulationEndTime && !isRunning}>
                        {isRunning ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                        {isRunning ? 'Pausar' : (stats.simulationClock >= params.simulationEndTime ? 'Finalizada' : 'Continuar')}
                    </Button>
                     <Button onClick={() => goToStep(1)} variant="outline" size="sm">
                        <Settings2 className="mr-2 h-4 w-4" /> Volver a Configurar
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <h3 className="text-2xl font-headline mb-4 text-center">Estado del Estacionamiento</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
                  {activeZones.map((zone) => (
                    <ParkingZone key={zone.id} zone={zone} />
                  ))}
                </div>
              </div>
              <div className="lg:col-span-1 space-y-4">
                 <StatisticsDisplay stats={stats} />
                 <EventLog events={eventLog} />
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <Button onClick={() => goToStep(3)} size="lg" variant="default">
                Ver Resultados Finales <BarChartBig className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <h2 className="text-3xl font-headline mb-6 text-center">Paso 3: Resultados de la Simulación</h2>
            <div className="max-w-3xl mx-auto space-y-6">
                <StatisticsDisplay stats={stats} />
                {chiSquareResults && (
                    <div>
                        <h3 className="text-xl font-semibold mb-2 text-center">Resultados Prueba Chi-cuadrado (PRNG Usado)</h3>
                        <ChiSquareResultsDisplay results={chiSquareResults} />
                    </div>
                )}
            </div>
            <div className="mt-8 flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Button onClick={handleResetAndGoToConfig} size="lg" className="w-full sm:w-auto">
                Nueva Simulación <RefreshCcw className="ml-2 h-5 w-5" />
              </Button>
              <Button onClick={() => goToStep(2)} size="lg" variant="outline" className="w-full sm:w-auto">
                <MonitorPlay className="mr-2 h-5 w-5" /> Volver a la Simulación
              </Button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

