
"use client";

import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from '../pages/Home';
import Results from '../pages/Results';
import Checkout from '../pages/Checkout';
import Confirmation from '../pages/Confirmation';
import Admin from '../pages/Admin';
import ManageBooking from '../pages/ManageBooking';
import { WHATSAPP_URL, LOGO_URL } from '../constants';

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-panel h-16 flex items-center justify-between px-4 sm:px-10">
      <Link to="/" className="flex items-center gap-3">
        <img src={LOGO_URL} alt="LKC" className="h-8 w-auto" />
        <span className="text-sm font-bold tracking-tighter text-white uppercase hidden sm:inline">London <span className="text-amber-500">Karaoke</span> Club</span>
      </Link>
      <nav className="flex items-center gap-8 text-[10px] font-bold uppercase tracking-widest">
        <Link to="/" className="hover:text-amber-500 transition-colors">Book Now</Link>
        <Link to="/admin" className="hover:text-amber-500 transition-colors opacity-50">Admin</Link>
      </nav>
    </header>
  );
}

function FloatingWhatsApp() {
  const location = useLocation();
  if (location.pathname.startsWith("/admin")) return null;

  return (
    <a href={WHATSAPP_URL} target="_blank" className="fixed bottom-8 right-8 z-[60] flex items-center gap-3 bg-[#25D366] hover:scale-110 active:scale-95 transition-all text-white p-4 sm:px-6 sm:py-4 rounded-full shadow-2xl">
      <i className="fa-brands fa-whatsapp text-2xl"></i>
      <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-[0.2em]">Live Support</span>
    </a>
  );
}

function MainApp() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <HashRouter>
      <div className="min-h-screen bg-zinc-950 text-zinc-50 pt-16 font-['Outfit']">
        <Header />
        <main className="w-full">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/book/results" element={<Results />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/confirmation" element={<Confirmation />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="/m/:token" element={<ManageBooking />} />
          </Routes>
        </main>
        
        <footer className="bg-zinc-950 border-t border-zinc-900 py-16 px-4 sm:px-10 mt-20">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
            <div className="space-y-4">
               <img src={LOGO_URL} alt="LKC" className="h-8 opacity-40 grayscale" />
               <p className="text-zinc-600 text-xs max-w-xs leading-relaxed uppercase font-bold tracking-widest">Premium nightlife for groups of 8 to 100 in the heart of the city.</p>
            </div>
            <div className="grid grid-cols-2 gap-20">
               <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Discover</h4>
                  <ul className="text-xs space-y-2 text-zinc-500 uppercase font-bold tracking-tighter">
                     <li><Link to="/">Book Room</Link></li>
                     <li><a href="#">Packages</a></li>
                     <li><a href="#">Catering</a></li>
                  </ul>
               </div>
               <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Company</h4>
                  <ul className="text-xs space-y-2 text-zinc-500 uppercase font-bold tracking-tighter">
                     <li><Link to="/admin">Staff Console</Link></li>
                     <li><a href="#">Terms</a></li>
                     <li><a href="#">Privacy</a></li>
                  </ul>
               </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto border-t border-zinc-900 mt-16 pt-8 text-[9px] text-zinc-700 uppercase tracking-widest font-bold">
            &copy; {new Date().getFullYear()} London Karaoke Club. Professional Standards Only.
          </div>
        </footer>
        <FloatingWhatsApp />
      </div>
    </HashRouter>
  );
}

export default function Page() {
  return <MainApp />;
}
