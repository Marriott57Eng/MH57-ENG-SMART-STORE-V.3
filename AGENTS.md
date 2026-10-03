# Project Instructions & Permanent Rules

## 1. Logo & Branding (CRITICAL - DO NOT MODIFY)
- The official app logo is the specific 3D graphic provided by the user: **"ENG SMART STORE APP"** with neon blue & orange lighting and industrial tools/parts background (`src/assets/logo.png` and `public/logo.png`).
- **NEVER** replace, regenerate, delete, overwrite, or alter the logo image or the `EngLogo` component under any circumstances.
- `EngLogo` in `/src/components/EngLogo.tsx` must always render the user's authentic logo image.

## 2. Voice Assistant & Input Positioning
- The AI Voice & Chat input area in `src/components/VoiceAssistantView.tsx` must maintain a minimum bottom padding of `max(108px, calc(env(safe-area-inset-bottom, 24px) + 90px))` to prevent any collision or occlusion with the fixed bottom navigation bar (`MobileNavbar`).

## 3. RBAC Permissions in AI Assistant & Reports
- PDF report exports (both in the UI and via AI Voice/Live Speech) are strictly restricted to Admin only. Staff (User role) can perform requisitions, stock-in, and inventory inquiries. Direct manual stock adjustments or editing item names from AI are restricted to Admin only.
