import Link from "next/link";

export const metadata = {
  title: "About Lapwise",
  description:
    "A plain-language note about what Lapwise is, what you can do now, and what is planned next.",
};

const nextUp = [
  "Improve graphs and analyses on driver, team, and circuit pages.",
  "Add a real calendar page with upcoming races and quick links to each weekend.",
  "Build a simple head-to-head view for driver and team comparisons.",
  "Add a records page for all-time and season stats.",
  "Live data during active sessions.",
  "Start posting short race recaps with statistical analyses of each weekend.",
];

export default function AboutPage() {
  return (
    <div className="bg-bg-primary">
      <section className="bg-bg-secondary border-b border-border-primary relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 right-1/4 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-56 h-56 rounded-full bg-red-500/10 blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto px-6 py-16 md:py-20">
          <h1 className="mt-3 text-4xl md:text-6xl font-bold tracking-tight text-text-primary">
            About Lapwise
          </h1>
          <p className="mt-6 text-base md:text-xl text-text-secondary leading-8 md:leading-9">
            I built Lapwise because I wanted one place to quickly understand a
            race weekend without digging through multiple sites and watching summary videos.
          </p>
        </div>
      </section>

      <section className="bg-bg-primary">
        <div className="max-w-3xl mx-auto px-6 py-14 md:py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
            Current features:
          </h2>
          <ul className="mt-6 space-y-3.5 text-text-secondary leading-7 md:leading-8 marker:text-purple-400 list-disc pl-5">
            <li>
              Browse full race weekends, including race, qualifying, sprint,
              and strategy views.
            </li>
            <li>Look up drivers and compare their season and career results.</li>
            <li>Check constructors and see how teams perform over time.</li>
            <li>Explore circuits and review their race history.</li>
          </ul>
          <p className="mt-6 text-text-secondary leading-7 md:leading-8">
            Main pages:{" "}
            <Link href="/results" className="text-purple-300 hover:text-purple-200 underline underline-offset-4">
              Results
            </Link>
            ,{" "}
            <Link href="/drivers" className="text-purple-300 hover:text-purple-200 underline underline-offset-4">
              Drivers
            </Link>
            ,{" "}
            <Link href="/constructors" className="text-purple-300 hover:text-purple-200 underline underline-offset-4">
              Constructors
            </Link>
            , and{" "}
            <Link href="/circuits" className="text-purple-300 hover:text-purple-200 underline underline-offset-4">
              Circuits
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="bg-bg-secondary border-y border-border-primary">
        <div className="max-w-3xl mx-auto px-6 py-14 md:py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
            Features soon to come (when I have time):
          </h2>
          <ul className="mt-6 space-y-3.5 text-text-secondary leading-7 md:leading-8 marker:text-purple-400 list-disc pl-5">
            {nextUp.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
