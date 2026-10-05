/**
 * UI-only copy for the redesign. Kept here because this pass may only touch js/ui/.
 * Existing catalogue keys still go through t().
 */

const COPY = {
  en: {
    sentenceLead: 'Tell us the trip — we will find what fits.',
    s1: 'I want a',
    s2: 'trip, under',
    s3: 'BDT, for',
    s4: 'days, from',
    s5: 'in',
    s6: ', and I enjoy',
    s7: '.',
    activitiesNone: 'anything calm',
    editSituation: 'Edit',
    closeEdit: 'Done',
    seeWhy: 'See why',
    emptyFriendlier: 'Nothing fits yet. One small tweak usually opens doors again.',
  },
  bn: {
    sentenceLead: 'ভ্রমণের কথা বলুন — আমরা মিলিয়ে দেব।',
    s1: 'আমি চাই',
    s2: 'ভ্রমণ, বাজেট',
    s3: 'টাকা, সময়',
    s4: 'দিন, শুরু',
    s5: 'মাস',
    s6: ', আর পছন্দ',
    s7: '।',
    activitiesNone: 'যেকোনো শান্ত অভিজ্ঞতা',
    editSituation: 'সম্পাদনা',
    closeEdit: 'শেষ',
    seeWhy: 'কেন দেখুন',
    emptyFriendlier: 'এখনো মিলছে না। একটুখানি বদলেই আবার পথ খুলতে পারে।',
  },
};

/**
 * @param {string} key
 * @returns {string}
 */
export function ui(key) {
  const lang = document.documentElement.lang === 'bn' ? 'bn' : 'en';
  return COPY[lang][key] ?? COPY.en[key] ?? key;
}
