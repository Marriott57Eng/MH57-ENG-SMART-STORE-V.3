# UI Overhaul: Warm Cream Theme, Mitr Typography & Motion Engine

A comprehensive design and motion overhaul inspired by the "NABTANG" reference video, transforming the interface into a warm cream & soft pastel aesthetic with rounded friendly Thai typography (Mitr), rolling spring number counters, tactile micro-interactions, and smooth spring-animated cards and bottom sheets.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following directions have been confirmed based on your selections:
> - **Color Theme & Card Style**: Warm cream & soft pastel aesthetic (`#F9F6F0` parchment canvas, warm card surfaces, soft sage green for stock-in, warm terracotta for stock-out, and warm amber for alerts).
> - **Typography**: **Mitr** (Google Fonts) as the primary rounded, friendly modern Thai font across the entire interface.
> - **Motion Suite**: Smooth rolling number ticker on inventory totals & metric badges, spring physics on cards & bottom sheets, and tactile button tap feedback (`whileTap={{ scale: 0.96 }}`).
> - **Permanent Rules Maintained**: Official 3D **ENG SMART STORE** logo remains unaltered, AI Voice Assistant bottom padding remains collision-free (`≥ 108px`), and Admin-only PDF exports are preserved.

---

## 1. Overview & Core Concept

- **What It Does**: Upgrades the mobile and desktop experience of the MH57 ENG Store App to match the refined aesthetic shown in the reference video: a soft paper/oatmeal background, tactile rounded cards with subtle drop shadows, friendly rounded Thai typography, and playful spring animations when inspecting stock or executing requisitions.
- **Target Audience**: Hotel engineering staff, technicians, and store supervisors who perform daily stock counts, check-outs, and requisitions with rapid, delightful visual clarity.
- **Key Value**: Replaces the clinical corporate look with a warm, modern, tactile consumer-grade application feel that makes daily logging and inventory tracking engaging and easy on the eyes.

---

## 2. User Experience & Visual Design

### Visual Identity & Theme
- **Canvas & Surface Palette (Warm Paper / Cream)**:
  - Background Canvas: Warm Oatmeal / Cream (`#F9F6F0` light mode, `#1C1B19` warm dark mode).
  - Primary Cards: Clean Warm White (`#FFFFFF` / `#252321` dark) with soft warm border (`#EFE8DE` / `#35322D`) and gentle ambient shadow (`0 2px 14px -2px rgba(80, 60, 40, 0.05)`).
  - Semantic Pastel Accents:
    - **Stock-In / Positive**: Soft Muted Sage (`#3D7A58` text, `#E8F3EB` soft background).
    - **Stock-Out / Requisition**: Warm Terracotta / Coral (`#C85A48` text, `#FBEAE7` soft background).
    - **Low Stock / Pending**: Warm Honey Amber (`#C08237` text, `#FEF4E8` soft background).
    - **Primary Brand Accent**: Warm Deep Slate / Warm Espresso (`#2C2723` / `#E8E2D9`).

### Typography & Hierarchy
- **Font Stack**: **"Mitr"**, with fallback to `"Prompt"`, `"Sarabun"`, and `system-ui`.
  - Display & KPI Headings: `font-family: 'Mitr', sans-serif; font-weight: 600`.
  - Body Text & Labels: `font-family: 'Mitr', sans-serif; font-weight: 400 / 500`.
  - Numbers & Counters: Monospaced tabular figure support (`tabular-nums`) with smooth rolling counter animation.

### Motion & Micro-interactions
1. **Rolling Number Ticker (`RollingNumber` component)**:
   - When stock count, total items, or requisition quantities change, the numbers animate with a vertical spring roll (digit-by-digit rolling reel transition) instead of abruptly snapping.
2. **Spring Physics Cards & Staggered Enters**:
   - Inventory item cards, requisition history items, and metric summary boxes enter with staggered spring slide-and-scale (`stiffness: 350, damping: 26`).
3. **Tactile Tap Responses**:
   - All interactive action chips, quick buttons, and cards depress slightly on press (`whileTap={{ scale: 0.96 }}`), providing instant sensory feedback.
4. **Spring Bottom Sheet / Drawer**:
   - Quick requisition modal, item detail modal, and filter panels slide in with smooth iOS-style spring damping with a top drag-handle pill.
5. **Floating Bottom Navigation Bar**:
   - Soft pill style navigation with subtle icon bounce on tab selection.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full-App Typography Switch to Mitr**
  - *Chosen Approach*: Configure `Mitr` as the primary font family in global CSS (`body`, buttons, inputs, card titles).
  - *Why*: Mitr provides the exact friendly, rounded, modern aesthetic shown in the "NABTANG" video clip, with excellent Thai & English glyph pairing.
  - *PDF Reports*: PDF export generation in `pdfGenerator.ts` will maintain its reliable font stack to protect strict printable layout boundaries.
- **Decision 2: Reusable Spring Motion Primitives with `motion`**
  - *Chosen Approach*: Implement a lightweight `<RollingNumber />` component using Motion, and apply spring variants across existing components (`ItemCard`, `SummaryHeader`, `MobileNavbar`, `RequisitionModal`).
  - *Why*: The app already has `"motion": "^12.23.24"` installed in `package.json`, allowing 60fps hardware-accelerated transitions with zero bundle overhead.
- **Decision 3: Preservation of Strict System Constraints**
  - *Official Logo*: `EngLogo` remains completely untouched.
  - *Voice Assistant Padding*: Bottom padding of `max(108px, calc(env(safe-area-inset-bottom, 24px) + 90px))` is strictly kept to avoid navigation overlap.
  - *RBAC*: PDF export restrictions and user role permissions are preserved.

---

## 4. Technical Architecture & Component Hierarchy

```
┌────────────────────────────────────────────────────────┐
│                      App.tsx                           │
│  • Warm Cream Background Canvas (#F9F6F0)              │
│  • Mitr Font Root Typography                           │
└──────────────────────────┬─────────────────────────────┘
                           │
         ┌─────────────────┼──────────────────┐
         ▼                 ▼                  ▼
┌──────────────────┐ ┌───────────────┐ ┌───────────────┐
│ SummaryHeader    │ │ InventoryGrid │ │ MobileNavbar  │
│ • RollingNumber  │ │ • ItemCard    │ │ • Spring Tabs │
│   for Totals     │ │   Spring Tap  │ │ • Tactile Tap │
│ • Pastel Cards   │ │ • Pastel Tags │ │ • Pill Glass  │
└──────────────────┘ └───────────────┘ └───────────────┘
         │                 │                  │
         └─────────────────┼──────────────────┘
                           ▼
             ┌───────────────────────────┐
             │ Modals & Bottom Sheets    │
             │ • ItemDetailModal         │
             │ • RequisitionModal        │
             │ • VoiceAssistantView      │
             │   (≥108px bottom padding) │
             └───────────────────────────┘
```

### Component & Implementation Plan
1. **Typography & Global CSS (`index.html`, `src/index.css`)**:
   - Set Mitr as primary default font across the app.
   - Define warm cream and soft pastel CSS variables (`--bg-canvas`, `--surface-card`, `--accent-sage`, `--accent-terracotta`, `--accent-amber`).
2. **Rolling Number Engine (`src/components/RollingNumber.tsx`)**:
   - Create a smooth rolling digit component using `motion` that splits digits and rolls smoothly up/down when values change.
3. **Card & Grid Visual Refresh (`src/components/ItemCard.tsx`, `App.tsx`)**:
   - Restyle item cards with soft warm borders, rounded-2xl geometry, tactile press springs, and pastel status indicators.
4. **Header & Metric Counters (`App.tsx`, `src/components/SummaryHeader.tsx`)**:
   - Apply `RollingNumber` to total inventory quantity, low-stock count, and daily requisition summaries.
5. **Bottom Sheet & Navigation Polish (`src/components/MobileNavbar.tsx`, Modals)**:
   - Add spring bounce animations and tactile interactions.
6. **Verification & Audit**:
   - Run `lint_applet` and `compile_applet`.
   - Verify layout responsiveness on both mobile (390px) and desktop (1440px).
