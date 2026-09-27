import React from "react";

/** Real sections, each verified to exist on leginfo.legislature.ca.gov. */
const ROW_A: [string, string, string][] = [
  ["CIV", "1950.5", "Security deposits"],
  ["CIV", "1947.12", "Statewide rent cap"],
  ["LAB", "201", "Final pay when fired"],
  ["VEH", "20002", "Hitting a parked car"],
  ["PROB", "6401", "A spouse's inheritance"],
  ["CIV", "1798.100", "Consumer privacy rights"],
  ["LAB", "510", "Overtime pay"],
  ["WIC", "15610.30", "Financial elder abuse"],
  ["CIV", "1942.5", "Landlord retaliation"],
  ["CCP", "116.220", "Small claims limits"],
  ["GOV", "12940", "Workplace discrimination"],
];
const ROW_B: [string, string, string][] = [
  ["CIV", "827", "Rent increase notice"],
  ["LAB", "202", "Final pay when you quit"],
  ["CIV", "1946.2", "Just-cause eviction"],
  ["PROB", "6402", "Heirs' inheritance shares"],
  ["BPC", "17200", "Unfair business practices"],
  ["LAB", "226", "Pay stubs"],
  ["VEH", "16028", "Proof of insurance"],
  ["PEN", "1203.4", "Clearing a conviction"],
  ["CIV", "1791.1", "Implied warranty"],
  ["LAB", "203", "Late final pay penalty"],
  ["HSC", "122335", "Tethering dogs"],
];

const ABBR: Record<string, string> = {
  CIV: "Civ. Code", LAB: "Lab. Code", VEH: "Veh. Code", PROB: "Prob. Code", WIC: "Welf. & Inst. Code",
  CCP: "Code Civ. Proc.", GOV: "Gov. Code", BPC: "Bus. & Prof. Code", PEN: "Pen. Code", HSC: "Health & Saf. Code",
};

function Row({ items, reverse, duration }: { items: [string, string, string][]; reverse?: boolean; duration: number }) {
  const doubled = [...items, ...items];
  return (
    <div className="marquee marquee-mask overflow-hidden">
      <div
        className={`marquee-track flex gap-3 w-max ${reverse ? "reverse" : ""}`}
        style={{ ["--marquee-duration" as string]: `${duration}s` }}
      >
        {doubled.map(([code, section, label], i) => (
          <a
            key={`${code}-${section}-${i}`}
            href={`https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=${code}&sectionNum=${section}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-hidden={i >= items.length}
            tabIndex={i >= items.length ? -1 : 0}
            className="group flex items-center gap-2.5 whitespace-nowrap rounded-full border border-paper-300 bg-surface pl-3 pr-4 py-2 text-sm shadow-card hover:border-gold-300 transition-colors"
          >
            <span className="font-display font-semibold text-ink-900">
              {ABBR[code]} § {section}
            </span>
            <span className="w-1 h-1 rounded-full bg-gold-400" />
            <span className="text-ink-500 group-hover:text-ink-800 transition-colors">{label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function StatuteMarquee() {
  return (
    <div className="space-y-3">
      <Row items={ROW_A} duration={70} />
      <Row items={ROW_B} duration={80} reverse />
    </div>
  );
}
