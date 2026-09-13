# Stitch AI Prompt — Basera UI Design

*Prepared for use with Google Stitch (or similar AI UI design tools). Attach `Basera_Master_Development_Guideline.md` (or the Word/PDF version) alongside this prompt for full feature context.*

Copy everything in the box below into Stitch as your design brief.

```
Design the UI for Basera — a verified student hostel and room booking platform for
Pakistan, expanding into a broader housing/stay marketplace. Basera connects
students and young professionals with verified hostels, PGs, and shared rooms near
universities, plus a separate short-stay Hotels & Guest Houses booking flow for
travelers (e.g. booking a weekend in Murree).

GENERATE 3 DISTINCT DESIGN DIRECTIONS for me to compare and choose from — vary the
visual personality meaningfully across the three (e.g. one warm/friendly, one
clean/corporate-trustworthy, one bold/youthful), not just minor color tweaks. For
each direction, include:
- A logo concept (icon + wordmark), reasoning about why it fits the direction
- A full color palette (primary, secondary/accent, background, text, success/error
  states) with hex codes
- Typography pairing (heading + body)

BRAND PERSONALITY: Trustworthy and safe first, approachable second. Our users are
18-24 year old students and their parents, plus small business hostel owners aged
25-50. The platform must feel credible enough for a parent to trust their child's
housing decision to it, while still feeling modern and easy for a student to use
casually on their phone. Avoid anything that looks like a generic real-estate
listing site — this should feel more like a trusted student-life companion app.

PRIORITIZE SIMPLICITY AND CLARITY: Every screen should be understandable at a
glance, with minimal text, clear visual hierarchy, generous spacing, and obvious
primary actions. Assume many users are booking housing for the first time and may
be anxious about safety/money — the design should visually reduce that anxiety
(clear verification badges, visible trust signals, no clutter, no overwhelming
choice on any one screen).

DESIGN THESE SCREENS (mobile-first, then show how each adapts to desktop/web):
1. Home / Search — hero search bar, featured verified listings, trust badges
2. Search Results — filterable list/map toggle of hostels and rooms
3. Listing Detail — photos, price, verified badge, amenities, and a "who else lives
   here" roommate-preview section showing occupant category (e.g. "1 Working
   Professional — Teacher") without any personal contact info
4. Booking / Checkout — clear price breakdown (rent, service fee, optional deposit
   protection add-on), escrow-protection messaging
5. Student Dashboard — current stay card, recent bookings (including an empty
   state for new users with no bookings yet), profile
6. Host Dashboard — property/room management, a smart-pricing suggestion card
7. Hostel Group Page — branded page for a multi-branch hostel chain (e.g. "Royal
   Group of Hostels") listing all its branches
8. Hotels & Guest Houses Search — visually distinct from student search since this
   is a different audience (travelers), nightly pricing, date-range picker
9. Warden Dashboard — a simple operational screen where a block warden marks a
   seat as manually booked (offline) with one tap, and can release it
10. Login / Signup — simple, trustworthy, with brief trust indicators (verified
    hostels, escrow protection, students placed) rather than a wall of text

CONSTRAINTS:
- Keep components reusable/consistent across screens (one button style, one card
  style, one badge style per direction) so this can realistically be built with a
  component library.
- Design for Urdu/English bilingual support — leave room for longer Urdu text and
  right-to-left layout without breaking the grid.
- Accessibility: sufficient color contrast, tap targets large enough for mobile.

I will review all 3 directions and select one, then may ask you to refine specific
screens or produce additional logo/color variations within the chosen direction.
```

## Notes for using this with Stitch

- Attach the requirements document (`Basera_Master_Development_Guideline.md`, or its Word/PDF version once available) so Stitch has the full feature list and phased roadmap as background context beyond what fits in the prompt itself.
- If Stitch's interface lets you upload reference images, the existing SVG mockups in `demo-assets/` (`mockup-01-homepage.svg` through `mockup-07-stays-hotels.svg`) show the current coral/navy placeholder direction — attach 1-2 of these only if you want Stitch to riff on the existing look; leave them out if you want fully fresh concepts to compare against the current design.
- After Stitch generates the three directions, a good follow-up prompt once you've picked one: *"Take Direction [1/2/3] and produce high-fidelity mockups for all 10 screens listed above, plus a small design-system sheet (buttons, inputs, badges, cards) I can hand to a developer."*
