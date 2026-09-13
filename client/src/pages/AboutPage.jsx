import { Helmet } from "react-helmet-async";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  GraduationCap,
  Hotel,
  Landmark,
  MapPin,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet
} from "lucide-react";
import { useDocumentTitle } from "../utils/useDocumentTitle";

const userTypes = [
  {
    icon: GraduationCap,
    title: "Students",
    text: "Search verified hostel seats, PGs, shared and private rooms near their university, request visits or trial stays, and pay securely through the platform."
  },
  {
    icon: MapPin,
    title: "Tourists & Guests",
    text: "Book nightly stays at guest houses and hotel rooms through the same trusted platform, with the same verification and payment protection."
  },
  {
    icon: Building2,
    title: "Hostel Owners",
    text: "List rooms and beds, manage tenants and rent cycles, respond to booking requests, and track occupancy from a dedicated Host dashboard."
  },
  {
    icon: Landmark,
    title: "Hostel Group Owners",
    text: "Manage multiple hostel properties under one group profile, with consolidated visibility across all their listed buildings."
  },
  {
    icon: Hotel,
    title: "Hotel & Guest-House Owners",
    text: "Run nightly-stay inventory alongside student accommodation, using the same booking and payment infrastructure as monthly room leases."
  },
  {
    icon: ShieldCheck,
    title: "Admin & Platform Team",
    text: "Verify owner documents and property proof, review disputes, oversee payouts, and keep listings accountable across the marketplace."
  }
];

const pillars = [
  {
    icon: Wallet,
    title: "Centralized, Protected Payments",
    text: "Rent, tokens, and instalments are paid through Basera rather than handed over informally. Payments are recorded on a ledger and released to hosts through tracked payouts, with manual bank/JazzCash/Easypaisa proof-of-payment support and receipts for every transaction."
  },
  {
    icon: Sparkles,
    title: "Support, Loyalty & Engagement",
    text: "Students get support tools, community features, and engagement perks inside their dashboard, while hosts get response tooling and reputation tracking, so good behavior on both sides is visible, not just promised."
  },
  {
    icon: Route,
    title: "Trip & Move-In Planning",
    text: "City comparison tools and route/trip planning help students and guests evaluate a neighborhood and plan the practical side of moving in, not just browse photos."
  },
  {
    icon: MapPin,
    title: "Maps & Location Context",
    text: "Interactive maps place listings against nearby universities and landmarks, so location decisions are based on real geography, not just addresses in text."
  }
];

export function AboutPage() {
  useDocumentTitle(
    "About Us | Basera",
    "Basera is Pakistan's student housing and guest-stay marketplace, connecting students, tourists, hostel owners, hotel and guest-house owners, and a verification-focused admin team through one centralized, payment-protected platform."
  );

  return (
    <>
      <Helmet>
        <title>About Us | Basera</title>
      </Helmet>

      <main>
        <section className="border-b border-line bg-canvas">
          <div className="container-page py-16 text-center lg:py-20">
            <span className="badge bg-primary-50 text-primary-700">
              <BadgeCheck size={14} /> About Basera
            </span>
            <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight text-primary-600 sm:text-5xl">
              One platform for student housing and guest stays in Pakistan
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-on-surface-variant sm:text-lg">
              Basera connects students and travelers with verified, affordable accommodation, and gives the people who
              own and manage that accommodation the tools to run it professionally &mdash; all payments, verification,
              and support routed through a single, accountable marketplace instead of scattered phone calls and cash
              handoffs.
            </p>
          </div>
        </section>

        <section className="container-page py-16">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-on-surface">Who Basera is built for</h2>
            <p className="mx-auto mt-3 max-w-2xl text-on-surface-variant">
              Basera is a multi-sided marketplace. Every user type below has a real, dedicated dashboard and workflow
              in the product today.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {userTypes.map(({ icon: Icon, title, text }) => (
              <article key={title} className="panel p-6">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-50 text-primary-700">
                  <Icon size={22} />
                </span>
                <h3 className="mt-5 font-bold text-on-surface">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Simple on-brand "how it connects" diagram -- plain Tailwind flex boxes and an
            arrow icon rather than an image asset, kept intentionally simple. */}
        <section className="bg-surface-container-low py-16">
          <div className="container-page">
            <div className="text-center">
              <h2 className="font-display text-3xl font-bold text-on-surface">How the ecosystem connects</h2>
              <p className="mx-auto mt-3 max-w-2xl text-on-surface-variant">
                Every booking and payment flows through Basera, not around it.
              </p>
            </div>
            <div className="mt-12 flex flex-col items-center gap-6 lg:flex-row lg:items-stretch lg:justify-center">
              <div className="w-full max-w-xs rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary-50 text-primary-700">
                  <Users size={22} />
                </span>
                <h3 className="mt-4 font-bold text-on-surface">Students & Guests</h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">Search, visit, book, and pay</p>
              </div>

              <div className="flex items-center justify-center text-primary-600">
                <ArrowRight size={28} className="hidden lg:block" />
                <span className="rotate-90 lg:hidden">
                  <ArrowRight size={28} />
                </span>
              </div>

              <div className="w-full max-w-xs rounded-2xl border border-primary-700 bg-primary-700 p-6 text-center text-white shadow-float">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white">
                  <ShieldCheck size={22} />
                </span>
                <h3 className="mt-4 font-bold">Basera Platform</h3>
                <p className="mt-2 text-sm leading-6 text-white/90">Verification, escrow-style payments, ledger &amp; support</p>
              </div>

              <div className="flex items-center justify-center text-primary-600">
                <ArrowRight size={28} className="hidden lg:block" />
                <span className="rotate-90 lg:hidden">
                  <ArrowRight size={28} />
                </span>
              </div>

              <div className="w-full max-w-xs rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary-50 text-primary-700">
                  <Building2 size={22} />
                </span>
                <h3 className="mt-4 font-bold text-on-surface">Hosts & Owners</h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">List, manage tenants, get paid out</p>
              </div>
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-on-surface-variant">
              Money and verification move through the middle box in both directions: guests pay in, hosts get paid
              out, and admin oversight sits on top of the whole flow.
            </p>
          </div>
        </section>

        <section className="container-page py-16">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-on-surface">What makes Basera a full ecosystem</h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {pillars.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-600 text-white shadow-card">
                  <Icon size={20} />
                </span>
                <div>
                  <h3 className="font-bold text-on-surface">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
