import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarCheck,
  FileCheck2,
  KeyRound,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useReveal } from "./useReveal";
import "./howKasaWorks.css";

type Step = { title: string; body: string };
type Copy = {
  eyebrow: string;
  title: string;
  lead: string;
  steps: [Step, Step, Step, Step];
  promise: string;
};

// Co-located copy for the six supported languages (pt-first product).
const howCopy: Record<string, Copy> = {
  pt: {
    eyebrow: "Sem intermediários",
    title: "Da descoberta às chaves, diretamente.",
    lead: "As duas partes falam e decidem entre si. A Kasa organiza cada passo — nunca negoceia, representa ou retém valores.",
    steps: [
      {
        title: "Descubra",
        body: "Pesquise e compare casas com informação verificada, ao seu ritmo.",
      },
      {
        title: "Visite",
        body: "Peça uma visita e combine diretamente com quem anuncia.",
      },
      {
        title: "Candidate-se",
        body: "Envie a candidatura e os documentos num só lugar, com privacidade.",
      },
      {
        title: "Mude-se",
        body: "Combinem as condições e recebam as chaves. Bem-vindo a casa.",
      },
    ],
    promise:
      "Comunicação e contrato diretos. A Kasa não é agência imobiliária.",
  },
  en: {
    eyebrow: "No middlemen",
    title: "From discovery to keys, directly.",
    lead: "Both sides talk and decide between themselves. Kasa organises every step — it never negotiates, represents or holds funds.",
    steps: [
      {
        title: "Discover",
        body: "Search and compare homes with checked information, at your own pace.",
      },
      {
        title: "Visit",
        body: "Request a viewing and arrange it directly with the listing party.",
      },
      {
        title: "Apply",
        body: "Send your application and documents in one place, privately.",
      },
      {
        title: "Move in",
        body: "Agree the terms together and get the keys. Welcome home.",
      },
    ],
    promise: "Direct communication and contracts. Kasa is not an estate agent.",
  },
  es: {
    eyebrow: "Sin intermediarios",
    title: "Del descubrimiento a las llaves, directamente.",
    lead: "Las dos partes hablan y deciden entre sí. Kasa organiza cada paso: nunca negocia, representa ni retiene fondos.",
    steps: [
      {
        title: "Descubre",
        body: "Busca y compara viviendas con información verificada, a tu ritmo.",
      },
      {
        title: "Visita",
        body: "Pide una visita y acuérdala directamente con quien anuncia.",
      },
      {
        title: "Solicita",
        body: "Envía tu solicitud y documentos en un solo lugar, con privacidad.",
      },
      {
        title: "Múdate",
        body: "Acordad las condiciones y recibid las llaves. Bienvenido a casa.",
      },
    ],
    promise:
      "Comunicación y contratos directos. Kasa no es una agencia inmobiliaria.",
  },
  fr: {
    eyebrow: "Sans intermédiaires",
    title: "De la découverte aux clés, en direct.",
    lead: "Les deux parties échangent et décident entre elles. Kasa organise chaque étape : elle ne négocie pas, ne représente personne et ne détient aucun fonds.",
    steps: [
      {
        title: "Découvrez",
        body: "Cherchez et comparez des logements à l’information vérifiée, à votre rythme.",
      },
      {
        title: "Visitez",
        body: "Demandez une visite et organisez-la directement avec l’annonceur.",
      },
      {
        title: "Candidatez",
        body: "Envoyez votre dossier et vos documents au même endroit, en privé.",
      },
      {
        title: "Emménagez",
        body: "Convenez des conditions ensemble et recevez les clés. Bienvenue chez vous.",
      },
    ],
    promise:
      "Communication et contrats directs. Kasa n’est pas une agence immobilière.",
  },
  ar: {
    eyebrow: "بدون وسطاء",
    title: "من الاكتشاف إلى المفاتيح، مباشرةً.",
    lead: "يتحدث الطرفان ويقرران فيما بينهما. تنظّم Kasa كل خطوة — ولا تتفاوض أو تمثّل أو تحتفظ بالأموال.",
    steps: [
      {
        title: "اكتشف",
        body: "ابحث وقارن بين المنازل بمعلومات موثّقة، على مهلك.",
      },
      {
        title: "عايِن",
        body: "اطلب معاينة ونسّقها مباشرةً مع صاحب الإعلان.",
      },
      {
        title: "قدِّم طلبك",
        body: "أرسل طلبك ومستنداتك في مكان واحد وبخصوصية.",
      },
      {
        title: "انتقل للسكن",
        body: "اتفقا على الشروط واستلم المفاتيح. أهلاً بك في بيتك.",
      },
    ],
    promise: "تواصل وعقود مباشرة. Kasa ليست وكالة عقارية.",
  },
  zh: {
    eyebrow: "没有中间商",
    title: "从发现到拿到钥匙，全程直连。",
    lead: "双方直接沟通并自行决定。Kasa 负责安排每一步——绝不代为谈判、代表任何一方或代管资金。",
    steps: [
      {
        title: "发现",
        body: "按自己的节奏，搜索并比较经过核验信息的房源。",
      },
      {
        title: "看房",
        body: "申请看房，并直接与房源发布方约定时间。",
      },
      {
        title: "申请",
        body: "在同一处私密地提交申请与证明文件。",
      },
      {
        title: "入住",
        body: "双方商定条件并交接钥匙。欢迎回家。",
      },
    ],
    promise: "直接沟通、直接签约。Kasa 不是房产中介。",
  },
};

const stepIcons = [Search, CalendarCheck, FileCheck2, KeyRound];

export function HowKasaWorks() {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language).split("-")[0];
  const copy = howCopy[language] || howCopy.en;
  const reveal = useReveal<HTMLElement>();

  return (
    <section className="how-kasa" aria-labelledby="how-kasa-title" ref={reveal}>
      <header className="how-kasa-head">
        <span className="eyebrow" data-reveal>
          {copy.eyebrow}
        </span>
        <h2 id="how-kasa-title" className="display-serif" data-reveal>
          {copy.title}
        </h2>
        <p data-reveal>{copy.lead}</p>
      </header>
      <ol className="how-kasa-steps">
        {copy.steps.map((step, index) => {
          const Icon = stepIcons[index];
          return (
            <li
              key={step.title}
              data-reveal
              style={{ "--reveal-delay": `${index * 90}ms` } as CSSProperties}
            >
              <span className="how-kasa-index">{index + 1}</span>
              <span className="how-kasa-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          );
        })}
      </ol>
      <p className="how-kasa-promise" data-reveal>
        <ShieldCheck size={16} aria-hidden="true" /> {copy.promise}
      </p>
    </section>
  );
}
