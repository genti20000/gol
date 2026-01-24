
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../store';
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

  // Auto-sync logic: Push snapshot to Netlify whenever relevant data changes
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

    // Fire and forget push
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

  if (store.loading) return <div className="p-20 text-center font-bold animate-pulse text-zinc-500 uppercase tracking-widest">Initialising Admin Console...</div>;

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

        <nav className="flex bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800 w-full lg:w-auto overflow-x-auto no-scrollbar shadow-2xl">
          {(['bookings', 'customers', 'blocks', 'settings', 'reports'] as Tab[]).map(t => (
            <button 
              key={t} 
              onClick={() => setActiveTab(t)} 
              className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === t ? 'bg-amber-500 text-black' : 'text-zinc-500 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </nav>
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
      <div className="relative glass-panel p-8 rounded-3xl border-zinc-800 max-w-sm w-full animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold uppercase tracking-tighter text-white mb-2">{title}</h3>
        <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest leading-relaxed mb-8">{body}</p>
        <div className="flex gap-4">
          <button onClick={onCancel} className="flex-1 bg-zinc-900 border border-zinc-800 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest">Cancel</button>
          {canApply && (
            <button onClick={onApply} className="flex-1 gold-gradient text-black py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest">{applyLabel}</button>
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
  const isPastDay = new Date(selectedDate).getTime() < new Date().setHours(0,0,0,0);

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

    const commit = () => {
      store.updateBooking(booking.id, patch);
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
      onApply: () => {}
    });
  };

  return (
    <div className="glass-panel p-4 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] border-zinc-800 shadow-2xl overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
         <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
               <button onClick={() => setViewMode('day')} className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${viewMode === 'day' ? 'bg-amber-500 text-black' : 'text-zinc-500'}`}>Day</button>
               <button onClick={() => setViewMode('week')} className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${viewMode === 'week' ? 'bg-amber-500 text-black' : 'text-zinc-500'}`}>Week</button>
               <button onClick={() => setViewMode('month')} className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${viewMode === 'month' ? 'bg-amber-500 text-black' : 'text-zinc-500'}`}>Month</button>
            </div>
            {(viewMode === 'day' || viewMode === 'week') && (
              <div className="flex items-center gap-4">
                 <input 
                   type="date" 
                   value={selectedDate} 
                   onChange={e => setSelectedDate(e.target.value)} 
                   className="bg-transparent text-amber-500 font-bold text-xl outline-none cursor-pointer focus:ring-1 ring-amber-500/20 rounded-lg px-2" 
                 />
                 {isClosed && viewMode === 'day' && <span className="text-[9px] bg-red-500/10 text-red-500 px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-red-500/20">Closed</span>}
              </div>
            )}
         </div>
         {viewMode === 'day' && !isClosed && !isPastDay && (
           <button 
              onClick={() => { setEditingBooking(null); setPrefill(null); setShowManualModal(true); }} 
              className="gold-gradient text-black w-full sm:w-auto px-8 py-3.5 rounded-xl text-[9px] font-bold uppercase tracking-widest shadow-xl shadow-amber-500/10 active:scale-95 transition-transform"
           >
              Add Booking
           </button>
         )}
      </div>

      {viewMode === 'day' ? (
        <div className="space-y-12">
          <div className="overflow-x-auto no-scrollbar">
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
    <div className="space-y-3">
      {list.map((w: WaitlistEntry) => (
        <div key={w.id} className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl flex flex-col gap-4">
           <div className="flex justify-between items-start">
              <div>
                 <p className="text-[11px] font-bold text-white uppercase">{w.name}</p>
                 <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{w.phone}</p>
              </div>
              <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded border ${
                w.status === 'active' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                w.status === 'contacted' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'
              }`}>
                {w.status}
              </span>
           </div>
           <div className="flex justify-between items-center">
              <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                 {w.guests} Guests {w.preferredTime ? `• ${w.preferredTime}` : ''}
              </div>
              <div className="flex gap-2">
                 <button onClick={() => store.setWaitlistStatus(w.id, w.status === 'active' ? 'contacted' : 'closed')} className="text-zinc-500 hover:text-white transition-colors" title="Update Status"><i className="fa-solid fa-check"></i></button>
                 <a href={store.buildWhatsAppUrl(store.buildWaitlistMessage(w))} target="_blank" className="text-green-500 hover:text-green-400 transition-colors" title="WhatsApp Concierge"><i className="fa-brands fa-whatsapp"></i></a>
                 <button onClick={() => store.deleteWaitlistEntry(w.id)} className="text-zinc-700 hover:text-red-500 transition-colors" title="Delete"><i className="fa-solid fa-trash"></i></button>
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
    
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);
      const ds = current.toISOString().split('T')[0];
      const dayBookings = store.getBookingsForDate(ds);
      const dayBlocks = store.getBlocksForDate(ds);
      const confirmed = dayBookings.filter((b: any) => b.status === BookingStatus.CONFIRMED).length;
      const pending = dayBookings.filter((b: any) => b.status === BookingStatus.PENDING).length;
      const isClosed = !store.getOperatingWindow(ds);
      const isPast = current.getTime() < new Date().setHours(0,0,0,0);
      arr.push({ ds, day: current.getDate(), dayName: ['SUN','MON','TUE','WED','THU','FRI','SAT'][current.getDay()], confirmed, pending, blocks: dayBlocks.length, isClosed, isPast });
    }
    return arr;
  }, [selectedDate, store.bookings, store.blocks, store.specialHours]);

  return (
    <div className="grid grid-cols-7 gap-px bg-zinc-900 border border-zinc-900 rounded-[1.5rem] overflow-hidden">
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
                  className="w-full border border-dashed border-zinc-800 py-2 rounded-lg text-[7px] font-bold uppercase text-zinc-700 hover:text-amber-500 hover:border-amber-500/20 transition-all"
                >
                   Tap to add
                </button>
              )}
              {d.confirmed > 0 && <div className="bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded text-[8px] font-bold flex justify-between"><span>CONF</span> <span>{d.confirmed}</span></div>}
              {d.pending > 0 && <div className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded text-[8px] font-bold flex justify-between"><span>PEND</span> <span>{d.pending}</span></div>}
              {d.blocks > 0 && <div className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded text-[8px] font-bold flex justify-between"><span>BLCK</span> <span>{d.blocks}</span></div>}
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

  if (dayBookings.length === 0) return <p className="text-[10px] text-zinc-700 uppercase tracking-[0.2em] italic px-2">No bookings registered for this day.</p>;

  return (
    <div className="space-y-3">
      {dayBookings.map((b: Booking) => (
        <div 
          key={b.id} 
          onClick={() => onSelect(b.id)}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-zinc-900/30 border border-zinc-900 rounded-2xl hover:border-zinc-700 transition-all cursor-pointer group gap-4"
        >
          <div className="flex items-center gap-5">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 text-xs font-bold font-mono shadow-inner uppercase">
               {b.room_name.split(' ')[1] || b.room_name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-white text-[11px] uppercase tracking-tight">{b.customer_name}</p>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{b.customer_email}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 sm:gap-10 w-full sm:w-auto">
             <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
               {new Date(b.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(b.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
             </div>
             <div className={`text-[8px] font-bold uppercase px-3 py-1 rounded-full border ${
               b.status === BookingStatus.CONFIRMED ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
               b.status === BookingStatus.CANCELLED ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
               'bg-zinc-800 text-zinc-500 border-zinc-700'
             }`}>
               {b.status}
             </div>
             {(b.deposit_amount > 0 || (b.extras_total || 0) > 0) && (
                <div className={`text-[8px] font-bold uppercase px-3 py-1 rounded-full border border-zinc-700 text-zinc-500`}>
                  {b.deposit_amount > 0 && `DEP: ${b.deposit_paid ? 'PAID' : 'PEND'}`}
                  {b.extras_total && ` • EXT: £${b.extras_total}`}
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
    
    const days = [];
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
      <div className="flex items-center justify-between mb-8 px-2">
         <div className="flex items-center gap-4">
            <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="text-zinc-500 hover:text-white p-2"><i className="fa-solid fa-chevron-left"></i></button>
            <h3 className="text-xl font-bold uppercase tracking-tighter text-amber-500">{monthLabel}</h3>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="text-zinc-500 hover:text-white p-2"><i className="fa-solid fa-chevron-right"></i></button>
         </div>
         <div className="flex gap-4 text-[8px] font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> Confirmed</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-zinc-600"></span> Pending</div>
         </div>
      </div>
      
      <div className="grid grid-cols-7 gap-px bg-zinc-900 border border-zinc-900 rounded-[1.5rem] overflow-hidden">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="bg-zinc-950 p-4 text-center text-[9px] font-bold uppercase tracking-widest text-zinc-600">{d}</div>
        ))}
        {calendarData.map((d, i) => {
          if (!d) return <div key={i} className="bg-zinc-950/20 h-24 md:h-32"></div>;
          return (
            <div 
              key={i} 
              onClick={() => onSelectDay(d.ds)}
              className={`h-24 md:h-32 p-3 transition-all cursor-pointer flex flex-col justify-between ${
                d.isClosed ? 'bg-zinc-950/40 text-zinc-800' : 'bg-zinc-950 hover:bg-zinc-900 text-white'
              }`}
            >
              <span className={`text-[10px] font-bold ${d.isClosed ? 'opacity-20' : ''}`}>{d.day}</span>
              <div className="space-y-1">
                 {d.confirmed > 0 && (
                    <div className="bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-tight flex justify-between">
                       <span>CONF</span>
                       <span>{d.confirmed}</span>
                    </div>
                 )}
                 {d.pending > 0 && (
                    <div className="bg-zinc-800 text-zinc-500 border border-zinc-700 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-tight flex justify-between">
                       <span>PEND</span>
                       <span>{d.pending}</span>
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

interface DragState {
  id: string;
  mode: 'move' | 'resize';
  originalRoomId: string;
  originalStart: number;
  originalEnd: number;
  originalDuration: number;
  pointerStartX: number;
  pointerStartY: number;
  containerLeft: number;
  containerTop: number;
  containerWidth: number;
  containerHeight: number;
  currentRoomId: string;
  currentStart: number;
  currentEnd: number;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const distance = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.hypot(a.x - b.x, a.y - b.y);

function TimelineView({ store, date, onSelectBooking, onTapToCreate, onCommitChange, onValidationFailure }: { store: any, date: string, onSelectBooking: (id: string) => void, onTapToCreate: (data: any) => void, onCommitChange: (booking: Booking, patch: any) => void, onValidationFailure: (reason: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const windowConfig = store.getOperatingWindow(date) || { open: '15:00', close: '03:00' };
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [laneZoom, setLaneZoom] = useState<Record<string, number>>({});

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    active: boolean;
    roomId: string | null;
    startDist: number;
    startZoom: number;
  }>({ active: false, roomId: null, startDist: 0, startZoom: 1 });

  const getZoom = (roomId: string) => laneZoom[roomId] ?? 1;

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  
  const winStart = useMemo(() => new Date(`${date}T${windowConfig.open}`).getTime(), [date, windowConfig]);
  const winEnd = useMemo(() => {
    let e = new Date(`${date}T${windowConfig.close}`).getTime();
    if (e <= winStart) e += 86400000;
    return e;
  }, [date, windowConfig, winStart]);

  const totalDurationMins = (winEnd - winStart) / 60000;

  const timeMarkers = useMemo(() => {
    const arr = [];
    for (let m = 0; m <= totalDurationMins; m += 60) {
      const time = new Date(winStart + m * 60000);
      arr.push(`${time.getHours().toString().padStart(2, '0')}:00`);
    }
    return arr;
  }, [winStart, totalDurationMins]);

  const handlePointerDown = (e: React.PointerEvent, booking: Booking, mode: 'move' | 'resize') => {
    if (pointersRef.current.size >= 2) return;
    const isSunday = new Date(date).getDay() === 0;
    const isPast = new Date(booking.start_at).getTime() < Date.now();
    if (isSunday || isPast || !containerRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();

    const rect = containerRef.current.getBoundingClientRect();
    const labelWidth = isMobile ? 0 : 192;
    const containerLeft = rect.left + labelWidth;
    const containerTop = rect.top;
    const containerWidth = rect.width - labelWidth;
    
    const zoom = getZoom(booking.room_id);
    const containerHeight = isMobile ? (1200 * zoom) : rect.height;

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    setDragState({
      id: booking.id,
      mode,
      originalRoomId: booking.room_id,
      originalStart: new Date(booking.start_at).getTime(),
      originalEnd: new Date(booking.end_at).getTime(),
      originalDuration: new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime(),
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      containerLeft,
      containerTop,
      containerWidth,
      containerHeight,
      currentRoomId: booking.room_id,
      currentStart: new Date(booking.start_at).getTime(),
      currentEnd: new Date(booking.end_at).getTime()
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    const deltaX = e.clientX - dragState.pointerStartX;
    const deltaY = e.clientY - dragState.pointerStartY;
    const zoom = isMobile ? getZoom(dragState.currentRoomId) : 1;
    const currentFullHeight = isMobile ? (1200 * zoom) : dragState.containerHeight;
    const currentFullWidth = dragState.containerWidth;
    const minutesPerPx = totalDurationMins / (isMobile ? currentFullHeight : currentFullWidth);
    const deltaMins = (isMobile ? deltaY : deltaX) * minutesPerPx;
    const snap = 15;
    const snappedMins = Math.round(deltaMins / snap) * snap;
    const deltaMs = snappedMins * 60000;

    if (dragState.mode === 'move') {
      const newStart = Math.max(winStart, Math.min(winEnd - dragState.originalDuration, dragState.originalStart + deltaMs));
      const newEnd = newStart + dragState.originalDuration;
      let detectedRoomId = dragState.originalRoomId;
      const elementUnder = document.elementFromPoint(e.clientX, e.clientY);
      const laneContainer = elementUnder?.closest('[data-roomid]');
      if (laneContainer) {
        detectedRoomId = laneContainer.getAttribute('data-roomid') || detectedRoomId;
      }
      setDragState({ ...dragState, currentStart: newStart, currentEnd: newEnd, currentRoomId: detectedRoomId });
    } else if (dragState.mode === 'resize') {
      const minPossibleEnd = dragState.originalStart + 30 * 60000;
      const newEnd = Math.max(minPossibleEnd, Math.min(winEnd, dragState.originalEnd + deltaMs));
      setDragState({ ...dragState, currentEnd: newEnd });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState) return;
    const booking = store.bookings.find((b: any) => b.id === dragState.id);
    if (booking) {
      let finalStart = dragState.currentStart;
      let finalEnd = dragState.currentEnd;
      let finalRoomId = dragState.currentRoomId;
      let finalPatch: any = { room_id: finalRoomId, room_name: ROOMS.find(r => r.id === finalRoomId)?.name || 'Room' };
      if (dragState.mode === 'resize') {
        const rawHours = (finalEnd - finalStart) / 3600000;
        const durationHours = Math.max(2, Math.min(6, Math.round(rawHours)));
        finalEnd = finalStart + durationHours * 3600000;
        finalPatch.end_at = new Date(finalEnd).toISOString();
        finalPatch.extras_hours = durationHours - 2;
      } else {
        finalPatch.start_at = new Date(finalStart).toISOString();
        finalPatch.end_at = new Date(finalEnd).toISOString();
      }
      const validation = store.validateInterval(finalRoomId, new Date(finalStart).toISOString(), new Date(finalEnd).toISOString(), booking.id);
      if (!validation.ok) onValidationFailure(validation.reason);
      else onCommitChange(booking, finalPatch);
    }
    setDragState(null);
  };

  const handleLanePointerDown = (e: React.PointerEvent, roomId: string) => {
    if (dragState) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values()) as { x: number; y: number }[];
      pinchRef.current = { active: true, roomId, startDist: distance(pts[0], pts[1]), startZoom: getZoom(roomId) };
    }
  };

  const handleLanePointerMove = (e: React.PointerEvent, roomId: string) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchRef.current.active && pinchRef.current.roomId === roomId && pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values()) as { x: number; y: number }[];
      const d = distance(pts[0], pts[1]);
      const ratio = d / (pinchRef.current.startDist || 1);
      const next = clamp(pinchRef.current.startZoom * ratio, 0.6, 2.5);
      setLaneZoom((prev) => ({ ...prev, [roomId]: next }));
    }
  };

  const clearPointers = (id: number) => {
    pointersRef.current.delete(id);
    if (pointersRef.current.size < 2) {
      pinchRef.current.active = false;
      pinchRef.current.roomId = null;
    }
  };

  const handleLaneClick = (e: React.MouseEvent, roomId: string) => {
    if (dragState || pinchRef.current.active || new Date(date).getDay() === 0 || new Date(date).getTime() < new Date().setHours(0,0,0,0)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const zoom = isMobile ? getZoom(roomId) : 1;
    const clickY = e.clientY - rect.top + (e.currentTarget.scrollTop || 0);
    const contentHeight = isMobile ? (1200 * zoom) : rect.height;
    const minutesFromStart = (clickY / contentHeight) * totalDurationMins;
    const snappedMinutes = Math.round(minutesFromStart / 15) * 15;
    const dateObj = new Date(winStart + snappedMinutes * 60000);
    const timeStr = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
    onTapToCreate({ date, roomId, time: timeStr });
  };

  if (isMobile) {
    return (
      <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-10" ref={containerRef}>
        {ROOMS.map(room => {
          const dayBusy = store.getBusyIntervals(date, room.id);
          const zoom = getZoom(room.id);
          const contentHeight = 1200 * zoom;
          return (
            <div key={room.id} className="min-w-0 flex flex-col gap-2" data-roomid={room.id}>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
                 <span className="font-bold text-white uppercase text-[10px] tracking-widest">{room.name.split(' ')[1]}</span>
              </div>
              <div 
                className="h-[70vh] bg-zinc-950/40 rounded-[1.5rem] border border-zinc-900 relative overflow-y-auto no-scrollbar"
                style={{ touchAction: "pan-y" }}
                onPointerDown={(e) => handleLanePointerDown(e, room.id)}
                onPointerMove={(e) => handleLanePointerMove(e, room.id)}
                onPointerUp={(e) => clearPointers(e.pointerId)}
                onPointerCancel={(e) => clearPointers(e.pointerId)}
                onClick={(e) => handleLaneClick(e, room.id)}
              >
                <div className="relative" style={{ height: contentHeight }}>
                  <div className="absolute inset-0 pointer-events-none">
                    {timeMarkers.map(m => (
                       <div key={m} className="absolute w-full flex items-center border-t border-zinc-900/40" style={{ top: `${((new Date(`${date}T${m}`).getTime() - winStart) / (totalDurationMins * 60000)) * 100}%` }}>
                          <span className="text-[6px] font-mono font-bold text-zinc-800 pl-1">{m}</span>
                       </div>
                    ))}
                  </div>
                  {dayBusy.map((item: any, idx: number) => {
                    const isBeingDragged = dragState?.id === item.id;
                    if (item.type === 'booking') {
                      if (isBeingDragged && dragState.currentRoomId !== room.id) return null;
                      if (!isBeingDragged && item.room_id !== room.id) return null;
                    }
                    const displayStart = isBeingDragged ? dragState.currentStart : item.start;
                    const displayEnd = isBeingDragged ? dragState.currentEnd : item.end;
                    const startPct = ((displayStart - winStart) / (totalDurationMins * 60000)) * 100;
                    const endPct = ((displayEnd - winStart) / (totalDurationMins * 60000)) * 100;
                    const heightPct = Math.max(2, endPct - startPct);
                    const bookingObj = item.type === 'booking' ? store.bookings.find((b: any) => b.id === item.id) : null;
                    const canModify = bookingObj && (new Date(bookingObj.start_at).getTime() > Date.now()) && (new Date(date).getDay() !== 0);
                    return (
                      <div 
                        key={item.id || idx} 
                        onPointerDown={(e) => canModify && handlePointerDown(e, bookingObj, 'move')}
                        onPointerMove={isBeingDragged ? handlePointerMove : undefined}
                        onPointerUp={isBeingDragged ? handlePointerUp : undefined}
                        className={`absolute left-1 right-1 rounded-lg border flex flex-col items-center justify-center text-[7px] font-bold transition-shadow shadow-md z-20 group/item overflow-hidden ${
                          isBeingDragged ? 'z-50 ring-2 ring-amber-400/40 scale-[1.01] pointer-events-none' : ''
                        } ${
                          item.type === 'booking' 
                            ? item.status === BookingStatus.CONFIRMED ? 'bg-amber-500 text-black border-amber-400' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            : 'bg-red-500/20 text-red-500 border-red-500/40 opacity-60'
                        } ${canModify ? 'cursor-move' : 'cursor-default'}`} 
                        style={{ top: `${startPct}%`, height: `${heightPct}%`, pointerEvents: isBeingDragged ? 'none' : 'auto' }}
                      >
                         <span className="truncate uppercase tracking-tighter w-full text-center px-0.5">{item.type === 'booking' ? item.customer_name.split(' ')[0] : 'Block'}</span>
                         {canModify && (
                           <div onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, bookingObj, 'resize'); }} className="absolute bottom-0 left-0 w-full h-3 cursor-ns-resize opacity-60 hover:opacity-100 bg-black/10 flex items-center justify-center"><div className="w-4 h-0.5 bg-black/20 rounded-full"></div></div>
                         )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-w-[1200px] py-10 select-none" ref={containerRef}>
       <div className="flex border-b border-zinc-900 pb-4 mb-8">
          <div className="w-48"></div>
          <div className="flex-1 flex justify-between px-6">
             {timeMarkers.map(m => <span key={m} className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest">{m}</span>)}
          </div>
       </div>
       <div className="space-y-12">
          {ROOMS.map(room => {
             const dayBusy = store.getBusyIntervals(date, room.id);
             return (
               <div key={room.id} className="flex items-center" data-roomid={room.id}>
                  <div className="w-48 pr-8">
                     <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl shadow-lg">
                        <span className="block text-sm font-bold text-white uppercase">{room.name}</span>
                        <span className="block text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Cap: {room.max_capacity}</span>
                     </div>
                  </div>
                  <div className="flex-1 h-20 bg-zinc-950/40 rounded-[2rem] border border-zinc-900 relative overflow-hidden group" onClick={(e) => handleLaneClick(e, room.id)}>
                     <div className="absolute inset-0 flex justify-between px-6 pointer-events-none">
                        {timeMarkers.map(m => <div key={m} className="w-px h-full bg-zinc-900/40"></div>)}
                     </div>
                     {dayBusy.map((item: any, idx: number) => {
                        const isBeingDragged = dragState?.id === item.id;
                        if (item.type === 'booking') {
                          if (isBeingDragged && dragState.currentRoomId !== room.id) return null;
                          if (!isBeingDragged && item.room_id !== room.id) return null;
                        }
                        const displayStart = isBeingDragged ? dragState.currentStart : item.start;
                        const displayEnd = isBeingDragged ? dragState.currentEnd : item.end;
                        const startPct = ((displayStart - winStart) / (totalDurationMins * 60000)) * 100;
                        const endPct = ((displayEnd - winStart) / (totalDurationMins * 60000)) * 100;
                        const widthPct = Math.max(2, endPct - startPct);
                        const bookingObj = item.type === 'booking' ? store.bookings.find((b: any) => b.id === item.id) : null;
                        const canModify = bookingObj && (new Date(bookingObj.start_at).getTime() > Date.now()) && (new Date(date).getDay() !== 0);
                        return (
                          <div 
                            key={item.id || idx} 
                            onPointerDown={(e) => canModify && handlePointerDown(e, bookingObj, 'move')}
                            onPointerMove={isBeingDragged ? handlePointerMove : undefined}
                            onPointerUp={isBeingDragged ? handlePointerUp : undefined}
                            className={`absolute top-2 bottom-2 rounded-xl border flex flex-col items-center justify-center text-[9px] font-bold px-3 transition-shadow shadow-xl z-20 group/item overflow-hidden ${
                              isBeingDragged ? 'z-50 ring-2 ring-amber-400/40 scale-[1.01] pointer-events-none' : ''
                            } ${
                              item.type === 'booking' 
                                ? item.status === BookingStatus.CONFIRMED ? 'bg-amber-500 text-black border-amber-400' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                : 'bg-red-500/20 text-red-500 border-red-500/40 opacity-60'
                            } ${canModify ? 'cursor-move' : 'cursor-default'}`} 
                            style={{ left: `${startPct}%`, width: `${widthPct}%`, pointerEvents: isBeingDragged ? 'none' : 'auto' }}
                          >
                             <span className="truncate uppercase tracking-tighter w-full text-center">{item.type === 'booking' ? item.customer_name : (item.reason || 'Blocked')}</span>
                             {item.type === 'booking' && <span className="text-[7px] opacity-60 font-mono">{Math.round((displayEnd - displayStart) / 3600000)}h session</span>}
                             <div className="absolute inset-0 opacity-0" onDoubleClick={(e) => { e.stopPropagation(); onSelectBooking(item.id); }}></div>
                             {canModify && (
                               <div onPointerDown={(e) => handlePointerDown(e, bookingObj, 'resize')} className="absolute right-0 top-0 h-full w-2 cursor-ew-resize opacity-60 hover:opacity-100 bg-black/10 transition-opacity flex items-center justify-center"><div className="w-0.5 h-4 bg-black/20 rounded-full"></div></div>
                             )}
                          </div>
                        );
                     })}
                  </div>
               </div>
             );
          })}
       </div>
    </div>
  );
}

function CustomersTab({ store }: { store: any }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'spend' | 'bookings' | 'recency'>('recency');
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const filtered = useMemo(() => {
    let list = [...store.customers];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c: Customer) => 
        c.name.toLowerCase().includes(s) || 
        c.email.toLowerCase().includes(s) || 
        c.phone?.includes(s)
      );
    }
    
    list.sort((a, b) => {
      if (sortBy === 'spend') return b.totalSpend - a.totalSpend;
      if (sortBy === 'bookings') return b.totalBookings - a.totalBookings;
      if (sortBy === 'recency') return (b.lastBookingAt || 0) - (a.lastBookingAt || 0);
      return 0;
    });
    
    return list;
  }, [store.customers, search, sortBy]);

  const clientBookings = useMemo(() => {
    if (!selectedClient) return [];
    return store.bookings.filter((b: Booking) => b.customer_email.toLowerCase() === selectedClient.email.toLowerCase());
  }, [selectedClient, store.bookings]);

  const handleUpdateNotes = (notes: string) => {
      if (selectedClient) {
          store.upsertCustomer({ email: selectedClient.email, notes });
      }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 glass-panel p-10 rounded-[2.5rem] border-zinc-800 space-y-8 h-fit">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold uppercase tracking-tight text-white">Client CRM</h3>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all"
                >
                    Add Client
                </button>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
               <div className="relative flex-1">
                  <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 text-xs"></i>
                  <input 
                    type="text" 
                    placeholder="Search client..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-[9px] text-white uppercase font-bold tracking-widest outline-none focus:ring-1 ring-amber-500 w-full sm:w-64 shadow-inner" 
                  />
               </div>
               <select 
                 value={sortBy} 
                 onChange={e => setSortBy(e.target.value as any)}
                 className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-[9px] text-white uppercase font-bold tracking-widest outline-none focus:ring-1 ring-amber-500 shadow-inner"
               >
                 <option value="recency">Most Recent</option>
                 <option value="spend">Highest Spend</option>
                 <option value="bookings">Most Bookings</option>
               </select>
            </div>
         </div>
         <div className="space-y-4 max-h-[600px] overflow-y-auto no-scrollbar pr-2">
           {filtered.map((c: Customer) => (
              <div 
                key={c.id} 
                onClick={() => setSelectedClient(c)}
                className={`p-6 bg-zinc-900/30 border rounded-3xl flex justify-between items-center group cursor-pointer transition-all ${selectedClient?.email === c.email ? 'border-amber-500/50 bg-amber-500/5' : 'border-zinc-800 hover:border-zinc-700'}`}
              >
                 <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 text-xl font-bold uppercase shadow-inner">{c.name.charAt(0)}</div>
                    <div>
                       <p className="font-bold text-white uppercase text-sm">{c.name}</p>
                       <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{c.email}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-8">
                    <div className="text-right">
                       <p className="text-sm font-bold text-white uppercase">{c.totalBookings} Trips</p>
                       <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">£{c.totalSpend.toLocaleString()}</p>
                    </div>
                    {c.phone && (
                      <a 
                        href={`https://wa.me/${c.phone.replace(/\D/g,'')}`} 
                        target="_blank" 
                        onClick={e => e.stopPropagation()}
                        className="p-3 bg-[#25D366]/10 text-[#25D366] rounded-full border border-[#25D366]/20 hover:scale-110 transition-transform"
                      >
                        <i className="fa-brands fa-whatsapp"></i>
                      </a>
                    )}
                 </div>
              </div>
           ))}
         </div>
      </div>

      <div className="space-y-8">
        {selectedClient ? (
          <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 space-y-8 animate-in slide-in-from-right-4">
             <div className="flex justify-between items-start">
                 <div className="space-y-2">
                    <h4 className="text-lg font-bold uppercase tracking-tight text-white">{selectedClient.name}</h4>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Profile Since {new Date(selectedClient.createdAt).getFullYear()}</p>
                 </div>
                 <button onClick={() => setShowEditModal(true)} className="text-zinc-600 hover:text-white transition-colors"><i className="fa-solid fa-pen-to-square"></i></button>
             </div>
             
             <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 block px-1">Private Concierge Notes</label>
                <textarea 
                  rows={4}
                  defaultValue={selectedClient.notes}
                  onBlur={e => handleUpdateNotes(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 outline-none focus:ring-1 ring-amber-500 placeholder:text-zinc-800"
                  placeholder="Notes for staff..."
                />
             </div>

             <div className="space-y-4 pt-4 border-t border-zinc-800">
                <h5 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Booking History</h5>
                <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar pr-2">
                   {clientBookings.map((b: Booking) => (
                     <div key={b.id} className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                        <span className="text-zinc-400">{new Date(b.start_at).toLocaleDateString()}</span>
                        <span className="text-white">£{b.total_price}</span>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        ) : (
          <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 text-center opacity-40">
             <i className="fa-solid fa-user-secret text-4xl mb-6 block text-zinc-800"></i>
             <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Select client to view details</p>
          </div>
        )}
      </div>

      {showAddModal && (
          <ClientFormModal 
            onClose={() => setShowAddModal(false)} 
            onSubmit={(data) => { store.upsertCustomer(data); setShowAddModal(false); }}
            title="Add New Client"
          />
      )}

      {showEditModal && selectedClient && (
          <ClientFormModal 
            onClose={() => setShowEditModal(false)} 
            onSubmit={(data) => { store.upsertCustomer({ ...data, email: selectedClient.email }); setShowEditModal(false); }}
            initialData={selectedClient}
            title="Edit Client"
          />
      )}
    </div>
  );
}

function ClientFormModal({ onClose, onSubmit, initialData, title }: { onClose: () => void, onSubmit: (data: any) => void, initialData?: Customer, title: string }) {
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        notes: initialData?.notes || ''
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative w-full max-w-md glass-panel p-8 sm:p-10 rounded-[2.5rem] border-zinc-800 shadow-2xl animate-in zoom-in duration-300">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-bold uppercase tracking-tight text-white">{title}</h3>
                    <button onClick={onClose} className="text-zinc-600 hover:text-white"><i className="fa-solid fa-x"></i></button>
                </div>
                <div className="space-y-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Full Name</label>
                        <input 
                            type="text" 
                            value={formData.name} 
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            className="bg-zinc-900 border-zinc-800 border rounded-2xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" 
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Email (Primary Key)</label>
                        <input 
                            type="email" 
                            value={formData.email} 
                            disabled={!!initialData}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            className={`bg-zinc-900 border-zinc-800 border rounded-2xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner ${initialData ? 'opacity-50 cursor-not-allowed' : ''}`} 
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Phone Number</label>
                        <input 
                            type="tel" 
                            value={formData.phone} 
                            onChange={e => setFormData({...formData, phone: e.target.value})}
                            className="bg-zinc-900 border-zinc-800 border rounded-2xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" 
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Concierge Notes</label>
                        <textarea 
                            rows={3} 
                            value={formData.notes} 
                            onChange={e => setFormData({...formData, notes: e.target.value})}
                            className="bg-zinc-900 border-zinc-800 border rounded-2xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner resize-none" 
                        />
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button onClick={onClose} className="flex-1 bg-zinc-900 border border-zinc-800 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest">Cancel</button>
                        <button onClick={() => onSubmit(formData)} className="flex-1 gold-gradient text-black py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-amber-500/10">Save Client</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BlocksTab({ store, selectedDate }: { store: any, selectedDate: string }) {
  const [activeSubTab, setActiveSubTab] = useState<'single' | 'recurring'>('single');
  const [showBlockModal, setShowBlockModal] = useState(false);

  return (
    <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 space-y-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center gap-4 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800">
           <button onClick={() => setActiveSubTab('single')} className={`px-6 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'single' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>One-Off</button>
           <button onClick={() => setActiveSubTab('recurring')} className={`px-6 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'recurring' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Weekly</button>
        </div>
        <button 
          onClick={() => setShowBlockModal(true)}
          className="text-amber-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest"
        >
          Add {activeSubTab === 'single' ? 'Block' : 'Schedule'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeSubTab === 'single' ? (
          store.blocks.map((b: RoomBlock) => (
            <div key={b.id} className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl space-y-4 group">
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white font-bold uppercase text-sm">{b.reason || 'Manual Block'}</p>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                      {ROOMS.find(r => r.id === b.roomId)?.name} • {new Date(b.start_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button onClick={() => store.deleteBlock(b.id)} className="text-zinc-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><i className="fa-solid fa-trash"></i></button>
               </div>
               <p className="text-xs font-bold font-mono text-zinc-400">{new Date(b.start_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(b.end_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
            </div>
          ))
        ) : (
          store.recurringBlocks.map((rb: RecurringBlock) => (
            <div key={rb.id} className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl space-y-4 group">
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white font-bold uppercase text-sm">{['SUN','MON','TUE','WED','THU','FRI','SAT'][rb.dayOfWeek]}</p>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{ROOMS.find(r => r.id === rb.roomId)?.name}</p>
                  </div>
                  <button onClick={() => store.deleteRecurringBlock(rb.id)} className="text-zinc-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><i className="fa-solid fa-trash"></i></button>
               </div>
               <div className="flex justify-between items-end">
                  <p className="text-xs font-bold font-mono text-zinc-400">{rb.startTime} - {rb.endTime}</p>
                  <button onClick={() => store.toggleRecurringBlock(rb.id, !rb.enabled)} className={`text-[8px] font-bold uppercase px-2 py-1 rounded-full border transition-all ${rb.enabled ? 'border-green-500/20 text-green-500 bg-green-500/5' : 'border-zinc-700 text-zinc-600'}`}>
                    {rb.enabled ? 'Enabled' : 'Disabled'}
                  </button>
               </div>
            </div>
          ))
        )}
      </div>

      {showBlockModal && (
        <BlockModal 
          store={store} 
          selectedDate={selectedDate} 
          mode={activeSubTab} 
          onClose={() => setShowBlockModal(false)} 
        />
      )}
    </div>
  );
}

function BlockModal({ store, selectedDate, mode, onClose }: { store: any, selectedDate: string, mode: 'single' | 'recurring', onClose: () => void }) {
  const [formData, setFormData] = useState({
    roomId: 'room-a',
    date: selectedDate,
    startTime: '15:00',
    endTime: '17:00',
    reason: '',
    dayOfWeek: 1,
    isAllDay: false
  });

  const handleAllDayToggle = () => {
    const nextVal = !formData.isAllDay;
    if (nextVal) {
      const window = store.getOperatingWindow(formData.date) || { open: '15:00', close: '03:00' };
      setFormData({ ...formData, isAllDay: true, startTime: window.open, endTime: window.close });
    } else {
      setFormData({ ...formData, isAllDay: false });
    }
  };

  const handleQuickPreset = (mins: number) => {
    const startMins = parseInt(formData.startTime.split(':')[0]) * 60 + parseInt(formData.startTime.split(':')[1]);
    const endMins = startMins + mins;
    const h = Math.floor((endMins % 1440) / 60).toString().padStart(2, '0');
    const m = (endMins % 60).toString().padStart(2, '0');
    setFormData({ ...formData, endTime: `${h}:${m}`, isAllDay: false });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'single') {
      store.addBlock({
        roomId: formData.roomId,
        start_at: `${formData.date}T${formData.startTime}`,
        end_at: `${formData.date}T${formData.endTime}`,
        reason: formData.reason || 'Manual Block'
      });
    } else {
      store.addRecurringBlock({
        roomId: formData.roomId,
        dayOfWeek: formData.dayOfWeek,
        startTime: formData.startTime,
        endTime: formData.endTime,
        reason: formData.reason || 'Weekly Maintenance',
        enabled: true
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
      <form onSubmit={handleSubmit} className="relative w-full max-w-md glass-panel p-8 sm:p-10 rounded-[2.5rem] border-zinc-800 shadow-2xl animate-in zoom-in duration-300 space-y-6">
         <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold uppercase tracking-tight text-white">Create {mode === 'single' ? 'Block' : 'Schedule'}</h3>
            <button type="button" onClick={onClose} className="text-zinc-600 hover:text-white"><i className="fa-solid fa-x"></i></button>
         </div>

         <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Room</label>
                  <select value={formData.roomId} onChange={e => setFormData({...formData, roomId: e.target.value})} className="bg-zinc-900 border-zinc-800 border rounded-xl px-4 py-3 text-white text-xs outline-none focus:ring-1 ring-amber-500 w-full shadow-inner">
                    {ROOMS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
               </div>
               {mode === 'single' ? (
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Date</label>
                   <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="bg-zinc-900 border-zinc-800 border rounded-xl px-4 py-3 text-white text-xs outline-none focus:ring-1 ring-amber-500 w-full shadow-inner" />
                 </div>
               ) : (
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Weekday</label>
                   <select value={formData.dayOfWeek} onChange={e => setFormData({...formData, dayOfWeek: parseInt(e.target.value)})} className="bg-zinc-900 border-zinc-800 border rounded-xl px-4 py-3 text-white text-xs outline-none focus:ring-1 ring-amber-500 w-full shadow-inner">
                      {['SUN','MON','TUE','WED','THU','FRI','SAT'].map((d, i) => <option key={i} value={i}>{d}</option>)}
                   </select>
                 </div>
               )}
            </div>

            <div className="flex items-center justify-between px-1 pt-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">All-day Operating window</label>
               <button type="button" onClick={handleAllDayToggle} className={`w-8 h-4 rounded-full transition-all relative ${formData.isAllDay ? 'bg-amber-500' : 'bg-zinc-800'}`}>
                  <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${formData.isAllDay ? 'left-5' : 'left-1'}`}></div>
               </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Start Time</label>
                  <input type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value, isAllDay: false})} className="bg-zinc-900 border-zinc-800 border rounded-xl px-4 py-3 text-white font-mono text-xs outline-none focus:ring-1 ring-amber-500 w-full shadow-inner" />
               </div>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">End Time</label>
                  <input type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value, isAllDay: false})} className="bg-zinc-900 border-zinc-800 border rounded-xl px-4 py-3 text-white font-mono text-xs outline-none focus:ring-1 ring-amber-500 w-full shadow-inner" />
               </div>
            </div>

            <div className="flex gap-2">
               {[30, 60, 120, 180].map(mins => (
                 <button key={mins} type="button" onClick={() => handleQuickPreset(mins)} className="flex-1 bg-zinc-900/50 border border-zinc-800 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white hover:border-zinc-600 transition-all">
                   +{mins >= 60 ? `${mins/60}h` : `${mins}m`}
                 </button>
               ))}
            </div>

            <div className="space-y-1.5">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Reason / Note</label>
               <input type="text" placeholder="Maintenance, Private event, etc." value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} className="bg-zinc-900 border-zinc-800 border rounded-xl px-4 py-3 text-white text-xs outline-none focus:ring-1 ring-amber-500 w-full shadow-inner" />
            </div>
         </div>

         <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-zinc-900 border border-zinc-800 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest">Cancel</button>
            <button type="submit" className="flex-1 gold-gradient text-black py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-amber-500/10 active:scale-95 transition-transform">Create</button>
         </div>
      </form>
    </div>
  );
}

function SettingsTab({ store, lastSyncTime }: { store: any, lastSyncTime?: string | null }) {
  const getDays = (total: number) => Math.floor((total || 0) / 24);
  const getHours = (total: number) => (total || 0) % 24;

  const calConfig = store.getCalendarSyncConfig();
  const calendarUrl = `${window.location.origin}/.netlify/functions/calendar-ics?token=${calConfig.token}`;

  const copyUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(calendarUrl);
      alert("Calendar URL copied to clipboard!");
    } else {
      prompt("Copy calendar feed URL:", calendarUrl);
    }
  };

  const handleRegenerate = () => {
    if (confirm("Regenerating the link will break existing subscriptions. Proceed?")) {
      store.regenerateCalendarToken();
    }
  };

  const [editingExtra, setEditingExtra] = useState<Extra | null>(null);
  const [showExtraForm, setShowExtraForm] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
       <div className="space-y-8">
          <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 space-y-10">
             <h3 className="text-xl font-bold uppercase tracking-tight text-white">Default Weekly Hours</h3>
             <div className="space-y-4">
                {store.operatingHours.map((h: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl shadow-lg">
                     <span className="text-[10px] font-bold text-white uppercase w-24 tracking-widest">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][h.day]}</span>
                     <div className="flex items-center gap-2">
                        <input type="time" value={h.open} onChange={e => { const n = [...store.operatingHours]; n[idx].open = e.target.value; store.updateOperatingHours(n); }} className="bg-zinc-800 border-zinc-700 rounded-lg px-2 py-1 text-[9px] text-white outline-none focus:ring-1 ring-amber-500 shadow-inner" />
                        <span className="text-zinc-700 font-bold">-</span>
                        <input type="time" value={h.close} onChange={e => { const n = [...store.operatingHours]; n[idx].close = e.target.value; store.updateOperatingHours(n); }} className="bg-zinc-800 border-zinc-700 rounded-lg px-2 py-1 text-[9px] text-white outline-none focus:ring-1 ring-amber-500 shadow-inner" />
                     </div>
                     <button onClick={() => { const n = [...store.operatingHours]; n[idx].enabled = !n[idx].enabled; store.updateOperatingHours(n); }} className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase border transition-all ${h.enabled ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                        {h.enabled ? 'Open' : 'Closed'}
                     </button>
                  </div>
                ))}
             </div>
          </div>

          <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 space-y-8">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold uppercase tracking-tight text-white">Extras & Add-ons</h3>
                <button 
                  onClick={() => { setEditingExtra(null); setShowExtraForm(true); }}
                  className="text-amber-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest"
                >
                  Add Extra
                </button>
             </div>
             <div className="space-y-4">
                {store.extrasCatalog.sort((a: Extra, b: Extra) => a.sortOrder - b.sortOrder).map((ex: Extra, idx: number) => (
                  <div key={ex.id} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex justify-between items-center group">
                     <div>
                        <div className="flex items-center gap-2">
                           <span className="font-bold text-white text-xs uppercase">{ex.name}</span>
                           <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded uppercase ${ex.enabled ? 'bg-green-500/20 text-green-500' : 'bg-zinc-800 text-zinc-600'}`}>{ex.enabled ? 'Enabled' : 'Off'}</span>
                        </div>
                        <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">£{ex.price} {ex.pricingMode === 'per_person' ? 'per person' : 'flat fee'}</p>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => store.reorderExtras(store.extrasCatalog.map((e: Extra) => e.id).sort((a: string, b: string) => {
                             const aObj = store.extrasCatalog.find((o: Extra) => o.id === a);
                             const bObj = store.extrasCatalog.find((o: Extra) => o.id === b);
                             if (a === ex.id) return -1;
                             if (b === ex.id) return 1;
                             return (aObj?.sortOrder || 0) - (bObj?.sortOrder || 0);
                           }))} className="text-zinc-700 hover:text-white"><i className="fa-solid fa-chevron-up text-[8px]"></i></button>
                           <button onClick={() => {}} className="text-zinc-700 hover:text-white"><i className="fa-solid fa-chevron-down text-[8px]"></i></button>
                        </div>
                        <button onClick={() => { setEditingExtra(ex); setShowExtraForm(true); }} className="text-zinc-600 hover:text-amber-500 transition-colors"><i className="fa-solid fa-pen text-[10px]"></i></button>
                        <button onClick={() => store.deleteExtra(ex.id)} className="text-zinc-800 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash text-[10px]"></i></button>
                     </div>
                  </div>
                ))}
             </div>
          </div>
       </div>

       <div className="space-y-8">
         <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 space-y-10">
            <h3 className="text-xl font-bold uppercase tracking-tight text-white">Core Policies</h3>
            <div className="space-y-8">
               <div className="flex flex-col gap-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-1">Cancellation Cutoff (Days + Hours)</label>
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                       <input 
                         type="number" 
                         min="0"
                         value={getDays(store.settings.cancelCutoffHours)}
                         onChange={e => {
                           const d = Math.max(0, parseInt(e.target.value) || 0);
                           const h = getHours(store.settings.cancelCutoffHours);
                           store.updateSettings({ cancelCutoffHours: (d * 24) + h });
                         }}
                         className="bg-zinc-900 border-zinc-800 rounded-xl px-5 py-4 text-sm text-white outline-none focus:ring-1 ring-amber-500 w-full shadow-inner" 
                       />
                       <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest ml-1">Days</span>
                    </div>
                    <div className="flex-1 space-y-2">
                       <input 
                         type="number" 
                         min="0"
                         max="23"
                         value={getHours(store.settings.cancelCutoffHours)}
                         onChange={e => {
                           const h = Math.max(0, Math.min(23, parseInt(e.target.value) || 0));
                           const d = getDays(store.settings.cancelCutoffHours);
                           store.updateSettings({ cancelCutoffHours: (d * 24) + h });
                         }}
                         className="bg-zinc-900 border-zinc-800 rounded-xl px-5 py-4 text-sm text-white outline-none focus:ring-1 ring-amber-500 w-full shadow-inner" 
                       />
                       <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest ml-1">Hours</span>
                    </div>
                  </div>
               </div>

               <div className="flex flex-col gap-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-1">Reschedule Cutoff (Days + Hours)</label>
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                       <input 
                         type="number" 
                         min="0"
                         value={getDays(store.settings.rescheduleCutoffHours)}
                         onChange={e => {
                           const d = Math.max(0, parseInt(e.target.value) || 0);
                           const h = getHours(store.settings.rescheduleCutoffHours);
                           store.updateSettings({ rescheduleCutoffHours: (d * 24) + h });
                         }}
                         className="bg-zinc-900 border-zinc-800 rounded-xl px-5 py-4 text-sm text-white outline-none focus:ring-1 ring-amber-500 w-full shadow-inner" 
                       />
                       <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest ml-1">Days</span>
                    </div>
                    <div className="flex-1 space-y-2">
                       <input 
                         type="number" 
                         min="0"
                         max="23"
                         value={getHours(store.settings.rescheduleCutoffHours)}
                         onChange={e => {
                           const h = Math.max(0, Math.min(23, parseInt(e.target.value) || 0));
                           const d = getDays(store.settings.rescheduleCutoffHours);
                           store.updateSettings({ rescheduleCutoffHours: (d * 24) + h });
                         }}
                         className="bg-zinc-900 border-zinc-800 rounded-xl px-5 py-4 text-sm text-white outline-none focus:ring-1 ring-amber-500 w-full shadow-inner" 
                       />
                       <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest ml-1">Hours</span>
                    </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Enhanced Calendar Sync Panel */}
         <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 space-y-8">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-bold uppercase tracking-tight text-white">Calendar Sync (Read-only)</h3>
               <button 
                 onClick={() => store.setCalendarSyncConfig({ enabled: !calConfig.enabled })} 
                 className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase border transition-all ${calConfig.enabled ? 'bg-amber-500 text-black border-amber-400' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}
               >
                  {calConfig.enabled ? 'Enabled' : 'Disabled'}
               </button>
            </div>
            
            <div className="space-y-6">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                     <input 
                        type="checkbox" 
                        id="includeCustomerName"
                        checked={calConfig.includeCustomerName}
                        onChange={e => store.setCalendarSyncConfig({ includeCustomerName: e.target.checked })}
                        className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-amber-500 focus:ring-amber-500"
                     />
                     <label htmlFor="includeCustomerName" className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Customer Names</label>
                  </div>
                  <div className="flex items-center gap-3">
                     <input 
                        type="checkbox" 
                        id="includeBlocks"
                        checked={calConfig.includeBlocks}
                        onChange={e => store.setCalendarSyncConfig({ includeBlocks: e.target.checked })}
                        className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-amber-500 focus:ring-amber-500"
                     />
                     <label htmlFor="includeBlocks" className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Internal Blocks</label>
                  </div>
                  <div className="flex items-center gap-3">
                     <input 
                        type="checkbox" 
                        id="includePending"
                        checked={calConfig.includePending}
                        onChange={e => store.setCalendarSyncConfig({ includePending: e.target.checked })}
                        className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-amber-500 focus:ring-amber-500"
                     />
                     <label htmlFor="includePending" className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pending Bookings</label>
                  </div>
               </div>

               <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-2">
                       <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-700 block">Subscription URL</label>
                       <p className={`text-[10px] font-mono break-all leading-relaxed ${calConfig.enabled ? 'text-zinc-400' : 'text-zinc-800 italic'}`}>
                          {calendarUrl}
                       </p>
                    </div>
                    {calConfig.enabled && (
                      <div className="bg-white p-1 rounded-lg shrink-0">
                         <img 
                           src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(calendarUrl)}`} 
                           alt="Calendar QR" 
                           className="w-12 h-12"
                         />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 pt-2 border-t border-zinc-900/50">
                     <button onClick={copyUrl} className="text-amber-500 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-colors">Copy Link</button>
                     <button onClick={handleRegenerate} className="text-zinc-600 hover:text-red-500 text-[9px] font-bold uppercase tracking-widest transition-colors">Regenerate Link</button>
                  </div>
               </div>

               {lastSyncTime && (
                  <div className="flex items-center justify-end px-1 gap-2">
                     <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                     <span className="text-[8px] font-bold text-green-500 uppercase tracking-widest">Last Cloud Push: {lastSyncTime}</span>
                  </div>
               )}
            </div>
         </div>

         {/* Deposit Settings Section */}
         <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 space-y-8">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-bold uppercase tracking-tight text-white">Deposit Tracking</h3>
               <button 
                 onClick={() => store.updateSettings({ deposit_enabled: !store.settings.deposit_enabled })} 
                 className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase border transition-all ${store.settings.deposit_enabled ? 'bg-amber-500 text-black border-amber-400' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}
               >
                  {store.settings.deposit_enabled ? 'Enabled' : 'Disabled'}
               </button>
            </div>
            <div className="space-y-4">
               <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-1">Global Deposit Amount (£)</label>
                  <input 
                     type="number"
                     value={store.settings.deposit_amount}
                     onChange={e => store.updateSettings({ deposit_amount: Math.max(0, parseInt(e.target.value) || 0) })}
                     className="bg-zinc-900 border-zinc-800 rounded-xl px-5 py-4 text-sm text-white outline-none focus:ring-1 ring-amber-500 w-full shadow-inner"
                  />
               </div>
               <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest leading-relaxed px-1">
                  Deposit is deducted from the final bill. Non-refundable inside the cancellation cutoff.
               </p>
            </div>
         </div>

         <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 space-y-8">
            <h3 className="text-xl font-bold uppercase tracking-tight text-white">Promo Codes</h3>
            <div className="space-y-4">
               {store.promoCodes.map((p: PromoCode) => (
                  <div key={p.id} className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl flex justify-between items-center shadow-lg">
                     <div>
                        <span className="block font-bold text-white uppercase text-sm">{p.code}</span>
                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{p.percentOff ? `${p.percentOff}%` : `£${p.fixedOff}`} OFF • {p.uses} Used</span>
                     </div>
                     <button onClick={() => store.updatePromoCode(p.id, { enabled: !p.enabled })} className={`w-3 h-3 rounded-full border border-zinc-700 shadow-inner ${p.enabled ? 'bg-amber-500' : 'bg-zinc-950'}`}></button>
                  </div>
               ))}
               <button onClick={() => store.addPromoCode({ code: 'OFFER25', enabled: true, percentOff: 25, startDate: '2023-01-01', endDate: '2025-12-31' })} className="w-full border-2 border-dashed border-zinc-800 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest text-zinc-700 hover:text-zinc-400 transition-colors">Add Promo Code</button>
            </div>
         </div>
       </div>

       {showExtraForm && (
          <ExtraFormModal 
            onClose={() => setShowExtraForm(false)} 
            extra={editingExtra} 
            store={store} 
          />
       )}
    </div>
  );
}

function ExtraFormModal({ onClose, extra, store }: { onClose: () => void, extra: Extra | null, store: any }) {
  const [formData, setFormData] = useState({
    name: extra?.name || '',
    description: extra?.description || '',
    price: extra?.price || 0,
    pricingMode: extra?.pricingMode || 'flat' as const,
    enabled: extra?.enabled ?? true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (extra) {
      store.updateExtra(extra.id, formData);
    } else {
      store.addExtra({ ...formData, sortOrder: store.extrasCatalog.length });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose}></div>
      <form onSubmit={handleSubmit} className="relative w-full max-w-md glass-panel p-8 rounded-3xl border-zinc-800 space-y-6">
         <h3 className="text-lg font-bold uppercase tracking-tight text-white">{extra ? 'Edit' : 'Add'} Extra</h3>
         
         <div className="space-y-4">
            <div className="flex flex-col gap-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Name</label>
               <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:ring-1 ring-amber-500" />
            </div>
            <div className="flex flex-col gap-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Description</label>
               <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:ring-1 ring-amber-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Price (£)</label>
                  <input type="number" step="0.01" min="0" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:ring-1 ring-amber-500" />
               </div>
               <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pricing Mode</label>
                  <select value={formData.pricingMode} onChange={e => setFormData({...formData, pricingMode: e.target.value as any})} className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:ring-1 ring-amber-500">
                    <option value="flat">Flat Fee</option>
                    <option value="per_person">Per Person</option>
                  </select>
               </div>
            </div>
            <div className="flex items-center gap-3">
               <input type="checkbox" id="exEnabled" checked={formData.enabled} onChange={e => setFormData({...formData, enabled: e.target.checked})} className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-amber-500 focus:ring-amber-500" />
               <label htmlFor="exEnabled" className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Enabled</label>
            </div>
         </div>

         <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-zinc-900 border border-zinc-800 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest">Cancel</button>
            <button type="submit" className="flex-1 gold-gradient text-black py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest">Save</button>
         </div>
      </form>
    </div>
  );
}

function ReportsTab({ store }: { store: any }) {
  const stats = useMemo(() => {
    const active = store.bookings.filter((b: Booking) => b.status === BookingStatus.CONFIRMED);
    const revenue = active.reduce((acc: number, b: Booking) => acc + b.total_price, 0);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const revByMonth = active.reduce((acc: any, b: Booking) => {
      const m = months[new Date(b.start_at).getMonth()];
      acc[m] = (acc[m] || 0) + b.total_price;
      return acc;
    }, {});
    
    // Deposit Stats
    const depositsExpected = store.bookings.reduce((acc: number, b: Booking) => acc + (b.deposit_amount || 0), 0);
    const depositsPaid = store.bookings.filter((b: Booking) => b.deposit_paid).reduce((acc: number, b: Booking) => acc + (b.deposit_amount || 0), 0);
    const depositsForfeited = store.bookings.filter((b: Booking) => b.deposit_forfeited).reduce((acc: number, b: Booking) => acc + (b.deposit_amount || 0), 0);
    const extrasRevenue = active.reduce((acc: number, b: Booking) => acc + (b.extras_total || 0), 0);

    return {
      revenue,
      total: active.length,
      avgValue: Math.round(revenue / (active.length || 1)),
      avgGuests: Math.round(active.reduce((acc: number, b: Booking) => acc + b.guests, 0) / (active.length || 1)),
      revByMonth,
      depositsExpected,
      depositsPaid,
      depositsForfeited,
      extrasRevenue
    };
  }, [store.bookings]);

  return (
    <div className="space-y-10">
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'YTD Revenue', val: `£${stats.revenue.toLocaleString()}`, color: 'text-amber-500' },
            { label: 'Confirmed Sessions', val: stats.total, color: 'text-white' },
            { label: 'Extras Revenue', val: `£${stats.extrasRevenue.toLocaleString()}`, color: 'text-white' },
            { label: 'Average Value', val: `£${stats.avgValue}`, color: 'text-white' },
          ].map((s, i) => (
            <div key={i} className="glass-panel p-8 rounded-3xl border-zinc-800 shadow-2xl">
               <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] block mb-2">{s.label}</span>
               <span className={`text-4xl font-bold tracking-tighter ${s.color}`}>{s.val}</span>
            </div>
          ))}
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-8 rounded-3xl border-zinc-800 shadow-xl border-l-4 border-l-zinc-500">
             <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Expected Deposits</span>
             <span className="text-2xl font-bold text-white">£{stats.depositsExpected.toLocaleString()}</span>
          </div>
          <div className="glass-panel p-8 rounded-3xl border-zinc-800 shadow-xl border-l-4 border-l-green-500">
             <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Total Deposits Paid</span>
             <span className="text-2xl font-bold text-green-500">£{stats.depositsPaid.toLocaleString()}</span>
          </div>
          <div className="glass-panel p-8 rounded-3xl border-zinc-800 shadow-xl border-l-4 border-l-red-500">
             <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Forfeited (Late Cxl)</span>
             <span className="text-2xl font-bold text-red-500">£{stats.depositsForfeited.toLocaleString()}</span>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 space-y-10">
             <h3 className="text-xl font-bold uppercase tracking-tight text-white">Revenue Trend</h3>
             <div className="flex items-end justify-between h-48 gap-4 px-2">
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(m => {
                   const val = stats.revByMonth[m] || 0;
                   const height = stats.revenue > 0 ? (val / stats.revenue) * 200 : 0;
                   return (
                     <div key={m} className="flex-1 flex flex-col items-center gap-4">
                        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-t-lg relative group flex items-end overflow-hidden" style={{ height: `${Math.max(5, height)}%` }}>
                           <div className="absolute inset-0 bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                           <div className="w-full h-1 bg-amber-500/50"></div>
                        </div>
                        <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{m}</span>
                     </div>
                   );
                })}
             </div>
          </div>

          <div className="glass-panel p-10 rounded-[2.5rem] border-zinc-800 space-y-8">
             <h3 className="text-xl font-bold uppercase tracking-tight text-white">Exports</h3>
             <div className="space-y-4">
                <button className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold py-5 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95">Download Day Sheet CSV</button>
                <button className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold py-5 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95">Export Master Booking List</button>
                <div className="pt-8 space-y-2">
                   <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-1">System Health</p>
                   <div className="flex items-center gap-2 px-1">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Active Store Node (LOCAL)</span>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
}

function BookingModal({ store, onClose, initialDate, booking, prefill }: { store: any, onClose: () => void, initialDate: string, booking?: Booking, prefill?: any }) {
  const [formData, setFormData] = useState({
    name: booking?.customer_name || '',
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

  const isPastDay = new Date(formData.date).getTime() < new Date().setHours(0,0,0,0);

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

    if (booking) {
       store.updateBooking(booking.id, basePatch);
    } else {
       store.addBooking({
          ...basePatch,
          created_at: new Date().toISOString(), 
          source: 'admin'
       });
    }
    onClose();
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
            <div className="sm:col-span-2 space-y-1.5">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Client Name</label>
               <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Email</label>
               <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Phone</label>
               <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Start Date</label>
               <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Start Time</label>
               <input type="time" step="900" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white font-mono text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Length (Hours)</label>
               <select value={formData.duration} onChange={e => setFormData({...formData, duration: parseFloat(e.target.value)})} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner">
                  {[2,3,4,5,6].map(h => <option key={h} value={h}>{h} Hours</option>)}
               </select>
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Guests</label>
               <input type="number" min="8" max="100" value={formData.guests} onChange={e => setFormData({...formData, guests: parseInt(e.target.value)})} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner" />
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Room Allocation</label>
               <select value={formData.roomId} onChange={e => setFormData({...formData, roomId: e.target.value})} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner">
                  {ROOMS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
               </select>
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Status</label>
               <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as BookingStatus})} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner">
                  <option value={BookingStatus.CONFIRMED}>Confirmed</option>
                  <option value={BookingStatus.PENDING}>Pending Payment</option>
                  <option value={BookingStatus.CANCELLED}>Cancelled</option>
                  <option value={BookingStatus.NO_SHOW}>No Show</option>
               </select>
            </div>

            {/* Extras Display in Admin Modal */}
            {booking?.extras && booking.extras.length > 0 && (
               <div className="sm:col-span-2 border-t border-zinc-800 pt-6 mt-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4 px-1">Selected Extras</h4>
                  <div className="space-y-2">
                     {booking.extras.map((ex, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                           <span className="text-white">{ex.nameSnapshot} {ex.quantity > 1 ? `(x${ex.quantity})` : ''}</span>
                           <span className="text-amber-500">£{ex.lineTotal}</span>
                        </div>
                     ))}
                     <div className="flex justify-between items-center p-3 text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-zinc-500">Extras Total</span>
                        <span className="text-white">£{booking.extras_total}</span>
                     </div>
                  </div>
               </div>
            )}

            {/* Deposit Tracking in Modal */}
            <div className="sm:col-span-2 border-t border-zinc-800 pt-6 mt-2">
               <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Deposit Management</h4>
                  <div className={`text-[8px] font-bold px-2 py-0.5 rounded border ${formData.deposit_forfeited ? 'bg-red-500/10 text-red-500 border-red-500/20' : formData.deposit_paid ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                    {formData.deposit_forfeited ? 'FORFEITED' : formData.deposit_paid ? 'PAID' : 'PENDING'}
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 ml-1">Amount (£)</label>
                    <input 
                       type="number"
                       value={formData.deposit_amount}
                       onChange={e => setFormData({...formData, deposit_amount: parseInt(e.target.value) || 0})}
                       className="bg-zinc-900 border-zinc-800 border rounded-xl px-4 py-3 text-white text-xs outline-none focus:ring-1 ring-amber-500"
                    />
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                     <button 
                        type="button"
                        onClick={() => setFormData({...formData, deposit_paid: !formData.deposit_paid, deposit_forfeited: false})}
                        className={`flex-1 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all ${formData.deposit_paid ? 'bg-green-500 text-black border-green-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                     >
                        Mark Paid
                     </button>
                     {(formData.status === BookingStatus.CANCELLED || formData.status === BookingStatus.NO_SHOW) && (
                        <button 
                           type="button"
                           onClick={() => setFormData({...formData, deposit_forfeited: !formData.deposit_forfeited, deposit_paid: false})}
                           className={`flex-1 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all ${formData.deposit_forfeited ? 'bg-red-500 text-white border-red-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                        >
                           Forfeit
                        </button>
                     )}
                  </div>
               </div>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Staff Notes</label>
               <textarea rows={2} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="bg-zinc-900 border-zinc-800 border rounded-xl px-5 py-4 text-white text-sm outline-none focus:ring-1 ring-amber-500 shadow-inner resize-none" placeholder="Add notes for concierge..." />
            </div>
         </div>
         <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-zinc-900 border border-zinc-800 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest">Discard</button>
            <button type="submit" disabled={isPastDay} className="flex-1 gold-gradient text-black py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-amber-500/10 active:scale-95 transition-transform disabled:opacity-50">Save Session</button>
         </div>
         {booking && (
           <button type="button" onClick={() => { if(confirm("Permanently delete record?")) { store.deleteBooking(booking.id); onClose(); } }} className="w-full text-zinc-700 hover:text-red-500 transition-colors text-[9px] font-bold uppercase tracking-widest py-2">Delete Record</button>
         )}
      </form>
    </div>
  );
}
