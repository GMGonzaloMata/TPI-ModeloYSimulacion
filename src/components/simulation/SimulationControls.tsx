
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, RotateCcw, Settings2, HelpCircle, TestTube2 } from 'lucide-react';
import type { SimulationParams, PrngMethodType } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


interface SimulationControlsProps {
  params: SimulationParams;
  onParamChange: <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  isRunning: boolean;
  onRunChiSquareTest: () => void;
  currentLcgSeed: number;
}

const SimulationControls: React.FC<SimulationControlsProps> = ({
  params,
  onParamChange,
  onStart,
  onPause,
  onReset,
  isRunning,
  onRunChiSquareTest,
  currentLcgSeed,
}) => {
  const handleSliderChange = (key: keyof SimulationParams, value: number[]) => {
    onParamChange(key, value[0] as any);
  };

  const handleInputChange = (key: keyof SimulationParams, event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
     if (!isNaN(value)) {
        onParamChange(key, value as any);
     } else if (event.target.value === "") {
        // Allow clearing input, handle potential NaN if needed or set to a default
        onParamChange(key, 0 as any); // Or some other default or validation
     }
  };
  
  const handleIntegerInputChange = (key: keyof SimulationParams, event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value)) {
        onParamChange(key, value as any);
    } else if (event.target.value === "") {
        onParamChange(key, 0 as any);
    }
  };


  return (
    <TooltipProvider>
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-headline text-lg flex items-center"><Settings2 className="mr-2 h-5 w-5" />Controles</CardTitle>
        <div className="flex space-x-2">
          <Button onClick={isRunning ? onPause : onStart} variant="outline" size="icon" aria-label={isRunning ? "Pausar simulación" : "Iniciar simulación"} disabled={isRunning && params.prngMethod === 'LCG' && params.lcgSeed <= 0}>
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button onClick={onReset} variant="outline" size="icon" aria-label="Reiniciar simulación">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div>
          <Label htmlFor="simSpeed" className="text-sm font-medium">Velocidad Simulación (ticks/seg): {params.simulationSpeed}x</Label>
          <Slider
            id="simSpeed"
            min={1} max={100} step={1}
            value={[params.simulationSpeed]}
            onValueChange={(val) => handleSliderChange('simulationSpeed', val)}
            className="mt-1"
          />
        </div>

        <ControlGroup title="Tiempos de Llegada (media, minutos)">
          <InputControl label="Mañana" id="morningArrivalMean" value={params.morningArrivalMean} onChange={(e) => handleInputChange('morningArrivalMean', e)} min={0.1} step={0.1} />
          <InputControl label="Pico" id="peakArrivalMean" value={params.peakArrivalMean} onChange={(e) => handleInputChange('peakArrivalMean', e)} min={0.1} step={0.1} />
          <InputControl label="Tarde" id="afternoonArrivalMean" value={params.afternoonArrivalMean} onChange={(e) => handleInputChange('afternoonArrivalMean', e)} min={0.1} step={0.1} />
        </ControlGroup>

        <ControlGroup title="Duración Estacionamiento (minutos)">
          <InputControl label="Media" id="parkingDurationMean" value={params.parkingDurationMean} onChange={(e) => handleInputChange('parkingDurationMean', e)} min={1} />
          <InputControl label="Desv. Est." id="parkingDurationStdDev" value={params.parkingDurationStdDev} onChange={(e) => handleInputChange('parkingDurationStdDev', e)} min={0} />
        </ControlGroup>
        
        <ControlGroup title="Configuración PRNG">
            <div className="grid grid-cols-3 items-center gap-2">
                <Label htmlFor="prngMethod" className="text-xs col-span-1">Método</Label>
                <Select
                    value={params.prngMethod}
                    onValueChange={(value: PrngMethodType) => onParamChange('prngMethod', value)}
                >
                    <SelectTrigger className="h-8 col-span-2 text-xs">
                        <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Math.random">Math.random (Nativo)</SelectItem>
                        <SelectItem value="LCG">LCG (Congruencial Lineal)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {params.prngMethod === 'LCG' && (
                <InputControl 
                    label="Semilla LCG" 
                    id="lcgSeed" 
                    value={params.lcgSeed} 
                    onChange={(e) => handleIntegerInputChange('lcgSeed', e)} 
                    min={1} 
                    step={1}
                    tooltip="Semilla inicial para el Generador Congruencial Lineal. Cambiarla reinicia la secuencia LCG."
                />
            )}
             {params.prngMethod === 'LCG' && (
                <div className="text-xs text-muted-foreground pl-2">Semilla actual LCG (sim): {currentLcgSeed}</div>
            )}
        </ControlGroup>

        <ControlGroup title="Prueba Chi-cuadrado (Uniformidad PRNG [0,1))">
            <InputControl label="Tamaño Muestra (N)" id="chiSquareSampleSize" value={params.chiSquareSampleSize} onChange={(e) => handleIntegerInputChange('chiSquareSampleSize', e)} min={10} step={10} tooltip="Número de muestras a generar para la prueba."/>
            <InputControl label="Intervalos (K)" id="chiSquareNumBins" value={params.chiSquareNumBins} onChange={(e) => handleIntegerInputChange('chiSquareNumBins', e)} min={2} step={1} tooltip="Número de intervalos para agrupar las muestras."/>
            <Button onClick={onRunChiSquareTest} variant="outline" size="sm" className="w-full mt-2" disabled={isRunning}>
                <TestTube2 className="mr-2 h-4 w-4" />
                Ejecutar Prueba Chi-cuadrado
            </Button>
        </ControlGroup>

        <div className="flex items-center space-x-2 pt-2">
          <Switch
            id="enableProjectedZone"
            checked={params.enableProjectedZone}
            onCheckedChange={(checked) => onParamChange('enableProjectedZone', checked)}
          />
          <Label htmlFor="enableProjectedZone" className="text-sm">Habilitar Zona Proyectada</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="enableReservations"
            checked={params.enableReservations}
            onCheckedChange={(checked) => onParamChange('enableReservations', checked)}
            disabled 
          />
          <Label htmlFor="enableReservations" className="text-sm">Habilitar Reservas (Conceptual)</Label>
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
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

const InputControl: React.FC<{label: string, id: string, value: number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, min?: number, step?: number, tooltip?: string}> = 
  ({label, id, value, onChange, min = 0, step=1, tooltip}) => (
  <div className="grid grid-cols-3 items-center gap-2">
    <Label htmlFor={id} className="text-xs col-span-1 flex items-center">
        {label}
        {tooltip && (
            <Tooltip>
                <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 ml-1 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        )}
    </Label>
    <Input id={id} type="number" value={value} onChange={onChange} min={min} step={step} className="h-8 col-span-2 text-xs" />
  </div>
);

export default SimulationControls;
