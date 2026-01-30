"use client";

import React, { useState, useEffect } from 'react';
import Home from '@/views/Home';
import Results from '@/views/Results';
import Checkout from '@/views/Checkout';
import Confirmation from '@/views/Confirmation';
import Processing from '@/views/Processing';
import Cancelled from '@/views/Cancelled';
import Admin from '@/views/Admin';
import ManageBooking from '@/views/ManageBooking';
import { LOGO_URL } from '@/constants';
import { RouterContext, RouteState } from '@/lib/routerShim';
import { StoreProvider } from '@/store';

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
        <button onClick={() => navigate('/')} className="bg-transparent border-none cursor-pointer text-zinc-400 hover:text-amber-500 transition-colors uppercase">Book Now</button>
        <button onClick={() => navigate('/admin')} className="bg-transparent border-none cursor-pointer text-zinc-400 hover:text-amber-500 transition-colors uppercase">Admin</button>
      </nav>
    </header>
  );
}

export default function Page() {
  const [route, setRoute] = useState<RouteState>({ path: '/', params: new URLSearchParams() });
  const [history, setHistory] = useState<RouteState[]>([]);
  const isAdmin = route.path.startsWith('/admin');

  useEffect(() => {
    const syncRouteFromUrl = () => {
      const full = window.location.pathname + window.location.search;
      const cleaned = full.startsWith("#") ? full.slice(1) : full;
      const [rawPath, rawQuery = ""] = cleaned.split("?");
      const path = (rawPath || "/").replace(/\/+$/, "") || "/";
      const params = new URLSearchParams(rawQuery);
      setRoute({ path, params });
    };

    syncRouteFromUrl();
    window.addEventListener('popstate', syncRouteFromUrl);
    return () => window.removeEventListener('popstate', syncRouteFromUrl);
  }, []);

  const navigate = (pathWithQuery: string) => {
    const cleaned = pathWithQuery.startsWith("#") ? pathWithQuery.slice(1) : pathWithQuery;
    const [rawPath, rawQuery = ""] = cleaned.split("?");
    const path = (rawPath || "/").replace(/\/+$/, "") || "/";
    const params = new URLSearchParams(rawQuery);
    setHistory(prev => [...prev, route]);
    setRoute({ path, params });
    window.history.pushState({}, '', cleaned);
    window.scrollTo(0, 0);
  };

  const back = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(prevH => prevH.slice(0, -1));
      setRoute(prev);
      const queryString = prev.params.toString();
      const fullPath = prev.path + (queryString ? `?${queryString}` : '');
      window.history.replaceState({}, '', fullPath);
    } else {
      navigate('/');
    }
  };

  const renderContent = () => {
    const p = route.path;
    if (p === '/') return <Home />;
    if (p === '/book/results') return <Results />;
    if (p === '/checkout') return <Checkout />;
    if (p === '/confirmation') return <Confirmation />;
    if (p === '/booking/processing') return <Processing />;
    if (p === '/booking/confirmed') return <Confirmation />;
    if (p === '/booking/cancelled') return <Cancelled />;
    if (p === '/booking/failed') return <Cancelled />;
    if (p === '/admin' || p.startsWith('/admin')) return <Admin />;
    if (p.startsWith('/m/')) return <ManageBooking />;
    return <Home />;
  };

  return (
    <RouterContext.Provider value={{ route, navigate, back }}>
      <StoreProvider mode={isAdmin ? 'admin' : 'public'}>
        <div className="min-h-screen bg-zinc-950 text-zinc-50 pt-16 font-sans flex flex-col">
          <Header navigate={navigate} />

          <main className="w-full flex-grow relative">
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
                    <li><button onClick={() => navigate('/')} className="bg-transparent border-none cursor-pointer text-zinc-500 hover:text-white uppercase font-bold tracking-tighter text-xs text-left">Book Room</button></li>
                    <li><a href="#" className="no-underline text-inherit">Packages</a></li>
                    <li><a href="#" className="no-underline text-inherit">Catering</a></li>
                  </ul>
                </div>
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Company</h4>
                    <ul className="text-xs space-y-2 text-zinc-500 uppercase font-bold tracking-tighter list-none p-0">
                      <li><button onClick={() => navigate('/admin')} className="bg-transparent border-none cursor-pointer text-zinc-500 hover:text-white uppercase font-bold tracking-tighter text-xs text-left">Staff Console</button></li>
                      <li><a href="#" className="no-underline text-inherit">Terms</a></li>
                      <li><a href="#" className="no-underline text-inherit">Privacy</a></li>
                    </ul>
                  </div>
                  {!isAdmin && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Live Support</h4>
                      <ul className="text-xs space-y-2 text-zinc-500 uppercase font-bold tracking-tighter list-none p-0">
                        <li>
                          <a href="tel:+447761383514" className="no-underline text-inherit">
                            Call Support
                          </a>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="max-w-7xl mx-auto border-t border-zinc-900 mt-16 pt-8 text-[9px] text-zinc-700 uppercase tracking-widest font-bold">
              &copy; {new Date().getFullYear()} London Karaoke Club. V2.1-DB.
            </div>
          </footer>
        </div>
      </StoreProvider>
    </RouterContext.Provider>
  );
}
