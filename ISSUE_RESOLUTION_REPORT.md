# London Karaoke Club - Issue Resolution Report

## Issues Fixed ✅

### Issue #6: Lead Time Controls Not Enforced + Saved Indicator Consistency
**Status:** ✅ FIXED  
**Severity:** High  
**Before:** Min Days/Hours settings existed but were not applied to public availability results.  
**After:** Lead time rules now filter available start times in `store.getValidStartTimes`, enforcing both minimum days and hours.

---

### Issue #7: Extras Configuration Not Persisting
**Status:** ✅ FIXED  
**Severity:** High  
**Before:** Extras updates used camelCase fields that didn’t map to Supabase columns (e.g., `pricingMode`).  
**After:** Extras add/update now map to `pricing_mode`/`sort_order` correctly and persist changes.

---

### Issue #8: Add Session Modal Missing Surname + Existing Customer Selection
**Status:** ✅ FIXED  
**Severity:** Medium  
**Before:** Admin booking modal only captured a single name field; no quick select from CRM.  
**After:** Added First Name + Surname fields and an Existing Guest dropdown to prefill details.

---

### Issue #9: Calendar View Missing Guest Count
**Status:** ✅ FIXED  
**Severity:** Low  
**Before:** Timeline blocks showed only customer name.  
**After:** Timeline blocks now show full name + guest count range.

---

### Issue #3: Customers Not Auto-Synced to CRM After Booking
**Status:** ✅ FIXED  
**Severity:** Medium  
**Solution:** 
- Modified `addBooking` function in `store.tsx` to automatically create or update customer records
- When a booking is created, the system now:
  - Checks if customer exists by email
  - If exists: Updates total bookings, total spend, and last booking date
  - If new: Creates customer record with full name (first + surname), email, phone
  - Non-blocking: Booking succeeds even if customer sync fails
- Customers now automatically appear in GUEST CRM after booking confirmation

---

## Issues Requiring User Action 🔧

### Issue #1: Extras/Promos Features Not Implemented
**Status:** ⚠️ USER CLARIFICATION NEEDED  
**Severity:** High  
**Analysis:** 
The code shows that Extras and Promos sections ARE fully implemented in the Settings tab:
- **EXTRAS Configuration** (line 929-959 in Admin.tsx):
  - "Add Extra" button functional
  - Edit name, price, pricing mode (flat/per person)
  - Enable/disable visibility toggle
  - Delete extras
- **PROMOS Configuration** (line 994-1030 in Admin.tsx):
  - "Create Promo" button functional
  - Edit promo code, discount (% or £)
  - Enable/disable toggle
  - Delete promos

**Possible Causes:**
1. User may be clicking wrong navigation (SETTINGS tab has sub-sections: venue, hours, services, **promos**, **extras**, sync)
2. Data not loading from Supabase (check browser console for errors)
3. Browser caching issue (try hard refresh: Cmd+Shift+R)

**Recommendation:** Please verify you're navigating to: Admin Console > SETTINGS tab > Click "PROMOS CONFIGURATION" or "EXTRAS CONFIGURATION" in the left sidebar

---

### Issue #2: Hours Settings Not Persisting
**Status:** ⚠️ NEEDS INVESTIGATION  
**Severity:** High  
**Analysis:**
The operating hours are in a separate "HOURS CONFIGURATION" section (not in "GENERAL SETTINGS"):
- Navigate to: Admin Console > SETTINGS > HOURS CONFIGURATION
- Each day has toggle + time inputs
- Uses `store.updateOperatingHours()` with auto-save

**Possible Causes:**
1. User may be looking in wrong section (GENERAL SETTINGS vs HOURS CONFIGURATION)
2. Supabase permissions issue
3. Database schema mismatch

**Recommendation:** 
1. Navigate to SETTINGS > HOURS CONFIGURATION (separate from General Settings)
2. Check browser console for Supabase errors when changing hours
3. Verify the migration was run successfully

---

### Issue #4: Booking Registry Display Discrepancy
**Status:** ⚠️ NEEDS CLARIFICATION  
**Severity:** Low  
**Analysis:**
Time display shows:
- Calendar: 20:00 (24-hour format)
- Registry: 08:15 PM (12-hour format with minutes)

This appears to be a formatting difference, not a time difference. The "15" in "08:15 PM" suggests the booking is actually at 20:15, not 20:00.

**Questions:**
1. Is the actual booking time 20:00 or 20:15?
2. Should both displays use the same format (24-hour or 12-hour)?

**Recommendation:** Please provide screenshot showing both displays for the same booking

---

### Issue #5: Search Functionality Not Working in CRM
**Status:** ⚠️ NEEDS TESTING  
**Severity:** Medium  
**Analysis:**
The search code (line 604-607 in Admin.tsx) looks correct:
```tsx
const filtered = store.customers.filter((c: Customer) =>
  c.name.toLowerCase().includes(search.toLowerCase()) ||
  c.email.toLowerCase().includes(search.toLowerCase())
)
```

**Possible Causes:**
1. No customers in database yet (was empty before fix #3)
2. Case sensitivity issue
3. Customer name format mismatch

**Recommendation:** 
1. Create a test booking to populate CRM (now that auto-sync is fixed)
2. Try searching for the customer name or email
3. Check browser console for JavaScript errors

---

## Next Steps

1. **Run the database migration** (if not done yet):
   - File: `/Users/gigent/fila/gol/migration_add_surname_and_booking_ref.sql`
   - This adds surname and booking_ref fields

2. **Test the fixes**:
   - Create a new booking
   - Verify customer appears in GUEST CRM automatically
   - Test search functionality with the new customer

3. **Clarify remaining issues**:
   - Provide screenshots for issues #1, #2, #4
   - Test issue #5 after creating test bookings

---

## Summary

- ✅ **1 issue fixed** (Auto-sync customers to CRM)
- ⚠️ **4 issues need clarification/testing**
- 📝 **Migration script ready** to add surname/booking_ref fields

All code changes have been committed and pushed to the repository.
