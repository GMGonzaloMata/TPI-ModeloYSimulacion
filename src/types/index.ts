
export type ParkingSpaceStatus = 'free' | 'occupied' | 'reserved';

export interface ParkingSpaceData {
  id: string;
  status: ParkingSpaceStatus;
  vehicleId?: string;
  departureTime?: number; // Simulation clock time for departure
}

export interface ParkingZoneData {
  id: string;
  name: string;
  spaces: ParkingSpaceData[];
  capacity: number;
  isProjected?: boolean;
}

export type PrngMethodType = 'Math.random' | 'LCG';

export interface SimulationParams {
  morningArrivalMean: number;
  peakArrivalMean: number;
  afternoonArrivalMean: number;
  parkingDurationMean: number; // in minutes
  parkingDurationStdDev: number; // in minutes
  enableReservations: boolean;
  enableProjectedZone: boolean;
  simulationSpeed: number; // multiplier for simulation tick speed
  prngMethod: PrngMethodType;
  lcgSeed: number;
  chiSquareSampleSize: number;
  chiSquareNumBins: number;
}

export interface SimulationStats {
  totalArrivals: number;
  totalDepartures: number;
  totalRejections: number;
  currentOccupancyInternal: number;
  currentOccupancyExternal: number;
  currentOccupancyProjected: number;
  occupancyRateInternal: number;
  occupancyRateExternal: number;
  occupancyRateProjected: number;
  overallOccupancyRate: number;
  rejectionRate: number;
  avgParkingTime: number; // in minutes
  simulationClock: number; // in minutes since start of day (e.g. 0 = 00:00)
}

export interface EventLogEntry {
  id: string;
  timestamp: string; // Formatted time
  message: string;
}

export interface ChiSquareResult {
  statistic: number;
  degreesOfFreedom: number;
  N: number;
  K: number;
  prngMethodUsed: PrngMethodType;
  lcgSeedUsed?: number;
  interpretation: string;
  observedFrequencies?: number[];
  expectedFrequencies?: number[];
}
