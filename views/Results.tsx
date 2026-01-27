"use client";

import React, { useMemo, useState } from 'react';
import { useRouterShim } from '@/lib/routerShim';
import { useStore } from '@/store';
import { getGuestLabel } from '@/constants';

export default function Results() {
  const { route, navigate, back } = useRouterShim();
  const store = useStore();

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

  const formattedDate = queryDate ? new Date(queryDate).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }) : 'Invalid Date';

  return (
    <div className="relative min-h-screen pt-24 pb-32 px-4 sm:px-10">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 animate-fade-in-up">
          <div className="space-y-4">
            <button onClick={back} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
              <i className="fa-solid fa-arrow-left"></i> Modify Search
            </button>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase">
              Select Your <span className="gold-gradient-text">Time</span>
            </h1>
            <div className="flex flex-wrap gap-4 text-xs font-bold uppercase tracking-widest text-zinc-400">
              <span className="flex items-center gap-2"><i className="fa-solid fa-calendar text-amber-500/50"></i> {formattedDate}</span>
              <span className="flex items-center gap-2"><i className="fa-solid fa-users text-amber-500/50"></i> {getGuestLabel(queryGuests)}</span>
              <span className="flex items-center gap-2"><i className="fa-solid fa-clock text-amber-500/50"></i> {2 + queryExtraHours} Hours</span>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border-amber-500/20 w-full md:w-80 card-luxury">
            <div className="flex justify-between items-baseline mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Live Quote</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tighter">£{pricing.totalPrice}</span>
                {pricing.discountAmount > 0 && (
                  <span className="text-sm text-zinc-600 line-through font-bold">£{pricing.subtotal}</span>
                )}
              </div>
            </div>
            <div className="space-y-2 border-t border-zinc-900 pt-4">
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                <span>Room Base</span>
                <span>£{pricing.baseTotal}</span>
              </div>
              {pricing.extrasPrice > 0 && (
                <div className="flex justify-between text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  <span>Additional Hours</span>
                  <span>£{pricing.extrasPrice}</span>
                </div>
              )}
              {pricing.discountAmount > 0 && (
                <div className="flex justify-between text-[9px] font-bold uppercase tracking-[0.2em] text-amber-500">
                  <span>Midweek Offer</span>
                  <span>-£{pricing.discountAmount}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {validTimes.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {validTimes.map((time, idx) => (
              <button
                key={time}
                onClick={() => handleBook(time)}
                className="glass-panel glass-panel-hover p-8 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-2xl font-bold tracking-tighter group-hover:text-amber-500 transition-colors uppercase">{time}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 group-hover:text-zinc-400">Available</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="glass-panel rounded-3xl p-12 text-center border-dashed border-zinc-800 space-y-6">
              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-zinc-800">
                <i className="fa-solid fa-calendar-xmark text-2xl text-zinc-600"></i>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold uppercase tracking-tight">Fully Booked</h3>
                <p className="text-sm text-zinc-500 max-w-sm mx-auto">No availability for this combination. Join our waitlist below for instant alerts.</p>
              </div>
            </div>

            <div className="mt-12 glass-panel rounded-3xl p-8 md:p-12 card-luxury overflow-hidden">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <div className="badge-luxury">Priority Concierge</div>
                  <h3 className="text-3xl font-bold uppercase tracking-tighter">Join the Waitlist</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">We monitor cancellations 24/7. Provide your details and we'll reach out the moment a slot opens.</p>
                </div>

                <form onSubmit={handleJoinWaitlist} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Name</label>
                      <input type="text" required value={waitlistForm.name} onChange={e => setWaitlistForm({ ...waitlistForm, name: e.target.value })} className="w-full h-12 px-4 input-luxury text-sm font-semibold" placeholder="Full Name" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Phone</label>
                      <input type="tel" required value={waitlistForm.phone} onChange={e => setWaitlistForm({ ...waitlistForm, phone: e.target.value })} className="w-full h-12 px-4 input-luxury text-sm font-semibold" placeholder="07xxx xxxxxx" />
                    </div>
                  </div>
                  <button type="submit" className="w-full h-14 bg-white text-black rounded-lg font-bold uppercase tracking-widest text-xs hover:bg-zinc-200 transition-colors">Submit Request</button>
                  <button type="button" onClick={() => window.open(store.buildWhatsAppUrl(`Waitlist for ${formattedDate} @AnyTime`), '_blank')} className="w-full h-14 border border-zinc-800 rounded-lg font-bold uppercase tracking-widest text-xs text-zinc-400 hover:text-white hover:border-zinc-600 transition-all flex items-center justify-center gap-3">
                    <i className="fa-brands fa-whatsapp text-lg"></i>
                    WhatsApp Priority
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}