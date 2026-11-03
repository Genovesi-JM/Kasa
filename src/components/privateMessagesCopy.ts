import type { LanguageCode } from "../i18n";

const en = {
  title: "Private messages",
  note: "Local test conversations between the listing owner and the person enquiring. No email, SMS or external delivery is connected.",
  privacy:
    "Use invented test details. Do not share identity documents, bank details or payment instructions here.",
  refresh: "Refresh conversations",
  refreshThread: "Refresh conversation",
  loading: "Loading messages…",
  working: "Please wait…",
  empty:
    "No conversations yet. Open a saved listing and send an enquiry to begin.",
  choose: "Choose a conversation",
  chooseNote: "Your unsent drafts remain here while you explore other areas.",
  olderThreads: "Load more conversations",
  olderMessages: "Load earlier messages",
  unread: "Unread",
  you: "You",
  message: "Message",
  placeholder: "Write a message about this listing…",
  send: "Send message",
  sent: "Message saved in this conversation.",
  markRead: "Mark read up to the last shown message",
  readNote:
    "This includes earlier messages, even if they have not been loaded.",
  readSaved: "Messages marked as read up to the last shown message.",
  block: "Block conversation",
  unblock: "Unblock conversation",
  blockPrompt:
    "Block this conversation? Neither participant can send new messages while either person has blocked it. Existing messages remain available.",
  confirmBlock: "Yes, block this conversation",
  cancel: "Cancel",
  blockedByYou:
    "You blocked this conversation. Unblock it to allow messages, unless the other participant has also blocked it.",
  blockedByOther: "Messaging is currently unavailable in this conversation.",
  blockedSaved: "Your blocking preference was saved.",
  closed:
    "This listing is no longer published. The conversation remains available to its participants.",
  draft: "Unsent draft",
  unknown:
    "The result is uncertain. Your work is safe. Retry the exact same action to avoid submitting it twice.",
  retry: "Retry the same action",
  refreshBeforeRetry:
    "The action could not be confirmed. Refresh the conversation before trying again.",
  validation: "Write a message within the displayed character limit.",
  unavailable: "This conversation is no longer available to your account.",
  failed:
    "The action could not be completed. Your unsent draft is preserved. Try refreshing.",
  session: "Your session changed. Reopen your account before continuing.",
  rate: "Too many requests. Wait a little before trying again.",
  limit: "This local conversation has reached its record limit.",
  conflict:
    "This request identifier already belongs to another message. Refresh before continuing; your draft is preserved.",
  noMessages: "No messages in this conversation yet.",
  inbox: "Conversations",
  viewings: "Viewing requests",
  backToMessages: "Back to messages",
  loadingViewings: "Loading viewing requests…",
};
type Copy = Record<keyof typeof en, string>;
const pt: Copy = {
  title: "Mensagens privadas",
  note: "Conversas locais de teste entre o anunciante e a pessoa interessada. Não há envio por email, SMS ou serviços externos.",
  privacy:
    "Use dados fictícios. Não partilhe documentos de identificação, dados bancários ou instruções de pagamento aqui.",
  refresh: "Atualizar conversas",
  refreshThread: "Atualizar conversa",
  loading: "A carregar mensagens…",
  working: "Aguarde…",
  empty:
    "Ainda não há conversas. Abra um anúncio guardado e envie um pedido de informação para começar.",
  choose: "Escolha uma conversa",
  chooseNote:
    "Os rascunhos por enviar mantêm-se enquanto explora outras áreas.",
  olderThreads: "Carregar mais conversas",
  olderMessages: "Carregar mensagens anteriores",
  unread: "Por ler",
  you: "Eu",
  message: "Mensagem",
  placeholder: "Escreva uma mensagem sobre este anúncio…",
  send: "Enviar mensagem",
  sent: "Mensagem guardada nesta conversa.",
  markRead: "Marcar como lidas até à última mensagem apresentada",
  readNote:
    "Inclui as mensagens anteriores, mesmo que ainda não tenham sido carregadas.",
  readSaved: "Mensagens marcadas como lidas até à última mensagem apresentada.",
  block: "Bloquear conversa",
  unblock: "Desbloquear conversa",
  blockPrompt:
    "Bloquear esta conversa? Nenhum participante pode enviar novas mensagens enquanto um dos dois mantiver o bloqueio. As mensagens existentes continuam disponíveis.",
  confirmBlock: "Sim, bloquear esta conversa",
  cancel: "Cancelar",
  blockedByYou:
    "Bloqueou esta conversa. Desbloqueie-a para permitir mensagens, desde que a outra pessoa não a tenha também bloqueado.",
  blockedByOther: "O envio de mensagens está indisponível nesta conversa.",
  blockedSaved: "A sua preferência de bloqueio foi guardada.",
  closed:
    "Este anúncio já não está publicado. A conversa continua disponível aos participantes.",
  draft: "Rascunho por enviar",
  unknown:
    "O resultado é incerto. O seu trabalho está seguro. Repita exatamente a mesma ação para evitar pedidos duplicados.",
  retry: "Repetir a mesma ação",
  refreshBeforeRetry:
    "Não foi possível confirmar a ação. Atualize a conversa antes de tentar novamente.",
  validation: "Escreva uma mensagem dentro do limite de caracteres indicado.",
  unavailable: "Esta conversa já não está disponível para a sua conta.",
  failed:
    "Não foi possível concluir a ação. O seu rascunho foi preservado. Tente atualizar.",
  session: "A sua sessão mudou. Volte a abrir a conta antes de continuar.",
  rate: "Demasiados pedidos. Aguarde um pouco antes de tentar novamente.",
  limit: "Esta conversa local atingiu o limite de registos.",
  conflict:
    "Este identificador de pedido já pertence a outra mensagem. Atualize antes de continuar; o rascunho foi preservado.",
  noMessages: "Ainda não há mensagens nesta conversa.",
  inbox: "Conversas",
  viewings: "Pedidos de visita",
  backToMessages: "Voltar às mensagens",
  loadingViewings: "A carregar pedidos de visita…",
};
const es: Copy = {
  title: "Mensajes privados",
  note: "Conversaciones locales de prueba entre el anunciante y la persona interesada. No se envían correos, SMS ni mensajes externos.",
  privacy:
    "Utiliza datos ficticios. No compartas documentos de identidad, datos bancarios ni instrucciones de pago aquí.",
  refresh: "Actualizar conversaciones",
  refreshThread: "Actualizar conversación",
  loading: "Cargando mensajes…",
  working: "Espera…",
  empty:
    "Todavía no hay conversaciones. Abre un anuncio guardado y envía una consulta para empezar.",
  choose: "Elige una conversación",
  chooseNote:
    "Tus borradores sin enviar se conservan mientras exploras otras secciones.",
  olderThreads: "Cargar más conversaciones",
  olderMessages: "Cargar mensajes anteriores",
  unread: "Sin leer",
  you: "Tú",
  message: "Mensaje",
  placeholder: "Escribe un mensaje sobre este anuncio…",
  send: "Enviar mensaje",
  sent: "Mensaje guardado en esta conversación.",
  markRead: "Marcar como leídos hasta el último mensaje mostrado",
  readNote:
    "Incluye los mensajes anteriores, aunque todavía no se hayan cargado.",
  readSaved: "Mensajes marcados como leídos hasta el último mensaje mostrado.",
  block: "Bloquear conversación",
  unblock: "Desbloquear conversación",
  blockPrompt:
    "¿Bloquear esta conversación? Nadie podrá enviar nuevos mensajes mientras cualquiera de los participantes mantenga el bloqueo. Los mensajes existentes seguirán disponibles.",
  confirmBlock: "Sí, bloquear esta conversación",
  cancel: "Cancelar",
  blockedByYou:
    "Has bloqueado esta conversación. Desbloquéala para permitir mensajes si la otra persona no la ha bloqueado también.",
  blockedByOther:
    "No se pueden enviar mensajes en esta conversación actualmente.",
  blockedSaved: "Se guardó tu preferencia de bloqueo.",
  closed:
    "Este anuncio ya no está publicado. La conversación sigue disponible para sus participantes.",
  draft: "Borrador sin enviar",
  unknown:
    "El resultado es incierto. Tu trabajo está a salvo. Reintenta exactamente la misma acción para evitar duplicados.",
  retry: "Reintentar la misma acción",
  refreshBeforeRetry:
    "No se pudo confirmar la acción. Actualiza la conversación antes de reintentar.",
  validation: "Escribe un mensaje dentro del límite de caracteres indicado.",
  unavailable: "Esta conversación ya no está disponible para tu cuenta.",
  failed:
    "No se pudo completar la acción. Tu borrador se conserva. Prueba a actualizar.",
  session:
    "Tu sesión ha cambiado. Vuelve a abrir tu cuenta antes de continuar.",
  rate: "Demasiadas solicitudes. Espera un poco antes de reintentar.",
  limit: "Esta conversación local ha alcanzado el límite de registros.",
  conflict:
    "Este identificador ya pertenece a otro mensaje. Actualiza antes de continuar; tu borrador se conserva.",
  noMessages: "Todavía no hay mensajes en esta conversación.",
  inbox: "Conversaciones",
  viewings: "Solicitudes de visita",
  backToMessages: "Volver a los mensajes",
  loadingViewings: "Cargando solicitudes de visita…",
};
const fr: Copy = {
  title: "Messages privés",
  note: "Conversations locales de test entre l’annonceur et la personne intéressée. Aucun email, SMS ou message externe n’est envoyé.",
  privacy:
    "Utilisez des données fictives. Ne partagez pas de documents d’identité, de coordonnées bancaires ou d’instructions de paiement ici.",
  refresh: "Actualiser les conversations",
  refreshThread: "Actualiser la conversation",
  loading: "Chargement des messages…",
  working: "Veuillez patienter…",
  empty:
    "Aucune conversation. Ouvrez une annonce enregistrée et envoyez une demande pour commencer.",
  choose: "Choisissez une conversation",
  chooseNote:
    "Vos brouillons sont conservés pendant que vous explorez les autres rubriques.",
  olderThreads: "Charger d’autres conversations",
  olderMessages: "Charger les messages précédents",
  unread: "Non lu",
  you: "Vous",
  message: "Message",
  placeholder: "Écrivez un message au sujet de cette annonce…",
  send: "Envoyer le message",
  sent: "Message enregistré dans cette conversation.",
  markRead: "Marquer comme lus jusqu’au dernier message affiché",
  readNote:
    "Cela inclut les messages précédents, même s’ils n’ont pas encore été chargés.",
  readSaved: "Messages marqués comme lus jusqu’au dernier message affiché.",
  block: "Bloquer la conversation",
  unblock: "Débloquer la conversation",
  blockPrompt:
    "Bloquer cette conversation ? Aucun participant ne pourra envoyer de nouveaux messages tant que l’un d’eux maintient le blocage. Les messages existants restent accessibles.",
  confirmBlock: "Oui, bloquer cette conversation",
  cancel: "Annuler",
  blockedByYou:
    "Vous avez bloqué cette conversation. Débloquez-la pour permettre les messages, sauf si l’autre personne l’a aussi bloquée.",
  blockedByOther:
    "L’envoi de messages est actuellement indisponible dans cette conversation.",
  blockedSaved: "Votre préférence de blocage a été enregistrée.",
  closed:
    "Cette annonce n’est plus publiée. La conversation reste accessible à ses participants.",
  draft: "Brouillon non envoyé",
  unknown:
    "Le résultat est incertain. Votre travail est conservé. Réessayez exactement la même action pour éviter un doublon.",
  retry: "Réessayer la même action",
  refreshBeforeRetry:
    "L’action n’a pas pu être confirmée. Actualisez la conversation avant de réessayer.",
  validation: "Écrivez un message respectant la limite de caractères indiquée.",
  unavailable: "Cette conversation n’est plus accessible à votre compte.",
  failed:
    "L’action n’a pas abouti. Votre brouillon est conservé. Essayez d’actualiser.",
  session: "Votre session a changé. Rouvrez votre compte avant de continuer.",
  rate: "Trop de demandes. Patientez un peu avant de réessayer.",
  limit: "Cette conversation locale a atteint sa limite d’enregistrements.",
  conflict:
    "Cet identifiant appartient déjà à un autre message. Actualisez avant de continuer ; votre brouillon est conservé.",
  noMessages: "Aucun message dans cette conversation pour le moment.",
  inbox: "Conversations",
  viewings: "Demandes de visite",
  backToMessages: "Retour aux messages",
  loadingViewings: "Chargement des demandes de visite…",
};
const ar: Copy = {
  title: "الرسائل الخاصة",
  note: "محادثات اختبار محلية بين المعلن والشخص المهتم. لا تُرسل رسائل بريد أو رسائل نصية أو رسائل خارجية.",
  privacy:
    "استخدم بيانات وهمية. لا تشارك وثائق الهوية أو البيانات المصرفية أو تعليمات الدفع هنا.",
  refresh: "تحديث المحادثات",
  refreshThread: "تحديث المحادثة",
  loading: "جارٍ تحميل الرسائل…",
  working: "يرجى الانتظار…",
  empty: "لا توجد محادثات بعد. افتح إعلاناً محفوظاً وأرسل استفساراً للبدء.",
  choose: "اختر محادثة",
  chooseNote: "تُحفظ المسودات غير المرسلة أثناء استكشاف الأقسام الأخرى.",
  olderThreads: "تحميل المزيد من المحادثات",
  olderMessages: "تحميل الرسائل السابقة",
  unread: "غير مقروء",
  you: "أنت",
  message: "رسالة",
  placeholder: "اكتب رسالة عن هذا الإعلان…",
  send: "إرسال الرسالة",
  sent: "حُفظت الرسالة في هذه المحادثة.",
  markRead: "تحديد الرسائل كمقروءة حتى آخر رسالة معروضة",
  readNote: "يشمل ذلك الرسائل السابقة، حتى إذا لم تُحمّل بعد.",
  readSaved: "حُددت الرسائل كمقروءة حتى آخر رسالة معروضة.",
  block: "حظر المحادثة",
  unblock: "إلغاء حظر المحادثة",
  blockPrompt:
    "هل تريد حظر المحادثة؟ لا يستطيع أي مشارك إرسال رسائل جديدة ما دام أحدهما يحظرها. تبقى الرسائل الحالية متاحة.",
  confirmBlock: "نعم، احظر هذه المحادثة",
  cancel: "إلغاء",
  blockedByYou:
    "لقد حظرت هذه المحادثة. ألغِ الحظر للسماح بالرسائل، ما لم يحظرها الطرف الآخر أيضاً.",
  blockedByOther: "إرسال الرسائل غير متاح حالياً في هذه المحادثة.",
  blockedSaved: "حُفظ تفضيل الحظر الخاص بك.",
  closed: "لم يعد الإعلان منشوراً. تبقى المحادثة متاحة للمشاركين.",
  draft: "مسودة غير مرسلة",
  unknown:
    "النتيجة غير مؤكدة. عملك محفوظ. أعد محاولة الإجراء نفسه لتجنب التكرار.",
  retry: "إعادة محاولة الإجراء نفسه",
  refreshBeforeRetry: "تعذر تأكيد الإجراء. حدّث المحادثة قبل المحاولة مجدداً.",
  validation: "اكتب رسالة ضمن حد الأحرف المعروض.",
  unavailable: "لم تعد هذه المحادثة متاحة لحسابك.",
  failed: "تعذر إكمال الإجراء. مسودتك محفوظة. حاول التحديث.",
  session: "تغيرت جلستك. أعد فتح حسابك قبل المتابعة.",
  rate: "طلبات كثيرة جداً. انتظر قليلاً قبل المحاولة مجدداً.",
  limit: "وصلت هذه المحادثة المحلية إلى حد السجلات.",
  conflict: "معرّف الطلب مستخدم لرسالة أخرى. حدّث قبل المتابعة؛ مسودتك محفوظة.",
  noMessages: "لا توجد رسائل في هذه المحادثة بعد.",
  inbox: "المحادثات",
  viewings: "طلبات الزيارة",
  backToMessages: "العودة إلى الرسائل",
  loadingViewings: "جار تحميل طلبات الزيارة…",
};
const zh: Copy = {
  title: "私信",
  note: "发布者与咨询者之间的本地测试对话。不发送电子邮件、短信或外部消息。",
  privacy: "请使用虚构测试资料。不要在此分享身份证件、银行资料或付款指示。",
  refresh: "刷新对话",
  refreshThread: "刷新当前对话",
  loading: "正在加载消息…",
  working: "请稍候…",
  empty: "暂无对话。打开已保存的房源并发送咨询即可开始。",
  choose: "选择对话",
  chooseNote: "浏览其他区域时，未发送的草稿会保留。",
  olderThreads: "加载更多对话",
  olderMessages: "加载更早的消息",
  unread: "未读",
  you: "你",
  message: "消息",
  placeholder: "填写有关此房源的消息…",
  send: "发送消息",
  sent: "消息已保存在此对话中。",
  markRead: "标记为已读至最后一条已显示的消息",
  readNote: "这包括更早的消息，即使这些消息尚未加载。",
  readSaved: "已标记为已读至最后一条已显示的消息。",
  block: "屏蔽对话",
  unblock: "解除屏蔽",
  blockPrompt:
    "屏蔽此对话？只要任何一方维持屏蔽，双方都无法发送新消息。现有消息仍可查看。",
  confirmBlock: "是，屏蔽此对话",
  cancel: "取消",
  blockedByYou: "你已屏蔽此对话。解除屏蔽后可恢复消息，除非对方也设置了屏蔽。",
  blockedByOther: "此对话目前无法发送消息。",
  blockedSaved: "已保存你的屏蔽设置。",
  closed: "此房源已不再发布。参与者仍可查看对话。",
  draft: "未发送草稿",
  unknown: "结果尚不确定。内容已保留。请重试同一操作以避免重复提交。",
  retry: "重试同一操作",
  refreshBeforeRetry: "无法确认操作结果。请刷新对话后重试。",
  validation: "请在显示的字数限制内填写消息。",
  unavailable: "你的账号已无法访问此对话。",
  failed: "操作未完成。草稿已保留，请尝试刷新。",
  session: "登录状态已更改。请重新打开账号后继续。",
  rate: "请求过多，请稍后重试。",
  limit: "此本地对话已达到记录上限。",
  conflict: "此请求编号已用于其他消息。请刷新后继续，草稿已保留。",
  noMessages: "此对话暂无消息。",
  inbox: "对话列表",
  viewings: "看房请求",
  backToMessages: "返回消息",
  loadingViewings: "正在加载看房请求…",
};
export const privateMessagesTranslations: Record<LanguageCode, Copy> = {
  en,
  pt,
  es,
  fr,
  ar,
  zh,
};
export function privateMessagesCopy(language: LanguageCode): Copy {
  const native = privateMessagesTranslations[language];
  if (language !== "ar" && language !== "zh") return native;
  return Object.fromEntries(
    Object.entries(native).map(([key, value]) => [
      key,
      `${value} (${en[key as keyof Copy]})`,
    ]),
  ) as Copy;
}
