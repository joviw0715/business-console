import pool from './db';
import { waReply, waListPicker, waQuickReply } from './whatsapp-reply';
import { downloadTwilioMedia } from './whatsapp-image';
import { outboundCallsQueue } from './queue';

function templateDescription(t: DbTemplate, _lang: Lang): string | undefined {
  return t.script || undefined;
}

const GEMINI_MODEL   = process.env.GEMINI_MODEL   ?? 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const CONSOLE_BASE_URL = (process.env.CONSOLE_BASE_URL ?? '').replace(/\/$/, '');

const SESSION_TIMEOUT_MINUTES = 30;

const VOICES = [
  { id: 'Cantonese_GentleLady', label: 'Jamie (Female Cantonese)' },
  { id: 'Cantonese_BrightBoy',  label: 'Kenji (Male Cantonese)'   },
  { id: 'Cantonese_WarmLady',   label: 'Anna (Female English)'    },
  { id: 'moss_audio_6b759cbc-5c17-11f1-af91-92eea1bed9bb', label: 'Moss'       },
  { id: 'moss_audio_eb6bf7b8-5c1b-11f1-8f84-faf87dcc54b3', label: 'Test Voice' },
];

type Lang = 'en' | 'zh' | 'pt';

// ─── Language detection ───────────────────────────────────────────────────────

function detectLang(text: string): Lang | null {
  // Traditional/Simplified Chinese unicode blocks
  if (/[一-鿿㐀-䶿]/.test(text)) return 'zh';
  // Portuguese markers
  if (/[àáâãçéêíóôõúü]|você|ola|olá|obrigad|criar|novo|começar/i.test(text)) return 'pt';
  // English keywords
  if (/new|start|hi|hello|create|begin/i.test(text)) return 'en';
  return null;
}

// ─── Localised strings ────────────────────────────────────────────────────────

const I18N = {
  en: {
    notAuthorised:     '⛔ This WhatsApp number is not authorised. Contact your system administrator.',
    typNew:            'Type *new* to create a campaign, or *new [template]* to skip setup.\nType *repeat* to re-run your last campaign with new contacts.',
    welcome:           '👋 Hi! Here\'s what you can do:\n\n📞 *new* — create a campaign (step-by-step)\n⚡ *new restaurant* — quick-start with a template (replace with any industry)\n🔁 *repeat* — re-run your last campaign with new contacts\n❌ *cancel* — cancel current session\n\nAvailable templates: restaurant, beauty_salon, insurance, travel_agency, medical_clinic, real_estate',
    cancelHint:        '_Type cancel at any time to stop._',
    cancelled:         '❌ Campaign creation cancelled. Type *new* to start again.',
    chooseTemplate:    (list: string) => `👋 Let\'s create a campaign!\n\nChoose an industry template (or *0* for none):\n${list}\n\n_Type cancel at any time to stop._`,
    invalidTemplate:   (max: number, list: string) => `Please reply with a number 0–${max}:\n${list}`,
    campaignName:      (label: string) => `${label}\n\nWhat\'s the campaign name?\n\n_Type cancel at any time to stop._`,
    templateSelected:  (name: string) => `*${name}* template selected ✅`,
    noTemplate:        'No template selected',
    quickStart:        (name: string, tpl: string) => `⚡ Quick start — *${tpl}* template\nCampaign: *"${name}"*\n\nNow add contacts. You can:\n• Send a *photo* of your contact list\n• Or type (one per line):\n  _Name, Phone, Schedule, Date, Remark_\n  _Name, Phone_ (other fields optional)\n\n_Type cancel at any time to stop._`,
    repeatStart:       (name: string) => `🔁 Repeating *"${name}"* with new contacts.\n\nNow add contacts:\n• Send a *photo* of your contact list\n• Or type (one per line):\n  _Name, Phone, Schedule, Date, Remark_\n  _Name, Phone_ (other fields optional)\n\n_Type cancel at any time to stop._`,
    noLastCampaign:    '⚠️ No previous campaign found. Type *new* to create one.',
    addContacts:       (name: string) => `Campaign *"${name}"* created ✅\n\nNow add contacts. You can:\n• Send a *photo* of your contact list\n• Or type (one per line):\n  _Name, Phone, Schedule, Date, Remark_\n  _Name, Phone_ (other fields optional)\n\n_Type cancel at any time to stop._`,
    extracting:        '🔍 Extracting contacts from your image…',
    extractError:      (e: string) => `❌ Could not extract contacts: ${e}\n\nTry again or type contacts manually.`,
    noContactsImage:   '⚠️ No contacts found in the image. Try again or type contacts manually.',
    noContactsText:    '⚠️ Could not parse any contacts. Format: _Name, Phone, Schedule, Date, Remark_ (one per line).',
    sendPhotoOrType:   'Send a photo or type contacts manually.',
    contactsFound:     (n: number, list: string, warn: string) => `Found *${n}* contact(s):\n\n${list}${warn}\n\nCommands:\n• *ok* — confirm and continue\n• *launch* — confirm & launch immediately\n• *fix N new_value* — fix a field\n• *del N* — remove a contact\n• *add Name, Phone, Schedule, Date, Remark* — add\n\n_Type cancel at any time to stop._`,
    invalidContacts:   (n: number) => `\n\n⚠️ ${n} contact(s) have invalid phone numbers.`,
    noValidContacts:   '❌ No contacts with valid phone numbers. Please fix them first.',
    warnInvalid:       (n: number, names: string, valid: number) => `⚠️ ${n} contact(s) will be skipped (invalid phone): ${names}\n\nReply *ok* again to proceed with ${valid} valid contact(s), or fix them first.`,
    contactsSaved:     (n: number) => `✅ ${n} contact(s) saved.`,
    chooseVoice:       (list: string) => `Choose AI voice:\n${list}\n\n_Type cancel at any time to stop._`,
    invalidVoice:      (max: number, list: string) => `Please reply 1–${max}:\n${list}`,

    // Template greeting/script confirmation
    useTemplateGreeting: (greeting: string) => `Voice saved ✅\n\nHere is the *template greeting* based on your chosen industry:\n\n_"${greeting}"_\n\nReply *ok* to use this, or send your own greeting text.\n\n_Type cancel at any time to stop._`,
    sendGreeting:      'Now send the *greeting* — the first thing the AI says when the contact picks up:\n\n_Type cancel at any time to stop._',
    greetingSaved:     'Greeting saved ✅',
    useTemplateScript: (script: string) => `Here is the *template script* based on your chosen industry:\n\n_"${script}"_\n\nReply *ok* to use this, or send your own script.\n\nTip: use {{name}}, {{date}}, {{time}} to personalise.\n\n_Type cancel at any time to stop._`,
    sendScript:        'Now send the *AI script* — instructions for what the AI should do and say during the call.\n\nTip: use {{name}}, {{date}}, {{time}} to personalise.\n\n_Type cancel at any time to stop._',
    scriptSaved:       'Script saved ✅',
    scriptTooLong:     (n: number) => `⚠️ Script is ${n} characters. Please shorten it (max ~3500).`,

    whenToCall:        `When to call?\n1. Start immediately\n2. Schedule — reply _2 YYYY-MM-DD HH:MM_\n   e.g. _2 2025-06-15 09:00_\n\n_Type cancel at any time to stop._`,
    invalidSchedule:   `Reply *1* to start immediately or *2 YYYY-MM-DD HH:MM* to schedule.\ne.g. _2 2025-06-15 09:00_`,
    invalidDate:       '❌ Invalid date. Use format: _2 YYYY-MM-DD HH:MM_',
    schedImmediate:    '⚡ Starts immediately on launch',
    schedAt:           (dt: string) => `📅 Scheduled: ${dt}`,
    summary:           (name: string, contacts: number, voice: string, sched: string) =>
      `📋 *Campaign Summary*\n\nName: *${name}*\nContacts: *${contacts}*\nVoice: *${voice}*\n${sched}\n\nReply *launch* to confirm or *cancel* to discard.`,
    confirmPrompt:     'Reply *launch* to start the campaign or *cancel* to discard.',
    sessionError:      '❌ Session error. Type *new* to restart.',
    campaignNotFound:  '❌ Campaign not found. Type *new* to restart.',
    launched:          (n: number, status: string, link: string) => `🚀 Campaign launched! ${n} call(s) ${status}.${link}\n\nType *new* to create another.`,
    launchedImmediate: 'started immediately',
    launchedScheduled: (dt: string) => `scheduled for ${dt}`,
    fixNoContact:      (n: number, total: number) => `❌ No contact #${n}. List has ${total} contact(s).`,
    fixUpdated:        (list: string) => `Updated:\n\n${list}\n\nReply *ok* to confirm or keep fixing.`,
    delNoContact:      (n: number) => `❌ No contact #${n}.`,
    delAllRemoved:     'All contacts removed. Send a photo or type contacts to start over.',
    delRemaining:      (list: string) => `Removed. Remaining:\n\n${list}\n\nReply *ok* to confirm or keep editing.`,
    addBadFormat:      '⚠️ Could not parse. Format: _add Name, Phone, Schedule, Date, Remark_',
    addAdded:          (list: string) => `Added. Current list:\n\n${list}\n\nReply *ok* to confirm.`,
    reviewRepeat:      (list: string) => `Current contacts:\n\n${list}\n\nCommands: *ok* · *fix N value* · *del N* · *add Name, Phone, Schedule, Date, Remark*`,
  },

  zh: {
    notAuthorised:     '⛔ 此 WhatsApp 號碼未獲授權，請聯絡系統管理員。',
    typNew:            '輸入 *新活動* 或 *new餐廳* 快速建立活動。\n輸入 *repeat* 重複上次活動並更換聯絡人。',
    welcome:           '👋 你好！以下係可用指令：\n\n📞 *新活動* — 建立活動（逐步引導）\n⚡ *new餐廳* — 快速建立（可換成其他行業）\n🔁 *repeat* — 重複上次活動並更換聯絡人\n❌ *cancel* — 取消目前工作階段\n\n可用範本：餐廳、美容院、保險、旅行社、醫療診所、地產',
    cancelHint:        '_輸入 cancel 可隨時取消。_',
    cancelled:         '❌ 已取消建立活動。輸入 *新活動* 重新開始。',
    chooseTemplate:    (list: string) => `👋 開始建立活動！\n\n請選擇行業範本（或輸入 *0* 略過）：\n${list}\n\n_輸入 cancel 可隨時取消。_`,
    invalidTemplate:   (max: number, list: string) => `請輸入 0–${max} 之間的數字：\n${list}`,
    campaignName:      (label: string) => `${label}\n\n請輸入活動名稱：\n\n_輸入 cancel 可隨時取消。_`,
    templateSelected:  (name: string) => `已選擇 *${name}* 範本 ✅`,
    noTemplate:        '未選擇範本',
    quickStart:        (name: string, tpl: string) => `⚡ 快速建立 — *${tpl}* 範本\n活動：*「${name}」*\n\n請新增預訂記錄，你可以：\n• 傳送聯絡人名單的*相片*\n• 或逐行輸入（每行一位）：\n  _姓名, 電話, 時間, 日期, 備註_\n  _姓名, 電話_（其他欄位可選）\n\n_輸入 cancel 可隨時取消。_`,
    repeatStart:       (name: string) => `🔁 重複活動 *「${name}」*，更換新聯絡人。\n\n請新增預訂記錄：\n• 傳送聯絡人名單的*相片*\n• 或逐行輸入（每行一位）：\n  _姓名, 電話, 時間, 日期, 備註_\n  _姓名, 電話_（其他欄位可選）\n\n_輸入 cancel 可隨時取消。_`,
    noLastCampaign:    '⚠️ 找不到上次活動，請輸入 *新活動* 建立。',
    addContacts:       (name: string) => `活動 *「${name}」* 已建立 ✅\n\n請新增預訂記錄，你可以：\n• 傳送聯絡人名單的*相片*\n• 或逐行輸入（每行一位）：\n  _姓名, 電話, 時間, 日期, 備註_\n  _姓名, 電話_（其他欄位可選）\n\n_輸入 cancel 可隨時取消。_`,
    extracting:        '🔍 正在從圖片中提取聯絡人⋯',
    extractError:      (e: string) => `❌ 無法提取聯絡人：${e}\n\n請重試或手動輸入。`,
    noContactsImage:   '⚠️ 圖片中找不到聯絡人，請重試或手動輸入。',
    noContactsText:    '⚠️ 無法解析聯絡人，格式：_姓名, 電話, 時間, 日期, 備註_（每行一位）。',
    sendPhotoOrType:   '請傳送相片或手動輸入聯絡人。',
    contactsFound:     (n: number, list: string, warn: string) => `找到 *${n}* 位聯絡人：\n\n${list}${warn}\n\n指令：\n• *ok* — 確認並繼續\n• *launch* — 確認並立即啟動\n• *fix N 新數值* — 修改欄位\n• *del N* — 刪除聯絡人\n• *add 姓名, 電話, 時間, 日期, 備註* — 新增\n\n_輸入 cancel 可隨時取消。_`,
    invalidContacts:   (n: number) => `\n\n⚠️ ${n} 位聯絡人的電話號碼無效。`,
    noValidContacts:   '❌ 沒有有效的電話號碼，請先修正。',
    warnInvalid:       (n: number, names: string, valid: number) => `⚠️ ${n} 位聯絡人的電話無效將被略過：${names}\n\n再次輸入 *ok* 以繼續處理 ${valid} 位有效聯絡人，或先修正。`,
    contactsSaved:     (n: number) => `✅ 已儲存 ${n} 位聯絡人。`,
    chooseVoice:       (list: string) => `請選擇 AI 語音：\n${list}\n\n_輸入 cancel 可隨時取消。_`,
    invalidVoice:      (max: number, list: string) => `請輸入 1–${max}：\n${list}`,

    useTemplateGreeting: (greeting: string) => `語音已儲存 ✅\n\n以下係根據你所選行業的*範本問候語*：\n\n_「${greeting}」_\n\n輸入 *ok* 使用此問候語，或直接傳送你自己的問候語。\n\n_輸入 cancel 可隨時取消。_`,
    sendGreeting:      '請傳送*問候語* — 即 AI 接通後第一句說話：\n\n_輸入 cancel 可隨時取消。_',
    greetingSaved:     '問候語已儲存 ✅',
    useTemplateScript: (script: string) => `以下係根據你所選行業的*範本腳本*：\n\n_「${script}」_\n\n輸入 *ok* 使用此腳本，或直接傳送你自己的腳本。\n\n提示：可使用 {{name}}、{{date}}、{{time}} 個人化。\n\n_輸入 cancel 可隨時取消。_`,
    sendScript:        '請傳送 *AI 腳本* — 即 AI 在通話中的指示。\n\n提示：可使用 {{name}}、{{date}}、{{time}} 個人化。\n\n_輸入 cancel 可隨時取消。_',
    scriptSaved:       '腳本已儲存 ✅',
    scriptTooLong:     (n: number) => `⚠️ 腳本有 ${n} 個字元，請縮短（最多約 3500 字元）。`,

    whenToCall:        `何時致電？\n1. 立即開始\n2. 排程 — 輸入 _2 YYYY-MM-DD HH:MM_\n   例：_2 2025-06-15 09:00_\n\n_輸入 cancel 可隨時取消。_`,
    invalidSchedule:   `輸入 *1* 立即開始或 *2 YYYY-MM-DD HH:MM* 排程。\n例：_2 2025-06-15 09:00_`,
    invalidDate:       '❌ 日期格式無效，請使用：_2 YYYY-MM-DD HH:MM_',
    schedImmediate:    '⚡ 確認後立即開始',
    schedAt:           (dt: string) => `📅 排程時間：${dt}`,
    summary:           (name: string, contacts: number, voice: string, sched: string) =>
      `📋 *活動摘要*\n\n名稱：*${name}*\n聯絡人：*${contacts}*\n語音：*${voice}*\n${sched}\n\n輸入 *launch* 確認或 *cancel* 取消。`,
    confirmPrompt:     '輸入 *launch* 開始活動或 *cancel* 取消。',
    sessionError:      '❌ 工作階段錯誤，請輸入 *新活動* 重新開始。',
    campaignNotFound:  '❌ 找不到活動，請輸入 *新活動* 重新開始。',
    launched:          (n: number, status: string, link: string) => `🚀 活動已啟動！${n} 個通話${status}。${link}\n\n輸入 *新活動* 建立另一個活動。`,
    launchedImmediate: '即時撥出',
    launchedScheduled: (dt: string) => `已排程於 ${dt}`,
    fixNoContact:      (n: number, total: number) => `❌ 沒有第 ${n} 位聯絡人，名單共有 ${total} 位。`,
    fixUpdated:        (list: string) => `已更新：\n\n${list}\n\n輸入 *ok* 確認或繼續修改。`,
    delNoContact:      (n: number) => `❌ 沒有第 ${n} 位聯絡人。`,
    delAllRemoved:     '已刪除所有聯絡人，請傳送相片或手動輸入以重新開始。',
    delRemaining:      (list: string) => `已刪除。剩餘聯絡人：\n\n${list}\n\n輸入 *ok* 確認或繼續編輯。`,
    addBadFormat:      '⚠️ 無法解析，格式：_add 姓名, 電話, 時間, 日期, 備註_',
    addAdded:          (list: string) => `已新增。目前名單：\n\n${list}\n\n輸入 *ok* 確認。`,
    reviewRepeat:      (list: string) => `目前聯絡人：\n\n${list}\n\n指令：*ok* · *fix N 數值* · *del N* · *add 姓名, 電話, 時間, 日期, 備註*`,
  },

  pt: {
    notAuthorised:     '⛔ Este número de WhatsApp não está autorizado. Contacte o administrador do sistema.',
    typNew:            'Escreva *novo* para criar uma campanha, ou *novo [modelo]* para saltar a configuração.\nEscreva *repeat* para repetir a última campanha com novos contactos.',
    welcome:           '👋 Olá! O que pode fazer:\n\n📞 *novo* — criar uma campanha (passo a passo)\n⚡ *novo restaurante* — início rápido com modelo\n🔁 *repeat* — repetir a última campanha com novos contactos\n❌ *cancel* — cancelar sessão atual\n\nModelos disponíveis: restaurant, beauty_salon, insurance, travel_agency, medical_clinic, real_estate',
    cancelHint:        '_Escreva cancel a qualquer momento para parar._',
    cancelled:         '❌ Criação de campanha cancelada. Escreva *novo* para recomeçar.',
    chooseTemplate:    (list: string) => `👋 Vamos criar uma campanha!\n\nEscolha um modelo de setor (ou *0* para nenhum):\n${list}\n\n_Escreva cancel a qualquer momento para parar._`,
    invalidTemplate:   (max: number, list: string) => `Por favor responda com um número de 0 a ${max}:\n${list}`,
    campaignName:      (label: string) => `${label}\n\nQual é o nome da campanha?\n\n_Escreva cancel a qualquer momento para parar._`,
    templateSelected:  (name: string) => `Modelo *${name}* selecionado ✅`,
    noTemplate:        'Nenhum modelo selecionado',
    quickStart:        (name: string, tpl: string) => `⚡ Início rápido — modelo *${tpl}*\nCampanha: *"${name}"*\n\nAgora adicione contactos:\n• Envie uma *foto* da sua lista\n• Ou escreva (um por linha):\n  _Nome, +Telefone, Nota_\n  _+Telefone_ (nome opcional)\n\n_Escreva cancel a qualquer momento para parar._`,
    repeatStart:       (name: string) => `🔁 A repetir *"${name}"* com novos contactos.\n\nMesma voz e script de antes. Adicione contactos:\n• Envie uma *foto* da lista\n• Ou escreva (um por linha):\n  _Nome, +Telefone, Nota_\n  _+Telefone_ (nome opcional)\n\n_Escreva cancel a qualquer momento para parar._`,
    noLastCampaign:    '⚠️ Nenhuma campanha anterior encontrada. Escreva *novo* para criar uma.',
    addContacts:       (name: string) => `Campanha *"${name}"* criada ✅\n\nAgora adicione contactos. Pode:\n• Enviar uma *foto* da sua lista de contactos\n• Ou escrever contactos (um por linha):\n  _Nome, +Telefone, Nota_\n  _+Telefone_ (nome opcional)\n\n_Escreva cancel a qualquer momento para parar._`,
    extracting:        '🔍 A extrair contactos da imagem…',
    extractError:      (e: string) => `❌ Não foi possível extrair contactos: ${e}\n\nTente novamente ou escreva os contactos manualmente.`,
    noContactsImage:   '⚠️ Nenhum contacto encontrado na imagem. Tente novamente ou escreva manualmente.',
    noContactsText:    '⚠️ Não foi possível analisar nenhum contacto. Formato: _Nome, +Telefone, Nota_ (um por linha).',
    sendPhotoOrType:   'Envie uma foto ou escreva os contactos manualmente.',
    contactsFound:     (n: number, list: string, warn: string) => `Encontrados *${n}* contacto(s):\n\n${list}${warn}\n\nComandos:\n• *ok* — confirmar e continuar\n• *launch* — confirmar e lançar imediatamente\n• *fix N novo_valor* — corrigir um campo\n• *del N* — remover um contacto\n• *add Nome, +Telefone, Nota* — adicionar contacto\n\n_Escreva cancel a qualquer momento para parar._`,
    invalidContacts:   (n: number) => `\n\n⚠️ ${n} contacto(s) têm números de telefone inválidos.`,
    noValidContacts:   '❌ Nenhum contacto com número de telefone válido. Por favor corrija-os.',
    warnInvalid:       (n: number, names: string, valid: number) => `⚠️ ${n} contacto(s) serão ignorados (telefone inválido): ${names}\n\nResponda *ok* novamente para continuar com ${valid} contacto(s) válido(s), ou corrija-os primeiro.`,
    contactsSaved:     (n: number) => `✅ ${n} contacto(s) guardados.`,
    chooseVoice:       (list: string) => `Escolha a voz da IA:\n${list}\n\n_Escreva cancel a qualquer momento para parar._`,
    invalidVoice:      (max: number, list: string) => `Por favor responda de 1 a ${max}:\n${list}`,

    useTemplateGreeting: (greeting: string) => `Voz guardada ✅\n\nAqui está a *saudação do modelo* com base no setor escolhido:\n\n_"${greeting}"_\n\nResponda *ok* para usar esta saudação, ou envie a sua própria.\n\n_Escreva cancel a qualquer momento para parar._`,
    sendGreeting:      'Envie agora a *saudação* — a primeira coisa que a IA diz quando o contacto atende:\n\n_Escreva cancel a qualquer momento para parar._',
    greetingSaved:     'Saudação guardada ✅',
    useTemplateScript: (script: string) => `Aqui está o *script do modelo* com base no setor escolhido:\n\n_"${script}"_\n\nResponda *ok* para usar este script, ou envie o seu próprio.\n\nDica: use {{name}}, {{date}}, {{time}} para personalizar.\n\n_Escreva cancel a qualquer momento para parar._`,
    sendScript:        `Envie agora o *script da IA* — instruções sobre o que a IA deve fazer e dizer durante a chamada.\n\nDica: use {{name}}, {{date}}, {{time}} para personalizar.\n\n_Escreva cancel a qualquer momento para parar._`,
    scriptSaved:       'Script guardado ✅',
    scriptTooLong:     (n: number) => `⚠️ O script tem ${n} caracteres. Por favor encurte-o (máx. ~3500).`,

    whenToCall:        `Quando ligar?\n1. Iniciar imediatamente\n2. Agendar — responda _2 YYYY-MM-DD HH:MM_\n   ex. _2 2025-06-15 09:00_\n\n_Escreva cancel a qualquer momento para parar._`,
    invalidSchedule:   `Responda *1* para iniciar imediatamente ou *2 YYYY-MM-DD HH:MM* para agendar.\nex. _2 2025-06-15 09:00_`,
    invalidDate:       '❌ Data inválida. Use o formato: _2 YYYY-MM-DD HH:MM_',
    schedImmediate:    '⚡ Inicia imediatamente após confirmação',
    schedAt:           (dt: string) => `📅 Agendado para: ${dt}`,
    summary:           (name: string, contacts: number, voice: string, sched: string) =>
      `📋 *Resumo da campanha*\n\nNome: *${name}*\nContactos: *${contacts}*\nVoz: *${voice}*\n${sched}\n\nResponda *launch* para confirmar ou *cancel* para descartar.`,
    confirmPrompt:     'Responda *launch* para iniciar a campanha ou *cancel* para descartar.',
    sessionError:      '❌ Erro de sessão. Escreva *novo* para recomeçar.',
    campaignNotFound:  '❌ Campanha não encontrada. Escreva *novo* para recomeçar.',
    launched:          (n: number, status: string, link: string) => `🚀 Campanha lançada! ${n} chamada(s) ${status}.${link}\n\nEscreva *novo* para criar outra.`,
    launchedImmediate: 'iniciadas imediatamente',
    launchedScheduled: (dt: string) => `agendadas para ${dt}`,
    fixNoContact:      (n: number, total: number) => `❌ Não existe contacto #${n}. A lista tem ${total} contacto(s).`,
    fixUpdated:        (list: string) => `Atualizado:\n\n${list}\n\nResponda *ok* para confirmar ou continue a corrigir.`,
    delNoContact:      (n: number) => `❌ Não existe contacto #${n}.`,
    delAllRemoved:     'Todos os contactos removidos. Envie uma foto ou escreva contactos para recomeçar.',
    delRemaining:      (list: string) => `Removido. Restantes:\n\n${list}\n\nResponda *ok* para confirmar ou continue a editar.`,
    addBadFormat:      '⚠️ Não foi possível analisar. Formato: _add Nome, +Telefone, Nota_',
    addAdded:          (list: string) => `Adicionado. Lista atual:\n\n${list}\n\nResponda *ok* para confirmar.`,
    reviewRepeat:      (list: string) => `Contactos atuais:\n\n${list}\n\nComandos: *ok* · *fix N valor* · *del N* · *add Nome, +Telefone, Nota*`,
  },
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── DB template type ────────────────────────────────────────────────────────

interface DbTemplate {
  id: number;
  name: string;
  emoji: string;
  industry: string | null;
  voice_id: string;
  script: string;
  greeting: string;
  is_builtin: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowStamp(): string {
  const d = new Date();
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${d.getFullYear().toString().slice(2)}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export interface PendingContact {
  name: string;
  phone: string;
  custom_field: string;
}

type BotState =
  | 'idle'
  | 'awaiting_template'
  | 'awaiting_name'
  | 'awaiting_contacts'
  | 'reviewing_contacts'
  | 'awaiting_campaign_confirm'    // new: summary + rename before launch
  | 'awaiting_voice'
  | 'awaiting_greeting'
  | 'awaiting_greeting_confirm'
  | 'awaiting_script'
  | 'awaiting_script_confirm'
  | 'awaiting_schedule'
  | 'awaiting_confirm'
  | 'creating_tpl_voice'           // new: template creation step 1
  | 'creating_tpl_lang'            // new: template creation step 2
  | 'creating_tpl_greeting'        // new: template creation step 3
  | 'creating_tpl_wa'              // new: template creation step 4 (WA confirmation)
  | 'creating_tpl_name';           // new: template creation step 5

interface Session {
  state: BotState;
  lang: Lang;
  campaign_id: number | null;
  template_key: string | null;
  pending_contacts: PendingContact[] | null;
  campaign_name: string | null;
  tpl_voice_id: string | null;
  tpl_lang: string | null;
  tpl_greeting: string | null;
  tpl_wa_enabled?: boolean | null;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function isAdmin(phone: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT 1 FROM whatsapp_admins WHERE phone = $1',
    [phone],
  );
  return rows.length > 0;
}

async function getSession(phone: string): Promise<Session> {
  await pool.query(
    `DELETE FROM whatsapp_admin_sessions
     WHERE admin_phone = $1
       AND updated_at < NOW() - INTERVAL '${SESSION_TIMEOUT_MINUTES} minutes'`,
    [phone],
  );
  const { rows } = await pool.query(
    `SELECT state, lang, campaign_id, template_key, pending_contacts,
            campaign_name, tpl_voice_id, tpl_lang, tpl_greeting
     FROM whatsapp_admin_sessions WHERE admin_phone = $1`,
    [phone],
  );
  if (rows.length === 0) return {
    state: 'idle', lang: 'en', campaign_id: null, template_key: null,
    pending_contacts: null, campaign_name: null, tpl_voice_id: null,
    tpl_lang: null, tpl_greeting: null,
  };
  return {
    state:            rows[0].state as BotState,
    lang:             (rows[0].lang ?? 'en') as Lang,
    campaign_id:      rows[0].campaign_id ?? null,
    template_key:     rows[0].template_key ?? null,
    pending_contacts: rows[0].pending_contacts ?? null,
    campaign_name:    rows[0].campaign_name ?? null,
    tpl_voice_id:     rows[0].tpl_voice_id ?? null,
    tpl_lang:         rows[0].tpl_lang ?? null,
    tpl_greeting:     rows[0].tpl_greeting ?? null,
    tpl_wa_enabled:   rows[0].tpl_wa_enabled ?? null,
  };
}

async function saveSession(phone: string, patch: Partial<Session>): Promise<void> {
  await pool.query(
    `INSERT INTO whatsapp_admin_sessions
       (admin_phone, state, lang, campaign_id, template_key, pending_contacts,
        campaign_name, tpl_voice_id, tpl_lang, tpl_greeting, tpl_wa_enabled, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
     ON CONFLICT (admin_phone) DO UPDATE SET
       state            = EXCLUDED.state,
       lang             = EXCLUDED.lang,
       campaign_id      = EXCLUDED.campaign_id,
       template_key     = EXCLUDED.template_key,
       pending_contacts = EXCLUDED.pending_contacts,
       campaign_name    = EXCLUDED.campaign_name,
       tpl_voice_id     = EXCLUDED.tpl_voice_id,
       tpl_lang         = EXCLUDED.tpl_lang,
       tpl_greeting     = EXCLUDED.tpl_greeting,
       tpl_wa_enabled   = EXCLUDED.tpl_wa_enabled,
       updated_at       = NOW()`,
    [
      phone,
      patch.state ?? 'idle',
      patch.lang ?? 'en',
      patch.campaign_id ?? null,
      patch.template_key ?? null,
      patch.pending_contacts ? JSON.stringify(patch.pending_contacts) : null,
      patch.campaign_name ?? null,
      patch.tpl_voice_id ?? null,
      patch.tpl_lang ?? null,
      patch.tpl_greeting ?? null,
      patch.tpl_wa_enabled ?? null,
    ],
  );
}

async function clearSession(phone: string): Promise<void> {
  await pool.query('DELETE FROM whatsapp_admin_sessions WHERE admin_phone = $1', [phone]);
}

// ─── Contact helpers ──────────────────────────────────────────────────────────

const DEFAULT_AREA_CODE = (process.env.DEFAULT_AREA_CODE ?? '+852').trim();

function normalizePhone(phone: string): string {
  const cleaned = phone.trim();
  if (!cleaned) return cleaned;
  // Strip spaces, dashes, dots used as separators, keeping leading +
  const stripped = cleaned.replace(/[\s\-\.]/g, '');
  if (stripped.startsWith('+')) return stripped;
  // Remove leading zeros then prepend area code
  const digits = stripped.replace(/^0+/, '');
  return `${DEFAULT_AREA_CODE}${digits}`;
}

function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && phone.trim().startsWith('+');
}

function formatContactList(contacts: PendingContact[]): string {
  return contacts.map((c, i) => {
    const ok = validatePhone(c.phone);
    const flag = ok ? '✅' : '⚠️';
    const name = c.name || '(no name)';
    const note = c.custom_field ? ` · ${c.custom_field}` : '';
    return `${i + 1}. ${flag} ${name} · ${c.phone}${note}`;
  }).join('\n');
}

// ─── Gemini Vision extraction ─────────────────────────────────────────────────

async function extractContactsFromImage(base64: string, mimeType: string): Promise<PendingContact[]> {
  const prompt = `Extract all contact entries from this image. Each entry should have a name, phone number, and optionally a time/appointment/note field.
Return ONLY a JSON array with no markdown, no explanation. Format:
[{"name":"...","phone":"...","custom_field":"..."}]
- phone: include country code if present, keep + prefix (e.g. +85212345678)
- custom_field: appointment time, note, or any other field shown (empty string "" if none)
- Skip rows that have no phone number
- If the image contains a table or list, extract every row`;

  const body = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
    generationConfig: { temperature: 0, response_mime_type: 'application/json' },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  return JSON.parse(raw) as PendingContact[];
}

// ─── Manual contact parser ────────────────────────────────────────────────────

function parseManualContacts(text: string): PendingContact[] {
  return text.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Accept both English comma and Chinese comma as separator
      // Format: Name, Telephone[, Schedule][, Date][, Remark]
      const parts = line.split(/[,，]/).map((p) => p.trim());
      const name     = parts[0] ?? '';
      const phone    = normalizePhone(parts[1] ?? parts[0] ?? '');
      const schedule = parts[2] ?? '';
      const date     = parts[3] ?? '';
      const remark   = parts[4] ?? (parts.length === 3 ? parts[2] : '');
      const custom_field = JSON.stringify({ time: schedule, date, remarks: remark, party_size: remark });
      // If only 1 part, treat it as phone-only
      if (parts.length === 1) return { name: '', phone: normalizePhone(parts[0]), custom_field: '' };
      return { name, phone, custom_field };
    })
    .filter((c) => c.phone.replace(/\D/g, '').length >= 6);
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export interface IncomingMessage {
  from: string;
  body: string;
  numMedia: number;
  mediaUrl?: string;
  mediaContentType?: string;
}

export async function handleAdminMessage(msg: IncomingMessage): Promise<void> {
  const phone = msg.from;

  if (!(await isAdmin(phone))) {
    await waReply(phone, I18N.en.notAuthorised);
    return;
  }

  const session = await getSession(phone);
  const text = msg.body.trim();
  const textLower = text.toLowerCase();

  // Detect language on first message or idle state; persist to session.
  // Skip detection for short button payloads (repeat, cancel, now etc.) to avoid
  // misidentifying them as English and overriding the user's preferred language.
  let lang: Lang = session.lang;
  if (session.state === 'idle') {
    const isButtonPayload = text.length <= 20 && !/[一-鿿　-〿]/.test(text);
    if (!isButtonPayload) {
      const detected = detectLang(text);
      if (detected) lang = detected;
    }
  }

  const T = I18N[lang];

  console.log(`[handleAdminMessage] phone=${phone} state=${session.state} text="${text.slice(0,60)}"`);

  // Global cancel
  if (textLower === 'cancel' || textLower === 'quit' || textLower === '取消') {
    if (session.campaign_id) {
      await pool.query("DELETE FROM campaigns WHERE id = $1 AND status = 'draft'", [session.campaign_id]);
    }
    await clearSession(phone);
    await waReply(phone, T.cancelled);
    return;
  }

  // Global new範本 — can be invoked from any state
  if (textLower.match(/^(?:new|novo|新)[\s]*(?:範本|template|modelo)/i)) {
    await saveSession(phone, {
      state: 'creating_tpl_voice', lang, campaign_id: null, template_key: null,
      pending_contacts: null, campaign_name: null, tpl_voice_id: null, tpl_lang: null, tpl_greeting: null,
    });
    const tplBodyText = lang === 'zh' ? '📋 建立新範本 — 第 1 步：選擇語音' : lang === 'pt' ? '📋 Criar modelo — Passo 1: Escolha a voz' : '📋 New template — Step 1: Choose voice';
    const tplListLabel = lang === 'zh' ? '選擇語音' : lang === 'pt' ? 'Escolher voz' : 'Choose voice';
    await waListPicker(phone, tplBodyText, tplListLabel, VOICES.map((v) => ({ id: v.id, title: v.label })));
    return;
  }

  switch (session.state) {
    case 'idle':                     return handleIdle(phone, textLower, lang);
    case 'awaiting_template':        return handleTemplate(phone, text, { ...session, lang });
    case 'awaiting_name':            return handleName(phone, { ...session, lang }, text);
    case 'awaiting_contacts':        return handleContacts(phone, { ...session, lang }, msg);
    case 'reviewing_contacts':       return handleReview(phone, { ...session, lang }, text);
    case 'awaiting_campaign_confirm':return handleCampaignConfirm(phone, { ...session, lang }, text);
    case 'creating_tpl_voice':       return handleTplVoice(phone, { ...session, lang }, text);
    case 'creating_tpl_lang':        return handleTplLang(phone, { ...session, lang }, text);
    case 'creating_tpl_greeting':    return handleTplGreeting(phone, { ...session, lang }, text);
    case 'creating_tpl_wa':          return handleTplWa(phone, { ...session, lang }, text);
    case 'creating_tpl_name':        return handleTplName(phone, { ...session, lang }, text);
    case 'awaiting_voice':           return handleVoice(phone, { ...session, lang }, text);
    case 'awaiting_greeting_confirm':return handleGreetingConfirm(phone, { ...session, lang }, text);
    case 'awaiting_greeting':        return handleGreeting(phone, { ...session, lang }, text);
    case 'awaiting_script_confirm':  return handleScriptConfirm(phone, { ...session, lang }, text);
    case 'awaiting_script':          return handleScript(phone, { ...session, lang }, text);
    case 'awaiting_schedule':        return handleSchedule(phone, { ...session, lang }, text);
    case 'awaiting_confirm':         return handleConfirm(phone, { ...session, lang }, text);
    default:
      await clearSession(phone);
      return handleIdle(phone, textLower, lang);
  }
}

// ─── State handlers ───────────────────────────────────────────────────────────

async function handleIdle(phone: string, textLower: string, lang: Lang): Promise<void> {
  const triggers = ['new', 'start', '新', '新活動', '開始', 'novo', 'criar'];
  const greetings = ['hi', 'hello', 'ola', 'olá', '你好', '哈囉'];
  const T = I18N[lang];

  // ── hi/hello — show command menu as quick reply buttons ─────────────────
  if (greetings.some((k) => textLower.includes(k))) {
    // Persist detected language so button taps in the next turn use the right language
    await saveSession(phone, { state: 'idle', lang, campaign_id: null, template_key: null, pending_contacts: null, campaign_name: null, tpl_voice_id: null, tpl_lang: null, tpl_greeting: null });
    const bodyText = lang === 'zh'
      ? '👋 你好！請選擇，或直接輸入：\n\n• *new餐廳* — 快速建立（可換成其他行業）\n• *new範本* — 建立新範本'
      : lang === 'pt'
      ? '👋 Olá! Selecione, ou escreva:\n\n• *novo restaurante* — início rápido\n• *novo modelo* — criar modelo'
      : '👋 Hi! Choose an option, or type:\n\n• *new restaurant* — quick start (swap industry)\n• *new template* — create a template';
    await waQuickReply(phone, bodyText, [
      { id: lang === 'zh' ? '新活動' : lang === 'pt' ? 'novo' : 'new', title: lang === 'zh' ? '📞 新活動'    : lang === 'pt' ? '📞 Nova campanha' : '📞 New campaign'  },
      { id: 'repeat', title: lang === 'zh' ? '🔁 重複上次' : lang === 'pt' ? '🔁 Repetir'   : '🔁 Repeat last' },
      { id: 'cancel', title: lang === 'zh' ? '❌ 取消'     : lang === 'pt' ? '❌ Cancelar'  : '❌ Cancel'      },
    ]);
    return;
  }

  // ── new範本 / new template — start template creation flow ────────────────
  if (textLower.match(/^(?:new|novo|新)[\s]*(?:範本|template|modelo)/i)) {
    await saveSession(phone, {
      state: 'creating_tpl_voice', lang, campaign_id: null, template_key: null,
      pending_contacts: null, campaign_name: null, tpl_voice_id: null, tpl_lang: null, tpl_greeting: null,
    });
    const bodyText = lang === 'zh' ? '📋 建立新範本 — 第 1 步：選擇語音' : lang === 'pt' ? '📋 Criar modelo — Passo 1: Escolha a voz' : '📋 New template — Step 1: Choose voice';
    const listLabel = lang === 'zh' ? '選擇語音' : lang === 'pt' ? 'Escolher voz' : 'Choose voice';
    await waListPicker(phone, bodyText, listLabel, VOICES.map((v) => ({ id: v.id, title: v.label })));
    return;
  }

  // ── /repeat — clone last campaign config, skip to contacts ───────────────
  if (textLower === 'repeat' || textLower === '重複' || textLower === 'repetir') {
    const { rows } = await pool.query(
      `SELECT c.id, c.name, cc.system_prompt, cc.voice_id, cc.greeting_text,
              cc.max_retries, cc.call_timeout_sec, cc.webhook_url, cc.concurrency
       FROM campaigns c
       JOIN campaign_config cc ON cc.campaign_id = c.id
       ORDER BY c.created_at DESC LIMIT 1`,
    );
    if (rows.length === 0) {
      await waReply(phone, T.noLastCampaign);
      return;
    }
    const src = rows[0];

    // Create a fresh draft cloning the config
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: newRows } = await client.query(
        `INSERT INTO campaigns (name, status, campaign_template_id) VALUES ($1, 'draft', $2) RETURNING id`,
        [src.name, null],
      );
      const newId: number = newRows[0].id;
      await client.query(
        `INSERT INTO campaign_config
           (campaign_id, system_prompt, voice_id, greeting_text, max_retries, call_timeout_sec, webhook_url, concurrency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [newId, src.system_prompt ?? '', src.voice_id ?? 'Cantonese_GentleLady',
         src.greeting_text ?? '', src.max_retries ?? 2, src.call_timeout_sec ?? 60,
         src.webhook_url ?? null, src.concurrency ?? 3],
      );
      await client.query('COMMIT');
      await saveSession(phone, {
        state: 'awaiting_contacts', lang, campaign_id: newId,
        template_key: null, pending_contacts: null,
      });
      await waReply(phone, T.repeatStart(src.name));
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return;
  }

  // ── /new [template] — quick-start with named DB template ────────────────
  const newWithTemplate = textLower.match(/^(?:new|novo|新活動)\s*(.+)$/i);
  if (newWithTemplate) {
    const query = newWithTemplate[1].trim().toLowerCase();
    const { rows: dbTemplates } = await pool.query<DbTemplate>('SELECT * FROM campaign_templates ORDER BY is_builtin DESC, created_at ASC');
    const tpl = dbTemplates.find((t) =>
      t.name.toLowerCase().includes(query) ||
      (t.industry ?? '').toLowerCase().includes(query),
    );
    if (tpl) {
      const campaignName = nowStamp();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `INSERT INTO campaigns (name, status, campaign_template_id) VALUES ($1, 'draft', $2) RETURNING id`,
          [campaignName, tpl.id],
        );
        const newId: number = rows[0].id;
        await client.query(
          `INSERT INTO campaign_config (campaign_id, system_prompt, voice_id, greeting_text) VALUES ($1, $2, $3, $4)`,
          [newId, tpl.script, tpl.voice_id, tpl.greeting],
        );
        await client.query('COMMIT');
        await saveSession(phone, {
          state: 'awaiting_contacts', lang, campaign_id: newId,
          template_key: String(tpl.id), pending_contacts: null,
          campaign_name: campaignName,
        });
        const bodyText = lang === 'zh'
          ? `✅ 已選擇「${tpl.emoji} ${tpl.name}」\n\n請新增預訂記錄：\n• 傳送聯絡人名單的*相片*\n• 或逐行輸入（每行一位）：\n  _姓名, 電話, 時間, 日期, 備註_\n\n_輸入 cancel 可隨時取消。_`
          : `✅ Template "${tpl.emoji} ${tpl.name}" selected\n\nNow add contacts:\n• Send a *photo* of your list\n• Or type (one per line):\n  _Name, Phone, Schedule, Date, Remark_\n\n_Type cancel at any time._`;
        await waReply(phone, bodyText);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      return;
    }
    // Template not recognised — fall through to normal flow
  }

  // ── Normal /new flow — show DB template list picker ──────────────────────
  if (triggers.some((k) => textLower.includes(k))) {
    await saveSession(phone, { state: 'awaiting_template', lang, campaign_id: null, template_key: null, pending_contacts: null });
    const { rows: dbTemplates } = await pool.query<DbTemplate>('SELECT * FROM campaign_templates ORDER BY is_builtin DESC, created_at ASC');
    const listLabel = lang === 'zh' ? '選擇範本' : lang === 'pt' ? 'Escolher modelo' : 'Choose template';
    const bodyText = lang === 'zh' ? '🍽️ 選擇活動範本：' : lang === 'pt' ? 'Escolha um modelo:' : 'Choose a campaign template:';
    await waListPicker(phone, bodyText, listLabel,
      dbTemplates.map((t) => ({ id: String(t.id), title: `${t.emoji} ${t.name}`, description: templateDescription(t, lang) })),
    );
  } else {
    await waReply(phone, I18N[lang].typNew);
  }
}

async function handleTemplate(phone: string, text: string, session: Session): Promise<void> {
  const { rows: dbTemplates } = await pool.query<DbTemplate>('SELECT * FROM campaign_templates ORDER BY is_builtin DESC, created_at ASC');

  async function sendTemplatePicker() {
    const listLabel = session.lang === 'zh' ? '選擇範本' : session.lang === 'pt' ? 'Escolher modelo' : 'Choose template';
    const bodyText = session.lang === 'zh' ? '🍽️ 選擇活動範本：' : session.lang === 'pt' ? 'Escolha um modelo:' : 'Choose a campaign template:';
    await waListPicker(phone, bodyText, listLabel,
      dbTemplates.map((t) => ({ id: String(t.id), title: `${t.emoji} ${t.name}`, description: templateDescription(t, session.lang) })),
    );
  }

  // Try by DB id first (list picker sends the id), then by 1-based position (fallback plain text)
  let tpl: DbTemplate | null = null;
  const dbId = parseInt(text, 10);
  if (!isNaN(dbId)) {
    // Direct DB id match
    tpl = dbTemplates.find((t) => t.id === dbId) ?? null;
    // If no direct match, treat as 1-based positional index (fallback numbered list)
    if (!tpl && dbId >= 1 && dbId <= dbTemplates.length) {
      tpl = dbTemplates[dbId - 1];
    }
  } else {
    // Try name match (user typed template name)
    const q = text.trim().toLowerCase();
    tpl = dbTemplates.find((t) => t.name.toLowerCase().includes(q)) ?? null;
  }

  if (!tpl) {
    await sendTemplatePicker();
    return;
  }

  // Create draft campaign with template config
  const campaignName = nowStamp();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: cr } = await client.query(
      `INSERT INTO campaigns (name, status, campaign_template_id) VALUES ($1, 'draft', $2) RETURNING id`,
      [campaignName, tpl.id],
    );
    const newId: number = cr[0].id;
    await client.query(
      `INSERT INTO campaign_config (campaign_id, system_prompt, voice_id, greeting_text) VALUES ($1, $2, $3, $4)`,
      [newId, tpl.script, tpl.voice_id, tpl.greeting],
    );
    await client.query('COMMIT');
    await saveSession(phone, {
      ...session, state: 'awaiting_contacts', campaign_id: newId,
      template_key: String(tpl.id), campaign_name: campaignName, pending_contacts: null,
    });
    const bodyText = session.lang === 'zh'
      ? `✅ 已選擇「${tpl.emoji} ${tpl.name}」\n\n請新增預訂記錄：\n• 傳送聯絡人名單的*相片*\n• 或逐行輸入（每行一位）：\n  _姓名, 電話, 時間, 日期, 備註_\n\n_輸入 cancel 可隨時取消。_`
      : `✅ Template "${tpl.emoji} ${tpl.name}" selected\n\nNow add contacts:\n• Send a *photo* of your list\n• Or type (one per line):\n  _Name, Phone, Schedule, Date, Remark_\n\n_Type cancel at any time._`;
    await waReply(phone, bodyText);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function handleName(phone: string, session: Session, text: string): Promise<void> {
  const T = I18N[session.lang];
  if (!text || text.length < 1) {
    await waReply(phone, T.campaignName(''));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO campaigns (name, status, campaign_template_id) VALUES ($1, 'draft', $2) RETURNING id`,
      [text, null],
    );
    const campaignId: number = rows[0].id;
    await client.query(
      `INSERT INTO campaign_config (campaign_id, system_prompt, greeting_text) VALUES ($1, '', '')`,
      [campaignId],
    );
    await client.query('COMMIT');
    await saveSession(phone, { ...session, state: 'awaiting_contacts', campaign_id: campaignId, pending_contacts: null });
    await waReply(phone, T.addContacts(text));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function sendContactReview(phone: string, lang: Lang, n: number, list: string, warn: string): Promise<void> {
  const T = I18N[lang];
  const freeTextHint = lang === 'zh'
    ? `\n\n自由輸入：\n• *fix N 新數值* — 修改欄位\n• *del N* — 刪除聯絡人\n• *add 姓名, 電話, 時間, 日期, 備註* — 新增聯絡人`
    : lang === 'pt'
    ? `\n\nComandos manuais:\n• *fix N novo_valor* — corrigir\n• *del N* — remover\n• *add Nome, +Tel, Nota* — adicionar`
    : `\n\nFree-text: *fix N value* · *del N* · *add Name, Phone, Schedule, Date, Remark*`;
  const body = `${T.contactsSaved(n)}\n\n${list}${warn}${freeTextHint}`;
  await waQuickReply(phone, body, [
    { id: 'ok',     title: lang === 'zh' ? '✅ 確認繼續' : lang === 'pt' ? '✅ Confirmar' : '✅ Confirm' },
    { id: 'launch', title: lang === 'zh' ? '🚀 立即啟動' : lang === 'pt' ? '🚀 Lançar'   : '🚀 Launch'  },
    { id: 'cancel', title: lang === 'zh' ? '❌ 取消'     : lang === 'pt' ? '❌ Cancelar'  : '❌ Cancel'  },
  ]);
}

async function handleContacts(phone: string, session: Session, msg: IncomingMessage): Promise<void> {
  const T = I18N[session.lang];
  let contacts: PendingContact[] = [];

  if (msg.numMedia > 0 && msg.mediaUrl) {
    await waReply(phone, T.extracting);
    try {
      const { base64, mimeType } = await downloadTwilioMedia(msg.mediaUrl);
      contacts = await extractContactsFromImage(base64, mimeType);
      // Normalize phones — prepend default area code if no country code present
      contacts = contacts.map((c) => ({ ...c, phone: normalizePhone(c.phone) }));
    } catch (err) {
      await waReply(phone, T.extractError(err instanceof Error ? err.message : String(err)));
      return;
    }
    if (contacts.length === 0) {
      await waReply(phone, T.noContactsImage);
      return;
    }
  } else if (msg.body.trim()) {
    contacts = parseManualContacts(msg.body.trim());
    if (contacts.length === 0) {
      await waReply(phone, T.noContactsText);
      return;
    }
  } else {
    await waReply(phone, T.sendPhotoOrType);
    return;
  }

  await saveSession(phone, { ...session, state: 'reviewing_contacts', pending_contacts: contacts });
  const list = formatContactList(contacts);
  const warnings = contacts.filter((c) => !validatePhone(c.phone)).length;
  const warn = warnings > 0 ? T.invalidContacts(warnings) : '';
  await sendContactReview(phone, session.lang, contacts.length, list, warn);
}

async function handleReview(phone: string, session: Session, text: string): Promise<void> {
  const T = I18N[session.lang];
  const contacts = session.pending_contacts ?? [];
  const textLower = text.toLowerCase();

  console.log(`[handleReview] phone=${phone} text="${text}" contacts=${contacts.length} campaign_id=${session.campaign_id}`);

  // launch — save valid contacts then launch immediately (skips schedule/confirm steps)
  const isLaunch = textLower === 'launch' || text.includes('立即啟動') || text.includes('lançar');
  const isOk     = textLower === 'ok' || textLower === 'confirm' || text.includes('確認繼續') || text.includes('confirmar');

  if (isLaunch) {
    const valid = contacts.filter((c) => validatePhone(c.phone));
    if (valid.length === 0) { await waReply(phone, T.noValidContacts); return; }
    if (session.campaign_id) {
      const vals = valid.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
      const params = valid.flatMap((c) => [
        session.campaign_id, c.phone.trim(), c.name?.trim() || null,
        c.custom_field?.trim() ? JSON.stringify({ note: c.custom_field.trim() }) : null,
      ]);
      await pool.query(`INSERT INTO contacts (campaign_id, phone, name, custom_data) VALUES ${vals}`, params);
    }
    return launchCampaign(phone, { ...session, pending_contacts: null });
  }


  if (isOk) {
    const valid = contacts.filter((c) => validatePhone(c.phone));
    const invalid = contacts.filter((c) => !validatePhone(c.phone));

    if (valid.length === 0) {
      await waReply(phone, T.noValidContacts);
      return;
    }
    if (invalid.length > 0) {
      const names = invalid.map((c) => `${contacts.indexOf(c) + 1}. ${c.name || c.phone}`).join(', ');
      await waReply(phone, T.warnInvalid(invalid.length, names, valid.length));
      await saveSession(phone, { ...session, pending_contacts: valid });
      return;
    }

    if (session.campaign_id) {
      const vals = valid.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
      const params = valid.flatMap((c) => [
        session.campaign_id,
        c.phone.trim(),
        c.name?.trim() || null,
        c.custom_field?.trim() ? JSON.stringify({ note: c.custom_field.trim() }) : null,
      ]);
      await pool.query(`INSERT INTO contacts (campaign_id, phone, name, custom_data) VALUES ${vals}`, params);
    }

    // Always route to campaign confirm — summary + launch/rename
    const campaignName = session.campaign_name ?? nowStamp();
    await saveSession(phone, { ...session, state: 'awaiting_campaign_confirm', pending_contacts: null, campaign_name: campaignName });
    await showCampaignSummary(phone, { ...session, campaign_name: campaignName }, valid.length);
    return;
  }

  const fixMatch = text.match(/^fix\s+(\d+)\s+(.+)$/i);
  if (fixMatch) {
    const idx = parseInt(fixMatch[1], 10) - 1;
    const value = fixMatch[2].trim();
    if (idx < 0 || idx >= contacts.length) {
      await waReply(phone, T.fixNoContact(idx + 1, contacts.length));
      return;
    }
    const updated = [...contacts];
    const nameMatch = value.match(/^name\s+(.+)$/i);
    const noteMatch = value.match(/^note\s+(.+)$/i);
    if (nameMatch)      updated[idx] = { ...updated[idx], name: nameMatch[1].trim() };
    else if (noteMatch) updated[idx] = { ...updated[idx], custom_field: noteMatch[1].trim() };
    else                updated[idx] = { ...updated[idx], phone: value };
    await saveSession(phone, { ...session, pending_contacts: updated });
    await waReply(phone, T.fixUpdated(formatContactList(updated)));
    return;
  }

  const delMatch = text.match(/^del\s+(\d+)$/i);
  if (delMatch) {
    const idx = parseInt(delMatch[1], 10) - 1;
    if (idx < 0 || idx >= contacts.length) {
      await waReply(phone, T.delNoContact(idx + 1));
      return;
    }
    const updated = contacts.filter((_, i) => i !== idx);
    if (updated.length === 0) {
      await saveSession(phone, { ...session, state: 'awaiting_contacts', pending_contacts: null });
      await waReply(phone, T.delAllRemoved);
    } else {
      await saveSession(phone, { ...session, pending_contacts: updated });
      await waReply(phone, T.delRemaining(formatContactList(updated)));
    }
    return;
  }

  const addMatch = text.match(/^add\s+(.+)$/i);
  if (addMatch) {
    const newOnes = parseManualContacts(addMatch[1]);
    if (newOnes.length === 0) {
      await waReply(phone, T.addBadFormat);
      return;
    }
    const updated = [...contacts, ...newOnes];
    await saveSession(phone, { ...session, pending_contacts: updated });
    await waReply(phone, T.addAdded(formatContactList(updated)));
    return;
  }

  const updatedList = formatContactList(contacts);
  await sendContactReview(phone, session.lang, contacts.length, updatedList, '');
}

async function handleVoice(phone: string, session: Session, text: string): Promise<void> {
  const T = I18N[session.lang];

  // Accept voice id from quick-reply button, or legacy numeric input
  let voice = VOICES.find((v) => v.id === text) ?? null;
  if (!voice) {
    const n = parseInt(text, 10);
    if (!isNaN(n) && n >= 1 && n <= VOICES.length) voice = VOICES[n - 1];
  }
  if (!voice) {
    const voiceBody = session.lang === 'zh' ? '請選擇 AI 語音：' : session.lang === 'pt' ? 'Escolha a voz da IA:' : 'Choose AI voice:';
    const voiceListLabel = session.lang === 'zh' ? '選擇語音' : session.lang === 'pt' ? 'Escolher voz' : 'Choose voice';
    await waListPicker(phone, voiceBody, voiceListLabel, VOICES.map((v) => ({ id: v.id, title: v.label })));
    return;
  }

  if (session.campaign_id) {
    await pool.query(`UPDATE campaign_config SET voice_id = $1 WHERE campaign_id = $2`, [voice.id, session.campaign_id]);
  }
  await saveSession(phone, { ...session, state: 'awaiting_greeting' });
  await waReply(phone, T.sendGreeting);
}

async function handleGreetingConfirm(phone: string, session: Session, text: string): Promise<void> {
  const T = I18N[session.lang];
  const greeting = text.trim();
  if (!greeting) {
    await waReply(phone, T.sendGreeting);
    await saveSession(phone, { ...session, state: 'awaiting_greeting' });
    return;
  }
  if (session.campaign_id) {
    await pool.query(`UPDATE campaign_config SET greeting_text = $1 WHERE campaign_id = $2`, [greeting, session.campaign_id]);
  }
  await saveSession(phone, { ...session, state: 'awaiting_script' });
  await waReply(phone, `${T.greetingSaved}\n\n${T.sendScript}`);
}

async function handleGreeting(phone: string, session: Session, text: string): Promise<void> {
  const T = I18N[session.lang];
  if (!text.trim()) {
    await waReply(phone, T.sendGreeting);
    return;
  }
  if (session.campaign_id) {
    await pool.query(`UPDATE campaign_config SET greeting_text = $1 WHERE campaign_id = $2`, [text.trim(), session.campaign_id]);
  }
  await saveSession(phone, { ...session, state: 'awaiting_script' });
  await waReply(phone, `${T.greetingSaved}\n\n${T.sendScript}`);
}

async function handleScriptConfirm(phone: string, session: Session, text: string): Promise<void> {
  const T = I18N[session.lang];
  const script = text.trim();
  if (!script) {
    await saveSession(phone, { ...session, state: 'awaiting_script' });
    await waReply(phone, T.sendScript);
    return;
  }
  if (text.length > 3500) {
    await waReply(phone, T.scriptTooLong(text.length));
    return;
  }
  if (session.campaign_id) {
    await pool.query(`UPDATE campaign_config SET system_prompt = $1 WHERE campaign_id = $2`, [script, session.campaign_id]);
  }
  await saveSession(phone, { ...session, state: 'awaiting_schedule' });
  const schedBody = session.lang === 'zh' ? `${T.scriptSaved}\n\n何時致電？` : session.lang === 'pt' ? `${T.scriptSaved}\n\nQuando ligar?` : `${T.scriptSaved}\n\nWhen to call?`;
  await waQuickReply(phone, schedBody, [
    { id: 'now', title: session.lang === 'zh' ? '⚡ 立即開始' : session.lang === 'pt' ? '⚡ Agora' : '⚡ Start now' },
    { id: 'schedule', title: session.lang === 'zh' ? '📅 排程' : session.lang === 'pt' ? '📅 Agendar' : '📅 Schedule' },
  ]);
}

async function handleScript(phone: string, session: Session, text: string): Promise<void> {
  const T = I18N[session.lang];
  if (!text.trim()) {
    await waReply(phone, T.sendScript);
    return;
  }
  if (text.length > 3500) {
    await waReply(phone, T.scriptTooLong(text.length));
    return;
  }
  if (session.campaign_id) {
    await pool.query(`UPDATE campaign_config SET system_prompt = $1 WHERE campaign_id = $2`, [text.trim(), session.campaign_id]);
  }
  await saveSession(phone, { ...session, state: 'awaiting_schedule' });
  const schedBody = session.lang === 'zh' ? `${T.scriptSaved}\n\n何時致電？` : session.lang === 'pt' ? `${T.scriptSaved}\n\nQuando ligar?` : `${T.scriptSaved}\n\nWhen to call?`;
  await waQuickReply(phone, schedBody, [
    { id: 'now', title: session.lang === 'zh' ? '⚡ 立即開始' : session.lang === 'pt' ? '⚡ Agora' : '⚡ Start now' },
    { id: 'schedule', title: session.lang === 'zh' ? '📅 排程' : session.lang === 'pt' ? '📅 Agendar' : '📅 Schedule' },
  ]);
}

async function handleSchedule(phone: string, session: Session, text: string): Promise<void> {
  const T = I18N[session.lang];

  // Accept 'now' from quick-reply button or legacy '1'
  // Accept 'now' button id, '1' legacy, or button title text
  if (text.trim() === 'now' || text.trim() === '1' || text.includes('立即開始') || text.includes('Agora') || text.includes('Start now')) {
    if (session.campaign_id) {
      await pool.query(`UPDATE campaigns SET scheduled_at = NULL WHERE id = $1`, [session.campaign_id]);
    }
    await saveSession(phone, { ...session, state: 'awaiting_confirm' });
    return showConfirm(phone, session);
  }

  // 'schedule' button tapped — ask for date/time
  if (text.trim() === 'schedule' || text.includes('排程') || text.includes('Agendar') || text.includes('Schedule')) {
    await waReply(phone, T.whenToCall);
    return;
  }

  const schedMatch = text.match(/^2\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
  if (schedMatch) {
    const scheduledAt = `${schedMatch[1]}T${schedMatch[2]}:00`;
    if (isNaN(Date.parse(scheduledAt))) {
      await waReply(phone, T.invalidDate);
      return;
    }
    if (session.campaign_id) {
      await pool.query(
        `UPDATE campaigns SET scheduled_at = $1, status = 'scheduled' WHERE id = $2`,
        [new Date(scheduledAt).toISOString(), session.campaign_id],
      );
    }
    await saveSession(phone, { ...session, state: 'awaiting_confirm' });
    return showConfirm(phone, session);
  }

  await waReply(phone, T.invalidSchedule);
}

async function showConfirm(phone: string, session: Session): Promise<void> {
  const T = I18N[session.lang];
  if (!session.campaign_id) { await waReply(phone, T.sessionError); return; }

  const { rows } = await pool.query(
    `SELECT c.name, c.scheduled_at,
            cc.voice_id,
            COUNT(ct.id)::int AS contact_count
     FROM campaigns c
     JOIN campaign_config cc ON cc.campaign_id = c.id
     LEFT JOIN contacts ct ON ct.campaign_id = c.id
     WHERE c.id = $1
     GROUP BY c.id, cc.campaign_id`,
    [session.campaign_id],
  );
  if (rows.length === 0) { await waReply(phone, T.campaignNotFound); return; }

  const r = rows[0];
  const voice = VOICES.find((v) => v.id === r.voice_id)?.label ?? r.voice_id;
  const schedText = r.scheduled_at
    ? T.schedAt(new Date(r.scheduled_at).toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong' }))
    : T.schedImmediate;

  const summaryText = T.summary(r.name, r.contact_count, voice, schedText);
  await waQuickReply(phone, summaryText, [
    { id: 'launch', title: session.lang === 'zh' ? '🚀 啟動' : session.lang === 'pt' ? '🚀 Lançar' : '🚀 Launch' },
    { id: 'cancel', title: session.lang === 'zh' ? '❌ 取消' : session.lang === 'pt' ? '❌ Cancelar' : '❌ Cancel' },
  ]);
}

async function launchCampaign(phone: string, session: Session): Promise<void> {
  const T = I18N[session.lang];
  if (!session.campaign_id) { await waReply(phone, T.sessionError); return; }

  const { rows } = await pool.query(
    `SELECT c.scheduled_at, COUNT(ct.id)::int AS contact_count
     FROM campaigns c
     LEFT JOIN contacts ct ON ct.campaign_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [session.campaign_id],
  );
  if (rows.length === 0) { await waReply(phone, T.campaignNotFound); return; }

  const { scheduled_at, contact_count } = rows[0];

  if (scheduled_at) {
    await pool.query(`UPDATE campaigns SET status = 'scheduled' WHERE id = $1`, [session.campaign_id]);
  } else {
    const [{ rows: contacts }, { rows: configRows }] = await Promise.all([
      pool.query("SELECT id, phone FROM contacts WHERE campaign_id = $1 AND status = 'pending'", [session.campaign_id]),
      pool.query('SELECT * FROM campaign_config WHERE campaign_id = $1', [session.campaign_id]),
    ]);
    const config = configRows[0];
    await outboundCallsQueue.resume();
    for (const contact of contacts) {
      await outboundCallsQueue.add('dial', {
        contactId: contact.id,
        campaignId: session.campaign_id,
        phone: contact.phone,
        voiceId: config?.voice_id ?? 'Cantonese_GentleLady',
        greetingText: config?.greeting_text ?? '',
        systemPrompt: config?.system_prompt ?? '',
        callTimeoutSec: config?.call_timeout_sec ?? 60,
      }, { jobId: `contact-${contact.id}-${Date.now()}` });
    }
    await pool.query(`UPDATE campaigns SET status = 'running' WHERE id = $1`, [session.campaign_id]);
    console.log(`[whatsapp-bot] campaign ${session.campaign_id} launched — enqueued ${contacts.length} jobs`);
  }
  await clearSession(phone);

  const link = CONSOLE_BASE_URL ? `\n\nView: ${CONSOLE_BASE_URL}/campaigns/${session.campaign_id}` : '';
  const statusText = scheduled_at
    ? T.launchedScheduled(new Date(scheduled_at).toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong' }))
    : T.launchedImmediate;
  await waReply(phone, T.launched(contact_count, statusText, link));
}

async function handleConfirm(phone: string, session: Session, text: string): Promise<void> {
  const T = I18N[session.lang];
  if (text.toLowerCase().trim() !== 'launch' && !text.includes('啟動') && !text.includes('Lançar') && !text.includes('Launch')) {
    await waReply(phone, T.confirmPrompt);
    return;
  }
  return launchCampaign(phone, session);
}


// ─── Campaign confirm (summary + rename) ─────────────────────────────────────

async function showCampaignSummary(phone: string, session: Session, contactCount: number): Promise<void> {
  const { rows } = await pool.query<DbTemplate>('SELECT * FROM campaign_templates WHERE id = $1', [parseInt(session.template_key ?? '0')]);
  const tpl = rows[0] ?? null;
  const name = session.campaign_name ?? nowStamp();
  const lang = session.lang;
  const tplLabel = tpl ? `${tpl.emoji} ${tpl.name}` : '—';

  const bodyText = lang === 'zh'
    ? `📋 *活動摘要*\n\n活動名稱：${name}\n範本：${tplLabel}\n預訂記錄：${contactCount} 位\n\n如需更改名稱，直接輸入新名稱。\n\n_輸入 cancel 可隨時取消。_`
    : lang === 'pt'
    ? `📋 *Resumo da campanha*\n\nNome: ${name}\nModelo: ${tplLabel}\nContactos: ${contactCount}\n\nEscreva um novo nome para alterar.\n\n_Escreva cancel para cancelar._`
    : `📋 *Campaign Summary*\n\nName: ${name}\nTemplate: ${tplLabel}\nContacts: ${contactCount}\n\nType a new name to rename it.\n\n_Type cancel at any time._`;

  await waQuickReply(phone, bodyText, [
    { id: 'launch', title: lang === 'zh' ? '✅ 確認啟動' : lang === 'pt' ? '✅ Confirmar' : '✅ Confirm & launch' },
    { id: 'retry',  title: lang === 'zh' ? '🔁 重新輸入' : lang === 'pt' ? '🔁 Reinserir' : '🔁 Re-enter contacts' },
    { id: 'cancel', title: lang === 'zh' ? '❌ 取消'     : lang === 'pt' ? '❌ Cancelar'  : '❌ Cancel'           },
  ]);
}

async function handleCampaignConfirm(phone: string, session: Session, text: string): Promise<void> {
  const textLower = text.toLowerCase().trim();
  const lang = session.lang;

  // Launch
  if (textLower === 'launch' || text.includes('確認啟動') || text.includes('Confirmar') || text.includes('Confirm')) {
    return launchCampaign(phone, session);
  }

  // Re-enter contacts
  if (textLower === 'retry' || text.includes('重新輸入') || text.includes('Reinserir') || text.includes('Re-enter')) {
    if (session.campaign_id) {
      await pool.query("DELETE FROM contacts WHERE campaign_id = $1", [session.campaign_id]);
    }
    await saveSession(phone, { ...session, state: 'awaiting_contacts', pending_contacts: null });
    const bodyText = lang === 'zh'
      ? '請重新新增聯絡人：\n• 傳送相片\n• 或逐行輸入：_姓名, 電話, 時間, 日期, 備註_'
      : 'Please re-add contacts:\n• Send a photo\n• Or type: _Name, Phone, Schedule, Date, Remark_';
    await waReply(phone, bodyText);
    return;
  }

  // Rename — any other text is treated as new campaign name
  if (text.trim().length > 0 && text.trim().length <= 100) {
    const newName = text.trim();
    if (session.campaign_id) {
      await pool.query('UPDATE campaigns SET name = $1 WHERE id = $2', [newName, session.campaign_id]);
    }
    await saveSession(phone, { ...session, campaign_name: newName });
    const confirmText = lang === 'zh' ? `名稱已更新為「${newName}」✅` : `Name updated to "${newName}" ✅`;
    const { rows } = await pool.query('SELECT COUNT(*) FROM contacts WHERE campaign_id = $1', [session.campaign_id]);
    const count = parseInt(rows[0].count);
    await waReply(phone, confirmText);
    await showCampaignSummary(phone, { ...session, campaign_name: newName }, count);
    return;
  }

  // Fallback — re-show summary
  const { rows } = await pool.query('SELECT COUNT(*) FROM contacts WHERE campaign_id = $1', [session.campaign_id]);
  await showCampaignSummary(phone, session, parseInt(rows[0].count));
}

// ─── Template creation flow (4 steps) ───────────────────────────────────────

async function handleTplVoice(phone: string, session: Session, text: string): Promise<void> {
  const lang = session.lang;
  const voice = VOICES.find((v) => v.id === text);
  if (!voice) {
    const listLabel = lang === 'zh' ? '選擇語音' : lang === 'pt' ? 'Escolher voz' : 'Choose voice';
    await waListPicker(phone, lang === 'zh' ? '請選擇語音：' : 'Choose a voice:', listLabel, VOICES.map((v) => ({ id: v.id, title: v.label })));
    return;
  }
  await saveSession(phone, { ...session, state: 'creating_tpl_lang', tpl_voice_id: voice.id });
  const bodyText = lang === 'zh'
    ? `語音：${voice.label} ✅\n\n第 2 步：選擇語言`
    : lang === 'pt'
    ? `Voz: ${voice.label} ✅\n\nPasso 2: Escolha o idioma`
    : `Voice: ${voice.label} ✅\n\nStep 2: Choose language`;
  await waQuickReply(phone, bodyText, [
    { id: 'zh', title: '廣東話' },
    { id: 'en', title: 'English' },
    { id: 'pt', title: 'Português' },
  ]);
}

async function handleTplLang(phone: string, session: Session, text: string): Promise<void> {
  const lang = session.lang;
  const validLangs: Record<string, string> = { zh: '廣東話', en: 'English', pt: 'Português' };
  const chosen = validLangs[text] ? text : null;
  if (!chosen) {
    await waQuickReply(phone, lang === 'zh' ? '請選擇語言：' : 'Choose language:', [
      { id: 'zh', title: '廣東話' },
      { id: 'en', title: 'English' },
      { id: 'pt', title: 'Português' },
    ]);
    return;
  }
  await saveSession(phone, { ...session, state: 'creating_tpl_greeting', tpl_lang: chosen });
  const langLabel = validLangs[chosen];
  const bodyText = lang === 'zh'
    ? `語言：${langLabel} ✅\n\n第 3 步：輸入問候語\n（AI 接通後第一句說話）\n\n例：你好，我係{{business}}嘅Jamie，打嚟確認你{{date}}{{time}}嘅訂座。\n\n可用變數：{{name}} {{date}} {{time}} {{party_size}} {{business}}\n\n_輸入 cancel 可隨時取消。_`
    : `Language: ${langLabel} ✅\n\nStep 3: Enter the greeting\n(First thing the AI says)\n\nE.g. Hi, this is Jamie from {{business}}. Calling to confirm your reservation on {{date}} at {{time}}.\n\nVariables: {{name}} {{date}} {{time}} {{party_size}} {{business}}\n\n_Type cancel at any time._`;
  await waReply(phone, bodyText);
}

async function handleTplGreeting(phone: string, session: Session, text: string): Promise<void> {
  const lang = session.lang;
  if (!text.trim()) {
    await waReply(phone, lang === 'zh' ? '請輸入問候語：' : 'Please enter the greeting:');
    return;
  }
  await saveSession(phone, { ...session, state: 'creating_tpl_wa', tpl_greeting: text.trim() });
  const bodyText = lang === 'zh'
    ? `問候語已儲存 ✅\n\n第 4 步：是否啟用 WhatsApp 訂位確認？\n使用此範本的活動，通話確認後自動發送 WhatsApp 確認訊息給客人。\n\n_輸入 cancel 可隨時取消。_`
    : `Greeting saved ✅\n\nStep 4: Enable WhatsApp booking confirmation?\nCampaigns using this template will auto-send a WhatsApp message after a confirmed booking call.\n\n_Type cancel at any time._`;
  await waQuickReply(phone, bodyText, [
    { id: 'wa_yes', title: lang === 'zh' ? '✅ 啟用' : '✅ Enable' },
    { id: 'wa_no',  title: lang === 'zh' ? '❌ 不啟用' : '❌ Skip'  },
  ]);
}

async function handleTplWa(phone: string, session: Session, text: string): Promise<void> {
  const lang = session.lang;
  const t = text.toLowerCase().trim();
  const isYes = t === 'wa_yes' || text.includes('啟用') || t === 'enable';
  const isNo  = t === 'wa_no'  || text.includes('不啟用') || t === 'skip';
  if (!isYes && !isNo) {
    await waQuickReply(phone,
      lang === 'zh' ? '請選擇是否啟用 WhatsApp 訂位確認：' : 'Enable WhatsApp booking confirmation?',
      [
        { id: 'wa_yes', title: lang === 'zh' ? '✅ 啟用' : '✅ Enable' },
        { id: 'wa_no',  title: lang === 'zh' ? '❌ 不啟用' : '❌ Skip'  },
      ]);
    return;
  }
  await saveSession(phone, { ...session, state: 'creating_tpl_name', tpl_wa_enabled: isYes });
  const statusLabel = isYes
    ? (lang === 'zh' ? '已啟用 ✅' : 'Enabled ✅')
    : (lang === 'zh' ? '未啟用' : 'Disabled');
  const bodyText = lang === 'zh'
    ? `WhatsApp 確認：${statusLabel}\n\n第 5 步：輸入範本名稱\n（方便識別，例如：餐廳週末版、美容院VIP）\n\n_輸入 cancel 可隨時取消。_`
    : `WhatsApp confirmation: ${statusLabel}\n\nStep 5: Enter the template name\n(E.g. Restaurant Weekend, Beauty Salon VIP)\n\n_Type cancel at any time._`;
  await waReply(phone, bodyText);
}

async function handleTplName(phone: string, session: Session, text: string): Promise<void> {
  const lang = session.lang;
  if (!text.trim()) {
    await waReply(phone, lang === 'zh' ? '請輸入範本名稱：' : 'Please enter a template name:');
    return;
  }
  const name = text.trim();
  const voiceId = session.tpl_voice_id ?? 'Cantonese_GentleLady';
  const greeting = session.tpl_greeting ?? '';
  const waEnabled = session.tpl_wa_enabled ?? false;
  const voiceLabel = VOICES.find((v) => v.id === voiceId)?.label ?? voiceId;

  await pool.query(
    `INSERT INTO campaign_templates (name, emoji, voice_id, script, greeting, wa_confirmation_enabled) VALUES ($1, $2, $3, $4, $5, $6)`,
    [name, '📋', voiceId, greeting, greeting, waEnabled],
  );
  await clearSession(phone);

  const waLabel = waEnabled
    ? (lang === 'zh' ? 'WhatsApp 確認：已啟用 ✅\n' : 'WhatsApp confirmation: Enabled ✅\n')
    : '';
  const doneText = lang === 'zh'
    ? `✅ 範本已建立！\n\n名稱：${name}\n語音：${voiceLabel}\n${waLabel}\n下次建立活動時可選擇此範本。\n輸入 *新活動* 立即使用。`
    : lang === 'pt'
    ? `✅ Modelo criado!\n\nNome: ${name}\nVoz: ${voiceLabel}\n${waLabel}\nEscreva *novo* para usar agora.`
    : `✅ Template created!\n\nName: ${name}\nVoice: ${voiceLabel}\n${waLabel}\nType *new* to use it now.`;
  await waReply(phone, doneText);
}
