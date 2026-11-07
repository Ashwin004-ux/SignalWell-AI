import Link from "next/link";

export const metadata = { title: "Privacy Policy" };

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-monitor/10 px-1.5 py-0.5 text-monitor">
      [PLACEHOLDER — project owner to confirm: {children}]
    </span>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-prose px-6 py-16">
      <Link href="/" className="font-serif text-lg font-semibold text-ink">
        SignalWell AI
      </Link>
      <h1 className="mt-8 font-serif text-3xl text-ink">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-400">Last updated: <Placeholder>insert date of publication</Placeholder></p>

      <div className="prose-sm mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="font-serif text-lg text-ink">What data we collect</h2>
          <p className="mt-2">
            SignalWell AI collects: account information (email, full name, timezone); digital activity
            data from the browser extension (domain-level usage, time spent, session counts, late-night
            usage); self-reported sleep records (start/end time, duration, quality, interruptions);
            self-reported mood, stress, anxiety, wellbeing and energy scores and any notes you add; and
            AI-generated analysis derived from the above.
          </p>
          <p className="mt-2">
            We do not collect passwords from other sites, keystrokes, private messages, form contents,
            banking information, personal files, or the contents of webpages you visit.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-ink">Why we collect it</h2>
          <p className="mt-2">
            This data is collected solely to generate the analytics, indicators, insights, and chatbot
            responses described in the product. We do not use it for advertising and do not sell it to
            third parties.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-ink">How data is stored</h2>
          <p className="mt-2">
            All data is stored in Supabase (PostgreSQL), isolated per user with Row Level Security
            policies that restrict every table to rows owned by the authenticated user. No user can
            query another user's data through the application.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-ink">How AI processing works</h2>
          <p className="mt-2">
            Structured summaries of your recent activity, sleep, and mood data (not raw database dumps)
            are sent to an AI model to generate summaries, indicators, and recommendations. The model
            provider is <Placeholder>name the AI provider(s) actually used in production</Placeholder>.
            AI outputs are clearly labeled as AI-generated interpretation, not verified fact or medical
            diagnosis.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-ink">How extension data is handled</h2>
          <p className="mt-2">
            The browser extension authenticates as you and sends activity data to our API over HTTPS. It
            never holds the Supabase service-role key or any credential broader than your own account
            session.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-ink">Data retention</h2>
          <p className="mt-2">
            <Placeholder>confirm the retention period the business intends to commit to — e.g. retained until account deletion, or a fixed window such as 24 months</Placeholder>.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-ink">Your rights</h2>
          <p className="mt-2">
            You can export all data associated with your account, delete individual historical activity,
            or delete your account entirely (which removes all associated records) from Privacy &amp;
            Data settings at any time.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-ink">Third-party services</h2>
          <p className="mt-2">
            We use Supabase for authentication, database, and storage, and an AI provider (see above) for
            analysis and chatbot responses. <Placeholder>list any analytics, error-tracking, or email-delivery vendors actually in use</Placeholder>.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-ink">Cookies and local storage</h2>
          <p className="mt-2">
            The web app uses cookies for authentication session management only. The extension uses
            local browser storage to hold your session token and pending sync data.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-ink">Security practices</h2>
          <p className="mt-2">
            Row Level Security on every table, server-side-only use of the Supabase service-role key,
            encrypted transport (HTTPS), and input validation on every API route.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-ink">Contact</h2>
          <p className="mt-2">
            <Placeholder>insert business contact email/address for privacy requests</Placeholder>.
          </p>
        </section>
      </div>
    </main>
  );
}
