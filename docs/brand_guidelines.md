# Metamorph Frontend - Brand Guidelines

> **Philosophy**: Shared Framework, Distinct Identity.
>
> The Metamorph Member App (`metamorph-frontend`) shares the same underlying design system (Nuxt UI) as the Coach App (`metamorph-coach`) but employs a distinct visual identity to differentiate the user experiences.

## 1. Core Identity

| Attribute | Coach App | Member App |
| :--- | :--- | :--- |
| **Primary Color** | **Cobalt** (`blue`) | **Teal** (`teal`) |
| **Neutral Color** | **Slate** (`slate`) | **Slate** (`slate`) |
| **Default Mode** | **Dark** (Professional, High Contrast) | **Light** (Accessible, Friendly) |
| **Typography** | Public Sans | Public Sans |
| **Iconography** | Heroicons (Outline/Solid) | Heroicons (Outline/Solid) |

## 2. Color Palette

### Primary: Metamorph Teal
A vibrant, energetic teal that signifies growth, balance, and vitality. Used for primary actions, active states, and branding elements.

| Token | Hex | Usage |
| :--- | :--- | :--- |
| `teal-50` | `#F0FDFA` | Backgrounds (Subtle) |
| `teal-100` | `#CCFBF1` | |
| `teal-200` | `#99F6E4` | |
| `teal-300` | `#5EEAD4` | |
| `teal-400` | `#2DD4BF` | |
| `teal-500` | `#14B8A6` | **Primary Brand Color** |
| `teal-600` | `#0D9488` | Hover States |
| `teal-700` | `#0F766E` | |
| `teal-800` | `#115E59` | |
| `teal-900` | `#134E4A` | |
| `teal-950` | `#042F2E` | Text / Dark Backgrounds |

### Neutral: Slate
Shared with the Coach app to maintain consistency in text and structural elements.

| Token | Hex | Usage |
| :--- | :--- | :--- |
| `slate-50` | `#F8FAFC` | App Background (Light Mode) |
| `slate-100` | `#F1F5F9` | Card Backgrounds (Light Mode) |
| `slate-500` | `#64748B` | Secondary Text |
| `slate-900` | `#0F172A` | Primary Text |

## 3. Typography

**Font Family**: `Public Sans`
A strong, geometric sans-serif that balances readability with a modern tech feel.

- **Headings**: `font-bold` or `font-semibold`
- **Body**: `font-normal`
- **UI Elements**: `font-medium`

### Usage Example
```css
/* tailwind.css */
@theme static {
  --font-sans: 'Public Sans', sans-serif;
}
```

## 4. Components & Styling

### Design 
- **Radius**: `rounded-lg` (Standard) or `rounded-xl` (Cards/Modals)
- **Shadows**: Soft, diffused shadows for depth in Light Mode.
- **Glassmorphism**: Sparse use in overlays or sticky headers.

### UI Kit (Nuxt UI)
Configure `app.config.ts` to apply the identity:

```typescript
export default defineAppConfig({
  ui: {
    primary: 'teal',
    gray: 'slate',
    button: {
      rounded: 'rounded-lg'
    },
    card: {
      rounded: 'rounded-xl'
    }
  }
})
```

## 5. Implementation Steps

1.  **Install Font**: Ensure `Public Sans` is available (via Google Fonts or `@fontsource`).
2.  **Configure Theme**: Update `app.config.ts`.
3.  **Define Colors**: Add custom Teal palette to `app/assets/css/main.css` if diverging from Tailwind defaults, or use standard Tailwind colors if they match the hexes above.
4.  **Set Defaults**: Ensure `nuxt.config.ts` sets `colorMode: { preference: 'light' }`.
