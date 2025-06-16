'use client';

import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ListChecks } from 'lucide-react';
import type { EventLogEntry } from '@/types';

interface EventLogProps {
  events: EventLogEntry[];
}

const EventLog: React.FC<EventLogProps> = ({ events }) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [events]);

  return (
    <Card className="shadow-lg mt-4">
      <CardHeader>
        <CardTitle className="font-headline text-lg flex items-center"><ListChecks className="mr-2 h-5 w-5" />Event Log</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48 w-full rounded-md border p-2 bg-muted/30" ref={scrollAreaRef}>
          {events.length === 0 && <p className="text-sm text-muted-foreground p-2">Simulation not started or no events yet.</p>}
          {events.map((event) => (
            <div key={event.id} className="text-xs p-1 border-b border-dashed border-border last:border-b-0">
              <span className="font-mono text-primary/80 mr-2">{event.timestamp}</span>
              <span>{event.message}</span>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default EventLog;
