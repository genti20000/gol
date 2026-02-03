# Special Requests Implementation - Complete Audit & Fix

**Date:** 3 February 2026  
**Status:** ✅ Complete

## Summary

Comprehensive audit of the karaoke booking app database and application revealed that special requests (notes) were being collected in the checkout form but **not fully displayed to customers** in the ManageBooking view. Additionally, a dedicated `special_requests` column was missing from the database schema for explicit tracking separate from internal notes.

### What Was Missing

1. **Database Schema:** No dedicated `special_requests` column (only generic `notes` field existed)
2. **ManageBooking View:** Placeholder comment instead of actual booking details display - customers couldn't see their bookings
3. **Type System:** TypeScript types didn't include `special_requests` field
4. **Admin Dashboard:** No UI to edit customer special requests separately from internal notes
5. **API Routes:** `special_requests` not being passed through the booking endpoints

## Changes Implemented

### 1. Database Migration ✅

**File:** New migration applied via Supabase
```sql
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS special_requests TEXT;

UPDATE bookings 
SET special_requests = notes 
WHERE special_requests IS NULL AND notes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_special_requests ON bookings(special_requests);
```

**Effect:** 
- Added explicit tracking of customer special requests
- Backfilled existing booking notes to special_requests for data continuity
- Created index for efficient searching/filtering by special requests

### 2. Type Definitions ✅

**File:** `types.ts`

Added `special_requests` field to the `Booking` interface:
```typescript
export interface Booking {
  // ... existing fields
  special_requests?: string; // Customer-provided special requests
  // ... other fields
}
```

### 3. API Endpoints Updated ✅

#### a) `app/api/bookings/create-draft/route.ts`
- Added `specialRequests` to `DraftRequest` type
- Passed `specialRequests` to `buildDraftBookingPayload()` function

#### b) `app/api/bookings/init/route.ts`
- Added `specialRequests: null` to booking payload initialization
- Ensures consistency across all booking creation paths

#### c) `app/api/bookings/[id]/update/route.ts`
- Added `specialRequests` to `UpdateRequest` type
- Handles updates to special_requests field:
  ```typescript
  if (payload.specialRequests !== undefined) 
    updates.special_requests = payload.specialRequests;
  ```

### 4. Booking Payload Builder ✅

**File:** `lib/bookingPayload.js`

- Added `specialRequests = null` parameter to `buildDraftBookingPayload()` function
- Included `special_requests: specialRequests || null` in returned payload

### 5. Frontend Views Updated ✅

#### a) Checkout View (`views/Checkout.tsx`)
- Special requests already captured in `formData.notes`
- Now explicitly passed as `special_requests: formData.notes` to booking object for clarity

#### b) ManageBooking View (`views/ManageBooking.tsx`) - **MAJOR FIX**

**Problem:** Had placeholder `{/* ... Details remain unchanged ... */}` - was not displaying booking information at all

**Solution:** Implemented complete booking details display including:
- Status badge with color coding (CONFIRMED=green, PENDING=amber, CANCELLED=red)
- Booking reference number
- Date and time formatting with helper functions
- Room and guest count
- Guest information (name, email, phone)
- **Special requests section** - displays notes/special requests with proper formatting
- Pricing breakdown showing:
  - Base total
  - Extras price
  - Additional items (extras_total)
  - Discounts and promo codes
  - Final total price
- Action buttons (Reschedule/Cancel with proper cutoff validation)

#### c) Admin Dashboard (`views/Admin.tsx`)

**BookingModal Updates:**
- Added `specialRequests` to form state initialization
- Added "Special Requests (Customer)" textarea field in the form UI
- Included `special_requests: formData.specialRequests` in the save patch
- Separated from internal notes for clarity

### 6. Key Features Implemented

#### Special Requests Flow:
```
Customer enters special requests in Checkout.tsx
    ↓
Passed through API (create-draft/init/update endpoints)
    ↓
Stored in database as both 'notes' and 'special_requests'
    ↓
Retrieved and displayed in ManageBooking view to customer
    ↓
Viewable/editable in Admin Dashboard
```

#### ManageBooking Display:
- Customers can now see complete booking information via magic link
- Includes their special requests/notes prominently displayed
- Shows full pricing breakdown
- Displays status and booking reference
- Date/time formatting is user-friendly (e.g., "Wed, 3 Feb 2026" instead of ISO)

#### Admin Dashboard:
- Can now view and edit customer special requests separately from internal notes
- Special requests clearly labeled as "(Customer)" to distinguish from internal notes
- Both fields stored independently in database for audit trail

## Testing Checklist

- [x] Database migration applied successfully
- [x] No TypeScript compilation errors
- [x] Types properly reflect new `special_requests` field
- [x] All API endpoints accept and pass special_requests parameter
- [x] ManageBooking view displays complete booking details
- [x] Special requests displayed correctly in customer view
- [x] Admin can edit special requests
- [x] Existing bookings backfilled with special_requests data

## Data Integrity

✅ **Backward Compatible:**
- All existing bookings retain their `notes` data
- `special_requests` backfilled from `notes` automatically via migration
- No data loss

## Files Modified

1. `types.ts` - Added special_requests field to Booking interface
2. `app/api/bookings/create-draft/route.ts` - Added specialRequests parameter
3. `app/api/bookings/init/route.ts` - Added specialRequests initialization
4. `app/api/bookings/[id]/update/route.ts` - Added specialRequests update handler
5. `lib/bookingPayload.js` - Added specialRequests to payload builder
6. `views/Checkout.tsx` - Explicit special_requests assignment
7. `views/ManageBooking.tsx` - **Complete rewrite with full booking details display**
8. `views/Admin.tsx` - Added special requests field to booking modal

## Database Changes

**Migration Created:** `add_special_requests_column`
- Added `special_requests TEXT` column to bookings table
- Created index for performance
- Backfilled existing data

## Performance Impact

- ✅ Added single index on `special_requests` for efficient queries
- ✅ Column is nullable - no performance penalty for bookings without requests
- ✅ Minimal database size increase

## Notes

- Special requests can be up to the database's TEXT column limit (typically very large)
- Customers can update special requests during booking process
- Admin can edit anytime
- Both customer-provided (`special_requests`) and internal notes (`notes`) are tracked separately
- Special requests are prominently displayed to customers in their booking management page

---

**Implementation verified:** No compilation errors, all data flows complete ✅
