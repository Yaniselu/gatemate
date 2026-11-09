
export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
}

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    updated: '9 November 2026',
    intro:
      'Gatemate helps you manage flights and travel with friends. This policy explains what data we collect, why, who receives it and the choices you have. We follow the EU General Data Protection Regulation (GDPR) and apply the same protections to everyone, wherever you live.',
    sections: [
      {
        heading: 'Who we are',
        body: [
          'Gatemate is operated by Velosyntech, Romania, the controller of your personal data. Contact us about privacy at contact@velosyntech.com.',
        ],
      },
      {
        heading: 'Data we collect',
        body: [
          'Account data: your name, email address, language and, if you use Sign in with Apple or Google, the identifier those services provide. Apple may give us a private relay email instead of your real address. Passwords are stored only as a salted Argon2 hash.',
          'Travel data you add: flight numbers, airports, dates, seat, booking reference, the contents of boarding passes you scan, trips you create and the travel companions you add to your family list.',
          'Identity check (optional): when you scan a passport or ID card, the scan is read on your device. We keep only the name, issuing country and expiry date, plus a one-way hash of the document number to stop the same document being used by two accounts. We never store the image or the document number itself.',
          'Chat and assistant content: messages you send in trip groups and flight lounges, reports you submit, and the questions you ask the Velo assistant.',
          'Location: if you allow it, your location is used on your device to find the nearest airport and show your position on airport maps. It is not sent to or stored on our servers.',
          'Device and purchase data: push notification tokens, app version, crash diagnostics without personal content and, if you buy Gatemate Pro, your subscription status.',
        ],
      },
      {
        heading: 'How we use it',
        body: [
          'To provide the service: show your trips, send boarding and gate alerts, sync across your devices, deliver chat messages and answer assistant questions.',
          'To keep the community and your account safe: moderate public lounges, investigate reports, block automated attacks and prevent abuse.',
          'We do not sell or share your personal data for advertising, show third-party ads, build advertising profiles or track you across other companies’ apps and websites. We do not use your data to train AI models.',
        ],
      },
      {
        heading: 'Legal bases',
        body: [
          'Performance of our contract with you (core features), legitimate interest (security, abuse prevention and service improvement) and your consent (location, notifications, camera and the optional identity check), which you can withdraw at any time in your device settings or in the app.',
        ],
      },
      {
        heading: 'Who receives your data',
        body: [
          'Trip members see the trip details and messages you share with that group. Lounge participants see your first name and messages.',
          'Service providers acting on our instructions under data processing agreements: Render (hosting and database, EU region in Frankfurt), Brevo (account emails, EU), Anthropic and Google (answering Velo assistant questions; only the conversation and the trip details needed to answer are sent), RevenueCat (subscription status), Apple and Google (sign-in and push notifications).',
          'Public data services such as weather, map, currency and flight-tracking providers receive only airport codes, coordinates of airports or flight identifiers, never your account details.',
          'We disclose data to authorities only when the law requires it.',
        ],
      },
      {
        heading: 'International transfers',
        body: [
          'Your data is stored in the European Union. Some providers listed above are based in the United States; transfers to them rely on the EU-US Data Privacy Framework or the European Commission’s Standard Contractual Clauses.',
        ],
      },
      {
        heading: 'Retention & deletion',
        body: [
          'We keep your data while your account is active. Delete your account anytime in Profile → Delete account, or at gatemate-api-2n16.onrender.com/legal/delete-account.html. We erase your data within 30 days, except where the law requires us to keep records. Server logs are kept for up to 30 days.',
          'You can export a copy of your data from Profile → Export my data.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          'You can access, correct, delete, restrict or port your data, object to processing and withdraw consent. Write to contact@velosyntech.com; we answer within one month. You may also complain to your local data protection authority (in Romania, ANSPDCP).',
          'If you live in a US state with a consumer privacy law (such as California), you have similar rights to know, correct and delete your data. We do not sell or share personal information and do not use sensitive personal information to infer characteristics about you. We will not treat you differently for exercising your rights.',
        ],
      },
      {
        heading: 'Security',
        body: [
          'Data is encrypted in transit (TLS) and at rest. Sign-in tokens are kept in your device’s secure storage. No system is perfect, so please use a strong, unique password. If a breach affects you, we will notify you and the authorities as the law requires.',
        ],
      },
      {
        heading: 'Children',
        body: [
          'Gatemate is not directed to children under 16, and we do not knowingly collect their data without a parent’s consent. Companions you add to your family list are added by you, and you should only add people who have agreed or whose parent or guardian you are. If you believe a child has given us data, contact us and we will delete it.',
        ],
      },
      {
        heading: 'Changes',
        body: ['We will tell you in the app before any material change to this policy takes effect.'],
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    updated: '27 October 2026',
    intro: 'These terms govern your use of Gatemate. By creating an account you agree to them.',
    sections: [
      {
        heading: 'The service',
        body: [
          'Gatemate is an independent travel companion. We are not an airline, airport or travel agency and are not affiliated with any of them unless stated.',
          'Flight information comes from third-party data providers and may be delayed or inaccurate. Always follow official airport displays, announcements and your airline’s instructions.',
        ],
      },
      {
        heading: 'Your account',
        body: ['You must be at least 16, give accurate information and keep your credentials secure. You are responsible for activity on your account.'],
      },
      {
        heading: 'User content',
        body: [
          'You keep ownership of what you post, and grant us a limited licence to host and display it to the people you share it with.',
          'You must follow the Community Guidelines. We may remove content and suspend accounts that violate them. There is zero tolerance for objectionable content or abusive users.',
        ],
      },
      {
        heading: 'Boarding passes',
        body: ['The pass shown in Gatemate is a convenience copy. Carry the official boarding pass issued by your airline; we are not responsible for denied boarding.'],
      },
      {
        heading: 'Liability',
        body: ['To the extent allowed by law, Gatemate is provided “as is” and we are not liable for missed flights, connections or indirect losses. Nothing in these terms limits your statutory consumer rights.'],
      },
      {
        heading: 'Changes & termination',
        body: ['We may update these terms and will notify you of material changes. You can stop using Gatemate and delete your account at any time.'],
      },
      {
        heading: 'Apple',
        body: ['If you downloaded Gatemate from the App Store, Apple’s Standard Licensed Application End User License Agreement also applies. Apple is not responsible for the app or its content.'],
      },
    ],
  },
  guidelines: {
    title: 'Community Guidelines',
    updated: '27 October 2026',
    intro: 'Gatemate chats are for friendly, helpful travel conversation. These rules keep everyone safe.',
    sections: [
      { heading: 'Be kind', body: ['No harassment, hate speech, threats, bullying or discrimination of any kind.'] },
      { heading: 'Keep it clean', body: ['No sexual content, graphic violence, illegal goods or dangerous activities.'] },
      { heading: 'Protect privacy', body: ['Never share other people’s personal information, booking references, passport details or payment data.'] },
      { heading: 'No spam or scams', body: ['No advertising, chain messages, fake offers or phishing links. Never send money to someone you met in a lounge.'] },
      { heading: 'Safety & security', body: ['Do not discuss security threats or attempts to bypass airport security. Report anything worrying to airport staff immediately.'] },
      {
        heading: 'Reporting & enforcement',
        body: [
          'Long-press any message to report it or block its author. Reports are reviewed within 24 hours.',
          'Violations lead to content removal, temporary restrictions or permanent bans, and may be reported to authorities.',
        ],
      },
    ],
  },
};
