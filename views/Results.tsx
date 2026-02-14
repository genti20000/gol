"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouterShim } from '@/lib/routerShim';
import { useStore } from '@/store';
import { LOGO_URL, WHATSAPP_URL, getGuestLabel, WHATSAPP_PREFILL_ENABLED } from '@/constants';
import Spinner from '@/components/Spinner';

type InteractionPhase = 'commit' | 'paint' | 'booking_init';
type InteractionMetric = {
  id: string;
  route: string;
  slot: string;
  phase: InteractionPhase;
  durationMs: number;
  mode: 'dev' | 'prod';
  timestamp: string;
};

type SlotCardProps = {
  time: string;
  price: number;
  earlyBirdApplied: boolean;
  disabled: boolean;
  selected: boolean;
  isProcessing: boolean;
  onSelect: (time: string) => void;
};

const SlotCard = React.memo(function SlotCard({
  time,
  price,
  earlyBirdApplied,
  disabled,
  selected,
  isProcessing,
  onSelect
}: SlotCardProps) {
  const handleClick = useCallback(() => {
    onSelect(time);
  }, [onSelect, time]);

  return (
    <button
      disabled={disabled}
      onClick={handleClick}
      className={`bg-transparent border-none cursor-pointer glass-panel p-5 md:p-6 rounded-xl md:rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-150 group min-h-[100px] md:min-h-[120px] text-zinc-50 disabled:opacity-45 disabled:cursor-not-allowed ${selected ? 'border-amber-500 ring-1 ring-amber-500/40 bg-zinc-900 scale-105' : 'hover:border-amber-500/50'}`}
      aria-pressed={selected}
      aria-label={`Book ${time}`}
    >
      <span className={`text-xl md:text-2xl font-bold font-mono transition-colors ${selected ? 'text-amber-500' : 'group-hover:text-amber-500'}`}>{time}</span>
      <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-amber-500">
        £{price}
      </span>
      {earlyBirdApplied && (
        <span className="text-[9px] font-bold uppercase tracking-widest text-amber-300 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 rounded-full">
          Early Bird £15 pp
        </span>
      )}
      <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {isProcessing && selected ? 'Checking...' : selected ? 'Selected' : 'Book Now'}
      </span>
    </button>
  );
});

const PERF_LOG_LIMIT = 80;

const getWindowWithPerf = () => {
  if (typeof window === 'undefined') return null;
  const perfWindow = window as Window & { __LKC_PERF_LOGS__?: InteractionMetric[]; __LKC_LONGTASK_OBSERVED__?: boolean };
  if (!perfWindow.__LKC_PERF_LOGS__) {
    perfWindow.__LKC_PERF_LOGS__ = [];
  }
  return perfWindow;
};

const savePerfMetric = (metric: InteractionMetric) => {
  const perfWindow = getWindowWithPerf();
  if (!perfWindow) return;
  perfWindow.__LKC_PERF_LOGS__ = [...(perfWindow.__LKC_PERF_LOGS__ || []), metric].slice(-PERF_LOG_LIMIT);
  console.info('[perf][slot-interaction]', metric);
};

const safeMeasure = (name: string, startMark: string, endMark: string) => {
  if (typeof performance === 'undefined') return null;
  try {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name);
    const latest = entries[entries.length - 1];
    return latest?.duration ?? null;
  } catch {
    return null;
  }
};

const markNow = (mark: string) => {
  if (typeof performance === 'undefined') return;
  try {
    performance.mark(mark);
  } catch {
    // no-op
  }
};

const getOrCreateSessionId = () => {
  if (typeof window === 'undefined') return '';
  const existing = window.localStorage.getItem('lkc_session_id');
  if (existing) return existing;
  const generated =
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `lkc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  window.localStorage.setItem('lkc_session_id', generated);
  return generated;
};

export default function Results() {
  const { route, navigate, back } = useRouterShim();
  const store = useStore();

  const queryDate = useMemo(() => route.params.get('date') || (typeof window !== 'undefined' ? localStorage.getItem('lkc_search_date') : '') || '', [route.params]);
  const queryGuests = useMemo(() => parseInt(route.params.get('guests') || (typeof window !== 'undefined' ? localStorage.getItem('lkc_search_guests') : '') || '8'), [route.params]);
  const queryExtraHours = useMemo(() => parseInt(route.params.get('extraHours') || '0'), [route.params]);
  const queryPromo = useMemo(() => route.params.get('promo') || '', [route.params]);
  const queryServiceId = useMemo(() => route.params.get('serviceId') || (typeof window !== 'undefined' ? localStorage.getItem('lkc_search_serviceId') : '') || '', [route.params]);
  const queryStaffId = useMemo(() => route.params.get('staffId') || (typeof window !== 'undefined' ? localStorage.getItem('lkc_search_staffId') : '') || '', [route.params]);

  const [serverTimes, setServerTimes] = useState<string[] | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const displayTimes = serverTimes ?? [];

  const pricing = useMemo(() => store.calculatePricing(queryDate, queryGuests, queryExtraHours, queryPromo, queryServiceId), [queryDate, queryGuests, queryExtraHours, queryPromo, queryServiceId, store]);
  const slotPricingByTime = useMemo(() => {
    const entries = displayTimes.map((time) => [
      time,
      store.calculatePricing(queryDate, queryGuests, queryExtraHours, queryPromo, queryServiceId, time)
    ] as const);
    return Object.fromEntries(entries);
  }, [displayTimes, store, queryDate, queryGuests, queryExtraHours, queryPromo, queryServiceId]);
  const summaryPricing = useMemo(
    () => (displayTimes[0] ? slotPricingByTime[displayTimes[0]] : pricing),
    [displayTimes, slotPricingByTime, pricing]
  );

  const [waitlistForm, setWaitlistForm] = useState({
    name: '',
    phone: '',
    preferredDate: queryDate,
    preferredTime: '',
    guests: queryGuests
  });
  const [waitlistSent, setWaitlistSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotNotice, setSlotNotice] = useState<{ message: string; type: 'error' | 'info' } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [heldSlotTime, setHeldSlotTime] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [activeInteractionId, setActiveInteractionId] = useState<string | null>(null);

  const pendingCommitMetricRef = useRef<{ id: string; slot: string } | null>(null);
  const processingRef = useRef(false);
  const holdRequestIdRef = useRef(0);

  const logInteractionMetric = useCallback((phase: InteractionPhase, interactionId: string, slot: string, durationMs: number) => {
    savePerfMetric({
      id: interactionId,
      route: '/book/results',
      slot,
      phase,
      durationMs: Number(durationMs.toFixed(2)),
      mode: process.env.NODE_ENV === 'production' ? 'prod' : 'dev',
      timestamp: new Date().toISOString()
    });
  }, []);

  useEffect(() => {
    const perfWindow = getWindowWithPerf();
    if (!perfWindow || perfWindow.__LKC_LONGTASK_OBSERVED__) return;

    if (typeof PerformanceObserver === 'undefined') {
      perfWindow.__LKC_LONGTASK_OBSERVED__ = true;
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 50) {
            console.warn('[perf][longtask]', {
              route: '/book/results',
              name: entry.name,
              durationMs: Number(entry.duration.toFixed(2)),
              startTimeMs: Number(entry.startTime.toFixed(2))
            });
          }
        });
      });
      observer.observe({ entryTypes: ['longtask'] as any });
      perfWindow.__LKC_LONGTASK_OBSERVED__ = true;
      return () => observer.disconnect();
    } catch {
      perfWindow.__LKC_LONGTASK_OBSERVED__ = true;
    }
  }, []);

  useEffect(() => {
    processingRef.current = isProcessing;
  }, [isProcessing]);

  useLayoutEffect(() => {
    if (!pendingCommitMetricRef.current) return;

    const { id, slot } = pendingCommitMetricRef.current;
    const startMark = `slot-click-start-${id}`;
    const commitMark = `slot-click-commit-${id}`;
    const measureName = `slot-click-to-commit-${id}`;

    markNow(commitMark);
    const duration = safeMeasure(measureName, startMark, commitMark);
    if (duration !== null) {
      logInteractionMetric('commit', id, slot, duration);
    }

    pendingCommitMetricRef.current = null;
  }, [selectedTime, logInteractionMetric]);

  useEffect(() => {
    if (!activeInteractionId || !selectedTime) return;

    const interactionId = activeInteractionId;
    const slot = selectedTime;
    const rafId = requestAnimationFrame(() => {
      const startMark = `slot-click-start-${interactionId}`;
      const paintMark = `slot-click-paint-${interactionId}`;
      const measureName = `slot-click-to-paint-${interactionId}`;
      markNow(paintMark);
      const duration = safeMeasure(measureName, startMark, paintMark);
      if (duration !== null) {
        logInteractionMetric('paint', interactionId, slot, duration);
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [activeInteractionId, selectedTime, logInteractionMetric]);

  useEffect(() => {
    if (!slotNotice || isProcessing) return;
    const timer = setTimeout(() => setSlotNotice(null), 3800);
    return () => clearTimeout(timer);
  }, [slotNotice, isProcessing]);

  const refreshAvailabilityFromServer = useCallback(async (persist = true) => {
    try {
      if (persist) setAvailabilityLoading(true);
      if (persist) setAvailabilityError(null);
      const response = await fetch('/api/bookings/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          date: queryDate,
          guests: queryGuests,
          extraHours: queryExtraHours,
          serviceId: queryServiceId,
          staffId: queryStaffId
        })
      });
      if (!response.ok) {
        if (persist) {
          setServerTimes([]);
          setAvailabilityError('Live availability is temporarily unavailable. Please refresh and try again.');
        }
        return [];
      }
      const payload = await response.json().catch(() => ({}));
      const refreshed = Array.isArray(payload?.validTimes) ? payload.validTimes : [];
      if (persist) setServerTimes(refreshed);
      return refreshed;
    } catch {
      if (persist) {
        setServerTimes([]);
        setAvailabilityError('Live availability is temporarily unavailable. Please refresh and try again.');
      }
      return [];
    } finally {
      if (persist) setAvailabilityLoading(false);
    }
  }, [queryDate, queryGuests, queryExtraHours, queryServiceId, queryStaffId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem('lkc_slot_conflict');
    if (!raw) return;
    window.sessionStorage.removeItem('lkc_slot_conflict');
    let conflictPayload: { failedTime?: string; alternatives?: string[]; message?: string } | null = null;
    try {
      conflictPayload = JSON.parse(raw);
    } catch {
      conflictPayload = null;
    }
    if (!conflictPayload) return;

    const alternatives = Array.isArray(conflictPayload.alternatives)
      ? conflictPayload.alternatives.filter(Boolean).slice(0, 3)
      : [];
    if (alternatives.length > 0) {
      setSlotNotice({
        message: `That slot was just booked. Closest alternatives: ${alternatives.join(', ')}.`,
        type: 'error'
      });
    } else {
      setSlotNotice({
        message: conflictPayload.message || 'That slot was just booked. Live availability has been refreshed.',
        type: 'error'
      });
    }

    if (conflictPayload.failedTime) {
      setServerTimes((prev) => (prev ?? []).filter((slot) => slot !== conflictPayload?.failedTime));
      setSelectedTime((prev) => (prev === conflictPayload?.failedTime ? null : prev));
    }
    refreshAvailabilityFromServer(true);
  }, [refreshAvailabilityFromServer]);

  useEffect(() => {
    let isMounted = true;
    setServerTimes(null);
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    refreshAvailabilityFromServer(true).then((times) => {
      if (!isMounted) return;
      setServerTimes(times);
    });
    return () => {
      isMounted = false;
    };
  }, [queryDate, queryGuests, queryExtraHours, queryServiceId, queryStaffId, refreshAvailabilityFromServer]);

  const handleSelectSlot = useCallback(async (time: string) => {
    const interactionId = `${time}-${Date.now()}`;
    markNow(`slot-click-start-${interactionId}`);
    pendingCommitMetricRef.current = { id: interactionId, slot: time };
    setActiveInteractionId(interactionId);
    setSelectedTime(time);
    setHeldSlotTime(null);
    setHoldExpiresAt(null);
    setSlotNotice(null);

    const requestId = ++holdRequestIdRef.current;
    setIsProcessing(true);
    setProcessingTime(time);
    processingRef.current = true;

    try {
      const sessionId = getOrCreateSessionId();
      if (!sessionId) {
        throw new Error('Unable to start booking. Please refresh and try again.');
      }

      const holdResponse = await fetch('/api/hold-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          service_id: queryServiceId,
          date: queryDate,
          start_time: time,
          session_id: sessionId
        })
      });

      if (requestId !== holdRequestIdRef.current) return;

      if (!holdResponse.ok) {
        const holdError = (await holdResponse.json().catch(() => null)) as { detail?: string; code?: string } | null;
        const conflictMessage = holdError?.detail || 'That time was just taken. Please choose another slot.';
        const genericMessage = holdError?.detail || 'Unable to reserve that time. Please try another slot.';

        if (holdResponse.status === 409) {
          setSlotNotice({ message: conflictMessage, type: 'error' });
          setSelectedTime((prev) => (prev === time ? null : prev));
          setHeldSlotTime(null);
          setHoldExpiresAt(null);
          const refreshedAfterConflict = await refreshAvailabilityFromServer(true);
          setServerTimes(refreshedAfterConflict);
        } else {
          setSlotNotice({ message: genericMessage, type: 'error' });
          setSelectedTime((prev) => (prev === time ? null : prev));
          setHeldSlotTime(null);
          setHoldExpiresAt(null);
        }
        return;
      }

      const holdPayload = (await holdResponse.json().catch(() => null)) as { expires_at?: string } | null;
      setHeldSlotTime(time);
      setHoldExpiresAt(holdPayload?.expires_at || new Date(Date.now() + 5 * 60_000).toISOString());
      setSlotNotice({ message: `${time} reserved for 5 minutes. Continue to checkout when ready.`, type: 'info' });
    } catch {
      if (requestId === holdRequestIdRef.current) {
        setSelectedTime((prev) => (prev === time ? null : prev));
        setHeldSlotTime(null);
        setHoldExpiresAt(null);
        setSlotNotice({ message: 'Unable to reserve that time. Please try another slot.', type: 'error' });
      }
    } finally {
      if (requestId === holdRequestIdRef.current) {
        setIsProcessing(false);
        setProcessingTime(null);
        processingRef.current = false;
      }
    }
  }, [queryServiceId, queryDate, refreshAvailabilityFromServer]);

  const reserveSelectedSlotAndContinue = useCallback(async () => {
    const time = selectedTime;
    if (!time) {
      setSlotNotice({ message: 'Pick a time to continue.', type: 'error' });
      return;
    }
    if (heldSlotTime !== time) {
      setSlotNotice({ message: 'Please wait while we reserve your selected time.', type: 'error' });
      return;
    }
    const sessionId = getOrCreateSessionId();
    const checkoutParams = new URLSearchParams({
      date: queryDate,
      time,
      guests: String(queryGuests),
      extraHours: String(queryExtraHours),
      promo: queryPromo,
      serviceId: queryServiceId,
      staffId: queryStaffId,
      sessionId
    });
    if (holdExpiresAt) {
      checkoutParams.set('holdExpiresAt', holdExpiresAt);
    }
    navigate(`/checkout?${checkoutParams.toString()}`);
  }, [selectedTime, heldSlotTime, queryDate, queryGuests, queryExtraHours, queryPromo, queryServiceId, queryStaffId, holdExpiresAt, navigate]);

  useEffect(() => {
    if (!displayTimes.length) {
      setSelectedTime(null);
      setHeldSlotTime(null);
      setHoldExpiresAt(null);
      return;
    }
    if (selectedTime && !displayTimes.includes(selectedTime)) {
      setSelectedTime(null);
      setHeldSlotTime(null);
      setHoldExpiresAt(null);
    }
  }, [displayTimes, selectedTime]);

  const slotCards = useMemo(() => {
    return displayTimes.map((time) => {
      const timePricing = slotPricingByTime[time] ?? pricing;
      return {
        time,
        totalPrice: timePricing.totalPrice,
        earlyBirdApplied: Boolean(timePricing.earlyBirdApplied)
      };
    });
  }, [displayTimes, pricing, slotPricingByTime]);

  const selectedSlotPricing = useMemo(() => {
    if (!selectedTime) return null;
    return slotPricingByTime[selectedTime] ?? pricing;
  }, [selectedTime, slotPricingByTime, pricing]);
  const canContinue = Boolean(selectedTime && heldSlotTime === selectedTime && !isProcessing);
  const showLoadingAvailability = availabilityLoading && serverTimes === null;

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = await store.addWaitlistEntry({
      name: waitlistForm.name,
      phone: waitlistForm.phone,
      preferredDate: waitlistForm.preferredDate,
      preferredTime: waitlistForm.preferredTime || undefined,
      guests: waitlistForm.guests
    });

    if (result.ok) {
      setWaitlistSent(true);
    } else {
      setError(result.error || "Failed to join waitlist");
    }
  };

  const handleWhatsAppWaitlist = () => {
    if (!waitlistForm.name || !waitlistForm.phone || !waitlistForm.preferredDate) {
      setError("Please fill in required fields first.");
      return;
    }
    const message = store.buildWaitlistMessage({
      preferredDate: waitlistForm.preferredDate,
      guests: waitlistForm.guests,
      preferredTime: waitlistForm.preferredTime
    });
    window.open(store.buildWhatsAppUrl(message), '_blank');
  };

  if (store.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center uppercase font-bold tracking-widest text-zinc-600 animate-pulse text-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (store.loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center uppercase font-bold tracking-widest text-red-400 text-sm">
          {store.loadError || 'Failed to load availability. Please refresh and try again.'}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-8 md:py-12 md:max-w-6xl md:mx-auto animate-in fade-in duration-700">
      <div className="mb-6">
        <button onClick={back} className="bg-transparent border-none cursor-pointer text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
          <i className="fa-solid fa-arrow-left"></i> Back to Search
        </button>
      </div>

      {availabilityError && (
        <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-200">{availabilityError}</p>
        </div>
      )}

      {(isProcessing || slotNotice) && (
        <div className="fixed inset-0 z-[120] pointer-events-none flex items-center justify-center px-4">
          <div
            className={`w-full max-w-2xl rounded-2xl border px-6 py-5 shadow-2xl backdrop-blur-sm ${
              isProcessing
                ? 'border-amber-500/40 bg-amber-500/15'
                : slotNotice?.type === 'error'
                  ? 'border-red-500/40 bg-red-500/15'
                  : 'border-zinc-700 bg-zinc-900/85'
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center justify-center gap-3 text-center">
              {isProcessing && <Spinner className="w-4 h-4" />}
              <p
                className={`text-[10px] font-bold uppercase tracking-widest ${
                  isProcessing ? 'text-amber-100' : slotNotice?.type === 'error' ? 'text-red-100' : 'text-zinc-100'
                }`}
              >
                {isProcessing ? `Checking ${processingTime || 'slot'}...` : slotNotice?.message}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 md:gap-8 items-start">
        <div>
          <div className="mb-6 md:mb-8">
            <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-tighter mb-2">Available <span className="text-amber-500">Times</span></h2>
            <div className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] space-y-1">
              <p>
                <span className="text-white">{getGuestLabel(queryGuests)}</span> •{' '}
                {(() => {
                  if (!queryDate) return 'Select a valid date';
                  const parsed = Date.parse(`${queryDate}T00:00:00`);
                  if (!Number.isFinite(parsed)) return 'Select a valid date';
                  return new Date(parsed).toLocaleDateString('en-GB', { dateStyle: 'full' });
                })()}
              </p>
              <p className="text-amber-500">{2 + queryExtraHours} Hour Experience</p>
            </div>
          </div>

          {showLoadingAvailability ? (
            <div className="text-center py-16 md:py-24 glass-panel rounded-[1.5rem] md:rounded-[2.5rem] border border-zinc-800 px-6">
              <div className="inline-flex items-center gap-3 text-zinc-400">
                <Spinner className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Refreshing live availability...</span>
              </div>
            </div>
          ) : displayTimes.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {slotCards.map((slot) => (
                <SlotCard
                  key={slot.time}
                  time={slot.time}
                  price={slot.totalPrice}
                  earlyBirdApplied={slot.earlyBirdApplied}
                  disabled={isProcessing && processingTime === slot.time}
                  selected={selectedTime === slot.time}
                  isProcessing={isProcessing}
                  onSelect={handleSelectSlot}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-12">
              <div className="text-center py-16 md:py-24 glass-panel rounded-[1.5rem] md:rounded-[2.5rem] border-dashed border-zinc-800 border-2 px-6">
                <i className="fa-solid fa-calendar-xmark text-3xl md:text-4xl text-zinc-700 mb-6"></i>
                <h3 className="text-lg md:text-xl font-bold uppercase tracking-tight text-zinc-500">Fully Booked Online</h3>
                <p className="text-zinc-600 text-[10px] md:text-xs mt-2 uppercase tracking-widest">No availability for your selection. Join the waitlist and we’ll contact you if space opens up.</p>
              </div>

              <div className="glass-panel p-8 md:p-10 rounded-[2rem] border-zinc-800 shadow-2xl space-y-8">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold uppercase tracking-tight text-white">Join Waitlist</h3>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">We'll alert you if this slot becomes available.</p>
                </div>

                <form onSubmit={handleJoinWaitlist} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Name</label>
                    <input type="text" required value={waitlistForm.name} onChange={e => setWaitlistForm({ ...waitlistForm, name: e.target.value })} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white outline-none focus:ring-1 ring-amber-500" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Phone</label>
                    <input type="tel" required value={waitlistForm.phone} onChange={e => setWaitlistForm({ ...waitlistForm, phone: e.target.value })} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white outline-none focus:ring-1 ring-amber-500" />
                  </div>
                  <div className="md:col-span-2">
                    {waitlistSent ? (
                      <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-4 rounded-xl text-[10px] font-bold uppercase tracking-widest text-center">
                        Successfully Joined Waitlist
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-4">
                        <button type="submit" className="flex-1 bg-zinc-900 border border-zinc-800 text-white py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all">Submit Request</button>
                        <button type="button" onClick={handleWhatsAppWaitlist} className="flex-1 bg-green-500 text-white py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl shadow-green-500/10">
                          <i className="fa-brands fa-whatsapp text-lg"></i>
                          WhatsApp Concierge
                        </button>
                      </div>
                    )}
                    {error && <p className="text-red-500 text-[9px] font-bold uppercase tracking-widest mt-4 text-center">{error}</p>}
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-[100px]">
          <div className="glass-panel rounded-[1.5rem] border border-zinc-800/90 shadow-2xl px-5 py-6 space-y-4">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">Booking Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <span>Selected time</span>
                <span className="text-white font-mono">{selectedTime || 'No time selected'}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <span>Guests</span>
                <span className="text-white">{queryGuests}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <span>Session length</span>
                <span className="text-white">{2 + queryExtraHours}h</span>
              </div>
            </div>
            <div className="border-t border-zinc-800 pt-4 space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <span>Subtotal</span>
                <span className="font-mono text-zinc-200">£{summaryPricing.baseTotal + summaryPricing.extrasPrice}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-green-500">
                <span>Discount</span>
                <span className="font-mono">-£{summaryPricing.ticketSessionDiscountAmount || 0}</span>
              </div>
              <div className="flex justify-between items-end border-t border-zinc-800 pt-3 mt-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">Grand Total</span>
                <span className="text-3xl font-bold text-white tracking-tight">£{selectedSlotPricing?.totalPrice ?? pricing.totalPrice}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={reserveSelectedSlotAndContinue}
              disabled={!canContinue}
              aria-disabled={!canContinue}
              className={`w-full gold-gradient px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] text-black transition-opacity ${canContinue ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed pointer-events-none'}`}
            >
              Continue to checkout
            </button>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              We reserve your selected time for 5 minutes after you select it.
            </p>
            {selectedSlotPricing?.earlyBirdApplied && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                Early Bird £15 pp applied
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
