
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings2, HelpCircle, TestTube2 } from 'lucide-react';
import type { SimulationParams, PrngMethodType } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SimulationControlsProps {
  params: SimulationParams;
  onParamChange: <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => void;
  onRunChiSquareTest: () => void;
}

const hoursOptions = Array.from({ length: 24 }, (_, i) => ({ value: i, label: String(i).padStart(2, '0') }));
const minutesOptions = [
  { value: 0, label: '00' },
  { value: 15, label: '15' },
  { value: 30, label: '30' },
  { value: 45, label: '45' },
];

const SimulationControls: React.FC<SimulationControlsProps> = ({
  params,
  onParamChange,
  onRunChiSquareTest,
}) => {
  const handleSliderChange = (key: keyof SimulationParams, value: number[]) => {
    onParamChange(key, value[0] as any);
  };

  const handleNumericInputChange = (key: keyof SimulationParams, event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
     if (!isNaN(value)) {
        onParamChange(key, value as any);
     } else if (event.target.value === "") {
        onParamChange(key, 0 as any); 
     }
  };
  
  const handleIntegerInputChange = (key: keyof SimulationParams, event: React.ChangeEvent<HTMLInputElement>) => {
    let value = parseInt(event.target.value, 10);
    if (!isNaN(value)) {
        // For 'mcg_m', ensure it's at least 1 if user clears and re-types.
        if (key === 'mcg_m' && value <= 0) value = 1;
        onParamChange(key, value as any);
    } else if (event.target.value === "") {
        onParamChange(key, (key === 'mcg_m' ? 1 : 0) as any);
    }
  };

  const handleTimeChange = (
    paramKey: 'simulationStartTime' | 'simulationEndTime',
    type: 'hour' | 'minute',
    value: string
  ) => {
    const numericValue = parseInt(value, 10);
    let currentTotalMinutes = params[paramKey];
    let currentHour = Math.floor(currentTotalMinutes / 60);
    let currentMinute = currentTotalMinutes % 60;

    if (type === 'hour') {
      currentHour = numericValue;
    } else {
      currentMinute = numericValue;
    }
    
    const newTotalMinutes = currentHour * 60 + currentMinute;
    onParamChange(paramKey, newTotalMinutes as any);
  };

  const getHourFromMinutes = (totalMinutes: number) => Math.floor(totalMinutes / 60);
  const getMinuteFromMinutes = (totalMinutes: number) => totalMinutes % 60;

  const isSeedablePrng = params.prngMethod === 'LCG' || params.prngMethod === 'Mersenne-Twister';
  const isMcgPrng = params.prngMethod === 'MixedCongruential';

  return (
    <TooltipProvider>
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="font-headline text-lg flex items-center"><Settings2 className="mr-2 h-5 w-5" />Parámetros de Simulación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <ControlGroup title="Horarios de Simulación">
            <div className="space-y-2">
                <Label className="text-xs">Hora Inicio (HH:MM)</Label>
                <div className="flex gap-2">
                    <Select value={String(getHourFromMinutes(params.simulationStartTime))} onValueChange={(h) => handleTimeChange('simulationStartTime', 'hour', h)}>
                        <SelectTrigger className="h-8 text-xs w-1/2"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {hoursOptions.map(opt => <SelectItem key={`start-h-${opt.value}`} value={String(opt.value)}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={String(getMinuteFromMinutes(params.simulationStartTime))} onValueChange={(m) => handleTimeChange('simulationStartTime', 'minute', m)}>
                        <SelectTrigger className="h-8 text-xs w-1/2"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {minutesOptions.map(opt => <SelectItem key={`start-m-${opt.value}`} value={String(opt.value)}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-2">
                <Label className="text-xs">Hora Fin (HH:MM)</Label>
                 <div className="flex gap-2">
                    <Select value={String(getHourFromMinutes(params.simulationEndTime))} onValueChange={(h) => handleTimeChange('simulationEndTime', 'hour', h)}>
                        <SelectTrigger className="h-8 text-xs w-1/2"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {hoursOptions.map(opt => <SelectItem key={`end-h-${opt.value}`} value={String(opt.value)}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={String(getMinuteFromMinutes(params.simulationEndTime))} onValueChange={(m) => handleTimeChange('simulationEndTime', 'minute', m)}>
                        <SelectTrigger className="h-8 text-xs w-1/2"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {minutesOptions.map(opt => <SelectItem key={`end-m-${opt.value}`} value={String(opt.value)}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
             <div className="text-xs text-muted-foreground pl-1">
                Actual: {String(getHourFromMinutes(params.simulationStartTime)).padStart(2,'0')}:{String(getMinuteFromMinutes(params.simulationStartTime)).padStart(2,'0')} - {String(getHourFromMinutes(params.simulationEndTime)).padStart(2,'0')}:{String(getMinuteFromMinutes(params.simulationEndTime)).padStart(2,'0')}
            </div>
        </ControlGroup>

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
          <InputControl label="Mañana (antes del pico)" id="morningArrivalMean" value={params.morningArrivalMean} onChange={(e) => handleNumericInputChange('morningArrivalMean', e)} min={0.1} step={0.1} tooltip="Tiempo medio entre llegadas antes de la hora pico."/>
          <InputControl label="Pico (ej. 7:30-9:00 AM)" id="peakArrivalMean" value={params.peakArrivalMean} onChange={(e) => handleNumericInputChange('peakArrivalMean', e)} min={0.1} step={0.1} tooltip="Tiempo medio entre llegadas durante la hora pico."/>
          <InputControl label="Tarde (después del pico)" id="afternoonArrivalMean" value={params.afternoonArrivalMean} onChange={(e) => handleNumericInputChange('afternoonArrivalMean', e)} min={0.1} step={0.1} tooltip="Tiempo medio entre llegadas después de la hora pico."/>
        </ControlGroup>

        <ControlGroup title="Duración Estacionamiento (minutos)">
          <InputControl label="Media" id="parkingDurationMean" value={params.parkingDurationMean} onChange={(e) => handleNumericInputChange('parkingDurationMean', e)} min={1} tooltip="Tiempo promedio que un vehículo permanece estacionado."/>
          <InputControl label="Desv. Est." id="parkingDurationStdDev" value={params.parkingDurationStdDev} onChange={(e) => handleNumericInputChange('parkingDurationStdDev', e)} min={0} tooltip="Desviación estándar del tiempo de estacionamiento."/>
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
                        <SelectItem value="MixedCongruential">Congruencial Mixto</SelectItem>
                        <SelectItem value="Mersenne-Twister">Mersenne-Twister (random-js)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {isSeedablePrng && (
                <InputControl 
                    label="Semilla PRNG" 
                    id="prngSeed" 
                    value={params.prngSeed} 
                    onChange={(e) => handleIntegerInputChange('prngSeed', e)} 
                    min={1} 
                    step={1}
                    tooltip="Semilla inicial para LCG o Mersenne-Twister. Cambiarla reinicia la secuencia."
                />
            )}
            {isMcgPrng && (
              <>
                <InputControl 
                    label="Semilla MCG (X0)" 
                    id="mcg_seed" 
                    value={params.mcg_seed} 
                    onChange={(e) => handleIntegerInputChange('mcg_seed', e)} 
                    min={0} 
                    step={1}
                    tooltip="Semilla inicial (X0) para el Generador Congruencial Mixto."
                />
                <InputControl 
                    label="Multiplicador (a)" 
                    id="mcg_a" 
                    value={params.mcg_a} 
                    onChange={(e) => handleIntegerInputChange('mcg_a', e)} 
                    min={0} 
                    step={1}
                    tooltip="Parámetro 'a' (multiplicador) para MCG."
                />
                <InputControl 
                    label="Incremento (c)" 
                    id="mcg_c" 
                    value={params.mcg_c} 
                    onChange={(e) => handleIntegerInputChange('mcg_c', e)} 
                    min={0} 
                    step={1}
                    tooltip="Parámetro 'c' (incremento) para MCG."
                />
                <InputControl 
                    label="Módulo (m)" 
                    id="mcg_m" 
                    value={params.mcg_m} 
                    onChange={(e) => handleIntegerInputChange('mcg_m', e)} 
                    min={1} 
                    step={1}
                    tooltip="Parámetro 'm' (módulo) para MCG. Debe ser > 0."
                />
              </>
            )}
        </ControlGroup>

        <ControlGroup title="Prueba Chi-cuadrado (Uniformidad PRNG [0,1))">
            <InputControl label="Tamaño Muestra (N)" id="chiSquareSampleSize" value={params.chiSquareSampleSize} onChange={(e) => handleIntegerInputChange('chiSquareSampleSize', e)} min={10} step={10} tooltip="Número de muestras a generar para la prueba."/>
            <InputControl label="Intervalos (K)" id="chiSquareNumBins" value={params.chiSquareNumBins} onChange={(e) => handleIntegerInputChange('chiSquareNumBins', e)} min={2} step={1} tooltip="Número de intervalos para agrupar las muestras."/>
            <Button onClick={onRunChiSquareTest} variant="outline" size="sm" className="w-full mt-2">
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
  <div className="pt-2">
    <h4 className="text-sm font-semibold mb-2 text-muted-foreground">{title}</h4>
    <div className="space-y-3 pl-2 border-l-2 border-border">
      {children}
    </div>
  </div>
);

const InputControl: React.FC<{label: string, id: string, value: number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, min?: number, max?:number, step?: number, tooltip?: string}> = 
  ({label, id, value, onChange, min = 0, max, step=1, tooltip}) => (
  <div className="grid grid-cols-3 items-center gap-2">
    <Label htmlFor={id} className="text-xs col-span-1 flex items-center">
        {label}
        {tooltip && (
            <Tooltip>
                <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 ml-1 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs p-2">
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        )}
    </Label>
    <Input id={id} type="number" value={value} onChange={onChange} min={min} max={max} step={step} className="h-8 col-span-2 text-xs" />
  </div>
);

export default SimulationControls;

