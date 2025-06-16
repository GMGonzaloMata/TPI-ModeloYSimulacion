
'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ArrivalsRejectionsLineChartProps {
  data: Array<{ timeLabel: string; arrivals: number; rejections: number }>;
}

const ArrivalsRejectionsLineChart: React.FC<ArrivalsRejectionsLineChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-lg">Llegadas y Rechazos por Hora</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No hay datos de llegadas/rechazos para mostrar.</p>
        </CardContent>
      </Card>
    );
  }
  
  const chartData = data.map(item => ({
      ...item,
      // Ensure recharts doesn't misinterpret timeLabel as a category needing excessive spacing if too many labels
  }));


  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="font-headline text-lg">Llegadas y Rechazos por Hora</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
                dataKey="timeLabel" 
                angle={-45} 
                textAnchor="end" 
                height={60} 
                interval="preserveStartEnd" 
                tick={{ fontSize: '10px' }}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: '10px' }}/>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '12px' }}/>
            <Line type="monotone" dataKey="arrivals" name="Llegadas" stroke="hsl(var(--chart-1))" activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="rejections" name="Rechazos" stroke="hsl(var(--destructive))" activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ArrivalsRejectionsLineChart;
