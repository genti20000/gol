"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouterShim } from '@/lib/routerShim';
import { useStore } from '@/store';
import { BookingStatus, Extra } from '@/types';
import { getGuestLabel } from '@/constants';

export default function Checkout() {
  const { route, navigate, back } = useRouterShim();
  const store = useStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', notes: '' });
  const [extrasSelection, setExtrasSelection] = useState<Record<string, number>>({});
  const [currentStep, setCurrentStep] = useState<'extras' | 'details'>('extras');

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
      deposit_amount: store.settings.deposit_enabled ? store.settings.deposit_amount : 0,
      deposit_paid: true
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
    <div className="relative min-h-screen pt-24 pb-32 px-4 sm:px-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Flow */}
          <div className="lg:col-span-7 space-y-12">
            <header className="space-y-4 animate-fade-in-up">
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.3em]">
                <span className={currentStep === 'extras' ? 'text-amber-500' : 'text-zinc-600'}>01 EXTRAS</span>
                <div className="h-px w-8 bg-zinc-800" />
                <span className={currentStep === 'details' ? 'text-amber-500' : 'text-zinc-600'}>02 GUEST DETAILS</span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tighter uppercase">
                {currentStep === 'extras' ? 'Enhance Your ' : 'Finalize your '}
                <span className="gold-gradient-text">{currentStep === 'extras' ? 'Session' : 'Booking'}</span>
              </h1>
            </header>

            {currentStep === 'extras' ? (
              <div className="space-y-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="grid grid-cols-1 gap-4">
                  {enabledExtras.map((extra: Extra) => (
                    <div key={extra.id} className={`glass-panel p-6 rounded-2xl flex items-center justify-between gap-6 transition-all ${extrasSelection[extra.id] ? 'border-amber-500/40 bg-amber-500/5' : 'glass-panel-hover'}`}>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold uppercase tracking-tight">{extra.name}</h4>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                          £{extra.price} {extra.pricingMode === 'per_person' ? 'per person' : 'flat'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 bg-zinc-950 px-2 py-1 rounded-xl border border-zinc-800">
                        <button onClick={() => updateExtraQty(extra.id, -1)} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white"><i className="fa-solid fa-minus text-[10px]"></i></button>
                        <span className="w-4 text-center text-xs font-bold text-amber-500">{extrasSelection[extra.id] || 0}</span>
                        <button onClick={() => updateExtraQty(extra.id, 1)} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white"><i className="fa-solid fa-plus text-[10px]"></i></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 pt-8">
                  <button onClick={back} className="flex-1 h-14 rounded-xl border border-zinc-800 font-bold uppercase tracking-widest text-[10px]">Back</button>
                  <button onClick={() => setCurrentStep('details')} className="flex-[2] h-14 gold-gradient rounded-xl font-bold uppercase tracking-widest text-[10px] text-black gold-glow">Continue to Details</button>
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="glass-panel p-8 rounded-3xl space-y-6 card-luxury">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Full Name</label>
                      <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full h-12 px-4 input-luxury text-sm font-semibold" placeholder="Name on booking" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Email Address</label>
                      <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full h-12 px-4 input-luxury text-sm font-semibold" placeholder="For the confirmation" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Phone Number</label>
                      <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full h-12 px-4 input-luxury text-sm font-semibold" placeholder="07xxx xxxxxx" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Notes</label>
                      <input type="text" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full h-12 px-4 input-luxury text-sm font-semibold" placeholder="Birthdays, events etc." />
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-8">
                  <button onClick={() => setCurrentStep('extras')} className="flex-1 h-14 rounded-xl border border-zinc-800 font-bold uppercase tracking-widest text-[10px]">Back</button>
                  <button onClick={handleSubmit} disabled={isProcessing} className="flex-[2] h-14 gold-gradient rounded-xl font-bold uppercase tracking-widest text-[10px] text-black gold-glow disabled:opacity-50">
                    {isProcessing ? 'Processing...' : `Confirm & Pay £${store.settings.deposit_enabled ? store.settings.deposit_amount : pricing.totalPrice + extrasTotal}`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Summary */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 glass-panel p-8 rounded-3xl space-y-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <h3 className="text-xl font-bold uppercase tracking-tighter">Summary</h3>

              <div className="space-y-3 border-b border-zinc-900 pb-8">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Scheduled For</span>
                  <span className="text-xs font-bold uppercase tracking-tight">{new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} @ {time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Group Size</span>
                  <span className="text-xs font-bold uppercase tracking-tight">{getGuestLabel(guests)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Duration</span>
                  <span className="text-xs font-bold uppercase tracking-tight">{totalDuration} Hours</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                  <span className="text-zinc-500">Room Session</span>
                  <span>£{pricing.baseTotal + pricing.extrasPrice}</span>
                </div>
                {pricing.discountAmount > 0 && (
                  <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-amber-500">
                    <span>Midweek Offer</span>
                    <span>-£{pricing.discountAmount}</span>
                  </div>
                )}
                {Object.entries(extrasSelection).map(([id, qty]) => {
                  const extra = store.extras.find(e => e.id === id)!;
                  const cost = extra.pricingMode === 'per_person' ? extra.price * guests * qty : extra.price * qty;
                  return (
                    <div key={id} className="flex justify-between text-xs font-bold uppercase tracking-widest">
                      <span className="text-zinc-500">{extra.name} (x{qty})</span>
                      <span>£{cost}</span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-8 border-t border-zinc-900 space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Total Price</span>
                  <span className="text-4xl font-extrabold tracking-tighter">£{pricing.totalPrice + extrasTotal}</span>
                </div>
                {store.settings.deposit_enabled && (
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Due Now</span>
                    <span className="text-lg font-bold text-amber-500 tracking-tighter">£{store.settings.deposit_amount}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}