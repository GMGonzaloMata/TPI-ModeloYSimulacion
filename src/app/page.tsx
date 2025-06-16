
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/simulation/Header';
import Footer from '@/components/simulation/Footer';
import ParkingZone from '@/components/simulation/ParkingZone';
import SimulationControls from '@/components/simulation/SimulationControls';
import StatisticsDisplay from '@/components/simulation/StatisticsDisplay';
import EventLog from '@/components/simulation/EventLog';
import ChiSquareResultsDisplay from '@/components/simulation/ChiSquareResultsDisplay';
import OccupancyPieChart from '@/components/simulation/charts/OccupancyPieChart';
import ParkingDurationHistogram from '@/components/simulation/charts/ParkingDurationHistogram';
import ArrivalsRejectionsLineChart from '@/components/simulation/charts/ArrivalsRejectionsLineChart';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { ParkingZoneData, ParkingSpaceData, SimulationParams, SimulationStats, EventLogEntry, ChiSquareResult } from '@/types';
import { exponential, normal, setPrng, getPrngInitializationSeed, McgConfig, getActiveGenerator } from '@/lib/random';
import { performChiSquareTest } from '@/lib/chiSquare';
import { ArrowRight, BarChartBig, MonitorPlay, Pause, Play, RefreshCcw, RotateCcw, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';


const MAX_EVENTS = 100;
const MORNING_PEAK_START_MINUTE = 7.5 * 60; // 7:30 AM
const MORNING_PEAK_END_MINUTE = 9 * 60;   // 9:00 AM
const EVENING_PEAK_START_MINUTE = 17 * 60; // 5:00 PM
const EVENING_PEAK_END_MINUTE = 18 * 60;   // 6:00 PM

const PROB_EXTERNAL_WHEN_BOTH_PRIMARY_ZONES_AVAILABLE = 0.20;
const PROB_EXTERNAL_WHEN_ONE_PRIMARY_ZONE_AVAILABLE = 0.10;


const createSpaces = (idPrefix: string, count: number): ParkingSpaceData[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${idPrefix}-${i + 1}`,
    status: 'free',
  }));
};

const initialZones: ParkingZoneData[] = [
  { id: 'internal', name: 'Zona Interna (Administrativo)', capacity: 10, spaces: createSpaces('I', 10) },
  { id: 'external', name: 'Zona Externa', capacity: 72, spaces: createSpaces('E', 72) },
  { id: 'projected', name: 'Zona Proyectada (Expansión)', capacity: 69, spaces: createSpaces('P', 69), isProjected: true },
];

const initialParams: SimulationParams = {
  morningArrivalMean: 1.8,
  peakArrivalMean: 1.0, // Morning peak
  afternoonArrivalMean: 3.5, // Between morning and evening peak
  eveningPeakArrivalMean: 1.2, // Evening peak (17-18h)
  lateAfternoonArrivalMean: 4.0, // After evening peak
  parkingDurationMean: 5 * 60,
  parkingDurationStdDev: 1 * 60,
  enableReservations: false,
  enableProjectedZone: false,
  simulationSpeed: 10,
  prngMethod: 'Math.random',
  prngSeed: 1,
  mcg_a: 1664525,
  mcg_c: 1013904223,
  mcg_m: 2**32,
  mcg_seed: 1,
  chiSquareSampleSize: 1000,
  chiSquareNumBins: 10,
  simulationStartTime: 6 * 60,
  simulationEndTime: 22 * 60,
};

const getInitialStats = (paramsForInit: SimulationParams): SimulationStats => {
  const timelineData: Array<{ timeLabel: string; arrivals: number; rejections: number }> = [];
  const startHour = Math.floor(paramsForInit.simulationStartTime / 60);
  const endHour = Math.floor(paramsForInit.simulationEndTime / 60);

  for (let hour = startHour; hour < endHour; hour++) {
    timelineData.push({
      timeLabel: `${String(hour).padStart(2, '0')}:00-${String(hour + 1).padStart(2, '0')}:00`,
      arrivals: 0,
      rejections: 0,
    });
  }

  return {
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
    simulationClock: paramsForInit.simulationStartTime,
    parkingDurations: [],
    arrivalsRejectionsTimelineData: timelineData,
  };
};

let eventIdCounter = 0;

export default function ParkSimPage() {
  const [zones, setZones] = useState<ParkingZoneData[]>(JSON.parse(JSON.stringify(initialZones)));
  const [params, setParams] = useState<SimulationParams>(initialParams);
  const [stats, setStats] = useState<SimulationStats>(getInitialStats(initialParams));
  const [isRunning, setIsRunning] = useState(false);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [chiSquareResults, setChiSquareResults] = useState<ChiSquareResult | null>(null);
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);

  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedParkingTimeRef = useRef(0);
  const departedVehiclesCountRef = useRef(0);
  const nextArrivalDueRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    setPrng('Math.random');
    setStats(getInitialStats(params));
  }, []);

   useEffect(() => {
    if (mounted && !isRunning && currentStep === 1) { 
        const seed = params.prngMethod === 'MixedCongruential' ? params.mcg_seed : params.prngSeed;
        const mcgConfig = params.prngMethod === 'MixedCongruential' ? { a: params.mcg_a, c: params.mcg_c, m: params.mcg_m } : undefined;
        setPrng(params.prngMethod, seed, mcgConfig);
        setStats(getInitialStats(params));
        setEventLog([]);
        accumulatedParkingTimeRef.current = 0;
        departedVehiclesCountRef.current = 0;
        nextArrivalDueRef.current = 0;
        eventIdCounter = 0;
        setZones(JSON.parse(JSON.stringify(initialZones)));
    }
  }, [params.simulationStartTime, params.simulationEndTime, params.prngMethod, params.prngSeed, params.mcg_a, params.mcg_c, params.mcg_m, params.mcg_seed, isRunning, currentStep, mounted]);


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


  const updateStatistics = useCallback((
    currentSimClock: number,
    currentZones: ParkingZoneData[],
    currentParams: SimulationParams,
    previousTotalArrivals: number,
    previousTotalRejections: number,
    tickDepartedDurations: number[],
    tickArrivalEvents: Array<{ type: 'arrival' | 'rejection'; timeMinute: number }>
  ) => {
    setStats(prevStats => {
      let totalCapacity = 0;
      let totalOccupied = 0;

      const updatedOccupancy = {
        internal: 0,
        external: 0,
        projected: currentParams.enableProjectedZone ? 0 : -1,
      };

      currentZones.forEach(zone => {
        if (zone.isProjected && !currentParams.enableProjectedZone) return;

        const occupiedInZone = zone.spaces.filter(s => s.status === 'occupied' || (s.status === 'reserved' && currentParams.enableReservations)).length;
        totalCapacity += zone.capacity;
        totalOccupied += occupiedInZone;

        if (zone.id === 'internal') updatedOccupancy.internal = occupiedInZone;
        else if (zone.id === 'external') updatedOccupancy.external = occupiedInZone;
        else if (zone.id === 'projected' && currentParams.enableProjectedZone) updatedOccupancy.projected = occupiedInZone;
      });

      const internalZoneData = currentZones.find(z => z.id === 'internal');
      const externalZoneData = currentZones.find(z => z.id === 'external');
      const projectedZoneData = currentZones.find(z => z.id === 'projected');

      const newParkingDurations = [...prevStats.parkingDurations, ...tickDepartedDurations];
      const newTimelineData = [...prevStats.arrivalsRejectionsTimelineData];

      const arrivalsThisTick = tickArrivalEvents.filter(e => e.type === 'arrival').length;
      const rejectionsThisTick = tickArrivalEvents.filter(e => e.type === 'rejection').length;

      tickArrivalEvents.forEach(event => {
        const hour = Math.floor(event.timeMinute / 60);
        const startHourOfSimulation = Math.floor(currentParams.simulationStartTime / 60);
        const entryIndex = hour - startHourOfSimulation;

        if (entryIndex >= 0 && entryIndex < newTimelineData.length) {
          const updatedEntry = { ...newTimelineData[entryIndex] };
          if (event.type === 'arrival') updatedEntry.arrivals++;
          else updatedEntry.rejections++;
          newTimelineData[entryIndex] = updatedEntry;
        }
      });
      
      const nextTotalArrivals = previousTotalArrivals + arrivalsThisTick;
      const nextTotalDepartures = prevStats.totalDepartures + tickDepartedDurations.length;
      const nextTotalRejections = previousTotalRejections + rejectionsThisTick;

      return {
        ...prevStats,
        simulationClock: currentSimClock,
        currentOccupancyInternal: updatedOccupancy.internal,
        currentOccupancyExternal: updatedOccupancy.external,
        currentOccupancyProjected: updatedOccupancy.projected,
        occupancyRateInternal: internalZoneData && internalZoneData.capacity > 0 ? (updatedOccupancy.internal / internalZoneData.capacity) * 100 : 0,
        occupancyRateExternal: externalZoneData && externalZoneData.capacity > 0 ? (updatedOccupancy.external / externalZoneData.capacity) * 100 : 0,
        occupancyRateProjected: currentParams.enableProjectedZone && projectedZoneData && projectedZoneData.capacity > 0 ? (updatedOccupancy.projected / projectedZoneData.capacity) * 100 : 0,
        overallOccupancyRate: totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0,
        totalArrivals: nextTotalArrivals,
        totalDepartures: nextTotalDepartures,
        totalRejections: nextTotalRejections,
        rejectionRate: nextTotalArrivals > 0 ? (nextTotalRejections / nextTotalArrivals) * 100 : 0,
        avgParkingTime: departedVehiclesCountRef.current > 0 ? accumulatedParkingTimeRef.current / departedVehiclesCountRef.current : 0,
        parkingDurations: newParkingDurations,
        arrivalsRejectionsTimelineData: newTimelineData,
      };
    });
  }, []); 


  const simulationTick = useCallback(() => {
    const currentSimClock = stats.simulationClock + 1;
    const prng = getActiveGenerator();

    if (currentSimClock > params.simulationEndTime) { 
      setIsRunning(false);
      addEvent("Simulación finalizada por alcanzar hora de cierre.");
      toast({ title: "Simulación Finalizada", description: "Se alcanzó la hora de cierre configurada." });
      setCurrentStep(3);
      return;
    }

    const tickDepartedDurations: number[] = [];
    const tickArrivalEvents: Array<{ type: 'arrival' | 'rejection'; timeMinute: number }> = [];
    
    let tempZones = JSON.parse(JSON.stringify(zones)); 

    tempZones = tempZones.map((zone: ParkingZoneData) => ({
      ...zone,
      spaces: zone.spaces.map((space: ParkingSpaceData) => {
        const newSpace = {...space};
        if ((newSpace.status === 'occupied' || (newSpace.status === 'reserved' && params.enableReservations)) && newSpace.departureTime !== undefined && newSpace.departureTime <= stats.simulationClock) { 
          const durationParked = newSpace.assignedDuration || params.parkingDurationMean;
          accumulatedParkingTimeRef.current += durationParked;
          departedVehiclesCountRef.current +=1;
          tickDepartedDurations.push(durationParked);
          addEvent(`Vehículo ${newSpace.vehicleId || 'N/A'} salió de ${zone.name} espacio ${newSpace.id}. Estac. por ~${durationParked.toFixed(0)} min.`);
          newSpace.status = 'free';
          delete newSpace.vehicleId;
          delete newSpace.departureTime;
          delete newSpace.assignedDuration;
        }
        return newSpace;
      })
    }));

    if (nextArrivalDueRef.current <= 0) {
      let allocated = false;
      const vehicleId = `V-${stats.totalArrivals - stats.totalRejections + 1}`;
      const internalZone = tempZones.find((z: ParkingZoneData) => z.id === 'internal');
      const externalZone = tempZones.find((z: ParkingZoneData) => z.id === 'external');
      const projectedZone = params.enableProjectedZone ? tempZones.find((z: ParkingZoneData) => z.id === 'projected') : undefined;

      const internalFreeSpaces = internalZone ? internalZone.spaces.filter((s: ParkingSpaceData) => s.status === 'free').length : 0;
      const externalFreeSpaces = externalZone ? externalZone.spaces.filter((s: ParkingSpaceData) => s.status === 'free').length : 0;
      const projectedFreeSpaces = projectedZone ? projectedZone.spaces.filter((s: ParkingSpaceData) => s.status === 'free').length : 0;

      const tryAllocate = (zone: ParkingZoneData | undefined, zoneName: string) => {
        if (zone) {
          const freeSpace = zone.spaces.find((s: ParkingSpaceData) => s.status === 'free');
          if (freeSpace) {
            freeSpace.status = 'occupied';
            freeSpace.vehicleId = vehicleId;
            const duration = Math.max(1, Math.round(normal(params.parkingDurationMean, params.parkingDurationStdDev)));
            freeSpace.assignedDuration = duration;
            freeSpace.departureTime = currentSimClock + duration;
            addEvent(`Vehículo ${vehicleId} llegó y estacionó en ${zoneName} espacio ${freeSpace.id}. Duración: ${duration} min.`);
            allocated = true;
            return true;
          }
        }
        return false;
      };

      if (params.enableProjectedZone) { // Logic when Expansion Zone IS enabled
        const internalHasSpace = internalFreeSpaces > 0;
        const projectedHasSpace = projectedFreeSpaces > 0;

        let assignedToExternalSporadically = false;
        if (internalHasSpace && projectedHasSpace && externalFreeSpaces > 0 && prng() < PROB_EXTERNAL_WHEN_BOTH_PRIMARY_ZONES_AVAILABLE) {
            if(tryAllocate(externalZone, externalZone!.name)) assignedToExternalSporadically = true;
        } else if ((internalHasSpace || projectedHasSpace) && !(internalHasSpace && projectedHasSpace) && externalFreeSpaces > 0 && prng() < PROB_EXTERNAL_WHEN_ONE_PRIMARY_ZONE_AVAILABLE) {
            if(tryAllocate(externalZone, externalZone!.name)) assignedToExternalSporadically = true;
        }

        if (!allocated && !assignedToExternalSporadically) {
            if (internalHasSpace && projectedHasSpace) {
                const internalFreePercent = internalZone!.capacity > 0 ? (internalFreeSpaces / internalZone!.capacity) * 100 : 0;
                const projectedFreePercent = projectedZone!.capacity > 0 ? (projectedFreeSpaces / projectedZone!.capacity) * 100 : 0;
                if (projectedFreePercent >= internalFreePercent) {
                    if (!tryAllocate(projectedZone, projectedZone!.name) && internalHasSpace) tryAllocate(internalZone, internalZone!.name);
                } else {
                    if (!tryAllocate(internalZone, internalZone!.name) && projectedHasSpace) tryAllocate(projectedZone, projectedZone!.name);
                }
            } else if (projectedHasSpace) {
                tryAllocate(projectedZone, projectedZone!.name);
            } else if (internalHasSpace) {
                tryAllocate(internalZone, internalZone!.name);
            }
        }
         if (!allocated && !assignedToExternalSporadically) { // Try external as last resort if not already tried sporadically
            tryAllocate(externalZone, externalZone!.name);
        }

      } else { // Logic when Expansion Zone IS NOT enabled
        const internalHasSpace = internalFreeSpaces > 0;
        const externalHasSpace = externalFreeSpaces > 0;

        if (internalHasSpace && externalHasSpace) {
            const internalFreePercent = internalZone!.capacity > 0 ? (internalFreeSpaces / internalZone!.capacity) * 100 : 0;
            const externalFreePercent = externalZone!.capacity > 0 ? (externalFreeSpaces / externalZone!.capacity) * 100 : 0;
            if (externalFreePercent >= internalFreePercent) {
                if(!tryAllocate(externalZone, externalZone!.name) && internalHasSpace) tryAllocate(internalZone, internalZone!.name);
            } else {
                if(!tryAllocate(internalZone, internalZone!.name) && externalHasSpace) tryAllocate(externalZone, externalZone!.name);
            }
        } else if (internalHasSpace) {
            tryAllocate(internalZone, internalZone!.name);
        } else if (externalHasSpace) {
            tryAllocate(externalZone, externalZone!.name);
        }
      }

      tickArrivalEvents.push({ type: allocated ? 'arrival' : 'rejection', timeMinute: currentSimClock });
      if (!allocated) {
        addEvent(`Vehículo (ID Rechazo Potencial ${stats.totalRejections + 1}) rechazado. Sin espacio.`);
      }

      let meanArrival;
      if (currentSimClock >= MORNING_PEAK_START_MINUTE && currentSimClock < MORNING_PEAK_END_MINUTE) {
        meanArrival = params.peakArrivalMean;
      } else if (currentSimClock >= EVENING_PEAK_START_MINUTE && currentSimClock < EVENING_PEAK_END_MINUTE) {
        meanArrival = params.eveningPeakArrivalMean;
      } else if (currentSimClock < MORNING_PEAK_START_MINUTE) {
        meanArrival = params.morningArrivalMean;
      } else if (currentSimClock >= MORNING_PEAK_END_MINUTE && currentSimClock < EVENING_PEAK_START_MINUTE) {
        meanArrival = params.afternoonArrivalMean;
      } else { // After evening peak
        meanArrival = params.lateAfternoonArrivalMean;
      }
      nextArrivalDueRef.current = Math.max(1, Math.round(exponential(meanArrival)));
    } else {
       nextArrivalDueRef.current -=1;
    }
    
    setZones(tempZones);
    updateStatistics(currentSimClock, tempZones, params, stats.totalArrivals, stats.totalRejections, tickDepartedDurations, tickArrivalEvents);

  }, [addEvent, params, stats.simulationClock, stats.totalArrivals, stats.totalRejections, updateStatistics, toast, zones]);


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
      const isPrngRelated = ['prngMethod', 'prngSeed', 'mcg_a', 'mcg_c', 'mcg_m', 'mcg_seed'].includes(key as string);
      
      if (isPrngRelated) {
        const seed = newParams.prngMethod === 'MixedCongruential' ? newParams.mcg_seed : newParams.prngSeed;
        const mcgConfig = newParams.prngMethod === 'MixedCongruential' ? { a: newParams.mcg_a, c: newParams.mcg_c, m: newParams.mcg_m } : undefined;
        setPrng(newParams.prngMethod, seed, mcgConfig);
        setChiSquareResults(null);
      }
      
      const shouldResetFullStats = (key === 'simulationStartTime' || key === 'simulationEndTime' || isPrngRelated);
      if (shouldResetFullStats && !isRunning && currentStep === 1) {
         setStats(getInitialStats(newParams));
         setEventLog([]);
         setZones(JSON.parse(JSON.stringify(initialZones)));
         accumulatedParkingTimeRef.current = 0;
         departedVehiclesCountRef.current = 0;
         nextArrivalDueRef.current = 0;
         eventIdCounter = 0;
      } else if (!isRunning && currentStep === 1 && (key === 'enableProjectedZone' || key === 'enableReservations')) {
        updateStatistics(stats.simulationClock, zones, newParams, stats.totalArrivals, stats.totalRejections, [], []);
      }
      return newParams;
    });
  };

  const handleActualStart = () => {
    if (params.simulationStartTime >= params.simulationEndTime) {
        toast({ title: "Error de Configuración", description: "La hora de inicio debe ser anterior a la hora de fin.", variant: "destructive"});
        setIsRunning(false);
        return;
    }

    const seed = params.prngMethod === 'MixedCongruential' ? params.mcg_seed : params.prngSeed;
    const mcgConfig = params.prngMethod === 'MixedCongruential' ? { a: params.mcg_a, c: params.mcg_c, m: params.mcg_m } : undefined;
    setPrng(params.prngMethod, seed, mcgConfig);

    let clockToUse = stats.simulationClock;
    if (stats.simulationClock < params.simulationStartTime) {
      clockToUse = params.simulationStartTime;
      setStats(prev => ({...prev, simulationClock: params.simulationStartTime}));
      addEvent(`Reloj ajustado al inicio de la simulación: ${formatTime(params.simulationStartTime)}.`);
    }
    
    if (clockToUse >= params.simulationEndTime) {
      addEvent("La simulación ya ha alcanzado la hora de finalización. Reinicie para comenzar de nuevo.");
      toast({ title: "Simulación Finalizada", description: "Reinicie para comenzar de nuevo.", variant: "default" });
      setIsRunning(false);
      setCurrentStep(3);
      return;
    }

    setIsRunning(true);
    addEvent("Simulación iniciada/continuada.");

    if(nextArrivalDueRef.current <=0 ) {
        let meanArrival;
      if (clockToUse >= MORNING_PEAK_START_MINUTE && clockToUse < MORNING_PEAK_END_MINUTE) {
        meanArrival = params.peakArrivalMean;
      } else if (clockToUse >= EVENING_PEAK_START_MINUTE && clockToUse < EVENING_PEAK_END_MINUTE) {
        meanArrival = params.eveningPeakArrivalMean;
      } else if (clockToUse < MORNING_PEAK_START_MINUTE) { // Before morning peak
        meanArrival = params.morningArrivalMean;
      } else if (clockToUse >= MORNING_PEAK_END_MINUTE && clockToUse < EVENING_PEAK_START_MINUTE) { // Between morning and evening peaks
        meanArrival = params.afternoonArrivalMean;
      } else { // After evening peak
        meanArrival = params.lateAfternoonArrivalMean;
      }
      nextArrivalDueRef.current = Math.max(1, Math.round(exponential(meanArrival)));
    }
  };

  const handleStartSimulationAndGoToStep2 = () => {
    if (params.simulationStartTime >= params.simulationEndTime) {
        toast({ title: "Error al Iniciar", description: "La hora de inicio debe ser anterior a la hora de fin.", variant: "destructive"});
        return;
    }
    setStats(getInitialStats(params)); 
    setEventLog([]);
    setZones(JSON.parse(JSON.stringify(initialZones)));
    accumulatedParkingTimeRef.current = 0;
    departedVehiclesCountRef.current = 0;
    nextArrivalDueRef.current = 0;
    eventIdCounter = 0;
    setChiSquareResults(null); 

    handleActualStart(); 

    if (isRunning && stats.simulationClock < params.simulationEndTime) { 
      setCurrentStep(2);
    } else if (!isRunning && params.simulationStartTime < params.simulationEndTime) {
    } else if (stats.simulationClock >= params.simulationEndTime){
       setCurrentStep(3);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
    addEvent("Simulación pausada.");
  };

  const handleFullReset = () => {
    setIsRunning(false);
    setParams(initialParams);
    
    const seed = initialParams.prngMethod === 'MixedCongruential' ? initialParams.mcg_seed : initialParams.prngSeed;
    const mcgConfig = initialParams.prngMethod === 'MixedCongruential' ? { a: initialParams.mcg_a, c: initialParams.mcg_c, m: initialParams.mcg_m } : undefined;
    setPrng(initialParams.prngMethod, seed, mcgConfig);

    setStats(getInitialStats(initialParams));
    setEventLog([]);
    setZones(JSON.parse(JSON.stringify(initialZones)));
    setChiSquareResults(null);
    
    accumulatedParkingTimeRef.current = 0;
    departedVehiclesCountRef.current = 0;
    nextArrivalDueRef.current = 0;
    eventIdCounter = 0;
    
    addEvent("Simulación reiniciada a valores por defecto.");
    toast({ title: "Simulación Reiniciada", description: "Todos los parámetros y estados han sido restaurados." });
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
    const seedForTest = params.prngMethod === 'MixedCongruential' ? params.mcg_seed : params.prngSeed;
    const mcgConfigForTest = params.prngMethod === 'MixedCongruential' ? { a: params.mcg_a, c: params.mcg_c, m: params.mcg_m } : undefined;

    const results = await performChiSquareTest(
      params.chiSquareSampleSize,
      params.chiSquareNumBins,
      params.prngMethod,
      (params.prngMethod !== 'Math.random') ? seedForTest : undefined,
      mcgConfigForTest
    );
    setChiSquareResults(results);
    toast({ title: "Prueba Chi-cuadrado Completada", description: `Método: ${params.prngMethod}, N=${params.chiSquareSampleSize}, K=${params.chiSquareNumBins}` });
    addEvent(`Prueba Chi-cuadrado ejecutada para ${params.prngMethod}. N=${params.chiSquareSampleSize}, K=${params.chiSquareNumBins}. Estadístico: ${results.statistic.toFixed(3)}.`);
  };

  const goToStep = (step: number) => {
    if (step === 1 && currentStep !== 1) {
      if(isRunning) handlePause();
    }
    if (currentStep === 2 && step === 3) { 
      if (isRunning) { 
        handlePause();
      }
    }
    setCurrentStep(step);
  };
  
  useEffect(() => {
     if (!isRunning && currentStep === 1 && mounted) {
        updateStatistics(stats.simulationClock, zones, params, stats.totalArrivals, stats.totalRejections, [], []);
     }
  }, [params.enableProjectedZone, params.enableReservations, zones, isRunning, currentStep, mounted, params, stats.simulationClock, stats.totalArrivals, stats.totalRejections, updateStatistics]);


  const activeZonesForDisplay = zones.filter(zone => zone.id === 'internal' || zone.id === 'external' || (zone.isProjected && params.enableProjectedZone));

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
            <div className="flex flex-col items-center gap-6 px-4">
              <div className="w-full max-w-2xl">
                <SimulationControls
                  params={params}
                  onParamChange={handleParamChange}
                  onRunChiSquareTest={handleRunChiSquareTest}
                />
              </div>
              {chiSquareResults && (
                <div className="w-full max-w-2xl">
                  <ChiSquareResultsDisplay results={chiSquareResults} />
                </div>
              )}
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
                  {activeZonesForDisplay.map((zone) => (
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="space-y-6">
                    <StatisticsDisplay stats={stats} />
                    {chiSquareResults && ( 
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl font-semibold">Resultados Prueba Chi-cuadrado</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ChiSquareResultsDisplay results={chiSquareResults} />
                            </CardContent>
                        </Card>
                    )}
                </div>
                <div className="space-y-6">
                    <OccupancyPieChart stats={stats} zonesData={zones} projectedZoneEnabled={params.enableProjectedZone} />
                    <ParkingDurationHistogram durations={stats.parkingDurations} />
                    <ArrivalsRejectionsLineChart data={stats.arrivalsRejectionsTimelineData} />
                </div>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Button onClick={handleResetAndGoToConfig} size="lg" className="w-full sm:w-auto">
                Nueva Simulación <RefreshCcw className="ml-2 h-5 w-5" />
              </Button>
              <Button onClick={() => goToStep(2)} size="lg" variant="outline" className="w-full sm:w-auto" disabled={stats.simulationClock >= params.simulationEndTime}>
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

