"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouterShim } from '@/lib/routerShim';
import { useStore } from '@/store';
import { LOGO_URL, PRICING_TIERS, EXTRAS, getGuestLabel, WHATSAPP_URL } from '@/constants';

const getLocalDateString = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Home() {
  const { navigate } = useRouterShim();
  const store = useStore();
  
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(() => getLocalDateString(new Date()));
  const [guests, setGuests] = useState(8);
  const [extraHours, setExtraHours] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [lastTargetPath, setLastTargetPath] = useState('');

  // Correctly handle side-effect to select default service
  useEffect(() => {
    if (store.services.length > 0 && !serviceId) {
      const defaultService = store.services.find(s => s.enabled);
      if (defaultService) setServiceId(defaultService.id);
    }
  }, [store.services, serviceId]);

  const pricing = useMemo(() => store.calculatePricing(date, guests, extraHours, promoCode), [date, guests, extraHours, promoCode, store]);

  const handleSearch = (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setClickCount(prev => prev + 1);
    
    const searchParams = new URLSearchParams({
      serviceId,
      staffId,
      date,
      guests: guests.toString(),
      extraHours: extraHours.toString(),
      promo: promoCode
    });
    
    // Persist to localStorage for fallback recovery
    localStorage.setItem('lkc_search_date', date);
    localStorage.setItem('lkc_search_guests', guests.toString());
    localStorage.setItem('lkc_search_serviceId', serviceId);
    localStorage.setItem('lkc_search_staffId', staffId);

    const targetPath = `/book/results?${searchParams.toString()}`;
    setLastTargetPath(targetPath);
    console.log("Navigating to:", targetPath);
    
    // Explicitly call navigate from the shim
    navigate(targetPath);
  };

  const formattedDate = useMemo(() => {
    return new Date(date).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, [date]);

  return (
    <div className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden py-10">
      <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1496337589254-7e19d01ced44?auto=format&fit=crop&w=1920&q=80)' }}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"></div>
      </div>

      <div className="relative z-10 w-full px-4 md:max-w-4xl md:mx-auto text-center space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="space-y-4">
          <div className="flex justify-center mb-6">
             <img src={LOGO_URL} alt="LKC Logo" className="h-16 sm:h-20 md:h-28 drop-shadow-[0_0_30px_rgba(245,158,11,0.2)]" />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-8xl font-bold tracking-tighter text-white uppercase leading-none">
            Ultimate <span className="text-amber-500">Karaoke</span>
          </h1>
          <p className="text-sm md:text-2xl text-zinc-300 font-light max-w-2xl mx-auto uppercase tracking-widest">
            London's Premium Private Suites
          </p>
          {/* Debug Click Counter & Path */}
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest bg-black/50 inline-block px-3 py-1 rounded-full">
            Clicked: {clickCount} | Target: {lastTargetPath || 'None'}
          </div>
        </div>

        <form onSubmit={handleSearch} className="glass-panel p-5 sm:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl space-y-6 md:space-y-8 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
             <div className="flex flex-col text-left gap-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ml-1">Service Type</label>
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="bg-zinc-900/50 border-zinc-800 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 focus:ring-1 ring-amber-500 outline-none text-white w-full font-bold appearance-none shadow-inner min-h-[44px]">
                {store.services.filter(s => s.enabled).map(s => <option key={s.id} value={s.id} className="bg-zinc-950">{s.name}</option>)}
              </select>
            </div>

            {store.staff.length > 0 && (
               <div className="flex flex-col text-left gap-2">
               <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ml-1">Staff Preference (Optional)</label>
               <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="bg-zinc-900/50 border-zinc-800 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 focus:ring-1 ring-amber-500 outline-none text-white w-full font-bold appearance-none shadow-inner min-h-[44px]">
                 <option value="" className="bg-zinc-950">Any Available Concierge</option>
                 {store.staff.filter(s => s.enabled && (!serviceId || s.servicesOffered.includes(serviceId))).map(s => <option key={s.id} value={s.id} className="bg-zinc-950">{s.name}</option>)}
               </select>
               </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="flex flex-col text-left gap-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ml-1">Date</label>
              <div onClick={() => setShowDatePicker(true)} className="bg-zinc-900/50 border-zinc-800 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 cursor-pointer hover:border-amber-500 transition-all flex items-center justify-between text-white shadow-inner min-h-[44px]">
                <span className="font-bold text-sm">{formattedDate}</span>
                <i className="fa-solid fa-calendar-day text-amber-500 opacity-60"></i>
              </div>
            </div>
            
            <div className="flex flex-col text-left gap-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ml-1">Group Size</label>
              <select value={guests} onChange={(e) => setGuests(parseInt(e.target.value))} className="bg-zinc-900/50 border-zinc-800 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 focus:ring-1 ring-amber-500 outline-none text-white w-full font-bold appearance-none shadow-inner min-h-[44px]">
                {PRICING_TIERS.map(tier => <option key={tier.min} value={tier.min} className="bg-zinc-950">{getGuestLabel(tier.min)}</option>)}
              </select>
            </div>

            <div className="flex flex-col text-left gap-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ml-1">Session Length</label>
              <select value={extraHours} onChange={(e) => setExtraHours(parseInt(e.target.value))} className="bg-zinc-900/50 border-zinc-800 border rounded-xl md:rounded-2xl px-5 py-3.5 md:py-4 focus:ring-1 ring-amber-500 outline-none text-white w-full font-bold appearance-none shadow-inner min-h-[44px]">
                {EXTRAS.map(opt => <option key={opt.hours} value={opt.hours} className="bg-zinc-950">{2 + opt.hours} Hours {opt.price > 0 ? `(+£${opt.price})` : ''}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 pt-4">
             <div className="flex flex-col items-center md:items-start gap-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Live Quote</div>
                <div className="flex items-baseline gap-2">
                   <span className="text-4xl md:text-5xl font-bold text-white tracking-tighter">£{pricing.totalPrice}</span>
                   {pricing.discountAmount > 0 && <span className="text-green-500 font-bold text-[10px] uppercase tracking-widest">-25% Midweek</span>}
                </div>
             </div>
             <button type="submit" className="w-full md:w-auto gold-gradient hover:scale-[1.02] active:scale-95 transition-all text-black font-bold py-4 md:py-5 px-16 rounded-xl md:rounded-2xl shadow-xl shadow-amber-500/10 uppercase tracking-[0.2em] text-[10px] min-h-[44px] cursor-pointer">
                Search Availability
             </button>
          </div>
        </form>

        <div className="pt-4 md:pt-8 max-w-2xl mx-auto">
           <p className="text-zinc-500 text-[9px] md:text-[10px] uppercase font-bold tracking-[0.3em] mb-3 md:mb-4">Sold out online?</p>
           <a href={WHATSAPP_URL} target="_blank" className="inline-flex items-center gap-3 text-green-500 hover:text-green-400 font-bold uppercase tracking-widest text-[10px] md:text-xs transition-colors no-underline">
              <i className="fa-brands fa-whatsapp text-lg"></i>
              Contact our concierge for priority bookings
           </a>
        </div>
      </div>

      {showDatePicker && (
        <DatePickerModal selectedDate={date} onSelect={(d) => { setDate(d); setShowDatePicker(false); }} onClose={() => setShowDatePicker(false)} store={store} />
      )}
    </div>
  );
}

function DatePickerModal({ selectedDate, onSelect, onClose, store }: { selectedDate: string, onSelect: (d: string) => void, onClose: () => void, store: any }) {
  const [currentView, setCurrentView] = useState(new Date(selectedDate));
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const calendarDays = useMemo(() => {
    const year = currentView.getFullYear();
    const month = currentView.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [currentView]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-sm md:max-w-md glass-panel rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 animate-in zoom-in duration-300">
        <div className="flex items-center justify-between mb-6 md:mb-8">
           <button onClick={() => setCurrentView(new Date(currentView.setMonth(currentView.getMonth() - 1)))} className="bg-transparent border-none cursor-pointer text-zinc-500 hover:text-white p-2"><i className="fa-solid fa-chevron-left"></i></button>
           <h3 className="text-lg md:text-xl font-bold uppercase tracking-tighter text-amber-500">{monthNames[currentView.getMonth()]} {currentView.getFullYear()}</h3>
           <button onClick={() => setCurrentView(new Date(currentView.setMonth(currentView.getMonth() + 1)))} className="bg-transparent border-none cursor-pointer text-zinc-500 hover:text-white p-2"><i className="fa-solid fa-chevron-right"></i></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {daysOfWeek.map(d => <div key={d} className="text-[8px] font-bold text-zinc-600 text-center">{d}</div>)}
          {calendarDays.map((d, i) => {
            if (!d) return <div key={i}></div>;
            const ds = getLocalDateString(d);
            const isOpen = store.getOperatingWindow(ds);
            const isSelected = ds === selectedDate;
            return (
              <div key={i} onClick={() => isOpen && onSelect(ds)} className={`h-9 md:h-10 flex items-center justify-center rounded-lg md:rounded-xl text-xs font-bold cursor-pointer transition-all ${!isOpen ? 'opacity-20 cursor-not-allowed' : isSelected ? 'bg-amber-500 text-black' : 'hover:bg-zinc-800 text-zinc-300'}`}>
                {d.getDate()}
              </div>
            );
          })}
        </div>
        <button onClick={onClose} className="w-full mt-6 bg-zinc-900 border border-zinc-800 py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-widest min-h-[44px] cursor-pointer text-white">Close</button>
      </div>
    </div>
  );
}
