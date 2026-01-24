
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { BookingStatus, RateType } from '../types';
import { LOGO_URL, BASE_DURATION_HOURS, getGuestLabel } from '../constants';

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const store = useStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', notes: '' });
  const [extrasSelection, setExtrasSelection] = useState<Record<string, number>>({});
  const [showExtras, setShowExtras] = useState(false);

  const date = searchParams.get('date') || '';
  const time = searchParams.get('time') || '';
  const guests = parseInt(searchParams.get('guests') || '8');
  const extraHours = parseInt(searchParams.get('extraHours') || '0');
  const promo = searchParams.get('promo') || '';
  const queryServiceId = searchParams.get('serviceId') || undefined;
  const queryStaffId = searchParams.get('staffId') || undefined;
  
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

            <button 
              onClick={() => setShowExtras(true)} 
              disabled={!formData.name || !formData.email}
              className="w-full bg-zinc-900 border border-zinc-800 py-4 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase tracking-[0.2em] text-white hover:border-amber-500 transition-all disabled:opacity-50 text-[10px] min-h-[44px]"
            >
              Continue to Extras
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-right-4">
            <div className="space-y-2">
               <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tighter">Optional <span className="text-amber-500">Extras</span></h2>
               <p className="text-zinc-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Enhance your session with drinks and snacks</p>
            </div>

            <div className="space-y-4">
              {enabledExtras.length > 0 ? (
                enabledExtras.map(extra => (
                  <div 
                    key={extra.id} 
                    className={`glass-panel p-5 rounded-2xl border transition-all flex justify-between items-center group ${extrasSelection[extra.id] ? 'border-amber-500/50 bg-amber-500/5' : 'border-zinc-800 hover:border-zinc-700'}`}
                    onClick={() => toggleExtra(extra.id, extra.pricingMode)}
                  >
                    <div className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-3 mb-1">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${extrasSelection[extra.id] ? 'bg-amber-500 border-amber-500 text-black' : 'border-zinc-700'}`}>
                          {extrasSelection[extra.id] && <i className="fa-solid fa-check text-[10px]"></i>}
                        </div>
                        <h4 className="font-bold text-white text-sm uppercase">{extra.name}</h4>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{extra.description}</p>
                    </div>

                    <div className="text-right space-y-3" onClick={e => e.stopPropagation()}>
                      <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">
                        +£{extra.price}{extra.pricingMode === 'per_person' ? ' pp' : ''}
                      </p>
                      {extrasSelection[extra.id] && extra.pricingMode === 'flat' && (
                        <div className="flex items-center gap-3 bg-zinc-950 rounded-lg p-1 border border-zinc-800">
                          <button onClick={() => setQty(extra.id, (extrasSelection[extra.id] || 1) - 1)} className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"><i className="fa-solid fa-minus text-[10px]"></i></button>
                          <span className="text-xs font-mono font-bold text-white w-4 text-center">{extrasSelection[extra.id]}</span>
                          <button onClick={() => setQty(extra.id, (extrasSelection[extra.id] || 1) + 1)} className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"><i className="fa-solid fa-plus text-[10px]"></i></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest text-center py-10">No extras currently available.</p>
              )}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setShowExtras(false)} 
                className="flex-1 bg-zinc-900 border border-zinc-800 py-4 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase tracking-[0.2em] text-white text-[10px] min-h-[44px]"
              >
                Back
              </button>
              <button 
                onClick={handleSubmit} 
                disabled={isProcessing}
                className="flex-[2] gold-gradient py-4 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase tracking-[0.2em] text-black shadow-xl shadow-amber-500/10 active:scale-95 disabled:opacity-50 text-[10px] min-h-[44px]"
              >
                {isProcessing ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : `Confirm & Pay £${store.settings.deposit_enabled ? store.settings.deposit_amount : pricing.totalPrice + extrasTotal}`}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="order-1 lg:order-2 space-y-6 md:space-y-8">
         <div className="glass-panel p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-amber-500/20 shadow-2xl space-y-6 md:space-y-8">
            <div className="flex justify-center mb-2 md:mb-6">
               <img src={LOGO_URL} alt="LKC" className="h-12 md:h-16 opacity-40 grayscale" />
            </div>
            
            <div className="space-y-4">
               <h4 className="text-lg md:text-xl font-bold uppercase tracking-tighter">Session Summary</h4>
               <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div className="p-3 md:p-4 bg-zinc-900/50 rounded-xl md:rounded-2xl border border-zinc-800">
                     <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest block mb-1">Date</span>
                     <span className="text-xs md:text-sm font-bold uppercase">{new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                  </div>
                  <div className="p-3 md:p-4 bg-zinc-900/50 rounded-xl md:rounded-2xl border border-zinc-800">
                     <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest block mb-1">Starts</span>
                     <span className="text-xs md:text-sm font-bold font-mono">{time}</span>
                  </div>
                  <div className="p-3 md:p-4 bg-zinc-900/50 rounded-xl md:rounded-2xl border border-zinc-800">
                     <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest block mb-1">Guests</span>
                     <span className="text-xs md:text-sm font-bold uppercase truncate">{getGuestLabel(guests)}</span>
                  </div>
                  <div className="p-3 md:p-4 bg-zinc-900/50 rounded-xl md:rounded-2xl border border-zinc-800">
                     <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest block mb-1">Duration</span>
                     <span className="text-xs md:text-sm font-bold uppercase">{totalDuration}h Session</span>
                  </div>
               </div>
            </div>

            <div className="border-y border-zinc-800 py-4 md:py-6 space-y-3">
               <div className="flex justify-between text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <span>Room Hire (2h)</span>
                  <span className="font-mono">£{pricing.baseTotal}</span>
               </div>
               {pricing.extrasPrice > 0 && (
                 <div className="flex justify-between text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-amber-500">
                    <span>Additional Time (+{extraHours}h)</span>
                    <span className="font-mono">+£{pricing.extrasPrice}</span>
                 </div>
               )}
               {pricing.discountAmount > 0 && (
                 <div className="flex justify-between text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-green-500">
                    <span>Midweek Discount</span>
                    <span className="font-mono">-£{pricing.discountAmount}</span>
                 </div>
               )}
               {extrasTotal > 0 && (
                 <div className="flex justify-between text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-amber-500">
                    <span>Extras & Add-ons</span>
                    <span className="font-mono">+£{extrasTotal}</span>
                 </div>
               )}
            </div>

            {store.settings.deposit_enabled ? (
               <div className="space-y-4">
                  <div className="flex justify-between items-baseline pt-2">
                     <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500">Grand Total</span>
                     <span className="text-2xl md:text-3xl font-bold text-zinc-400 tracking-tighter line-through">£{pricing.totalPrice + extrasTotal}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                     <div>
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-amber-500">Deposit Due Today</span>
                        <p className="text-[8px] text-zinc-500 uppercase font-bold mt-1">Deducted from your final bill at the venue.</p>
                     </div>
                     <span className="text-3xl font-bold text-white tracking-tighter">£{store.settings.deposit_amount}</span>
                  </div>
               </div>
            ) : (
               <div className="flex justify-between items-baseline pt-2">
                  <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500">Total Payable</span>
                  <span className="text-4xl md:text-5xl font-bold text-white tracking-tighter">£{pricing.totalPrice + extrasTotal}</span>
               </div>
            )}
         </div>
         
         <p className="text-center text-[8px] md:text-[9px] text-zinc-600 uppercase tracking-widest leading-relaxed px-4">
            By booking, you agree to our 24h cancellation policy and 18+ venue age restriction. {store.settings.deposit_enabled && "Deposits are non-refundable inside the 24h window."}
         </p>
      </div>
    </div>
  );
}
