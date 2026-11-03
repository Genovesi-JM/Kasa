import { useId } from "react";
import { ExternalLink, LockKeyhole, ShieldCheck } from "lucide-react";
import type { LanguageCode } from "../i18n";
import { marketGateIds } from "../platform/marketPolicy";
import { marketReadinessCopy } from "./marketReadinessCopy";
import "./marketReadiness.css";

export function MarketReadiness({ language }: { language: LanguageCode }) {
  const copy = marketReadinessCopy(language);
  const headingId = useId();
  return (
    <section className="card market-readiness" aria-labelledby={headingId}>
      <header>
        <span className="eyebrow">{copy.eyebrow}</span>
        <h2 id={headingId}>{copy.title}</h2>
        <span className="market-launch-blocked">
          <LockKeyhole size={15} aria-hidden="true" />
          {copy.blocked}
        </span>
        <p>{copy.intro}</p>
      </header>
      <div className="market-gates">
        {marketGateIds.map((gate) => (
          <details key={gate}>
            <summary>
              <strong>{copy[gate]}</strong>
              <span>{copy.pending}</span>
            </summary>
            <p>{copy[`${gate}Note`]}</p>
          </details>
        ))}
      </div>
      <details className="market-legal-note">
        <summary>{copy.legalTitle}</summary>
        <p>{copy.legalNote}</p>
        <div className="market-source-links">
          <a
            href="https://lex.ao/docs/assembleia-nacional/2012/lei-n-o-14-12-de-04-de-maio/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {copy.law}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <a
            href="https://lex.ao/docs/presidente-da-republica/2020/decreto-presidencial-n-o-320-20-de-24-de-dezembro/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {copy.regulation}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      </details>
      <p className="market-boundary">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>{copy.boundary}</span>
      </p>
      <small>{copy.footer}</small>
    </section>
  );
}
