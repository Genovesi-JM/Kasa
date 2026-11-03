import type { LanguageCode } from "../i18n";

const en = {
  entryLabel: "Local test account",
  profileArea: "Profile",
  propertiesArea: "Properties",
  demoIdentity: "Demo identity — not your account",
  back: "Back to the demo",
  language: "Language",
  eyebrow: "LOCAL ACCOUNT TEST",
  title: "Your own place in Kasa.",
  intro: "One identity. A profile you can edit and return to.",
  localTitle: "Test locally, with invented details",
  localNote:
    "Use an invented email, name and a password you do not use elsewhere. Accounts and profile changes are saved on this computer. This is not a public service.",
  signIn: "Sign in",
  create: "Create account",
  signInTitle: "Welcome back",
  createTitle: "Start with your own account",
  signInNote: "Sign in to your local test account, not a sample identity.",
  createNote:
    "Email verification and password recovery are not connected yet. Do not use real personal details.",
  name: "Display name",
  email: "Private email",
  password: "Password",
  passwordHint: "12–128 characters. Use a unique test password.",
  showPassword: "Show password",
  hidePassword: "Hide password",
  createSubmit: "Create my test account",
  working: "Please wait…",
  checking: "Checking your session…",
  unavailableTitle: "Accounts are not available right now",
  unavailableNote:
    "This page needs the local account API. The rest of the demonstration remains separate.",
  retry: "Try again",
  profileTitle: "Your account",
  profileNote:
    "These details are private to your signed-in account. Save changes, then return later to check they are still here.",
  unverified: "Email not verified",
  emailNote:
    "Private and not shown on property profiles. Changing this address requires an email-verification flow that is not connected yet.",
  preferredLanguage: "Preferred language",
  languageNote: "Save to keep this language for your next session.",
  save: "Save changes",
  saved: "Your profile was saved.",
  created: "Your local test account was created.",
  signedOut: "You have signed out.",
  unsaved: "You have unsaved changes.",
  logout: "Sign out",
  scopeTitle: "What this account can do today",
  profileScope:
    "Your account, private properties, tenant access, maintenance, rent records, test documents and in-app notifications persist locally. Use invented data only; no antivirus scanning or external notifications are connected.",
  separation:
    "Demo properties, messages and role selectors are not linked to this account and do not grant access or administrator permissions.",
  roadmapTitle: "One identity, separate permissions",
  personal: "Personal",
  personalNote:
    "Edit your profile, accept a property invitation and follow your own maintenance requests and comments.",
  professional: "Professional",
  professionalNote:
    "Private properties, test-catalogue listings and participant-only chats are saved locally. Spaces, services and hiring are not linked to this account yet. This is not a public launch.",
  comingLater: "Local property tools available",
  errorValidation:
    "Check your details. Enter a name of 1–100 characters, a valid email and a password of 12–128 characters.",
  errorProfile: "Enter a display name of 1–100 characters.",
  errorCredentials: "The email or password is not correct.",
  errorDuplicate:
    "An account already uses this email. Sign in instead, or use another invented address.",
  errorRate: "Too many attempts. Wait a few minutes before trying again.",
  errorNetwork:
    "We could not reach the account server. Check the connection and try again. Your edits have not been discarded.",
  errorDisabled:
    "Local accounts are disabled. Start the local account API to use this page.",
  errorGeneric: "We could not complete that action. Try again.",
  uncertain:
    "We could not confirm whether the change was saved. Check your session before trying the action again.",
  checkSession: "Check session and latest profile",
  errorSecurity:
    "Your session could not be validated. Reload your latest profile before trying again.",
  errorExpired:
    "Your session ended. Sign in again to continue. Private details have been cleared from this page.",
  conflict:
    "Your profile changed in another session. Your edits are still here. Reload the latest profile before saving again.",
  reload: "Discard edits and reload latest",
  backConfirm: "Leave without saving your changes?",
  logoutConfirm: "Sign out and discard your unsaved changes?",
  navigationConfirm: "Open this notification and discard the affected draft?",
  navigationConfirmNote:
    "The target is in another property or record. Only the drafts affected by that change will be discarded; nothing is saved automatically.",
  keepEditing: "Keep editing",
  discardAndOpen: "Discard and open",
};

type Copy = Record<keyof typeof en, string>;

export const accountWorkspaceTranslations: Record<LanguageCode, Copy> = {
  en,
  pt: {
    entryLabel: "Conta local de teste",
    profileArea: "Perfil",
    propertiesArea: "Imóveis",
    demoIdentity: "Identidade de demonstração — não é a sua conta",
    back: "Voltar à demonstração",
    language: "Idioma",
    eyebrow: "TESTE DE CONTA LOCAL",
    title: "O seu lugar na Kasa.",
    intro: "Uma identidade. Um perfil que pode editar e voltar a encontrar.",
    localTitle: "Teste localmente, com dados inventados",
    localNote:
      "Use um email e nome inventados e uma palavra-passe que não utiliza noutros serviços. As contas e alterações ao perfil ficam guardadas neste computador. Este não é um serviço público.",
    signIn: "Entrar",
    create: "Criar conta",
    signInTitle: "Bem-vindo de volta",
    createTitle: "Comece com a sua própria conta",
    signInNote:
      "Entre na sua conta de teste local, não numa identidade de exemplo.",
    createNote:
      "A verificação de email e recuperação de palavra-passe ainda não estão ligadas. Não use dados pessoais reais.",
    name: "Nome de apresentação",
    email: "Email privado",
    password: "Palavra-passe",
    passwordHint:
      "12–128 caracteres. Use uma palavra-passe exclusiva para este teste.",
    showPassword: "Mostrar palavra-passe",
    hidePassword: "Ocultar palavra-passe",
    createSubmit: "Criar a minha conta de teste",
    working: "Aguarde…",
    checking: "A verificar a sua sessão…",
    unavailableTitle: "As contas não estão disponíveis neste momento",
    unavailableNote:
      "Esta página precisa da API local de contas. O resto da demonstração continua separado.",
    retry: "Tentar novamente",
    profileTitle: "A sua conta",
    profileNote:
      "Estes dados são privados da sua conta autenticada. Guarde as alterações e volte mais tarde para confirmar que continuam aqui.",
    unverified: "Email não verificado",
    emailNote:
      "Privado e não apresentado nos perfis dos imóveis. Alterar este endereço exige verificação de email, que ainda não está ligada.",
    preferredLanguage: "Idioma preferido",
    languageNote: "Guarde para manter este idioma na próxima sessão.",
    save: "Guardar alterações",
    saved: "O seu perfil foi guardado.",
    created: "A sua conta de teste local foi criada.",
    signedOut: "Terminou a sessão.",
    unsaved: "Tem alterações por guardar.",
    logout: "Terminar sessão",
    scopeTitle: "O que esta conta permite hoje",
    profileScope:
      "A conta, os imóveis privados, os acessos, a manutenção, os registos de renda, os documentos de teste e as notificações na app ficam guardados localmente. Use apenas dados fictícios; não há análise antivírus nem notificações externas ligadas.",
    separation:
      "Os imóveis, mensagens e seletores de papéis da demonstração não estão ligados a esta conta e não atribuem acesso nem permissões de administrador.",
    roadmapTitle: "Uma identidade, permissões separadas",
    personal: "Pessoal",
    personalNote:
      "Edite o perfil, aceite um convite para um imóvel e acompanhe os seus próprios pedidos de manutenção e comentários.",
    professional: "Profissional",
    professionalNote:
      "Os imóveis privados, anúncios do catálogo de teste e conversas entre participantes ficam guardados localmente. Espaços, serviços e recrutamento ainda não estão ligados a esta conta. Não é um lançamento público.",
    comingLater: "Ferramentas locais de imóveis disponíveis",
    errorValidation:
      "Verifique os dados. Introduza um nome de 1–100 caracteres, um email válido e uma palavra-passe de 12–128 caracteres.",
    errorProfile: "Introduza um nome de apresentação com 1–100 caracteres.",
    errorCredentials: "O email ou a palavra-passe estão incorretos.",
    errorDuplicate:
      "Já existe uma conta com este email. Entre nessa conta ou use outro endereço inventado.",
    errorRate:
      "Demasiadas tentativas. Aguarde alguns minutos antes de tentar novamente.",
    errorNetwork:
      "Não foi possível contactar o servidor de contas. Verifique a ligação e tente novamente. As suas alterações não foram descartadas.",
    errorDisabled:
      "As contas locais estão desativadas. Inicie a API local de contas para usar esta página.",
    errorGeneric: "Não foi possível concluir esta ação. Tente novamente.",
    uncertain:
      "Não foi possível confirmar se a alteração foi guardada. Verifique a sessão antes de repetir a ação.",
    checkSession: "Verificar sessão e perfil mais recente",
    errorSecurity:
      "Não foi possível validar a sessão. Carregue o perfil mais recente antes de tentar novamente.",
    errorExpired:
      "A sua sessão terminou. Entre novamente para continuar. Os dados privados foram removidos desta página.",
    conflict:
      "O perfil foi alterado noutra sessão. As suas alterações continuam aqui. Carregue o perfil mais recente antes de voltar a guardar.",
    reload: "Descartar alterações e carregar versão mais recente",
    backConfirm: "Sair sem guardar as alterações?",
    logoutConfirm: "Terminar sessão e descartar as alterações por guardar?",
    navigationConfirm: "Abrir esta notificação e descartar o rascunho afetado?",
    navigationConfirmNote:
      "O destino está noutro imóvel ou registo. Apenas os rascunhos afetados pela mudança serão descartados; nada é guardado automaticamente.",
    keepEditing: "Continuar a editar",
    discardAndOpen: "Descartar e abrir",
  },
  es: {
    entryLabel: "Cuenta de prueba local",
    profileArea: "Perfil",
    propertiesArea: "Inmuebles",
    demoIdentity: "Identidad de demostración — no es tu cuenta",
    back: "Volver a la demostración",
    language: "Idioma",
    eyebrow: "PRUEBA DE CUENTA LOCAL",
    title: "Tu propio espacio en Kasa.",
    intro: "Una identidad. Un perfil que puedes editar y recuperar.",
    localTitle: "Prueba localmente con datos inventados",
    localNote:
      "Usa un correo y nombre inventados y una contraseña que no utilices en otro servicio. Las cuentas y los cambios se guardan en este equipo. No es un servicio público.",
    signIn: "Iniciar sesión",
    create: "Crear cuenta",
    signInTitle: "Te damos la bienvenida de nuevo",
    createTitle: "Empieza con tu propia cuenta",
    signInNote:
      "Accede a tu cuenta de prueba local, no a una identidad de ejemplo.",
    createNote:
      "La verificación de correo y la recuperación de contraseña aún no están conectadas. No uses datos personales reales.",
    name: "Nombre visible",
    email: "Correo privado",
    password: "Contraseña",
    passwordHint:
      "12–128 caracteres. Usa una contraseña exclusiva para esta prueba.",
    showPassword: "Mostrar contraseña",
    hidePassword: "Ocultar contraseña",
    createSubmit: "Crear mi cuenta de prueba",
    working: "Espera…",
    checking: "Comprobando tu sesión…",
    unavailableTitle: "Las cuentas no están disponibles ahora",
    unavailableNote:
      "Esta página necesita la API local de cuentas. El resto de la demostración sigue separado.",
    retry: "Reintentar",
    profileTitle: "Tu cuenta",
    profileNote:
      "Estos datos son privados de tu cuenta autenticada. Guarda los cambios y vuelve después para comprobar que siguen aquí.",
    unverified: "Correo no verificado",
    emailNote:
      "Es privado y no aparece en los perfiles de inmuebles. Para cambiarlo se necesita una verificación de correo que todavía no está conectada.",
    preferredLanguage: "Idioma preferido",
    languageNote: "Guarda para mantener este idioma en la próxima sesión.",
    save: "Guardar cambios",
    saved: "Tu perfil se ha guardado.",
    created: "Tu cuenta de prueba local se ha creado.",
    signedOut: "Has cerrado la sesión.",
    unsaved: "Tienes cambios sin guardar.",
    logout: "Cerrar sesión",
    scopeTitle: "Qué permite esta cuenta hoy",
    profileScope:
      "La cuenta, inmuebles privados, accesos, mantenimiento, registros de alquiler, documentos de prueba y notificaciones en la app se guardan localmente. Usa datos ficticios; no hay análisis antivirus ni notificaciones externas conectados.",
    separation:
      "Los inmuebles, mensajes y selectores de roles de la demostración no están vinculados a esta cuenta ni conceden acceso o permisos de administrador.",
    roadmapTitle: "Una identidad, permisos separados",
    personal: "Personal",
    personalNote:
      "Edita tu perfil, acepta una invitación a un inmueble y sigue tus propias solicitudes de mantenimiento y comentarios.",
    professional: "Profesional",
    professionalNote:
      "Los inmuebles privados, anuncios del catálogo de prueba y chats entre participantes se guardan localmente. Espacios, servicios y contratación aún no están vinculados. No es un lanzamiento público.",
    comingLater: "Herramientas inmobiliarias locales disponibles",
    errorValidation:
      "Revisa los datos. Introduce un nombre de 1–100 caracteres, un correo válido y una contraseña de 12–128 caracteres.",
    errorProfile: "Introduce un nombre visible de 1–100 caracteres.",
    errorCredentials: "El correo o la contraseña no son correctos.",
    errorDuplicate:
      "Ya existe una cuenta con este correo. Inicia sesión o usa otra dirección inventada.",
    errorRate:
      "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.",
    errorNetwork:
      "No se pudo contactar con el servidor de cuentas. Comprueba la conexión e inténtalo de nuevo. No se han descartado tus cambios.",
    errorDisabled:
      "Las cuentas locales están desactivadas. Inicia la API local de cuentas para usar esta página.",
    errorGeneric: "No se pudo completar la acción. Inténtalo de nuevo.",
    uncertain:
      "No se pudo confirmar si se guardó el cambio. Comprueba la sesión antes de repetir la acción.",
    checkSession: "Comprobar sesión y último perfil",
    errorSecurity:
      "No se pudo validar tu sesión. Recarga el perfil más reciente antes de reintentarlo.",
    errorExpired:
      "Tu sesión terminó. Inicia sesión de nuevo. Los datos privados se han borrado de esta página.",
    conflict:
      "Tu perfil cambió en otra sesión. Tus cambios siguen aquí. Recarga el perfil más reciente antes de guardar de nuevo.",
    reload: "Descartar cambios y cargar la última versión",
    backConfirm: "¿Salir sin guardar los cambios?",
    logoutConfirm: "¿Cerrar sesión y descartar los cambios sin guardar?",
    navigationConfirm:
      "¿Abrir esta notificación y descartar el borrador afectado?",
    navigationConfirmNote:
      "El destino está en otro inmueble o registro. Solo se descartarán los borradores afectados por el cambio; nada se guarda automáticamente.",
    keepEditing: "Seguir editando",
    discardAndOpen: "Descartar y abrir",
  },
  fr: {
    entryLabel: "Compte de test local",
    profileArea: "Profil",
    propertiesArea: "Biens",
    demoIdentity: "Identité de démonstration — pas votre compte",
    back: "Revenir à la démonstration",
    language: "Langue",
    eyebrow: "TEST DE COMPTE LOCAL",
    title: "Votre place dans Kasa.",
    intro: "Une identité. Un profil que vous pouvez modifier et retrouver.",
    localTitle: "Testez localement avec des données fictives",
    localNote:
      "Utilisez un nom et un email fictifs ainsi qu’un mot de passe inutilisé ailleurs. Les comptes et modifications sont enregistrés sur cet ordinateur. Ce service n’est pas public.",
    signIn: "Se connecter",
    create: "Créer un compte",
    signInTitle: "Heureux de vous retrouver",
    createTitle: "Commencez avec votre propre compte",
    signInNote:
      "Connectez-vous à votre compte de test local, pas à une identité d’exemple.",
    createNote:
      "La vérification des emails et la récupération du mot de passe ne sont pas encore connectées. N’utilisez pas de vraies données personnelles.",
    name: "Nom affiché",
    email: "Email privé",
    password: "Mot de passe",
    passwordHint:
      "12–128 caractères. Utilisez un mot de passe réservé à ce test.",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    createSubmit: "Créer mon compte de test",
    working: "Veuillez patienter…",
    checking: "Vérification de votre session…",
    unavailableTitle: "Les comptes sont momentanément indisponibles",
    unavailableNote:
      "Cette page a besoin de l’API locale des comptes. Le reste de la démonstration reste séparé.",
    retry: "Réessayer",
    profileTitle: "Votre compte",
    profileNote:
      "Ces données sont privées à votre compte connecté. Enregistrez les modifications, puis revenez vérifier qu’elles sont toujours là.",
    unverified: "Email non vérifié",
    emailNote:
      "Privé et absent des profils immobiliers. Modifier cette adresse nécessite une vérification d’email qui n’est pas encore connectée.",
    preferredLanguage: "Langue préférée",
    languageNote:
      "Enregistrez pour conserver cette langue à la prochaine session.",
    save: "Enregistrer les modifications",
    saved: "Votre profil a été enregistré.",
    created: "Votre compte de test local a été créé.",
    signedOut: "Vous êtes déconnecté.",
    unsaved: "Des modifications ne sont pas enregistrées.",
    logout: "Se déconnecter",
    scopeTitle: "Ce que ce compte permet aujourd’hui",
    profileScope:
      "Le compte, les biens privés, les accès, la maintenance, les registres de loyers, les fichiers de test et les notifications dans l’app sont enregistrés localement. Utilisez des données fictives ; aucun antivirus ni notification externe n’est connecté.",
    separation:
      "Les biens, messages et sélecteurs de rôles de la démonstration ne sont pas liés à ce compte et n’accordent ni accès ni droits d’administration.",
    roadmapTitle: "Une identité, des permissions distinctes",
    personal: "Personnel",
    personalNote:
      "Modifiez votre profil, acceptez une invitation à un bien et suivez vos propres demandes de maintenance et commentaires.",
    professional: "Professionnel",
    professionalNote:
      "Les biens privés, annonces du catalogue de test et conversations entre participants sont enregistrés localement. Les espaces, services et recrutements ne sont pas encore liés. Ce n’est pas un lancement public.",
    comingLater: "Outils immobiliers locaux disponibles",
    errorValidation:
      "Vérifiez vos données : un nom de 1–100 caractères, un email valide et un mot de passe de 12–128 caractères.",
    errorProfile: "Saisissez un nom affiché de 1–100 caractères.",
    errorCredentials: "L’email ou le mot de passe est incorrect.",
    errorDuplicate:
      "Un compte utilise déjà cet email. Connectez-vous ou utilisez une autre adresse fictive.",
    errorRate:
      "Trop de tentatives. Attendez quelques minutes avant de réessayer.",
    errorNetwork:
      "Impossible de joindre le serveur des comptes. Vérifiez la connexion et réessayez. Vos modifications sont conservées.",
    errorDisabled:
      "Les comptes locaux sont désactivés. Démarrez l’API locale des comptes pour utiliser cette page.",
    errorGeneric: "Impossible de terminer cette action. Réessayez.",
    uncertain:
      "Impossible de confirmer l’enregistrement. Vérifiez votre session avant de répéter l’action.",
    checkSession: "Vérifier la session et le dernier profil",
    errorSecurity:
      "Impossible de valider la session. Rechargez le dernier profil avant de réessayer.",
    errorExpired:
      "Votre session est terminée. Reconnectez-vous. Les données privées ont été effacées de cette page.",
    conflict:
      "Votre profil a été modifié dans une autre session. Vos modifications sont conservées. Rechargez le dernier profil avant d’enregistrer à nouveau.",
    reload: "Abandonner les modifications et recharger",
    backConfirm: "Quitter sans enregistrer les modifications ?",
    logoutConfirm: "Se déconnecter et abandonner les modifications ?",
    navigationConfirm:
      "Ouvrir cette notification et abandonner le brouillon concerné ?",
    navigationConfirmNote:
      "La cible se trouve dans un autre bien ou dossier. Seuls les brouillons concernés seront abandonnés ; rien n’est enregistré automatiquement.",
    keepEditing: "Continuer à modifier",
    discardAndOpen: "Abandonner et ouvrir",
  },
  ar: {
    entryLabel: "حساب اختبار محلي",
    profileArea: "الملف",
    propertiesArea: "العقارات",
    demoIdentity: "هوية تجريبية — ليست حسابك",
    back: "العودة إلى العرض التجريبي",
    language: "اللغة",
    eyebrow: "اختبار حساب محلي",
    title: "مكانك الخاص في كاسا.",
    intro: "هوية واحدة وملف يمكنك تعديله والعودة إليه.",
    localTitle: "اختبر محليًا باستخدام بيانات وهمية",
    localNote:
      "استخدم اسمًا وبريدًا إلكترونيًا وهميين وكلمة مرور لا تستخدمها في خدمات أخرى. تُحفظ الحسابات والتغييرات على هذا الكمبيوتر. هذه ليست خدمة عامة.",
    signIn: "تسجيل الدخول",
    create: "إنشاء حساب",
    signInTitle: "مرحبًا بعودتك",
    createTitle: "ابدأ بحسابك الخاص",
    signInNote: "سجّل الدخول إلى حساب الاختبار المحلي، وليس إلى هوية نموذجية.",
    createNote:
      "التحقق من البريد واستعادة كلمة المرور غير متصلين بعد. لا تستخدم بيانات شخصية حقيقية.",
    name: "اسم العرض",
    email: "البريد الإلكتروني الخاص",
    password: "كلمة المرور",
    passwordHint: "من 12 إلى 128 حرفًا. استخدم كلمة مرور مخصصة للاختبار.",
    showPassword: "إظهار كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",
    createSubmit: "إنشاء حسابي التجريبي",
    working: "يرجى الانتظار…",
    checking: "جارٍ التحقق من الجلسة…",
    unavailableTitle: "الحسابات غير متاحة حاليًا",
    unavailableNote:
      "تحتاج هذه الصفحة إلى واجهة الحسابات المحلية. بقية العرض التجريبي منفصل عنها.",
    retry: "المحاولة مجددًا",
    profileTitle: "حسابك",
    profileNote:
      "هذه البيانات خاصة بحسابك المسجل. احفظ التغييرات ثم عد لاحقًا للتأكد من بقائها.",
    unverified: "البريد غير موثّق",
    emailNote:
      "خاص ولا يظهر في ملفات العقارات. تغيير العنوان يتطلب التحقق من البريد، وهو غير متصل بعد.",
    preferredLanguage: "اللغة المفضلة",
    languageNote: "احفظ للاحتفاظ بهذه اللغة في الجلسة التالية.",
    save: "حفظ التغييرات",
    saved: "تم حفظ ملفك.",
    created: "تم إنشاء حساب الاختبار المحلي.",
    signedOut: "تم تسجيل خروجك.",
    unsaved: "لديك تغييرات غير محفوظة.",
    logout: "تسجيل الخروج",
    scopeTitle: "ما يمكن لهذا الحساب فعله اليوم",
    profileScope:
      "يُحفظ الحساب والعقارات الخاصة والصلاحيات والصيانة وسجلات الإيجار وملفات الاختبار وإشعارات التطبيق محليًا. استخدم بيانات وهمية فقط؛ لا يوجد فحص فيروسات أو إشعارات خارجية متصلة.",
    separation:
      "العقارات والرسائل وخيارات الأدوار التجريبية ليست مرتبطة بهذا الحساب ولا تمنح حق الوصول أو صلاحيات الإدارة.",
    roadmapTitle: "هوية واحدة وصلاحيات منفصلة",
    personal: "شخصي",
    personalNote:
      "عدّل ملفك واقبل دعوة إلى عقار وتابع طلبات الصيانة والتعليقات الخاصة بك.",
    professional: "مهني",
    professionalNote:
      "تُحفظ العقارات الخاصة وإعلانات كتالوج الاختبار ومحادثات المشاركين محليًا. المساحات والخدمات والتوظيف غير مرتبطة بعد. هذا ليس إطلاقًا عامًا.",
    comingLater: "أدوات العقارات المحلية متاحة",
    errorValidation:
      "تحقق من البيانات: اسم من 1 إلى 100 حرف وبريد صالح وكلمة مرور من 12 إلى 128 حرفًا.",
    errorProfile: "أدخل اسم عرض من 1 إلى 100 حرف.",
    errorCredentials: "البريد أو كلمة المرور غير صحيحين.",
    errorDuplicate:
      "يوجد حساب بهذا البريد. سجّل الدخول أو استخدم عنوانًا وهميًا آخر.",
    errorRate: "محاولات كثيرة جدًا. انتظر بضع دقائق ثم أعد المحاولة.",
    errorNetwork:
      "تعذر الوصول إلى خادم الحسابات. تحقق من الاتصال وحاول مجددًا. لم تُحذف تغييراتك.",
    errorDisabled:
      "الحسابات المحلية معطّلة. شغّل واجهة الحسابات المحلية لاستخدام الصفحة.",
    errorGeneric: "تعذر إكمال العملية. حاول مجددًا.",
    uncertain: "تعذر تأكيد حفظ التغيير. تحقق من جلستك قبل إعادة العملية.",
    checkSession: "التحقق من الجلسة وأحدث ملف",
    errorSecurity:
      "تعذر التحقق من الجلسة. أعد تحميل أحدث ملف قبل المحاولة مجددًا.",
    errorExpired:
      "انتهت جلستك. سجّل الدخول مجددًا للمتابعة. أُزيلت البيانات الخاصة من هذه الصفحة.",
    conflict:
      "تغير ملفك في جلسة أخرى. ما زالت تعديلاتك موجودة. أعد تحميل أحدث ملف قبل الحفظ.",
    reload: "تجاهل التعديلات وتحميل أحدث نسخة",
    backConfirm: "هل تريد المغادرة دون حفظ التغييرات؟",
    logoutConfirm: "هل تريد تسجيل الخروج وتجاهل التغييرات غير المحفوظة؟",
    navigationConfirm: "هل تريد فتح هذا الإشعار وتجاهل المسودة المتأثرة؟",
    navigationConfirmNote:
      "الوجهة في عقار أو سجل آخر. سيتم تجاهل المسودات المتأثرة بالتغيير فقط، ولن يُحفظ شيء تلقائياً.",
    keepEditing: "متابعة التعديل",
    discardAndOpen: "تجاهل وفتح",
  },
  zh: {
    entryLabel: "本地测试账户",
    profileArea: "个人资料",
    propertiesArea: "房产",
    demoIdentity: "演示身份 — 不是你的账户",
    back: "返回演示",
    language: "语言",
    eyebrow: "本地账户测试",
    title: "你在 Kasa 的专属空间。",
    intro: "一个身份，一个可以编辑并再次访问的个人资料。",
    localTitle: "使用虚构资料进行本地测试",
    localNote:
      "请使用虚构的邮箱和姓名，以及未在其他服务使用过的密码。账户和资料更改保存在此电脑上。这不是公开服务。",
    signIn: "登录",
    create: "创建账户",
    signInTitle: "欢迎回来",
    createTitle: "从自己的账户开始",
    signInNote: "登录你的本地测试账户，而不是示例身份。",
    createNote: "邮箱验证和密码恢复尚未连接。请勿使用真实个人资料。",
    name: "显示名称",
    email: "私人邮箱",
    password: "密码",
    passwordHint: "12–128 个字符。请使用专用测试密码。",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    createSubmit: "创建我的测试账户",
    working: "请稍候…",
    checking: "正在检查会话…",
    unavailableTitle: "账户暂时不可用",
    unavailableNote: "此页面需要本地账户 API。其他演示内容仍然独立。",
    retry: "重试",
    profileTitle: "你的账户",
    profileNote:
      "这些资料仅属于你登录的账户。保存更改后，可稍后返回确认资料仍然存在。",
    unverified: "邮箱未验证",
    emailNote:
      "私人信息，不会显示在房产资料页。修改邮箱需要尚未连接的邮箱验证流程。",
    preferredLanguage: "首选语言",
    languageNote: "保存后，下次登录仍使用此语言。",
    save: "保存更改",
    saved: "个人资料已保存。",
    created: "本地测试账户已创建。",
    signedOut: "你已退出登录。",
    unsaved: "有尚未保存的更改。",
    logout: "退出登录",
    scopeTitle: "此账户目前可以做什么",
    profileScope:
      "账户、私人房产、访问权限、维修、租金记录、测试文件和应用内通知均保存在本地。请仅使用虚构资料；未连接病毒扫描或外部通知服务。",
    separation:
      "演示中的房产、消息和角色选择器不会关联到此账户，也不会授予访问权或管理员权限。",
    roadmapTitle: "统一身份，独立权限",
    personal: "个人",
    personalNote: "编辑资料、接受房产邀请，并跟踪你自己的维修请求和评论。",
    professional: "专业",
    professionalNote:
      "私人房产、测试目录房源及参与者之间的聊天保存在本地。场地、服务和招聘尚未关联。这不是公开发布。",
    comingLater: "本地房产工具已可用",
    errorValidation:
      "请检查资料：姓名 1–100 个字符、有效邮箱、密码 12–128 个字符。",
    errorProfile: "请输入 1–100 个字符的显示名称。",
    errorCredentials: "邮箱或密码不正确。",
    errorDuplicate: "此邮箱已有账户。请登录或使用另一个虚构邮箱。",
    errorRate: "尝试次数过多，请等待几分钟后重试。",
    errorNetwork: "无法连接账户服务器。请检查连接后重试。你的更改未被丢弃。",
    errorDisabled: "本地账户已禁用。请启动本地账户 API 以使用此页面。",
    errorGeneric: "无法完成此操作，请重试。",
    uncertain: "无法确认更改是否保存。请先检查会话，再重试操作。",
    checkSession: "检查会话和最新资料",
    errorSecurity: "无法验证会话，请重新加载最新资料后再试。",
    errorExpired: "会话已结束，请重新登录。私人资料已从此页面清除。",
    conflict:
      "资料已在其他会话中更改。你的编辑仍被保留，请加载最新资料后再保存。",
    reload: "放弃编辑并加载最新版本",
    backConfirm: "不保存更改就离开吗？",
    logoutConfirm: "退出登录并放弃未保存的更改吗？",
    navigationConfirm: "打开此通知并放弃受影响的草稿吗？",
    navigationConfirmNote:
      "目标位于其他房产或记录中。只会放弃受此次切换影响的草稿，不会自动保存任何内容。",
    keepEditing: "继续编辑",
    discardAndOpen: "放弃并打开",
  },
};

export function accountWorkspaceCopy(language: LanguageCode): Copy {
  const copy = accountWorkspaceTranslations[language];
  if (language !== "ar" && language !== "zh") return copy;
  return Object.fromEntries(
    Object.entries(copy).map(([key, value]) => [
      key,
      `${value} (${en[key as keyof Copy]})`,
    ]),
  ) as Copy;
}
