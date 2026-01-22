import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";

export const metadata = {
  title: "About Lapwise - F1 Analytics Platform",
  description:
    "Learn about Lapwise, the professional F1 analytics platform built for passionate Formula 1 fans.",
};

export default function AboutPage() {
  return (
    <div className="bg-bg-primary">
      {/* Hero Section */}
      <Section
        spacing="xl"
        background="gradient"
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-[128px]" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-500 rounded-full blur-[128px]" />
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <Badge variant="purple" size="lg" className="mb-6">
            About Us
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-text-primary mb-6">
            Built for F1 Fans, by F1 Fans
          </h1>
          <p className="text-xl text-text-tertiary">
            Lapwise is a professional analytics platform that brings Formula 1
            data to life with comprehensive race results, telemetry analysis,
            and driver statistics.
          </p>
        </div>
      </Section>

      {/* Mission Section */}
      <Section spacing="lg" background="primary">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-text-primary mb-6">
            Our Mission
          </h2>
          <p className="text-lg text-text-secondary mb-8">
            We believe that every F1 fan deserves access to professional-grade
            analytics and telemetry data. Lapwise was created to democratize F1
            data analysis, making it accessible, understandable, and actionable
            for enthusiasts at every level.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <Card variant="elevated" padding="lg">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Data icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">
                Comprehensive Data
              </h3>
              <p className="text-text-tertiary">
                Access to 74+ years of F1 history with detailed telemetry and
                race results from every session.
              </p>
            </Card>

            <Card variant="elevated" padding="lg">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Performance icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">
                Real-time Analysis
              </h3>
              <p className="text-text-tertiary">
                Professional-grade tools for analyzing lap times, sector
                performance, and race strategies.
              </p>
            </Card>

            <Card variant="elevated" padding="lg">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Community icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">
                Fan-First Approach
              </h3>
              <p className="text-text-tertiary">
                Designed with F1 fans in mind, making complex data accessible
                and engaging for everyone.
              </p>
            </Card>
          </div>
        </div>
      </Section>

      {/* Technology Stack */}
      <Section spacing="lg" background="secondary">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-12">
            Powered by Modern Technology
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card variant="bordered" padding="lg">
              <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center">
                <span className="w-2 h-2 rounded-full bg-purple-500 mr-3" />
                Frontend
              </h3>
              <ul className="space-y-2 text-text-tertiary">
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Check</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Next.js 15 with React 19
                </li>
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Check</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  TypeScript for type safety
                </li>
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Check</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Tailwind CSS for responsive design
                </li>
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Check</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  React Query for data fetching
                </li>
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Check</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Recharts for data visualization
                </li>
              </ul>
            </Card>

            <Card variant="bordered" padding="lg">
              <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center">
                <span className="w-2 h-2 rounded-full bg-red-500 mr-3" />
                Backend
              </h3>
              <ul className="space-y-2 text-text-tertiary">
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Check</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  FastAPI with Python 3.11
                </li>
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Check</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  PostgreSQL with Neon
                </li>
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Check</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  FastF1 for telemetry data
                </li>
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Check</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  SQLAlchemy for database operations
                </li>
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Check</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Deployed on Railway
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </Section>

      {/* CTA Section */}
      <Section
        spacing="xl"
        background="gradient"
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500 rounded-full blur-[128px]" />
        </div>

        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-text-primary mb-4">
            Questions? Get in Touch
          </h2>
          <p className="text-xl text-text-tertiary mb-8">
            We'd love to hear from you. Whether you have questions, feedback, or
            just want to say hi, feel free to reach out.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" size="lg">
              <Link href="/contact">Contact Us</Link>
            </Button>
            <Button variant="secondary" size="lg">
              <Link href="/faq">View FAQ</Link>
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
