import type { ClutchScript } from "@/lib/homeClutchScript";

/**
 * The authored questions and their answers. The prose is written; every number
 * in it is a slot resolved from responses the page already holds, so a script
 * cannot go stale between races.
 *
 * Adding one is adding an entry here. Nothing else changes.
 */
export const CLUTCH_SCRIPTS: ClutchScript[] = [
  {
    id: "championship-state",
    question: "Who is winning the {season} championship, and how close is it?",
    parts: [
      { slot: "drivers.1.name", tint: "driver" },
      { text: " leads the " },
      { slot: "season" },
      { text: " drivers' championship on " },
      { slot: "drivers.1.points" },
      { text: " points after " },
      { slot: "rounds.run" },
      { text: " rounds — " },
      { slot: "gap.drivers.1_2" },
      { text: " clear of " },
      { slot: "drivers.2.name", tint: "driver" },
      { text: ", with " },
      { slot: "drivers.3.name", tint: "driver" },
      { text: " a further " },
      { slot: "gap.drivers.2_3" },
      { text: " back.\n\n" },
      { slot: "constructors.1.team", tint: "team" },
      { text: " lead the constructors' championship from " },
      { slot: "constructors.2.team", tint: "team" },
      { text: " by " },
      { slot: "gap.constructors.1_2" },
      { text: ". Most recently " },
      { slot: "latest.winner", tint: "driver" },
      { text: " won the " },
      { slot: "latest.event" },
      { text: " from " },
      { slot: "latest.winnerGrid" },
      { text: ", " },
      { slot: "latest.margin" },
      { text: " clear of second." },
    ],
    visual: { kind: "points_progression", mode: "drivers", entities: "top3" },
    followups: [
      "Can {drivers.2.surname} still win it?",
      "Points swing by round",
      "{constructors.1.team} vs {constructors.2.team}",
      "Every result this season",
    ],
  },
];
