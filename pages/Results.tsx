
import React, { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { LOGO_URL, WHATSAPP_URL, getGuestLabel, WHATSAPP_PREFILL_ENABLED } from '../constants';

export default function Results() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const store = useStore();

  const queryDate = searchParams.get('date') || '';
  const queryGuests = parseInt(searchParams.get('guests') || '8');
  const queryExtraHours = parseInt(searchParams.get('extraHours') || '0');
  const queryPromo = searchParams.get('promo') || '';
  const queryServiceId = searchParams.get('serviceId') || '';
  const queryStaffId = searchParams.get('staffId') || '';
  
  const totalDurationMinutes = (2 + queryExtraHours) * 60;

  const validTimes = useMemo(() => store.getValidStartTimes(queryDate, totalDurationMinutes, queryStaffId || undefined, queryServiceId || undefined), [queryDate, totalDurationMinutes, queryStaffId, queryServiceId, store]);
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

  const handleJoinWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = store.addWaitlistEntry({
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

  return (
    <div className="w-full px-4 py-8 md:py-12 md:max-w-4xl md:mx-auto animate-in fade-in duration-700">
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
          <i className="fa-solid fa-arrow-left"></i> Back to Search
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 md:gap-8 mb-10 md:mb-16">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-tighter mb-2">Available <span className="text-amber-500">Times</span></h2>
          <div className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] space-y-1">
            <p><span className="text-white">{getGuestLabel(queryGuests)}</span> • {new Date(queryDate).toLocaleDateString('en-GB', { dateStyle: 'full' })}</p>
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
            <button key={time} onClick={() => handleBook(time)} className="glass-panel hover:border-amber-500/50 p-5 md:p-6 rounded-xl md:rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group min-h-[100px] md:min-h-[120px]">
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

          {!waitlistSent ? (
            <div className="glass-panel p-8 md:p-12 rounded-[2rem] md:rounded-[3rem] border-zinc-800 max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4">
               <div className="text-center">
                  <h4 className="text-xl font-bold uppercase tracking-tighter text-white">Join the Waitlist</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">We'll alert you if a suite opens up.</p>
               </div>
               <form onSubmit={handleJoinWaitlist} className="space-y-6">
                  {error && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Full Name</label>
                        <input type="text" required value={waitlistForm.name} onChange={e => setWaitlistForm({...waitlistForm, name: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner min-h-[44px]" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Phone Number</label>
                        <input type="tel" required value={waitlistForm.phone} onChange={e => setWaitlistForm({...waitlistForm, phone: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner min-h-[44px]" />
                     </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Date</label>
                        <input type="date" required value={waitlistForm.preferredDate} onChange={e => setWaitlistForm({...waitlistForm, preferredDate: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner min-h-[44px]" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Preferred Time</label>
                        <input type="time" value={waitlistForm.preferredTime} onChange={e => setWaitlistForm({...waitlistForm, preferredTime: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner min-h-[44px]" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Group Size</label>
                        <input type="number" min="8" max="100" value={waitlistForm.guests} onChange={e => setWaitlistForm({...waitlistForm, guests: parseInt(e.target.value) || 8})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner min-h-[44px]" />
                     </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                     <button type="submit" className="flex-1 gold-gradient text-black py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-amber-500/10 active:scale-95 transition-transform min-h-[44px]">Join Waitlist</button>
                     <button type="button" onClick={handleWhatsAppWaitlist} className="flex-1 bg-[#25D366] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-transform min-h-[44px]">
                        <i className="fa-brands fa-whatsapp"></i> Send via WhatsApp
                     </button>
                  </div>
               </form>
            </div>
          ) : (
            <div className="text-center py-12 glass-panel rounded-[2rem] border-zinc-800 animate-in zoom-in-95 max-w-2xl mx-auto">
               <i className="fa-solid fa-circle-check text-4xl text-green-500 mb-4"></i>
               <h4 className="text-xl font-bold uppercase tracking-tighter text-white">Added to Waitlist</h4>
               <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-2">Our concierge team will be in touch if space becomes available.</p>
               <button onClick={() => setWaitlistSent(false)} className="mt-8 text-amber-500 font-bold uppercase tracking-widest text-[9px] border-b border-amber-500/20 pb-1">Submit Another Entry</button>
            </div>
          )}
        </div>
      )}

      <div className="mt-12 md:mt-20 bg-zinc-900/30 border border-zinc-800 p-6 md:p-12 rounded-[1.5rem] md:rounded-[2.5rem] text-center">
         <h4 className="text-lg md:text-xl font-bold uppercase tracking-tighter text-white mb-4">Concierge Priority Assistance</h4>
         <p className="text-zinc-500 max-w-md mx-auto text-[10px] md:text-xs font-medium leading-relaxed mb-6 md:mb-8 uppercase tracking-widest">
            If you’re not able to find space available online, please contact us via WhatsApp.
         </p>
         <a href={store.buildWhatsAppUrl(store.buildWaitlistMessage({ preferredDate: queryDate, guests: queryGuests }))} target="_blank" className="inline-flex items-center justify-center gap-4 bg-[#25D366] hover:scale-105 transition-all text-white font-bold py-4 md:py-5 px-8 md:px-12 rounded-full uppercase tracking-[0.2em] text-[10px] w-full md:w-auto min-h-[44px]">
            <i className="fa-brands fa-whatsapp text-xl"></i>
            WhatsApp Concierge
         </a>
      </div>
    </div>
  );
}
