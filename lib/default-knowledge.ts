import type { Lang } from './translations';

export type KnowledgeArticle = {
  title: Record<Lang, string>;
  content: Record<Lang, string>;
};

export const DEFAULT_KNOWLEDGE: Record<string, KnowledgeArticle[]> = {
  restaurant: [
    {
      title: { en: 'About Us', zh: '餐廳介紹', pt: 'Sobre Nós' },
      content: {
        en: '{{business}} is a local restaurant dedicated to quality dining. We serve a variety of carefully prepared dishes suitable for family gatherings, business dinners, and celebrations. Our team is committed to warm hospitality and excellent service for every guest.',
        zh: '{{business}} 係一間提供優質餐飲服務嘅本地餐廳，供應多款精心烹調嘅菜式，適合家庭聚餐、商務宴請及各類慶祝活動。我哋致力為每位客人提供熱情款待及優質服務。',
        pt: '{{business}} é um restaurante local dedicado a proporcionar uma experiência gastronómica de qualidade. Servimos uma variedade de pratos cuidadosamente preparados, ideais para refeições em família, almoços de negócios e celebrações.',
      },
    },
    {
      title: { en: 'Opening Hours', zh: '營業時間', pt: 'Horário de Funcionamento' },
      content: {
        en: 'Monday to Friday: 12:00 – 22:00\nSaturday: 11:30 – 22:30\nSunday: 11:30 – 21:30\nPublic holidays: Open as usual (special festivals may vary)\n\nPlease call to confirm hours on a specific date.',
        zh: '星期一至五：12:00 – 22:00\n星期六：11:30 – 22:30\n星期日：11:30 – 21:30\n公眾假期：照常營業（特殊節日除外）\n\n如需確認特定日期嘅營業時間，歡迎致電查詢。',
        pt: 'Segunda a Sexta: 12:00 – 22:00\nSábado: 11:30 – 22:30\nDomingo: 11:30 – 21:30\nFeriados: Aberto normalmente (festas especiais podem variar)\n\nLigue para confirmar o horário numa data específica.',
      },
    },
    {
      title: { en: 'Reservation Policy', zh: '訂座政策', pt: 'Política de Reservas' },
      content: {
        en: '- Same-day and advance bookings are accepted\n- Changes or cancellations require at least 24 hours\' notice\n- Parties of 8 or more should call ahead so we can arrange suitable seating\n- Please inform us of any dietary requirements (vegetarian, allergies, etc.) at time of booking\n- Early booking is recommended during peak seasons and holidays',
        zh: '- 接受即日及提前訂座\n- 更改或取消訂座請提前24小時通知\n- 8位或以上嘅大枱請提前致電安排座位\n- 訂座時請告知特別飲食要求（素食、過敏等）\n- 旺季及節日建議盡早預訂',
        pt: '- Aceitamos reservas no próprio dia e com antecedência\n- Alterações ou cancelamentos requerem pelo menos 24 horas de aviso\n- Grupos de 8 ou mais devem ligar com antecedência para organizar a disposição\n- Informe-nos de requisitos alimentares no momento da reserva\n- Recomendamos reserva antecipada em épocas de maior afluência',
      },
    },
    {
      title: { en: 'Frequently Asked Questions', zh: '常見問題', pt: 'Perguntas Frequentes' },
      content: {
        en: 'Q: Is there parking nearby?\nA: Public parking is available nearby. Call us for details.\n\nQ: Can I bring my own wine or cake?\nA: Outside beverages are not permitted. We can arrange a birthday cake — please mention it when booking.\n\nQ: Is there a private dining room?\nA: Private rooms are available. Please call in advance to arrange.\n\nQ: What cuisines do you serve?\nA: Please update this section with your restaurant\'s cuisine type.',
        zh: 'Q：附近有停車場嗎？\nA：附近設有公共停車場，詳情請致電查詢。\n\nQ：可以自攜酒水或蛋糕嗎？\nA：本店不設自攜酒水服務。生日蛋糕可預先安排，請訂座時告知。\n\nQ：有私人房間嗎？\nA：設有私人宴客房，請提前致電預訂。\n\nQ：供應甚麼菜式？\nA：請在此填寫你餐廳的菜系及特色菜式。',
        pt: 'Q: Há estacionamento?\nA: Há estacionamento público nas proximidades. Ligue para mais detalhes.\n\nQ: Posso trazer vinho ou bolo?\nA: Não é permitida a entrada de bebidas externas. Podemos arranjar um bolo de aniversário — mencione ao reservar.\n\nQ: Existe sala privada?\nA: Temos salas privadas. Ligue com antecedência para reservar.\n\nQ: Que tipo de cozinha servem?\nA: Atualize esta secção com o tipo de culinária do seu restaurante.',
      },
    },
  ],

  beauty_salon: [
    {
      title: { en: 'About Us', zh: '沙龍介紹', pt: 'Sobre Nós' },
      content: {
        en: '{{business}} is a professional beauty salon offering a full range of hair, nail, and skincare services. Our experienced stylists and therapists are dedicated to making every client look and feel their best in a relaxing, welcoming environment.',
        zh: '{{business}} 係一間提供全面美髮、美甲及護膚服務嘅專業美容院。我哋經驗豐富嘅髮型師及美容師致力讓每位客人在舒適環境中展現最佳狀態。',
        pt: '{{business}} é um salão de beleza profissional que oferece uma gama completa de serviços de cabelo, unhas e cuidados de pele. Os nossos experientes especialistas dedicam-se a fazer com que cada cliente se sinta e pareça o seu melhor.',
      },
    },
    {
      title: { en: 'Opening Hours', zh: '營業時間', pt: 'Horário de Funcionamento' },
      content: {
        en: 'Monday: Closed\nTuesday to Friday: 10:00 – 20:00\nSaturday: 10:00 – 20:00\nSunday: 11:00 – 18:00\nPublic holidays: Please call to confirm\n\nLast appointment is taken 1 hour before closing.',
        zh: '星期一：休息\n星期二至五：10:00 – 20:00\n星期六：10:00 – 20:00\n星期日：11:00 – 18:00\n公眾假期：請致電確認\n\n最後預約時間為關門前1小時。',
        pt: 'Segunda: Fechado\nTerça a Sexta: 10:00 – 20:00\nSábado: 10:00 – 20:00\nDomingo: 11:00 – 18:00\nFeriados: Ligue para confirmar\n\nÚltimo agendamento aceite 1 hora antes do fecho.',
      },
    },
    {
      title: { en: 'Services & Pricing', zh: '服務項目及收費', pt: 'Serviços e Preços' },
      content: {
        en: 'Hair services: Cut, colour, highlights, perms, treatments\nNail services: Manicure, pedicure, gel nails, nail art\nSkincare: Facials, eyebrow shaping, lash extensions\n\nPricing varies by service and stylist level. Please call or update this section with your current price list.\n\nFirst-time clients receive a complimentary consultation.',
        zh: '美髮服務：剪髮、染髮、挑染、燙髮、護髮療程\n美甲服務：修甲、足部護理、甲油膠、美甲藝術\n護膚服務：面部護理、修眉、睫毛嫁接\n\n收費因服務項目及髮型師級別而異。請致電查詢或在此更新最新價目表。\n\n首次惠顧客人享免費諮詢服務。',
        pt: 'Cabelo: Corte, coloração, madeixas, permanente, tratamentos\nUnhas: Manicure, pedicure, gel, nail art\nPele: Faciais, modelação de sobrancelhas, extensões de pestanas\n\nOs preços variam consoante o serviço e o nível do estilista. Ligue ou atualize esta secção com a sua lista de preços.\n\nNovos clientes recebem uma consulta gratuita.',
      },
    },
    {
      title: { en: 'Booking Policy', zh: '預約政策', pt: 'Política de Marcações' },
      content: {
        en: '- Advance booking is recommended, especially on weekends\n- Please arrive 5 minutes before your appointment\n- Cancellations require at least 24 hours\' notice to avoid a cancellation fee\n- Same-day cancellations may incur a fee\n- We will send a reminder the day before your appointment\n- Walk-ins are welcome subject to availability',
        zh: '- 建議提前預約，尤其週末\n- 請於預約時間前5分鐘到達\n- 取消預約請提前24小時通知，以免收取取消費\n- 即日取消或須收取費用\n- 我哋將於預約前一天發送提醒\n- 歡迎即場候位，視乎名額而定',
        pt: '- Recomendamos marcação antecipada, especialmente ao fim de semana\n- Por favor, chegue 5 minutos antes da sua hora\n- Cancelamentos requerem pelo menos 24 horas de aviso para evitar taxas\n- Cancelamentos no próprio dia podem incorrer em taxa\n- Enviamos um lembrete no dia anterior\n- Aceitamos walk-ins sujeito a disponibilidade',
      },
    },
  ],

  insurance: [
    {
      title: { en: 'About Us', zh: '公司介紹', pt: 'Sobre Nós' },
      content: {
        en: '{{business}} is a licensed insurance brokerage/agency helping clients protect what matters most. We offer a wide range of personal and commercial insurance solutions with professional advice tailored to each client\'s needs. Our licensed advisors are available to guide you through policy selection, renewals, and claims.',
        zh: '{{business}} 係一間持牌保險代理/經紀公司，致力協助客戶保障重要資產。我哋提供多種個人及商業保險方案，由持牌顧問為每位客戶度身提供專業建議，涵蓋選保、續保及索賠服務。',
        pt: '{{business}} é uma corretora/agência de seguros licenciada que ajuda os clientes a proteger o que mais importa. Oferecemos soluções de seguros pessoais e comerciais com aconselhamento profissional adaptado a cada cliente.',
      },
    },
    {
      title: { en: 'Office Hours', zh: '辦公時間', pt: 'Horário de Atendimento' },
      content: {
        en: 'Monday to Friday: 09:00 – 18:00\nSaturday: 10:00 – 13:00\nSunday & Public Holidays: Closed\n\nFor urgent claim emergencies outside office hours, clients should refer to the emergency contact number on their policy document.',
        zh: '星期一至五：09:00 – 18:00\n星期六：10:00 – 13:00\n星期日及公眾假期：休息\n\n如在辦公時間以外需要緊急索賠協助，請參閱保單文件上的緊急聯絡電話。',
        pt: 'Segunda a Sexta: 09:00 – 18:00\nSábado: 10:00 – 13:00\nDomingo e Feriados: Fechado\n\nPara emergências de sinistros fora do horário, os clientes devem consultar o número de emergência no documento da apólice.',
      },
    },
    {
      title: { en: 'Our Products', zh: '保險產品', pt: 'Os Nossos Produtos' },
      content: {
        en: 'Personal insurance: Life, medical/health, accident, travel, home, motor\nCommercial insurance: Business liability, property, employee compensation, cyber\n\nPlease update this section with your specific product offerings and key features.\n\nNote: We cannot provide exact premium quotes over the phone — a licensed advisor will follow up with a tailored proposal.',
        zh: '個人保險：人壽、醫療/健康、意外、旅遊、家居、汽車\n商業保險：商業責任、財產、僱員補償、網絡安全\n\n請在此填寫你公司的具體產品及主要特色。\n\n注意：我哋不能在電話上提供精確保費報價，持牌顧問將跟進並提供度身方案。',
        pt: 'Seguros pessoais: Vida, saúde/médico, acidentes, viagem, habitação, automóvel\nSeguros comerciais: Responsabilidade civil, propriedade, acidentes de trabalho, cibersegurança\n\nAtualize esta secção com os seus produtos específicos.\n\nNota: Não fornecemos cotações exactas por telefone — um agente licenciado entrará em contacto.',
      },
    },
    {
      title: { en: 'Claims Process', zh: '索賠程序', pt: 'Processo de Sinistros' },
      content: {
        en: 'Step 1: Call our claims hotline or notify us as soon as possible after an incident\nStep 2: Provide your policy number and a brief description of the claim\nStep 3: We will send a claims form and advise on required documents\nStep 4: Submit completed form and supporting documents\nStep 5: Our claims team will assess and revert within the timeframe stated in your policy\n\nFor urgent queries, reference the emergency number on your policy document.',
        zh: '第1步：事故發生後盡快致電索賠熱線或通知我哋\n第2步：提供保單號碼及簡述索賠情況\n第3步：我哋將發送索賠表格並說明所需文件\n第4步：提交填妥嘅表格及相關證明文件\n第5步：索賠團隊將按保單所載時間評估並回覆\n\n緊急查詢請參閱保單上嘅緊急聯絡電話。',
        pt: 'Passo 1: Ligue para a linha de sinistros ou notifique-nos o mais rápido possível\nPasso 2: Forneça o número da apólice e descreva o sinistro\nPasso 3: Enviaremos um formulário e indicaremos os documentos necessários\nPasso 4: Envie o formulário preenchido e os documentos de suporte\nPasso 5: A nossa equipa avaliará e responderá no prazo indicado na apólice',
      },
    },
  ],

  travel_agency: [
    {
      title: { en: 'About Us', zh: '公司介紹', pt: 'Sobre Nós' },
      content: {
        en: '{{business}} is a professional travel agency specialising in customised tour packages, group tours, and individual travel arrangements. From visa applications to hotel bookings and guided tours, our experienced consultants handle every detail so you can travel with confidence.',
        zh: '{{business}} 係一間專業旅行社，專門提供度身訂造旅遊套餐、團體旅遊及個人行程安排。由簽證申請到酒店預訂及導遊服務，我哋經驗豐富嘅顧問為您安排每個細節，讓您安心出行。',
        pt: '{{business}} é uma agência de viagens profissional especializada em pacotes turísticos personalizados, viagens em grupo e arranjos individuais. Desde vistos a reservas de hotel e excursões guiadas, os nossos consultores tratam de cada detalhe.',
      },
    },
    {
      title: { en: 'Office Hours', zh: '辦公時間', pt: 'Horário de Atendimento' },
      content: {
        en: 'Monday to Friday: 09:30 – 18:30\nSaturday: 10:00 – 17:00\nSunday & Public Holidays: Closed\n\nFor clients currently travelling who face an emergency, please refer to the 24-hour emergency contact number printed on your travel itinerary.',
        zh: '星期一至五：09:30 – 18:30\n星期六：10:00 – 17:00\n星期日及公眾假期：休息\n\n如客人已在旅途中遇到緊急情況，請參閱行程表上的24小時緊急聯絡電話。',
        pt: 'Segunda a Sexta: 09:30 – 18:30\nSábado: 10:00 – 17:00\nDomingo e Feriados: Fechado\n\nPara clientes em viagem com emergências, consulte o número de emergência 24h no seu itinerário.',
      },
    },
    {
      title: { en: 'Our Tours & Packages', zh: '旅遊產品', pt: 'Tours e Pacotes' },
      content: {
        en: 'Popular destinations: Japan, Korea, Europe, Southeast Asia, Australia, Middle East\nPackage types: Group tours, self-drive, honeymoon, family, cruise, adventure\nServices included: Flights, hotel, visa assistance, travel insurance, guided tours, airport transfers\n\nPlease update this section with your specific packages and current promotions.',
        zh: '熱門目的地：日本、韓國、歐洲、東南亞、澳洲、中東\n套餐類型：跟團遊、自駕遊、蜜月旅行、家庭遊、郵輪、探險遊\n包含服務：機票、酒店、簽證協助、旅遊保險、導覽、接機服務\n\n請在此填寫你公司的具體套餐及最新優惠。',
        pt: 'Destinos populares: Japão, Coreia, Europa, Sudeste Asiático, Austrália, Médio Oriente\nTipos de pacote: Tour em grupo, autocaravana, lua de mel, família, cruzeiro, aventura\nServiços incluídos: Voos, hotel, apoio a vistos, seguro viagem, excursões, transferes\n\nAtualize esta secção com os seus pacotes específicos.',
      },
    },
    {
      title: { en: 'Booking Information', zh: '預訂須知', pt: 'Informações de Reserva' },
      content: {
        en: '- Bookings can be made in person, by phone, or online\n- A deposit is required to confirm your booking (amount varies by package)\n- Full payment is typically due 30 days before departure\n- Cancellation policy varies by package — please check terms at time of booking\n- Travel insurance is strongly recommended\n- Passports must be valid for at least 6 months beyond your return date\n- Visa requirements vary by destination — our team will advise',
        zh: '- 可親身、電話或網上預訂\n- 確認預訂需繳付訂金（金額視乎套餐而定）\n- 全數款項通常須於出發前30天繳清\n- 取消政策因套餐而異，預訂時請確認條款\n- 強烈建議購買旅遊保險\n- 護照有效期須在回程後至少6個月以上\n- 各目的地簽證要求不同，我哋團隊將提供建議',
        pt: '- Reservas disponíveis pessoalmente, por telefone ou online\n- É necessário depósito para confirmar a reserva\n- Pagamento total geralmente devido 30 dias antes da partida\n- Política de cancelamento varia por pacote\n- Recomendamos fortemente seguro de viagem\n- O passaporte deve ser válido por pelo menos 6 meses após o regresso\n- Os requisitos de visto variam por destino — a nossa equipa irá aconselhar',
      },
    },
  ],

  medical_clinic: [
    {
      title: { en: 'About the Clinic', zh: '診所介紹', pt: 'Sobre a Clínica' },
      content: {
        en: '{{business}} is a private medical clinic providing comprehensive healthcare services. Our team of qualified doctors and healthcare professionals is committed to delivering patient-centred care in a comfortable and professional environment. We serve patients of all ages.',
        zh: '{{business}} 係一間私家醫療診所，提供全面醫療服務。我哋的合資格醫生及醫療專業人員致力在舒適的環境中提供以病人為本的醫療服務，服務各年齡層的病人。',
        pt: '{{business}} é uma clínica médica privada que oferece serviços de saúde abrangentes. A nossa equipa de médicos qualificados está comprometida com cuidados centrados no paciente num ambiente confortável e profissional.',
      },
    },
    {
      title: { en: 'Clinic Hours', zh: '診症時間', pt: 'Horário da Clínica' },
      content: {
        en: 'Monday to Friday: 09:00 – 13:00, 14:30 – 18:30\nSaturday: 09:00 – 13:00\nSunday & Public Holidays: Closed\n\nFor medical emergencies, please call 999 or go to the nearest Accident & Emergency department.\n\nPlease update with your actual clinic hours.',
        zh: '星期一至五：09:00 – 13:00，14:30 – 18:30\n星期六：09:00 – 13:00\n星期日及公眾假期：休息\n\n如遇緊急醫療情況，請致電999或前往最近的急症室。\n\n請更新為你診所的實際診症時間。',
        pt: 'Segunda a Sexta: 09:00 – 13:00, 14:30 – 18:30\nSábado: 09:00 – 13:00\nDomingo e Feriados: Fechado\n\nEm caso de emergência médica, ligue 999 ou vá à urgência mais próxima.\n\nAtualize com o horário real da sua clínica.',
      },
    },
    {
      title: { en: 'Our Services', zh: '診症服務', pt: 'Os Nossos Serviços' },
      content: {
        en: 'General practice: Consultations, health check-ups, vaccinations, chronic disease management\nSpecialist services: Please update with your specialist departments\nDiagnostics: Blood tests, urine tests, ECG, X-ray (if applicable)\nPreventive care: Health screenings, occupational health\n\nNote: We do not provide emergency trauma care. For emergencies call 999.',
        zh: '普通科：門診、健康檢查、疫苗接種、慢性病管理\n專科服務：請填寫你診所的專科部門\n化驗服務：血液、尿液化驗、心電圖、X光（如適用）\n預防保健：健康篩查、職業健康\n\n注意：本診所不提供緊急創傷護理。緊急情況請致電999。',
        pt: 'Clínica geral: Consultas, exames de saúde, vacinação, gestão de doenças crónicas\nEspecialidades: Atualize com os seus departamentos especializados\nDiagnóstico: Análises, urina, ECG, Raio-X (se aplicável)\nCuidados preventivos: Rastreios de saúde\n\nNota: Não prestamos cuidados de emergência traumática. Em emergências ligue 999.',
      },
    },
    {
      title: { en: 'Appointment & Cancellation Policy', zh: '預約及取消政策', pt: 'Política de Marcações e Cancelamentos' },
      content: {
        en: '- Appointments can be made by phone or in person\n- Please arrive 10 minutes early to complete registration\n- Bring your ID and relevant medical records or previous prescriptions\n- Cancellations: Please notify us at least 2 hours in advance\n- Late arrivals may result in a shortened consultation or rescheduling\n- Walk-in patients are accepted, but waiting times may be longer\n- We do not provide advice on specific medical symptoms over the phone — please book an appointment',
        zh: '- 可致電或親身預約\n- 請提早10分鐘到達辦理登記手續\n- 請攜帶身份證及相關病歷或之前的藥方\n- 取消預約：請至少提前2小時通知\n- 遲到可能導致診症時間縮短或需重新預約\n- 接受即場候診，但等候時間可能較長\n- 我哋不會在電話上就具體病徵提供醫療建議，請預約覆診',
        pt: '- Marcações por telefone ou pessoalmente\n- Chegue 10 minutos mais cedo para completar o registo\n- Traga o BI e registos médicos ou prescrições anteriores relevantes\n- Cancelamentos: avise com pelo menos 2 horas de antecedência\n- Atrasos podem resultar em consulta reduzida ou reagendamento\n- Aceitamos walk-ins, mas os tempos de espera podem ser maiores\n- Não fornecemos aconselhamento médico por telefone — por favor marque uma consulta',
      },
    },
  ],

  real_estate: [
    {
      title: { en: 'About Us', zh: '公司介紹', pt: 'Sobre Nós' },
      content: {
        en: '{{business}} is a professional real estate agency providing residential and commercial property services. Our experienced team of licensed agents helps buyers, sellers, landlords, and tenants navigate the property market with confidence and clarity.',
        zh: '{{business}} 係一間專業地產代理公司，提供住宅及商業物業服務。我哋經驗豐富的持牌代理團隊協助買家、賣家、業主及租客在物業市場中作出明智決定。',
        pt: '{{business}} é uma agência imobiliária profissional que presta serviços de propriedade residencial e comercial. A nossa experiente equipa de agentes licenciados ajuda compradores, vendedores, senhorios e inquilinos no mercado imobiliário.',
      },
    },
    {
      title: { en: 'Office Hours', zh: '辦公時間', pt: 'Horário de Atendimento' },
      content: {
        en: 'Monday to Friday: 09:00 – 18:30\nSaturday: 10:00 – 17:00\nSunday: 11:00 – 16:00 (viewing appointments only)\nPublic Holidays: Closed\n\nViewings can be arranged outside office hours by prior appointment.',
        zh: '星期一至五：09:00 – 18:30\n星期六：10:00 – 17:00\n星期日：11:00 – 16:00（僅限睇樓預約）\n公眾假期：休息\n\n辦公時間以外的睇樓可提前預約安排。',
        pt: 'Segunda a Sexta: 09:00 – 18:30\nSábado: 10:00 – 17:00\nDomingo: 11:00 – 16:00 (apenas visitas agendadas)\nFeriados: Fechado\n\nVisitas fora do horário podem ser agendadas com antecedência.',
      },
    },
    {
      title: { en: 'Our Services', zh: '服務範疇', pt: 'Os Nossos Serviços' },
      content: {
        en: 'Sales: Buying and selling residential and commercial properties\nRentals: Tenant search, lease negotiation, property management\nValuation: Market appraisals and formal valuations\nConsultation: Investment advice, market analysis, mortgage referrals\n\nWe cover [update with your service areas/districts]. Please update this section with your focus areas and any specialisations.',
        zh: '買賣：住宅及商業物業買賣代理\n租賃：尋找租客、租約談判、物業管理\n估價：市場估值及正式估價報告\n諮詢：投資建議、市場分析、按揭轉介\n\n我哋服務範圍涵蓋[填寫你的服務地區]。請在此填寫你的專注範疇及專業服務。',
        pt: 'Vendas: Compra e venda de propriedades residenciais e comerciais\nArrendamento: Procura de inquilinos, negociação de contratos, gestão de propriedades\nAvaliação: Avaliações de mercado e formais\nConsultoria: Aconselhamento de investimento, análise de mercado, referências de hipotecas\n\nAtualize esta secção com as suas áreas de foco.',
      },
    },
    {
      title: { en: 'Viewing Arrangements', zh: '睇樓安排', pt: 'Organização de Visitas' },
      content: {
        en: '- Viewings are by appointment only — call or WhatsApp to schedule\n- Please arrive on time; agents wait up to 10 minutes\n- Bring your ID for verification purposes\n- We recommend viewing at least 2–3 properties before deciding\n- After a viewing, our agent will follow up to answer any questions\n- For rental enquiries: bring proof of income if you wish to proceed quickly\n- For purchase enquiries: let us know your budget, preferred districts, and move-in timeline',
        zh: '- 睇樓需提前預約，請致電或WhatsApp安排\n- 請準時到達，代理將等候最多10分鐘\n- 請攜帶身份證作核實用途\n- 建議睇至少2-3個單位再作決定\n- 睇樓後代理將跟進解答任何問題\n- 租樓查詢：如希望盡快處理，請準備收入證明\n- 購買查詢：請告知預算、心儀地區及入伙時間',
        pt: '- Visitas apenas por marcação — ligue ou envie WhatsApp para agendar\n- Por favor chegue a horas; os agentes esperam até 10 minutos\n- Traga o seu BI para verificação\n- Recomendamos visitar pelo menos 2–3 propriedades antes de decidir\n- Após a visita, o nosso agente fará acompanhamento\n- Para arrendamento: traga comprovativo de rendimentos se deseja avançar rapidamente\n- Para compra: informe-nos do orçamento, distritos preferidos e prazo de entrada',
      },
    },
  ],
};
