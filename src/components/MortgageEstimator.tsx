import { useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import {
  Calculator,
  CircleAlert,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { displayTranslation, type LanguageCode } from "../i18n";

const localeByLanguage: Record<LanguageCode, string> = {
  pt: "pt-PT",
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
  ar: "ar",
  zh: "zh-CN",
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(
    Math.max(Number.isFinite(value) ? value : minimum, minimum),
    maximum,
  );

interface MortgageInputs {
  propertyPrice: number;
  downPaymentPercent: number;
  annualInterestRate: number;
  termYears: number;
  purchaseCostsPercent: number;
}

interface MortgageEstimate {
  downPayment: number;
  purchaseCosts: number;
  upfrontCash: number;
  loanAmount: number;
  monthlyPayment: number;
  totalInterest: number;
  totalRepayment: number;
  loanToValue: number;
}

function calculateMortgage({
  propertyPrice,
  downPaymentPercent,
  annualInterestRate,
  termYears,
  purchaseCostsPercent,
}: MortgageInputs): MortgageEstimate {
  const price = Math.max(propertyPrice, 0);
  const downPercent = clamp(downPaymentPercent, 0, 100);
  const costsPercent = clamp(purchaseCostsPercent, 0, 40);
  const years = clamp(termYears, 1, 50);
  const annualRate = clamp(annualInterestRate, 0, 30);
  const downPayment = price * (downPercent / 100);
  const purchaseCosts = price * (costsPercent / 100);
  const loanAmount = Math.max(price - downPayment, 0);
  const payments = years * 12;
  const monthlyRate = annualRate / 100 / 12;
  const monthlyPayment =
    loanAmount === 0
      ? 0
      : monthlyRate === 0
        ? loanAmount / payments
        : (loanAmount * monthlyRate * (1 + monthlyRate) ** payments) /
          ((1 + monthlyRate) ** payments - 1);
  const totalRepayment = monthlyPayment * payments;

  return {
    downPayment,
    purchaseCosts,
    upfrontCash: downPayment + purchaseCosts,
    loanAmount,
    monthlyPayment,
    totalInterest: Math.max(totalRepayment - loanAmount, 0),
    totalRepayment,
    loanToValue: price === 0 ? 0 : (loanAmount / price) * 100,
  };
}

function useMortgageI18n() {
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ||
    i18n.language ||
    "pt") as LanguageCode;
  const english = i18n.getFixedT("en");
  return {
    language,
    tr: (key: string) => displayTranslation(t(key), english(key), language),
  };
}

function useCurrency(language: LanguageCode) {
  return useMemo(
    () =>
      new Intl.NumberFormat(localeByLanguage[language], {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }),
    [language],
  );
}

export function MortgageCardEstimate({ price }: { price: number }) {
  const { language, tr } = useMortgageI18n();
  const currency = useCurrency(language);
  const estimate = calculateMortgage({
    propertyPrice: price,
    downPaymentPercent: 20,
    annualInterestRate: 3.5,
    termYears: 30,
    purchaseCostsPercent: 0,
  });

  return (
    <span className="mortgage-card-estimate">
      <Calculator size={13} />
      <span>
        {tr("mortgage.from")}{" "}
        <strong>{currency.format(estimate.monthlyPayment)}</strong>
        {tr("mortgage.perMonth")}
      </span>
      <em>{tr("mortgage.illustrativeShort")}</em>
    </span>
  );
}

export function MortgageEstimator({
  propertyPrice,
}: {
  propertyPrice: number;
}) {
  const { language, tr } = useMortgageI18n();
  const currency = useCurrency(language);
  const [price, setPrice] = useState(propertyPrice);
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [annualInterestRate, setAnnualInterestRate] = useState(3.5);
  const [termYears, setTermYears] = useState(30);
  const [purchaseCostsPercent, setPurchaseCostsPercent] = useState(8);

  const estimate = useMemo(
    () =>
      calculateMortgage({
        propertyPrice: price,
        downPaymentPercent,
        annualInterestRate,
        termYears,
        purchaseCostsPercent,
      }),
    [
      annualInterestRate,
      downPaymentPercent,
      price,
      purchaseCostsPercent,
      termYears,
    ],
  );

  const lowerRate = calculateMortgage({
    propertyPrice: price,
    downPaymentPercent,
    annualInterestRate: Math.max(annualInterestRate - 0.5, 0),
    termYears,
    purchaseCostsPercent,
  });
  const higherRate = calculateMortgage({
    propertyPrice: price,
    downPaymentPercent,
    annualInterestRate: annualInterestRate + 1,
    termYears,
    purchaseCostsPercent,
  });
  const principalShare =
    estimate.totalRepayment === 0
      ? 100
      : (estimate.loanAmount / estimate.totalRepayment) * 100;

  return (
    <section className="mortgage-estimator card">
      <header className="mortgage-estimator-header">
        <span className="mortgage-estimator-icon">
          <Calculator size={22} />
        </span>
        <div>
          <span className="eyebrow">{tr("mortgage.eyebrow")}</span>
          <h2>{tr("mortgage.title")}</h2>
          <p>{tr("mortgage.subtitle")}</p>
        </div>
        <span className="mortgage-live-badge">
          <i /> {tr("mortgage.live")}
        </span>
      </header>

      <div className="mortgage-estimator-grid">
        <div className="mortgage-controls">
          <label className="mortgage-field">
            <span>
              {tr("mortgage.propertyPrice")}
              <strong>{currency.format(price)}</strong>
            </span>
            <input
              aria-label={tr("mortgage.propertyPrice")}
              type="number"
              min="10000"
              step="5000"
              value={price}
              onChange={(event) =>
                setPrice(Math.max(Number(event.target.value), 0))
              }
            />
          </label>

          <label className="mortgage-field range-field">
            <span>
              {tr("mortgage.downPayment")}
              <strong>
                {downPaymentPercent}% · {currency.format(estimate.downPayment)}
              </strong>
            </span>
            <input
              aria-label={tr("mortgage.downPayment")}
              type="range"
              min="0"
              max="60"
              step="1"
              value={downPaymentPercent}
              onChange={(event) =>
                setDownPaymentPercent(Number(event.target.value))
              }
            />
            <span className="range-ends">
              <small>0%</small>
              <small>60%</small>
            </span>
          </label>

          <div className="mortgage-field-row">
            <label className="mortgage-field">
              <span>{tr("mortgage.interestRate")}</span>
              <div className="mortgage-number-input">
                <input
                  aria-label={tr("mortgage.interestRate")}
                  type="number"
                  min="0"
                  max="30"
                  step="0.1"
                  value={annualInterestRate}
                  onChange={(event) =>
                    setAnnualInterestRate(
                      clamp(Number(event.target.value), 0, 30),
                    )
                  }
                />
                <span>%</span>
              </div>
            </label>
            <label className="mortgage-field">
              <span>{tr("mortgage.purchaseCosts")}</span>
              <div className="mortgage-number-input">
                <input
                  aria-label={tr("mortgage.purchaseCosts")}
                  type="number"
                  min="0"
                  max="40"
                  step="0.5"
                  value={purchaseCostsPercent}
                  onChange={(event) =>
                    setPurchaseCostsPercent(
                      clamp(Number(event.target.value), 0, 40),
                    )
                  }
                />
                <span>%</span>
              </div>
            </label>
          </div>

          <fieldset className="mortgage-term">
            <legend>{tr("mortgage.term")}</legend>
            <div>
              {[15, 20, 25, 30, 35].map((years) => (
                <button
                  type="button"
                  key={years}
                  className={termYears === years ? "active" : ""}
                  onClick={() => setTermYears(years)}
                >
                  {years} {tr("mortgage.years")}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="mortgage-cost-note">
            <CircleAlert size={15} /> {tr("mortgage.costNote")}
          </p>
        </div>

        <div className="mortgage-results" aria-live="polite">
          <div className="mortgage-payment-hero">
            <span>{tr("mortgage.estimatedPayment")}</span>
            <strong>{currency.format(estimate.monthlyPayment)}</strong>
            <small>{tr("mortgage.perMonthLong")}</small>
          </div>
          <div className="mortgage-breakdown">
            <span>
              <small>{tr("mortgage.loanAmount")}</small>
              <strong>{currency.format(estimate.loanAmount)}</strong>
            </span>
            <span>
              <small>{tr("mortgage.upfrontCash")}</small>
              <strong>{currency.format(estimate.upfrontCash)}</strong>
            </span>
            <span>
              <small>{tr("mortgage.totalInterest")}</small>
              <strong>{currency.format(estimate.totalInterest)}</strong>
            </span>
            <span>
              <small>{tr("mortgage.loanToValue")}</small>
              <strong>{estimate.loanToValue.toFixed(0)}%</strong>
            </span>
          </div>
          <div className="mortgage-total-visual">
            <div
              className="mortgage-donut"
              style={
                {
                  "--principal-share": `${principalShare * 3.6}deg`,
                } as CSSProperties
              }
            >
              <span>
                <Landmark size={18} />
              </span>
            </div>
            <div>
              <small>{tr("mortgage.totalRepayment")}</small>
              <strong>{currency.format(estimate.totalRepayment)}</strong>
              <span>
                <i className="principal-dot" /> {tr("mortgage.principal")}
              </span>
              <span>
                <i className="interest-dot" /> {tr("mortgage.interest")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <section className="mortgage-scenarios">
        <div>
          <TrendingUp size={18} />
          <span>
            <strong>{tr("mortgage.scenarios")}</strong>
            <small>{tr("mortgage.scenariosNote")}</small>
          </span>
        </div>
        <span>
          <small>{Math.max(annualInterestRate - 0.5, 0).toFixed(1)}%</small>
          <strong>{currency.format(lowerRate.monthlyPayment)}</strong>
        </span>
        <span className="current">
          <small>{annualInterestRate.toFixed(1)}%</small>
          <strong>{currency.format(estimate.monthlyPayment)}</strong>
        </span>
        <span>
          <small>{(annualInterestRate + 1).toFixed(1)}%</small>
          <strong>{currency.format(higherRate.monthlyPayment)}</strong>
        </span>
      </section>

      <aside className="mortgage-safety-boundary">
        <LockKeyhole size={19} />
        <div>
          <strong>{tr("mortgage.safetyTitle")}</strong>
          <p>{tr("mortgage.safetyNote")}</p>
        </div>
      </aside>

      <footer className="mortgage-disclaimer">
        <ShieldCheck size={18} />
        <p>
          <strong>{tr("mortgage.disclaimerTitle")}</strong>{" "}
          {tr("mortgage.disclaimer")}
        </p>
      </footer>
    </section>
  );
}
