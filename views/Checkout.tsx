"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouterShim } from '@/lib/routerShim';
import { useStore } from '@/store';
import { BookingStatus, RateType, Extra } from '@/types';
import { LOGO_URL, BASE_DURATION_HOURS, getGuestLabel } from '@/constants';

export default function Checkout() {
  const { route, navigate, back } = useRouterShim();
  const store = useStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({ name: '', surname: '', email: '', phone: '', notes: '' });
  const [extrasSelection, setExtrasSelection] = useState<Record<string, number>>({});
  const [currentStep, setCurrentStep] = useState<'extras' | 'details'>('details');

  const date = route.params.get('date') || '';
  const time = route.params.get('time') || '';
  const guests = parseInt(route.params.get('guests') || '8');
  const extraHours = parseInt(route.params.get('extraHours') || '0');
  const promo = route.params.get('promo') || '';
  const queryServiceId = route.params.get('serviceId') || undefined;
  const queryStaffId = route.params.get('staffId') || undefined;

  const totalDuration = 2 + extraHours;

  const pricing = useMemo(() => store.calculatePricing(date, guests, extraHours, promo), [date, guests, extraHours, promo, store]);
  const enabledExtras = useMemo(() => store.getEnabledExtras(), [store]);
  const extrasTotal = useMemo(() => store.computeExtrasTotal(extrasSelection, guests), [extrasSelection, guests, store]);

  // Show extras step first when available, otherwise go straight to details
  useEffect(() => {
    if (enabledExtras.length > 0) {
      setCurrentStep('extras');
      return;
    }
    setCurrentStep('details');
  }, [enabledExtras.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    const startAt = new Date(`${date}T${time}`).toISOString();
    const endAt = new Date(new Date(startAt).getTime() + totalDuration * 3600000).toISOString();

    const assignment = store.findFirstAvailableRoomAndStaff(startAt, endAt, queryStaffId, queryServiceId);
    if (!assignment) {
      alert("This slot has been taken. Please choose another time.");
      navigate('/');
      return;
    }

    // Simulate Payment
    await new Promise(resolve => setTimeout(resolve, 2000));

    const bookingExtras = store.buildBookingExtrasSnapshot(extrasSelection, guests);

    const booking = {
      room_id: assignment.room_id,
      room_name: store.rooms.find(r => r.id === assignment.room_id)!.name,
      staff_id: assignment.staff_id,
      service_id: queryServiceId,
      start_at: startAt,
      end_at: endAt,
      status: BookingStatus.CONFIRMED,
      guests,
      customer_name: formData.name,
      customer_surname: formData.surname,
      customer_email: formData.email,
      customer_phone: formData.phone,
      notes: formData.notes,
      base_total: pricing.baseTotal,
      extras_hours: extraHours,
      extras_price: pricing.extrasPrice,
      discount_amount: pricing.discountAmount,
      promo_code: promo || undefined,
      promo_discount_amount: pricing.promoDiscountAmount,
      total_price: pricing.totalPrice + extrasTotal,
      created_at: new Date().toISOString(),
      source: 'public' as const,
      extras: bookingExtras,
      extras_total: extrasTotal,
      deposit_amount: 0,
      deposit_paid: false
    };

    const finalBooking = await store.addBooking(booking);
    setIsProcessing(false);
    if (finalBooking) {
      navigate(`/confirmation?id=${finalBooking.id}`);
    } else {
      alert("Something went wrong while creating your booking.");
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

  return (
    <div className="w-full px-4 py-8 md:py-12 md:max-w-6xl md:mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
      <div className="order-2 lg:order-1 space-y-8 md:space-y-12">
        {enabledExtras.length > 0 && currentStep === 'extras' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tighter">Enhance Your <span className="text-amber-500">Session</span></h2>
              <p className="text-zinc-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Select optional food & drink packages</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {enabledExtras.map((extra: Extra) => (
                <div key={extra.id} className={`p-6 rounded-[1.5rem] border transition-all flex items-center justify-between gap-6 ${extrasSelection[extra.id] ? 'bg-amber-500/5 border-amber-500/40' : 'glass-panel border-zinc-800'}`}>
                  <div className="flex-1">
                    <p className="text-sm font-bold uppercase tracking-tight text-white">{extra.name}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mt-1">
                      £{extra.price} {extra.pricingMode === 'per_person' ? 'per guest' : 'flat rate'}
                    </p>
                    {extra.description && <p className="text-[10px] text-zinc-600 mt-2 line-clamp-1">{extra.description}</p>}
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
                  <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-zinc-900 border-zinc-800 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 text-white outline-none focus:ring-1 ring-amber-500 shadow-inner min-h-[44px]" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Surname</label>
                  <input type="text" required value={formData.surname} onChange={e => setFormData({ ...formData, surname: e.target.value })} className="bg-zinc-900 border-zinc-800 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 text-white outline-none focus:ring-1 ring-amber-500 shadow-inner min-h-[44px]" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Email Address</label>
                <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="bg-zinc-900 border-zinc-800 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 text-white outline-none focus:ring-1 ring-amber-500 shadow-inner min-h-[44px]" />
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
                disabled={isProcessing || !formData.name || !formData.surname || !formData.email}
                className={`${enabledExtras.length > 0 ? 'flex-[2]' : 'w-full'} gold-gradient py-4 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase tracking-[0.2em] text-black shadow-xl shadow-amber-500/10 active:scale-95 disabled:opacity-50 text-[10px] min-h-[44px] cursor-pointer`}
              >
                {isProcessing ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : `Confirm & Pay £${pricing.totalPrice + extrasTotal}`}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="lg:sticky lg:top-24 h-fit">
        <div className="glass-panel p-8 rounded-[2rem] border-zinc-800 space-y-8 shadow-2xl">
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold uppercase tracking-tighter text-white">Summary</h3>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{new Date(date).toLocaleDateString('en-GB', { dateStyle: 'full' })} at {time}</p>
              </div>
              <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest">{getGuestLabel(guests)}</span>
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
              <span className="text-4xl font-bold text-white tracking-tighter">£{pricing.totalPrice + extrasTotal}</span>
            </div>
            {store.settings.deposit_enabled && (
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Deposit Due Now</span>
                <span className="text-xl font-bold text-amber-500 tracking-tighter">£{store.settings.deposit_amount}</span>
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
  );
}
