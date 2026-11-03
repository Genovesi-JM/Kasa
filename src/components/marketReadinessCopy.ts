import type { LanguageCode } from "../i18n";

const en = {
  eyebrow: "PROTOTYPE RELEASE POLICY",
  title: "Before Kasa goes live",
  blocked: "Live launch blocked",
  pending: "Pending",
  intro:
    "The simulator remains available. No market has been cleared for real transactions or paid property promotion.",
  boundary:
    "Non-brokerage is our intended operating model, not a legal exemption. No Kasa representation, negotiation, property success fees, rent custody or deposit custody.",
  propertyClassification: "Property activity classification",
  propertyClassificationNote:
    "Obtain a written Angolan legal assessment of self-service listings, search, chat, viewing requests, applications and paid promotion. Clarify the licensing boundary with the INH before activation.",
  privacyHosting: "Privacy and hosting",
  privacyHostingNote:
    "Confirm data-protection procedures, retention and access controls. Prioritise hosting and backups in Angola; assess any foreign login, messaging, map, support or storage provider separately.",
  paymentsTax: "Payments and invoicing",
  paymentsTaxNote:
    "Validate provider contracts, direct settlement, refunds and tax treatment. Rent goes directly to the landlord. Real payments, checkout and commissions are not connected.",
  trustSafety: "Trust and operating duties",
  trustSafetyNote:
    "Implement reporting, moderation, appeals and precise verification claims. Confirm applicable registrations, security procedures and each listing party’s authority. A badge is not an ownership or safety guarantee.",
  productionSystems: "Production systems",
  productionSystemsNote:
    "Connect and test authentication, permissions, database, backups and incident handling. Current records are synthetic and local; an available API does not make the product launch-ready.",
  legalTitle: "Why the property review matters in Angola",
  legalNote:
    "Law 14/12, Article 4, includes prospecting and property promotion within the scope of mediation. This does not establish that every listings website is a broker; the actual service and contracts need review. Avoiding commission alone does not settle classification.",
  law: "Law 14/12 · Articles 4–5",
  regulation: "Presidential Decree 320/20",
  footer:
    "This checklist records unresolved work. It does not grant legal approval, and no browser switch can clear it.",
  diagnosticTitle: "Market launch approval",
  technicalTitle: "Prototype restrictions",
  technicalNote:
    "Technical restrictions verified; legal classification remains pending.",
  diagnosticNote:
    "Still blocked: technical checks are not legal approval or production readiness.",
};
type Copy = Record<keyof typeof en, string>;

export const marketReadinessTranslations: Record<LanguageCode, Copy> = {
  en,
  pt: {
    eyebrow: "POLÍTICA DE LANÇAMENTO DO PROTÓTIPO",
    title: "Antes do lançamento da Kasa",
    blocked: "Lançamento real bloqueado",
    pending: "Pendente",
    intro:
      "O simulador continua disponível. Nenhum mercado foi aprovado para transações reais ou promoção paga de imóveis.",
    boundary:
      "Não atuar como mediadora é o modelo pretendido, não uma isenção legal. Sem representação, negociação, comissão de sucesso imobiliário ou custódia de rendas e cauções pela Kasa.",
    propertyClassification: "Enquadramento da atividade imobiliária",
    propertyClassificationNote:
      "Obter parecer jurídico angolano escrito sobre anúncios autónomos, pesquisa, chat, visitas, candidaturas e promoção paga. Esclarecer com o INH os limites do licenciamento antes de ativar estas funções.",
    privacyHosting: "Privacidade e alojamento de dados",
    privacyHostingNote:
      "Confirmar procedimentos de proteção de dados, conservação e controlo de acesso. Priorizar servidores e cópias de segurança em Angola; avaliar separadamente fornecedores estrangeiros de login, mensagens, mapas, suporte ou armazenamento.",
    paymentsTax: "Pagamentos e faturação",
    paymentsTaxNote:
      "Validar contratos com prestadores, liquidação direta, reembolsos e tratamento fiscal. A renda vai diretamente para o senhorio. Pagamentos reais, checkout e comissões não estão ligados.",
    trustSafety: "Confiança e deveres operacionais",
    trustSafetyNote:
      "Implementar denúncias, moderação, recursos e declarações de verificação precisas. Confirmar registos aplicáveis, procedimentos de segurança e poderes do anunciante. Um selo não garante propriedade ou segurança.",
    productionSystems: "Sistemas de produção",
    productionSystemsNote:
      "Ligar e testar autenticação, permissões, base de dados, cópias de segurança e resposta a incidentes. Os registos atuais são fictícios e locais; uma API disponível não torna o produto pronto para lançamento.",
    legalTitle: "Porque importa a análise imobiliária em Angola",
    legalNote:
      "O artigo 4.º da Lei 14/12 inclui prospeção e promoção de imóveis no âmbito da mediação. Isto não determina que todos os portais sejam mediadores; é necessário analisar o serviço e os contratos concretos. Não cobrar comissão, por si só, não resolve o enquadramento.",
    law: "Lei 14/12 · Artigos 4.º–5.º",
    regulation: "Decreto Presidencial 320/20",
    footer:
      "Esta lista regista trabalho pendente. Não concede aprovação jurídica e nenhum botão no navegador a pode dar por concluída.",
    diagnosticTitle: "Aprovação para lançamento no mercado",
    technicalTitle: "Restrições do protótipo",
    technicalNote:
      "Restrições técnicas verificadas; o enquadramento jurídico continua pendente.",
    diagnosticNote:
      "Continua bloqueado: testes técnicos não equivalem a aprovação jurídica ou prontidão para produção.",
  },
  es: {
    eyebrow: "POLÍTICA DE LANZAMIENTO DEL PROTOTIPO",
    title: "Antes de lanzar Kasa",
    blocked: "Lanzamiento real bloqueado",
    pending: "Pendiente",
    intro:
      "El simulador sigue disponible. Ningún mercado está autorizado para transacciones reales o promoción inmobiliaria de pago.",
    boundary:
      "No actuar como intermediario es el modelo previsto, no una exención legal. Kasa no representa, negocia, cobra comisiones inmobiliarias de éxito ni custodia alquileres o fianzas.",
    propertyClassification: "Clasificación de la actividad inmobiliaria",
    propertyClassificationNote:
      "Obtener un dictamen jurídico angoleño escrito sobre anuncios autónomos, búsqueda, chat, visitas, solicitudes y promoción de pago. Aclarar con el INH los límites de licencia antes de activar estas funciones.",
    privacyHosting: "Privacidad y alojamiento de datos",
    privacyHostingNote:
      "Confirmar protección de datos, conservación y controles de acceso. Priorizar servidores y copias en Angola; evaluar por separado proveedores extranjeros de acceso, mensajes, mapas, soporte o almacenamiento.",
    paymentsTax: "Pagos y facturación",
    paymentsTaxNote:
      "Validar contratos, liquidación directa, reembolsos e impuestos. El alquiler va directamente al propietario. Los pagos reales, el checkout y las comisiones no están conectados.",
    trustSafety: "Confianza y obligaciones operativas",
    trustSafetyNote:
      "Implementar denuncias, moderación, recursos y verificaciones precisas. Confirmar registros, seguridad y autoridad del anunciante. Un distintivo no garantiza propiedad ni seguridad.",
    productionSystems: "Sistemas de producción",
    productionSystemsNote:
      "Conectar y probar autenticación, permisos, base de datos, copias y gestión de incidentes. Los registros son ficticios y locales; una API disponible no implica preparación para el lanzamiento.",
    legalTitle: "Por qué importa la revisión inmobiliaria en Angola",
    legalNote:
      "El artículo 4 de la Ley 14/12 incluye prospección y promoción inmobiliaria en la mediación. Esto no determina que todo portal sea intermediario; deben revisarse el servicio y los contratos. No cobrar comisión no resuelve por sí solo la clasificación.",
    law: "Ley 14/12 · Artículos 4–5",
    regulation: "Decreto Presidencial 320/20",
    footer:
      "Esta lista registra tareas pendientes. No concede aprobación legal ni puede completarse con un botón del navegador.",
    diagnosticTitle: "Aprobación de lanzamiento",
    technicalTitle: "Restricciones del prototipo",
    technicalNote:
      "Restricciones técnicas verificadas; la clasificación legal sigue pendiente.",
    diagnosticNote:
      "Sigue bloqueado: las pruebas técnicas no equivalen a aprobación legal ni preparación para producción.",
  },
  fr: {
    eyebrow: "POLITIQUE DE LANCEMENT DU PROTOTYPE",
    title: "Avant le lancement de Kasa",
    blocked: "Lancement réel bloqué",
    pending: "En attente",
    intro:
      "Le simulateur reste disponible. Aucun marché n’est approuvé pour des transactions réelles ou la promotion immobilière payante.",
    boundary:
      "L’absence de courtage est le modèle visé, pas une exemption légale. Kasa ne représente ni ne négocie, ne facture aucune commission immobilière au succès et ne détient ni loyers ni dépôts.",
    propertyClassification: "Qualification de l’activité immobilière",
    propertyClassificationNote:
      "Obtenir un avis juridique angolais écrit sur les annonces autonomes, la recherche, le chat, les visites, les candidatures et la promotion payante. Clarifier les exigences de licence avec l’INH avant activation.",
    privacyHosting: "Confidentialité et hébergement",
    privacyHostingNote:
      "Confirmer la protection des données, la conservation et les accès. Privilégier l’hébergement et les sauvegardes en Angola ; examiner séparément les fournisseurs étrangers d’identité, messagerie, cartes, assistance ou stockage.",
    paymentsTax: "Paiements et facturation",
    paymentsTaxNote:
      "Valider les contrats, règlements directs, remboursements et obligations fiscales. Le loyer va directement au propriétaire. Paiements réels, encaissement et commissions ne sont pas connectés.",
    trustSafety: "Confiance et obligations opérationnelles",
    trustSafetyNote:
      "Mettre en œuvre signalements, modération, recours et vérifications précises. Confirmer les enregistrements, la sécurité et le pouvoir de l’annonceur. Un badge ne garantit ni propriété ni sécurité.",
    productionSystems: "Systèmes de production",
    productionSystemsNote:
      "Connecter et tester authentification, autorisations, base de données, sauvegardes et gestion des incidents. Les données sont fictives et locales ; une API disponible ne suffit pas pour lancer le produit.",
    legalTitle: "Pourquoi l’analyse immobilière compte en Angola",
    legalNote:
      "L’article 4 de la loi 14/12 inclut prospection et promotion immobilière dans la médiation. Cela ne signifie pas que tout portail est un courtier : le service et les contrats doivent être examinés. L’absence de commission ne tranche pas la qualification.",
    law: "Loi 14/12 · Articles 4–5",
    regulation: "Décret présidentiel 320/20",
    footer:
      "Cette liste décrit le travail restant. Elle ne vaut pas autorisation juridique et aucun bouton du navigateur ne peut la valider.",
    diagnosticTitle: "Autorisation de lancement",
    technicalTitle: "Restrictions du prototype",
    technicalNote:
      "Restrictions techniques vérifiées ; la qualification juridique reste en attente.",
    diagnosticNote:
      "Toujours bloqué : les tests techniques ne valent ni autorisation juridique ni préparation à la production.",
  },
  ar: {
    eyebrow: "سياسة إطلاق النموذج التجريبي",
    title: "قبل إطلاق Kasa",
    blocked: "الإطلاق الفعلي محظور حالياً",
    pending: "قيد الانتظار",
    intro:
      "المحاكي متاح. لم تتم الموافقة على أي سوق للمعاملات الحقيقية أو الترويج العقاري المدفوع.",
    boundary:
      "عدم الوساطة هو نموذج العمل المقصود وليس إعفاءً قانونياً. لا تمثيل أو تفاوض أو عمولات نجاح عقاري أو احتفاظ بالإيجارات والودائع لدى Kasa.",
    propertyClassification: "تصنيف النشاط العقاري",
    propertyClassificationNote:
      "الحصول على رأي قانوني أنغولي مكتوب بشأن الإعلانات الذاتية والبحث والمحادثات والزيارات والطلبات والترويج المدفوع. توضيح حدود الترخيص مع INH قبل التفعيل.",
    privacyHosting: "الخصوصية واستضافة البيانات",
    privacyHostingNote:
      "تأكيد حماية البيانات والاحتفاظ بها وضوابط الوصول. إعطاء الأولوية للاستضافة والنسخ الاحتياطية في أنغولا، وتقييم مزودي الهوية والمراسلة والخرائط والدعم والتخزين الأجانب بشكل منفصل.",
    paymentsTax: "المدفوعات والفوترة",
    paymentsTaxNote:
      "التحقق من العقود والتسوية المباشرة والاسترداد والضرائب. يُدفع الإيجار مباشرةً للمالك. المدفوعات الحقيقية والدفع الإلكتروني والعمولات غير متصلة.",
    trustSafety: "الثقة والالتزامات التشغيلية",
    trustSafetyNote:
      "تنفيذ الإبلاغ والإشراف والاعتراضات ووصف التحقق بدقة. تأكيد التسجيلات والأمن وصلاحية المعلن. الشارة ليست ضماناً للملكية أو السلامة.",
    productionSystems: "أنظمة الإنتاج",
    productionSystemsNote:
      "ربط واختبار المصادقة والصلاحيات وقاعدة البيانات والنسخ الاحتياطية والاستجابة للحوادث. السجلات تجريبية ومحلية؛ توفر API لا يعني جاهزية الإطلاق.",
    legalTitle: "أهمية المراجعة العقارية في أنغولا",
    legalNote:
      "تشمل المادة 4 من القانون 14/12 البحث والترويج العقاري ضمن الوساطة. لا يعني ذلك أن كل موقع إعلانات وسيط؛ يجب مراجعة الخدمة والعقود. عدم تقاضي عمولة وحده لا يحسم التصنيف.",
    law: "القانون 14/12 · المادتان 4–5",
    regulation: "المرسوم الرئاسي 320/20",
    footer:
      "تسجل هذه القائمة العمل المعلق. لا تمنح موافقة قانونية ولا يمكن لأي زر في المتصفح اعتمادها.",
    diagnosticTitle: "الموافقة على إطلاق السوق",
    technicalTitle: "قيود النموذج التجريبي",
    technicalNote:
      "تم التحقق من القيود التقنية؛ لا يزال التصنيف القانوني قيد المراجعة.",
    diagnosticNote:
      "لا يزال محظوراً: الاختبارات التقنية ليست موافقة قانونية أو جاهزية للإنتاج.",
  },
  zh: {
    eyebrow: "原型发布政策",
    title: "Kasa 正式上线前",
    blocked: "暂不可正式上线",
    pending: "待完成",
    intro: "模拟器仍可使用。尚无任何市场获准开展真实交易或付费房产推广。",
    boundary:
      "不从事经纪是计划采用的经营模式，并非法律豁免。Kasa 不代理或谈判，不收取房产成交佣金，也不保管租金或押金。",
    propertyClassification: "房产业务法律分类",
    propertyClassificationNote:
      "就自主发布、搜索、聊天、看房、申请及付费推广取得安哥拉书面法律意见。在启用前与 INH 澄清许可边界。",
    privacyHosting: "隐私与数据托管",
    privacyHostingNote:
      "确认数据保护程序、保留期限和访问控制。优先在安哥拉托管和备份；单独评估境外登录、消息、地图、支持或存储供应商。",
    paymentsTax: "支付与开票",
    paymentsTaxNote:
      "核实供应商合同、直接结算、退款和税务处理。租金直接付给房东。真实支付、结账和佣金尚未接入。",
    trustSafety: "信任与运营义务",
    trustSafetyNote:
      "实施举报、审核、申诉及准确的验证说明。确认适用登记、安全程序及发布者权限。标识不保证产权或安全。",
    productionSystems: "生产系统",
    productionSystemsNote:
      "连接并测试身份验证、权限、数据库、备份和事件响应。目前记录为本地虚构数据；API 可用不代表产品可以上线。",
    legalTitle: "为何需要安哥拉房产业务审查",
    legalNote:
      "第 14/12 号法律第 4 条将房产搜寻和推广纳入中介活动范围。这不代表所有发布网站都是经纪商；仍需审查具体服务和合同。不收佣金本身不能决定法律分类。",
    law: "第 14/12 号法律 · 第 4–5 条",
    regulation: "第 320/20 号总统令",
    footer:
      "此清单记录待完成工作，不构成法律批准，也不能通过浏览器按钮将其批准。",
    diagnosticTitle: "市场上线批准",
    technicalTitle: "原型限制",
    technicalNote: "技术限制已验证；法律分类仍待审查。",
    diagnosticNote: "仍不可上线：技术检查不等于法律批准或生产就绪。",
  },
};

export function marketReadinessCopy(language: LanguageCode): Copy {
  const translated = marketReadinessTranslations[language];
  return Object.fromEntries(
    Object.entries(en).map(([key, english]) => {
      const value = translated[key as keyof Copy];
      return [
        key,
        language === "ar" || language === "zh"
          ? `${value} (${english})`
          : value,
      ];
    }),
  ) as Copy;
}
