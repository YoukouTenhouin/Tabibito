import { useEffect, useMemo, useRef, useState } from "react";
import { advanceTimeline, timelineDates } from "./timeline";
import { dateSchema, type Flight } from "./shared";

export function useTimeline(flights: Flight[], scope: string, available: boolean) {
  const signature = useMemo(() => JSON.stringify(flights), [flights]);
  // A focus refresh returns new objects even when nothing has changed.
  const stableFlights = useMemo(() => flights, [signature]);
  const bounds = useMemo(() => {
    const dates = stableFlights.flatMap(f => f.date ? [f.date] : []).sort();
    return [dates[0] ?? "", dates.at(-1) ?? ""];
  }, [stableFlights]);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(bounds[0]);
  const [end, setEnd] = useState(bounds[1]);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const previousScope = useRef(scope);
  useEffect(() => {
    setPlaying(false);
    setPosition(0);
    if (previousScope.current !== scope || !dateSchema.safeParse(start).success || !dateSchema.safeParse(end).success || start > end) {
      setStart(bounds[0]); setEnd(bounds[1]);
    }
    previousScope.current = scope;
  }, [stableFlights, scope]);
  useEffect(() => { if (!available) setPlaying(false); }, [available]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);
  const dates = useMemo(() => timelineDates(stableFlights, start, end), [stableFlights, start, end]);
  useEffect(() => {
    if (!playing || !available) return;
    let frame = 0, previous = performance.now();
    const tick = (now: number) => {
      if (now - previous >= 1000 / 30) {
        const elapsed = now - previous;
        previous = now;
        setPosition(value => advanceTimeline(value, elapsed, speed, dates.length));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, available, speed, dates.length]);
  useEffect(() => { if (position >= dates.length) setPlaying(false); }, [position, dates.length]);
  const reset = () => { setPlaying(false); setPosition(0); };
  return {
    open, start, end, position, playing, speed, dates, stableFlights,
    setSpeed,
    toggle: () => { reset(); setOpen(value => !value); },
    setStart: (value: string) => { reset(); setStart(value); },
    setEnd: (value: string) => { reset(); setEnd(value); },
    reset,
    seek: (value: number) => { setPlaying(false); setPosition(value); },
    play: () => {
      if (!available || !dates.length) return;
      if (position >= dates.length) setPosition(0);
      setPlaying(value => !value);
    },
  };
}
export type TimelineController = ReturnType<typeof useTimeline>;
