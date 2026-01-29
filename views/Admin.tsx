
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';
import {
  Booking,
  BookingStatus,
  Room,
  DayOperatingHours,
  RoomBlock,
  RecurringBlock,
  PromoCode,
  Service,
  StaffMember,
  Customer,
  WaitlistEntry,
  Extra
} from '../types';
import { ROOMS, LOGO_URL, PRICING_TIERS, EXTRAS, SLOT_MINUTES, BUFFER_MINUTES } from '../constants';

type Tab = 'bookings' | 'customers' | 'blocks' | 'settings' | 'reports';
type ViewMode = 'day' | 'week' | 'month';

export default function Admin() {
  const store = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('bookings');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState({ email: '', password: '' });

  const allowedEmails = useMemo(
    () => (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
    []
  );

  const isAllowed = useMemo(() => {
    if (!session?.user?.email) return false;
    if (allowedEmails.length === 0) return true;
    return allowedEmails.includes(session.user.email.toLowerCase());
  }, [allowedEmails, session?.user?.email]);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password
    });
    if (error) {
      setAuthError(error.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  useEffect(() => {
    const config = store.getCalendarSyncConfig();
    if (!config.enabled || store.loading) return;

    const pushSnapshot = async () => {
      try {
        const payload = {
          token: config.token,
          includeCustomerName: config.includeCustomerName,
          includeBlocks: config.includeBlocks,
          includePending: config.includePending,
          bookings: store.bookings,
          blocks: store.blocks,
          recurringBlocks: store.recurringBlocks,
          rooms: store.rooms,
          updatedAt: new Date().toISOString()
        };

        const res = await fetch("/.netlify/functions/calendar-snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          setLastSyncTime(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.warn("Sync failed (possibly local mode):", err);
      }
    };
    pushSnapshot();
  }, [
    store.bookings,
    store.blocks,
    store.recurringBlocks,
    store.rooms,
    store.getCalendarSyncConfig().enabled,
    store.getCalendarSyncConfig().includeCustomerName,
    store.getCalendarSyncConfig().includeBlocks,
    store.getCalendarSyncConfig().includePending,
    store.getCalendarSyncConfig().token,
    store.loading
  ]);

  if (authLoading) {
    return <div className="p-20 text-center font-bold animate-pulse text-zinc-500 uppercase tracking-widest text-xs">Checking Admin Session...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="glass-panel p-8 md:p-10 rounded-[2rem] border-zinc-800 max-w-md w-full space-y-6 shadow-2xl">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold uppercase tracking-tighter text-white">Admin Sign In</h1>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Authorised staff only</p>
          </div>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Email</label>
              <input
                type="email"
                required
                value={credentials.email}
                onChange={(event) => setCredentials(prev => ({ ...prev, email: event.target.value }))}
                className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white outline-none focus:ring-1 ring-amber-500 shadow-inner"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Password</label>
              <input
                type="password"
                required
                value={credentials.password}
                onChange={(event) => setCredentials(prev => ({ ...prev, password: event.target.value }))}
                className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white outline-none focus:ring-1 ring-amber-500 shadow-inner"
              />
            </div>
          </div>
          {authError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-red-200 text-center">
              {authError}
            </div>
          )}
          <button type="submit" className="w-full gold-gradient text-black py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-amber-500/10 active:scale-95 transition-transform">
            Sign In
          </button>
        </form>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-panel p-8 md:p-10 rounded-[2rem] border-red-500/30 max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 mx-auto">
            <i className="fa-solid fa-ban text-2xl text-red-400"></i>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold uppercase tracking-tighter">Access Denied</h1>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Your account is not authorised to access the admin console.</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full bg-zinc-900 border border-zinc-800 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (store.loading) return <div className="p-20 text-center font-bold animate-pulse text-zinc-500 uppercase tracking-widest text-xs">Initialising Admin Console...</div>;

  return (
    <div className="min-h-screen pb-20 px-4 pt-8 md:max-w-7xl md:mx-auto">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
        <div className="flex items-center gap-6">
          <img src={LOGO_URL} alt="Logo" className="h-10 opacity-60" />
          <div>
            <h2 className="text-3xl font-bold uppercase tracking-tighter text-white">Console</h2>
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-[9px]">LKC Private Operations</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 w-full lg:w-auto">
          <nav className="flex bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800 w-full lg:w-auto overflow-x-auto no-scrollbar shadow-2xl">
            {(['bookings', 'customers', 'blocks', 'settings', 'reports'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap min-h-[44px] ${activeTab === t ? 'bg-amber-500 text-black' : 'text-zinc-500 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-[9px] uppercase tracking-widest text-zinc-500">
            <span>{session.user.email}</span>
            <button
              onClick={handleSignOut}
              className="bg-zinc-900 border border-zinc-800 py-2 px-4 rounded-full text-[9px] font-bold uppercase tracking-widest text-zinc-300 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="animate-in fade-in duration-500">
        {activeTab === 'bookings' && <BookingsTab store={store} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />}
        {activeTab === 'customers' && <CustomersTab store={store} />}
        {activeTab === 'blocks' && <BlocksTab store={store} selectedDate={selectedDate} />}
        {activeTab === 'settings' && <SettingsTab store={store} lastSyncTime={lastSyncTime} />}
        {activeTab === 'reports' && <ReportsTab store={store} />}
      </div>
    </div>
  );
}

function AdminModal({ open, title, body, canApply, onApply, onCancel, applyLabel = "Apply" }: { open: boolean, title: string, body: string, canApply: boolean, onApply: () => void, onCancel: () => void, applyLabel?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onCancel}></div>
      <div className="relative glass-panel p-8 rounded-3xl border-zinc-800 max-w-sm w-full animate-in zoom-in-95 duration-200 shadow-2xl">
        <h3 className="text-lg font-bold uppercase tracking-tighter text-white mb-2">{title}</h3>
        <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest leading-relaxed mb-8">{body}</p>
        <div className="flex gap-4">
          <button onClick={onCancel} className="flex-1 bg-zinc-900 border border-zinc-800 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest min-h-[48px]">Cancel</button>
          {canApply && (
            <button onClick={onApply} className="flex-1 gold-gradient text-black py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest min-h-[48px]">{applyLabel}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function BookingsTab({ store, selectedDate, setSelectedDate }: { store: any, selectedDate: string, setSelectedDate: (d: string) => void }) {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [prefill, setPrefill] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean, title: string, body: string, canApply: boolean, onApply: () => void } | null>(null);

  const isClosed = !store.getOperatingWindow(selectedDate);
  const isPastDay = new Date(selectedDate).getTime() < new Date().setHours(0, 0, 0, 0);

  const handleEdit = (id: string) => {
    const b = store.bookings.find((b: Booking) => b.id === id);
    if (b) {
      setEditingBooking(b);
      setPrefill(null);
      setShowManualModal(true);
    }
  };

  const handleTapToCreate = (data: { date: string, roomId?: string, time?: string }) => {
    setEditingBooking(null);
    setPrefill(data);
    setShowManualModal(true);
  };

  const handleCommitChange = (booking: Booking, patch: any, skipConfirm = false) => {
    const timeChanged = patch.start_at || patch.end_at;
    const roomChanged = patch.room_id && patch.room_id !== booking.room_id;

    const commit = async () => {
      await store.updateBooking(booking.id, patch);
      setConfirmModal(null);
    };

    if (!skipConfirm && booking.status === BookingStatus.CONFIRMED && (timeChanged || roomChanged)) {
      setConfirmModal({
        open: true,
        title: "Confirm Reschedule",
        body: `This booking for ${booking.customer_name} is already confirmed. Are you sure you want to modify the slot?`,
        canApply: true,
        onApply: commit
      });
    } else {
      commit();
    }
  };

  const onValidationFailure = (reason: string) => {
    setConfirmModal({
      open: true,
      title: "Conflict Detected",
      body: reason || "This slot is unavailable due to an existing booking, block, or venue operating hours.",
      canApply: false,
      onApply: () => { }
    });
  };

  return (
    <div className="glass-panel p-4 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] border-zinc-800 shadow-2xl overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-10 gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 w-full md:w-auto overflow-x-auto no-scrollbar">
            <button onClick={() => setViewMode('day')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all min-h-[40px] ${viewMode === 'day' ? 'bg-amber-500 text-black' : 'text-zinc-500'}`}>Day</button>
            <button onClick={() => setViewMode('week')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all min-h-[40px] ${viewMode === 'week' ? 'bg-amber-500 text-black' : 'text-zinc-500'}`}>Week</button>
            <button onClick={() => setViewMode('month')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all min-h-[40px] ${viewMode === 'month' ? 'bg-amber-500 text-black' : 'text-zinc-500'}`}>Month</button>
          </div>
          {(viewMode === 'day' || viewMode === 'week') && (
            <div className="flex items-center gap-4">
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-amber-500 font-bold text-xl outline-none cursor-pointer focus:ring-1 ring-amber-500/20 rounded-lg px-2 min-h-[44px]"
              />
              {isClosed && viewMode === 'day' && <span className="text-[9px] bg-red-500/10 text-red-500 px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-red-500/20">Closed</span>}
            </div>
          )}
        </div>
        {viewMode === 'day' && !isClosed && !isPastDay && (
          <button
            onClick={() => { setEditingBooking(null); setPrefill(null); setShowManualModal(true); }}
            className="gold-gradient text-black w-full sm:w-auto px-8 py-4 rounded-xl text-[9px] font-bold uppercase tracking-widest shadow-xl shadow-amber-500/10 active:scale-95 transition-transform min-h-[48px]"
          >
            Add Booking
          </button>
        )}
      </div>

      {viewMode === 'day' ? (
        <div className="space-y-12">
          <div className="overflow-x-hidden -mx-4">
            <TimelineView
              store={store}
              date={selectedDate}
              onSelectBooking={handleEdit}
              onTapToCreate={handleTapToCreate}
              onCommitChange={handleCommitChange}
              onValidationFailure={onValidationFailure}
            />
          </div>

          <div className="border-t border-zinc-900 pt-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6 px-2">Booking Registry</h3>
              <CompactBookingList store={store} date={selectedDate} onSelect={handleEdit} />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6 px-2">Waitlist</h3>
              <WaitlistListing store={store} date={selectedDate} />
            </div>
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <WeekView store={store} selectedDate={selectedDate} onSelectDay={(d) => { setSelectedDate(d); setViewMode('day'); }} onTapEmpty={handleTapToCreate} />
      ) : (
        <MonthCalendar store={store} onSelectDay={(d) => { setSelectedDate(d); setViewMode('day'); }} />
      )}

      {showManualModal && (
        <BookingModal
          store={store}
          onClose={() => { setShowManualModal(false); setEditingBooking(null); setPrefill(null); }}
          initialDate={selectedDate}
          booking={editingBooking || undefined}
          prefill={prefill}
        />
      )}

      {confirmModal && (
        <AdminModal
          open={confirmModal.open}
          title={confirmModal.title}
          body={confirmModal.body}
          canApply={confirmModal.canApply}
          onApply={confirmModal.onApply}
          onCancel={() => setConfirmModal(null)}
          applyLabel="Confirm"
        />
      )}
    </div>
  );
}

function WaitlistListing({ store, date }: { store: any, date: string }) {
  const list = store.getWaitlistForDate(date);

  if (list.length === 0) return <p className="text-[10px] text-zinc-700 uppercase tracking-[0.2em] italic px-2">No waitlist entries for this day.</p>;

  return (
    <div className="space-y-4">
      {list.map((w: WaitlistEntry) => (
        <div key={w.id} className="p-5 bg-zinc-900/30 border border-zinc-800 rounded-2xl flex flex-col gap-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-white uppercase">{w.name}</p>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{w.phone}</p>
            </div>
            <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded border ${w.status === 'active' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
              w.status === 'contacted' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'
              }`}>
              {w.status}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
              {w.guests} Guests {w.preferredTime ? `• ${w.preferredTime}` : ''}
            </div>
            <div className="flex gap-4">
              <button onClick={async () => await store.setWaitlistStatus(w.id, w.status === 'active' ? 'contacted' : 'closed')} className="text-zinc-500 hover:text-white transition-colors p-2" title="Update Status"><i className="fa-solid fa-check"></i></button>
              <a href={store.buildWhatsAppUrl(store.buildWaitlistMessage(w))} target="_blank" className="text-green-500 hover:text-green-400 transition-colors p-2" title="WhatsApp Concierge"><i className="fa-brands fa-whatsapp"></i></a>
              <button onClick={async () => await store.deleteWaitlistEntry(w.id)} className="text-zinc-700 hover:text-red-500 transition-colors p-2" title="Delete"><i className="fa-solid fa-trash"></i></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WeekView({ store, selectedDate, onSelectDay, onTapEmpty }: { store: any, selectedDate: string, onSelectDay: (d: string) => void, onTapEmpty: (data: any) => void }) {
  const weekData = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const monday = new Date(d.setDate(diff));

    const arr: { ds: string, day: number, dayName: string, confirmed: number, pending: number, blocks: number, isClosed: boolean, isPast: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);
      const ds = current.toISOString().split('T')[0];
      const dayBookings = store.getBookingsForDate(ds);
      const dayBlocks = store.getBlocksForDate(ds);
      const confirmed = dayBookings.filter((b: any) => b.status === BookingStatus.CONFIRMED).length;
      const pending = dayBookings.filter((b: any) => b.status === BookingStatus.PENDING).length;
      const isClosed = !store.getOperatingWindow(ds);
      const isPast = current.getTime() < new Date().setHours(0, 0, 0, 0);
      arr.push({ ds, day: current.getDate(), dayName: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][current.getDay()], confirmed, pending, blocks: dayBlocks.length, isClosed, isPast });
    }
    return arr;
  }, [selectedDate, store.bookings, store.blocks, store.specialHours]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-7 gap-px bg-zinc-900 border border-zinc-900 rounded-[1.5rem] overflow-hidden">
      {weekData.map((d, i) => (
        <div key={i} className={`h-48 p-4 flex flex-col justify-between transition-all ${d.isClosed ? 'bg-zinc-950/40 text-zinc-800' : 'bg-zinc-950 hover:bg-zinc-900 cursor-pointer'}`} onClick={() => onSelectDay(d.ds)}>
          <div className="flex justify-between items-start">
            <div>
              <p className={`text-[8px] font-bold uppercase tracking-widest ${d.isClosed ? 'opacity-20' : 'text-zinc-500'}`}>{d.dayName}</p>
              <p className={`text-lg font-bold ${d.isClosed ? 'opacity-20' : 'text-white'}`}>{d.day}</p>
            </div>
            {d.isClosed && <span className="text-[7px] font-bold uppercase tracking-widest bg-red-500/10 text-red-500 px-1 rounded border border-red-500/20">CLOSED</span>}
          </div>

          <div className="space-y-1.5">
            {!d.isClosed && !d.isPast && d.confirmed === 0 && d.pending === 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onTapEmpty({ date: d.ds }); }}
                className="w-full border border-dashed border-zinc-800 py-2.5 rounded-lg text-[7px] font-bold uppercase text-zinc-700 hover:text-amber-500 hover:border-amber-500/20 transition-all min-h-[40px]"
              >
                Add
              </button>
            )}
            {d.confirmed > 0 && <div className="bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-1 rounded text-[8px] font-bold flex justify-between"><span>CONF</span> <span>{d.confirmed}</span></div>}
            {d.pending > 0 && <div className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded text-[8px] font-bold flex justify-between"><span>PEND</span> <span>{d.pending}</span></div>}
            {d.blocks > 0 && <div className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-1 rounded text-[8px] font-bold flex justify-between"><span>BLCK</span> <span>{d.blocks}</span></div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompactBookingList({ store, date, onSelect }: { store: any, date: string, onSelect: (id: string) => void }) {
  const dayBookings = useMemo(() => {
    return store.bookings.filter((b: Booking) => b.start_at.startsWith(date))
      .sort((a: Booking, b: Booking) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [store.bookings, date]);

  if (dayBookings.length === 0) return <p className="text-[10px] text-zinc-700 uppercase tracking-[0.2em] italic px-2">No bookings registered.</p>;

  return (
    <div className="space-y-3 px-1">
      {dayBookings.map((b: Booking) => (
        <div
          key={b.id}
          onClick={() => onSelect(b.id)}
          className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 bg-zinc-900/30 border border-zinc-900 rounded-2xl hover:border-zinc-700 transition-all cursor-pointer group gap-4 shadow-sm active:scale-[0.98]"
        >
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 text-xs font-bold font-mono shadow-inner uppercase shrink-0">
              {b.room_name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white text-[12px] uppercase tracking-tight truncate">{b.customer_name}</p>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5 truncate">{b.customer_email}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 md:gap-10 w-full md:w-auto border-t md:border-t-0 border-zinc-800 md:pt-0 pt-4">
            <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 font-mono">
              {new Date(b.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(b.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className={`text-[8px] font-bold uppercase px-3 py-1 rounded-full border ${b.status === BookingStatus.CONFIRMED ? 'bg-green-500/10 text-green-500 border-green-500/20' :
              b.status === BookingStatus.CANCELLED ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                'bg-zinc-800 text-zinc-500 border-zinc-700'
              }`}>
              {b.status}
            </div>
            {(b.deposit_amount > 0 || (b.extras_total || 0) > 0) && (
              <div className={`text-[8px] font-bold uppercase px-3 py-1 rounded-full border border-zinc-700 text-zinc-500`}>
                {b.deposit_amount > 0 && `DEP: ${b.deposit_paid ? 'PAID' : 'PEND'}`}
                {b.extras_total ? ` • EXT: £${b.extras_total}` : ''}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthCalendar({ store, onSelectDay }: { store: any, onSelectDay: (d: string) => void }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: ({ ds: string; day: number; confirmed: number; pending: number; cancelled: number; isClosed: boolean } | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const ds = d.toISOString().split('T')[0];
      const dayBookings = store.bookings.filter((b: Booking) => b.start_at.startsWith(ds));
      const confirmed = dayBookings.filter((b: Booking) => b.status === BookingStatus.CONFIRMED).length;
      const pending = dayBookings.filter((b: Booking) => b.status === BookingStatus.PENDING).length;
      const cancelled = dayBookings.filter((b: Booking) => b.status === BookingStatus.CANCELLED).length;
      const isClosed = !store.getOperatingWindow(ds);

      days.push({ ds, day: i, confirmed, pending, cancelled, isClosed });
    }
    return days;
  }, [currentMonth, store.bookings]);

  const monthLabel = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4 md:mb-8 px-2 gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="text-zinc-500 hover:text-white p-3 min-h-[44px] min-w-[44px] flex items-center justify-center"><i className="fa-solid fa-chevron-left"></i></button>
          <h3 className="text-xl font-bold uppercase tracking-tighter text-amber-500 whitespace-nowrap">{monthLabel}</h3>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="text-zinc-500 hover:text-white p-3 min-h-[44px] min-w-[44px] flex items-center justify-center"><i className="fa-solid fa-chevron-right"></i></button>
        </div>
        <div className="flex gap-4 text-[8px] font-bold uppercase tracking-widest">
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span> Confirmed</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-600"></span> Pending</div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-zinc-900 border border-zinc-900 rounded-[1.5rem] overflow-hidden shadow-2xl">
        {["S", "M", "T", "W", "T", "F", "S"].map(d => (
          <div key={d} className="bg-zinc-950 py-3 md:py-4 text-center text-[9px] font-bold uppercase tracking-widest text-zinc-600">{d}</div>
        ))}
        {calendarData.map((d, i) => {
          if (!d) return <div key={i} className="bg-zinc-950/20 min-h-[80px] md:h-32"></div>;
          return (
            <div
              key={i}
              onClick={() => onSelectDay(d.ds)}
              className={`min-h-[90px] md:h-32 p-2 md:p-3 transition-all cursor-pointer flex flex-col justify-between border-t border-l border-zinc-900/40 ${d.isClosed ? 'bg-zinc-950/40 text-zinc-800' : 'bg-zinc-950 hover:bg-zinc-900 text-white'
                }`}
            >
              <span className={`text-[10px] font-bold ${d.isClosed ? 'opacity-20' : ''}`}>{d.day}</span>
              <div className="space-y-1">
                {d.confirmed > 0 && (
                  <div className="bg-green-500/10 text-green-500 border border-green-500/20 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-tight flex justify-between items-center">
                    <span className="hidden md:inline">CONF</span>
                    <span className="w-full text-center md:text-right">{d.confirmed}</span>
                  </div>
                )}
                {d.pending > 0 && (
                  <div className="bg-zinc-800 text-zinc-500 border border-zinc-700 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-tight flex justify-between items-center">
                    <span className="hidden md:inline">PEND</span>
                    <span className="w-full text-center md:text-right">{d.pending}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineView({ store, date, onSelectBooking, onTapToCreate, onCommitChange, onValidationFailure }: any) {
  const [rowHeight, setRowHeight] = useState(60);

  const window = store.getOperatingWindow(date);
  if (!window) return <div className="p-10 text-center text-zinc-600 uppercase font-bold tracking-widest">Venue Closed</div>;

  const startHour = parseInt(window.open.split(':')[0]);
  let endHour = parseInt(window.close.split(':')[0]);
  if (endHour <= startHour) endHour += 24;

  const hours: number[] = [];
  for (let h = startHour; h < endHour; h++) {
    hours.push(h);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-2xl font-bold uppercase tracking-tighter text-amber-500">{date}</h3>
        <div className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-xl border border-zinc-800">
          <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Vertical Zoom</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setRowHeight(h => Math.max(30, h - 10))} className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white">-</button>
            <button onClick={() => setRowHeight(h => Math.min(200, h + 10))} className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white">+</button>
          </div>
        </div>
      </div>

      <div className="relative border border-zinc-900 rounded-[2rem] overflow-hidden bg-zinc-950 flex shadow-2xl w-full">
        {/* Time Column */}
        <div className="w-16 shrink-0 border-r border-zinc-900 bg-zinc-900/40 z-20">
          <div className="h-24 border-b border-zinc-900"></div>
          {hours.map(h => (
            <div key={h} className="relative border-b border-zinc-800/50 flex items-start justify-center pt-2 text-[9px] font-mono text-zinc-600" style={{ height: rowHeight }}>
              {(h % 24).toString().padStart(2, '0')}:00
              {/* Half-hour marker line sidebar */}
              <div className="absolute top-1/2 left-0 right-0 border-t border-zinc-800/10 pointer-events-none"></div>
            </div>
          ))}
        </div>

        {/* Lanes Container - force 3 lanes on mobile via flex-1 min-w-0 */}
        <div className="flex-1 flex min-w-0">
          {store.rooms.map((r: Room) => (
            <div
              key={r.id}
              className="flex-1 border-r border-zinc-900 relative min-w-0"
            >
              <div className="h-24 border-b border-zinc-900 flex flex-col items-center justify-center p-1 text-center bg-zinc-900/20 overflow-hidden">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase text-white leading-tight break-words">
                  {r.name.toUpperCase()}
                </span>
              </div>

              <div className="relative" style={{ height: hours.length * rowHeight }}>
                {hours.map(h => (
                  <div key={h} className="relative border-b border-zinc-900/30 w-full" style={{ height: rowHeight }}>
                    {/* 30-minute marker line */}
                    <div className="absolute top-1/2 left-0 right-0 border-t border-zinc-800/40 h-0 pointer-events-none"></div>
                  </div>
                ))}

                <div
                  className="absolute inset-0 cursor-crosshair z-0"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const hourOffset = y / rowHeight;
                    const totalMins = Math.floor((startHour + hourOffset) * 60);
                    const h = Math.floor(totalMins / 60);
                    // Snap logic for 30-minute intervals
                    const m = Math.floor((totalMins % 60) / 30) * 30;
                    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    onTapToCreate({ date, roomId: r.id, time: timeStr });
                  }}
                ></div>

                {store.getBusyIntervals(date, r.id).map((item: any) => {
                  const dayStartTs = new Date(`${date}T${window.open}`).getTime();
                  const startOffsetHrs = (item.start - dayStartTs) / 3600000;
                  const durationHrs = (item.end - item.start) / 3600000;

                  return (
                    <div
                      key={item.id}
                      onClick={(e) => { e.stopPropagation(); if (item.type === 'booking') onSelectBooking(item.id); }}
                      className={`absolute left-0.5 right-0.5 rounded-lg border flex flex-col justify-center items-center px-0.5 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 shadow-lg overflow-hidden z-10 ${item.type === 'booking' ? (item.status === 'CONFIRMED' ? 'bg-amber-500 text-black border-amber-400' : 'bg-zinc-800 text-zinc-400 border-zinc-700') : 'bg-red-500/20 text-red-500 border-red-500/20 cursor-default'
                        }`}
                      style={{
                        top: startOffsetHrs * rowHeight,
                        height: durationHrs * rowHeight
                      }}
                    >
                      <span className="text-[7px] font-bold uppercase text-center line-clamp-2 leading-none">
                        {item.type === 'booking' ? `${item.customer_name} • ${item.guests} GUESTS` : (item.reason || 'Blocked')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomersTab({ store }: { store: any }) {
  const [search, setSearch] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showModal, setShowModal] = useState(false);

  const filtered = store.customers.filter((c: Customer) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  ).sort((a: Customer, b: Customer) => (b.lastBookingAt || 0) - (a.lastBookingAt || 0));

  const handleEdit = (c: Customer) => {
    setEditingCustomer(c);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingCustomer(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this customer record?")) {
      await store.deleteCustomer(id);
    }
  };

  return (
    <div className="glass-panel p-8 rounded-[2.5rem] border-zinc-800 shadow-2xl space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h3 className="text-xl font-bold uppercase tracking-tighter text-white">Guest CRM</h3>
          <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest">Customer database and history</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-3 text-sm text-white w-full max-w-sm outline-none focus:ring-1 ring-amber-500"
          />
          <button
            onClick={handleAdd}
            className="gold-gradient text-black px-6 py-3.5 rounded-xl text-[9px] font-bold uppercase tracking-widest shadow-lg shadow-amber-500/10 active:scale-95 transition-all whitespace-nowrap min-h-[44px]"
          >
            Add Guest
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((c: Customer) => (
          <div key={c.id} className="p-6 bg-zinc-950 border border-zinc-900 rounded-2xl space-y-4 hover:border-zinc-700 transition-all group shadow-lg relative">
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleEdit(c)} className="text-zinc-500 hover:text-white p-2" title="Edit Profile"><i className="fa-solid fa-pen-to-square"></i></button>
              <button onClick={() => handleDelete(c.id)} className="text-zinc-700 hover:text-red-500 p-2" title="Delete Profile"><i className="fa-solid fa-trash-can"></i></button>
            </div>
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-lg">
                {c.name.charAt(0)}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Spend</p>
                <p className="text-lg font-bold text-white tracking-tighter">£{c.totalSpend.toLocaleString()}</p>
              </div>
            </div>
            <div>
              <p className="font-bold text-white uppercase truncate pr-16">{c.name}</p>
              <p className="text-[10px] text-zinc-600 font-bold lowercase tracking-tight truncate">{c.email}</p>
            </div>
            <div className="pt-4 border-t border-zinc-900 flex justify-between items-center">
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{c.totalBookings} Bookings</span>
              {c.lastBookingAt && (
                <span className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest">Last: {new Date(c.lastBookingAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <CustomerModal
          store={store}
          onClose={() => setShowModal(false)}
          customer={editingCustomer || undefined}
        />
      )}
    </div>
  );
}

function CustomerModal({ store, onClose, customer }: { store: any, onClose: () => void, customer?: Customer }) {
  const [formData, setFormData] = useState({
    name: customer?.name || '',
    surname: customer?.surname || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    notes: customer?.notes || ''
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (customer) {
      store.updateCustomer(customer.id, formData);
    } else {
      store.addCustomer(formData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
      <form onSubmit={handleSave} className="relative w-full max-w-md glass-panel p-8 rounded-[2rem] border-zinc-800 shadow-2xl animate-in zoom-in duration-300 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold uppercase tracking-tight text-white">{customer ? 'Edit Profile' : 'New Guest'}</h3>
          <button type="button" onClick={onClose} className="text-zinc-600 hover:text-white p-2"><i className="fa-solid fa-x"></i></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">First Name</label>
              <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-3 text-white text-sm outline-none focus:ring-1 ring-amber-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Surname</label>
              <input type="text" value={formData.surname} onChange={e => setFormData({ ...formData, surname: e.target.value })} className="w-full bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-3 text-white text-sm outline-none focus:ring-1 ring-amber-500" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Email Address</label>
            <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-3 text-white text-sm outline-none focus:ring-1 ring-amber-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Phone Number</label>
            <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-3 text-white text-sm outline-none focus:ring-1 ring-amber-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Internal Notes</label>
            <textarea rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-3 text-white text-sm outline-none focus:ring-1 ring-amber-500 resize-none" />
          </div>
        </div>

        <div className="flex gap-4 pt-2">
          <button type="button" onClick={onClose} className="flex-1 bg-zinc-900 border border-zinc-800 py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white">Discard</button>
          <button type="submit" className="flex-1 gold-gradient text-black py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-amber-500/10">Save Guest</button>
        </div>
      </form>
    </div>
  );
}

function BlocksTab({ store, selectedDate }: { store: any, selectedDate: string }) {
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [newBlock, setNewBlock] = useState({ roomId: store.rooms[0]?.id, reason: '', start_at: `${selectedDate}T00:00`, end_at: `${selectedDate}T23:59` });

  const handleAddBlock = async () => {
    await store.addBlock(newBlock);
    setShowBlockModal(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <div className="glass-panel p-8 rounded-[2.5rem] border-zinc-800 shadow-2xl space-y-8">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold uppercase tracking-tighter text-white">One-Off Blocks</h3>
          <button onClick={() => setShowBlockModal(true)} className="bg-zinc-900 border border-zinc-800 text-amber-500 px-5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:border-amber-500 transition-all">Add Block</button>
        </div>
        <div className="space-y-3">
          {store.blocks.filter((b: RoomBlock) => b.start_at.startsWith(selectedDate)).map((b: RoomBlock) => (
            <div key={b.id} className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl flex justify-between items-center group">
              <div>
                <p className="text-xs font-bold text-white uppercase">{store.rooms.find((r: Room) => r.id === b.roomId)?.name}</p>
                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{b.reason || 'No reason'}</p>
              </div>
              <button onClick={async () => await store.deleteBlock(b.id)} className="text-zinc-800 hover:text-red-500 p-2"><i className="fa-solid fa-trash-can"></i></button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel p-8 rounded-[2.5rem] border-zinc-800 shadow-2xl space-y-8">
        <h3 className="text-xl font-bold uppercase tracking-tighter text-white">Recurring Blocks</h3>
        <div className="space-y-4">
          {store.recurringBlocks.map((rb: RecurringBlock) => (
            <div key={rb.id} className="p-5 bg-zinc-950 border border-zinc-900 rounded-2xl flex justify-between items-center group">
              <div className="flex items-center gap-4">
                <button onClick={async () => await store.toggleRecurringBlock(rb.id, !rb.enabled)} className={`w-12 h-6 rounded-full relative transition-all ${rb.enabled ? 'bg-amber-500' : 'bg-zinc-800'}`}>
                  <i className={`fa-solid ${rb.enabled ? 'fa-check' : 'fa-power-off'} text-xs`}></i>
                </button>
                <div>
                  <p className="text-xs font-bold text-white uppercase">{['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][rb.dayOfWeek]} • {rb.startTime}-{rb.endTime}</p>
                  <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{store.rooms.find((r: Room) => r.id === rb.roomId)?.name} {rb.reason ? `• ${rb.reason}` : ''}</p>
                </div>
              </div>
              <button onClick={async () => await store.deleteRecurringBlock(rb.id)} className="text-zinc-800 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-trash-can"></i></button>
            </div>
          ))}
        </div>
      </div>

      {showBlockModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowBlockModal(false)}></div>
          <div className="relative glass-panel p-8 rounded-[2rem] border-zinc-800 max-w-sm w-full space-y-6">
            <h4 className="text-lg font-bold uppercase text-white">Add Maintenance Block</h4>
            <div className="space-y-4">
              <select value={newBlock.roomId} onChange={e => setNewBlock({ ...newBlock, roomId: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white">
                {store.rooms.map((r: Room) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <input type="text" placeholder="Reason (e.g. Deep Clean)" value={newBlock.reason} onChange={e => setNewBlock({ ...newBlock, reason: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white" />
              <div className="grid grid-cols-2 gap-4">
                <input type="time" value={newBlock.start_at.split('T')[1]} onChange={e => setNewBlock({ ...newBlock, start_at: `${selectedDate}T${e.target.value}` })} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white" />
                <input type="time" value={newBlock.end_at.split('T')[1]} onChange={e => setNewBlock({ ...newBlock, end_at: `${selectedDate}T${e.target.value}` })} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white" />
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowBlockModal(false)} className="flex-1 py-4 bg-zinc-950 border border-zinc-900 rounded-xl text-[9px] font-bold uppercase tracking-widest">Cancel</button>
              <button onClick={handleAddBlock} className="flex-1 py-4 gold-gradient text-black rounded-xl text-[9px] font-bold uppercase tracking-widest">Apply Block</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsTab({ store, lastSyncTime }: { store: any, lastSyncTime: string | null }) {
  const [activeSub, setActiveSub] = useState('venue');
  const [showSaved, setShowSaved] = useState(false);

  const handleSettingChange = async (updateFn: () => Promise<void>) => {
    await updateFn();
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-10">
      <div className="lg:w-64 shrink-0 space-y-2 overflow-y-auto no-scrollbar max-h-[80vh]">
        {(['venue', 'hours', 'services', 'promos', 'extras', 'sync'] as const).map(s => (
          <button key={s} onClick={() => setActiveSub(s)} className={`w-full text-left px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeSub === s ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'}`}>
            {s} Configuration
          </button>
        ))}
      </div>

      <div className="flex-1 glass-panel p-8 rounded-[2.5rem] border-zinc-800 shadow-2xl overflow-y-auto no-scrollbar max-h-[80vh] relative">
        {showSaved && (
          <div className="absolute top-4 right-4 z-50 bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest animate-in fade-in slide-in-from-top-2 duration-300">
            <i className="fa-solid fa-check mr-2"></i>Saved
          </div>
        )}
        {activeSub === 'venue' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
            <h3 className="text-xl font-bold uppercase tracking-tighter text-white">General Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-1">Cancellation Cutoff (Hours)</label>
                <input type="number" value={store.settings.cancelCutoffHours} onChange={async e => { await store.updateSettings({ cancelCutoffHours: parseInt(e.target.value) }); setShowSaved(true); setTimeout(() => setShowSaved(false), 2000); }} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-1">Reschedule Cutoff (Hours)</label>
                <input type="number" value={store.settings.rescheduleCutoffHours} onChange={async e => { await store.updateSettings({ rescheduleCutoffHours: parseInt(e.target.value) }); setShowSaved(true); setTimeout(() => setShowSaved(false), 2000); }} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white" />
              </div>
              <div className="p-6 bg-zinc-950 border border-zinc-900 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white uppercase">Require Deposit</p>
                  <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest mt-1">Guests must pay to confirm</p>
                </div>
                <button onClick={async () => { await store.updateSettings({ deposit_enabled: !store.settings.deposit_enabled }); setShowSaved(true); setTimeout(() => setShowSaved(false), 2000); }} className={`w-12 h-6 rounded-full relative transition-all ${store.settings.deposit_enabled ? 'bg-amber-500' : 'bg-zinc-800'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${store.settings.deposit_enabled ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
              {store.settings.deposit_enabled && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-1">Deposit Amount (£)</label>
                  <input type="number" value={store.settings.deposit_amount} onChange={async e => { await store.updateSettings({ deposit_amount: parseInt(e.target.value) }); setShowSaved(true); setTimeout(() => setShowSaved(false), 2000); }} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white" />
                </div>
              )}

              {/* Lead Time Settings */}
              <div className="space-y-2 border-t border-zinc-900 pt-6 md:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Lead Time Controls</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-1">Min Days Lead Time</label>
                    <input type="number" min="0" value={store.settings.minDaysBeforeBooking} onChange={async e => await store.updateSettings({ minDaysBeforeBooking: Math.max(0, parseInt(e.target.value)) })} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-1">Min Hours Lead Time</label>
                    <input type="number" min="0" value={store.settings.minHoursBeforeBooking} onChange={async e => await store.updateSettings({ minHoursBeforeBooking: Math.max(0, parseInt(e.target.value)) })} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSub === 'hours' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
            <h3 className="text-xl font-bold uppercase tracking-tighter text-white">Operating Hours</h3>
            <div className="space-y-4">
              {store.operatingHours.map((oh: DayOperatingHours) => (
                <div key={oh.day} className="p-6 bg-zinc-950 border border-zinc-900 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex items-center gap-4">
                    <button onClick={async () => await store.updateOperatingHours(oh.day, { enabled: !oh.enabled })} className={`w-12 h-6 rounded-full relative transition-all ${oh.enabled ? 'bg-amber-500' : 'bg-zinc-800'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${oh.enabled ? 'left-7' : 'left-1'}`}></div>
                    </button>
                    <span className="text-xs font-bold uppercase tracking-widest text-white w-24">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][oh.day]}</span>
                  </div>
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <input type="time" disabled={!oh.enabled} value={oh.open} onChange={async e => await store.updateOperatingHours(oh.day, { open: e.target.value })} className="flex-1 md:flex-none bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white font-mono text-sm disabled:opacity-20" />
                    <span className="text-zinc-700">to</span>
                    <input type="time" disabled={!oh.enabled} value={oh.close} onChange={async e => await store.updateOperatingHours(oh.day, { close: e.target.value })} className="flex-1 md:flex-none bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white font-mono text-sm disabled:opacity-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSub === 'services' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold uppercase tracking-tighter text-white">Booking Services</h3>
              <button onClick={async () => await store.addService({ name: 'New Service', durationMinutes: 120, basePrice: 0 })} className="bg-zinc-900 border border-zinc-800 text-amber-500 px-5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest">Add Service</button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {store.services.map((s: Service) => (
                <div key={s.id} className="p-6 bg-zinc-950 border border-zinc-900 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-1 flex-1 w-full">
                    <input type="text" value={s.name} onChange={async e => await store.updateService(s.id, { name: e.target.value })} className="w-full bg-transparent border-none text-white font-bold uppercase text-sm outline-none focus:text-amber-500" />
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{s.durationMinutes} Minutes Experience</p>
                  </div>
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Mins:</span>
                      <input type="number" step="15" value={s.durationMinutes} onChange={async e => await store.updateService(s.id, { durationMinutes: parseInt(e.target.value) })} className="bg-transparent border-none text-white font-mono text-xs w-16 outline-none" />
                    </div>
                    <button onClick={async () => await store.deleteService(s.id)} className="text-zinc-800 hover:text-red-500 p-2"><i className="fa-solid fa-trash-can"></i></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSub === 'extras' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold uppercase tracking-tighter text-white">Service Extras</h3>
              <button onClick={async () => await store.addExtra({ name: 'New Extra', price: 0, pricingMode: 'flat' })} className="bg-zinc-900 border border-zinc-800 text-amber-500 px-5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest">Add Extra</button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {store.extras.map((e: Extra) => (
                <div key={e.id} className="p-6 bg-zinc-950 border border-zinc-900 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex-1 space-y-2 w-full">
                    <input type="text" value={e.name} onChange={async val => await store.updateExtra(e.id, { name: val.target.value })} className="w-full bg-transparent border-none text-white font-bold uppercase text-sm outline-none focus:text-amber-500" />
                    <div className="flex gap-4">
                      <button onClick={async () => await store.updateExtra(e.id, { pricingMode: 'flat' })} className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded border ${e.pricingMode === 'flat' ? 'bg-amber-500 text-black border-amber-400' : 'bg-zinc-900 text-zinc-600 border-zinc-800'}`}>Flat Rate</button>
                      <button onClick={async () => await store.updateExtra(e.id, { pricingMode: 'per_person' })} className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded border ${e.pricingMode === 'per_person' ? 'bg-amber-500 text-black border-amber-400' : 'bg-zinc-900 text-zinc-600 border-zinc-800'}`}>Per Person</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">£:</span>
                      <input type="number" value={e.price} onChange={async val => await store.updateExtra(e.id, { price: parseInt(val.target.value) })} className="bg-transparent border-none text-white font-mono text-xs w-16 outline-none" />
                    </div>
                    <button onClick={async () => await store.updateExtra(e.id, { enabled: !e.enabled })} className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${e.enabled ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-zinc-900 border-zinc-800 text-zinc-800'}`}>
                      <i className={`fa-solid ${e.enabled ? 'fa-eye' : 'fa-eye-slash'} text-[10px]`}></i>
                    </button>
                    <button onClick={async () => await store.deleteExtra(e.id)} className="text-zinc-800 hover:text-red-500 p-2"><i className="fa-solid fa-trash-can"></i></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSub === 'sync' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold uppercase tracking-tighter text-white">External Calendar Sync</h3>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Connect LKC to Google, Apple or Outlook</p>
              </div>
              {lastSyncTime && <span className="text-[8px] bg-green-500/10 text-green-500 px-3 py-1 rounded-full font-bold uppercase tracking-[0.2em] border border-green-500/20">Last Sync: {lastSyncTime}</span>}
            </div>

            <div className="p-8 bg-zinc-950 border border-zinc-900 rounded-[2rem] space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <span className="text-xs font-bold uppercase tracking-widest">Enable Live iCal Feed</span>
                <button onClick={() => store.setCalendarSyncConfig({ enabled: !store.getCalendarSyncConfig().enabled })} className={`w-12 h-6 rounded-full relative transition-all ${store.getCalendarSyncConfig().enabled ? 'bg-amber-500' : 'bg-zinc-800'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${store.getCalendarSyncConfig().enabled ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              {store.getCalendarSyncConfig().enabled && (
                <div className="space-y-6 animate-in slide-in-from-bottom-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-1">Feed Subscription URL</label>
                    <div className="flex gap-2">
                      <input readOnly value={`${window.location.origin}/.netlify/functions/calendar-ics?token=${store.getCalendarSyncConfig().token}`} className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white font-mono text-xs select-all" />
                      <button onClick={() => store.regenerateCalendarToken()} className="px-4 bg-zinc-800 rounded-xl text-zinc-400 hover:text-white"><i className="fa-solid fa-rotate"></i></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSub === 'promos' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold uppercase tracking-tighter text-white">Promo Codes</h3>
              <button onClick={() => store.addPromoCode({ code: 'NEWCODE', enabled: true, startDate: new Date().toISOString().split('T')[0], endDate: '2025-12-31', percentOff: 10, uses: 0 })} className="bg-zinc-900 border border-zinc-800 text-amber-500 px-5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest">Create Promo</button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {store.promoCodes.map((p: PromoCode) => (
                <div key={p.id} className="p-6 bg-zinc-950 border border-zinc-900 rounded-2xl flex justify-between items-center shadow-lg group">
                  <div>
                    <div className="flex items-center gap-3">
                      <input type="text" value={p.code} onChange={e => store.updatePromoCode(p.id, { code: e.target.value.toUpperCase() })} className="bg-transparent border-none text-lg font-mono font-bold text-amber-500 uppercase outline-none focus:text-white" />
                      <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">{p.uses} Uses</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800">
                        <span className="text-[9px] text-zinc-600 font-bold">%:</span>
                        <input type="number" value={p.percentOff || 0} onChange={e => store.updatePromoCode(p.id, { percentOff: parseInt(e.target.value), fixedOff: undefined })} className="bg-transparent border-none text-white font-mono text-[10px] w-12 outline-none" />
                      </div>
                      <span className="text-zinc-800">or</span>
                      <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800">
                        <span className="text-[9px] text-zinc-600 font-bold">£:</span>
                        <input type="number" value={p.fixedOff || 0} onChange={e => store.updatePromoCode(p.id, { fixedOff: parseInt(e.target.value), percentOff: undefined })} className="bg-transparent border-none text-white font-mono text-[10px] w-12 outline-none" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <button onClick={() => store.updatePromoCode(p.id, { enabled: !p.enabled })} className={`px-4 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-widest border transition-all ${p.enabled ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                      {p.enabled ? 'Live' : 'Paused'}
                    </button>
                    <button onClick={() => store.deletePromoCode(p.id)} className="text-zinc-800 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"><i className="fa-solid fa-trash-can"></i></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportsTab({ store }: { store: any }) {
  const stats = useMemo(() => {
    const confirmed = store.bookings.filter((b: Booking) => b.status === BookingStatus.CONFIRMED);
    const revenue = confirmed.reduce((acc: number, b: Booking) => acc + (b.total_price || 0), 0);
    const guests = confirmed.reduce((acc: number, b: Booking) => acc + (b.guests || 0), 0);

    const revByMonth: Record<string, number> = {};
    confirmed.forEach((b: Booking) => {
      const month = new Date(b.start_at).toLocaleString('default', { month: 'short' });
      revByMonth[month] = (revByMonth[month] || 0) + (b.total_price || 0);
    });

    return { revenue, guestCount: guests, bookingCount: confirmed.length, revByMonth };
  }, [store.bookings]);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 shadow-2xl space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Gross Revenue</p>
          <p className="text-5xl font-bold text-white tracking-tighter">£{stats.revenue.toLocaleString()}</p>
        </div>
        <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 shadow-2xl space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Confirmed Sessions</p>
          <p className="text-5xl font-bold text-white tracking-tighter">{stats.bookingCount}</p>
        </div>
        <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 shadow-2xl space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Footfall</p>
          <p className="text-5xl font-bold text-white tracking-tighter">{stats.guestCount}</p>
        </div>
      </div>

      <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 shadow-2xl">
        <h3 className="text-xl font-bold uppercase tracking-tighter text-white mb-10">Revenue Performance</h3>
        <div className="h-64 flex items-end justify-between gap-4">
          {Object.entries(stats.revByMonth).map(([month, rev]) => (
            <div key={month} className="flex-1 flex flex-col items-center gap-4 group">
              <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-xl transition-all group-hover:bg-amber-500/30 relative" style={{ height: `${stats.revenue > 0 ? ((rev as number) / (stats.revenue as number)) * 100 : 0}%` }}>
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded text-[8px] font-mono text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">£{rev}</div>
              </div>
              <span className="text-[9px] font-bold uppercase text-zinc-600 group-hover:text-white transition-colors">{month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BookingModal({ store, onClose, initialDate, booking, prefill }: { store: any, onClose: () => void, initialDate: string, booking?: Booking, prefill?: any }) {
  const [formData, setFormData] = useState({
    name: booking?.customer_name || '',
    surname: booking?.customer_surname || '',
    email: booking?.customer_email || '',
    phone: booking?.customer_phone || '',
    date: booking ? new Date(booking.start_at).toISOString().split('T')[0] : (prefill?.date || initialDate),
    time: booking ? new Date(booking.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : (prefill?.time || '22:00'),
    duration: booking ? (new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 3600000 : 2,
    guests: booking?.guests || 8,
    roomId: booking?.room_id || (prefill?.roomId || 'room-a'),
    staffId: booking?.staff_id || '',
    serviceId: booking?.service_id || (store.services[0]?.id || ''),
    status: booking?.status || BookingStatus.CONFIRMED,
    notes: booking?.notes || '',
    deposit_paid: booking?.deposit_paid || false,
    deposit_forfeited: booking?.deposit_forfeited || false,
    deposit_amount: booking?.deposit_amount || (store.settings.deposit_enabled ? store.settings.deposit_amount : 0)
  });

  const isPastDay = new Date(formData.date).getTime() < new Date().setHours(0, 0, 0, 0);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPastDay) return;
    const startAt = new Date(`${formData.date}T${formData.time}`).toISOString();
    const endAt = new Date(new Date(startAt).getTime() + formData.duration * 3600000).toISOString();
    const check = store.validateInterval(formData.roomId, startAt, endAt, booking?.id, formData.staffId);
    if (!check.ok) { alert(check.reason); return; }
    const pricing = store.calculatePricing(formData.date, formData.guests, Math.max(0, formData.duration - 2));

    const basePatch = {
      customer_name: formData.name,
      customer_surname: formData.surname,
      customer_email: formData.email,
      customer_phone: formData.phone,
      start_at: startAt,
      end_at: endAt,
      guests: formData.guests,
      room_id: formData.roomId,
      room_name: ROOMS.find(r => r.id === formData.roomId)?.name || 'Room',
      staff_id: formData.staffId,
      service_id: formData.serviceId,
      status: formData.status,
      base_total: pricing.baseTotal,
      extras_hours: Math.max(0, formData.duration - 2),
      extras_price: pricing.extrasPrice,
      discount_amount: pricing.discountAmount,
      promo_discount_amount: pricing.promoDiscountAmount,
      total_price: pricing.totalPrice + (booking?.extras_total || 0),
      notes: formData.notes,
      deposit_paid: formData.deposit_paid,
      deposit_forfeited: formData.deposit_forfeited,
      deposit_amount: formData.deposit_amount
    };

    const commit = async () => {
      if (booking) {
        await store.updateBooking(booking.id, basePatch);
      } else {
        await store.addBooking({
          ...basePatch,
          created_at: new Date().toISOString(),
          source: 'admin'
        });
      }
      onClose();
    };
    commit();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
      <form onSubmit={handleSave} className="relative w-full max-w-lg glass-panel p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] border-zinc-800 shadow-2xl animate-in zoom-in duration-300 space-y-6 overflow-y-auto max-h-[90vh] no-scrollbar">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold uppercase tracking-tight text-white">{booking ? 'Manage' : 'Add'} Session</h3>
          <button type="button" onClick={onClose} className="text-zinc-600 hover:text-white p-2"><i className="fa-solid fa-x"></i></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">First Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Surname</label>
            <input type="text" value={formData.surname} onChange={e => setFormData({ ...formData, surname: e.target.value })} required className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Email</label>
            <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Phone</label>
            <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Start Date</label>
            <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Start Time</label>
            <input type="time" step="900" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white font-mono text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Length (Hours)</label>
            <select value={formData.duration} onChange={e => setFormData({ ...formData, duration: parseFloat(e.target.value) })} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner">
              {[2, 3, 4, 5, 6].map(h => <option key={h} value={h}>{h} Hours</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Guests</label>
            <input type="number" min="8" max="100" value={formData.guests} onChange={e => setFormData({ ...formData, guests: parseInt(e.target.value) })} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Room Allocation</label>
            <select value={formData.roomId} onChange={e => setFormData({ ...formData, roomId: e.target.value })} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner">
              {ROOMS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Status</label>
            <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as BookingStatus })} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner">
              <option value={BookingStatus.CONFIRMED}>Confirmed</option>
              <option value={BookingStatus.PENDING}>Pending Payment</option>
              <option value={BookingStatus.CANCELLED}>Cancelled</option>
              <option value={BookingStatus.NO_SHOW}>No Show</option>
            </select>
          </div>

          <div className="sm:col-span-2 border-t border-zinc-800 pt-6 mt-2 text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em]">
            Session Management Controls
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button type="button" onClick={onClose} className="flex-1 bg-zinc-900 border border-zinc-800 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest">Discard</button>
          <button type="submit" disabled={isPastDay} className="flex-1 gold-gradient text-black py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-amber-500/10 active:scale-95 transition-transform disabled:opacity-50">Save Session</button>
        </div>
      </form>
    </div>
  );
}
