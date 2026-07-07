import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · Lapwise",
  description: "Privacy Policy for Lapwise.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Privacy Policy
        </h1>
        <p className="text-text-muted text-sm">Last updated: May 2026</p>
      </div>

      <Section title="1. What We Collect">
        <p>When you create an account we collect:</p>
        <ul>
          <li>Email address and username</li>
          <li>Hashed password (plaintext is never stored)</li>
          <li>
            Optional: profile bio, avatar URL, favorite driver/team/circuit
          </li>
          <li>
            Login history: timestamp, IP address, and user agent for security
            purposes
          </li>
        </ul>
        <p className="mt-3">
          If you sign in with Google, we receive your Google profile email and
          display name. We do not receive your Google password.
        </p>
        <p className="mt-3">
          Community content you post (discussions, comments) is stored and
          publicly visible.
        </p>
      </Section>

      <Section title="2. How We Use Your Data">
        <ul>
          <li>To authenticate your account and keep sessions secure</li>
          <li>To send transactional emails (verification, password reset)</li>
          <li>To personalize your experience based on favorite selections</li>
          <li>To enforce rate limits and prevent abuse</li>
          <li>To improve the Service</li>
        </ul>
        <p className="mt-3">
          We do not sell your personal data. We do not use your data for
          advertising.
        </p>
      </Section>

      <Section title="3. AI Usage">
        <p>
          When you use Clutch (the AI analyst), your question and relevant
          conversation history are sent to Anthropic&rsquo;s API to generate a
          response. Anthropic&rsquo;s{" "}
          <a
            href="https://www.anthropic.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            privacy policy
          </a>{" "}
          applies to that processing. We store your AI conversation history in
          our database so you can review past chats. You can delete your account
          to remove this data.
        </p>
        <p className="mt-3">
          AI queries are counted against per-account limits. Counts are stored
          in your user record.
        </p>
      </Section>

      <Section title="4. Cookies and Sessions">
        <p>We use:</p>
        <ul>
          <li>
            <strong className="text-text-primary">Auth cookies</strong> —
            httpOnly session cookies used to keep you logged in. These are
            essential and cannot be opted out of while using the Service.
          </li>
          <li>
            <strong className="text-text-primary">
              No advertising cookies
            </strong>{" "}
            — we do not use third-party tracking or advertising cookies.
          </li>
        </ul>
      </Section>

      <Section title="5. Analytics">
        <p>
          We use error monitoring (Sentry) to capture application errors and
          performance data. Sentry may collect IP addresses and browser
          information as part of error reports. We use this solely to fix bugs.
          See{" "}
          <a
            href="https://sentry.io/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            Sentry&rsquo;s privacy policy
          </a>
          .
        </p>
      </Section>

      <Section title="6. Data Retention">
        <p>
          Account data is retained until you delete your account. Login history
          is retained for up to 90 days. AI conversation history is retained
          until you delete your account.
        </p>
      </Section>

      <Section title="7. Your Rights">
        <p>You can:</p>
        <ul>
          <li>Update your profile at any time from your account settings</li>
          <li>Request deletion of your account and associated data</li>
          <li>Contact us with questions about data we hold about you</li>
        </ul>
      </Section>

      <Section title="8. Third-Party Services">
        <p>Lapwise uses the following third-party services:</p>
        <ul>
          <li>
            <strong className="text-text-primary">Neon</strong> — database
            hosting
          </li>
          <li>
            <strong className="text-text-primary">Railway</strong> — backend
            hosting
          </li>
          <li>
            <strong className="text-text-primary">Netlify</strong> — frontend
            hosting
          </li>
          <li>
            <strong className="text-text-primary">Resend</strong> —
            transactional email
          </li>
          <li>
            <strong className="text-text-primary">Anthropic</strong> — AI
            processing
          </li>
          <li>
            <strong className="text-text-primary">Sentry</strong> — error
            monitoring
          </li>
          <li>
            <strong className="text-text-primary">Google</strong> — OAuth login
            (optional)
          </li>
        </ul>
      </Section>

      <Section title="9. Contact">
        <p>
          For privacy questions or data deletion requests, email us at{" "}
          <a
            href="mailto:support@lapwise.dev"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            support@lapwise.dev
          </a>
          .
        </p>
      </Section>

      <div className="pt-4 border-t border-border-primary">
        <Link
          href="/terms"
          className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
        >
          Terms of Service →
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      <div className="text-text-secondary text-sm leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}
