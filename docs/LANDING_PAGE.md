# Landing Page Implementation

## Overview

The Devlogia landing page has been redesigned to replace the sprint documentation view with a focused marketing page that communicates product value, drives sign-ups, and showcases key features.

![Current landing page preview](assets/preview/landing.png)

The preview was captured from the seeded application on 14 July 2026. See [`README.md`](README.md) for regeneration instructions and the rest of the application gallery.

## Architecture

### Routes

- **`/`** - New landing page (marketing-focused)
- **`/blog`** - Blog listing (moved from old home page)
- **`/blog/[slug]`** - Individual blog posts

### Components Structure

```
src/components/
├── landing/
│   ├── hero-section.tsx          # Hero with tabbed product preview
│   ├── social-proof.tsx           # Trust indicators
│   ├── features-grid.tsx          # 6 key features in 2×3 grid
│   ├── personalization-section.tsx # AI personalization explainer
│   ├── integrations-section.tsx   # Integration logos carousel
│   ├── pricing-section.tsx        # 3-tier pricing with toggle
│   ├── faq-section.tsx           # Accordion FAQ
│   ├── final-cta.tsx             # Final conversion section
│   ├── landing-navbar.tsx        # Marketing navbar
│   ├── landing-mobile-nav.tsx    # Mobile hamburger menu (md:hidden)
│   └── featured-articles.tsx     # CMS blog post cards
└── ui/
    ├── accordion.tsx              # Accessible accordion component
    ├── badge.tsx                  # Tag/color badges
    ├── tabs.tsx                   # Tabs component for product preview
    ├── card.tsx                   # Card components
    ├── button.tsx                 # (existing)
    ├── input.tsx                  # (existing)
    ├── label.tsx                  # (existing)
    ├── pagination.tsx             # Pagination controls
    ├── scroll-reveal.tsx          # Intersection Observer animation wrapper
    ├── select.tsx                 # Select dropdown
    ├── skip-link.tsx              # Accessibility skip-to-content
    ├── textarea.tsx               # (existing)
    └── ...
```

## Sections

### 1. Hero Section

- **Headline**: "Publish smarter. Grow faster."
- **Subhead**: CMS modern dengan AI writing, SEO, dan analytics
- **CTAs**:
  - Primary: "Mulai Gratis" → `/admin/login`
  - Secondary: "Lihat Demo" → `/developers`
- **Product Preview**: Tabbed interface showing Editor, AI Assist, Analytics

### 2. Social Proof

- Logo strip showing trust indicators
- Caption: "Dipercaya oleh kreator, tim konten, dan startup"

### 3. Features Grid (6 features)

1. **AI Writer** - Draft → refine → publish dengan guardrails & audit
2. **SEO Suite** - Schema, OG, JSON-LD, sitemaps otomatis
3. **MDX Editor** - Komponen React di dalam konten
4. **Analytics** - Engagement, feed, revenue insights
5. **Marketplace** - Plugin & AI extensions siap pakai
6. **Multi-tenant** - Tim & brand dalam satu atap

### 4. Personalization Section

- Headline: "Feed yang beradaptasi dengan audiens"
- Explains AI-powered content recommendations
- Benefits: behavior-based learning, A/B testing, audience segmentation

### 5. Integrations Section

- Headline: "Terhubung dengan stack Anda"
- Shows integration logos: Stripe, Supabase, S3/R2, NextAuth, PostHog, Sentry, Algolia

### 6. Pricing Section

Three plans with monthly/annual toggle:

- **Free**: $0/month - 1 workspace, AI basic, custom domain add-on
- **Pro**: $19/month - AI advanced, analytics pro, unlimited posts
- **Enterprise**: Custom - SSO, SLA, custom quota, white-label

### 7. FAQ Section

6 common questions in accordion format:

- Migrasi dari WordPress
- Kuota AI calculation
- Plugin store availability
- Team collaboration support
- Self-hosting options
- Education discounts

### 8. Final CTA

- Strong final call-to-action
- "Mulai menulis hari ini"
- Emphasizes: "Gratis selamanya. Tidak perlu kartu kredit."

### 9. Featured Articles

- **Headline**: "Fresh Perspectives — Latest Technology & AI Articles"
- **Layout**: Responsive grid (1→2→3 columns on mobile→tablet→desktop)
- **Data source**: Query publishes through Prisma, sorted by publish date (descending)
- **Article card** contains:
  - Cover image (aspect-video, lazy-loaded)
  - Tag badges (from post→tags relation, `Badge variant="info"`)
  - Title (truncated via `line-clamp-3`)
  - Summary excerpt (truncated via `line-clamp-3`, muted text)
  - Publish date (formatted with `toLocaleDateString`)
  - "Read Article →" link with hover arrow translation
- **Interaction**: Cards styled as interactive hover group (scale image, highlight border, color transition)
- **Entry gate**: Section renders `null` if no articles fetched (no empty state UI)

### 10. Mobile Navigation

- **Trigger**: Hamburger button (hidden at `md` breakpoint, visible on mobile)
- **Dropdown**: Full-width overlay with backdrop-blur and border
- **Links**: Features (/#features), Pricing (/#pricing, conditional), Docs (/developers), Journal (/blog), Login (/admin/login)
- **Accessibility**: `aria-expanded`, `aria-controls="landing-mobile-menu"`, Escape key closes overlay
- **CTA**: "Start writing" full-width button at bottom

## Scroll Reveal Animations

### ScrollReveal Component

A reusable client-side animation wrapper (`src/components/ui/scroll-reveal.tsx`) that animates elements into view using the Intersection Observer API.

**Props**:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `React.ReactNode` | — | Content to animate |
| `direction` | `"up" \| "down" \| "left" \| "right" \| "none"` | `"up"` | Animation direction |
| `delay` | `number` | `0` | Initial delay in ms |
| `duration` | `number` | `600` | Animation duration in ms |
| `distance` | `string` | `"24px"` | Travel distance (CSS string) |
| `once` | `boolean` | `true` | Animate only on first entry |
| `staggerIndex` | `number` | `0` | Index for staggered animations |

**Behavior**:

- Uses `IntersectionObserver` with `threshold: 0.15`, `rootMargin: "0px 0px -40px 0px"`
- Applies `translate3d` + `opacity` transitions with `cubic-bezier(0.16, 1, 0.3, 1)` easing
- Respects `prefers-reduced-motion: reduce` — disables animation entirely
- Stagger offset: `totalDelay = delay + staggerIndex * 100`
- Uses `willChange: "opacity, transform"` for GPU acceleration
- Falls back to visible (no animation) when APIs unavailable (SSR, missing IntersectionObserver)

**Usage in landing page**:

- Every section wrapper is wrapped in `<ScrollReveal direction="up">`
- Article cards in Featured Articles use `staggerIndex={index}` for cascading entry
- Hero, Social Proof, Features, Pricing, FAQ, Final CTA all animate on scroll

## Design System

### Typography

- **H1**: 48-60px (text-4xl to text-6xl)
- **H2**: 36-48px (text-3xl to text-4xl)
- **H3**: 28-36px (text-xl to text-2xl)
- **Body**: 16px base (text-base to text-lg)
- **Font**: Inter (CSS variable)

### Colors (from globals.css)

- **Background**: `hsl(var(--color-background))`
- **Foreground**: `hsl(var(--color-foreground))`
- **Primary**: `hsl(var(--color-primary))`
- **Muted**: `hsl(var(--color-muted))`
- **Border**: `hsl(var(--color-border))`

Dark mode supported via `[data-theme="dark"]`

### Spacing

- Uses Tailwind's spacing scale (4px base unit)
- Section spacing: `space-y-24` between major sections
- Component spacing: `space-y-4` to `space-y-8`

### Layout

- Max width: `max-w-7xl` (1280px)
- Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Padding: `px-4 sm:px-6 lg:px-8`

## Accessibility

### WCAG AA Compliance

- ✅ Contrast ratio ≥ 4.5:1 for all text
- ✅ Focusable states with visible outlines
- ✅ Skip-to-content link
- ✅ ARIA attributes for tabs and accordion
- ✅ Keyboard navigation support
- ✅ Semantic HTML structure

### Keyboard Navigation

- Tab order is logical and follows visual flow
- Accordion items: Arrow keys + Enter/Space
- Tabs: Arrow keys for navigation
- All interactive elements have visible focus states

### Screen Readers

- Proper heading hierarchy (h1 → h2 → h3)
- ARIA labels on interactive components
- Alt text for decorative icons (aria-hidden)
- Role attributes for custom components

## Performance

### Targets

- **LCP**: < 2.0s (Largest Contentful Paint)
- **CLS**: < 0.02 (Cumulative Layout Shift)
- **FID**: < 100ms (First Input Delay)

### Optimizations

- Next.js Image optimization (when images added)
- Server-side rendering for initial load
- Minimal JavaScript for static sections
- Lazy loading for below-fold content
- CSS-in-JS with Tailwind for optimal bundle size

## SEO

### Meta Tags

```tsx
export const metadata: Metadata = {
  title: "Devlogia - Publish smarter. Grow faster.",
  description: "CMS modern dengan AI writing, SEO, dan analytics...",
  openGraph: {
    title: "Devlogia - Modern CMS with AI",
    description: "CMS modern dengan AI writing...",
    type: "website",
  },
};
```

### JSON-LD

- Organization schema implemented in layout
- WebSite schema for homepage
- Breadcrumb schema for navigation

### Best Practices

- Canonical URL set
- Sitemap.xml generated
- Robots.txt configured
- Semantic HTML structure
- Clean URL structure

## Analytics & Conversion Tracking

### Key Events to Track

1. **CTA Clicks**
   - Primary: "Mulai Gratis" (Hero, Final CTA)
   - Secondary: "Lihat Demo" (Hero)
2. **Navigation**
   - Features section scroll
   - Pricing section scroll
   - FAQ accordion interactions
3. **Pricing**
   - Plan card clicks
   - Billing toggle (Monthly/Annual)
4. **Engagement**
   - Tab switches in product preview
   - Time on page
   - Scroll depth

### Implementation

Use existing `<Analytics />` component in layout. Track events with:

```tsx
// Example tracking code (to be implemented)
onClick={() => {
  trackEvent('cta_click', { location: 'hero', type: 'primary' });
}}
```

## Responsive Breakpoints

- **Mobile**: < 768px
  - Single column layout
  - Stacked sections
  - Hamburger menu (`landing-mobile-nav.tsx`)
  - Scroll-reveal animations active
- **Tablet**: 768px - 1024px
  - 2-column grids
  - Mobile nav hidden, full navbar shown
  - Featured articles 2 columns
- **Desktop**: > 1024px
  - 3-column grids for features
  - Full navigation with `landing-navbar.tsx`
  - Optimal content width
  - Featured articles 3 columns

## Implementation Tasks

### Completed ✅

- [x] LP-01: Implement Landing Route '/'
- [x] LP-02: HeroPreview Tabs + autoplay
- [x] LP-03: Feature Grid + Integrations
- [x] LP-04: Pricing Snapshot + Toggle
- [x] LP-05: FAQ Accordion
- [x] LP-06: SEO metadata
- [x] LP-07: A11y features (skip link, ARIA)
- [x] LP-08: Mobile hamburger navigation
- [x] LP-09: Featured Articles section with CMS data
- [x] LP-10: Scroll-reveal animations (ScrollReveal component)

### Future Enhancements 🔄

- [ ] Add real integration logos (replace emoji placeholders)
- [x] Add repository documentation screenshots generated by Playwright
- [ ] Replace the hero's illustrative product-preview panel with approved product video or interactive media
- [ ] Add analytics event tracking
- [ ] A/B test headline variations
- [ ] Implement smooth scroll to sections
- [ ] Add testimonials section
- [ ] Create case study pages

## Migration Notes

### Old Home Page

The original blog listing lives at `/blog`. There is no checked-in backup page; use Git history if the pre-landing implementation is needed.

### Layout Changes

The public layout has been updated to:

- Use the new LandingNavbar component
- Increase max-width to `max-w-7xl` for landing page
- Add improved footer with multi-column links

### Content Updates

To update copy, edit the respective component files in `src/components/landing/`:

- Hero copy: `hero-section.tsx`
- Feature descriptions: `features-grid.tsx`
- Pricing details: `pricing-section.tsx`
- FAQ items: `faq-section.tsx`

## Testing Checklist

### Manual Testing

- [ ] All CTAs navigate correctly
- [ ] Tabs switch without layout shift
- [ ] Accordion expands/collapses smoothly
- [ ] Pricing toggle updates display
- [ ] Responsive at all breakpoints
- [ ] Dark mode displays correctly
- [ ] Keyboard navigation works
- [ ] Screen reader announces content properly

### Automated Testing

```bash
# Build test
pnpm build

# Lighthouse (performance, a11y, SEO; no package script is defined)
pnpm dlx @lhci/cli@0.13.1 autorun --config=lighthouserc.json

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Visual smoke and screenshots (requires seeded MySQL)
pnpm exec playwright test tests/e2e/visual-smoke.spec.ts --project=chromium
```

## Deployment

The landing page is production-ready and follows Next.js best practices:

1. Static optimization where possible
2. Server-side rendering for dynamic content
3. Edge-ready (middleware disabled for compatibility)
4. Environment variables properly configured

Deploy with:

```bash
pnpm build
pnpm start
```

Or deploy to Vercel:

```bash
vercel --prod
```

## Support & Maintenance

For questions or issues with the landing page:

1. Check this documentation
2. Review component files in `src/components/landing/`
3. Verify environment variables are set
4. Check browser console for errors
5. Test in incognito mode to rule out cache issues

---

**Last Updated**: 2026-07-14
**Version**: 1.0.1
**Author**: Landing Page Redesign Team
