import { useTranslation } from "react-i18next";

export function useSpaceListingCopy() {
  const { i18n } = useTranslation();
  const portuguese = (
    i18n.resolvedLanguage ??
    i18n.language ??
    "pt"
  ).startsWith("pt");
  const locale = portuguese ? "pt-PT" : "en-GB";
  const copy = (en: string, pt: string) => (portuguese ? pt : en);
  const date = (value: string, includeTime = false) => {
    const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    return Number.isFinite(parsed.getTime())
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
          ...(includeTime
            ? ({ hour: "2-digit", minute: "2-digit" } as const)
            : {}),
        }).format(parsed)
      : value;
  };
  const option = (value: string) =>
    (
      ({
        Sports: copy("Sports", "Desporto"),
        Events: copy("Events", "Eventos"),
        Owner: copy("Owner", "Proprietário"),
        Operator: copy("Operator", "Operador"),
        "Facility manager": copy(
          "Facility manager",
          "Responsável pelas instalações",
        ),
        "Authorised representative": copy(
          "Authorised representative",
          "Representante autorizado",
        ),
        hour: copy("Per hour", "Por hora"),
        session: copy("Per session", "Por sessão"),
        "half-day": copy("Per half-day", "Por meio dia"),
        event: copy("Per event", "Por evento"),
        Parking: copy("Parking", "Estacionamento"),
        "Wi-Fi": "Wi-Fi",
        Toilets: copy("Toilets", "Instalações sanitárias"),
        "Changing rooms": copy("Changing rooms", "Balneários"),
        Showers: copy("Showers", "Duches"),
        "Step-free access": copy("Step-free access", "Acesso sem degraus"),
        Lighting: copy("Lighting", "Iluminação"),
        "Air conditioning": copy("Air conditioning", "Ar condicionado"),
        Seating: copy("Seating", "Lugares sentados"),
        "Sound system": copy("Sound system", "Sistema de som"),
      }) as Record<string, string>
    )[value] ?? value;
  const fieldLabel = (field: string) =>
    (
      ({
        category: copy("Venue category", "Categoria do recinto"),
        name: copy("Venue name", "Nome do recinto"),
        country: copy("Country", "País"),
        city: copy("City", "Cidade"),
        neighbourhood: copy("Neighbourhood (optional)", "Bairro (opcional)"),
        address: copy("Venue address", "Morada do recinto"),
        relationship: copy(
          "Your relationship to the venue",
          "A sua relação com o recinto",
        ),
        description: copy("Venue description", "Descrição do recinto"),
        openingStart: copy(
          "Suggested opening time (optional)",
          "Hora de abertura sugerida (opcional)",
        ),
        openingEnd: copy(
          "Suggested closing time (optional)",
          "Hora de fecho sugerida (opcional)",
        ),
        hoursNote: copy(
          "Hours and scheduling notes (optional)",
          "Notas sobre horários e agendamento (opcional)",
        ),
        cancellationPolicy: copy(
          "Cancellation policy (optional)",
          "Política de cancelamento (opcional)",
        ),
        amenities: copy("Amenities (optional)", "Comodidades (opcional)"),
        photos: copy("Photos", "Fotografias"),
        units: copy("Reservable spaces", "Espaços reserváveis"),
      }) as Record<string, string>
    )[field] ?? field;
  const unitLabel = (field: string) =>
    (
      ({
        name: copy("Space name", "Nome do espaço"),
        activity: copy("Activity or use", "Atividade ou utilização"),
        capacity: copy("Capacity (people)", "Capacidade (pessoas)"),
        price: copy(
          "Listed price (€; optional)",
          "Preço indicado (€; opcional)",
        ),
        billingUnit: copy("Price applies to", "O preço aplica-se a"),
      }) as Record<string, string>
    )[field] ?? field;
  const stepNames = [
    copy("Venue details", "Dados do recinto"),
    copy("Spaces and terms", "Espaços e condições"),
    copy("Photos and amenities", "Fotografias e comodidades"),
    copy("Review", "Revisão"),
  ];
  const scope = copy(
    "Drafts and selected photos stay in this tab until reload. Marking ready records your review here; it does not publish the venue or verify your authority.",
    "Os rascunhos e as fotografias selecionadas ficam neste separador até recarregar. Marcar como pronto regista a sua revisão aqui; não publica o recinto nem verifica a sua autorização.",
  );
  const issueText = (issue: string, field?: string) => {
    const limits: Record<string, string> = {
      name: copy(
        "Use 3–120 characters for the venue name.",
        "Use 3 a 120 caracteres para o nome do recinto.",
      ),
      country: copy(
        "Use 2–80 characters for the country.",
        "Use 2 a 80 caracteres para o país.",
      ),
      city: copy(
        "Use 2–100 characters for the city.",
        "Use 2 a 100 caracteres para a cidade.",
      ),
      neighbourhood: copy(
        "Use at most 100 characters for the neighbourhood.",
        "Use até 100 caracteres para o bairro.",
      ),
      address: copy(
        "Use 5–240 characters for the address.",
        "Use 5 a 240 caracteres para a morada.",
      ),
      description: copy(
        "Describe the venue in 20–4,000 characters.",
        "Descreva o recinto em 20 a 4.000 caracteres.",
      ),
      hoursNote: copy(
        "Keep the hours notes within 1,000 characters.",
        "Escreva notas de horário com até 1.000 caracteres.",
      ),
      cancellationPolicy: copy(
        "Keep the cancellation policy within 2,000 characters.",
        "Escreva a política de cancelamento com até 2.000 caracteres.",
      ),
      "unit.name": copy(
        "Use 2–100 characters for the space name.",
        "Use 2 a 100 caracteres para o nome do espaço.",
      ),
      "unit.activity": copy(
        "Use 2–100 characters for the activity or use.",
        "Use 2 a 100 caracteres para a atividade ou utilização.",
      ),
      "unit.capacity": copy(
        "Enter a whole-number capacity from 1 to 100,000.",
        "Indique uma capacidade inteira entre 1 e 100.000.",
      ),
      "unit.price": copy(
        "Enter a price or leave both price and price unit empty.",
        "Indique um preço ou deixe vazios o preço e a respetiva unidade.",
      ),
      "unit.billingUnit": copy(
        "Choose the unit that the entered price applies to.",
        "Escolha a unidade a que se aplica o preço indicado.",
      ),
      units: copy(
        "Add at least one reservable space.",
        "Adicione pelo menos um espaço reservável.",
      ),
      openingStart: copy(
        "Enter a valid opening time or leave both times empty.",
        "Indique uma hora de abertura válida ou deixe ambas as horas vazias.",
      ),
      openingEnd: copy(
        "Enter a valid closing time or leave both times empty.",
        "Indique uma hora de fecho válida ou deixe ambas as horas vazias.",
      ),
    };
    if (
      ["required", "tooShort", "tooLong"].includes(issue) &&
      field &&
      limits[field]
    )
      return limits[field];
    return (
      (
        {
          required: copy(
            "Complete this required field.",
            "Preencha este campo obrigatório.",
          ),
          tooShort: copy(
            "Add more detail to this field.",
            "Acrescente mais detalhes a este campo.",
          ),
          tooLong: copy(
            "Shorten this value to the field’s limit.",
            "Reduza este valor ao limite do campo.",
          ),
          invalidCategory: copy(
            "Choose Sports or Events.",
            "Escolha Desporto ou Eventos.",
          ),
          invalidRelationship: copy(
            "Choose your relationship to the venue.",
            "Escolha a sua relação com o recinto.",
          ),
          invalidCapacity: limits["unit.capacity"],
          invalidPrice: copy(
            "Use a price from €0 to €1,000,000 with at most two decimal places and no thousands separators.",
            "Use um preço entre 0 € e 1.000.000 €, com até duas casas decimais e sem separadores de milhares.",
          ),
          invalidBillingUnit: copy(
            "Choose hour, session, half-day or event.",
            "Escolha hora, sessão, meio dia ou evento.",
          ),
          invalidTime: copy(
            "Use a valid time in hours and minutes.",
            "Use uma hora válida, em horas e minutos.",
          ),
          timeOrder: copy(
            "Closing must be later than opening on the same day.",
            "O fecho deve ser posterior à abertura, no mesmo dia.",
          ),
          unitLimit: copy(
            "Keep no more than 20 reservable spaces per venue.",
            "Mantenha até 20 espaços reserváveis por recinto.",
          ),
          invalidAmenities: copy(
            "Choose amenities from the available options.",
            "Escolha comodidades entre as opções disponíveis.",
          ),
          invalidPhotos: copy(
            "Check the selected photos and cover photo.",
            "Verifique as fotografias selecionadas e a fotografia de capa.",
          ),
          unavailable: copy(
            "This draft is unavailable in this workspace.",
            "Este rascunho está indisponível nesta área de trabalho.",
          ),
          staleDraft: copy(
            "The draft changed. Review the latest details before marking it ready.",
            "O rascunho mudou. Reveja os dados mais recentes antes de o marcar como pronto.",
          ),
          notReviewed: copy(
            "Open the review step before marking this draft ready.",
            "Abra a etapa de revisão antes de marcar este rascunho como pronto.",
          ),
          duplicate: copy(
            "This record already exists in the workspace.",
            "Este registo já existe nesta área de trabalho.",
          ),
          workspaceLimit: copy(
            "Retained photos can total up to 100 MB. Remove photos to free space.",
            "As fotografias guardadas podem ocupar até 100 MB. Remova fotografias para libertar espaço.",
          ),
        } as Record<string, string>
      )[issue] ??
      copy(
        "This change could not be saved.",
        "Não foi possível guardar esta alteração.",
      )
    );
  };
  return {
    copy,
    locale,
    date,
    option,
    fieldLabel,
    unitLabel,
    stepNames,
    scope,
    issueText,
  };
}
