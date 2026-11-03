import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { KasaIllustration } from "./KasaIllustration";
import { useReveal } from "./useReveal";
import "./exploreCategories.css";

export type ExploreTarget =
  "rent" | "buy" | "sell" | "management" | "services" | "stays";

type Card = {
  id: ExploreTarget;
  illustration: string;
  title: string;
  note: string;
};
type Copy = { eyebrow: string; title: string; cards: Card[] };

// Six Kasa product pillars, each with its own illustration. Co-located copy for
// the six supported languages (pt-first).
const copyByLang: Record<string, Copy> = {
  pt: {
    eyebrow: "Explorar a Kasa",
    title: "Tudo o que a Kasa faz",
    cards: [
      {
        id: "rent",
        illustration: "category-rent",
        title: "Arrendar",
        note: "Casas para arrendamento direto",
      },
      {
        id: "buy",
        illustration: "category-buy",
        title: "Comprar",
        note: "Imóveis à venda, sem comissões",
      },
      {
        id: "sell",
        illustration: "category-sell",
        title: "Anunciar",
        note: "Publique o seu imóvel",
      },
      {
        id: "management",
        illustration: "category-management",
        title: "Gerir",
        note: "Rendas, manutenção e documentos",
      },
      {
        id: "services",
        illustration: "category-services",
        title: "Serviços",
        note: "Profissionais verificados",
      },
      {
        id: "stays",
        illustration: "category-stays",
        title: "Espaços",
        note: "Desporto e eventos",
      },
    ],
  },
  en: {
    eyebrow: "Explore Kasa",
    title: "Everything Kasa does",
    cards: [
      {
        id: "rent",
        illustration: "category-rent",
        title: "Rent",
        note: "Homes to rent directly",
      },
      {
        id: "buy",
        illustration: "category-buy",
        title: "Buy",
        note: "Homes for sale, no commissions",
      },
      {
        id: "sell",
        illustration: "category-sell",
        title: "List",
        note: "Publish your property",
      },
      {
        id: "management",
        illustration: "category-management",
        title: "Manage",
        note: "Rent, maintenance and documents",
      },
      {
        id: "services",
        illustration: "category-services",
        title: "Services",
        note: "Verified professionals",
      },
      {
        id: "stays",
        illustration: "category-stays",
        title: "Spaces",
        note: "Sport and events",
      },
    ],
  },
  es: {
    eyebrow: "Explora Kasa",
    title: "Todo lo que hace Kasa",
    cards: [
      {
        id: "rent",
        illustration: "category-rent",
        title: "Alquilar",
        note: "Viviendas en alquiler directo",
      },
      {
        id: "buy",
        illustration: "category-buy",
        title: "Comprar",
        note: "Inmuebles en venta, sin comisiones",
      },
      {
        id: "sell",
        illustration: "category-sell",
        title: "Publicar",
        note: "Anuncia tu inmueble",
      },
      {
        id: "management",
        illustration: "category-management",
        title: "Gestionar",
        note: "Rentas, mantenimiento y documentos",
      },
      {
        id: "services",
        illustration: "category-services",
        title: "Servicios",
        note: "Profesionales verificados",
      },
      {
        id: "stays",
        illustration: "category-stays",
        title: "Espacios",
        note: "Deporte y eventos",
      },
    ],
  },
  fr: {
    eyebrow: "Explorer Kasa",
    title: "Tout ce que fait Kasa",
    cards: [
      {
        id: "rent",
        illustration: "category-rent",
        title: "Louer",
        note: "Logements en location directe",
      },
      {
        id: "buy",
        illustration: "category-buy",
        title: "Acheter",
        note: "Biens à vendre, sans commission",
      },
      {
        id: "sell",
        illustration: "category-sell",
        title: "Publier",
        note: "Publiez votre bien",
      },
      {
        id: "management",
        illustration: "category-management",
        title: "Gérer",
        note: "Loyers, entretien et documents",
      },
      {
        id: "services",
        illustration: "category-services",
        title: "Services",
        note: "Professionnels vérifiés",
      },
      {
        id: "stays",
        illustration: "category-stays",
        title: "Espaces",
        note: "Sport et événements",
      },
    ],
  },
  ar: {
    eyebrow: "استكشف Kasa",
    title: "كل ما تقدمه Kasa",
    cards: [
      {
        id: "rent",
        illustration: "category-rent",
        title: "استئجار",
        note: "منازل للإيجار مباشرةً",
      },
      {
        id: "buy",
        illustration: "category-buy",
        title: "شراء",
        note: "عقارات للبيع بدون عمولات",
      },
      {
        id: "sell",
        illustration: "category-sell",
        title: "إعلان",
        note: "انشر عقارك",
      },
      {
        id: "management",
        illustration: "category-management",
        title: "إدارة",
        note: "الإيجارات والصيانة والمستندات",
      },
      {
        id: "services",
        illustration: "category-services",
        title: "خدمات",
        note: "محترفون موثّقون",
      },
      {
        id: "stays",
        illustration: "category-stays",
        title: "مساحات",
        note: "رياضة وفعاليات",
      },
    ],
  },
  zh: {
    eyebrow: "探索 Kasa",
    title: "Kasa 的全部功能",
    cards: [
      {
        id: "rent",
        illustration: "category-rent",
        title: "租房",
        note: "直接租赁的房源",
      },
      {
        id: "buy",
        illustration: "category-buy",
        title: "购房",
        note: "在售房源，无佣金",
      },
      {
        id: "sell",
        illustration: "category-sell",
        title: "发布房源",
        note: "发布您的房产",
      },
      {
        id: "management",
        illustration: "category-management",
        title: "管理",
        note: "租金、维护与文件",
      },
      {
        id: "services",
        illustration: "category-services",
        title: "服务",
        note: "经核验的专业人员",
      },
      {
        id: "stays",
        illustration: "category-stays",
        title: "场地",
        note: "运动与活动",
      },
    ],
  },
};

export function ExploreCategories({
  onExplore,
}: {
  onExplore: (target: ExploreTarget) => void;
}) {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language).split("-")[0];
  const copy = copyByLang[language] || copyByLang.en;
  const reveal = useReveal<HTMLElement>();

  return (
    <section
      className="explore-categories"
      aria-labelledby="explore-title"
      ref={reveal}
    >
      <header className="explore-head">
        <span className="eyebrow" data-reveal>
          {copy.eyebrow}
        </span>
        <h2 id="explore-title" className="display-serif" data-reveal>
          {copy.title}
        </h2>
      </header>
      <div className="explore-grid">
        {copy.cards.map((card, index) => (
          <button
            key={card.id}
            type="button"
            className="explore-card"
            data-reveal
            style={{ "--reveal-delay": `${index * 70}ms` } as CSSProperties}
            onClick={() => onExplore(card.id)}
          >
            <span className="explore-card-art">
              <KasaIllustration name={card.illustration} width="100%" />
            </span>
            <span className="explore-card-body">
              <strong>{card.title}</strong>
              <small>{card.note}</small>
            </span>
            <ChevronRight size={18} className="explore-card-chevron" />
          </button>
        ))}
      </div>
    </section>
  );
}
