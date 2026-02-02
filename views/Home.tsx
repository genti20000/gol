"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouterShim } from '@/lib/routerShim';
import { useStore } from '@/store';
import { LOGO_URL, PRICING_TIERS, EXTRAS, getGuestLabel, WHATSAPP_URL } from '@/constants';

const formatDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const getMinBookingDateTime = (settings: { minDaysBeforeBooking?: number; minHoursBeforeBooking?: number }) => {
  const leadDays = settings.minDaysBeforeBooking || 0;
  const leadHours = settings.minHoursBeforeBooking || 0;
  const leadMs = (leadDays * 24 + leadHours) * 3600000;
  return new Date(Date.now() + leadMs);
};

export default function Home() {
  const { navigate } = useRouterShim();
  const store = useStore();

  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(formatDateKey(new Date()));
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

  useEffect(() => {
    const minDate = formatDateKey(getMinBookingDateTime(store.settings));
    if (date < minDate) {
      setDate(minDate);
    }
  }, [date, store.settings]);

  const pricing = useMemo(() => store.calculatePricing(date, guests, extraHours, promoCode), [date, guests, extraHours, promoCode, store]);
  const offers = useMemo(() => {
    const items: { id: string; title: string; description?: string }[] = [];
    if (store.settings.midweekDiscountPercent > 0) {
      items.push({
        id: 'midweek',
        title: 'Midweek Discount',
        description: `Save ${store.settings.midweekDiscountPercent}% Mon–Wed`
      });
    }
    (store.settings.offers || [])
      .filter(offer => offer.enabled)
      .forEach(offer => {
        let desc = offer.description;
        if (offer.woptions && offer.woptions.kind === 'percent' && typeof offer.woptions.value === 'number') {
          desc = `Save ${offer.woptions.value}%` + (desc ? ` • ${desc}` : '');
        } else if (offer.woptions && offer.woptions.kind === 'fixed' && typeof offer.woptions.value === 'number') {
          desc = `Save £${offer.woptions.value}` + (desc ? ` • ${desc}` : '');
        } else if (offer.woptions && offer.woptions.kind === 'midweek') {
          desc = desc || `Midweek offer`;
        }
        items.push({ id: offer.id, title: offer.title, description: desc });
      });
    return items;
  }, [store.settings.midweekDiscountPercent, store.settings.offers]);

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
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-black py-10">
      <div className="relative z-10 w-full px-4 md:max-w-4xl md:mx-auto text-center space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="space-y-4">
          <h1 className="flex flex-col text-center font-bold tracking-tighter uppercase leading-[0.8]">
            <span className="text-3xl sm:text-4xl md:text-6xl text-white">Ultimate</span>
            <span className="text-6xl sm:text-7xl md:text-9xl text-amber-500">Karaoke</span>
          </h1>
          <p className="text-[10px] md:text-sm text-zinc-400 font-medium max-w-2xl mx-auto uppercase tracking-[0.4em]">
            London's Premium Private Suites
          </p>
        </div>

        {offers.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 animate-in fade-in slide-in-from-top-4 duration-700">
            {offers.map((offer, index) => (
              <div
                key={offer.id}
                className="offer-pill bg-zinc-900/70 border border-zinc-800 text-white px-4 py-2 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-amber-500/10"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <span className="text-amber-500 mr-2">★</span>
                <span>{offer.title}</span>
                {offer.description && <span className="text-zinc-400 ml-2 font-medium normal-case tracking-normal">{offer.description}</span>}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSearch} className="glass-panel p-6 sm:p-10 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl space-y-6 md:space-y-10 text-sm">
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
                {pricing.discountAmount > 0 && <span className="text-green-500 font-bold text-[10px] uppercase tracking-widest ml-2">-{pricing.discountPercent}% Midweek</span>}
              </div>
            </div>
            <button type="submit" className="w-full md:w-auto gold-gradient hover:scale-[1.02] active:scale-95 transition-all text-black font-bold py-4 md:py-5 px-16 rounded-xl md:rounded-2xl shadow-xl shadow-amber-500/10 uppercase tracking-[0.2em] text-[10px] min-h-[44px] cursor-pointer">
              Search Availability
            </button>
          </div>
        </form>

        <div className="pt-8 md:pt-16 max-w-2xl mx-auto text-center">
          <p className="text-zinc-600 text-[9px] uppercase font-bold tracking-[0.3em] mb-4">Sold out online?</p>
          <a href={WHATSAPP_URL} target="_blank" className="inline-flex items-center gap-3 text-green-500 hover:text-green-400 font-bold uppercase tracking-[0.2em] text-[10px] transition-colors no-underline">
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
  const minDateKey = formatDateKey(getMinBookingDateTime(store.settings));

  const calendarDays = useMemo(() => {
    const year = currentView.getFullYear();
    const month = currentView.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];
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
            const ds = formatDateKey(d);
            const isOpen = store.getOperatingWindow(ds);
            const isPast = ds < minDateKey;
            const isSelected = ds === selectedDate;
            return (
              <div
                key={i}
                onClick={() => isOpen && !isPast && onSelect(ds)}
                className={`h-9 md:h-10 flex items-center justify-center rounded-lg md:rounded-xl text-xs font-bold cursor-pointer transition-all ${!isOpen || isPast ? 'opacity-20 cursor-not-allowed' : isSelected ? 'bg-amber-500 text-black' : 'hover:bg-zinc-800 text-zinc-300'}`}
              >
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
