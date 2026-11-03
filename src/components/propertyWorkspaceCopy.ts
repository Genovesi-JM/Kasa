import type { LanguageCode } from "../i18n";

const en = {
  title: "Your property workspace",
  setup: "Account and portfolios",
  intro:
    "Private properties, invited tenants and maintenance — linked to your own account.",
  localNote:
    "Local testing only. Use invented names and addresses. These records are not published listings, tenancy agreements or proof of ownership.",
  identity: "Your account ID",
  identityNote:
    "Share this ID with the owner of a test property to receive a targeted invitation. No email or phone is shown here.",
  copy: "Copy",
  copied: "Copied.",
  copyFailed: "Copy was not available. Select the text and copy it manually.",
  refresh: "Refresh records",
  loading: "Loading records…",
  working: "Saving…",
  empty: "No property workspaces yet",
  emptyNote:
    "Create a private portfolio as an owner, or accept an invitation as a tenant. Each option grants only its own access.",
  createPortfolio: "Create a portfolio",
  portfolioName: "Portfolio name",
  portfolioCreated: "Your private portfolio was created.",
  selectWorkspace: "Workspace",
  owner: "Owner",
  tenant: "Tenant",
  properties: "Properties",
  noProperties: "This portfolio has no properties yet.",
  propertyName: "Property name",
  address: "Address",
  addProperty: "Add a private property",
  propertyCreated: "The private property was saved.",
  editProperty: "Edit property details",
  save: "Save changes",
  cancel: "Cancel",
  propertySaved: "Property details were saved.",
  propertyConflict:
    "This property changed. Your edits are preserved. Reload the latest details before saving again.",
  reload: "Discard edits and reload latest",
  join: "Accept an invitation",
  invitationCode: "Invitation code",
  accept: "Join the property",
  joined: "Invitation accepted. Your property access is now available.",
  joinNote:
    "Use the code shared by the owner. It works only for the account they invited, expires after 24 hours and can be used once.",
  access: "Tenant access",
  invite: "Invite an existing account",
  targetAccount: "Tenant account ID",
  inviteNote:
    "The tenant must first create their own local account and share its ID. This invites access to this property only; it does not sign a tenancy agreement.",
  sendInvitation: "Create invitation code",
  inviteCreated:
    "Invitation created. Share the code manually with the intended tenant.",
  codeOnce:
    "Copy this code now. It is only displayed when created and is not sent by email.",
  expires: "Expires",
  pending: "Pending",
  accepted: "Accepted",
  revoked: "Revoked",
  expired: "Expired",
  invitations: "Invitations",
  noInvitations: "No invitations for this property.",
  tenants: "People with tenant access",
  noTenants: "No tenant has accepted an invitation yet.",
  revoke: "Revoke invitation",
  revokedSuccess: "The invitation was revoked.",
  revokeConfirm: "Revoke this invitation? Its code will no longer work.",
  remove: "Remove access",
  removedSuccess:
    "Tenant access was removed. The owner retains the maintenance history.",
  removeConfirm:
    "Remove this tenant’s property access and pending invitations? Their maintenance history remains available to the owner.",
  maintenance: "Maintenance requests",
  ownerRequestsNote:
    "You can see all requests for this property, comment and update their status.",
  tenantRequestsNote:
    "Only your own requests are visible here. You can comment; the owner manages their status.",
  noRequests: "No maintenance requests yet.",
  newRequest: "Report an issue",
  requestTitle: "Issue title",
  description: "Description",
  priority: "Priority",
  normal: "Normal",
  urgent: "Urgent",
  emergency:
    "Not an emergency service. If there is immediate danger, contact the appropriate emergency service directly.",
  createRequest: "Submit request",
  requestCreated: "Your maintenance request was saved.",
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  status: "Status",
  history: "Activity history",
  created: "Request created",
  status_changed: "Status updated",
  comment: "Comment",
  message: "Add a comment",
  sendUpdate: "Save update",
  updated: "The request was updated.",
  updateConflict:
    "Someone updated this request. Your draft is still here. Reload the latest request before submitting again.",
  discardConfirm:
    "Discard your unsaved changes and switch property or request?",
  validation:
    "Check the required fields and their length. A comment or status change is needed to update a request.",
  unavailable:
    "The service could not be reached. Your draft is preserved. Try refreshing.",
  forbidden:
    "You no longer have access to this record. Refresh your workspaces.",
  invitationUnavailable:
    "This invitation is invalid, expired, revoked, already used or belongs to another account. Ask the owner for a new targeted invitation.",
  accountMissing:
    "That account could not be found or cannot be invited. Check the tenant’s account ID.",
  tooMany: "Too many attempts. Wait a few minutes and try again.",
  limitReached:
    "This local test reached its record limit. Refreshing will not increase the limit; no additional record was added.",
  error:
    "The action could not be completed. Refresh the records and try again.",
  uncertain:
    "We could not confirm the result. Refresh records before repeating the action. A newly created invitation code cannot be retrieved; revoke that pending invitation before creating another.",
  sessionChanged:
    "Your session changed. Refresh your account before continuing.",
};
type Copy = Record<keyof typeof en, string>;

export const propertyWorkspaceTranslations: Record<LanguageCode, Copy> = {
  en,
  pt: {
    title: "A sua área de imóveis",
    setup: "Conta e carteiras",
    intro:
      "Imóveis privados, inquilinos convidados e manutenção — ligados à sua própria conta.",
    localNote:
      "Apenas para teste local. Use nomes e moradas inventados. Estes registos não são anúncios publicados, contratos de arrendamento nem prova de propriedade.",
    identity: "ID da sua conta",
    identityNote:
      "Partilhe este ID com o proprietário de um imóvel de teste para receber um convite dirigido à sua conta. Não é apresentado email nem telefone.",
    copy: "Copiar",
    copied: "Copiado.",
    copyFailed:
      "Não foi possível copiar. Selecione o texto e copie-o manualmente.",
    refresh: "Atualizar registos",
    loading: "A carregar registos…",
    working: "A guardar…",
    empty: "Ainda não tem áreas de imóveis",
    emptyNote:
      "Crie uma carteira privada como proprietário ou aceite um convite como inquilino. Cada opção atribui apenas o respetivo acesso.",
    createPortfolio: "Criar carteira",
    portfolioName: "Nome da carteira",
    portfolioCreated: "A sua carteira privada foi criada.",
    selectWorkspace: "Área de trabalho",
    owner: "Proprietário",
    tenant: "Inquilino",
    properties: "Imóveis",
    noProperties: "Esta carteira ainda não tem imóveis.",
    propertyName: "Nome do imóvel",
    address: "Morada",
    addProperty: "Adicionar imóvel privado",
    propertyCreated: "O imóvel privado foi guardado.",
    editProperty: "Editar dados do imóvel",
    save: "Guardar alterações",
    cancel: "Cancelar",
    propertySaved: "Os dados do imóvel foram guardados.",
    propertyConflict:
      "Este imóvel foi alterado. As suas alterações estão preservadas. Carregue os dados mais recentes antes de guardar novamente.",
    reload: "Descartar alterações e carregar versão mais recente",
    join: "Aceitar convite",
    invitationCode: "Código do convite",
    accept: "Entrar no imóvel",
    joined: "Convite aceite. Já tem acesso ao imóvel.",
    joinNote:
      "Use o código partilhado pelo proprietário. Funciona apenas na conta convidada, expira em 24 horas e pode ser usado uma única vez.",
    access: "Acesso dos inquilinos",
    invite: "Convidar uma conta existente",
    targetAccount: "ID da conta do inquilino",
    inviteNote:
      "O inquilino deve primeiro criar a sua conta local e partilhar o ID. Este convite dá acesso apenas a este imóvel; não assina um contrato de arrendamento.",
    sendInvitation: "Criar código de convite",
    inviteCreated:
      "Convite criado. Partilhe o código manualmente com o inquilino pretendido.",
    codeOnce:
      "Copie este código agora. Só é apresentado ao criar o convite e não é enviado por email.",
    expires: "Expira",
    pending: "Pendente",
    accepted: "Aceite",
    revoked: "Revogado",
    expired: "Expirado",
    invitations: "Convites",
    noInvitations: "Este imóvel não tem convites.",
    tenants: "Pessoas com acesso de inquilino",
    noTenants: "Ainda nenhum inquilino aceitou um convite.",
    revoke: "Revogar convite",
    revokedSuccess: "O convite foi revogado.",
    revokeConfirm: "Revogar este convite? O código deixará de funcionar.",
    remove: "Remover acesso",
    removedSuccess:
      "O acesso do inquilino foi removido. O proprietário mantém o histórico de manutenção.",
    removeConfirm:
      "Remover o acesso deste inquilino e os seus convites pendentes? O histórico de manutenção continuará disponível ao proprietário.",
    maintenance: "Pedidos de manutenção",
    ownerRequestsNote:
      "Pode consultar todos os pedidos deste imóvel, comentar e atualizar o estado.",
    tenantRequestsNote:
      "Aqui vê apenas os seus próprios pedidos. Pode comentar; o proprietário gere o estado.",
    noRequests: "Ainda não existem pedidos de manutenção.",
    newRequest: "Comunicar um problema",
    requestTitle: "Título do problema",
    description: "Descrição",
    priority: "Prioridade",
    normal: "Normal",
    urgent: "Urgente",
    emergency:
      "Não é um serviço de emergência. Se existir perigo imediato, contacte diretamente o serviço de emergência adequado.",
    createRequest: "Enviar pedido",
    requestCreated: "O seu pedido de manutenção foi guardado.",
    open: "Aberto",
    in_progress: "Em curso",
    resolved: "Resolvido",
    status: "Estado",
    history: "Histórico de atividade",
    created: "Pedido criado",
    status_changed: "Estado atualizado",
    comment: "Comentário",
    message: "Adicionar comentário",
    sendUpdate: "Guardar atualização",
    updated: "O pedido foi atualizado.",
    updateConflict:
      "Alguém atualizou este pedido. O seu rascunho continua aqui. Carregue a versão mais recente antes de voltar a enviar.",
    discardConfirm:
      "Descartar alterações por guardar e mudar de imóvel ou pedido?",
    validation:
      "Verifique os campos obrigatórios e o seu tamanho. É necessário um comentário ou mudança de estado para atualizar um pedido.",
    unavailable:
      "Não foi possível contactar o serviço. O rascunho está preservado. Tente atualizar.",
    forbidden:
      "Já não tem acesso a este registo. Atualize as suas áreas de trabalho.",
    invitationUnavailable:
      "Este convite é inválido, expirou, foi revogado, já foi usado ou pertence a outra conta. Peça um novo convite dirigido à sua conta.",
    accountMissing:
      "A conta não foi encontrada ou não pode ser convidada. Verifique o ID da conta do inquilino.",
    tooMany: "Demasiadas tentativas. Aguarde alguns minutos e tente novamente.",
    limitReached:
      "Este teste local atingiu o limite de registos. Atualizar não aumenta o limite; não foi adicionado nenhum registo extra.",
    error:
      "Não foi possível concluir a ação. Atualize os registos e tente novamente.",
    uncertain:
      "Não foi possível confirmar o resultado. Atualize os registos antes de repetir. Não é possível recuperar um código recém-criado; revogue esse convite pendente antes de criar outro.",
    sessionChanged: "A sua sessão mudou. Atualize a conta antes de continuar.",
  },
  es: {
    title: "Tu área de inmuebles",
    setup: "Cuenta y carteras",
    intro:
      "Inmuebles privados, inquilinos invitados y mantenimiento vinculados a tu propia cuenta.",
    localNote:
      "Solo para pruebas locales. Usa nombres y direcciones inventados. Estos registros no son anuncios publicados, contratos de alquiler ni pruebas de propiedad.",
    identity: "ID de tu cuenta",
    identityNote:
      "Comparte este ID con el propietario de un inmueble de prueba para recibir una invitación dirigida a tu cuenta. No se muestra correo ni teléfono.",
    copy: "Copiar",
    copied: "Copiado.",
    copyFailed: "No se pudo copiar. Selecciona el texto y cópialo manualmente.",
    refresh: "Actualizar registros",
    loading: "Cargando registros…",
    working: "Guardando…",
    empty: "Todavía no tienes áreas de inmuebles",
    emptyNote:
      "Crea una cartera privada como propietario o acepta una invitación como inquilino. Cada opción concede solo su propio acceso.",
    createPortfolio: "Crear cartera",
    portfolioName: "Nombre de la cartera",
    portfolioCreated: "Tu cartera privada se ha creado.",
    selectWorkspace: "Área de trabajo",
    owner: "Propietario",
    tenant: "Inquilino",
    properties: "Inmuebles",
    noProperties: "Esta cartera todavía no tiene inmuebles.",
    propertyName: "Nombre del inmueble",
    address: "Dirección",
    addProperty: "Añadir inmueble privado",
    propertyCreated: "El inmueble privado se ha guardado.",
    editProperty: "Editar datos del inmueble",
    save: "Guardar cambios",
    cancel: "Cancelar",
    propertySaved: "Los datos del inmueble se han guardado.",
    propertyConflict:
      "Este inmueble cambió. Tus cambios se conservan. Recarga los datos más recientes antes de guardar.",
    reload: "Descartar cambios y cargar la última versión",
    join: "Aceptar invitación",
    invitationCode: "Código de invitación",
    accept: "Acceder al inmueble",
    joined: "Invitación aceptada. Ya tienes acceso al inmueble.",
    joinNote:
      "Usa el código compartido por el propietario. Solo funciona para la cuenta invitada, caduca en 24 horas y solo se puede usar una vez.",
    access: "Acceso de inquilinos",
    invite: "Invitar una cuenta existente",
    targetAccount: "ID de cuenta del inquilino",
    inviteNote:
      "El inquilino debe crear su propia cuenta local y compartir su ID. La invitación permite acceder solo a este inmueble; no firma un contrato de alquiler.",
    sendInvitation: "Crear código de invitación",
    inviteCreated:
      "Invitación creada. Comparte manualmente el código con el inquilino previsto.",
    codeOnce:
      "Copia el código ahora. Solo se muestra al crearlo y no se envía por correo.",
    expires: "Caduca",
    pending: "Pendiente",
    accepted: "Aceptada",
    revoked: "Revocada",
    expired: "Caducada",
    invitations: "Invitaciones",
    noInvitations: "No hay invitaciones para este inmueble.",
    tenants: "Personas con acceso de inquilino",
    noTenants: "Ningún inquilino ha aceptado todavía una invitación.",
    revoke: "Revocar invitación",
    revokedSuccess: "La invitación se ha revocado.",
    revokeConfirm: "¿Revocar esta invitación? El código dejará de funcionar.",
    remove: "Eliminar acceso",
    removedSuccess:
      "Se ha eliminado el acceso del inquilino. El propietario conserva el historial de mantenimiento.",
    removeConfirm:
      "¿Eliminar el acceso de este inquilino y sus invitaciones pendientes? El propietario conservará el historial de mantenimiento.",
    maintenance: "Solicitudes de mantenimiento",
    ownerRequestsNote:
      "Puedes consultar todas las solicitudes de este inmueble, comentar y actualizar su estado.",
    tenantRequestsNote:
      "Solo puedes ver tus propias solicitudes. Puedes comentar; el propietario gestiona el estado.",
    noRequests: "Todavía no hay solicitudes de mantenimiento.",
    newRequest: "Comunicar un problema",
    requestTitle: "Título del problema",
    description: "Descripción",
    priority: "Prioridad",
    normal: "Normal",
    urgent: "Urgente",
    emergency:
      "No es un servicio de emergencias. Ante un peligro inmediato, contacta directamente con el servicio de emergencias correspondiente.",
    createRequest: "Enviar solicitud",
    requestCreated: "Tu solicitud de mantenimiento se ha guardado.",
    open: "Abierta",
    in_progress: "En curso",
    resolved: "Resuelta",
    status: "Estado",
    history: "Historial de actividad",
    created: "Solicitud creada",
    status_changed: "Estado actualizado",
    comment: "Comentario",
    message: "Añadir comentario",
    sendUpdate: "Guardar actualización",
    updated: "La solicitud se ha actualizado.",
    updateConflict:
      "Alguien actualizó esta solicitud. Tu borrador se conserva. Recarga la última versión antes de volver a enviarlo.",
    discardConfirm:
      "¿Descartar los cambios sin guardar y cambiar de inmueble o solicitud?",
    validation:
      "Revisa los campos obligatorios y su longitud. Para actualizar una solicitud hace falta un comentario o cambio de estado.",
    unavailable:
      "No se pudo contactar con el servicio. Tu borrador se conserva. Prueba a actualizar.",
    forbidden:
      "Ya no tienes acceso a este registro. Actualiza tus áreas de trabajo.",
    invitationUnavailable:
      "La invitación es inválida, ha caducado, fue revocada, ya se usó o pertenece a otra cuenta. Pide una nueva invitación dirigida a tu cuenta.",
    accountMissing:
      "No se encontró esa cuenta o no puede invitarse. Comprueba el ID del inquilino.",
    tooMany: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.",
    limitReached:
      "Esta prueba local alcanzó su límite de registros. Actualizar no aumenta el límite; no se añadió ningún registro adicional.",
    error:
      "No se pudo completar la acción. Actualiza los registros e inténtalo de nuevo.",
    uncertain:
      "No se pudo confirmar el resultado. Actualiza los registros antes de repetir. El código recién creado no se puede recuperar: revoca esa invitación pendiente antes de crear otra.",
    sessionChanged: "Tu sesión cambió. Actualiza tu cuenta antes de continuar.",
  },
  fr: {
    title: "Votre espace immobilier",
    setup: "Compte et portefeuilles",
    intro:
      "Biens privés, locataires invités et maintenance liés à votre propre compte.",
    localNote:
      "Tests locaux uniquement. Utilisez des noms et adresses fictifs. Ces données ne sont ni des annonces publiées, ni des baux, ni des preuves de propriété.",
    identity: "Identifiant de votre compte",
    identityNote:
      "Partagez cet identifiant avec le propriétaire d’un bien de test pour recevoir une invitation ciblée. Aucun email ni téléphone n’est affiché ici.",
    copy: "Copier",
    copied: "Copié.",
    copyFailed:
      "Copie indisponible. Sélectionnez le texte et copiez-le manuellement.",
    refresh: "Actualiser les données",
    loading: "Chargement des données…",
    working: "Enregistrement…",
    empty: "Aucun espace immobilier pour le moment",
    emptyNote:
      "Créez un portefeuille privé comme propriétaire ou acceptez une invitation comme locataire. Chaque option accorde uniquement ses propres accès.",
    createPortfolio: "Créer un portefeuille",
    portfolioName: "Nom du portefeuille",
    portfolioCreated: "Votre portefeuille privé a été créé.",
    selectWorkspace: "Espace de travail",
    owner: "Propriétaire",
    tenant: "Locataire",
    properties: "Biens",
    noProperties: "Ce portefeuille ne contient pas encore de biens.",
    propertyName: "Nom du bien",
    address: "Adresse",
    addProperty: "Ajouter un bien privé",
    propertyCreated: "Le bien privé a été enregistré.",
    editProperty: "Modifier les données du bien",
    save: "Enregistrer",
    cancel: "Annuler",
    propertySaved: "Les données du bien ont été enregistrées.",
    propertyConflict:
      "Ce bien a changé. Vos modifications sont conservées. Rechargez les dernières données avant d’enregistrer.",
    reload: "Abandonner les modifications et recharger",
    join: "Accepter une invitation",
    invitationCode: "Code d’invitation",
    accept: "Accéder au bien",
    joined: "Invitation acceptée. Vous avez maintenant accès au bien.",
    joinNote:
      "Utilisez le code partagé par le propriétaire. Il fonctionne uniquement pour le compte invité, expire après 24 heures et ne sert qu’une fois.",
    access: "Accès des locataires",
    invite: "Inviter un compte existant",
    targetAccount: "Identifiant du compte du locataire",
    inviteNote:
      "Le locataire doit créer son compte local et partager son identifiant. L’invitation donne accès à ce bien uniquement ; elle ne signe aucun bail.",
    sendInvitation: "Créer un code d’invitation",
    inviteCreated:
      "Invitation créée. Partagez manuellement le code avec le locataire concerné.",
    codeOnce:
      "Copiez ce code maintenant. Il apparaît uniquement à sa création et n’est pas envoyé par email.",
    expires: "Expire le",
    pending: "En attente",
    accepted: "Acceptée",
    revoked: "Révoquée",
    expired: "Expirée",
    invitations: "Invitations",
    noInvitations: "Aucune invitation pour ce bien.",
    tenants: "Personnes ayant un accès locataire",
    noTenants: "Aucun locataire n’a encore accepté d’invitation.",
    revoke: "Révoquer l’invitation",
    revokedSuccess: "L’invitation a été révoquée.",
    revokeConfirm: "Révoquer cette invitation ? Son code ne fonctionnera plus.",
    remove: "Retirer l’accès",
    removedSuccess:
      "L’accès du locataire a été retiré. Le propriétaire conserve l’historique de maintenance.",
    removeConfirm:
      "Retirer l’accès de ce locataire et ses invitations en attente ? L’historique de maintenance restera accessible au propriétaire.",
    maintenance: "Demandes de maintenance",
    ownerRequestsNote:
      "Vous pouvez consulter toutes les demandes de ce bien, commenter et changer leur statut.",
    tenantRequestsNote:
      "Seules vos propres demandes sont visibles. Vous pouvez commenter ; le propriétaire gère leur statut.",
    noRequests: "Aucune demande de maintenance pour le moment.",
    newRequest: "Signaler un problème",
    requestTitle: "Titre du problème",
    description: "Description",
    priority: "Priorité",
    normal: "Normale",
    urgent: "Urgente",
    emergency:
      "Ce n’est pas un service d’urgence. En cas de danger immédiat, contactez directement les secours appropriés.",
    createRequest: "Envoyer la demande",
    requestCreated: "Votre demande de maintenance a été enregistrée.",
    open: "Ouverte",
    in_progress: "En cours",
    resolved: "Résolue",
    status: "Statut",
    history: "Historique d’activité",
    created: "Demande créée",
    status_changed: "Statut modifié",
    comment: "Commentaire",
    message: "Ajouter un commentaire",
    sendUpdate: "Enregistrer la mise à jour",
    updated: "La demande a été mise à jour.",
    updateConflict:
      "Cette demande a été modifiée. Votre brouillon est conservé. Rechargez la dernière version avant de renvoyer.",
    discardConfirm:
      "Abandonner vos modifications et changer de bien ou de demande ?",
    validation:
      "Vérifiez les champs obligatoires et leur longueur. Un commentaire ou changement de statut est nécessaire.",
    unavailable:
      "Impossible de joindre le service. Votre brouillon est conservé. Essayez d’actualiser.",
    forbidden:
      "Vous n’avez plus accès à cette donnée. Actualisez vos espaces de travail.",
    invitationUnavailable:
      "Cette invitation est invalide, expirée, révoquée, déjà utilisée ou destinée à un autre compte. Demandez une nouvelle invitation ciblée.",
    accountMissing:
      "Ce compte est introuvable ou ne peut pas être invité. Vérifiez l’identifiant du locataire.",
    tooMany: "Trop de tentatives. Attendez quelques minutes et réessayez.",
    limitReached:
      "Ce test local a atteint sa limite de données. Actualiser ne relève pas cette limite ; aucune donnée supplémentaire n’a été ajoutée.",
    error:
      "Impossible de terminer l’action. Actualisez les données et réessayez.",
    uncertain:
      "Résultat non confirmé. Actualisez avant de répéter. Un code nouvellement créé ne peut pas être récupéré : révoquez cette invitation en attente avant d’en créer une autre.",
    sessionChanged:
      "Votre session a changé. Actualisez votre compte avant de continuer.",
  },
  ar: {
    title: "مساحة عقاراتك",
    setup: "الحساب والمحافظ",
    intro: "عقارات خاصة ومستأجرون مدعوون وصيانة مرتبطة بحسابك الخاص.",
    localNote:
      "للاختبار المحلي فقط. استخدم أسماء وعناوين وهمية. هذه السجلات ليست إعلانات منشورة أو عقود إيجار أو إثبات ملكية.",
    identity: "معرّف حسابك",
    identityNote:
      "شارك هذا المعرّف مع مالك عقار تجريبي لتلقي دعوة موجهة لحسابك. لا يظهر بريد إلكتروني أو رقم هاتف هنا.",
    copy: "نسخ",
    copied: "تم النسخ.",
    copyFailed: "تعذر النسخ. حدد النص وانسخه يدويًا.",
    refresh: "تحديث السجلات",
    loading: "جارٍ تحميل السجلات…",
    working: "جارٍ الحفظ…",
    empty: "لا توجد مساحات عقارية بعد",
    emptyNote:
      "أنشئ محفظة خاصة كمالك أو اقبل دعوة كمستأجر. يمنح كل خيار صلاحياته فقط.",
    createPortfolio: "إنشاء محفظة",
    portfolioName: "اسم المحفظة",
    portfolioCreated: "تم إنشاء محفظتك الخاصة.",
    selectWorkspace: "مساحة العمل",
    owner: "مالك",
    tenant: "مستأجر",
    properties: "العقارات",
    noProperties: "لا توجد عقارات في هذه المحفظة بعد.",
    propertyName: "اسم العقار",
    address: "العنوان",
    addProperty: "إضافة عقار خاص",
    propertyCreated: "تم حفظ العقار الخاص.",
    editProperty: "تعديل بيانات العقار",
    save: "حفظ التغييرات",
    cancel: "إلغاء",
    propertySaved: "تم حفظ بيانات العقار.",
    propertyConflict:
      "تغير هذا العقار. تعديلاتك محفوظة. حمّل أحدث البيانات قبل الحفظ مجددًا.",
    reload: "تجاهل التعديلات وتحميل أحدث نسخة",
    join: "قبول دعوة",
    invitationCode: "رمز الدعوة",
    accept: "الانضمام إلى العقار",
    joined: "تم قبول الدعوة وأصبح الوصول متاحًا.",
    joinNote:
      "استخدم الرمز الذي شاركه المالك. يعمل للحساب المدعو فقط وتنتهي صلاحيته بعد 24 ساعة ويُستخدم مرة واحدة.",
    access: "وصول المستأجرين",
    invite: "دعوة حساب موجود",
    targetAccount: "معرّف حساب المستأجر",
    inviteNote:
      "يجب أن ينشئ المستأجر حسابه المحلي أولًا ويشارك معرّفه. تمنح الدعوة الوصول لهذا العقار فقط ولا توقّع عقد إيجار.",
    sendInvitation: "إنشاء رمز الدعوة",
    inviteCreated: "تم إنشاء الدعوة. شارك الرمز يدويًا مع المستأجر المقصود.",
    codeOnce: "انسخ الرمز الآن. يظهر عند الإنشاء فقط ولا يُرسل بالبريد.",
    expires: "تنتهي الصلاحية",
    pending: "معلّقة",
    accepted: "مقبولة",
    revoked: "ملغاة",
    expired: "منتهية",
    invitations: "الدعوات",
    noInvitations: "لا توجد دعوات لهذا العقار.",
    tenants: "أشخاص لديهم وصول كمستأجرين",
    noTenants: "لم يقبل أي مستأجر دعوة بعد.",
    revoke: "إلغاء الدعوة",
    revokedSuccess: "تم إلغاء الدعوة.",
    revokeConfirm: "هل تريد إلغاء هذه الدعوة؟ لن يعمل الرمز بعد ذلك.",
    remove: "إزالة الوصول",
    removedSuccess: "تمت إزالة وصول المستأجر. يحتفظ المالك بسجل الصيانة.",
    removeConfirm:
      "هل تريد إزالة وصول المستأجر ودعواته المعلقة؟ سيبقى سجل الصيانة متاحًا للمالك.",
    maintenance: "طلبات الصيانة",
    ownerRequestsNote: "يمكنك عرض جميع طلبات العقار والتعليق وتحديث الحالة.",
    tenantRequestsNote:
      "تظهر طلباتك فقط. يمكنك التعليق، ويتولى المالك إدارة الحالة.",
    noRequests: "لا توجد طلبات صيانة بعد.",
    newRequest: "الإبلاغ عن مشكلة",
    requestTitle: "عنوان المشكلة",
    description: "الوصف",
    priority: "الأولوية",
    normal: "عادية",
    urgent: "عاجلة",
    emergency:
      "ليست خدمة طوارئ. عند وجود خطر فوري تواصل مباشرة مع جهة الطوارئ المناسبة.",
    createRequest: "إرسال الطلب",
    requestCreated: "تم حفظ طلب الصيانة.",
    open: "مفتوح",
    in_progress: "قيد التنفيذ",
    resolved: "تم الحل",
    status: "الحالة",
    history: "سجل النشاط",
    created: "تم إنشاء الطلب",
    status_changed: "تم تحديث الحالة",
    comment: "تعليق",
    message: "إضافة تعليق",
    sendUpdate: "حفظ التحديث",
    updated: "تم تحديث الطلب.",
    updateConflict:
      "حدّث شخص آخر هذا الطلب. مسودتك محفوظة. حمّل أحدث نسخة قبل الإرسال مجددًا.",
    discardConfirm:
      "هل تريد تجاهل التغييرات غير المحفوظة وتبديل العقار أو الطلب؟",
    validation:
      "تحقق من الحقول المطلوبة وطول النص. يلزم تعليق أو تغيير حالة لتحديث الطلب.",
    unavailable: "تعذر الوصول إلى الخدمة. مسودتك محفوظة. حاول التحديث.",
    forbidden: "لم يعد لديك وصول لهذا السجل. حدّث مساحات العمل.",
    invitationUnavailable:
      "الدعوة غير صالحة أو منتهية أو ملغاة أو مستخدمة أو تخص حسابًا آخر. اطلب دعوة جديدة موجهة لحسابك.",
    accountMissing:
      "تعذر العثور على الحساب أو لا يمكن دعوته. تحقق من معرّف حساب المستأجر.",
    tooMany: "محاولات كثيرة. انتظر بضع دقائق وحاول مجددًا.",
    limitReached:
      "وصل الاختبار المحلي إلى حد السجلات. التحديث لا يزيد الحد ولم يُضف سجل آخر.",
    error: "تعذر إكمال العملية. حدّث السجلات وحاول مجددًا.",
    uncertain:
      "تعذر تأكيد النتيجة. حدّث السجلات قبل التكرار. لا يمكن استرجاع رمز أُنشئ حديثًا؛ ألغِ الدعوة المعلقة قبل إنشاء أخرى.",
    sessionChanged: "تغيّرت جلستك. حدّث حسابك قبل المتابعة.",
  },
  zh: {
    title: "你的房产工作区",
    setup: "账户和房产组合",
    intro: "私人房产、受邀租客和维修记录均关联到你自己的账户。",
    localNote:
      "仅用于本地测试。请使用虚构姓名和地址。这些记录不是公开房源、租赁合同或所有权证明。",
    identity: "你的账户 ID",
    identityNote:
      "将此 ID 提供给测试房产的业主，以接收定向邀请。此处不显示邮箱或电话。",
    copy: "复制",
    copied: "已复制。",
    copyFailed: "无法复制，请选择文字后手动复制。",
    refresh: "刷新记录",
    loading: "正在加载记录…",
    working: "正在保存…",
    empty: "尚无房产工作区",
    emptyNote:
      "以业主身份创建私人房产组合，或以租客身份接受邀请。每个选项仅授予对应访问权。",
    createPortfolio: "创建房产组合",
    portfolioName: "房产组合名称",
    portfolioCreated: "私人房产组合已创建。",
    selectWorkspace: "工作区",
    owner: "业主",
    tenant: "租客",
    properties: "房产",
    noProperties: "此组合尚无房产。",
    propertyName: "房产名称",
    address: "地址",
    addProperty: "添加私人房产",
    propertyCreated: "私人房产已保存。",
    editProperty: "编辑房产资料",
    save: "保存更改",
    cancel: "取消",
    propertySaved: "房产资料已保存。",
    propertyConflict: "此房产已更改。你的编辑仍保留，请加载最新资料后再保存。",
    reload: "放弃编辑并加载最新版本",
    join: "接受邀请",
    invitationCode: "邀请码",
    accept: "加入房产",
    joined: "邀请已接受，你现在可以访问此房产。",
    joinNote:
      "使用业主分享的代码。仅受邀账户可使用，24 小时后过期，且只能使用一次。",
    access: "租客访问权",
    invite: "邀请现有账户",
    targetAccount: "租客账户 ID",
    inviteNote:
      "租客须先创建本地账户并提供 ID。邀请仅授予此房产的访问权，不会签订租赁合同。",
    sendInvitation: "生成邀请码",
    inviteCreated: "邀请已创建，请手动将代码分享给指定租客。",
    codeOnce: "请立即复制代码，仅在创建时显示，不会通过邮件发送。",
    expires: "到期时间",
    pending: "待接受",
    accepted: "已接受",
    revoked: "已撤销",
    expired: "已过期",
    invitations: "邀请",
    noInvitations: "此房产没有邀请。",
    tenants: "拥有租客访问权的人员",
    noTenants: "尚无租客接受邀请。",
    revoke: "撤销邀请",
    revokedSuccess: "邀请已撤销。",
    revokeConfirm: "撤销此邀请吗？代码将不再有效。",
    remove: "移除访问权",
    removedSuccess: "租客访问权已移除。业主保留维修历史。",
    removeConfirm: "移除此租客的访问权及待接受邀请吗？维修历史仍对业主可见。",
    maintenance: "维修请求",
    ownerRequestsNote: "你可以查看此房产的所有请求、添加评论及更新状态。",
    tenantRequestsNote: "此处只显示你自己的请求。你可以评论，由业主管理状态。",
    noRequests: "尚无维修请求。",
    newRequest: "报告问题",
    requestTitle: "问题标题",
    description: "描述",
    priority: "优先级",
    normal: "普通",
    urgent: "紧急",
    emergency: "这不是紧急救援服务。如有即时危险，请直接联系相应紧急服务。",
    createRequest: "提交请求",
    requestCreated: "维修请求已保存。",
    open: "待处理",
    in_progress: "处理中",
    resolved: "已解决",
    status: "状态",
    history: "活动历史",
    created: "请求已创建",
    status_changed: "状态已更新",
    comment: "评论",
    message: "添加评论",
    sendUpdate: "保存更新",
    updated: "请求已更新。",
    updateConflict:
      "有人更新了此请求。你的草稿仍保留，请加载最新版本后再提交。",
    discardConfirm: "放弃未保存的更改并切换房产或请求吗？",
    validation: "请检查必填字段和文本长度。更新请求需要评论或状态变化。",
    unavailable: "无法连接服务。草稿已保留，请尝试刷新。",
    forbidden: "你已无法访问此记录，请刷新工作区。",
    invitationUnavailable:
      "邀请无效、已过期、已撤销、已使用或属于其他账户。请向业主申请新的定向邀请。",
    accountMissing: "找不到此账户或无法邀请，请检查租客账户 ID。",
    tooMany: "尝试过多，请稍等几分钟后重试。",
    limitReached: "本地测试已达到记录上限。刷新不会提高上限，也没有新增记录。",
    error: "无法完成操作，请刷新记录后重试。",
    uncertain:
      "无法确认结果。请先刷新再重试。新生成的代码无法再次获取，请先撤销该待接受邀请再创建新的邀请。",
    sessionChanged: "会话已改变，请刷新账户后继续。",
  },
};

export function propertyWorkspaceCopy(language: LanguageCode): Copy {
  const copy = propertyWorkspaceTranslations[language];
  if (language !== "ar" && language !== "zh") return copy;
  return Object.fromEntries(
    Object.entries(copy).map(([key, value]) => [
      key,
      `${value} (${en[key as keyof Copy]})`,
    ]),
  ) as Copy;
}
