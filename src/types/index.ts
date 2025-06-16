
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

export type PrngMethodType = 'Math.random' | 'LCG' | 'Mersenne-Twister' | 'MixedCongruential';

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
  mcg_a: number;
  mcg_c: number;
  mcg_m: number;
  mcg_seed: number;
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

  // For collecting data for charts
  parkingDurations: number[]; // Stores all individual parking durations of departed vehicles
  arrivalsRejectionsTimelineData: Array<{ timeLabel: string; arrivals: number; rejections: number }>; // Hourly arrival/rejection counts
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
  mcgParamsUsed?: { a: number, c: number, m: number };
  interpretation: string;
  observedFrequencies?: number[];
  expectedFrequencies?: number[];
}
