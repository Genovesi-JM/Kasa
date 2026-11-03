import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Cookie,
  FileText,
  Info,
  ScrollText,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import "./legalCenter.css";

type Section = { heading: string; body: string[] };
type Policy = {
  title: string;
  updated: string;
  intro: string;
  sections: Section[];
};
type LegalCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  draftTitle: string;
  draftBody: string;
  langNotice: string;
  tabs: {
    privacy: string;
    terms: string;
    cookies: string;
    business: string;
    deletion: string;
  };
  privacy: Policy;
  terms: Policy;
  cookies: Policy;
  business: Policy;
  deletion: Policy;
};

// Draft, prototype-stage policy content. NOT legal advice: these documents
// describe what the synthetic demo does and must be reviewed by qualified
// counsel before any launch. Authored in Portuguese (primary) and English;
// other languages see a notice and the English text.
const legalCopy: Record<"pt" | "en", LegalCopy> = {
  pt: {
    eyebrow: "Centro legal",
    title: "Políticas e transparência",
    lead: "Documentos do protótipo Kasa, escritos de forma honesta sobre o que esta demonstração faz com dados sintéticos.",
    draftTitle: "Rascunhos de protótipo — não são aconselhamento jurídico",
    draftBody:
      "Esta é uma demonstração interativa que utiliza dados sintéticos. Os textos abaixo são rascunhos para planeamento de produto, não constituem aconselhamento jurídico e devem ser revistos por advogados qualificados antes de qualquer lançamento.",
    langNotice:
      "As políticas estão disponíveis em Português e Inglês. Textos jurídicos não devem ser traduzidos automaticamente; mude o idioma para PT ou EN para os ler.",
    tabs: {
      privacy: "Privacidade",
      terms: "Termos",
      cookies: "Cookies",
      business: "Dados da empresa",
      deletion: "Eliminar dados",
    },
    privacy: {
      title: "Política de privacidade",
      updated: "Rascunho · atualizado em 2026",
      intro:
        "Descreve que dados o protótipo trata e como. A maioria do conteúdo é sintética e existe apenas no separador aberto.",
      sections: [
        {
          heading: "Que dados tratamos",
          body: [
            "Demonstração: mensagens, pesquisas, pedidos de visita, candidaturas e registos de exemplo ficam no separador aberto e são repostos ao recarregar. Não são enviados a outras pessoas.",
            "Contas locais opcionais (quando ativadas): email, nome a apresentar e uma palavra-passe guardada apenas como hash scrypt. Documentos privados carregados podem ser cifrados em repouso.",
            "Preferências: o idioma escolhido é guardado no armazenamento local do navegador.",
          ],
        },
        {
          heading: "O que não fazemos",
          body: [
            "Não usamos rastreadores, analítica de terceiros, píxeis publicitários nem criamos perfis.",
            "Não vendemos dados. A Kasa não recebe nem transfere rendas ou depósitos.",
          ],
        },
        {
          heading: "Partilha e retenção",
          body: [
            "Dados de demonstração não são partilhados e desaparecem ao recarregar. Dados de contas locais permanecem no dispositivo local onde a API é executada, até serem eliminados.",
          ],
        },
        {
          heading: "Os seus direitos",
          body: [
            "Pode pedir acesso ou eliminação dos dados de uma conta local através do contacto indicado em “Eliminar dados”. Num lançamento real, os direitos ao abrigo do RGPD e da legislação aplicável seriam confirmados pelo responsável pelo tratamento.",
          ],
        },
      ],
    },
    terms: {
      title: "Termos de utilização",
      updated: "Rascunho · atualizado em 2026",
      intro:
        "Condições de utilização desta demonstração. Não há transações reais nem contratos vinculativos através do protótipo.",
      sections: [
        {
          heading: "Natureza do serviço",
          body: [
            "A Kasa é uma plataforma de operações imobiliárias sem mediação. Não negoceia, não representa nenhuma das partes, não cobra comissões de transação e não detém rendas ou depósitos.",
            "Este protótipo é apenas para demonstração. Nomes, preços e datas são ilustrativos e não representam ofertas reais.",
          ],
        },
        {
          heading: "Utilização aceitável",
          body: [
            "Não utilize o serviço para fins ilícitos, nem tente contornar limites de segurança ou introduzir dados reais sensíveis de terceiros.",
          ],
        },
        {
          heading: "Sem garantias e limitação de responsabilidade",
          body: [
            "O protótipo é fornecido “tal como está”, sem garantias. Na máxima medida permitida por lei, não há responsabilidade por perdas decorrentes da utilização desta demonstração.",
          ],
        },
        {
          heading: "Lei aplicável",
          body: [
            "[Marcador] A lei aplicável e o foro seriam definidos com aconselhamento jurídico antes do lançamento, por país (ex.: Espanha, Angola).",
          ],
        },
      ],
    },
    cookies: {
      title: "Política de cookies",
      updated: "Rascunho · atualizado em 2026",
      intro:
        "A Kasa utiliza apenas o estritamente necessário. Não há cookies de analítica ou publicidade.",
      sections: [
        {
          heading: "O que usamos",
          body: [
            "Cookie de sessão estritamente necessário: apenas quando usa uma conta local opcional, para manter a sessão iniciada. É removido ao terminar sessão.",
            "Armazenamento local: guarda a sua preferência de idioma. Não é um cookie e não identifica a pessoa.",
          ],
        },
        {
          heading: "O que não usamos",
          body: [
            "Sem cookies de analítica, marketing, publicidade ou redes de terceiros.",
          ],
        },
        {
          heading: "Como controlar",
          body: [
            "Pode limpar o armazenamento e os cookies do site nas definições do navegador a qualquer momento. Como só usamos o estritamente necessário, não é apresentado um banner de consentimento para rastreio — apenas um aviso informativo.",
          ],
        },
      ],
    },
    business: {
      title: "Dados da empresa",
      updated: "Rascunho · marcadores",
      intro:
        "Dados de identificação do responsável. Preencher com os dados reais da entidade antes do lançamento.",
      sections: [
        {
          heading: "Identificação",
          body: [
            "Entidade legal: [A registar]",
            "Número de registo / NIF: [Marcador]",
            "Morada registada: [Marcador]",
          ],
        },
        {
          heading: "Contactos",
          body: [
            "Email geral: [contacto@exemplo]",
            "Proteção de dados / RGPD: [dpo@exemplo]",
          ],
        },
      ],
    },
    deletion: {
      title: "Eliminar os meus dados",
      updated: "Rascunho · atualizado em 2026",
      intro: "Como pedir a eliminação de dados associados a uma conta local.",
      sections: [
        {
          heading: "Dados de demonstração",
          body: [
            "Não é necessário pedir nada: os dados de demonstração existem apenas no separador aberto e são eliminados ao recarregar a página.",
          ],
        },
        {
          heading: "Contas locais",
          body: [
            "Para pedir a eliminação de uma conta local e dos documentos associados, contacte [contacto@exemplo] a partir do email da conta. Num lançamento real, o pedido seria confirmado e cumprido dentro dos prazos legais aplicáveis.",
          ],
        },
      ],
    },
  },
  en: {
    eyebrow: "Legal center",
    title: "Policies & transparency",
    lead: "Kasa prototype documents, written honestly about what this demonstration does with synthetic data.",
    draftTitle: "Prototype drafts — not legal advice",
    draftBody:
      "This is an interactive demonstration that uses synthetic data. The texts below are drafts for product planning, are not legal advice, and must be reviewed by qualified counsel before any launch.",
    langNotice:
      "Policies are available in Portuguese and English. Legal text should not be machine-translated; switch the language to PT or EN to read them.",
    tabs: {
      privacy: "Privacy",
      terms: "Terms",
      cookies: "Cookies",
      business: "Business details",
      deletion: "Delete data",
    },
    privacy: {
      title: "Privacy policy",
      updated: "Draft · updated 2026",
      intro:
        "Describes what data the prototype handles and how. Most content is synthetic and lives only in the open tab.",
      sections: [
        {
          heading: "What we handle",
          body: [
            "Demo: sample messages, searches, viewing requests, applications and records stay in the open tab and reset on reload. They are not delivered to anyone.",
            "Optional local accounts (when enabled): email, display name and a password stored only as a scrypt hash. Uploaded private documents can be encrypted at rest.",
            "Preferences: your chosen language is stored in the browser's local storage.",
          ],
        },
        {
          heading: "What we don't do",
          body: [
            "We use no trackers, third-party analytics, advertising pixels or profiling.",
            "We don't sell data. Kasa never receives or forwards rent or deposits.",
          ],
        },
        {
          heading: "Sharing & retention",
          body: [
            "Demo data is not shared and disappears on reload. Local-account data stays on the local device running the API until deleted.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "You can request access to or deletion of local-account data via the contact under “Delete data”. In a real launch, rights under the GDPR and applicable law would be confirmed by the data controller.",
          ],
        },
      ],
    },
    terms: {
      title: "Terms of use",
      updated: "Draft · updated 2026",
      intro:
        "Conditions for using this demonstration. There are no real transactions or binding contracts through the prototype.",
      sections: [
        {
          heading: "Nature of the service",
          body: [
            "Kasa is a non-brokerage property-operations platform. It does not negotiate, represent either party, earn transaction commissions, or hold rent or deposits.",
            "This prototype is for demonstration only. Names, prices and dates are illustrative and are not real offers.",
          ],
        },
        {
          heading: "Acceptable use",
          body: [
            "Do not use the service for unlawful purposes, attempt to bypass security limits, or enter real sensitive data about other people.",
          ],
        },
        {
          heading: "No warranties & limitation of liability",
          body: [
            "The prototype is provided “as is”, without warranties. To the maximum extent permitted by law, there is no liability for losses arising from use of this demonstration.",
          ],
        },
        {
          heading: "Governing law",
          body: [
            "[Placeholder] Governing law and venue would be set with legal counsel before launch, per country (e.g. Spain, Angola).",
          ],
        },
      ],
    },
    cookies: {
      title: "Cookie policy",
      updated: "Draft · updated 2026",
      intro:
        "Kasa uses only what is strictly necessary. There are no analytics or advertising cookies.",
      sections: [
        {
          heading: "What we use",
          body: [
            "Strictly-necessary session cookie: only when you use an optional local account, to keep you signed in. It is removed on logout.",
            "Local storage: keeps your language preference. It is not a cookie and does not identify you.",
          ],
        },
        {
          heading: "What we don't use",
          body: [
            "No analytics, marketing, advertising or third-party network cookies.",
          ],
        },
        {
          heading: "How to control",
          body: [
            "You can clear the site's storage and cookies in your browser settings at any time. Because we use only the strictly necessary, there is no tracking-consent banner — only an informational notice.",
          ],
        },
      ],
    },
    business: {
      title: "Business details",
      updated: "Draft · placeholders",
      intro:
        "Controller identification. Fill in with the real entity details before launch.",
      sections: [
        {
          heading: "Identification",
          body: [
            "Legal entity: [To be registered]",
            "Registration number / VAT: [Placeholder]",
            "Registered address: [Placeholder]",
          ],
        },
        {
          heading: "Contacts",
          body: [
            "General email: [contact@example]",
            "Data protection / GDPR: [dpo@example]",
          ],
        },
      ],
    },
    deletion: {
      title: "Delete my data",
      updated: "Draft · updated 2026",
      intro: "How to request deletion of data tied to a local account.",
      sections: [
        {
          heading: "Demo data",
          body: [
            "Nothing to request: demo data lives only in the open tab and is deleted when you reload the page.",
          ],
        },
        {
          heading: "Local accounts",
          body: [
            "To request deletion of a local account and its documents, contact [contact@example] from the account's email. In a real launch, the request would be confirmed and fulfilled within applicable legal timeframes.",
          ],
        },
      ],
    },
  },
};

const tabIcons = {
  privacy: ShieldCheck,
  terms: ScrollText,
  cookies: Cookie,
  business: Building2,
  deletion: Trash2,
} as const;

type TabKey = keyof typeof tabIcons;
const tabOrder: TabKey[] = [
  "privacy",
  "terms",
  "cookies",
  "business",
  "deletion",
];

export function LegalCenter({ onBack }: { onBack: () => void }) {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language).split("-")[0];
  const isTranslated = language === "pt" || language === "en";
  const copy = language === "pt" ? legalCopy.pt : legalCopy.en;
  const [tab, setTab] = useState<TabKey>("privacy");
  const policy = copy[tab];

  return (
    <div className="page-stack legal-center">
      <div className="detail-toolbar">
        <button className="text-button" onClick={onBack}>
          ← {copy.eyebrow}
        </button>
      </div>

      <header className="legal-hero">
        <span className="eyebrow light">{copy.eyebrow}</span>
        <h2 className="display-serif">{copy.title}</h2>
        <p>{copy.lead}</p>
      </header>

      <div className="legal-draft" role="note">
        <FileText size={18} aria-hidden="true" />
        <div>
          <strong>{copy.draftTitle}</strong>
          <p>{copy.draftBody}</p>
        </div>
      </div>

      {!isTranslated && (
        <div className="legal-lang-notice" role="note">
          <Info size={16} aria-hidden="true" /> {copy.langNotice}
        </div>
      )}

      <div className="legal-tabs" role="tablist" aria-label={copy.title}>
        {tabOrder.map((key) => {
          const Icon = tabIcons[key];
          return (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              <Icon size={15} aria-hidden="true" /> {copy.tabs[key]}
            </button>
          );
        })}
      </div>

      <article className="card padded legal-policy" aria-live="polite">
        <div className="legal-policy-head">
          <h3>{policy.title}</h3>
          <span>{policy.updated}</span>
        </div>
        <p className="legal-policy-intro">{policy.intro}</p>
        {policy.sections.map((section) => (
          <section key={section.heading} className="legal-policy-section">
            <h4>{section.heading}</h4>
            {section.body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
