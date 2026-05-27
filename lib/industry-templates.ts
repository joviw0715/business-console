import type { Lang } from './translations';

export interface IndustryTemplate {
  key: string;
  emoji: string;
  // per-language fields
  name:                  Record<Lang, string>;
  heroTagline:           Record<Lang, string>;   // hero headline on dashboard
  heroSubtitle:          Record<Lang, string>;   // hero subtitle on dashboard
  hint:                  Record<Lang, string>;   // pill hint line in wizards
  sampleCampaignName:    Record<Lang, string>;   // pre-fill campaign name
  sampleScript:          Record<Lang, string>;   // "What should the AI say" pre-fill
  hotlineName:           Record<Lang, string>;   // suggested hotline name
  hotlineSystemPrompt:   Record<Lang, string>;   // inbound system prompt
  afterHoursMessage:     Record<Lang, string>;   // inbound after-hours
  // legacy voice fields kept for backward-compat with WhatsApp bot + old callers
  greetingText:          string;                 // outbound greeting (English)
  systemPrompt:          string;                 // outbound system prompt (English)
}

export const TEMPLATES: Record<string, IndustryTemplate> = {
  restaurant: {
    key: 'restaurant',
    emoji: '🍽️',
    name: {
      en: 'Restaurant',
      zh: '餐廳',
      pt: 'Restaurante',
    },
    heroTagline: {
      en: 'Confirm tonight\'s tables',
      zh: '確認今晚的訂座',
      pt: 'Confirmar as mesas de hoje',
    },
    heroSubtitle: {
      en: 'Reduce no-shows with automated reservation confirmations — set up in under a minute.',
      zh: '自動確認訂座，減少爽約情況，一分鐘內完成設定。',
      pt: 'Reduza as ausências com confirmações automáticas de reserva — configure em menos de um minuto.',
    },
    hint: {
      en: 'Templates auto-fill scripts & knowledge for restaurant.',
      zh: '範本自動填入餐廳的腳本和知識庫。',
      pt: 'Modelos preenchem automaticamente scripts e conhecimento para restaurante.',
    },
    sampleCampaignName: {
      en: 'Dinner reservation confirmations',
      zh: '晚餐訂座確認',
      pt: 'Confirmações de reserva de jantar',
    },
    sampleScript: {
      en: "Hi, this is Jamie from {{business}}. We're calling to confirm your reservation for {{party_size}} people on {{date}} at {{time}}. Could you confirm if you'll be joining us? If you need to change the time or party size, just let me know.",
      zh: '您好，我係{{business}}嘅Jamie。我哋打嚟確認您{{date}}{{time}}，{{party_size}}位嘅訂座。請問您係咪如期到來？如需更改時間或人數，請告知我哋。',
      pt: 'Olá, aqui é Jamie do {{business}}. Estamos a ligar para confirmar a sua reserva para {{party_size}} pessoas no dia {{date}} às {{time}}. Pode confirmar a sua presença? Se precisar de alterar o horário ou o número de pessoas, é só me dizer.',
    },
    hotlineName: {
      en: 'Main reservation line',
      zh: '主要訂座熱線',
      pt: 'Linha principal de reservas',
    },
    hotlineSystemPrompt: {
      en: 'You are a friendly host at {{business}}. Help callers with reservations, opening hours, menu questions, and special requests. Be concise, warm, and professional. Escalate to staff if needed.',
      zh: '你係{{business}}嘅友善主持人。協助來電者處理訂座、查詢營業時間、菜單問題及特別要求。保持簡潔、熱情及專業。如有需要請轉交員工跟進。',
      pt: 'Você é um anfitrião simpático do {{business}}. Ajude os chamadores com reservas, horários de funcionamento, dúvidas sobre o menu e pedidos especiais. Seja conciso, caloroso e profissional. Escale para a equipe se necessário.',
    },
    afterHoursMessage: {
      en: "We're currently closed. Please call back during our opening hours.",
      zh: '我哋而家已經關門。請於營業時間內再來電，謝謝。',
      pt: 'Estamos fechados no momento. Por favor, ligue de volta durante o nosso horário de funcionamento.',
    },
    greetingText: "Hi, this is Jamie from {{business}}. We're calling to confirm your reservation for {{party_size}} people on {{date}} at {{time}}.",
    systemPrompt: "You are a friendly AI assistant for a restaurant. Help customers with reservations, menu questions, and special requests. Be warm and welcoming.",
  },

  beauty_salon: {
    key: 'beauty_salon',
    emoji: '💇',
    name: {
      en: 'Beauty Salon',
      zh: '美容院',
      pt: 'Salão de Beleza',
    },
    heroTagline: {
      en: "Confirm tomorrow's appointments",
      zh: '確認明天的預約',
      pt: 'Confirmar os compromissos de amanhã',
    },
    heroSubtitle: {
      en: 'Cut appointment no-shows with automated reminders — set up in under a minute.',
      zh: '自動提醒客戶預約，有效減少爽約，一分鐘內完成設定。',
      pt: 'Reduza faltas com lembretes automáticos de agendamento — configure em menos de um minuto.',
    },
    hint: {
      en: 'Templates auto-fill scripts & knowledge for beauty salon.',
      zh: '範本自動填入美容院的腳本和知識庫。',
      pt: 'Modelos preenchem automaticamente scripts e conhecimento para salão de beleza.',
    },
    sampleCampaignName: {
      en: 'Appointment reminders',
      zh: '預約提醒',
      pt: 'Lembretes de compromisso',
    },
    sampleScript: {
      en: "Hi, this is Anna from {{business}}. I'm calling to confirm your appointment on {{date}} at {{time}}. Please let me know if you'd like to confirm, reschedule, or cancel — and we look forward to seeing you!",
      zh: '您好，我係{{business}}嘅Anna。我哋打嚟確認您{{date}}{{time}}嘅預約。請問您係確認、改期還是取消？期待見到您！',
      pt: 'Olá, aqui é Anna do {{business}}. Estou a ligar para confirmar o seu compromisso no dia {{date}} às {{time}}. Por favor, informe-me se deseja confirmar, reagendar ou cancelar — estamos ansiosos para vê-lo(a)!',
    },
    hotlineName: {
      en: 'Salon booking line',
      zh: '沙龍預約熱線',
      pt: 'Linha de marcações do salão',
    },
    hotlineSystemPrompt: {
      en: 'You are a friendly receptionist at {{business}}. Help callers book, reschedule, or cancel appointments. Know our services, stylists, and pricing. Offer the nearest available slot if their preferred time is full.',
      zh: '你係{{business}}嘅友善接待員。協助來電者預約、改期或取消。熟悉我哋嘅服務、髮型師及收費。如首選時間已滿，請提供最近可用時段。',
      pt: 'Você é um(a) recepcionista simpático(a) do {{business}}. Ajude os chamadores a marcar, reagendar ou cancelar compromissos. Conheça os nossos serviços, estilistas e preços. Ofereça o horário disponível mais próximo se o preferido estiver cheio.',
    },
    afterHoursMessage: {
      en: 'Our salon is closed. Please call back during opening hours or leave a message and we\'ll call you back.',
      zh: '我哋嘅沙龍已經關門。請於營業時間致電，或留言，我哋將盡快回覆您。',
      pt: 'O nosso salão está fechado. Por favor, ligue durante o horário de funcionamento ou deixe uma mensagem e entraremos em contacto consigo.',
    },
    greetingText: "Hi, this is Anna from {{business}}. I'm calling to confirm your appointment on {{date}} at {{time}}.",
    systemPrompt: "You are a professional AI assistant for a beauty salon. Help clients book appointments, answer questions about services and pricing, and provide care tips.",
  },

  insurance: {
    key: 'insurance',
    emoji: '🛡️',
    name: {
      en: 'Insurance',
      zh: '保險',
      pt: 'Seguros',
    },
    heroTagline: {
      en: 'Renewals & policy follow-ups',
      zh: '續保及保單跟進',
      pt: 'Renovações e acompanhamento de apólices',
    },
    heroSubtitle: {
      en: 'Reach policyholders before renewal deadlines — automate follow-ups in under a minute.',
      zh: '在保單到期前主動聯絡客戶，自動跟進，一分鐘內完成設定。',
      pt: 'Contacte segurados antes dos prazos de renovação — automatize o acompanhamento em menos de um minuto.',
    },
    hint: {
      en: 'Templates auto-fill scripts & knowledge for insurance.',
      zh: '範本自動填入保險的腳本和知識庫。',
      pt: 'Modelos preenchem automaticamente scripts e conhecimento para seguros.',
    },
    sampleCampaignName: {
      en: 'Policy renewal outreach',
      zh: '保單續保外展',
      pt: 'Contacto de renovação de apólice',
    },
    sampleScript: {
      en: "Hello, this is a courtesy call from {{business}} regarding your policy renewal due on {{date}}. I can confirm your renewal, answer any questions about your coverage, or transfer you to an agent. How would you like to proceed?",
      zh: '您好，我係{{business}}嘅代表。您嘅保單將於{{date}}到期。我可以協助您確認續保、解答保障問題，或轉接至保險顧問。請問您希望如何處理？',
      pt: 'Olá, esta é uma chamada de cortesia do {{business}} relativa à renovação da sua apólice com vencimento em {{date}}. Posso confirmar a sua renovação, responder a perguntas sobre a sua cobertura ou transferi-lo(a) para um agente. Como prefere prosseguir?',
    },
    hotlineName: {
      en: 'Customer service hotline',
      zh: '客戶服務熱線',
      pt: 'Linha de apoio ao cliente',
    },
    hotlineSystemPrompt: {
      en: 'You are a customer service assistant at {{business}}. Help callers with policy questions, claims status, premium payments, and renewals. Never quote new prices — escalate to a licensed agent for new policies.',
      zh: '你係{{business}}嘅客戶服務助理。協助來電者解答保單問題、查詢索賠狀態、保費繳付及續保。切勿報價新保單——請轉交持牌顧問處理。',
      pt: 'Você é um(a) assistente de atendimento ao cliente do {{business}}. Ajude os chamadores com perguntas sobre apólices, estado de sinistros, pagamentos de prémios e renovações. Nunca cite novos preços — escale para um agente licenciado para novas apólices.',
    },
    afterHoursMessage: {
      en: 'Our service team is unavailable. For emergency claims please press 1, otherwise call back Mon–Fri 9am–6pm.',
      zh: '我哋嘅服務團隊暫時無法接聽。緊急索賠請按1，否則請於週一至五上午9時至下午6時再來電。',
      pt: 'A nossa equipa de serviço não está disponível. Para sinistros urgentes prima 1, caso contrário ligue de volta de Seg a Sex das 9h às 18h.',
    },
    greetingText: "Hello, this is a courtesy call from {{business}} regarding your policy renewal due on {{date}}.",
    systemPrompt: "You are a professional AI assistant for an insurance company. Help clients understand their policy options, answer coverage questions, and schedule follow-up appointments.",
  },

  travel_agency: {
    key: 'travel_agency',
    emoji: '✈️',
    name: {
      en: 'Travel Agency',
      zh: '旅行社',
      pt: 'Agência de Viagens',
    },
    heroTagline: {
      en: 'Trip confirmations & departures',
      zh: '行程確認及出發提醒',
      pt: 'Confirmações de viagens e partidas',
    },
    heroSubtitle: {
      en: 'Send pre-departure reminders and confirm travel details — set up in under a minute.',
      zh: '自動發送出發提醒並確認行程詳情，一分鐘內完成設定。',
      pt: 'Envie lembretes pré-partida e confirme detalhes de viagem — configure em menos de um minuto.',
    },
    hint: {
      en: 'Templates auto-fill scripts & knowledge for travel agency.',
      zh: '範本自動填入旅行社的腳本和知識庫。',
      pt: 'Modelos preenchem automaticamente scripts e conhecimento para agência de viagens.',
    },
    sampleCampaignName: {
      en: 'Departure confirmations',
      zh: '出發確認',
      pt: 'Confirmações de partida',
    },
    sampleScript: {
      en: "Hello, this is {{business}} calling about your upcoming trip departing {{date}}. I'd like to confirm your travel party of {{party_size}} and remind you about check-in details. Do you have any questions before departure?",
      zh: '您好，我係{{business}}。您即將於{{date}}出發嘅旅程，我哋想確認{{party_size}}位旅客嘅行程，並提醒您辦理登機手續嘅詳情。出發前有任何問題嗎？',
      pt: 'Olá, aqui é o {{business}} a ligar sobre a sua próxima viagem com partida em {{date}}. Gostaria de confirmar o grupo de {{party_size}} viajantes e lembrá-lo(a) dos detalhes do check-in. Tem alguma dúvida antes da partida?',
    },
    hotlineName: {
      en: 'Booking & support line',
      zh: '預訂及支援熱線',
      pt: 'Linha de reservas e suporte',
    },
    hotlineSystemPrompt: {
      en: 'You are a travel consultant at {{business}}. Help callers with booking inquiries, itinerary changes, visa requirements, and travel advisories. Be warm, knowledgeable, and proactive about offering options.',
      zh: '你係{{business}}嘅旅遊顧問。協助來電者處理預訂查詢、行程更改、簽證要求及旅遊資訊。保持熱情、專業，主動提供各種選擇。',
      pt: 'Você é um(a) consultor(a) de viagens do {{business}}. Ajude os chamadores com consultas de reservas, alterações de itinerário, requisitos de visto e avisos de viagem. Seja caloroso(a), informado(a) e proativo(a) a oferecer opções.',
    },
    afterHoursMessage: {
      en: 'Our team is unavailable. For urgent travel emergencies abroad, please use the 24/7 number on your itinerary.',
      zh: '我哋嘅團隊暫時無法接聽。如在海外遇到緊急情況，請使用行程表上的24小時緊急電話。',
      pt: 'A nossa equipa não está disponível. Para emergências urgentes de viagem no estrangeiro, utilize o número 24h no seu itinerário.',
    },
    greetingText: "Hello, this is {{business}} calling about your upcoming trip departing {{date}}.",
    systemPrompt: "You are an enthusiastic AI travel assistant. Help customers with booking confirmations, travel itineraries, visa requirements, and travel tips.",
  },

  medical_clinic: {
    key: 'medical_clinic',
    emoji: '🏥',
    name: {
      en: 'Medical Clinic',
      zh: '醫療診所',
      pt: 'Clínica Médica',
    },
    heroTagline: {
      en: 'Appointment reminders',
      zh: '預約提醒',
      pt: 'Lembretes de consulta',
    },
    heroSubtitle: {
      en: 'Remind patients of upcoming appointments and reduce missed visits — in under a minute.',
      zh: '自動提醒病人預約，減少爽約，一分鐘內完成設定。',
      pt: 'Lembre os pacientes das consultas e reduza as faltas — configure em menos de um minuto.',
    },
    hint: {
      en: 'Templates auto-fill scripts & knowledge for medical clinic.',
      zh: '範本自動填入醫療診所的腳本和知識庫。',
      pt: 'Modelos preenchem automaticamente scripts e conhecimento para clínica médica.',
    },
    sampleCampaignName: {
      en: 'Patient appointment reminders',
      zh: '病人預約提醒',
      pt: 'Lembretes de consulta de pacientes',
    },
    sampleScript: {
      en: "Hello, this is the team at {{business}}. We're calling to remind you of your appointment on {{date}} at {{time}}. Please confirm, or let me know if you need to reschedule. Remember to bring your ID and insurance card.",
      zh: '您好，我係{{business}}嘅團隊。我哋打嚟提醒您{{date}}{{time}}嘅預約。請確認，或如需改期請告知我哋。記得攜帶您的身份證及醫療保險卡。',
      pt: 'Olá, é a equipa do {{business}}. Estamos a ligar para lembrá-lo(a) da sua consulta no dia {{date}} às {{time}}. Por favor confirme, ou avise-nos se precisar de reagendar. Lembre-se de trazer o seu BI e cartão de seguro.',
    },
    hotlineName: {
      en: 'Clinic reception line',
      zh: '診所接待熱線',
      pt: 'Linha de recepção da clínica',
    },
    hotlineSystemPrompt: {
      en: 'You are the reception assistant at {{business}}. Help callers book appointments, answer location & hours questions, and explain general services. Do NOT provide medical advice — escalate clinical questions to a doctor or nurse.',
      zh: '你係{{business}}嘅接待助理。協助來電者預約、查詢地址及診症時間，以及說明一般服務。切勿提供醫療建議——臨床問題請轉交醫生或護士。',
      pt: 'Você é o(a) assistente de receção do {{business}}. Ajude os chamadores a marcar consultas, responder a perguntas sobre localização e horários e explicar os serviços gerais. NÃO forneça aconselhamento médico — encaminhe questões clínicas para um médico ou enfermeiro(a).',
    },
    afterHoursMessage: {
      en: 'Our clinic is closed. For medical emergencies please call 999 or go to your nearest A&E.',
      zh: '診所已經關門。如有緊急醫療情況，請致電999或前往就近急症室。',
      pt: 'A nossa clínica está fechada. Para emergências médicas ligue 999 ou dirija-se ao serviço de urgência mais próximo.',
    },
    greetingText: "Hello, this is the team at {{business}}. We're calling to remind you of your appointment on {{date}} at {{time}}.",
    systemPrompt: "You are a caring AI assistant for a medical clinic. Help patients with appointment reminders, directions, and general clinic information. Always recommend speaking with a doctor for medical advice.",
  },

  real_estate: {
    key: 'real_estate',
    emoji: '🏠',
    name: {
      en: 'Real Estate',
      zh: '地產',
      pt: 'Imobiliário',
    },
    heroTagline: {
      en: 'Viewings & lead follow-up',
      zh: '睇樓及客戶跟進',
      pt: 'Visitas e acompanhamento de leads',
    },
    heroSubtitle: {
      en: 'Follow up on viewing requests and convert leads faster — set up in under a minute.',
      zh: '自動跟進睇樓查詢，加快成交，一分鐘內完成設定。',
      pt: 'Acompanhe pedidos de visita e converta leads mais rapidamente — configure em menos de um minuto.',
    },
    hint: {
      en: 'Templates auto-fill scripts & knowledge for real estate.',
      zh: '範本自動填入地產的腳本和知識庫。',
      pt: 'Modelos preenchem automaticamente scripts e conhecimento para imobiliário.',
    },
    sampleCampaignName: {
      en: 'Property viewing confirmations',
      zh: '睇樓確認',
      pt: 'Confirmações de visitas a imóveis',
    },
    sampleScript: {
      en: "Hi, this is {{business}}. I'm following up on your interest in our property listing. We have a viewing slot on {{date}} at {{time}} — would you like me to reserve it for you? I can also share similar listings if you prefer.",
      zh: '您好，我係{{business}}。就您對我哋物業的查詢，我哋安排咗{{date}}{{time}}嘅睇樓時段——請問您想預留嗎？如有需要，我亦可以介紹類似物業。',
      pt: 'Olá, aqui é o {{business}}. Estou a dar seguimento ao seu interesse no nosso imóvel. Temos uma visita disponível no dia {{date}} às {{time}} — gostaria que eu a reservasse para si? Também posso partilhar imóveis semelhantes se preferir.',
    },
    hotlineName: {
      en: 'Listings inquiry line',
      zh: '樓盤查詢熱線',
      pt: 'Linha de consulta de imóveis',
    },
    hotlineSystemPrompt: {
      en: 'You are a property consultant at {{business}}. Help callers with listing details, viewing arrangements, and general market questions. Collect their budget, preferred areas, and contact info to pass to an agent.',
      zh: '你係{{business}}嘅物業顧問。協助來電者查詢樓盤詳情、安排睇樓及回答市場問題。收集客戶預算、心儀地區及聯絡資料，轉交經紀跟進。',
      pt: 'Você é um(a) consultor(a) imobiliário(a) do {{business}}. Ajude os chamadores com detalhes de imóveis, marcações de visitas e perguntas gerais sobre o mercado. Recolha o orçamento, áreas preferidas e contacto para passar a um agente.',
    },
    afterHoursMessage: {
      en: "Our office is closed. Please leave your name, number, and the listing you're interested in — we'll call back first thing.",
      zh: '我哋嘅辦公室已經關門。請留下您的姓名、電話及感興趣的樓盤，我哋將盡快回覆您。',
      pt: 'O nosso escritório está fechado. Por favor, deixe o seu nome, número e o imóvel em que está interessado(a) — entraremos em contacto assim que possível.',
    },
    greetingText: "Hi, this is {{business}}. I'm following up on your interest in our property listing. We have a viewing slot on {{date}} at {{time}}.",
    systemPrompt: "You are a knowledgeable AI assistant for a real estate agency. Help clients with property enquiries, viewings, and market information.",
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);
