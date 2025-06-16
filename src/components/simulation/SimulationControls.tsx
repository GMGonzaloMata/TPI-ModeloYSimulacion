'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, RotateCcw, Settings2 } from 'lucide-react';
import type { SimulationParams } from '@/types';

interface SimulationControlsProps {
  params: SimulationParams;
  onParamChange: <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  isRunning: boolean;
}

const SimulationControls: React.FC<SimulationControlsProps> = ({
  params,
  onParamChange,
  onStart,
  onPause,
  onReset,
  isRunning,
}) => {
  const handleSliderChange = (key: keyof SimulationParams, value: number[]) => {
    onParamChange(key, value[0] as any);
  };

  const handleInputChange = (key: keyof SimulationParams, event: React.ChangeEvent<HTMLInputElement>) => {
    onParamChange(key, parseFloat(event.target.value) as any);
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-headline text-lg flex items-center"><Settings2 className="mr-2 h-5 w-5" />Controls</CardTitle>
        <div className="flex space-x-2">
          <Button onClick={isRunning ? onPause : onStart} variant="outline" size="icon" aria-label={isRunning ? "Pause simulation" : "Start simulation"}>
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button onClick={onReset} variant="outline" size="icon" aria-label="Reset simulation">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="simSpeed" className="text-sm font-medium">Simulation Speed (ticks/sec): {params.simulationSpeed}x</Label>
          <Slider
            id="simSpeed"
            min={1} max={100} step={1}
            value={[params.simulationSpeed]}
            onValueChange={(val) => handleSliderChange('simulationSpeed', val)}
            className="mt-1"
          />
        </div>

        <ControlGroup title="Arrival Times (mean, minutes)">
          <InputControl label="Morning" id="morningArrivalMean" value={params.morningArrivalMean} onChange={(e) => handleInputChange('morningArrivalMean', e)} min={0.1} step={0.1} />
          <InputControl label="Peak" id="peakArrivalMean" value={params.peakArrivalMean} onChange={(e) => handleInputChange('peakArrivalMean', e)} min={0.1} step={0.1} />
          <InputControl label="Afternoon" id="afternoonArrivalMean" value={params.afternoonArrivalMean} onChange={(e) => handleInputChange('afternoonArrivalMean', e)} min={0.1} step={0.1} />
        </ControlGroup>

        <ControlGroup title="Parking Duration (minutes)">
          <InputControl label="Mean" id="parkingDurationMean" value={params.parkingDurationMean} onChange={(e) => handleInputChange('parkingDurationMean', e)} min={1} />
          <InputControl label="Std. Dev." id="parkingDurationStdDev" value={params.parkingDurationStdDev} onChange={(e) => handleInputChange('parkingDurationStdDev', e)} min={0} />
        </ControlGroup>
        
        <div className="flex items-center space-x-2 pt-2">
          <Switch
            id="enableProjectedZone"
            checked={params.enableProjectedZone}
            onCheckedChange={(checked) => onParamChange('enableProjectedZone', checked)}
          />
          <Label htmlFor="enableProjectedZone" className="text-sm">Enable Projected Zone</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="enableReservations"
            checked={params.enableReservations}
            onCheckedChange={(checked) => onParamChange('enableReservations', checked)}
            disabled // Reservation logic not fully implemented
          />
          <Label htmlFor="enableReservations" className="text-sm">Enable Reservations (Conceptual)</Label>
        </div>

      </CardContent>
    </Card>
  );
};

const ControlGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h4 className="text-sm font-semibold mb-2 text-muted-foreground">{title}</h4>
    <div className="space-y-3 pl-2 border-l-2 border-border">
      {children}
    </div>
  </div>
);

const InputControl: React.FC<{label: string, id: string, value: number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, min?: number, step?: number}> = 
  ({label, id, value, onChange, min = 0, step=1}) => (
  <div className="grid grid-cols-3 items-center gap-2">
    <Label htmlFor={id} className="text-xs col-span-1">{label}</Label>
    <Input id={id} type="number" value={value} onChange={onChange} min={min} step={step} className="h-8 col-span-2 text-xs" />
  </div>
);


export default SimulationControls;
