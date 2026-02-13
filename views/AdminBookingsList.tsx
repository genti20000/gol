"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Booking, BookingStatus, PaymentState, Room } from '../types';
import { hasMissingCustomerDetails, NOTES_MAX_LENGTH, validateNotesInput } from '../lib/adminBookingOps';

const PAGE_SIZE = 25;
const CANCEL_UNDO_MS = 6000;

type DateRangePreset = 'all' | 'today' | 'week' | 'custom';
type StatusFilter = 'live' | 'all' | BookingStatus;

const PAYMENT_OPTIONS: PaymentState[] = [PaymentState.NONE, PaymentState.DEPOSIT_HELD, PaymentState.PAID, PaymentState.REFUNDED];
const QUICK_FILTERS = [
  { key: 'live', label: 'Live only' },
  { key: 'missing', label: 'Missing details' },
  { key: 'high', label: 'High value (£500+)' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' }
] as const;

const asMoney = (value: number) => `£${Number(value ?? 0).toFixed(2)}`;

const statusBadgeClass = (booking: Booking) => {
  if (booking.status === BookingStatus.CONFIRMED) return 'bg-green-500/10 text-green-500 border-green-500/20';
  if (booking.status === BookingStatus.PENDING) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  if (booking.status === BookingStatus.CANCELLED) return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (booking.status === BookingStatus.EXPIRED) return 'bg-zinc-700/30 text-zinc-400 border-zinc-600';
  return 'bg-zinc-800 text-zinc-500 border-zinc-700';
};

const statusLabel = (booking: Booking) => {
  if (booking.status === BookingStatus.EXPIRED) return 'Expired (auto)';
  return booking.status;
};

const isLiveBooking = (booking: Booking) =>
  booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.PENDING;

const isExpiredBooking = (booking: Booking) => booking.status === BookingStatus.EXPIRED;

const boolFromParam = (value: string | null, fallback = false) =>
  value === null ? fallback : value === '1' || value === 'true';

const defaultFilters = {
  search: '',
  room: '',
  status: 'live' as StatusFilter,
  payment: '',
  missingOnly: false,
  highValueOnly: false,
  showExpired: false,
  range: 'all' as DateRangePreset,
  startDate: '',
  endDate: '',
  page: 1
};

const parseInitialFilters = () => {
  if (typeof window === 'undefined') return defaultFilters;
  const params = new URLSearchParams(window.location.search);
  const statusParam = (params.get('status') || 'live').toUpperCase();
  let status: StatusFilter = 'live';
  if (statusParam === 'ALL') status = 'all';
  if (Object.values(BookingStatus).includes(statusParam as BookingStatus)) status = statusParam as BookingStatus;
  const rangeParam = (params.get('range') || 'all').toLowerCase();
  const range: DateRangePreset = ['today', 'week', 'custom', 'all'].includes(rangeParam) ? (rangeParam as DateRangePreset) : 'all';
  const page = Math.max(1, Number(params.get('page') || 1));
  return {
    search: params.get('search') || '',
    room: params.get('room') || '',
    status,
    payment: params.get('payment') || '',
    missingOnly: boolFromParam(params.get('missingOnly')),
    highValueOnly: boolFromParam(params.get('highValueOnly')),
    showExpired: boolFromParam(params.get('showExpired')),
    range,
    startDate: params.get('startDate') || '',
    endDate: params.get('endDate') || '',
    page
  };
};

export default function AdminBookingsList({
  rooms,
  onViewBooking
}: {
  rooms: Room[];
  allBookings: Booking[];
  onViewBooking: (booking: Booking) => void;
}) {
  const initial = useMemo(() => parseInitialFilters(), []);
  const [searchInput, setSearchInput] = useState(initial.search);
  const [search, setSearch] = useState(initial.search);
  const [selectedRoom, setSelectedRoom] = useState(initial.room);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initial.status);
  const [paymentFilter, setPaymentFilter] = useState(initial.payment);
  const [missingOnly, setMissingOnly] = useState(initial.missingOnly);
  const [highValueOnly, setHighValueOnly] = useState(initial.highValueOnly);
  const [showExpired, setShowExpired] = useState(initial.showExpired);
  const [rangePreset, setRangePreset] = useState<DateRangePreset>(initial.range);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [includeExpiredInBulk, setIncludeExpiredInBulk] = useState(false);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(initial.page);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [notes, setNotes] = useState('');
  const [pendingCancel, setPendingCancel] = useState<{ ids: string[]; label: string } | null>(null);

  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlReadyRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const updateUrlQuery = () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (selectedRoom) params.set('room', selectedRoom);
    if (statusFilter !== 'live') params.set('status', statusFilter === 'all' ? 'all' : statusFilter);
    if (paymentFilter) params.set('payment', paymentFilter);
    if (missingOnly) params.set('missingOnly', '1');
    if (highValueOnly) params.set('highValueOnly', '1');
    if (showExpired) params.set('showExpired', '1');
    if (rangePreset !== 'all') params.set('range', rangePreset);
    if (rangePreset === 'custom' && startDate) params.set('startDate', startDate);
    if (rangePreset === 'custom' && endDate) params.set('endDate', endDate);
    if (page > 1) params.set('page', String(page));
    const next = params.toString();
    const target = `${window.location.pathname}${next ? `?${next}` : ''}`;
    window.history.replaceState({}, '', target);
  };

  useEffect(() => {
    if (!urlReadyRef.current) {
      urlReadyRef.current = true;
      return;
    }
    updateUrlQuery();
  }, [search, selectedRoom, statusFilter, paymentFilter, missingOnly, highValueOnly, showExpired, rangePreset, startDate, endDate, page]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [search, selectedRoom, statusFilter, paymentFilter, missingOnly, highValueOnly, showExpired, rangePreset, startDate, endDate]);

  useEffect(() => {
    return () => {
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    };
  }, []);

  const fetchWithAdminAuth = async (url: string) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Admin session expired. Please sign in again.');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || 'Request failed.');
    }
    return payload;
  };

  const buildListParams = (exportAll = false) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    if (search) params.set('search', search);
    if (selectedRoom) params.set('room', selectedRoom);
    if (statusFilter === 'all') params.set('status', 'all');
    else if (statusFilter !== 'live') params.set('status', statusFilter);
    if (paymentFilter) params.set('payment', paymentFilter);
    if (missingOnly) params.set('missingOnly', '1');
    if (highValueOnly) params.set('highValueOnly', '1');
    if (showExpired) params.set('showExpired', '1');
    if (rangePreset !== 'all') params.set('range', rangePreset);
    if (rangePreset === 'custom' && startDate) params.set('startDate', startDate);
    if (rangePreset === 'custom' && endDate) params.set('endDate', endDate);
    if (exportAll) params.set('exportAll', '1');
    return params;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    try {
      const payload = await fetchWithAdminAuth(`/api/admin/bookings/list?${buildListParams(false).toString()}`);
      const rows = Array.isArray(payload?.rows) ? (payload.rows as Booking[]) : [];
      const sorted = [...rows].sort((a, b) => {
        const aExpired = isExpiredBooking(a) ? 1 : 0;
        const bExpired = isExpiredBooking(b) ? 1 : 0;
        if (showExpired && aExpired !== bExpired) return aExpired - bExpired;
        return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
      });
      setBookings(sorted);
      setTotalCount(Number(payload?.total || 0));
    } catch (err: any) {
      const message = err?.message || 'Failed loading bookings.';
      setBookings([]);
      setTotalCount(0);
      setError(message);
      setAccessDenied(String(message).toLowerCase().includes('forbidden'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, search, selectedRoom, statusFilter, paymentFilter, missingOnly, highValueOnly, showExpired, rangePreset, startDate, endDate]);

  const clearPendingCancel = () => {
    if (cancelTimerRef.current) {
      clearTimeout(cancelTimerRef.current);
      cancelTimerRef.current = null;
    }
    setPendingCancel(null);
  };

  const patchBooking = async (bookingId: string, action: string, extra: any = {}) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      alert('Admin session expired. Please sign in again.');
      return false;
    }
    const response = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...extra })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok === false) {
      alert(payload?.error ?? `Failed to ${action}.`);
      return false;
    }
    await loadData();
    return true;
  };

  const executeBulk = async (action: 'cancel' | 'mark_paid' | 'delete', ids: string[]) => {
    if (ids.length === 0) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      alert('Admin session expired. Please sign in again.');
      return;
    }
    setBulkBusy(true);
    try {
      const response = await fetch('/api/admin/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, ids, includeExpired: action === 'cancel' ? includeExpiredInBulk : false })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) {
        alert(payload?.error ?? `Bulk ${action} failed.`);
        return;
      }
      setSelectedIds(new Set());
      await loadData();
    } catch (err: any) {
      alert(err?.message ?? `Bulk ${action} failed.`);
    } finally {
      setBulkBusy(false);
    }
  };

  const bookingById = useMemo(() => {
    const map = new Map<string, Booking>();
    bookings.forEach((b) => map.set(b.id, b));
    return map;
  }, [bookings]);

  const selectedRows = useMemo(
    () => Array.from(selectedIds).map((id) => bookingById.get(id)).filter(Boolean) as Booking[],
    [selectedIds, bookingById]
  );
  const markPaidEligible = selectedRows.filter((b) => isLiveBooking(b));
  const cancelEligible = selectedRows.filter((b) => (includeExpiredInBulk ? (isLiveBooking(b) || isExpiredBooking(b)) : isLiveBooking(b)));

  const runBulk = async (action: 'cancel' | 'mark_paid' | 'delete') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (action === 'mark_paid') {
      if (markPaidEligible.length === 0) {
        alert('Bulk Mark Paid is only available for live bookings (CONFIRMED/PENDING).');
        return;
      }
      await executeBulk(action, markPaidEligible.map((b) => b.id));
      return;
    }

    if (action === 'cancel') {
      if (cancelEligible.length === 0) {
        alert('No eligible live bookings selected for bulk cancel.');
        return;
      }
      const confirmed = confirm(`Cancel ${cancelEligible.length} booking(s)? This updates status and can affect customer communication.`);
      if (!confirmed) return;
      clearPendingCancel();
      setPendingCancel({ ids: cancelEligible.map((b) => b.id), label: `${cancelEligible.length} booking(s)` });
      cancelTimerRef.current = setTimeout(async () => {
        const currentIds = cancelEligible.map((b) => b.id);
        setPendingCancel(null);
        await executeBulk('cancel', currentIds);
      }, CANCEL_UNDO_MS);
      return;
    }

    const confirmed = confirm(`Delete ${ids.length} booking(s)? This cannot be undone.`);
    if (!confirmed) return;
    await executeBulk(action, ids);
  };

  const queueSingleCancel = (booking: Booking) => {
    const label = booking.booking_ref || booking.customer_name || '1 booking';
    const confirmed = confirm(`Cancel "${label}"? This changes booking status and may notify operations.`);
    if (!confirmed) return;
    clearPendingCancel();
    setPendingCancel({ ids: [booking.id], label });
    cancelTimerRef.current = setTimeout(async () => {
      setPendingCancel(null);
      await patchBooking(booking.id, 'cancel');
    }, CANCEL_UNDO_MS);
  };

  const requestDetails = (booking: Booking) => {
    const email = String(booking.customer_email || '').trim();
    if (!email) {
      alert('No customer email is available for this booking.');
      return;
    }
    const subject = encodeURIComponent('Please confirm your booking details');
    const body = encodeURIComponent(`Hi ${booking.customer_name || ''}, please reply with your missing booking details.`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleIds = bookings.map((b) => b.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const exportCsv = async () => {
    try {
      const payload = await fetchWithAdminAuth(`/api/admin/bookings/list?${buildListParams(true).toString()}`);
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      const headers = ['booking_ref', 'customer_name', 'customer_email', 'room_name', 'start_at', 'status', 'payment_state', 'total_price'];
      const csvRows = [headers.join(','), ...rows.map((b: any) => headers.map((h) => `"${String(b[h] ?? '')}"`).join(','))];
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'bookings-export-filtered.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || 'Failed to export CSV.');
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(totalCount, page * PAGE_SIZE);
  const statusCounts = useMemo(() => {
    return bookings.reduce((acc: Record<string, number>, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});
  }, [bookings]);

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-[2.5rem] border-zinc-800 shadow-2xl space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-bold uppercase tracking-widest">
        <div className="bg-zinc-900 rounded-xl p-3">Visible<div className="text-white text-lg">{bookings.length}</div></div>
        <div className="bg-zinc-900 rounded-xl p-3">Filtered total<div className="text-white text-lg">{totalCount}</div></div>
        <div className="bg-zinc-900 rounded-xl p-3">By status<div className="text-white">P:{statusCounts.PENDING || 0} C:{statusCounts.CONFIRMED || 0} X:{statusCounts.EXPIRED || 0}</div></div>
        <div className="bg-zinc-900 rounded-xl p-3">Selection<div className="text-white">{selectedIds.size}</div></div>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((chip) => (
          <button
            key={chip.key}
            onClick={() => {
              if (chip.key === 'live') {
                setStatusFilter('live');
                setShowExpired(false);
              } else if (chip.key === 'missing') {
                setMissingOnly((v) => !v);
              } else if (chip.key === 'high') {
                setHighValueOnly((v) => !v);
              } else if (chip.key === 'today') {
                setRangePreset('today');
              } else if (chip.key === 'week') {
                setRangePreset('week');
              }
            }}
            className="px-3 py-1.5 rounded-full border border-zinc-700 bg-zinc-900 text-[10px] font-bold uppercase tracking-widest hover:border-amber-500/40"
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search" className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm" />
        <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm"><option value="">All rooms</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select value={statusFilter} onChange={(e) => setStatusFilter((e.target.value || 'live') as StatusFilter)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm">
          <option value="live">Live (Confirmed + Pending)</option>
          <option value="all">All status</option>
          <option value={BookingStatus.CONFIRMED}>CONFIRMED</option>
          <option value={BookingStatus.PENDING}>PENDING</option>
          <option value={BookingStatus.CANCELLED}>CANCELLED</option>
          <option value={BookingStatus.EXPIRED}>EXPIRED</option>
        </select>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm"><option value="">All payment</option>{PAYMENT_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <select value={rangePreset} onChange={(e) => setRangePreset(e.target.value as DateRangePreset)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm">
          <option value="all">All dates</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="custom">Custom</option>
        </select>
        {rangePreset === 'custom' && (
          <>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs" />
          </>
        )}
        <label className="text-xs"><input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} /> Missing details</label>
        <label className="text-xs"><input type="checkbox" checked={highValueOnly} onChange={(e) => setHighValueOnly(e.target.checked)} /> High value (£500+)</label>
        <label className="text-xs"><input type="checkbox" checked={showExpired} onChange={(e) => setShowExpired(e.target.checked)} /> Show expired</label>
        <label className="text-xs"><input type="checkbox" checked={includeExpiredInBulk} onChange={(e) => setIncludeExpiredInBulk(e.target.checked)} /> Include expired in bulk cancel</label>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button disabled={selectedIds.size === 0 || bulkBusy || cancelEligible.length === 0} onClick={() => runBulk('cancel')} className="px-3 py-2 text-xs rounded bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed">Bulk Cancel</button>
        <button disabled={selectedIds.size === 0 || bulkBusy || markPaidEligible.length === 0} onClick={() => runBulk('mark_paid')} className="px-3 py-2 text-xs rounded bg-green-900 disabled:opacity-50 disabled:cursor-not-allowed">Bulk Mark Paid</button>
        <button disabled={selectedIds.size === 0 || bulkBusy} onClick={() => runBulk('delete')} className="px-3 py-2 text-xs rounded bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">Bulk Delete</button>
        <button onClick={exportCsv} className="px-3 py-2 text-xs rounded bg-zinc-800">Export CSV (filtered)</button>
      </div>

      {accessDenied ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-8 text-center space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-red-200">You don&apos;t have access to view bookings.</p>
          <button
            type="button"
            onClick={loadData}
            className="px-4 py-2 rounded-xl border border-red-400/40 text-red-100 text-xs font-bold uppercase tracking-widest"
          >
            Try again
          </button>
        </div>
      ) : (
      <div className="border border-zinc-900 rounded-2xl overflow-hidden bg-zinc-950">
        <table className="min-w-full text-left text-[10px] uppercase tracking-widest">
          <thead>
            <tr className="border-b border-zinc-900">
              <th className="px-2"><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} aria-label="Select all visible bookings" /></th>
              <th>Date</th><th>Guest</th><th>Room</th><th>Total</th><th>Status</th><th>Payment</th><th>Badges</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-4 py-6">Loading…</td></tr>}
            {!loading && !error && bookings.map((b) => {
              const missing = hasMissingCustomerDetails(b);
              const expired = isExpiredBooking(b);
              const canLiveAction = !expired && b.status !== BookingStatus.CANCELLED;
              return (
                <tr key={b.id} className={`border-b border-zinc-900 text-white text-[11px] ${expired ? 'opacity-45' : 'opacity-100'}`}>
                  <td className="px-2"><input type="checkbox" checked={selectedIds.has(b.id)} onChange={() => toggleSelect(b.id)} /></td>
                  <td className="px-2">{new Date(b.start_at).toLocaleString()}</td>
                  <td className="px-2">{b.customer_name || '—'}<div className="text-zinc-400">{b.customer_email || '—'}</div></td>
                  <td className="px-2">{b.room_name}</td>
                  <td className="px-2">{asMoney(Number(b.total_price || 0))}</td>
                  <td className="px-2"><span className={`inline-flex px-2 py-1 rounded border ${statusBadgeClass(b)}`}>{statusLabel(b)}</span></td>
                  <td className="px-2">{b.payment_state || PaymentState.NONE}</td>
                  <td className="px-2 space-x-1">
                    {missing && <span className="px-2 py-1 rounded border border-amber-500/30 text-amber-400">Missing customer details</span>}
                    {(Number(b.extras_total || 0) > 0) && <span className="px-2 py-1 rounded border border-cyan-500/30 text-cyan-300">Extras +{asMoney(Number(b.extras_total || 0))}</span>}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => onViewBooking(b)} className="text-amber-400">View</button>
                      <button onClick={() => { setEditingBooking(b); setNotes(b.notes || ''); }} className="text-blue-400">Notes</button>
                      <button disabled={!canLiveAction} onClick={() => patchBooking(b.id, 'send_payment_link')} className="text-purple-400 disabled:opacity-40 disabled:cursor-not-allowed">Send payment link</button>
                      <button disabled={!canLiveAction} onClick={() => patchBooking(b.id, 'mark_paid')} className="text-green-400 disabled:opacity-40 disabled:cursor-not-allowed">Mark paid</button>
                      <button disabled={expired} onClick={() => queueSingleCancel(b)} className="text-red-400 disabled:opacity-40 disabled:cursor-not-allowed">Cancel booking</button>
                      <button onClick={() => requestDetails(b)} className="text-cyan-400">Request details</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
      {!!error && !accessDenied && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          {error}
        </div>
      )}

      <div className="flex justify-between text-xs">
        <span>Showing {pageStart}–{pageEnd} of {totalCount}</span>
        <span>Page {page}/{totalPages} <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button> <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button></span>
      </div>

      {editingBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-zinc-900 rounded-xl p-6 w-[500px] max-w-[95vw]">
            <h3 className="font-bold mb-2">Edit notes</h3>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={NOTES_MAX_LENGTH} className="w-full h-36 bg-zinc-950 border border-zinc-800 p-3 rounded" />
            <div className="text-xs text-zinc-400 mt-1">{notes.length}/{NOTES_MAX_LENGTH}</div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setEditingBooking(null)} className="px-3 py-2 bg-zinc-800 rounded">Close</button>
              <button onClick={() => {
                const v = validateNotesInput(notes);
                if (!v.ok) { alert(v.error); return; }
                patchBooking(editingBooking.id, 'update_notes', { notes });
                setEditingBooking(null);
              }} className="px-3 py-2 bg-amber-500 text-black rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      {pendingCancel && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-200">Cancellation queued for {pendingCancel.label}.</span>
            <button onClick={clearPendingCancel} className="text-xs font-bold uppercase tracking-widest text-amber-400 hover:text-amber-300">Undo</button>
          </div>
        </div>
      )}
    </div>
  );
}
