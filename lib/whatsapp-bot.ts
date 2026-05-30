import pool from './db';
import { waReply, waListPicker, waQuickReply } from './whatsapp-reply';
import { downloadTwilioMedia } from './whatsapp-image';
import { TEMPLATES } from './industry-templates';
import { outboundCallsQueue } from './queue';

const GEMINI_MODEL   = process.env.GEMINI_MODEL   ?? 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const CONSOLE_BASE_URL = (process.env.CONSOLE_BASE_URL ?? '').replace(/\/$/, '');

const SESSION_TIMEOUT_MINUTES = 30;

const VOICES = [
  { id: 'Cantonese_GentleLady', label: 'Gentle Lady' },
  { id: 'Cantonese_BrightBoy',  label: 'Bright Boy'  },
  { id: 'Cantonese_WarmLady',   label: 'Warm Lady'   },
  { id: 'moss_audio_f7aa082d-5c0a-11f1-a392-62a1f5ede8a7', label: 'Moss' },
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
    quickStart:        (name: string, tpl: string) => `⚡ Quick start — *${tpl}* template\nCampaign: *"${name}"*\n\nNow add contacts. You can:\n• Send a *photo* of your contact list\n• Or type contacts (one per line):\n  _Name, +Phone, Note_\n  _+Phone_ (name optional)\n\n_Type cancel at any time to stop._`,
    repeatStart:       (name: string) => `🔁 Repeating *"${name}"* with new contacts.\n\nSame voice & script as last time. Now add contacts:\n• Send a *photo* of your contact list\n• Or type contacts (one per line):\n  _Name, +Phone, Note_\n  _+Phone_ (name optional)\n\n_Type cancel at any time to stop._`,
    noLastCampaign:    '⚠️ No previous campaign found. Type *new* to create one.',
    addContacts:       (name: string) => `Campaign *"${name}"* created ✅\n\nNow add contacts. You can:\n• Send a *photo* of your contact list\n• Or type contacts (one per line):\n  _Name, +Phone, Note_\n  _+Phone_ (name optional)\n\n_Type cancel at any time to stop._`,
    extracting:        '🔍 Extracting contacts from your image…',
    extractError:      (e: string) => `❌ Could not extract contacts: ${e}\n\nTry again or type contacts manually.`,
    noContactsImage:   '⚠️ No contacts found in the image. Try again or type contacts manually.',
    noContactsText:    '⚠️ Could not parse any contacts. Format: _Name, +Phone, Note_ (one per line).',
    sendPhotoOrType:   'Send a photo or type contacts manually.',
    contactsFound:     (n: number, list: string, warn: string) => `Found *${n}* contact(s):\n\n${list}${warn}\n\nCommands:\n• *ok* — confirm and continue\n• *launch* — confirm & launch immediately\n• *fix N new_value* — fix a field\n• *del N* — remove a contact\n• *add Name, +Phone, Note* — add a contact\n\n_Type cancel at any time to stop._`,
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
    addBadFormat:      '⚠️ Could not parse. Format: _add Name, +Phone, Note_',
    addAdded:          (list: string) => `Added. Current list:\n\n${list}\n\nReply *ok* to confirm.`,
    reviewRepeat:      (list: string) => `Current contacts:\n\n${list}\n\nCommands: *ok* · *fix N value* · *del N* · *add Name, +Phone, Note*`,
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
    quickStart:        (name: string, tpl: string) => `⚡ 快速建立 — *${tpl}* 範本\n活動：*「${name}」*\n\n請新增聯絡人，你可以：\n• 傳送聯絡人名單的*相片*\n• 或逐行輸入聯絡人：\n  _姓名, +電話, 備註_\n  _+電話_（姓名可選）\n\n_輸入 cancel 可隨時取消。_`,
    repeatStart:       (name: string) => `🔁 重複活動 *「${name}」*，更換新聯絡人。\n\n語音及腳本與上次相同，請新增聯絡人：\n• 傳送聯絡人名單的*相片*\n• 或逐行輸入聯絡人：\n  _姓名, +電話, 備註_\n  _+電話_（姓名可選）\n\n_輸入 cancel 可隨時取消。_`,
    noLastCampaign:    '⚠️ 找不到上次活動，請輸入 *新活動* 建立。',
    addContacts:       (name: string) => `活動 *「${name}」* 已建立 ✅\n\n請新增聯絡人，你可以：\n• 傳送聯絡人名單的*相片*\n• 或逐行輸入聯絡人：\n  _姓名, +電話, 備註_\n  _+電話_（姓名可選）\n\n_輸入 cancel 可隨時取消。_`,
    extracting:        '🔍 正在從圖片中提取聯絡人⋯',
    extractError:      (e: string) => `❌ 無法提取聯絡人：${e}\n\n請重試或手動輸入。`,
    noContactsImage:   '⚠️ 圖片中找不到聯絡人，請重試或手動輸入。',
    noContactsText:    '⚠️ 無法解析聯絡人，格式：_姓名, +電話, 備註_（每行一位）。',
    sendPhotoOrType:   '請傳送相片或手動輸入聯絡人。',
    contactsFound:     (n: number, list: string, warn: string) => `找到 *${n}* 位聯絡人：\n\n${list}${warn}\n\n指令：\n• *ok* — 確認並繼續\n• *launch* — 確認並立即啟動\n• *fix N 新數值* — 修改欄位\n• *del N* — 刪除聯絡人\n• *add 姓名, +電話, 備註* — 新增聯絡人\n\n_輸入 cancel 可隨時取消。_`,
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
    addBadFormat:      '⚠️ 無法解析，格式：_add 姓名, +電話, 備註_',
    addAdded:          (list: string) => `已新增。目前名單：\n\n${list}\n\n輸入 *ok* 確認。`,
    reviewRepeat:      (list: string) => `目前聯絡人：\n\n${list}\n\n指令：*ok* · *fix N 數值* · *del N* · *add 姓名, +電話, 備註*`,
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
  | 'awaiting_voice'
  | 'awaiting_greeting'
  | 'awaiting_greeting_confirm'   // showing template greeting, waiting for ok or custom text
  | 'awaiting_script'
  | 'awaiting_script_confirm'     // showing template script, waiting for ok or custom text
  | 'awaiting_schedule'
  | 'awaiting_confirm';

interface Session {
  state: BotState;
  lang: Lang;
  campaign_id: number | null;
  template_key: string | null;
  pending_contacts: PendingContact[] | null;
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
    'SELECT state, lang, campaign_id, template_key, pending_contacts FROM whatsapp_admin_sessions WHERE admin_phone = $1',
    [phone],
  );
  if (rows.length === 0) return { state: 'idle', lang: 'en', campaign_id: null, template_key: null, pending_contacts: null };
  return {
    state:            rows[0].state as BotState,
    lang:             (rows[0].lang ?? 'en') as Lang,
    campaign_id:      rows[0].campaign_id ?? null,
    template_key:     rows[0].template_key ?? null,
    pending_contacts: rows[0].pending_contacts ?? null,
  };
}

async function saveSession(phone: string, patch: Partial<Session>): Promise<void> {
  await pool.query(
    `INSERT INTO whatsapp_admin_sessions (admin_phone, state, lang, campaign_id, template_key, pending_contacts, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (admin_phone) DO UPDATE SET
       state            = EXCLUDED.state,
       lang             = EXCLUDED.lang,
       campaign_id      = EXCLUDED.campaign_id,
       template_key     = EXCLUDED.template_key,
       pending_contacts = EXCLUDED.pending_contacts,
       updated_at       = NOW()`,
    [
      phone,
      patch.state ?? 'idle',
      patch.lang ?? 'en',
      patch.campaign_id ?? null,
      patch.template_key ?? null,
      patch.pending_contacts ? JSON.stringify(patch.pending_contacts) : null,
    ],
  );
}

async function clearSession(phone: string): Promise<void> {
  await pool.query('DELETE FROM whatsapp_admin_sessions WHERE admin_phone = $1', [phone]);
}

// ─── Contact helpers ──────────────────────────────────────────────────────────

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
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length === 1) return { name: '', phone: parts[0], custom_field: '' };
      if (parts.length === 2) return { name: parts[0], phone: parts[1], custom_field: '' };
      return { name: parts[0], phone: parts[1], custom_field: parts.slice(2).join(', ') };
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

  // Detect language on first message or idle state; persist to session
  let lang: Lang = session.lang;
  if (session.state === 'idle') {
    const detected = detectLang(text);
    if (detected) lang = detected;
  }

  const T = I18N[lang];

  // Global cancel
  if (textLower === 'cancel' || textLower === 'quit' || textLower === '取消') {
    if (session.campaign_id) {
      await pool.query("DELETE FROM campaigns WHERE id = $1 AND status = 'draft'", [session.campaign_id]);
    }
    await clearSession(phone);
    await waReply(phone, T.cancelled);
    return;
  }

  switch (session.state) {
    case 'idle':                     return handleIdle(phone, textLower, lang);
    case 'awaiting_template':        return handleTemplate(phone, text, { ...session, lang });
    case 'awaiting_name':            return handleName(phone, { ...session, lang }, text);
    case 'awaiting_contacts':        return handleContacts(phone, { ...session, lang }, msg);
    case 'reviewing_contacts':       return handleReview(phone, { ...session, lang }, text);
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

  // ── hi/hello — show command menu without starting the flow ───────────────
  if (greetings.some((k) => textLower.includes(k))) {
    await waReply(phone, T.welcome);
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
        `INSERT INTO campaigns (name, status) VALUES ($1, 'draft') RETURNING id`,
        [src.name],
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

  // ── /new [template] — quick-start with named template ────────────────────
  const newWithTemplate = textLower.match(/^(?:new|novo|新活動)\s*(.+)$/i);
  if (newWithTemplate) {
    const query = newWithTemplate[1].trim().toLowerCase();
    const templateList = Object.values(TEMPLATES);
    // Match by key or localised name (any lang)
    const tpl = templateList.find((t) =>
      t.key.includes(query) ||
      Object.values(t.name).some((n) => n.toLowerCase().includes(query)),
    );
    if (tpl) {
      const campaignName = tpl.sampleCampaignName[lang] || tpl.sampleCampaignName.en;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `INSERT INTO campaigns (name, status) VALUES ($1, 'draft') RETURNING id`,
          [campaignName],
        );
        const newId: number = rows[0].id;
        await client.query(
          `INSERT INTO campaign_config (campaign_id, system_prompt, greeting_text) VALUES ($1, $2, $3)`,
          [newId, tpl.sampleScript[lang] ?? '', tpl.greetingText ?? ''],
        );
        await client.query('COMMIT');
        await saveSession(phone, {
          state: 'awaiting_contacts', lang, campaign_id: newId,
          template_key: tpl.key, pending_contacts: null,
        });
        await waReply(phone, T.quickStart(campaignName, tpl.name[lang]));
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      return;
    }
    // Template name not recognised — fall through to normal flow with a hint
  }

  // ── Normal /new flow ──────────────────────────────────────────────────────
  if (triggers.some((k) => textLower.includes(k))) {
    await saveSession(phone, { state: 'awaiting_template', lang, campaign_id: null, template_key: null, pending_contacts: null });
    const templateList = Object.values(TEMPLATES);
    const listLabel = lang === 'zh' ? '選擇範本' : lang === 'pt' ? 'Escolher modelo' : 'Choose template';
    const bodyText = lang === 'zh' ? '👋 開始建立活動！\n\n請選擇行業範本：' : lang === 'pt' ? '👋 Vamos criar uma campanha!\n\nEscolha um modelo de setor:' : '👋 Let\'s create a campaign!\n\nChoose an industry template:';
    await waListPicker(phone, bodyText, listLabel, [
      { id: '0', title: lang === 'zh' ? '不使用範本' : lang === 'pt' ? 'Sem modelo' : 'No template' },
      ...templateList.map((t) => ({ id: t.key, title: `${t.emoji} ${t.name[lang]}`, description: t.hint[lang] })),
    ]);
  } else {
    await waReply(phone, I18N[lang].typNew);
  }
}

async function handleTemplate(phone: string, text: string, session: Session): Promise<void> {
  const T = I18N[session.lang];
  const templateList = Object.values(TEMPLATES);

  // Accept item id (key string or '0') from list picker, or legacy number for fallback
  let chosen: typeof templateList[0] | null = null;
  if (text === '0') {
    chosen = null;
  } else {
    // Try key match first (list picker sends the key id)
    chosen = templateList.find((t) => t.key === text) ?? null;
    // Fallback: numeric input for users who typed manually
    if (!chosen) {
      const n = parseInt(text, 10);
      if (!isNaN(n) && n >= 1 && n <= templateList.length) chosen = templateList[n - 1];
    }
  }

  if (text !== '0' && !chosen) {
    // Unrecognised — re-send the list picker
    const listLabel = session.lang === 'zh' ? '選擇範本' : session.lang === 'pt' ? 'Escolher modelo' : 'Choose template';
    const bodyText = session.lang === 'zh' ? '請選擇行業範本：' : session.lang === 'pt' ? 'Escolha um modelo de setor:' : 'Choose an industry template:';
    await waListPicker(phone, bodyText, listLabel, [
      { id: '0', title: session.lang === 'zh' ? '不使用範本' : session.lang === 'pt' ? 'Sem modelo' : 'No template' },
      ...templateList.map((t) => ({ id: t.key, title: `${t.emoji} ${t.name[session.lang]}`, description: t.hint[session.lang] })),
    ]);
    return;
  }

  const label = chosen ? T.templateSelected(chosen.name[session.lang]) : T.noTemplate;
  await saveSession(phone, { ...session, state: 'awaiting_name', template_key: chosen?.key ?? null, pending_contacts: null });
  await waReply(phone, T.campaignName(label));
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
      `INSERT INTO campaigns (name, status) VALUES ($1, 'draft') RETURNING id`,
      [text],
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

async function handleContacts(phone: string, session: Session, msg: IncomingMessage): Promise<void> {
  const T = I18N[session.lang];
  let contacts: PendingContact[] = [];

  if (msg.numMedia > 0 && msg.mediaUrl) {
    await waReply(phone, T.extracting);
    try {
      const { base64, mimeType } = await downloadTwilioMedia(msg.mediaUrl);
      contacts = await extractContactsFromImage(base64, mimeType);
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
  await waReply(phone, T.contactsFound(contacts.length, list, warn));
}

async function handleReview(phone: string, session: Session, text: string): Promise<void> {
  const T = I18N[session.lang];
  const contacts = session.pending_contacts ?? [];
  const textLower = text.toLowerCase();

  // launch — save valid contacts then launch immediately (skips schedule/confirm steps)
  if (textLower === 'launch') {
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


  if (textLower === 'ok' || textLower === 'confirm' || textLower === '確認') {    const valid = contacts.filter((c) => validatePhone(c.phone));
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

    // Check if config was pre-filled (quick-start or repeat) — skip voice/greeting/script steps
    const configPrefilled = session.campaign_id
      ? await pool.query(
          `SELECT greeting_text, system_prompt FROM campaign_config WHERE campaign_id = $1`,
          [session.campaign_id],
        ).then((r) => {
          const row = r.rows[0];
          return !!(row?.greeting_text?.trim() && row?.system_prompt?.trim());
        })
      : false;

    if (configPrefilled) {
      await saveSession(phone, { ...session, state: 'awaiting_schedule', pending_contacts: null });
      await waReply(phone, `${T.contactsSaved(valid.length)}\n\n${T.whenToCall}`);
    } else {
      await saveSession(phone, { ...session, state: 'awaiting_voice', pending_contacts: null });
      const voiceBody = session.lang === 'zh' ? `${T.contactsSaved(valid.length)}\n\n請選擇 AI 語音：` : session.lang === 'pt' ? `${T.contactsSaved(valid.length)}\n\nEscolha a voz da IA:` : `${T.contactsSaved(valid.length)}\n\nChoose AI voice:`;
      await waQuickReply(phone, voiceBody, VOICES.map((v) => ({ id: v.id, title: v.label })));
    }
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

  await waReply(phone, T.reviewRepeat(formatContactList(contacts)));
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
    await waQuickReply(phone, voiceBody, VOICES.map((v) => ({ id: v.id, title: v.label })));
    return;
  }

  if (session.campaign_id) {
    await pool.query(`UPDATE campaign_config SET voice_id = $1 WHERE campaign_id = $2`, [voice.id, session.campaign_id]);
  }

  // If a template was chosen, show the template greeting for confirmation
  const tpl = session.template_key ? TEMPLATES[session.template_key] : null;
  if (tpl) {
    const greeting = tpl.sampleScript[session.lang] ?? tpl.greetingText;
    await saveSession(phone, { ...session, state: 'awaiting_greeting_confirm' });
    await waReply(phone, T.useTemplateGreeting(greeting));
  } else {
    await saveSession(phone, { ...session, state: 'awaiting_greeting' });
    await waReply(phone, T.sendGreeting);
  }
}

async function handleGreetingConfirm(phone: string, session: Session, text: string): Promise<void> {
  const T = I18N[session.lang];
  const tpl = session.template_key ? TEMPLATES[session.template_key] : null;

  let greeting: string;
  if (text.toLowerCase() === 'ok' || text === '確認') {
    // Use localised template greeting
    greeting = tpl?.sampleScript?.[session.lang] ?? tpl?.greetingText ?? '';
  } else {
    // Use whatever the user sent as their custom greeting
    greeting = text.trim();
  }

  if (!greeting) {
    await waReply(phone, T.sendGreeting);
    await saveSession(phone, { ...session, state: 'awaiting_greeting' });
    return;
  }

  if (session.campaign_id) {
    await pool.query(`UPDATE campaign_config SET greeting_text = $1 WHERE campaign_id = $2`, [greeting, session.campaign_id]);
  }

  // Now show template script for confirmation
  const lang = session.lang;
  const scriptPreview = tpl?.sampleScript?.[lang] ?? tpl?.systemPrompt ?? null;
  if (scriptPreview) {
    await saveSession(phone, { ...session, state: 'awaiting_script_confirm' });
    await waReply(phone, `${T.greetingSaved}\n\n${T.useTemplateScript(scriptPreview)}`);
  } else {
    await saveSession(phone, { ...session, state: 'awaiting_script' });
    await waReply(phone, `${T.greetingSaved}\n\n${T.sendScript}`);
  }
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

  // Check if there's a template script to offer
  const tpl = session.template_key ? TEMPLATES[session.template_key] : null;
  const scriptPreview = tpl?.sampleScript?.[session.lang] ?? null;
  if (scriptPreview) {
    await saveSession(phone, { ...session, state: 'awaiting_script_confirm' });
    await waReply(phone, `${T.greetingSaved}\n\n${T.useTemplateScript(scriptPreview)}`);
  } else {
    await saveSession(phone, { ...session, state: 'awaiting_script' });
    await waReply(phone, `${T.greetingSaved}\n\n${T.sendScript}`);
  }
}

async function handleScriptConfirm(phone: string, session: Session, text: string): Promise<void> {
  const T = I18N[session.lang];
  const tpl = session.template_key ? TEMPLATES[session.template_key] : null;

  let script: string;
  if (text.toLowerCase() === 'ok' || text === '確認') {
    script = tpl?.sampleScript?.[session.lang] ?? tpl?.systemPrompt ?? '';
  } else {
    script = text.trim();
  }

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
  if (text.trim() === 'now' || text.trim() === '1') {
    if (session.campaign_id) {
      await pool.query(`UPDATE campaigns SET scheduled_at = NULL WHERE id = $1`, [session.campaign_id]);
    }
    await saveSession(phone, { ...session, state: 'awaiting_confirm' });
    return showConfirm(phone, session);
  }

  // 'schedule' button tapped — ask for date/time
  if (text.trim() === 'schedule') {
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
  if (text.toLowerCase().trim() !== 'launch') {
    await waReply(phone, T.confirmPrompt);
    return;
  }
  return launchCampaign(phone, session);
}

