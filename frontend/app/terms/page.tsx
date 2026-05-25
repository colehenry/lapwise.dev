import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · Lapwise",
  description: "Terms of Service for Lapwise.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Terms of Service
        </h1>
        <p className="text-text-muted text-sm">Last updated: May 2026</p>
      </div>

      <Section title="1. Acceptance">
        <p>
          By accessing or using Lapwise (&ldquo;the Service&rdquo;), you agree
          to these Terms. If you do not agree, do not use the Service.
        </p>
      </Section>

      <Section title="2. What Lapwise Is">
        <p>
          Lapwise is an F1 analytics platform that provides race data,
          statistics, replay tools, AI-assisted analysis, and community
          discussion. It is an independent fan project and is not affiliated
          with Formula 1, the FIA, or any F1 constructor or driver.
        </p>
      </Section>

      <Section title="3. Accounts">
        <ul>
          <li>You must be 13 years or older to create an account.</li>
          <li>You are responsible for keeping your credentials secure.</li>
          <li>
            You may not create accounts for the purpose of abuse, spam, or
            impersonation.
          </li>
          <li>
            We reserve the right to suspend or terminate accounts that violate
            these Terms.
          </li>
        </ul>
      </Section>

      <Section title="4. Community Rules">
        <p>When posting or commenting, you agree not to:</p>
        <ul>
          <li>Post spam, advertisements, or off-topic content</li>
          <li>Harass, threaten, or abuse other users</li>
          <li>Post spoilers without appropriate warnings</li>
          <li>Share misleading or fabricated race data</li>
          <li>
            Violate any applicable laws or third-party intellectual property
            rights
          </li>
        </ul>
        <p className="mt-3">
          Admins may remove content or restrict accounts at their discretion.
        </p>
      </Section>

      <Section title="5. AI Features">
        <p>
          The Clutch AI analyst is provided for informational purposes. AI
          responses are generated automatically and may contain errors or
          omissions. Do not rely on AI responses as authoritative data. AI
          queries are subject to per-account usage limits.
        </p>
      </Section>

      <Section title="6. Intellectual Property">
        <p>
          F1 race data is sourced from publicly available sources. Lapwise does
          not claim ownership of underlying race data. Original site content,
          design, and code are &copy; Lapwise. You may not scrape, reproduce, or
          redistribute Lapwise content at scale without permission.
        </p>
      </Section>

      <Section title="7. Disclaimer of Warranties">
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranty of any
          kind. We do not guarantee accuracy, availability, or fitness for a
          particular purpose. Race data may be delayed or incomplete.
        </p>
      </Section>

      <Section title="8. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, Lapwise and its operators
          shall not be liable for any indirect, incidental, or consequential
          damages arising from your use of the Service.
        </p>
      </Section>

      <Section title="9. Changes">
        <p>
          We may update these Terms at any time. Continued use of the Service
          after changes constitutes acceptance of the new Terms.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          Questions?{" "}
          <a
            href="mailto:support@lapwise.dev"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            support@lapwise.dev
          </a>
        </p>
      </Section>

      <div className="pt-4 border-t border-border-primary">
        <Link
          href="/privacy"
          className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
        >
          Privacy Policy →
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
