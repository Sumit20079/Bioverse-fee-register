// Everything the bot says to parents, in English and Bengali. Amounts and dates keep Latin digits so they read the same in both.
const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const EN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const idx = (key) => Number(String(key).split('-')[1]) - 1;
const rupees = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export const langOf = (chat) => (chat && chat.lang === 'bn' ? 'bn' : 'en');

const en = {
  month: (k) => `${EN_LONG[idx(k)]} ${String(k).slice(0, 4)}`,
  months: (ms) => (ms.length === 1 ? EN_SHORT[idx(ms[0])] : ms.length === 2 ? `${EN_SHORT[idx(ms[0])]} + ${EN_SHORT[idx(ms[1])]}` : `${EN_SHORT[idx(ms[0])]} – ${EN_SHORT[idx(ms[ms.length - 1])]} · ${ms.length} months`),
  help: 'Hello! This bot sends tuition fee reminders. To connect, open the personal link your teacher sent you and press Start. Send /status for the fee status, /history for past payments, /language to change language, or /stop to stop the reminders.',
  connected: (name) => `Connected. You will get tuition fee reminders for ${name} here. Send /status any time to see the fee status, or /stop to stop reminders.`,
  invalid: 'This link is not valid any more. Please ask your teacher for a new one.',
  stopped: "Okay, you will not get fee reminders any more. Open your teacher's link again any time to reconnect.",
  notConnected: 'You are not connected yet. Open the personal link your teacher sent you and press Start.',
  gone: 'Sorry, this student is not in the register any more.',
  statusTitle: (n) => `Fee status for ${n}`,
  pending: (months, amt, partial) => `Pending: ${months} · ${amt}${partial ? ' (includes a part payment balance)' : ''}`,
  allPaid: (m) => `All paid up till ${m} ✅`,
  lastPay: (amt, m, on) => `Last payment: ${amt} for ${m}${on ? ` on ${on}` : ''}`,
  histTitle: (n) => `Payment history for ${n}`,
  histNone: (n) => `No payments recorded yet for ${n}.`,
  histPaid: (on) => ` (paid ${on})`,
  histMore: (n) => `\n…and ${n} earlier months`,
  thanks: 'Thank you, your message has been passed to the teacher.',
  receipt: ({ name, amt, month, batch, on, balance }) => `Hello, we have received the tuition fee of ${amt} for ${name} (${batch}) for ${month}${on ? ` on ${on}` : ''}.${balance > 0 ? ` Balance remaining: ${rupees(balance)}.` : ''} Thank you!`,
  headsUp: ({ name, batch, month, amt, day }) => `Hello, a gentle heads-up: the tuition fee for ${name} (${batch}) for ${month} (${amt}) falls due on day ${day}. Please ignore this if you have already paid. Thank you!`,
  reminder: ({ name, amt, months, batch }) => `Hello, a gentle reminder that the tuition fee of ${amt} for ${name} (${batch}) for ${months} is still pending. Please pay when you can. Thank you!`,
  chooseLang: 'Choose your language / ভাষা বেছে নিন',
  langSet: 'Language set to English.',
  paidBtn: "✅ I've paid",
  paidThanks: 'Thank you! Your teacher has been told and will confirm. You can send a screenshot of the payment here if you like.',
  nothingDue: 'Nothing is pending right now. You are all paid up ✅',
  gotShot: 'Got the screenshot, thank you. Your teacher will check it.',
  kb: ['📊 Status', '🧾 History', '🔕 Stop reminders'],
};

const bn = {
  month: (k) => `${BN_MONTHS[idx(k)]} ${String(k).slice(0, 4)}`,
  months: (ms) => (ms.length === 1 ? BN_MONTHS[idx(ms[0])] : ms.length === 2 ? `${BN_MONTHS[idx(ms[0])]} ও ${BN_MONTHS[idx(ms[1])]}` : `${BN_MONTHS[idx(ms[0])]} থেকে ${BN_MONTHS[idx(ms[ms.length - 1])]} (${ms.length} মাস)`),
  help: 'নমস্কার! এই বট টিউশন ফি-এর রিমাইন্ডার পাঠায়। সংযোগ করতে শিক্ষকের পাঠানো ব্যক্তিগত লিঙ্কটি খুলে Start চাপুন। ফি-এর অবস্থা দেখতে /status, আগের পেমেন্ট দেখতে /history, ভাষা বদলাতে /language, আর রিমাইন্ডার বন্ধ করতে /stop পাঠান।',
  connected: (name) => `সংযুক্ত হয়েছে। এখানে ${name}-এর টিউশন ফি-এর রিমাইন্ডার পাবেন। ফি-এর অবস্থা দেখতে /status, রিমাইন্ডার বন্ধ করতে /stop পাঠান।`,
  invalid: 'এই লিঙ্কটি আর কাজ করছে না। অনুগ্রহ করে শিক্ষকের কাছ থেকে নতুন লিঙ্ক চেয়ে নিন।',
  stopped: 'ঠিক আছে, আপনি আর ফি-এর রিমাইন্ডার পাবেন না। আবার চালু করতে শিক্ষকের লিঙ্কটি আবার খুলুন।',
  notConnected: 'আপনি এখনও সংযুক্ত হননি। শিক্ষকের পাঠানো ব্যক্তিগত লিঙ্কটি খুলে Start চাপুন।',
  gone: 'দুঃখিত, এই ছাত্র/ছাত্রী আর খাতায় নেই।',
  statusTitle: (n) => `${n}-এর ফি-এর অবস্থা`,
  pending: (months, amt, partial) => `বাকি: ${months} · ${amt}${partial ? ' (আংশিক পেমেন্টের বাকি সহ)' : ''}`,
  allPaid: (m) => `${m} পর্যন্ত সব ফি জমা আছে ✅`,
  lastPay: (amt, m, on) => `সর্বশেষ পেমেন্ট: ${m}-এর জন্য ${amt}${on ? ` (${on} তারিখে)` : ''}`,
  histTitle: (n) => `${n}-এর পেমেন্টের তালিকা`,
  histNone: (n) => `${n}-এর কোনো পেমেন্ট এখনও লেখা হয়নি।`,
  histPaid: (on) => ` (${on} তারিখে)`,
  histMore: (n) => `\n…এছাড়া আরও ${n} মাসের আগের পেমেন্ট আছে`,
  thanks: 'ধন্যবাদ, আপনার বার্তা শিক্ষকের কাছে পৌঁছে দেওয়া হয়েছে।',
  receipt: ({ name, amt, month, batch, on, balance }) => `নমস্কার, ${name}-এর (${batch}) ${month} মাসের টিউশন ফি ${amt} গ্রহণ করা হয়েছে${on ? ` (${on})` : ''}।${balance > 0 ? ` বাকি আছে: ${rupees(balance)}।` : ''} ধন্যবাদ!`,
  headsUp: ({ name, batch, month, amt, day }) => `নমস্কার, একটি মৃদু অনুস্মারক: ${name}-এর (${batch}) ${month} মাসের টিউশন ফি (${amt}) মাসের ${day} তারিখের মধ্যে দেওয়ার কথা। ইতিমধ্যে দিয়ে থাকলে এটি উপেক্ষা করুন। ধন্যবাদ!`,
  reminder: ({ name, amt, months, batch }) => `নমস্কার, ${name}-এর (${batch}) ${months} মাসের টিউশন ফি ${amt} এখনও বাকি আছে। সুবিধামতো দিয়ে দেবেন। ধন্যবাদ!`,
  chooseLang: 'Choose your language / ভাষা বেছে নিন',
  langSet: 'ভাষা বাংলা করা হয়েছে।',
  paidBtn: '✅ আমি পেমেন্ট করেছি',
  paidThanks: 'ধন্যবাদ! শিক্ষককে জানানো হয়েছে, তিনি নিশ্চিত করবেন। চাইলে পেমেন্টের স্ক্রিনশট এখানে পাঠাতে পারেন।',
  nothingDue: 'এখন কিছু বাকি নেই। সব ফি জমা আছে ✅',
  gotShot: 'স্ক্রিনশট পেয়েছি, ধন্যবাদ। শিক্ষক এটি দেখে নেবেন।',
  kb: ['📊 স্ট্যাটাস', '🧾 হিস্ট্রি', '🔕 রিমাইন্ডার বন্ধ'],
};

export const T = (lang) => (lang === 'bn' ? bn : en);
export const keyboardFor = (lang) => ({ reply_markup: { keyboard: [T(lang).kb.map((text) => ({ text }))], resize_keyboard: true, is_persistent: true } });
export const paidButton = (lang, studentId) => ({ reply_markup: { inline_keyboard: [[{ text: T(lang).paidBtn, callback_data: `paid:${studentId}` }]] } });
export const langButtons = () => ({ reply_markup: { inline_keyboard: [[{ text: 'English', callback_data: 'lang:en' }, { text: 'বাংলা', callback_data: 'lang:bn' }]] } });
export { rupees };
