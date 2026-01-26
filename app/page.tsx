"use client";

import React, { useState, useEffect } from 'react';
import Home from '@/pages/Home';
import Results from '@/pages/Results';
import Checkout from '@/pages/Checkout';
import Confirmation from '@/pages/Confirmation';
import Admin from '@/pages/Admin';
import ManageBooking from '@/pages/ManageBooking';
import { WHATSAPP_URL, LOGO_URL } from '@/constants';
import { RouterContext, RouteState } from '@/lib/routerShim';

function Header({ navigate }: { navigate: (p: string) => void }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-panel h-16 flex items-center justify-between px-4 sm:px-10">
      <button onClick={() => navigate('/')} className="flex items-center gap-3 bg-transparent border-none cursor-pointer">
        <img src={LOGO_URL} alt="LKC" className="h-8 w-auto" />
        <span className="text-sm font-bold tracking-tighter text-white uppercase hidden sm:inline">
          London <span className="text-amber-500">Karaoke</span> Club
        </span>
      </button>
      <nav className="flex items-center gap-8 text-[10px] font-bold uppercase tracking-widest">
        <button onClick={() => navigate('/')} className="bg-transparent border-none cursor-pointer text-white hover:text-amber-500 transition-colors uppercase">Book Now</button>
        <button onClick={() => navigate('/admin')} className="bg-transparent border-none cursor-pointer text-white hover:text-amber-500 transition-colors opacity-50 uppercase">Admin</button>
      </nav>
    </header>
  );
}

function FloatingWhatsApp({ currentPath }: { currentPath: string }) {
  if (currentPath.startsWith("/admin")) return null;

  return (
    <a href={WHATSAPP_URL} target="_blank" className="fixed bottom-8 right-8 z-[60] flex items-center gap-3 bg-[#25D366] hover:scale-110 active:scale-95 transition-all text-white p-4 sm:px-6 sm:py-4 rounded-full shadow-2xl no-underline">
      <i className="fa-brands fa-whatsapp text-2xl"></i>
      <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-[0.2em]">Live Support</span>
    </a>
  );
}

export default function Page() {
  const [route, setRoute] = useState<RouteState>({ path: '/', params: new URLSearchParams() });
  const [history, setHistory] = useState<RouteState[]>([]);

  useEffect(() => {
    // Basic support for browser back button
    const handlePopState = () => {
      const url = new URL(window.location.href);
      setRoute({ path: url.pathname || '/', params: url.searchParams });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (pathWithQuery: string) => {
    const [path, query] = pathWithQuery.split('?');
    const params = new URLSearchParams(query || '');
    
    setHistory(prev => [...prev, route]);
    setRoute({ path, params });
    
    // Update browser URL silently
    window.history.pushState({}, '', pathWithQuery);
    window.scrollTo(0, 0);
  };

  const back = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(prevH => prevH.slice(0, -1));
      setRoute(prev);
      window.history.replaceState({}, '', prev.path + (prev.params.toString() ? `?${prev.params.toString()}` : ''));
    } else {
      navigate('/');
    }
  };

  const renderContent = () => {
    const { path } = route;

    if (path === '/') return <Home />;
    if (path === '/book/results') return <Results />;
    if (path === '/checkout') return <Checkout />;
    if (path === '/confirmation') return <Confirmation />;
    if (path === '/admin') return <Admin />;
    if (path.startsWith('/m/')) {
        // Handle token from path /m/token
        return <ManageBooking />;
    }

    return <Home />;
  };

  return (
    <RouterContext.Provider value={{ route, navigate, back }}>
      <div className="min-h-screen bg-zinc-950 text-zinc-50 pt-16 font-sans">
        <Header navigate={navigate} />
        <main className="w-full">
          {renderContent()}
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
                  <ul className="text-xs space-y-2 text-zinc-500 uppercase font-bold tracking-tighter list-none p-0">
                     <li><button onClick={() => navigate('/')} className="bg-transparent border-none cursor-pointer text-zinc-500 hover:text-white uppercase font-bold tracking-tighter text-xs">Book Room</button></li>
                     <li><a href="#" className="no-underline text-inherit">Packages</a></li>
                     <li><a href="#" className="no-underline text-inherit">Catering</a></li>
                  </ul>
               </div>
               <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Company</h4>
                  <ul className="text-xs space-y-2 text-zinc-500 uppercase font-bold tracking-tighter list-none p-0">
                     <li><button onClick={() => navigate('/admin')} className="bg-transparent border-none cursor-pointer text-zinc-500 hover:text-white uppercase font-bold tracking-tighter text-xs">Staff Console</button></li>
                     <li><a href="#" className="no-underline text-inherit">Terms</a></li>
                     <li><a href="#" className="no-underline text-inherit">Privacy</a></li>
                  </ul>
               </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto border-t border-zinc-900 mt-16 pt-8 text-[9px] text-zinc-700 uppercase tracking-widest font-bold">
            &copy; {new Date().getFullYear()} London Karaoke Club. Professional Standards Only.
          </div>
        </footer>
        <FloatingWhatsApp currentPath={route.path} />
      </div>
    </RouterContext.Provider>
  );
}