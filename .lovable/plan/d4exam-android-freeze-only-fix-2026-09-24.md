# D4EXAM Android Freeze-Only Fix

## Scope

Fix the Android WebView becoming untappable after menus, dialogs, selects, or route changes. Preserve the current design, features, website, backend, authentication, database, and examination behavior.

## Changes

1. **Harden interaction recovery**
   - Update the existing UI unlock helper to restore pointer events and scrolling on `body` and `html`.
   - Remove stale scroll-lock attributes and Radix focus guards.
   - Disable only closed/invisible fixed overlays; never interfere with a genuinely open dialog or menu.
   - Run the safety check after touch, click, focus, hash navigation, browser/native back, and on a short 200ms interval.

2. **Centralize Radix cleanup**
   - Add close-time unlock handling to the shared Dialog, Dropdown Menu, Select, Sheet, and Popover wrappers.
   - Preserve each caller's existing `onOpenChange` behavior.

3. **Keep the main app menu native-safe**
   - Retain the existing custom app drawer instead of Radix Sheet.
   - Ensure the menu button always opens it and remains above stale overlays.
   - Keep menu items as TanStack Links, close the drawer without preventing navigation, and unlock after route changes.
   - Replace the public mobile Radix Sheet with the same safe custom-drawer pattern if it can trigger the shared lock.

4. **Remove route-gate stalls**
   - Return immediately from `requireRole` when a complete matching session is already in React Query.
   - On native Android, read the local session first and cap authentication/network checks at roughly 300ms.
   - Never wait for repair or secondary network calls while offline; preserve redirects and role security.

5. **Avoid first-paint contention**
   - Keep push, realtime, and dashboard refresh work non-blocking.
   - Disable periodic navigation badge requests while offline rather than allowing repeated failed requests.

## Configuration checks

- Confirm Capacitor uses `webDir: "dist"` and has no production `server.url`.
- Confirm the APK router uses `createHashHistory()`.
- Do not modify backend configuration or generated backend client files.

## Verification

- Rebuild the local Capacitor bundle only; do not run a long Android/Gradle build.
- Reproduce native mode with external network blocked and a cached signed-in session.
- Verify splash completion, repeated menu open/close, multiple route changes, inputs/buttons after many taps, browser/native back behavior, and no invisible blocking layer.
- Repeat the navigation check online and verify backend requests can still run.
- Report any limitation that requires a physical handset instead of claiming it was tested.
