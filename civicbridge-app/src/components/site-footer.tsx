import { ADAPTERS } from "@/lib/adapters";
import { TDR_POLICY } from "@/lib/adapters/railways";

const SOURCES = [
  { label: "NCH Convergence Program", url: ADAPTERS.nch.policy.sourceUrl },
  { label: "EPFO contact guidance", url: ADAPTERS.epfo.policy.sourceUrl },
  { label: "RailMadad FAQ", url: ADAPTERS.railways.policy.sourceUrl },
  { label: "IRCTC e-ticket cancellation / TDR rules", url: TDR_POLICY.sourceUrl },
  { label: "CPGRAMS public grievances", url: "https://pgportal.gov.in" }
];

export function SiteFooter() {
  const verifiedOn = ADAPTERS.nch.policy.verifiedOn;
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-8 text-xs leading-relaxed text-ink-secondary md:px-6">
        <p>
          Civic Sathi is an independent hackathon prototype, affiliated with no
          government body. Example citizens, cases and statuses are fictional.
          Cases are stored in this browser. Voice and AI features send data to their providers.
        </p>
        <p>
          Escalation policy sources were last checked on {verifiedOn}. Guidance is
          informational and source-linked - not legal advice.
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a
                className="underline decoration-line underline-offset-2 hover:text-ink"
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <p>Built with Gnani speech and Gemini, with offline fallbacks for the prototype.</p>
      </div>
    </footer>
  );
}
