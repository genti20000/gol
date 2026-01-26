"use client";

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

  if (store.loading) return <div className="p-20 text-center font-bold animate-pulse text-zinc-500 uppercase tracking-widest text-xs">Initialising Admin Console...</div>;

  return (
    <div className="min-h-screen pb-20 px-4 pt-8 md:max-w-7xl md:mx-auto">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
        <div className="flex items-center gap-6">
           <img src={LOGO_URL} alt="Logo" className="h-10 opacity-60" />
           <div>
             <h2 className="text-3xl font-bold uppercase tracking-tighter text-white">Console</h2>
             <p className="text-zinc-500 font-bold uppercase tracking-widest text-[9px]">LKC Private Operations</