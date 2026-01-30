"use client";

import React, { useMemo, useState } from 'react';
import { useRouterShim } from '@/lib/routerShim';
import { useStore } from '@/store';
import { LOGO_URL, WHATSAPP_URL, getGuestLabel, WHATSAPP_PREFILL_ENABLED } from '@/constants';

export default function Results() {
  const { route, navigate, back } = useRouterShim();
  const store = useStore();

  // Robust parameter recovery with localStorage fallback
  const queryDate = useMemo(() => route.params.get('date') || (typeof window !== 'undefined' ? localStorage.getItem('lkc_search_date') : '') || '', [route.params]);
  const queryGuests = useMemo(() => parseInt(route.params.get('guests') || (typeof window !== 'undefined' ? localStorage.getItem('lkc_search_guests') : '') || '8'), [route.params]);
  const queryExtraHours = useMemo(() => parseInt(route.params.get('extraHours') || '0'), [route.params]);
  const queryPromo = useMemo(() => route.params.get('promo') || '', [route.params]);
  const queryServiceId = useMemo(() => route.params.get('serviceId') || (typeof window !== 'undefined' ? localStorage.getItem('lkc_search_serviceId') : '') || '', [route.params]);
  const queryStaffId = useMemo(() => route.params.get('staffId') || (typeof window !== 'undefined' ? localStorage.getItem('lkc_search_staffId') : '') || '', [route.params]);

  const totalDurationMinutes = (2 + queryExtraHours) * 60;

  const validTimes = useMemo(() => {
    if (!queryDate) return [];
    return store.getValidStartTimes(queryDate, totalDurationMinutes, queryStaffId || undefined, queryServiceId || undefined);
  }, [queryDate, totalDurationMinutes, queryStaffId, queryServiceId, store]);

  const pricing = useMemo(() => store.calculatePricing(queryDate, queryGuests, queryExtraHours, queryPromo), [queryDate, queryGuests, queryExtraHours, queryPromo, store]);

  const [waitlistForm, setWaitlistForm] = useState({
    name: '',
    phone: '',
    preferredDate: queryDate,
    preferredTime: '',
    guests: queryGuests
  });
  const [waitlistSent, setWaitlistSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBook = (time: string) => {
    const params = new URLSearchParams({
      date: queryDate,
      guests: queryGuests.toString(),
      extraHours: queryExtraHours.toString(),
      time,
      promo: queryPromo,
      serviceId: queryServiceId,
      staffId: queryStaffId
    });
    navigate(`/checkout?${params.toString()}`);
  };

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
      setError(result.reason || "Failed to join waitlist");
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
          Failed to load availability. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-8 md:py-12 md:max-w-4xl md:mx-auto animate-in fade-in duration-700">
      <div className="mb-6">
        <button onClick={back} className="bg-transparent border-none cursor-pointer text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
          <i className="fa-solid fa-arrow-left"></i> Back to Search
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 md:gap-8 mb-10 md:mb-16">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-tighter mb-2">Available <span className="text-amber-500">Times</span></h2>
          <div className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] space-y-1">
            <p><span className="text-white">{getGuestLabel(queryGuests)}</span> • {queryDate ? new Date(queryDate).toLocaleDateString('en-GB', { dateStyle: 'full' }) : 'Invalid Date'}</p>
            <p className="text-amber-500">{2 + queryExtraHours} Hour Experience</p>
          </div>
        </div>

        <div className="glass-panel p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border-amber-500/20 w-full md:min-w-[280px] md:w-auto">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
            <span>Subtotal</span>
            <span className="font-mono">£{pricing.baseTotal + pricing.extrasPrice}</span>
          </div>
          {pricing.discountAmount > 0 && (
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-green-500 mb-2">
              <span>Midweek Discount</span>
              <span className="font-mono">-£{pricing.discountAmount}</span>
            </div>
          )}
          {store.settings.deposit_enabled && (
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-2 pt-2 border-t border-zinc-800/50">
              <span>Deposit Due Now</span>
              <span className="font-mono">£{store.settings.deposit_amount}</span>
            </div>
          )}
          <div className="flex justify-between items-end border-t border-zinc-800 pt-4 mt-2">
            <span className="text-[10px] font-bold uppercase tracking-widest">Grand Total</span>
            <span className="text-3xl font-bold text-white tracking-tighter">£{pricing.totalPrice}</span>
          </div>
        </div>
      </div>

      {validTimes.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {validTimes.map(time => (
            <button key={time} onClick={() => handleBook(time)} className="bg-transparent border-none cursor-pointer glass-panel hover:border-amber-500/50 p-5 md:p-6 rounded-xl md:rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group min-h-[100px] md:min-h-[120px] text-zinc-50">
              <span className="text-xl md:text-2xl font-bold font-mono group-hover:text-amber-500 transition-colors">{time}</span>
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500">Book Now</span>
            </button>
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
  );
}
