"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouterShim } from '@/lib/routerShim';
import { useStore } from '@/store';
import { Booking, Extra } from '@/types';
import { EXTRAS, PRICING_TIERS, getGuestLabel } from '@/constants';
import { shouldShowExtraInfoIcon } from '@/lib/extras';
import { computeAmountDueNow } from '@/lib/paymentLogic';
import {
  REQUIRED_BOOKING_DRAFT_FIELDS,
  normalizeBookingDraftInput,
  validateBookingDraftInput
} from '@/lib/bookingValidation';

export default function Checkout() {
  const { route, navigate, back } = useRouterShim();
  const store = useStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentRedirectUrl, setPaymentRedirectUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', surname: '', email: '', phone: '', notes: '' });
  const [extrasSelection, setExtrasSelection] = useState<Record<string, number>>({});
  const [currentStep, setCurrentStep] = useState<'extras' | 'details' | 'payment'>('details');
  const [draftBooking, setDraftBooking] = useState<Booking | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isDraftLoading, setIsDraftLoading] = useState(false);
  const [showExtrasInfo, setShowExtrasInfo] = useState(false);
  const [activeExtraInfoId, setActiveExtraInfoId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const extrasInfoRef = useRef<HTMLDivElement | null>(null);
  const extrasInfoButtonRef = useRef<HTMLButtonElement | null>(null);
  const extraInfoRef = useRef<HTMLDivElement | null>(null);
  const extraInfoButtonRef = useRef<HTMLButtonElement | null>(null);
  const draftKeyRef = useRef<string | null>(null);

  const date = route.params.get('date') || '';
  const time = route.params.get('time') || '';
  const parsedGuests = Number(route.params.get('guests') || '8');
  const parsedExtraHours = Number(route.params.get('extraHours') || '0');
  const promo = route.params.get('promo') || '';
  const queryServiceId = route.params.get('serviceId') || undefined;
  const queryStaffId = route.params.get('staffId') || undefined;

  const guestMin = Math.min(...PRICING_TIERS.map(tier => tier.min));
  const guestMax = Math.max(...PRICING_TIERS.map(tier => tier.max));
  const extraHourOptions = EXTRAS.map(extra => extra.hours);
  const extraMin = Math.min(...extraHourOptions);
  const extraMax = Math.max(...extraHourOptions);

  const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  const guests = Number.isFinite(parsedGuests) ? clampValue(parsedGuests, guestMin, guestMax) : guestMin;
  const extraHours = Number.isFinite(parsedExtraHours) ? clampValue(parsedExtraHours, extraMin, extraMax) : extraMin;

  const isValidDateTime = useMemo(() => {
    if (!date || !time) return false;
    const parsed = new Date(`${date}T${time}`);
    return Number.isFinite(parsed.getTime());
  }, [date, time]);
  const isValidGuests = Number.isFinite(parsedGuests) && parsedGuests === guests;
  const isValidExtraHours = Number.isFinite(parsedExtraHours) && extraHourOptions.includes(parsedExtraHours);
  const hasValidBookingDetails = isValidDateTime && isValidGuests && isValidExtraHours;

  const pricing = useMemo(() => store.calculatePricing(date, guests, extraHours, promo), [date, guests, extraHours, promo, store]);
  const enabledExtras = useMemo(() => store.getEnabledExtras(), [store]);
  const extrasTotal = useMemo(() => store.computeExtrasTotal(extrasSelection, guests), [extrasSelection, guests, store]);
  const estimatedTotal = useMemo(() => pricing.totalPrice + extrasTotal, [pricing.totalPrice, extrasTotal]);
  const estimatedDueNow = useMemo(
    () =>
      computeAmountDueNow({
        totalPrice: estimatedTotal,
        depositEnabled: store.settings.deposit_enabled,
        depositAmount: store.settings.deposit_amount
      }),
    [store.settings.deposit_enabled, store.settings.deposit_amount, estimatedTotal]
  );
  const bookingDraftValidation = useMemo(
    () =>
      validateBookingDraftInput({
        date,
        time,
        guests,
        extraHours,
        firstName: formData.name,
        surname: formData.surname,
        email: formData.email
      }),
    [date, time, guests, extraHours, formData.name, formData.surname, formData.email]
  );
  const normalizedDraftInput = useMemo(
    () =>
      normalizeBookingDraftInput({
        date,
        time,
        guests,
        extraHours,
        firstName: formData.name,
        surname: formData.surname,
        email: formData.email
      }),
    [date, time, guests, extraHours, formData.name, formData.surname, formData.email]
  );
  const hasValidDraftDetails = bookingDraftValidation.isValid;
  const draftFieldErrors = bookingDraftValidation.fieldErrors;
  const draftErrorSummary = Object.values(draftFieldErrors);

  const draftKey = `${date}|${time}|${guests}|${extraHours}|${promo}|${queryServiceId ?? ''}|${queryStaffId ?? ''}|${normalizedDraftInput.firstName}|${normalizedDraftInput.surname}|${normalizedDraftInput.email}|${formData.phone}|${formData.notes}`;
  const bookingId = draftBooking?.id ?? null;
  const summaryGuestCount = draftBooking?.guests ?? guests;
  const summaryStartDate = draftBooking?.start_at ? new Date(draftBooking.start_at) : new Date(date);

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
          Failed to load booking details. Please refresh and try again.
        </div>
      </div>
    );
  }

  // Show extras step first when available, otherwise go straight to details
  useEffect(() => {
    if (enabledExtras.length > 0) {
      setCurrentStep('extras');
      return;
    }
    setCurrentStep('details');
  }, [enabledExtras.length]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.('change', update);
    return () => mediaQuery.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!paymentRedirectUrl || typeof window === 'undefined') {
      return;
    }

    const timer = window.setTimeout(() => {
      window.location.href = paymentRedirectUrl;
    }, 250);

    return () => window.clearTimeout(timer);
  }, [paymentRedirectUrl]);

  useEffect(() => {
    if (!hasValidBookingDetails || !hasValidDraftDetails) {
      return;
    }

    if (draftKeyRef.current === draftKey) {
      return;
    }

    draftKeyRef.current = draftKey;
    setDraftBooking(null);
    setDraftError(null);
    setIsDraftLoading(true);

    const createDraft = async () => {
      try {
        const response = await fetch('/api/bookings/create-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: normalizedDraftInput.date,
            time: normalizedDraftInput.time,
            guests: normalizedDraftInput.guests,
            extraHours: normalizedDraftInput.extraHours,
            promo,
            serviceId: queryServiceId,
            staffId: queryStaffId,
            firstName: normalizedDraftInput.firstName,
            surname: normalizedDraftInput.surname,
            email: normalizedDraftInput.email,
            phone: formData.phone?.trim() || null,
            notes: formData.notes?.trim() || null
          })
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          console.error('Failed to create booking draft.', errorBody);
          setDraftError(errorBody?.error || 'Unable to create booking draft.');
          return;
        }

        const payload = await response.json().catch(() => ({}));
        if (!payload?.bookingId) {
          setDraftError('Unable to create booking draft.');
          return;
        }

        setDraftBooking(payload.booking ?? null);
      } catch (error) {
        console.error('Failed to create booking draft.', error);
        setDraftError('Unable to create booking draft.');
      } finally {
        setIsDraftLoading(false);
      }
    };

    void createDraft();
  }, [
    date,
    draftKey,
    extraHours,
    guests,
    hasValidBookingDetails,
    hasValidDraftDetails,
    promo,
    queryServiceId,
    queryStaffId,
    time,
    normalizedDraftInput,
    formData.notes,
    formData.phone
  ]);

  useEffect(() => {
    if (!showExtrasInfo) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (extrasInfoRef.current?.contains(target) || extrasInfoButtonRef.current?.contains(target)) {
        return;
      }
      setShowExtrasInfo(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExtrasInfo]);

  useEffect(() => {
    if (!activeExtraInfoId || isMobile) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (extraInfoRef.current?.contains(target) || extraInfoButtonRef.current?.contains(target)) {
        return;
      }
      setActiveExtraInfoId(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeExtraInfoId, isMobile]);

  useEffect(() => {
    if (!activeExtraInfoId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveExtraInfoId(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeExtraInfoId]);

  const activeExtraInfo = useMemo(
    () => enabledExtras.find(extra => extra.id === activeExtraInfoId) ?? null,
    [enabledExtras, activeExtraInfoId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);
    setIsProcessing(true);

    try {
      if (!hasValidBookingDetails) {
        setPaymentError('Please select valid booking details before continuing.');
        return;
      }
      if (!hasValidDraftDetails) {
        setPaymentError('Please complete all required guest details before continuing.');
        return;
      }
      if (!bookingId) {
        setPaymentError('Unable to start checkout. Please refresh and try again.');
        return;
      }

      if (draftError) {
        setPaymentError(draftError);
        return;
      }

      if ((draftBooking?.deposit_amount ?? 0) <= 0) {
        navigate(`/booking/confirmed?id=${bookingId}`);
        return;
      }

      const checkoutResponse = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId })
      });

      if (!checkoutResponse.ok) {
        const errorBody = await checkoutResponse.json().catch(() => ({}));
        setPaymentError(errorBody?.error || 'Unable to start the payment. Please try again.');
        return;
      }

      const payload = await checkoutResponse.json();
      if (payload?.confirmed) {
        navigate(`/booking/confirmed?id=${bookingId}`);
        return;
      }

      if (!payload?.url) {
        setPaymentError('Unable to start the payment. Please try again.');
        return;
      }

      setPaymentRedirectUrl(payload.url);
      setCurrentStep('payment');
    } catch (error) {
      setPaymentError('Something went wrong while processing the payment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateExtraQty = (id: string, delta: number) => {
    setExtrasSelection(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      const newState = { ...prev };
      if (next === 0) delete newState[id];
      else newState[id] = next;
      return newState;
    });
  };

  if (!hasValidBookingDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-panel p-8 md:p-10 rounded-[2rem] border-zinc-800 max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mx-auto">
            <i className="fa-solid fa-triangle-exclamation text-2xl text-amber-500"></i>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold uppercase tracking-tighter text-white">Missing Booking Details</h1>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Return to the search flow and select a valid time.</p>
          </div>
          <button
            onClick={back}
            className="w-full gold-gradient text-black py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-amber-500/10 active:scale-95 transition-transform"
          >
            Back to Availability
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="w-full px-4 py-8 md:py-12 md:max-w-6xl md:mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
      <div className="order-2 lg:order-1 space-y-8 md:space-y-12">
        {isDraftLoading && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Creating your booking draft...
          </div>
        )}
        {draftError && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-red-200">
            {draftError}
          </div>
        )}
        {enabledExtras.length > 0 && currentStep === 'extras' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tighter">Enhance Your <span className="text-amber-500">Session</span></h2>
                <div className="relative">
                  <button
                    ref={extrasInfoButtonRef}
                    type="button"
                    onClick={() => setShowExtrasInfo((prev) => !prev)}
                    aria-label="More info about food and drink offers"
                    aria-expanded={showExtrasInfo}
                    className="w-8 h-8 rounded-full border border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors flex items-center justify-center"
                  >
                    <i className="fa-solid fa-circle-info text-[13px]"></i>
                  </button>
                  {showExtrasInfo && (
                    <div
                      ref={extrasInfoRef}
                      className="absolute right-0 mt-3 w-64 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4 text-[10px] text-zinc-300 shadow-2xl shadow-black/40 backdrop-blur"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold uppercase tracking-widest text-[9px] text-white">Food & Drink Offers</p>
                        <button
                          type="button"
                          onClick={() => setShowExtrasInfo(false)}
                          className="text-zinc-500 hover:text-white transition-colors"
                          aria-label="Close food and drink info"
                        >
                          <i className="fa-solid fa-xmark text-[10px]"></i>
                        </button>
                      </div>
                      <p className="mt-2 text-zinc-400 leading-relaxed">
                        Choose any package to upgrade your experience. Pricing is shown per guest or flat rate, and
                        quantities can be adjusted to match your group size. Add-ons are optional and can be changed
                        before checkout.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-zinc-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Select optional food & drink packages</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {enabledExtras.map((extra: Extra) => (
                <div key={extra.id} className={`p-6 rounded-[1.5rem] border transition-all flex items-center justify-between gap-6 ${extrasSelection[extra.id] ? 'bg-amber-500/5 border-amber-500/40' : 'glass-panel border-zinc-800'}`}>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold uppercase tracking-tight text-white">{extra.name}</p>
                        {shouldShowExtraInfoIcon(extra.infoText) && (
                          <div className="relative">
                            <button
                              ref={activeExtraInfoId === extra.id ? extraInfoButtonRef : undefined}
                              type="button"
                              onClick={() => setActiveExtraInfoId((prev) => (prev === extra.id ? null : extra.id))}
                              aria-label={`More info about ${extra.name}`}
                              aria-expanded={activeExtraInfoId === extra.id}
                              aria-haspopup={isMobile ? 'dialog' : 'true'}
                              className="w-7 h-7 rounded-full border border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors flex items-center justify-center"
                            >
                              <i className="fa-solid fa-circle-info text-[11px]"></i>
                            </button>
                            {!isMobile && activeExtraInfoId === extra.id && (
                              <div
                                ref={extraInfoRef}
                                role="dialog"
                                aria-label={`${extra.name} info`}
                                className="absolute right-0 mt-3 w-56 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-3 text-[10px] text-zinc-300 shadow-2xl shadow-black/40 backdrop-blur"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <p className="font-semibold uppercase tracking-widest text-[9px] text-white">Extra Details</p>
                                  <button
                                    type="button"
                                    onClick={() => setActiveExtraInfoId(null)}
                                    className="text-zinc-500 hover:text-white transition-colors"
                                    aria-label={`Close ${extra.name} details`}
                                  >
                                    <i className="fa-solid fa-xmark text-[10px]"></i>
                                  </button>
                                </div>
                                <p className="mt-2 text-zinc-400 leading-relaxed whitespace-pre-wrap">{extra.infoText}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mt-1">
                      £{extra.price} {extra.pricingMode === 'per_person' ? 'per guest' : 'flat rate'}
                    </p>
                    {shouldShowExtraInfoIcon(extra.infoText) && (
                      <p className="text-[10px] text-zinc-600 mt-2 line-clamp-1">{extra.infoText}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                    <button
                      onClick={() => updateExtraQty(extra.id, -1)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                    >
                      <i className="fa-solid fa-minus text-[10px]"></i>
                    </button>
                    <span className="w-6 text-center text-xs font-mono font-bold text-amber-500">{extrasSelection[extra.id] || 0}</span>
                    <button
                      onClick={() => updateExtraQty(extra.id, 1)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                    >
                      <i className="fa-solid fa-plus text-[10px]"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {isMobile && activeExtraInfo && (
              <div className="fixed inset-0 z-[200] flex items-end justify-center">
                <div
                  className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                  onClick={() => setActiveExtraInfoId(null)}
                ></div>
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${activeExtraInfo.name} info`}
                  className="relative w-full max-w-md rounded-t-[2rem] border border-zinc-800 bg-zinc-950/95 p-6 shadow-2xl shadow-black/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold uppercase tracking-tight text-white">{activeExtraInfo.name}</p>
                    <button
                      type="button"
                      onClick={() => setActiveExtraInfoId(null)}
                      className="text-zinc-500 hover:text-white transition-colors"
                      aria-label={`Close ${activeExtraInfo.name} info`}
                    >
                      <i className="fa-solid fa-xmark text-[12px]"></i>
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{activeExtraInfo.infoText}</p>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={back}
                className="flex-1 bg-zinc-900 border border-zinc-800 py-4 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase tracking-[0.2em] text-white hover:border-zinc-700 transition-all text-[10px] min-h-[44px] active:scale-95 cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep('details')}
                className="flex-[2] gold-gradient py-4 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase tracking-[0.2em] text-black shadow-lg shadow-amber-500/10 hover:scale-[1.02] transition-all text-[10px] min-h-[44px] active:scale-95 cursor-pointer"
              >
                Continue to Details
              </button>
            </div>
          </div>
        ) : currentStep === 'details' ? (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tighter">Guest <span className="text-amber-500">Details</span></h2>
              <p className="text-zinc-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Complete your reservation</p>
            </div>

            <div className="glass-panel p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] space-y-5 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className={`bg-zinc-900 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 text-white outline-none focus:ring-1 shadow-inner min-h-[44px] ${draftFieldErrors.firstName ? 'border-red-500/60 ring-red-500' : 'border-zinc-800 ring-amber-500'}`}
                  />
                  {draftFieldErrors.firstName && (
                    <p className="text-[9px] uppercase tracking-widest text-red-300 ml-1">{draftFieldErrors.firstName}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Surname</label>
                  <input
                    type="text"
                    required
                    value={formData.surname}
                    onChange={e => setFormData({ ...formData, surname: e.target.value })}
                    className={`bg-zinc-900 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 text-white outline-none focus:ring-1 shadow-inner min-h-[44px] ${draftFieldErrors.surname ? 'border-red-500/60 ring-red-500' : 'border-zinc-800 ring-amber-500'}`}
                  />
                  {draftFieldErrors.surname && (
                    <p className="text-[9px] uppercase tracking-widest text-red-300 ml-1">{draftFieldErrors.surname}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className={`bg-zinc-900 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 text-white outline-none focus:ring-1 shadow-inner min-h-[44px] ${draftFieldErrors.email ? 'border-red-500/60 ring-red-500' : 'border-zinc-800 ring-amber-500'}`}
                />
                {draftFieldErrors.email && (
                  <p className="text-[9px] uppercase tracking-widest text-red-300 ml-1">{draftFieldErrors.email}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Phone Number</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="bg-zinc-900 border-zinc-800 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 text-white outline-none focus:ring-1 ring-amber-500 shadow-inner min-h-[44px]" />
              </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Special Requests</label>
              <textarea rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="bg-zinc-900 border-zinc-800 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 text-white outline-none focus:ring-1 ring-amber-500 shadow-inner resize-none min-h-[100px]" />
            </div>
          </div>

          {(paymentError || draftErrorSummary.length > 0) && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-red-200 space-y-2">
              {paymentError && <p>{paymentError}</p>}
              {draftErrorSummary.length > 0 && (
                <>
                  <p>Please complete the highlighted fields before confirming your booking.</p>
                  <ul className="list-disc list-inside space-y-1 text-[9px] text-red-100/80 uppercase tracking-widest">
                    {REQUIRED_BOOKING_DRAFT_FIELDS.filter((field) => draftFieldErrors[field]).map((field) => (
                      <li key={field}>{draftFieldErrors[field]}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="flex gap-4">
            {enabledExtras.length > 0 && (
              <button
                onClick={() => setCurrentStep('extras')}
                className="flex-1 bg-zinc-900 border border-zinc-800 py-4 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase tracking-[0.2em] text-white text-[10px] min-h-[44px] cursor-pointer active:scale-95"
              >
                Back
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={
                isProcessing ||
                isDraftLoading ||
                !hasValidDraftDetails ||
                !bookingId ||
                Boolean(draftError)
              }
              className={`${enabledExtras.length > 0 ? 'flex-[2]' : 'w-full'} gold-gradient py-4 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase tracking-[0.2em] text-black shadow-xl shadow-amber-500/10 active:scale-95 disabled:opacity-50 text-[10px] min-h-[44px] cursor-pointer`}
            >
              {isProcessing ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : estimatedDueNow <= 0 ? 'Confirm booking' : `Pay £${estimatedDueNow} now`}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tighter">Complete <span className="text-amber-500">Payment</span></h2>
            <p className="text-zinc-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Secure checkout powered by Stripe</p>
          </div>
          <div className="glass-panel p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] space-y-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Redirecting you to our secure Stripe checkout...
            </p>
            {paymentRedirectUrl && (
              <button
                onClick={() => window.location.assign(paymentRedirectUrl)}
                className="w-full gold-gradient py-3 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] text-black shadow-xl shadow-amber-500/10 active:scale-95"
              >
                Continue to Payment
              </button>
            )}
          </div>
        </div>
      )}
      </div>

      <div className="lg:sticky lg:top-24 h-fit">
        <div className="glass-panel p-8 rounded-[2rem] border-zinc-800 space-y-8 shadow-2xl">
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
            <h3 className="text-xl font-bold uppercase tracking-tighter text-white">Summary</h3>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{summaryStartDate.toLocaleDateString('en-GB', { dateStyle: 'full' })} at {time}</p>
              </div>
              <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest">{getGuestLabel(summaryGuestCount)}</span>
            </div>
          </div>

          <div className="space-y-3 border-t border-zinc-900 pt-6">
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              <span>Base Session (2h)</span>
              <span>£{pricing.baseTotal}</span>
            </div>
            {extraHours > 0 && (
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                <span>Extended Time (+{extraHours}h)</span>
                <span>£{pricing.extrasPrice}</span>
              </div>
            )}
            {Object.entries(extrasSelection).map(([id, qty]) => {
              const extra = store.extras.find(e => e.id === id);
              if (!extra) return null;
              const cost = extra.pricingMode === 'per_person' ? extra.price * guests * qty : extra.price * qty;
              return (
                <div key={id} className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-zinc-400 animate-in slide-in-from-left-2">
                  <span>{extra.name} (x{qty})</span>
                  <span>£{cost}</span>
                </div>
              );
            })}
            {pricing.discountAmount > 0 && (
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-green-500">
                <span>Midweek Discount</span>
                <span>-£{pricing.discountAmount}</span>
              </div>
            )}
            {pricing.promoDiscountAmount > 0 && (
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-amber-500">
                <span>Promo Applied</span>
                <span>-£{pricing.promoDiscountAmount}</span>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800 pt-6 space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Total Price</span>
              <span className="text-4xl font-bold text-white tracking-tighter">£{estimatedTotal}</span>
            </div>
            {store.settings.deposit_enabled && (
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">{estimatedDueNow > 0 ? 'Deposit Due Now' : 'Deposit Due'}</span>
                <span className="text-xl font-bold text-amber-500 tracking-tighter">£{estimatedDueNow}</span>
              </div>
            )}
          </div>

          <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 space-y-3">
            <div className="flex items-center gap-3 text-zinc-500">
              <i className="fa-solid fa-shield-halved text-xs"></i>
              <span className="text-[9px] font-bold uppercase tracking-widest">Secure TLS Encryption</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
