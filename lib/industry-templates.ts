export interface IndustryTemplate {
  key: string;
  name: string;
  emoji: string;
  greetingText: string;
  systemPrompt: string;
  afterHoursMessage: string;
}

export const TEMPLATES: Record<string, IndustryTemplate> = {
  restaurant: {
    key: 'restaurant',
    name: 'Restaurant',
    emoji: '🍽️',
    greetingText: 'Hi {{name}}, this is a reminder about your reservation at our restaurant on {{date}} at {{time}}. Please press 1 to confirm or 2 to cancel.',
    systemPrompt: 'You are a friendly AI assistant for a restaurant. Help customers with reservations, menu questions, and special requests. Be warm and welcoming. Speak in Cantonese.',
    afterHoursMessage: '您好，我們現在已關門。營業時間為每天上午十一時至晚上十時。請於營業時間內再來電，謝謝。',
  },
  beauty_salon: {
    key: 'beauty_salon',
    name: 'Beauty Salon',
    emoji: '💇',
    greetingText: 'Hi {{name}}, this is a reminder about your appointment at our salon on {{date}} at {{time}}. Please reply to confirm.',
    systemPrompt: 'You are a professional AI assistant for a beauty salon. Help clients book appointments, answer questions about services and pricing, and provide care tips. Be friendly and professional. Speak in Cantonese.',
    afterHoursMessage: '您好，我們的美容院現已休息。營業時間為星期一至六，上午十時至晚上八時。請於營業時間內再致電，謝謝。',
  },
  insurance: {
    key: 'insurance',
    name: 'Insurance',
    emoji: '🛡️',
    greetingText: 'Hi {{name}}, this is a call regarding your insurance policy renewal due on {{date}}. Our agent would like to discuss your options.',
    systemPrompt: 'You are a professional AI assistant for an insurance company. Help clients understand their policy options, answer coverage questions, and schedule follow-up appointments with agents. Be clear, accurate, and reassuring. Speak in Cantonese.',
    afterHoursMessage: '您好，我們的辦公室現已關閉。辦公時間為星期一至五，上午九時至下午六時。如有緊急事項，請致電緊急熱線，否則請於辦公時間內再來電，謝謝。',
  },
  travel_agency: {
    key: 'travel_agency',
    name: 'Travel Agency',
    emoji: '✈️',
    greetingText: 'Hi {{name}}, your travel package to {{destination}} departs on {{date}}. We are calling to confirm your booking details.',
    systemPrompt: 'You are an enthusiastic AI travel assistant. Help customers with booking confirmations, travel itineraries, visa requirements, and travel tips. Be exciting and helpful. Speak in Cantonese.',
    afterHoursMessage: '您好，我們的旅行社現已關閉。辦公時間為星期一至六，上午十時至晚上七時。請於辦公時間內再來電，我們將竭誠為您服務，謝謝。',
  },
  medical_clinic: {
    key: 'medical_clinic',
    name: 'Medical Clinic',
    emoji: '🏥',
    greetingText: 'Hi {{name}}, this is a reminder about your appointment with Dr. {{doctor}} on {{date}} at {{time}}. Please press 1 to confirm.',
    systemPrompt: 'You are a caring AI assistant for a medical clinic. Help patients with appointment reminders, directions, preparation instructions, and general clinic information. Be empathetic and professional. Always recommend speaking with a doctor for medical advice. Speak in Cantonese.',
    afterHoursMessage: '您好，診所現已關閉。門診時間為星期一至六，上午九時至下午一時及下午二時至六時。如有緊急情況，請致電999或前往急症室，謝謝。',
  },
  real_estate: {
    key: 'real_estate',
    name: 'Real Estate',
    emoji: '🏠',
    greetingText: 'Hi {{name}}, this is a follow-up call about the property at {{address}} you enquired about. Our agent would love to arrange a viewing.',
    systemPrompt: 'You are a knowledgeable AI assistant for a real estate agency. Help clients with property enquiries, viewings, and market information. Be professional and informative. Speak in Cantonese.',
    afterHoursMessage: '您好，我們的地產公司現已關閉。辦公時間為星期一至六，上午九時至下午六時。請於辦公時間內再來電，我們的物業顧問將為您提供最優質的服務，謝謝。',
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);
