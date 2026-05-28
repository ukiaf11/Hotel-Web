# Document 19: Hotel Ordering Platform - Global UI/UX Design System Specification

This document details the global CSS variables, color tokens, typography scales, spacing units, transition curves, and reusable core component configurations that define the visual aesthetic of the platform.

---

## 1. Design System & Style Guide

### A. Color Palette (Modern Premium HSL Standards)
The color palette uses HSL (Hue, Saturation, Lightness) custom properties for smooth styling transitions, contrast matching, and dark mode overrides:

| Variable Name | HSL Value | Description |
|---|---|---|
| `--color-brand` | `hsl(28, 90%, 55%)` | Primary food brand orange. Vibrant accent. |
| `--color-brand-glow` | `hsl(28, 90%, 55%, 0.15)` | Transparent brand glow for focus rings. |
| `--color-success` | `hsl(142, 70%, 45%)` | Status indicator (Open, Active, Completed). |
| `--color-warning` | `hsl(38, 90%, 50%)` | Warning indicators (Pre-Order, Alert). |
| `--color-danger` | `hsl(0, 85%, 60%)` | Deletion, Rejection, Cancellation. |
| `--color-bg-dark` | `hsl(220, 15%, 10%)` | Core background for dark elements. |
| `--color-bg-light` | `hsl(210, 20%, 98%)` | Primary application canvas base color. |
| `--color-card-bg` | `hsl(0, 0%, 100%)` | Elevated surface for hotel/item cards. |
| `--color-text-main` | `hsl(220, 15%, 15%)` | Dominant text color (High contrast). |
| `--color-text-muted` | `hsl(220, 10%, 45%)` | Subtext and captions. |

---

## 2. Global CSS Variables Settings (`src/styles/variables.css`)

```css
:root {
  /* Colors */
  --brand-primary: hsl(28, 90%, 55%);
  --brand-hover: hsl(28, 85%, 48%);
  --status-open: hsl(142, 60%, 45%);
  --status-closed: hsl(0, 75%, 50%);
  
  /* Backgrounds & Canvas */
  --canvas-light: hsl(210, 20%, 98%);
  --surface-card: hsl(0, 0%, 100%);
  --border-light: hsl(210, 14%, 90%);
  
  /* Typography Scale */
  --font-family-headings: 'Outfit', sans-serif;
  --font-family-body: 'Inter', sans-serif;
  
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 2rem;
  
  /* Elevation Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 12px 30px rgba(0,0,0,0.12);
  
  /* Layout Dimensions */
  --header-height: 70px;
  --border-radius-sm: 6px;
  --border-radius-md: 12px;
  --border-radius-lg: 20px;
  
  /* Motion & Transitions */
  --transition-bezier: cubic-bezier(0.25, 0.8, 0.25, 1);
  --transition-speed: 0.25s;
}
```

---

## 3. Shared Reusable Core Components

### A. Primary Button (`<Button />`)
- **Aesthetic**: Premium flat design with subtle gradients and glassmorphism.
- **CSS Specification**:
  ```css
  .btn-primary {
    background: linear-gradient(135deg, var(--brand-primary), var(--brand-hover));
    color: #ffffff;
    font-family: var(--font-family-headings);
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border-radius: var(--border-radius-md);
    border: none;
    box-shadow: 0 4px 14px var(--color-brand-glow);
    transition: transform var(--transition-speed) var(--transition-bezier),
                box-shadow var(--transition-speed) var(--transition-bezier);
    cursor: pointer;
  }
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px var(--color-brand-glow);
  }
  .btn-primary:active {
    transform: translateY(0);
  }
  ```

### B. Input Field (`<Input />`)
- **Aesthetic**: Float outline input with spring focus animation.
- **CSS Specification**:
  ```css
  .form-input {
    width: 100%;
    padding: 0.875rem;
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--border-light);
    font-family: var(--font-family-body);
    font-size: var(--font-size-base);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .form-input:focus {
    outline: none;
    border-color: var(--brand-primary);
    box-shadow: 0 0 0 3px var(--color-brand-glow);
  }
  ```

### C. Glassmorphism Card Wrapper (`<Card />`)
- **Aesthetic**: Frosted border accents, drop shadows, and translations.
- **CSS Specification**:
  ```css
  .glass-card {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-md);
    transition: all var(--transition-speed) var(--transition-bezier);
  }
  .glass-card:hover {
    box-shadow: var(--shadow-lg);
    border-color: rgba(255, 255, 255, 0.6);
  }
  ```

---

## 4. Next Steps
We will proceed to **Document 20: Django API & Backend Architecture Specification**. This final document details models fields, API schema routes, Docker deployment configs, uv settings, and CI/CD pipelines. Say "Next" to continue.
