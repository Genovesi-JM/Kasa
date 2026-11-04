import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calculator, ChevronDown, Info } from "lucide-react";
import "./affordabilityCalculator.css";
import { estimateRentBudget } from "./affordability";

const localeByLang: Record<string, string> = {
  pt: "pt-PT",
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
  ar: "ar",
  zh: "zh-CN",
};

type Copy = {
  trigger: string;
  title: string;
  lead: string;
  income: string;
  incomeHint: string;
  commitments: string;
  commitmentsHint: string;
  resultLabel: string;
  perMonth: string;
  comfortable: string;
  upper: string;
  apply: string;
  disclaimer: string;
  enterIncome: string;
};

const copyByLang: Record<string, Copy> = {
  pt: {
    trigger: "Calcular o meu orçamento",
    title: "Qual a renda que posso pagar?",
    lead: "Uma estimativa a partir do seu rendimento. É apenas orientação.",
    income: "Rendimento mensal líquido",
    incomeHint: "O que recebe por mês, após impostos.",
    commitments: "Encargos mensais",
    commitmentsHint: "Créditos e outras despesas fixas.",
    resultLabel: "Intervalo ilustrativo de renda",
    perMonth: "/ mês",
    comfortable: "Cenário de 28%",
    upper: "Cenário de 35%",
    apply: "Ver imóveis no meu orçamento",
    disclaimer:
      "Cenários ilustrativos: 28% e 35% do rendimento líquido, menos os encargos indicados, arredondados para baixo. Não são aconselhamento financeiro nem uma avaliação da sua capacidade de pagamento. Os valores introduzidos ficam apenas neste ecrã.",
    enterIncome:
      "Introduza um rendimento positivo e encargos iguais ou superiores a zero.",
  },
  en: {
    trigger: "Work out my budget",
    title: "How much rent can I afford?",
    lead: "An estimate from your income. Guidance only.",
    income: "Monthly net income",
    incomeHint: "What you receive each month, after tax.",
    commitments: "Monthly commitments",
    commitmentsHint: "Loans and other fixed costs.",
    resultLabel: "Illustrative rent range",
    perMonth: "/ month",
    comfortable: "28% scenario",
    upper: "35% scenario",
    apply: "Show homes in my budget",
    disclaimer:
      "Illustrative scenarios: 28% and 35% of net income, less the commitments entered, rounded down. Not financial advice or an assessment of your ability to pay. Your inputs stay on this screen only.",
    enterIncome: "Enter a positive income and commitments of zero or more.",
  },
  es: {
    trigger: "Calcular mi presupuesto",
    title: "¿Cuánto alquiler puedo pagar?",
    lead: "Una estimación a partir de tus ingresos. Solo orientación.",
    income: "Ingresos netos mensuales",
    incomeHint: "Lo que recibes al mes, después de impuestos.",
    commitments: "Gastos mensuales",
    commitmentsHint: "Préstamos y otros gastos fijos.",
    resultLabel: "Rango de alquiler ilustrativo",
    perMonth: "/ mes",
    comfortable: "Escenario del 28%",
    upper: "Escenario del 35%",
    apply: "Ver viviendas en mi presupuesto",
    disclaimer:
      "Escenarios ilustrativos: 28% y 35% de los ingresos netos, menos los gastos indicados, redondeados hacia abajo. No es asesoramiento financiero ni una evaluación de tu capacidad de pago. Los datos introducidos se quedan en esta pantalla.",
    enterIncome:
      "Introduce ingresos positivos y gastos iguales o superiores a cero.",
  },
  fr: {
    trigger: "Calculer mon budget",
    title: "Quel loyer puis-je payer ?",
    lead: "Une estimation à partir de vos revenus. À titre indicatif.",
    income: "Revenu net mensuel",
    incomeHint: "Ce que vous percevez par mois, après impôts.",
    commitments: "Charges mensuelles",
    commitmentsHint: "Crédits et autres frais fixes.",
    resultLabel: "Fourchette de loyer indicative",
    perMonth: "/ mois",
    comfortable: "Scénario à 28%",
    upper: "Scénario à 35%",
    apply: "Voir les logements dans mon budget",
    disclaimer:
      "Scénarios indicatifs : 28 % et 35 % du revenu net, moins les charges saisies, arrondis à l’entier inférieur. Ni conseil financier ni évaluation de votre capacité de paiement. Vos données restent uniquement sur cet écran.",
    enterIncome:
      "Saisissez un revenu positif et des charges supérieures ou égales à zéro.",
  },
  ar: {
    trigger: "احسب ميزانيتي",
    title: "ما الإيجار الذي يمكنني تحمّله؟",
    lead: "تقدير بناءً على دخلك. للإرشاد فقط.",
    income: "صافي الدخل الشهري",
    incomeHint: "ما تتقاضاه شهريًا بعد الضرائب.",
    commitments: "الالتزامات الشهرية",
    commitmentsHint: "القروض والمصاريف الثابتة الأخرى.",
    resultLabel: "نطاق إيجار توضيحي",
    perMonth: "/ شهر",
    comfortable: "سيناريو 28%",
    upper: "سيناريو 35%",
    apply: "اعرض المنازل ضمن ميزانيتي",
    disclaimer:
      "سيناريوهان توضيحيان: 28% و35% من صافي الدخل، بعد خصم الالتزامات المدخلة والتقريب إلى الأسفل. ليست نصيحة مالية أو تقييمًا لقدرتك على الدفع. تبقى مدخلاتك على هذه الشاشة فقط.",
    enterIncome: "أدخل دخلاً موجبًا والتزامات تساوي صفرًا أو أكثر.",
  },
  zh: {
    trigger: "计算我的预算",
    title: "我能负担多少租金？",
    lead: "根据您的收入估算，仅供参考。",
    income: "每月净收入",
    incomeHint: "税后每月到手的金额。",
    commitments: "每月固定支出",
    commitmentsHint: "贷款及其他固定开支。",
    resultLabel: "租金示例区间",
    perMonth: "/ 月",
    comfortable: "28% 情景",
    upper: "35% 情景",
    apply: "查看预算内的房源",
    disclaimer:
      "示例情景：净收入的 28% 和 35% 减去输入的固定支出，并向下取整。这不是财务建议或支付能力评估。输入数据仅保留在此页面。",
    enterIncome: "请输入正数收入，固定支出必须为零或正数。",
  },
};

export function AffordabilityCalculator({
  onApplyBudget,
}: {
  onApplyBudget: (maxRent: number) => void;
}) {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || "en").split(
    "-",
  )[0];
  const copy = copyByLang[language] || copyByLang.en;
  const money = useMemo(
    () =>
      new Intl.NumberFormat(localeByLang[language] || "en-GB", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }),
    [language],
  );

  const bodyId = useId();
  const [open, setOpen] = useState(false);
  const [income, setIncome] = useState("");
  const [commitments, setCommitments] = useState("");

  const estimate = estimateRentBudget(income, commitments);

  return (
    <section className="affordability card">
      <button
        type="button"
        className="affordability-trigger"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="affordability-trigger-icon" aria-hidden="true">
          <Calculator size={18} />
        </span>
        <span>{copy.trigger}</span>
        <ChevronDown
          size={18}
          className="affordability-chevron"
          data-open={open}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="affordability-body" id={bodyId}>
          <h3>{copy.title}</h3>
          <p className="affordability-lead">{copy.lead}</p>
          <div className="affordability-fields">
            <label>
              <span>{copy.income} (€)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                max={Number.MAX_SAFE_INTEGER}
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                placeholder="0"
              />
              <small>{copy.incomeHint}</small>
            </label>
            <label>
              <span>{copy.commitments} (€)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                max={Number.MAX_SAFE_INTEGER}
                value={commitments}
                onChange={(e) => setCommitments(e.target.value)}
                placeholder="0"
              />
              <small>{copy.commitmentsHint}</small>
            </label>
          </div>

          {estimate ? (
            <div className="affordability-result" role="status">
              <div>
                <span className="eyebrow">{copy.resultLabel}</span>
                <strong>
                  {money.format(estimate.lower)} –{" "}
                  {money.format(estimate.upper)} <small>{copy.perMonth}</small>
                </strong>
                <div className="affordability-bands">
                  <span>
                    <b>{money.format(estimate.lower)}</b> {copy.comfortable}
                  </span>
                  <span>
                    <b>{money.format(estimate.upper)}</b> {copy.upper}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="button affordability-apply"
                onClick={() => onApplyBudget(estimate.upper)}
                disabled={estimate.upper <= 0}
              >
                {copy.apply}
              </button>
            </div>
          ) : (
            <p className="affordability-empty">{copy.enterIncome}</p>
          )}

          <p className="affordability-disclaimer">
            <Info size={14} aria-hidden="true" /> {copy.disclaimer}
          </p>
        </div>
      )}
    </section>
  );
}
