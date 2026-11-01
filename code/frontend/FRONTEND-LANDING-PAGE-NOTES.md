# Dengue Alert — Public Landing Page

## What changed
- Added `src/pages/LandingPage.jsx` and its scoped stylesheet `src/pages/LandingPage.css`.
- Made `/` the public landing page for signed-out visitors.
- Moved the existing protected citizen/Master Admin dashboard to `/dashboard`.
- Added role-aware routing from `/`: Councillors go to `/councillor`, Inspectors go to `/inspector`, and Citizens/Master Admins go to `/dashboard`.
- Updated the shared Navbar's fallback/back destination to `/dashboard` so existing dashboard navigation continues to work.

## Landing page sections
- Header with working login and registration links
- Hero section with an original CSS illustration
- Three-step reporting explanation
- Dengue prevention guidance
- Community/staff login CTA
- Footer navigation

## Notes
- No backend files or API contracts were changed.
- The existing report flow is protected by authentication, so the public “Report a breeding site” CTA leads to the existing citizen registration page.
- A production build could not be verified in this environment because `npm ci` timed out before dependencies were installed. On your machine, run `npm ci` and then `npm run build` from the project directory.
