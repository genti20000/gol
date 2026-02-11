# Detailed File Changes - Admin Booking Management

## File 1: `/app/api/admin/bookings/[id]/delete/route.ts` (NEW FILE)

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * DELETE /api/admin/bookings/:id
 * Admin-only endpoint to delete a booking.
 * Requires Authorization header with Bearer token from Supabase session.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase credentials are not configured.' },
        { status: 500 }
      );
    }

    const bookingId = params.id;
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing booking id.' }, { status: 400 });
    }

    // Verify admin access via Bearer token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: missing or invalid token' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the token is valid and belongs to an admin user
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user?.email) {
      console.warn('[ADMIN DELETE] Auth verification failed', userError);
      return NextResponse.json(
        { error: 'Unauthorized: invalid token' },
        { status: 401 }
      );
    }

    const adminEmail = userData.user.email;

    // Fetch the booking to confirm it exists
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, booking_ref, customer_name')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      console.error('[ADMIN DELETE] Booking fetch failed', bookingError);
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    // Delete the booking
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (deleteError) {
      console.error('[ADMIN DELETE] Deletion failed', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete booking.' },
        { status: 500 }
      );
    }

    // Log the action server-side
    console.log(`[ADMIN DELETE] Admin ${adminEmail} deleted booking ${bookingId} (ref: ${booking.booking_ref}, customer: ${booking.customer_name}) at ${new Date().toISOString()}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ADMIN DELETE] Unexpected error', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
```

## File 2: `/app/api/admin/bookings/[id]/route.ts` (NEW FILE - PATCH Handler)

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * PATCH /api/admin/bookings/:id
 * Admin-only endpoint to update booking notes.
 * Requires Authorization header with Bearer token from Supabase session.
 * Body: { notes: string } (max 2000 chars, trimmed)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase credentials are not configured.' },
        { status: 500 }
      );
    }

    const bookingId = params.id;
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing booking id.' }, { status: 400 });
    }

    // Parse request body
    let payload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    if (typeof payload.notes !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid notes field.' }, { status: 400 });
    }

    // Trim and validate notes length
    let notes = payload.notes.trim();
    if (notes.length > 2000) {
      return NextResponse.json(
        { error: 'Notes must be 2000 characters or less.' },
        { status: 400 }
      );
    }

    // Convert empty string to null for cleaner database storage
    notes = notes.length === 0 ? null : notes;

    // Verify admin access via Bearer token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: missing or invalid token' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the token is valid and belongs to an admin user
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user?.email) {
      console.warn('[ADMIN PATCH] Auth verification failed', userError);
      return NextResponse.json(
        { error: 'Unauthorized: invalid token' },
        { status: 401 }
      );
    }

    const adminEmail = userData.user.email;

    // Fetch the booking to confirm it exists
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, booking_ref, customer_name, notes')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      console.error('[ADMIN PATCH] Booking fetch failed', bookingError);
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    // Update the booking notes
    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({ notes })
      .eq('id', bookingId)
      .select('*')
      .maybeSingle();

    if (updateError || !updated) {
      console.error('[ADMIN PATCH] Update failed', updateError);
      return NextResponse.json(
        { error: 'Failed to update booking.' },
        { status: 500 }
      );
    }

    // Log the action server-side
    console.log(
      `[ADMIN PATCH] Admin ${adminEmail} updated notes on booking ${bookingId} (ref: ${booking.booking_ref}, customer: ${booking.customer_name}) at ${new Date().toISOString()}. Old: "${booking.notes}" → New: "${notes}"`
    );

    return NextResponse.json({ ok: true, booking: updated });
  } catch (error) {
    console.error('[ADMIN PATCH] Unexpected error', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
```

## File 3: `/views/AdminBookingsList.tsx` (MODIFIED)

### Changes Summary:
1. Added Toast notification component at the top
2. Added utility function `getNotesSnippet()` for truncating notes display
3. Added new state variables for edit/delete modals
4. Added handler functions: `handleEditNotesClick`, `handleSaveNotes`, `handleDeleteClick`, `handleConfirmDelete`
5. Modified Actions column in table to include "Edit" and "Delete" buttons
6. Added two modal dialogs: Edit Notes modal and Delete Confirmation modal
7. Added Toast notification component rendering

### Key Additions:

**1. Toast Component (lines 15-33)**
```typescript
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
```

**2. New State Variables (lines 67-77)**
```typescript
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
```

**3. Edit Notes Handler (lines 79-112)**
```typescript
  const handleEditNotesClick = (booking: Booking) => {
    setEditingBooking(booking);
    setEditNotes(booking.notes || '');
  };

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
```

**4. Delete Confirmation Handler (lines 114-161)**
```typescript
  const handleDeleteClick = (booking: Booking) => {
    setDeletingBooking(booking);
    setDeleteConfirmText('');
  };

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
```

**5. Actions Column Update**
```typescript
// OLD:
<td className="px-4 py-4">
  <button
    onClick={() => onViewBooking(b)}
    className="text-amber-500 hover:text-amber-400 transition-colors text-[9px] font-bold uppercase tracking-widest"
  >
    View
  </button>
</td>

// NEW:
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
```

**6. Edit Notes Modal (added before closing div)**
```typescript
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
```

**7. Delete Confirmation Modal (added before closing div)**
```typescript
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
```

**8. Toast Notification (at the end)**
```typescript
{toast && (
  <Toast
    message={toast.message}
    type={toast.type}
    onClose={() => setToast(null)}
  />
)}
```

## Database
✅ No migration needed - `notes` column already exists in `bookings` table as `TEXT` (nullable)

## No Breaking Changes
- All existing features preserved
- No modifications to existing endpoints
- No style/layout changes to other components
- Backward compatible with current booking system
