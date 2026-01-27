"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/store';
import { useRouterShim } from '@/lib/routerShim';
import { PRICING_TIERS, EXTRAS, MIDWEEK_DISCOUNT_PERCENT, getGuestLabel, LOGO_URL } from '@/constants';

export default function Home() {
  const { navigate } = useRouterShim();
  const { services, getOperatingWindow } = useStore();
  const [guests, setGuests] = useState(8);
  const [extraHours, setExtraHours] = useState(0);
  const [serviceId, setServiceId] = useState('');

  const today = new Date();
  const [date, setDate] = useState(today.toISOString().split('T')[0]);

  useEffect(() => {
    if (services.length > 0 && !serviceId) {
      setServiceId(services[0].id);
    }
  }, [services, serviceId]);

  const pricing = useMemo(() => {
    const tier = PRICING_TIERS.find(t => guests >= t.min && guests <= t.max);
    const basePrice = tier ? tier.price : 0;
    const extraPrice = EXTRAS.find(e => e.hours === extraHours)?.price || 0;
    const subtotal = basePrice + extraPrice;

    const d = new Date(date + 'T00:00:00');
    const day = d.getDay();
    const isMidweek = day >= 1 && day <= 3;
    const discount = isMidweek ? Math.round(subtotal * (MIDWEEK_DISCOUNT_PERCENT / 100)) : 0;

    return { subtotal, discount, total: subtotal - discount, isMidweek };
  }, [guests, extraHours, date]);

  const days = useMemo(() => {
    const arr: { iso: string; label: string; }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const window = getOperatingWindow(iso);
      if (window) arr.push({ iso, label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) });
    }
    return arr;
  }, [getOperatingWindow]);

  const handleSearch = () => {
    navigate(`/book/results?serviceId=${serviceId}&date=${date}&guests=${guests}&extraHours=${extraHours}`);
  };

  return (
    <div className="relative min-h-screen">
      {/* Hero Background */}
      <div className="fixed inset-0 z-0 mask-edge-fade">
        <img
          src="/premium-hero.png"
          alt="LKC background"
          className="w-full h-full object-cover opacity-40 grayscale-[20%] brightness-[0.4]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/80 to-bg" />
      </div>

      <div className="relative z-10 pt-16 pb-32 px-4 sm:px-10 max-w-7xl mx-auto">
        <header className="mb-20 animate-fade-in-up">
          <div className="badge-luxury mb-4 inline-block">Ultimate Karaoke</div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 uppercase">
            London's Premium <br />
            <span className="gold-gradient-text">Private Suites</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl leading-relaxed">
            Experience the pinnacle of privacy and sound. Bespoke suites for groups of 8 to 100, featuring state-of-the-art acoustics and dedicated table service.
          </p>
        </header>

        <div className="grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="glass-panel rounded-2xl p-8 card-luxury">
              <div className="grid sm:grid-cols-2 gap-8">
                {/* Service Type */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Service Type</label>
                  <select
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="w-full h-14 px-4 input-luxury text-sm font-semibold"
                  >
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Date Selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Date</label>
                  <select
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-14 px-4 input-luxury text-sm font-semibold"
                  >
                    {days.map(d => <option key={d.iso} value={d.iso}>{d.label}</option>)}
                  </select>
                </div>

                {/* Group Size */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Group Size</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[8, 12, 16, 20, 30, 40, 50, 60, 80, 100].map(s => (
                      <button
                        key={s}
                        onClick={() => setGuests(s)}
                        className={`h-12 rounded-lg text-xs font-bold transition-all border ${guests === s
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                          : 'border-zinc-800 bg-black/40 text-zinc-500 hover:border-zinc-600'
                          }`}
                      >
                        {s === 100 ? '100+' : s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Session Length */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Session Length</label>
                  <div className="flex flex-col gap-2">
                    {EXTRAS.slice(0, 4).map(e => (
                      <button
                        key={e.hours}
                        onClick={() => setExtraHours(e.hours)}
                        className={`h-12 px-4 rounded-lg text-xs font-bold flex justify-between items-center transition-all border ${extraHours === e.hours
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                          : 'border-zinc-800 bg-black/40 text-zinc-500 hover:border-zinc-600'
                          }`}
                      >
                        <span>{e.hours + 2} Hours</span>
                        <span className="opacity-60">{e.price > 0 ? `+£${e.price}` : 'INCLUDED'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-8 pt-8 border-t border-zinc-900">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Live Quote</div>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-extrabold tracking-tighter">£{pricing.total}</span>
                    {pricing.discount > 0 && (
                      <span className="text-zinc-600 line-through text-lg font-bold mb-1">£{pricing.subtotal}</span>
                    )}
                    {pricing.isMidweek && (
                      <span className="badge-luxury bg-amber-500/10 text-amber-500 mb-1.5 backdrop-blur-sm">-{MIDWEEK_DISCOUNT_PERCENT}% Midweek</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleSearch}
                  className="w-full md:w-auto px-12 h-16 gold-gradient rounded-full font-bold uppercase tracking-widest text-xs gold-glow active:scale-95 transition-all text-black"
                >
                  Search Availability
                </button>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-8 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="glass-panel rounded-2xl p-8 card-luxury">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500 mb-6">Our Promise</h3>
              <ul className="space-y-6 list-none p-0 m-0">
                <li className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center shrink-0 border border-zinc-800">
                    <i className="fa-solid fa-microphone text-amber-500"></i>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold uppercase mb-1">Pro Audio</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">Shure microphones and bespoke acoustic treatment in every room.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center shrink-0 border border-zinc-800">
                    <i className="fa-solid fa-champagne-glasses text-amber-500"></i>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold uppercase mb-1">Concierge</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">Dedicated table service via our digital call system.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center shrink-0 border border-zinc-800">
                    <i className="fa-solid fa-shield-halved text-amber-500"></i>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold uppercase mb-1">Privacy</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">Completely private, sound-proof suites with independent access.</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="glass-panel rounded-2xl p-1 shadow-2xl overflow-hidden group">
              <div className="relative aspect-video rounded-xl overflow-hidden">
                <img src="/premium-hero.png" alt="Suite view" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Virtual Tour</p>
                  <p className="text-xs font-bold uppercase tracking-tighter">Explore the Terrace Suite</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}