"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Booking, BookingStatus, PaymentState, Room } from '../types';
import { hasConflict, hasMissingCustomerDetails, NOTES_MAX_LENGTH, validateNotesInput } from '../lib/adminBookingOps';

const PAGE_SIZE = 25;

type DateRangePreset = 'all' | 'today' | 'week' | 'custom';

const STATUS_OPTIONS: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CANCELLED];
const PAYMENT_OPTIONS: PaymentState[] = [PaymentState.NONE, PaymentState.DEPOSIT_HELD, PaymentState.PAID, PaymentState.REFUNDED];

const toStartOfDayIso = (date: string) => new Date(`${date}T00:00:00`).toISOString();
const toEndOfDayIso = (date: string) => new Date(`${date}T23:59:59`).toISOString();

const asMoney = (value: number) => `£${Number(value ?? 0).toFixed(2)}`;

const getStatusBadgeClass = (status: BookingStatus) => {
  if (status === BookingStatus.CONFIRMED) return 'bg-green-500/10 text-green-500 border-green-500/20';
  if (status === BookingStatus.CANCELLED) return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (status === BookingStatus.PENDING) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  return 'bg-zinc-800 text-zinc-500 border-zinc-700';
};

export default function AdminBookingsList({ rooms, onViewBooking }: { rooms: Room[]; onViewBooking: (booking: Booking) => void }) {
  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [rangePreset, setRangePreset] = useState<DateRangePreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [highValueOnly, setHighValueOnly] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allScopedBookings, setAllScopedBookings] = useState<Booking[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [notes, setNotes] = useState('');

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
      return { start: toStartOfDayIso(today), end: toEndOfDayIso(weekEnd.toISOString().split('T')[0]) };
    }
    if (rangePreset === 'custom' && startDate) {
      return { start: toStartOfDayIso(startDate), end: endDate ? toEndOfDayIso(endDate) : undefined };
    }
    return { start: now.toISOString(), end: undefined };
  }, [rangePreset, startDate, endDate]);

  const applyFilters = (query: any) => {
    let q = query.gte('start_at', queryWindow.start);
    if (queryWindow.end) q = q.lte('start_at', queryWindow.end);
    if (selectedRoom) q = q.eq('room_id', selectedRoom);
    if (statusFilter) q = q.eq('status', statusFilter);
    if (paymentFilter) q = q.eq('payment_state', paymentFilter);
    if (highValueOnly) q = q.gte('total_price', 500);
    const term = search.trim();
    if (term) {
      const escaped = term.replace(/%/g, '\\%');
      q = q.or(`customer_name.ilike.%${escaped}%,customer_email.ilike.%${escaped}%,booking_ref.ilike.%${escaped}%`);
    }
    return q;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const offset = (page - 1) * PAGE_SIZE;
    try {
      let pageQuery = applyFilters(supabase.from('bookings').select('*', { count: 'exact' }).order('start_at').range(offset, offset + PAGE_SIZE - 1));
      const { data, error: pageError, count } = await pageQuery;
      if (pageError) throw pageError;

      let scopeQuery = applyFilters(supabase.from('bookings').select('*').order('start_at'));
      const { data: scoped, error: scopedError } = await scopeQuery;
      if (scopedError) throw scopedError;

      let normalized = (data ?? []) as Booking[];
      let normalizedScoped = (scoped ?? []) as Booking[];
      if (missingOnly) {
        normalized = normalized.filter(hasMissingCustomerDetails);
        normalizedScoped = normalizedScoped.filter(hasMissingCustomerDetails);
      }

      setBookings(normalized);
      setAllScopedBookings(normalizedScoped);
      setTotalCount(count ?? normalized.length);
    } catch (err: any) {
      setError(err?.message ?? 'Failed loading bookings.');
      setBookings([]);
      setAllScopedBookings([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); }, [search, selectedRoom, rangePreset, startDate, endDate, statusFilter, paymentFilter, missingOnly, highValueOnly]);
  useEffect(() => { loadData(); }, [page, queryWindow, selectedRoom, search, statusFilter, paymentFilter, missingOnly, highValueOnly]);

  const metrics = useMemo(() => {
    const confirmedRevenue = allScopedBookings.filter(b => b.status === BookingStatus.CONFIRMED).reduce((acc, b) => acc + Number(b.total_price || 0), 0);
    const pendingRevenue = allScopedBookings.filter(b => b.status === BookingStatus.PENDING).reduce((acc, b) => acc + Number(b.total_price || 0), 0);
    const counts = allScopedBookings.reduce((acc: Record<string, number>, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});
    const utilisationByRoom = rooms.map(room => ({ room: room.name, bookings: allScopedBookings.filter(b => b.room_id === room.id && b.status !== BookingStatus.CANCELLED).length }));
    return { confirmedRevenue, pendingRevenue, counts, utilisationByRoom };
  }, [allScopedBookings, rooms]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const patchBooking = async (bookingId: string, action: string, extra: any = {}) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(`/api/admin/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...extra })
    });
    await loadData();
  };

  const runBulk = async (action: 'cancel' | 'mark_paid') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch('/api/admin/bookings/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ids })
    });
    setSelectedIds(new Set());
    await loadData();
  };

  const exportCsv = () => {
    const headers = ['booking_ref', 'customer_name', 'customer_email', 'room_name', 'start_at', 'status', 'payment_state', 'total_price'];
    const rows = [headers.join(','), ...allScopedBookings.map((b) => headers.map((h) => `"${String((b as any)[h] ?? '')}"`).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bookings-export.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return <div className="glass-panel p-6 sm:p-8 rounded-[2.5rem] border-zinc-800 shadow-2xl space-y-6">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-bold uppercase tracking-widest">
      <div className="bg-zinc-900 rounded-xl p-3">Confirmed £<div className="text-white text-lg">{metrics.confirmedRevenue.toFixed(0)}</div></div>
      <div className="bg-zinc-900 rounded-xl p-3">Pending £<div className="text-white text-lg">{metrics.pendingRevenue.toFixed(0)}</div></div>
      <div className="bg-zinc-900 rounded-xl p-3">By status<div className="text-white">P:{metrics.counts.PENDING || 0} C:{metrics.counts.CONFIRMED || 0} X:{metrics.counts.CANCELLED || 0}</div></div>
      <div className="bg-zinc-900 rounded-xl p-3">Utilisation<div className="text-white">{metrics.utilisationByRoom.map(r => `${r.room}:${r.bookings}`).join(' · ')}</div></div>
    </div>

    <div className="flex flex-wrap gap-3 items-center">
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm" />
      <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm"><option value="">All rooms</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm"><option value="">All status</option>{STATUS_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}</select>
      <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm"><option value="">All payment</option>{PAYMENT_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}</select>
      <label className="text-xs"><input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} /> Missing details</label>
      <label className="text-xs"><input type="checkbox" checked={highValueOnly} onChange={(e) => setHighValueOnly(e.target.checked)} /> High value (£500+)</label>
      <button onClick={() => runBulk('cancel')} className="px-3 py-2 text-xs rounded bg-red-900">Bulk Cancel</button>
      <button onClick={() => runBulk('mark_paid')} className="px-3 py-2 text-xs rounded bg-green-900">Bulk Mark Paid</button>
      <button onClick={exportCsv} className="px-3 py-2 text-xs rounded bg-zinc-800">Export CSV</button>
    </div>

    <div className="border border-zinc-900 rounded-2xl overflow-hidden bg-zinc-950">
      <table className="min-w-full text-left text-[10px] uppercase tracking-widest">
        <thead><tr className="border-b border-zinc-900"><th></th><th>Date</th><th>Guest</th><th>Room</th><th>Total</th><th>Status</th><th>Payment</th><th>Badges</th><th>Actions</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={9} className="px-4 py-6">Loading…</td></tr>}
          {!!error && <tr><td colSpan={9} className="px-4 py-6 text-red-400">{error}</td></tr>}
          {!loading && !error && bookings.map((b) => {
            const missing = hasMissingCustomerDetails(b);
            const conflict = hasConflict(b, allScopedBookings);
            return <tr key={b.id} className="border-b border-zinc-900 text-white text-[11px]">
              <td className="px-2"><input type="checkbox" checked={selectedIds.has(b.id)} onChange={() => toggleSelect(b.id)} /></td>
              <td className="px-2">{new Date(b.start_at).toLocaleString()}</td>
              <td className="px-2">{b.customer_name || '—'}<div className="text-zinc-400">{b.customer_email || '—'}</div></td>
              <td className="px-2">{b.room_name}</td>
              <td className="px-2">{asMoney(Number(b.total_price || 0))}</td>
              <td className="px-2"><span className={`inline-flex px-2 py-1 rounded border ${getStatusBadgeClass(b.status)}`}>{b.status}</span></td>
              <td className="px-2">{b.payment_state || PaymentState.NONE}</td>
              <td className="px-2 space-x-1">
                {missing && <span className="px-2 py-1 rounded border border-amber-500/30 text-amber-400">Missing customer details</span>}
                {conflict && <span className="px-2 py-1 rounded border border-red-500/30 text-red-400">Conflict</span>}
              </td>
              <td className="px-2 py-2">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onViewBooking(b)} className="text-amber-400">View</button>
                  <button onClick={() => { setEditingBooking(b); setNotes(b.notes || ''); }} className="text-blue-400">Notes</button>
                  <button onClick={() => patchBooking(b.id, 'send_payment_link')} className="text-purple-400">Send payment link</button>
                  <button onClick={() => patchBooking(b.id, 'mark_paid')} className="text-green-400">Mark paid</button>
                  <button onClick={() => patchBooking(b.id, 'cancel')} className="text-red-400">Cancel booking</button>
                  {missing && <a href={`mailto:${b.customer_email || ''}?subject=Please%20confirm%20your%20booking%20details`} className="text-cyan-400">Request details (email)</a>}
                </div>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    <div className="flex justify-between text-xs"><span>Showing {bookings.length} of {totalCount}</span><span>Page {page}/{totalPages} <button disabled={page<=1} onClick={()=>setPage(page-1)}>Prev</button> <button disabled={page>=totalPages} onClick={()=>setPage(page+1)}>Next</button></span></div>

    {editingBooking && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40"><div className="bg-zinc-900 rounded-xl p-6 w-[500px] max-w-[95vw]"><h3 className="font-bold mb-2">Edit notes</h3><textarea value={notes} onChange={(e)=>setNotes(e.target.value)} maxLength={NOTES_MAX_LENGTH} className="w-full h-36 bg-zinc-950 border border-zinc-800 p-3 rounded" /><div className="text-xs text-zinc-400 mt-1">{notes.length}/{NOTES_MAX_LENGTH}</div><div className="flex gap-2 mt-3"><button onClick={()=>setEditingBooking(null)} className="px-3 py-2 bg-zinc-800 rounded">Close</button><button onClick={()=>{
      const v=validateNotesInput(notes);
      if(!v.ok){ alert(v.error); return; }
      patchBooking(editingBooking.id,'update_notes',{notes});
      setEditingBooking(null);
    }} className="px-3 py-2 bg-amber-500 text-black rounded">Save</button></div></div></div>}
  </div>;
}
