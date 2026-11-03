import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cookie } from "lucide-react";
import { readPreference, writePreference } from "../platform/preferences";
import "./cookieNotice.css";

const STORAGE_KEY = "kasa:privacy-notice-ack";

// Kasa sets only strictly-necessary cookies and stores a language preference,
// with no tracking — so this is an informational notice to acknowledge, not a
// tracking-consent gate. Privacy-preserving by default: nothing to opt into.
const noticeCopy: Record<
  string,
  { text: string; policy: string; dismiss: string; label: string }
> = {
  pt: {
    text: "A Kasa usa apenas cookies estritamente necessários e guarda a sua preferência de idioma. Sem rastreio nem analítica.",
    policy: "Política de cookies",
    dismiss: "Compreendi",
    label: "Aviso de privacidade",
  },
  en: {
    text: "Kasa uses only strictly-necessary cookies and stores your language preference. No tracking or analytics.",
    policy: "Cookie policy",
    dismiss: "Got it",
    label: "Privacy notice",
  },
  es: {
    text: "Kasa usa solo cookies estrictamente necesarias y guarda tu preferencia de idioma. Sin rastreo ni analítica.",
    policy: "Política de cookies",
    dismiss: "Entendido",
    label: "Aviso de privacidad",
  },
  fr: {
    text: "Kasa n’utilise que des cookies strictement nécessaires et enregistre votre langue. Aucun suivi ni analytique.",
    policy: "Politique de cookies",
    dismiss: "J’ai compris",
    label: "Avis de confidentialité",
  },
  ar: {
    text: "تستخدم Kasa ملفات تعريف ارتباط ضرورية فقط وتحفظ لغتك المفضلة. بدون تتبع أو تحليلات.",
    policy: "سياسة ملفات تعريف الارتباط",
    dismiss: "فهمت",
    label: "إشعار الخصوصية",
  },
  zh: {
    text: "Kasa 仅使用严格必要的 Cookie 并保存您的语言偏好。不进行跟踪或分析。",
    policy: "Cookie 政策",
    dismiss: "我知道了",
    label: "隐私提示",
  },
};

export function CookieNotice({ onOpenPolicy }: { onOpenPolicy: () => void }) {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language).split("-")[0];
  const copy = noticeCopy[language] || noticeCopy.en;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readPreference(STORAGE_KEY) !== "1") setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    writePreference(STORAGE_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="cookie-notice" role="region" aria-label={copy.label}>
      <div className="cookie-notice-body">
        <Cookie size={18} aria-hidden="true" />
        <p>
          {copy.text}{" "}
          <button
            type="button"
            className="cookie-notice-link"
            onClick={() => {
              dismiss();
              onOpenPolicy();
            }}
          >
            {copy.policy}
          </button>
        </p>
      </div>
      <button type="button" className="cookie-notice-dismiss" onClick={dismiss}>
        {copy.dismiss}
      </button>
    </div>
  );
}
