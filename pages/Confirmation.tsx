
import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import { getGuestLabel } from '../constants';

const Confirmation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const store = useStore();
  const id = searchParams.get('id');
  const booking = store.bookings.find(b => b.id === id);

  if (!booking) return <div className="p-20 text-center uppercase font-bold tracking-widest text-zinc-600">Booking record not found.</div>;

  return (
    <div className="w-full px-4 py-12 sm:py-20 md:max-w-xl md:mx-auto text-center animate-in fade-in duration-1000">
      <div className="relative w-16 h-16 md:w-24 md:h-24 mx-auto mb-6 md:mb-10">
        <div className="absolute inset-0 bg-green-500 blur-2xl opacity-20 animate-pulse"></div>
        <div className="relative w-full h-full bg-green-500 rounded-full flex items-center justify-center text-black text-2xl md:text-4xl shadow-xl shadow-green-500/20">
          <i className="fa-solid fa-check"></i>
        </div>
      </div>
      
      <h1 className="text-3xl md:text-5xl font-bold mb-4 uppercase tracking-tighter">See You Soon!</h1>
      <p className="text-zinc-400 mb-6 font-medium text-xs md:text-base px-2 leading-relaxed">
        Your booking at London Karaoke Club is confirmed. We've sent your digital pass to 
        <br className="hidden md:block" />
        <span className="text-white font-bold ml-1">{booking.customer_email}</span>
      </p>

      {booking.magicToken && (
         <div className="mb-8 md:mb-10">
            <Link 
               to={`/m/${booking.magicToken}`} 
               className="text-amber-500 font-bold uppercase tracking-widest text-[9px] md:text-[10px] border-b border-amber-500/20 pb-1 hover:text-white transition-all"
            >
               Manage Booking Online
            </Link>
         </div>
      )}

      <div className="glass-panel p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] text-left space-y-6 md:space-y-8 mb-10 md:mb-12 border-zinc-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 md:p-8 opacity-5 md:opacity-10 grayscale">
            <img 
              src="https://files.londonkaraoke.club/uploads/1768098773_lkc_512.png" 
              alt="London Karaoke Club logo" 
              className="h-12 md:h-24 w-auto" 
            />
        </div>

        <div className="flex justify-between items-start relative z-10">
          <div>
            <p className="text-[9px] md:text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-1">Booking Reference</p>
            <p className="text-xl md:text-2xl font-mono font-bold text-white">#{booking.id.toUpperCase()}</p>
          </div>
          <div className="text-right">
            <span className="bg-green-500/10 text-green-500 text-[8px] md:text-[10px] font-bold px-2 md:px-3 py-1 rounded-full uppercase tracking-widest border border-green-500/20">Confirmed</span>
          </div>
        </div>

        <div className="space-y-5 md:space-y-6 pt-6 border-t border-zinc-800 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-500 shadow-inner">
              <i className="fa-solid fa-calendar-days text-sm md:text-lg"></i>
            </div>
            <div>
              <p className="font-bold text-sm md:text-lg">{new Date(booking.start_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="text-[8px] md:text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                {new Date(booking.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — 
                {new Date(booking.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-500 shadow-inner">
              <i className="fa-solid fa-user-group text-xs md:text-sm"></i>
            </div>
            <div>
              <p className="font-bold text-sm md:text-lg">{getGuestLabel(booking.guests)}</p>
              <p className="text-[8px] md:text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Full Suite Occupancy</p>
            </div>
          </div>

          {booking.extras && booking.extras.length > 0 && (
             <div className="flex items-start gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-500 shadow-inner">
                   <i className="fa-solid fa-bottle-wine text-sm md:text-lg"></i>
                </div>
                <div className="flex-1">
                   <p className="font-bold text-sm md:text-lg">Extras Total: £{booking.extras_total}</p>
                   <div className="mt-1 space-y-1">
                      {booking.extras.map((ex, i) => (
                         <p key={i} className="text-[8px] md:text-[9px] text-zinc-500 uppercase tracking-widest font-bold">
                            • {ex.nameSnapshot} {ex.quantity > 1 ? `(x${ex.quantity})` : ''}
                         </p>
                      ))}
                   </div>
                </div>
             </div>
          )}

          {booking.deposit_amount > 0 && (
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-500 shadow-inner">
                 <i className="fa-solid fa-receipt text-sm md:text-lg"></i>
               </div>
               <div>
                 <p className="font-bold text-sm md:text-lg">£{booking.deposit_amount} Deposit</p>
                 <div className="flex items-center gap-2">
                    <span className="text-[8px] md:text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Tracked via Console</span>
                    <span className={`text-[7px] md:text-[8px] font-bold px-1.5 rounded uppercase ${booking.deposit_paid ? 'bg-green-500/20 text-green-500' : 'bg-amber-500/20 text-amber-500'}`}>
                       {booking.deposit_paid ? 'Paid' : 'Pending Verification'}
                    </span>
                 </div>
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 px-4 sm:px-0">
        <Link to="/" className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-all py-3.5 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase text-[9px] md:text-[10px] tracking-widest active:scale-95 min-h-[44px] flex items-center justify-center">
          Return Home
        </Link>
        <button 
          onClick={() => window.print()}
          className="gold-gradient text-black py-3.5 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase text-[9px] md:text-[10px] tracking-widest shadow-xl shadow-amber-500/10 transition-transform active:scale-95 min-h-[44px]"
        >
          Download Pass
        </button>
      </div>
      
      <p className="mt-10 md:mt-12 text-[8px] md:text-[10px] text-zinc-600 uppercase tracking-widest font-medium px-4 leading-relaxed">
        Arrive 15 minutes early for check-in. ID required for all guests.
      </p>
    </div>
  );
};

export default Confirmation;
