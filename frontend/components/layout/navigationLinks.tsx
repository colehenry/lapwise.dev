import type { ReactNode } from "react";
import ClutchIcon from "@/components/ui/ClutchIcon";

export interface NavLink {
  href: string;
  label: string;
  icon?: string;
  renderIcon?: (active: boolean, scrolled: boolean) => ReactNode;
  imageSrc?: string;
}

function iconClass(active: boolean, scrolled: boolean): string {
  return `shrink-0 transition-all duration-500 ${
    scrolled ? "w-6 h-6" : "w-4 h-4"
  } ${active ? "text-purple-400" : "text-text-muted group-hover:text-text-primary"}`;
}

export const archiveLinks: NavLink[] = [
  {
    href: "/drivers",
    label: "Drivers",
    renderIcon: (active, scrolled) => (
      <svg
        className={iconClass(active, scrolled)}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        fill="none"
        stroke="currentColor"
        strokeWidth={28}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <title>Drivers</title>
        <path d="M40 280 A200 200 0 0 1 440 280 L440 360 A60 60 0 0 1 360 420 L100 360 A60 60 0 0 1 40 300 Z" />
        <path d="M260 230 L440 250 L440 400 L260 300 Z" />
        <circle cx="130" cy="270" r="45" />
      </svg>
    ),
  },
  {
    href: "/constructors",
    label: "Constructors",
    icon: "M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z",
  },
  {
    href: "/circuits",
    label: "Circuits",
    renderIcon: (active, scrolled) => (
      <svg
        className={iconClass(active, scrolled)}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 431.76266 282.2795"
        fill="none"
        stroke="currentColor"
        strokeWidth={18}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <title>Circuits</title>
        <path d="m4.0167 271.88c0.64631 8.2948 35.488 7.0412 175.53 4.453 12.377-0.22874 23.86-0.27059 25.52-0.0932 13.322 1.4247 100.54 2.2285 145.19 1.3382l52.003-1.0371 10.787-5.1931c5.9327-2.8564 11.75-6.3558 12.928-7.7758 3.9507-4.7641 3.2062-6.3707-21.921-47.254-13.094-21.305-31.084-50.583-39.976-65.064-78.47-127.81-76.73-125.33-87.73-124.85-10.071 0.43333-18.612 11.049-30.86 38.362-6.0647 12.461-9.3595 17.392-9.4458 30.499-0.16791 25.024 10.566 36.802 43.884 48.15 27.605 9.4028 44.83 34.219 37.75 54.389-2.9794 8.4869-5.7122 8.9248-56.109 8.9963-116.27 0.16506-159.78-0.95414-191.07-4.9201-0.01764-0.002-0.0317-0.005-0.04921-0.008-1.3307-0.66808-2.43-1.5305-2.9028-2.6746 0.52921-1.7786 2.7076-4.7102 6.8088-9.6375 12.941-15.548 12.809-15.542 95.728-5.2995 57.897 7.1518 61.142 0.92171 16.441-31.574-40.6-29.52-40.53-29.42-36.96-49.77 3.4-19.413-0.73-26.128-20.45-33.214-14.94-5.372-30.31-18.671-50.912-44.055-23.312-28.723-35.64-28.862-40.096-0.451-16.672 106.31-23.197 153.18-23.266 178.19-0.10452 1.6859-0.07039 3.3487 0.08572 4.9912 0.31161 8.3078 1.4916 13.926 3.3599 18.797 7.4095 19.318 7.6168 17.58-3.5718 30.076-5.9649 6.6621-10.949 11.37-10.696 14.616z" />
      </svg>
    ),
  },
];

export const navLinksBefore: NavLink[] = [
  {
    href: "/daily",
    label: "Daily Grid",
    icon: "M4.5 4.5h6v6h-6v-6Zm9 0h6v6h-6v-6Zm-9 9h6v6h-6v-6Zm9 0h6v6h-6v-6Z",
  },
  {
    href: "/results",
    label: "Race Weekend Hub",
    icon: "M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5",
  },
];

export const navLinksAfter: NavLink[] = [
  {
    href: "/replay",
    label: "Replay",
    icon: "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z",
  },
  {
    href: "/ask",
    label: "Ask",
    renderIcon: (active, scrolled) => (
      <ClutchIcon className={iconClass(active, scrolled)} title="Clutch" />
    ),
  },
];
