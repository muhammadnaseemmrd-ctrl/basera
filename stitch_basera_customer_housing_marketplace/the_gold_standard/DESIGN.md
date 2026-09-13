---
name: The Gold Standard
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#3e494a'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0ef'
  outline: '#6f797a'
  outline-variant: '#bec8ca'
  surface-tint: '#006972'
  primary: '#00535b'
  on-primary: '#ffffff'
  primary-container: '#006d77'
  on-primary-container: '#9becf7'
  inverse-primary: '#82d3de'
  secondary: '#595d78'
  on-secondary: '#ffffff'
  secondary-container: '#dbdeff'
  on-secondary-container: '#5d617d'
  tertiary: '#01544f'
  on-tertiary: '#ffffff'
  tertiary-container: '#286d67'
  on-tertiary-container: '#a9ece4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9ff0fb'
  primary-fixed-dim: '#82d3de'
  on-primary-fixed: '#001f23'
  on-primary-fixed-variant: '#004f56'
  secondary-fixed: '#dee0ff'
  secondary-fixed-dim: '#c1c4e5'
  on-secondary-fixed: '#161a32'
  on-secondary-fixed-variant: '#414560'
  tertiary-fixed: '#acefe7'
  tertiary-fixed-dim: '#90d3cb'
  on-tertiary-fixed: '#00201e'
  on-tertiary-fixed-variant: '#00504b'
  background: '#fcf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e5e2e1'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Roboto Flex
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Roboto Flex
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Roboto Flex
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Roboto Flex
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Roboto Flex
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.03em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system is engineered to evoke maximum credibility, high integrity, and professional rigor. Targeting discerning parents and high-end hostel groups, the aesthetic balances the efficiency of a high-growth SaaS platform with the institutional stability of an established financial entity. 

The style is **Corporate / Modern**, characterized by exceptional clarity, structural alignment, and a "precision-engineered" feel. It avoids decorative excess in favor of functional elegance. The emotional response is one of safety and absolute reliability—every interaction should feel deliberate and secure. Visual depth is achieved through subtle layering rather than aggressive shadows, maintaining a clean and "sanitized" professional environment.

## Colors
The palette is rooted in **Deep Teal (#006D77)**, a color chosen for its psychological association with sophistication and depth. **Slate Grey (#4A4E69)** provides a grounded secondary tone for navigation and structural elements. 

The background remains a crisp **Pure White (#FFFFFF)** to maximize contrast and perceived "cleanliness." For data-heavy interfaces or container backgrounds, a subtle **Off-White (#F8F9FA)** is used to distinguish different functional zones. Verification elements and trust indicators should utilize the Primary color or a specialized Success Green to reinforce security.

## Typography
This design system utilizes a dual-font strategy. **Plus Jakarta Sans** is the primary choice for headlines and display text, providing a modern, geometric clarity that feels contemporary yet authoritative. 

**Roboto Flex** (utilizing the flexibility of the variable font) is used for all body copy and UI labels. This ensures maximum legibility in data-heavy views. Use tighter tracking on headings to maintain a "sharp" corporate look, and standard tracking on body text for optimal reading flow. Hierarchies are strictly enforced through weight variations rather than just size shifts.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy for desktop to maintain a structured, centered focus that feels stable. The system is built on a 4px baseline grid. 

- **Desktop:** 12-column grid, 1280px max-width, 24px gutters.
- **Tablet:** 8-column grid, fluid width, 20px gutters.
- **Mobile:** 4-column grid, fluid width, 16px margins.

Spacing should be generous to avoid visual clutter, but structured enough to indicate clear relationships between data points. Use consistent vertical "stacks" (8px/16px/32px) to organize content blocks.

## Elevation & Depth
Elevation is handled through **Tonal Layers** and extremely crisp, low-opacity shadows. The intent is to create a sense of organized physical space without the softness of consumer-grade apps.

- **Level 0 (Base):** Pure White (#FFFFFF).
- **Level 1 (Cards/Containers):** Subtle 1px border (#E9ECEF) or a very soft shadow (0px 2px 4px rgba(0,0,0,0.05)).
- **Level 2 (Dropdowns/Modals):** Medium shadow (0px 8px 24px rgba(0,0,0,0.08)) with a 1px Slate Grey border at 10% opacity.

Avoid large blurs or vibrant color-tinted shadows. Use borders as the primary method of separation to maintain the "Sharp" corporate aesthetic.

## Shapes
The shape language is **Soft (0.25rem)**. This provides just enough curvature to feel modern and accessible while maintaining the "Sharp" architectural integrity required for a professional tool. 

- **Standard Buttons & Inputs:** 4px (0.25rem) radius.
- **Cards & Large Containers:** 8px (0.5rem) radius.
- **Badges & Tags:** Fully rounded (pill) only for status indicators to contrast against structural elements.

## Components
### Buttons
Primary buttons use the Deep Teal background with White text. Hover states shift to a slightly darker shade of Teal. Secondary buttons use a Slate Grey outline with a 1px weight.

### Input Fields
Inputs must have a 1px border (#DEE2E6) and use a subtle grey background (#F8F9FA) when inactive to differentiate from the white page background. Focus states use a 2px Deep Teal border with no outer glow.

### Verification Badges
A signature component of this system. These are small, high-contrast badges featuring a "shield" or "check" icon in Deep Teal or Gold, often accompanied by "Verified" text in uppercase Label-sm typography.

### Cards
Cards are flat with 1px borders. In data-heavy dashboards, use a "Header" section within the card with a light Slate Grey background to separate title information from content.

### Lists
Lists should use subtle 1px dividers between items. Row heights are consistent (typically 56px or 64px) to maintain a rhythmic, spreadsheet-like efficiency.