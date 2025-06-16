
export type ParkingSpaceStatus = 'free' | 'occupied' | 'reserved';

export interface ParkingSpaceData {
  id: string;
  status: ParkingSpaceStatus;
  vehicleId?: string;
  departureTime?: number; // Simulation clock time for departure
  assignedDuration?: number; // The specific duration assigned to this vehicle upon parking
}

export interface ParkingZoneData {
  id: string;
  name: string;
  spaces: ParkingSpaceData[];
  capacity: number;
  isProjected?: boolean;
}

export type PrngMethodType = 'Math.random' | 'LCG' | 'Mersenne-Twister'; // Removed 'ALEA'

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
  prngSeed: number; 
  chiSquareSampleSize: number;
  chiSquareNumBins: number;
  simulationStartTime: number; // in minutes from midnight
  simulationEndTime: number;   // in minutes from midnight
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
  prngSeedUsed?: number; 
  interpretation: string;
  observedFrequencies?: number[];
  expectedFrequencies?: number[];
}
