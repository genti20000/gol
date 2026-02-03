"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Booking, BookingStatus, Room } from '../types';

const PAGE_SIZE = 25;

type DateRangePreset = 'all' | 'today' | 'week' | 'custom';

// Toast notification component
const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({
  message,
  type,
  onClose
}) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-widest z-50 ${
        type === 'success'
          ? 'bg-green-500/10 border border-green-500/30 text-green-400'
          : 'bg-red-500/10 border border-red-500/30 text-red-400'
      }`}
    >
      {message}
    </div>
  );
};

// Truncate notes to show snippet
const getNotesSnippet = (notes: string | undefined, maxLength: number = 60): string => {
  if (!notes || !notes.trim()) return '—';
  if (notes.length > maxLength) return notes.substring(0, maxLength) + '…';
  return notes;
};

const getStatusBadgeClass = (status: BookingStatus) => {
  if (status === BookingStatus.CONFIRMED) return 'bg-green-500/10 text-green-500 border-green-500/20';
  if (status === BookingStatus.CANCELLED) return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (status === BookingStatus.NO_SHOW) return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (status === BookingStatus.PENDING) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  return 'bg-zinc-800 text-zinc-500 border-zinc-700';
};

const toStartOfDayIso = (date: string) => new Date(`${date}T00:00:00`).toISOString();
const toEndOfDayIso = (date: string) => new Date(`${date}T23:59:59`).toISOString();

export default function AdminBookingsList({
  rooms,
  onViewBooking
}: {
  rooms: Room[];
  onViewBooking: (booking: Booking) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [rangePreset, setRangePreset] = useState<DateRangePreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Handler: Open edit notes modal
  const handleEditNotesClick = (booking: Booking) => {
    setEditingBooking(booking);
    setEditNotes(booking.notes || '');
  };

  // Handler: Save notes
  const handleSaveNotes = async () => {
    if (!editingBooking) return;
    setEditLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setToast({ message: 'Authentication error. Please refresh.', type: 'error' });
        setEditLoading(false);
        return;
      }

      const response = await fetch(`/api/admin/bookings/${editingBooking.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes: editNotes })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update notes');
      }

      const result = await response.json();
      
      // Update the booking in the local state
      setBookings(prevBookings =>
        prevBookings.map(b =>
          b.id === editingBooking.id ? { ...b, notes: editNotes } : b
        )
      );

      setToast({ message: 'Notes updated successfully', type: 'success' });
      setEditingBooking(null);
      setEditNotes('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update notes';
      setToast({ message, type: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  // Handler: Open delete confirmation modal
  const handleDeleteClick = (booking: Booking) => {
    setDeletingBooking(booking);
    setDeleteConfirmText('');
  };

  // Handler: Confirm delete
  const handleConfirmDelete = async () => {
    if (!deletingBooking) return;
    if (deleteConfirmText.toUpperCase() !== 'DELETE') return;

    setDeleteLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setToast({ message: 'Authentication error. Please refresh.', type: 'error' });
        setDeleteLoading(false);
        return;
      }

      const response = await fetch(`/api/admin/bookings/${deletingBooking.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete booking');
      }

      // Remove the booking from the local state
      setBookings(prevBookings =>
        prevBookings.filter(b => b.id !== deletingBooking.id)
      );
      setTotalCount(prev => prev - 1);

      setToast({ message: 'Booking deleted successfully', type: 'success' });
      setDeletingBooking(null);
      setDeleteConfirmText('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete booking';
      setToast({ message, type: 'error' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const queryWindow = useMemo(() => {
    const now = new Date();
    if (rangePreset === 'today') {
      const today = now.toISOString().split('T')[0];
      return { start: toStartOfDayIso(today), end: toEndOfDayIso(today) };
    }
    if (rangePreset === 'week') {
      const today = now.toISOString().split('T')[0];
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const endLabel = weekEnd.toISOString().split('T')[0];
      return { start: toStartOfDayIso(today), end: toEndOfDayIso(endLabel) };
    }
    if (rangePreset === 'custom' && startDate) {
      return {
        start: toStartOfDayIso(startDate),
        end: endDate ? toEndOfDayIso(endDate) : undefined
      };
    }
    return { start: now.toISOString(), end: undefined };
  }, [rangePreset, startDate, endDate]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedRoom, rangePreset, startDate, endDate]);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true);
        setError(null);
        const offset = (page - 1) * PAGE_SIZE;

        let query = supabase
          .from('bookings')
          .select('*', { count: 'exact' })
          .gte('start_at', queryWindow.start)
          .order('start_at', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (queryWindow.end) {
          query = query.lte('start_at', queryWindow.end);
        }
        if (selectedRoom) {
          query = query.eq('room_id', selectedRoom);
        }
        const term = search.trim();
        if (term) {
          const escaped = term.replace(/%/g, '\\%');
          query = query.or(
            `customer_name.ilike.%${escaped}%,customer_surname.ilike.%${escaped}%,customer_email.ilike.%${escaped}%,customer_phone.ilike.%${escaped}%,booking_ref.ilike.%${escaped}%`
          );
        }

        const { data, error: queryError, count } = await query;
        if (queryError) {
          setError(queryError.message);
          setBookings([]);
          setTotalCount(0);
          return;
        }

        const normalized = (data ?? []).map((b: any) => ({
          ...b,
          status: b.status as BookingStatus
        })) as Booking[];
        setBookings(normalized);
        setTotalCount(count ?? 0);
      } catch (err) {
        console.error('Failed to load upcoming bookings', err);
        setError('Failed to load bookings. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [page, queryWindow, search, selectedRoom]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-[2.5rem] border-zinc-800 shadow-2xl space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <h3 className="text-xl font-bold uppercase tracking-tighter text-white">Bookings List</h3>
          <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest">All upcoming sessions across rooms</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[9px] font-bold uppercase tracking-widest">
          {(['all', 'today', 'week', 'custom'] as DateRangePreset[]).map(preset => (
            <button
              key={preset}
              onClick={() => setRangePreset(preset)}
              className={`px-4 py-2 rounded-full border transition-all ${rangePreset === preset ? 'bg-amber-500 text-black border-amber-500' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'}`}
            >
              {preset === 'all' ? 'All Upcoming' : preset === 'today' ? 'Today' : preset === 'week' ? 'This Week' : 'Custom'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
        <input
          type="text"
          placeholder="Search name, email, phone, ref..."
          value={search}
          onChange={event => setSearch(event.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3 text-sm text-white w-full lg:max-w-sm outline-none focus:ring-1 ring-amber-500"
        />
        <select
          value={selectedRoom}
          onChange={event => setSelectedRoom(event.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white w-full lg:w-auto"
        >
          <option value="">All Rooms</option>
          {rooms.map(room => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
        {rangePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={startDate}
              onChange={event => setStartDate(event.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white"
            />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">to</span>
            <input
              type="date"
              value={endDate}
              onChange={event => setEndDate(event.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white"
            />
          </div>
        )}
      </div>

      <div className="border border-zinc-900 rounded-2xl overflow-hidden bg-zinc-950">
        <div className="max-h-[60vh] overflow-auto">
          <table className="min-w-full text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            <thead className="sticky top-0 bg-zinc-950 z-10">
              <tr className="border-b border-zinc-900">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Party</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-medium uppercase tracking-tight text-white">
              {loading && (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                    Loading upcoming bookings...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-[10px] text-red-400 font-bold uppercase tracking-widest">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && bookings.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                    No upcoming bookings found.
                  </td>
                </tr>
              )}
              {!loading && !error && bookings.map((b: Booking) => {
                const start = new Date(b.start_at);
                const end = new Date(b.end_at);
                return (
                  <tr key={b.id} className="border-b border-zinc-900/60 last:border-b-0">
                    <td className="px-4 py-4 whitespace-nowrap text-zinc-200">{start.toLocaleDateString()}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-zinc-200 font-mono text-[10px]">
                      {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-zinc-300">{b.room_name}</td>
                    <td className="px-4 py-4 min-w-[160px]">
                      <div className="text-[11px] font-bold uppercase text-white truncate" title={b.customer_name}>
                        {b.customer_name} {b.customer_surname || ''}
                      </div>
                      <div className="text-[9px] text-zinc-500 font-bold lowercase tracking-tight truncate" title={b.customer_email}>
                        {b.customer_email}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center text-zinc-200">{b.guests}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-zinc-200">
                      £{(b.total_price || 0).toLocaleString()}
                      {b.deposit_amount > 0 && (
                        <div className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">
                          Dep £{b.deposit_amount} • {b.deposit_paid ? 'Paid' : 'Pend'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-[8px] font-bold uppercase px-2 py-1 rounded-full border ${getStatusBadgeClass(b.status)}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 max-w-[200px]">
                      {b.notes ? (
                        <span className="text-[9px] text-zinc-400 line-clamp-2" title={b.notes}>
                          {b.notes}
                        </span>
                      ) : (
                        <span className="text-[9px] text-zinc-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-[9px] text-zinc-500">
                      {b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onViewBooking(b)}
                          className="text-amber-500 hover:text-amber-400 transition-colors text-[9px] font-bold uppercase tracking-widest"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleEditNotesClick(b)}
                          className="text-blue-400 hover:text-blue-300 transition-colors text-[9px] font-bold uppercase tracking-widest"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(b)}
                          className="text-red-400 hover:text-red-300 transition-colors text-[9px] font-bold uppercase tracking-widest"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
        <span>Showing {bookings.length} of {totalCount} bookings</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-full disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-zinc-600">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-full disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Edit Notes Modal */}
      {editingBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 max-w-lg w-full mx-4 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold uppercase tracking-tighter text-white mb-2">Edit Notes</h3>
              <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 space-y-1">
                <div>{editingBooking.customer_name} {editingBooking.customer_surname || ''}</div>
                <div>{new Date(editingBooking.start_at).toLocaleDateString()} at {new Date(editingBooking.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div>Room: {editingBooking.room_name}</div>
              </div>
            </div>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              maxLength={2000}
              placeholder="Add notes here..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-1 ring-amber-500 resize-none"
              rows={5}
            />
            <div className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">
              {editNotes.length} / 2000 characters
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditingBooking(null);
                  setEditNotes('');
                }}
                disabled={editLoading}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-xl px-4 py-3 text-[9px] font-bold uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={editLoading}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black rounded-xl px-4 py-3 text-[9px] font-bold uppercase tracking-widest transition-colors"
              >
                {editLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 max-w-lg w-full mx-4 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold uppercase tracking-tighter text-white mb-2">Delete Booking</h3>
              <p className="text-[9px] font-bold uppercase tracking-widest text-red-400 mb-4">
                This cannot be undone.
              </p>
              <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 space-y-1">
                <div>{deletingBooking.customer_name} {deletingBooking.customer_surname || ''}</div>
                <div>{new Date(deletingBooking.start_at).toLocaleDateString()} at {new Date(deletingBooking.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div>Room: {deletingBooking.room_name}</div>
                <div>Ref: {deletingBooking.booking_ref}</div>
              </div>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-white block mb-2">
                Type "DELETE" to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-1 ring-red-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeletingBooking(null);
                  setDeleteConfirmText('');
                }}
                disabled={deleteLoading}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-xl px-4 py-3 text-[9px] font-bold uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading || deleteConfirmText.toUpperCase() !== 'DELETE'}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl px-4 py-3 text-[9px] font-bold uppercase tracking-widest transition-colors"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
