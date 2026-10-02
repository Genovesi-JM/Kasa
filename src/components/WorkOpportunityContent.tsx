import type { WorkOpportunity } from "../types";
import { useWorkCopy } from "./workCopy";

export function WorkOpportunityContent({
  opportunity,
}: {
  opportunity: Pick<
    WorkOpportunity,
    "business" | "location" | "type" | "pay" | "description" | "skills"
  >;
}) {
  const { copy, arrangement } = useWorkCopy();
  return (
    <>
      <dl className="work-ui-facts">
        <div>
          <dt>{copy("Business", "Empresa")}</dt>
          <dd>{opportunity.business}</dd>
        </div>
        <div>
          <dt>{copy("Location", "Localização")}</dt>
          <dd>{opportunity.location}</dd>
        </div>
        <div>
          <dt>{copy("Work arrangement", "Regime de trabalho")}</dt>
          <dd>{arrangement(opportunity.type)}</dd>
        </div>
        <div>
          <dt>
            {copy("Listed pay or budget", "Remuneração ou orçamento indicado")}
          </dt>
          <dd>{opportunity.pay}</dd>
        </div>
      </dl>
      <section>
        <h3>
          {copy(
            "Responsibilities and requirements",
            "Responsabilidades e requisitos",
          )}
        </h3>
        <p className="work-ui-user-text">{opportunity.description}</p>
      </section>
      {opportunity.skills.length > 0 && (
        <section>
          <h3>{copy("Listed skills", "Competências indicadas")}</h3>
          <div className="work-ui-tags">
            {opportunity.skills.map((skill, index) => (
              <span key={`${index}-${skill}`}>{skill}</span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
