import type { LanguageCode } from "../i18n";

const en = {
  title: "Property viewings",
  you: "You",
  owner: "Listing owner",
  requester: "Interested person",
  intro:
    "Agree a time with the other person in this conversation. This is a request, not live availability.",
  privacy:
    "Local test only. Use invented details; do not put a private address or sensitive information in the note.",
  timeZone: "All appointment times are in Luanda (Africa/Luanda, UTC+1).",
  refresh: "Refresh viewings",
  loading: "Loading viewings…",
  loadFailed:
    "Viewings could not be loaded. Use Refresh viewings to try again; the request list is not known yet.",
  historyUnavailable:
    "The latest history has not been loaded. Refresh it to see this request's current saved history.",
  refreshHistory: "Refresh saved history",
  metadataRefresh:
    "Use Refresh conversation above to update the listing and conversation status before trying again.",
  working: "Saving…",
  empty: "No viewing requests in this conversation yet.",
  older: "Load older requests",
  loaded: "Requests shown",
  newRequest: "Request a viewing",
  ownerNote:
    "The interested person can request a viewing here. You can then confirm, suggest another time or decline.",
  closed:
    "New requests are unavailable while the listing is paused. Existing requests can still be managed.",
  blocked:
    "This conversation is blocked. New requests, proposals and confirmations are unavailable; eligible requests can still be declined or cancelled.",
  oneActive:
    "There is already an active viewing request. Manage or cancel it before requesting another.",
  elapsed: "This time has passed. It does not mean the viewing took place.",
  confirmedNote:
    "To change a confirmed time, cancel this request and create a new one.",
  newHeading: "Request a time",
  proposeHeading: "Suggest another time",
  confirmHeading: "Confirm this time",
  acceptHeading: "Accept the alternative time",
  declineHeading: "Decline this request",
  cancelHeading: "Cancel this viewing request",
  startsAt: "Date and time in Luanda",
  duration: "Duration",
  minutes: "minutes",
  note: "Note (optional)",
  noteHint:
    "Up to 1,000 characters. Visible to both people in this conversation.",
  timeHint:
    "Choose a future time within the next 180 days. No available time slots are being suggested or guaranteed.",
  propose: "Suggest another time",
  confirm: "Confirm time",
  accept: "Accept alternative",
  decline: "Decline request",
  cancel: "Cancel request",
  saveRequest: "Send viewing request",
  saveProposal: "Send alternative time",
  saveConfirm: "Confirm this viewing",
  saveAccept: "Accept this time",
  saveDecline: "Yes, decline request",
  saveCancel: "Yes, cancel request",
  confirmNotice:
    "Both people will see this time as confirmed. This does not create a tenancy, payment or attendance record.",
  declineNotice:
    "The request will be closed as declined. Its history remains available.",
  cancelNotice:
    "The request will be closed as cancelled. This does not cancel a tenancy, issue a refund or erase its history.",
  closeEditor: "Close editor — keep draft",
  resume: "Continue draft",
  draft: "Unsaved viewing draft",
  discardPrompt:
    "Replace this unsaved viewing draft? Other conversations' drafts will remain unchanged.",
  reloadPrompt:
    "Load the latest request and discard this viewing draft? Its saved history will remain unchanged.",
  keep: "Keep draft",
  discard: "Discard and continue",
  reload: "Reload latest request",
  history: "Saved history",
  historyEmpty: "No history is available.",
  before: "Before",
  after: "After",
  requested: "Requested",
  proposed: "Alternative proposed",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  created: "Request created",
  accepted: "Alternative accepted",
  updated: "Updated",
  saved: "Viewing request saved.",
  unknown:
    "The result is uncertain. Retry the exact same action to avoid submitting it twice. Your draft is retained.",
  retry: "Retry the same action",
  conflict:
    "This request changed elsewhere. Your draft is retained. Review the latest version before submitting again.",
  unavailable:
    "This viewing or conversation is no longer available to your account.",
  failed:
    "The request could not be completed. Your unsaved draft is retained. Try refreshing.",
  session: "Your session changed. Refresh your account before continuing.",
  rate: "Too many requests. Wait a little before trying again.",
  limit:
    "This local test has reached its viewing or history limit. Eligible requests may still be declined or cancelled.",
  validation:
    "Check the date, duration and note. The duration must be 15–180 minutes in 15-minute steps.",
  invalidTime:
    "Choose a valid future time in Luanda, no more than 180 days from now.",
  activeExists:
    "Another active viewing already exists in this conversation. Refresh to review it.",
  slotConflict:
    "This time overlaps a confirmed viewing for this property. Choose another time; other appointments are not disclosed.",
  invalidState:
    "This action is no longer available for the current request. Refresh to review its status.",
  mutationConflict:
    "This action identifier was already used with different details. Refresh before starting a new action; your draft is retained.",
};
type Copy = Record<keyof typeof en, string>;

const pt: Copy = {
  title: "Visitas ao imóvel",
  you: "Eu",
  owner: "Anunciante",
  requester: "Pessoa interessada",
  intro:
    "Combine um horário com a outra pessoa nesta conversa. É um pedido, não uma indicação de disponibilidade em tempo real.",
  privacy:
    "Apenas teste local. Use dados fictícios; não inclua a morada privada nem informações sensíveis na nota.",
  timeZone: "Todos os horários são de Luanda (Africa/Luanda, UTC+1).",
  refresh: "Atualizar visitas",
  loading: "A carregar visitas…",
  loadFailed:
    "Não foi possível carregar as visitas. Use Atualizar visitas para tentar novamente; a lista de pedidos ainda não é conhecida.",
  historyUnavailable:
    "O histórico mais recente ainda não foi carregado. Atualize-o para consultar o histórico guardado atual deste pedido.",
  refreshHistory: "Atualizar histórico guardado",
  metadataRefresh:
    "Use Atualizar conversa acima para atualizar o estado do anúncio e da conversa antes de tentar novamente.",
  working: "A guardar…",
  empty: "Ainda não há pedidos de visita nesta conversa.",
  older: "Carregar pedidos anteriores",
  loaded: "Pedidos apresentados",
  newRequest: "Pedir uma visita",
  ownerNote:
    "A pessoa interessada pode pedir uma visita aqui. Depois poderá confirmar, sugerir outro horário ou recusar.",
  closed:
    "Não é possível criar pedidos enquanto o anúncio estiver pausado. Os pedidos existentes continuam disponíveis para gestão.",
  blocked:
    "Esta conversa está bloqueada. Não é possível criar pedidos, propor horários ou confirmar; ainda pode recusar ou cancelar os pedidos elegíveis.",
  oneActive:
    "Já existe um pedido de visita ativo. Faça a sua gestão ou cancele-o antes de pedir outra visita.",
  elapsed:
    "Este horário já passou. Isso não significa que a visita tenha ocorrido.",
  confirmedNote:
    "Para alterar um horário confirmado, cancele este pedido e crie outro.",
  newHeading: "Pedir um horário",
  proposeHeading: "Sugerir outro horário",
  confirmHeading: "Confirmar este horário",
  acceptHeading: "Aceitar o horário alternativo",
  declineHeading: "Recusar este pedido",
  cancelHeading: "Cancelar este pedido de visita",
  startsAt: "Data e hora em Luanda",
  duration: "Duração",
  minutes: "minutos",
  note: "Nota (opcional)",
  noteHint:
    "Até 1.000 caracteres. Visível para ambas as pessoas nesta conversa.",
  timeHint:
    "Escolha um horário futuro nos próximos 180 dias. Não são sugeridos nem garantidos horários disponíveis.",
  propose: "Sugerir outro horário",
  confirm: "Confirmar horário",
  accept: "Aceitar alternativa",
  decline: "Recusar pedido",
  cancel: "Cancelar pedido",
  saveRequest: "Enviar pedido de visita",
  saveProposal: "Enviar horário alternativo",
  saveConfirm: "Confirmar esta visita",
  saveAccept: "Aceitar este horário",
  saveDecline: "Sim, recusar pedido",
  saveCancel: "Sim, cancelar pedido",
  confirmNotice:
    "Ambas as pessoas verão este horário como confirmado. Isto não cria um contrato de arrendamento, pagamento ou registo de presença.",
  declineNotice:
    "O pedido será encerrado como recusado. O histórico continuará disponível.",
  cancelNotice:
    "O pedido será encerrado como cancelado. Isto não cancela um arrendamento, emite um reembolso nem apaga o histórico.",
  closeEditor: "Fechar editor — manter rascunho",
  resume: "Continuar rascunho",
  draft: "Rascunho de visita por guardar",
  discardPrompt:
    "Substituir este rascunho de visita por guardar? Os rascunhos das outras conversas não serão alterados.",
  reloadPrompt:
    "Carregar o pedido mais recente e descartar este rascunho de visita? O histórico guardado não será alterado.",
  keep: "Manter rascunho",
  discard: "Descartar e continuar",
  reload: "Carregar pedido mais recente",
  history: "Histórico guardado",
  historyEmpty: "Não há histórico disponível.",
  before: "Antes",
  after: "Depois",
  requested: "Pedido enviado",
  proposed: "Alternativa proposta",
  confirmed: "Confirmado",
  declined: "Recusado",
  cancelled: "Cancelado",
  created: "Pedido criado",
  accepted: "Alternativa aceite",
  updated: "Atualizado",
  saved: "Pedido de visita guardado.",
  unknown:
    "O resultado é incerto. Repita exatamente a mesma ação para evitar duplicados. O seu rascunho foi mantido.",
  retry: "Repetir a mesma ação",
  conflict:
    "Este pedido foi alterado noutro local. O seu rascunho foi mantido. Reveja a versão mais recente antes de voltar a enviar.",
  unavailable:
    "Esta visita ou conversa já não está disponível para a sua conta.",
  failed:
    "Não foi possível concluir o pedido. O seu rascunho foi mantido. Tente atualizar.",
  session: "A sua sessão mudou. Atualize a conta antes de continuar.",
  rate: "Demasiados pedidos. Aguarde um pouco antes de tentar novamente.",
  limit:
    "Este teste local atingiu o limite de visitas ou de histórico. Os pedidos elegíveis ainda podem ser recusados ou cancelados.",
  validation:
    "Verifique a data, duração e nota. A duração deve ser de 15 a 180 minutos, em intervalos de 15 minutos.",
  invalidTime:
    "Escolha um horário futuro válido em Luanda, até 180 dias a partir de agora.",
  activeExists:
    "Já existe outro pedido de visita ativo nesta conversa. Atualize para o consultar.",
  slotConflict:
    "Este horário coincide com uma visita confirmada para o imóvel. Escolha outro horário; os outros compromissos não são divulgados.",
  invalidState:
    "Esta ação já não está disponível para o pedido atual. Atualize para consultar o estado.",
  mutationConflict:
    "O identificador desta ação já foi usado com outros dados. Atualize antes de iniciar uma nova ação; o rascunho foi mantido.",
};

const es: Copy = {
  title: "Visitas al inmueble",
  you: "Tú",
  owner: "Anunciante",
  requester: "Persona interesada",
  intro:
    "Acuerda una hora con la otra persona en esta conversación. Es una solicitud, no disponibilidad en tiempo real.",
  privacy:
    "Solo prueba local. Usa datos ficticios; no incluyas la dirección privada ni información sensible en la nota.",
  timeZone: "Todas las horas corresponden a Luanda (Africa/Luanda, UTC+1).",
  refresh: "Actualizar visitas",
  loading: "Cargando visitas…",
  loadFailed:
    "No se pudieron cargar las visitas. Usa Actualizar visitas para volver a intentarlo; todavía no se conoce la lista de solicitudes.",
  historyUnavailable:
    "El historial más reciente no se ha cargado. Actualízalo para consultar el historial guardado actual de esta solicitud.",
  refreshHistory: "Actualizar historial guardado",
  metadataRefresh:
    "Usa Actualizar conversación arriba para actualizar el estado del anuncio y de la conversación antes de volver a intentarlo.",
  working: "Guardando…",
  empty: "Todavía no hay solicitudes de visita en esta conversación.",
  older: "Cargar solicitudes anteriores",
  loaded: "Solicitudes mostradas",
  newRequest: "Solicitar una visita",
  ownerNote:
    "La persona interesada puede solicitar una visita aquí. Después podrás confirmar, sugerir otra hora o rechazarla.",
  closed:
    "No se pueden crear solicitudes con el anuncio pausado. Las solicitudes existentes se pueden seguir gestionando.",
  blocked:
    "Esta conversación está bloqueada. No se pueden crear solicitudes, proponer ni confirmar; aún se pueden rechazar o cancelar las solicitudes permitidas.",
  oneActive:
    "Ya existe una solicitud activa. Gestiónala o cancélala antes de solicitar otra.",
  elapsed:
    "Esta hora ya ha pasado. No significa que la visita se haya realizado.",
  confirmedNote:
    "Para cambiar una hora confirmada, cancela esta solicitud y crea otra.",
  newHeading: "Solicitar una hora",
  proposeHeading: "Sugerir otra hora",
  confirmHeading: "Confirmar esta hora",
  acceptHeading: "Aceptar la hora alternativa",
  declineHeading: "Rechazar esta solicitud",
  cancelHeading: "Cancelar esta solicitud de visita",
  startsAt: "Fecha y hora en Luanda",
  duration: "Duración",
  minutes: "minutos",
  note: "Nota (opcional)",
  noteHint:
    "Hasta 1.000 caracteres. Visible para ambas personas en esta conversación.",
  timeHint:
    "Elige una hora futura dentro de los próximos 180 días. No se sugieren ni garantizan horas disponibles.",
  propose: "Sugerir otra hora",
  confirm: "Confirmar hora",
  accept: "Aceptar alternativa",
  decline: "Rechazar solicitud",
  cancel: "Cancelar solicitud",
  saveRequest: "Enviar solicitud de visita",
  saveProposal: "Enviar hora alternativa",
  saveConfirm: "Confirmar esta visita",
  saveAccept: "Aceptar esta hora",
  saveDecline: "Sí, rechazar solicitud",
  saveCancel: "Sí, cancelar solicitud",
  confirmNotice:
    "Ambas personas verán esta hora como confirmada. No crea un contrato de alquiler, pago ni registro de asistencia.",
  declineNotice:
    "La solicitud se cerrará como rechazada. Su historial seguirá disponible.",
  cancelNotice:
    "La solicitud se cerrará como cancelada. No cancela un alquiler, emite un reembolso ni elimina el historial.",
  closeEditor: "Cerrar editor — mantener borrador",
  resume: "Continuar borrador",
  draft: "Borrador de visita sin guardar",
  discardPrompt:
    "¿Sustituir este borrador de visita sin guardar? Los borradores de otras conversaciones no cambiarán.",
  reloadPrompt:
    "¿Cargar la solicitud más reciente y descartar este borrador? El historial guardado no cambiará.",
  keep: "Mantener borrador",
  discard: "Descartar y continuar",
  reload: "Cargar solicitud más reciente",
  history: "Historial guardado",
  historyEmpty: "No hay historial disponible.",
  before: "Antes",
  after: "Después",
  requested: "Solicitada",
  proposed: "Alternativa propuesta",
  confirmed: "Confirmada",
  declined: "Rechazada",
  cancelled: "Cancelada",
  created: "Solicitud creada",
  accepted: "Alternativa aceptada",
  updated: "Actualizada",
  saved: "Solicitud de visita guardada.",
  unknown:
    "El resultado es incierto. Repite exactamente la misma acción para evitar duplicados. Tu borrador se conserva.",
  retry: "Repetir la misma acción",
  conflict:
    "Esta solicitud cambió en otro lugar. Tu borrador se conserva. Revisa la versión más reciente antes de volver a enviarla.",
  unavailable:
    "Esta visita o conversación ya no está disponible para tu cuenta.",
  failed:
    "No se pudo completar la solicitud. Tu borrador se conserva. Intenta actualizar.",
  session: "Tu sesión cambió. Actualiza la cuenta antes de continuar.",
  rate: "Demasiadas solicitudes. Espera un poco antes de intentarlo de nuevo.",
  limit:
    "Esta prueba local alcanzó el límite de visitas o historial. Las solicitudes permitidas aún se pueden rechazar o cancelar.",
  validation:
    "Revisa la fecha, duración y nota. La duración debe ser de 15 a 180 minutos en intervalos de 15 minutos.",
  invalidTime:
    "Elige una hora futura válida en Luanda, como máximo dentro de 180 días.",
  activeExists:
    "Ya existe otra solicitud activa en esta conversación. Actualiza para consultarla.",
  slotConflict:
    "Esta hora coincide con una visita confirmada para el inmueble. Elige otra; no se muestran las otras citas.",
  invalidState:
    "Esta acción ya no está disponible para la solicitud actual. Actualiza para consultar su estado.",
  mutationConflict:
    "Este identificador ya se usó con otros datos. Actualiza antes de iniciar una nueva acción; tu borrador se conserva.",
};

const fr: Copy = {
  title: "Visites du bien",
  you: "Vous",
  owner: "Annonceur",
  requester: "Personne intéressée",
  intro:
    "Convenez d’un horaire avec l’autre personne dans cette conversation. Il s’agit d’une demande, pas de disponibilités en temps réel.",
  privacy:
    "Test local uniquement. Utilisez des données fictives ; n’indiquez pas d’adresse privée ni d’informations sensibles dans la note.",
  timeZone: "Tous les horaires sont ceux de Luanda (Africa/Luanda, UTC+1).",
  refresh: "Actualiser les visites",
  loading: "Chargement des visites…",
  loadFailed:
    "Les visites n’ont pas pu être chargées. Utilisez Actualiser les visites pour réessayer ; la liste des demandes n’est pas encore connue.",
  historyUnavailable:
    "Le dernier historique n’a pas été chargé. Actualisez-le pour consulter l’historique enregistré actuel de cette demande.",
  refreshHistory: "Actualiser l’historique enregistré",
  metadataRefresh:
    "Utilisez Actualiser la conversation ci-dessus pour mettre à jour l’état de l’annonce et de la conversation avant de réessayer.",
  working: "Enregistrement…",
  empty: "Aucune demande de visite dans cette conversation pour le moment.",
  older: "Charger les demandes précédentes",
  loaded: "Demandes affichées",
  newRequest: "Demander une visite",
  ownerNote:
    "La personne intéressée peut demander une visite ici. Vous pourrez ensuite confirmer, proposer un autre horaire ou refuser.",
  closed:
    "Les nouvelles demandes sont indisponibles lorsque l’annonce est en pause. Les demandes existantes restent gérables.",
  blocked:
    "Cette conversation est bloquée. Les nouvelles demandes, propositions et confirmations sont indisponibles ; les demandes admissibles peuvent encore être refusées ou annulées.",
  oneActive:
    "Une demande de visite est déjà active. Gérez-la ou annulez-la avant d’en créer une autre.",
  elapsed:
    "Cet horaire est passé. Cela ne signifie pas que la visite a eu lieu.",
  confirmedNote:
    "Pour modifier un horaire confirmé, annulez cette demande et créez-en une nouvelle.",
  newHeading: "Demander un horaire",
  proposeHeading: "Proposer un autre horaire",
  confirmHeading: "Confirmer cet horaire",
  acceptHeading: "Accepter l’horaire proposé",
  declineHeading: "Refuser cette demande",
  cancelHeading: "Annuler cette demande de visite",
  startsAt: "Date et heure à Luanda",
  duration: "Durée",
  minutes: "minutes",
  note: "Note (facultative)",
  noteHint:
    "1 000 caractères maximum. Visible par les deux personnes dans cette conversation.",
  timeHint:
    "Choisissez un horaire futur dans les 180 prochains jours. Aucun créneau disponible n’est suggéré ni garanti.",
  propose: "Proposer un autre horaire",
  confirm: "Confirmer l’horaire",
  accept: "Accepter l’alternative",
  decline: "Refuser la demande",
  cancel: "Annuler la demande",
  saveRequest: "Envoyer la demande de visite",
  saveProposal: "Envoyer un autre horaire",
  saveConfirm: "Confirmer cette visite",
  saveAccept: "Accepter cet horaire",
  saveDecline: "Oui, refuser la demande",
  saveCancel: "Oui, annuler la demande",
  confirmNotice:
    "Les deux personnes verront cet horaire comme confirmé. Cela ne crée ni bail, ni paiement, ni preuve de présence.",
  declineNotice:
    "La demande sera clôturée comme refusée. Son historique restera disponible.",
  cancelNotice:
    "La demande sera clôturée comme annulée. Cela n’annule pas un bail, n’émet pas de remboursement et n’efface pas l’historique.",
  closeEditor: "Fermer l’éditeur — garder le brouillon",
  resume: "Reprendre le brouillon",
  draft: "Brouillon de visite non enregistré",
  discardPrompt:
    "Remplacer ce brouillon de visite non enregistré ? Les brouillons des autres conversations resteront inchangés.",
  reloadPrompt:
    "Charger la demande la plus récente et abandonner ce brouillon ? L’historique enregistré restera inchangé.",
  keep: "Garder le brouillon",
  discard: "Abandonner et continuer",
  reload: "Charger la demande récente",
  history: "Historique enregistré",
  historyEmpty: "Aucun historique disponible.",
  before: "Avant",
  after: "Après",
  requested: "Demandée",
  proposed: "Autre horaire proposé",
  confirmed: "Confirmée",
  declined: "Refusée",
  cancelled: "Annulée",
  created: "Demande créée",
  accepted: "Alternative acceptée",
  updated: "Mise à jour",
  saved: "Demande de visite enregistrée.",
  unknown:
    "Le résultat est incertain. Réessayez exactement la même action pour éviter un doublon. Votre brouillon est conservé.",
  retry: "Réessayer la même action",
  conflict:
    "Cette demande a été modifiée ailleurs. Votre brouillon est conservé. Consultez la dernière version avant de renvoyer.",
  unavailable:
    "Cette visite ou conversation n’est plus accessible à votre compte.",
  failed:
    "La demande n’a pas pu aboutir. Votre brouillon est conservé. Essayez d’actualiser.",
  session:
    "Votre session a changé. Actualisez votre compte avant de continuer.",
  rate: "Trop de demandes. Patientez avant de réessayer.",
  limit:
    "Ce test local a atteint sa limite de visites ou d’historique. Les demandes admissibles peuvent encore être refusées ou annulées.",
  validation:
    "Vérifiez la date, la durée et la note. La durée doit être de 15 à 180 minutes par tranches de 15 minutes.",
  invalidTime:
    "Choisissez un horaire futur valide à Luanda, dans 180 jours au maximum.",
  activeExists:
    "Une autre demande est déjà active dans cette conversation. Actualisez pour la consulter.",
  slotConflict:
    "Cet horaire chevauche une visite confirmée du bien. Choisissez-en un autre ; les autres rendez-vous ne sont pas divulgués.",
  invalidState:
    "Cette action n’est plus disponible pour la demande actuelle. Actualisez pour consulter son état.",
  mutationConflict:
    "Cet identifiant a déjà été utilisé avec d’autres données. Actualisez avant une nouvelle action ; votre brouillon est conservé.",
};

const ar: Copy = {
  you: "أنت",
  owner: "صاحب الإعلان",
  requester: "الشخص المهتم",
  title: "زيارات العقار",
  intro:
    "اتفق على موعد مع الشخص الآخر في هذه المحادثة. هذا طلب وليس عرضاً للتوافر المباشر.",
  privacy:
    "اختبار محلي فقط. استخدم بيانات وهمية ولا تضع عنواناً خاصاً أو معلومات حساسة في الملاحظة.",
  timeZone: "جميع المواعيد بتوقيت لواندا (Africa/Luanda، UTC+1).",
  refresh: "تحديث الزيارات",
  loading: "جارٍ تحميل الزيارات…",
  loadFailed:
    "تعذر تحميل الزيارات. استخدم تحديث الزيارات للمحاولة مجدداً؛ قائمة الطلبات غير معروفة بعد.",
  historyUnavailable:
    "لم يتم تحميل أحدث سجل. حدّثه لعرض السجل الحالي المحفوظ لهذا الطلب.",
  refreshHistory: "تحديث السجل المحفوظ",
  metadataRefresh:
    "استخدم تحديث المحادثة أعلاه لتحديث حالة الإعلان والمحادثة قبل المحاولة مجدداً.",
  working: "جارٍ الحفظ…",
  empty: "لا توجد طلبات زيارة في هذه المحادثة بعد.",
  older: "تحميل الطلبات السابقة",
  loaded: "الطلبات المعروضة",
  newRequest: "طلب زيارة",
  ownerNote:
    "يمكن للشخص المهتم طلب زيارة هنا. يمكنك بعد ذلك التأكيد أو اقتراح موعد آخر أو الرفض.",
  closed:
    "الطلبات الجديدة غير متاحة أثناء إيقاف الإعلان. يمكن متابعة إدارة الطلبات الحالية.",
  blocked:
    "هذه المحادثة محظورة. الطلبات والاقتراحات والتأكيدات الجديدة غير متاحة؛ يمكن رفض الطلبات المؤهلة أو إلغاؤها.",
  oneActive:
    "يوجد طلب زيارة نشط بالفعل. قم بإدارته أو إلغائه قبل طلب زيارة أخرى.",
  elapsed: "لقد مضى هذا الموعد. هذا لا يعني أن الزيارة قد تمت.",
  confirmedNote: "لتغيير موعد مؤكد، ألغِ هذا الطلب وأنشئ طلباً جديداً.",
  newHeading: "طلب موعد",
  proposeHeading: "اقتراح موعد آخر",
  confirmHeading: "تأكيد هذا الموعد",
  acceptHeading: "قبول الموعد البديل",
  declineHeading: "رفض هذا الطلب",
  cancelHeading: "إلغاء طلب الزيارة",
  startsAt: "التاريخ والوقت في لواندا",
  duration: "المدة",
  minutes: "دقائق",
  note: "ملاحظة (اختيارية)",
  noteHint: "حتى 1000 حرف. تظهر لكلا الشخصين في المحادثة.",
  timeHint:
    "اختر موعداً مستقبلياً خلال 180 يوماً. لا يتم اقتراح مواعيد متاحة أو ضمانها.",
  propose: "اقتراح موعد آخر",
  confirm: "تأكيد الموعد",
  accept: "قبول البديل",
  decline: "رفض الطلب",
  cancel: "إلغاء الطلب",
  saveRequest: "إرسال طلب الزيارة",
  saveProposal: "إرسال الموعد البديل",
  saveConfirm: "تأكيد هذه الزيارة",
  saveAccept: "قبول هذا الموعد",
  saveDecline: "نعم، رفض الطلب",
  saveCancel: "نعم، إلغاء الطلب",
  confirmNotice:
    "سيرى الطرفان الموعد مؤكداً. هذا لا ينشئ عقد إيجار أو دفعة أو سجل حضور.",
  declineNotice: "سيغلق الطلب باعتباره مرفوضاً. سيبقى السجل متاحاً.",
  cancelNotice:
    "سيغلق الطلب باعتباره ملغى. هذا لا يلغي إيجاراً أو يصدر استرداداً أو يحذف السجل.",
  closeEditor: "إغلاق المحرر مع الاحتفاظ بالمسودة",
  resume: "متابعة المسودة",
  draft: "مسودة زيارة غير محفوظة",
  discardPrompt:
    "هل تريد استبدال مسودة الزيارة غير المحفوظة؟ لن تتغير مسودات المحادثات الأخرى.",
  reloadPrompt:
    "هل تريد تحميل أحدث طلب وتجاهل هذه المسودة؟ لن يتغير السجل المحفوظ.",
  keep: "الاحتفاظ بالمسودة",
  discard: "تجاهل ومتابعة",
  reload: "تحميل أحدث طلب",
  history: "السجل المحفوظ",
  historyEmpty: "لا يتوفر سجل.",
  before: "قبل",
  after: "بعد",
  requested: "تم الطلب",
  proposed: "تم اقتراح بديل",
  confirmed: "مؤكد",
  declined: "مرفوض",
  cancelled: "ملغى",
  created: "تم إنشاء الطلب",
  accepted: "تم قبول البديل",
  updated: "تم التحديث",
  saved: "تم حفظ طلب الزيارة.",
  unknown:
    "النتيجة غير مؤكدة. أعد المحاولة بنفس الإجراء تماماً لتجنب التكرار. تم الاحتفاظ بمسودتك.",
  retry: "إعادة نفس الإجراء",
  conflict:
    "تم تعديل هذا الطلب في مكان آخر. تم الاحتفاظ بمسودتك. راجع أحدث نسخة قبل الإرسال مجدداً.",
  unavailable: "لم تعد هذه الزيارة أو المحادثة متاحة لحسابك.",
  failed: "تعذر إكمال الطلب. تم الاحتفاظ بمسودتك. حاول التحديث.",
  session: "تغيرت جلستك. حدّث حسابك قبل المتابعة.",
  rate: "طلبات كثيرة جداً. انتظر قليلاً قبل المحاولة مجدداً.",
  limit:
    "بلغ الاختبار المحلي حد الزيارات أو السجل. لا يزال من الممكن رفض الطلبات المؤهلة أو إلغاؤها.",
  validation:
    "تحقق من التاريخ والمدة والملاحظة. يجب أن تكون المدة بين 15 و180 دقيقة بخطوات 15 دقيقة.",
  invalidTime:
    "اختر موعداً مستقبلياً صالحاً في لواندا خلال 180 يوماً كحد أقصى.",
  activeExists: "يوجد طلب زيارة نشط آخر في هذه المحادثة. حدّث لعرضه.",
  slotConflict:
    "يتداخل هذا الموعد مع زيارة مؤكدة للعقار. اختر موعداً آخر؛ لا يتم كشف المواعيد الأخرى.",
  invalidState: "لم يعد هذا الإجراء متاحاً للطلب الحالي. حدّث لعرض حالته.",
  mutationConflict:
    "تم استخدام معرّف الإجراء مع بيانات مختلفة. حدّث قبل بدء إجراء جديد؛ تم الاحتفاظ بمسودتك.",
};

const zh: Copy = {
  you: "您",
  owner: "房源发布者",
  requester: "感兴趣的人",
  title: "房产看房",
  intro: "在此对话中与对方约定时间。这是预约申请，并非实时可用时段。",
  privacy: "仅限本地测试。请使用虚构资料，不要在备注中填写私人地址或敏感信息。",
  timeZone: "所有预约时间均为罗安达时间（Africa/Luanda，UTC+1）。",
  refresh: "刷新看房请求",
  loading: "正在加载看房请求…",
  loadFailed:
    "无法加载看房请求。请点击刷新看房请求重试；目前尚未获取请求列表。",
  historyUnavailable:
    "尚未加载最新历史记录。请刷新以查看此请求当前已保存的历史记录。",
  refreshHistory: "刷新已保存的历史记录",
  metadataRefresh: "请先点击上方的刷新对话，更新房源和对话状态，然后重试。",
  working: "正在保存…",
  empty: "此对话中尚无看房请求。",
  older: "加载更早的请求",
  loaded: "已显示的请求",
  newRequest: "申请看房",
  ownerNote: "感兴趣的人可以在此申请看房。之后您可以确认、建议其他时间或拒绝。",
  closed: "房源暂停时无法新建请求。现有请求仍可管理。",
  blocked:
    "此对话已被屏蔽，无法新建请求、提议或确认；符合条件的请求仍可拒绝或取消。",
  oneActive: "已有一个有效的看房请求。请先管理或取消它，再申请另一次看房。",
  elapsed: "此时间已过。这并不表示看房已经进行。",
  confirmedNote: "如需更改已确认的时间，请取消此请求并新建请求。",
  newHeading: "申请时间",
  proposeHeading: "建议其他时间",
  confirmHeading: "确认此时间",
  acceptHeading: "接受替代时间",
  declineHeading: "拒绝此请求",
  cancelHeading: "取消此看房请求",
  startsAt: "罗安达日期和时间",
  duration: "时长",
  minutes: "分钟",
  note: "备注（可选）",
  noteHint: "最多1000个字符，对此对话双方可见。",
  timeHint: "请选择未来180天内的时间。系统不会推荐或保证可用时段。",
  propose: "建议其他时间",
  confirm: "确认时间",
  accept: "接受替代时间",
  decline: "拒绝请求",
  cancel: "取消请求",
  saveRequest: "发送看房请求",
  saveProposal: "发送替代时间",
  saveConfirm: "确认此次看房",
  saveAccept: "接受此时间",
  saveDecline: "是，拒绝请求",
  saveCancel: "是，取消请求",
  confirmNotice: "双方将看到此时间已确认。这不会创建租约、付款或出席记录。",
  declineNotice: "请求将以已拒绝状态关闭，历史记录仍可查看。",
  cancelNotice:
    "请求将以已取消状态关闭。这不会取消租约、发起退款或删除历史记录。",
  closeEditor: "关闭编辑器并保留草稿",
  resume: "继续草稿",
  draft: "未保存的看房草稿",
  discardPrompt: "替换此未保存的看房草稿？其他对话的草稿不会改变。",
  reloadPrompt: "加载最新请求并放弃此草稿？已保存的历史记录不会改变。",
  keep: "保留草稿",
  discard: "放弃并继续",
  reload: "加载最新请求",
  history: "已保存的历史记录",
  historyEmpty: "暂无历史记录。",
  before: "变更前",
  after: "变更后",
  requested: "已申请",
  proposed: "已提出替代时间",
  confirmed: "已确认",
  declined: "已拒绝",
  cancelled: "已取消",
  created: "请求已创建",
  accepted: "替代时间已接受",
  updated: "已更新",
  saved: "看房请求已保存。",
  unknown: "结果尚不确定。请重试完全相同的操作以避免重复提交。您的草稿已保留。",
  retry: "重试相同操作",
  conflict:
    "此请求已在其他地方更改。您的草稿已保留。请先查看最新版本再重新提交。",
  unavailable: "您的账户已无法访问此看房请求或对话。",
  failed: "无法完成请求。未保存的草稿已保留，请尝试刷新。",
  session: "您的会话已改变，请先刷新账户。",
  rate: "请求过多，请稍后重试。",
  limit: "本地测试已达到看房或历史记录上限。符合条件的请求仍可拒绝或取消。",
  validation:
    "请检查日期、时长及备注。时长必须为15至180分钟，且为15分钟的倍数。",
  invalidTime: "请选择罗安达未来180天内的有效时间。",
  activeExists: "此对话已有另一个有效看房请求，请刷新查看。",
  slotConflict:
    "此时间与该房产已确认的看房重叠。请选择其他时间；不会显示其他预约。",
  invalidState: "当前请求已无法执行此操作，请刷新查看状态。",
  mutationConflict:
    "此操作标识已用于不同资料。请先刷新再开始新操作；您的草稿已保留。",
};

const withEnglish = (copy: Copy): Copy =>
  Object.fromEntries(
    Object.entries(copy).map(([key, value]) => [
      key,
      `${value} (${en[key as keyof Copy]})`,
    ]),
  ) as Copy;

export const conversationViewingsTranslations: Record<LanguageCode, Copy> = {
  pt,
  en,
  es,
  fr,
  ar: withEnglish(ar),
  zh: withEnglish(zh),
};

export function conversationViewingsCopy(language: LanguageCode) {
  return conversationViewingsTranslations[language];
}
