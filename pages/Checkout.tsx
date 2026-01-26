"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouterShim } from '@/app/page';
import { useStore } from '@/store';
import { BookingStatus, RateType } from '@/types';
import { LOGO_URL, BASE_DURATION_HOURS, getGuestLabel } from '@/constants';

export default function Checkout() {
  const { route, navigate, back } = useRouterShim();
  const store = useStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', notes: '' });
  const [extrasSelection, setExtrasSelection] = useState<Record<string, number>>({});
  const [showExtras, setShowExtras] = useState(false);

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
      extras_total: extrasTotal
    };

    const finalBooking = store.addBooking(booking);
    setIsProcessing(false);
    navigate(`/confirmation?id=${finalBooking.id}`);
  };

  const toggleExtra = (id: string, pricingMode: 'flat' | 'per_person') => {
    setExtrasSelection(prev => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = 1;
      }
      return next;
    });
  };

  const setQty = (id: string, q: number) => {
    setExtrasSelection(prev => ({ ...prev, [id]: Math.max(1, q) }));
  };

  return (
    <div className="w-full px-4 py-8 md:py-12 md:max-w-6xl md:mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
      <div className="order-2 lg:order-1 space-y-8 md:space-y-12">
        {!showExtras ? (
          <div className="space-y-8">
            <div className="space-y-2">
               <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tighter">Guest <span className="text-amber-500">Details</span></h2>
               <p className="text-zinc-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Complete your reservation</p>
            </div>

            <div className="glass-panel p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] space-y-5 md:space-y-6">
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Full Name</label>
                 <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-zinc-900 border-zinc-800 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 text-white outline-none focus:ring-1 ring-amber-500 shadow-inner min-h-[44px]" />
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Email Address</label>
                 <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-zinc-900 border-zinc-800 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 text-white outline-none focus:ring-1 ring-amber-500 shadow-inner min-h-[44px]" />
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Phone Number</label>
                 <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="bg-zinc-900 border-zinc-800 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 text-white outline-none focus:ring-1 ring-amber-500 shadow-inner min-h-[44px]" />
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Special Requests</label>
                 <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="bg-zinc-900 border-zinc-800 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 text-white outline-none focus:ring-1 ring-amber-500 shadow-inner resize-none min-h-[100px]" />
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={back} 
                className="flex-1 bg-zinc-900 border border-zinc-800 py-4 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase tracking-[0.2em] text-white hover:border-zinc-700 transition-all text-[10px] min-h-[44px] active:scale-95 cursor-pointer"
              >
                Back
              </button>
              <button 
                onClick={() => setShowExtras(true)} 
                disabled={!formData.name || !formData.email}
                className="flex-[2] gold-gradient py-4 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase tracking-[0.2em] text-black shadow-lg shadow-amber-500/10 hover:scale-[1.02] transition-all disabled:opacity-50 text-[10px] min-h-[44px] active:scale-95 cursor-pointer"
              >
                Continue to Extras
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-right-4">
            {/* ... Extras UI remains unchanged ... */}
            <div className="flex gap-4">
              <button 
                onClick={() => setShowExtras(false)} 
                className="flex-1 bg-zinc-900 border border-zinc-800 py-4 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase tracking-[0.2em] text-white text-[10px] min-h-[44px] cursor-pointer"
              >
                Back
              </button>
              <button 
                onClick={handleSubmit} 
                disabled={isProcessing}
                className="flex-[2] gold-gradient py-4 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase tracking-[0.2em] text-black shadow-xl shadow-amber-500/10 active:scale-95 disabled:opacity-50 text-[10px] min-h-[44px] cursor-pointer"
              >
                {isProcessing ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : `Confirm & Pay £${store.settings.deposit_enabled ? store.settings.deposit_amount : pricing.totalPrice + extrasTotal}`}
              </button>
            </div>
          </div>
        )}
      </div>
      {/* ... Summary side remains unchanged ... */}
    </div>
  );
}