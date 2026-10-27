// Starting templates for the legal documents. They must be reviewed by a lawyer and
// published at public URLs (App Store Connect requires a Privacy Policy URL) before launch.

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
}

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    updated: '27 October 2026',
    intro:
      'Gatemate helps you manage flights and travel with friends. This policy explains what data we collect, why, and the choices you have. We follow the EU General Data Protection Regulation (GDPR).',
    sections: [
      {
        heading: 'Data we collect',
        body: [
          'Account data: your name, email address and, if you use Sign in with Apple or Google, the identifier those services provide. Apple may give us a private relay email instead of your real address.',
          'Travel data you add: flight numbers, airports, dates, seat, booking reference and the contents of boarding passes you scan. Scans are processed on your device; only the parsed details are uploaded when you save.',
          'Chat content: messages you send in trip groups and flight lounges, and reports you submit.',
          'Device data: push notification tokens, app version and crash diagnostics without personal content.',
        ],
      },
      {
        heading: 'How we use it',
        body: [
          'To provide the service: show your trips, send boarding and gate alerts, sync across your devices and deliver chat messages.',
          'To keep the community safe: moderate public lounges, investigate reports and prevent abuse.',
          'We do not sell your personal data, show third-party ads or track you across other companies’ apps and websites.',
        ],
      },
      {
        heading: 'Legal bases',
        body: ['Performance of our contract with you (core features), legitimate interest (security and abuse prevention) and your consent (optional notifications), which you can withdraw at any time.'],
      },
      {
        heading: 'Sharing',
        body: [
          'Trip members see the trip details and messages you share with that group. Lounge participants see your first name and messages.',
          'We use carefully selected processors for hosting, push delivery and flight-status data, bound by data processing agreements. Data is stored in the European Union.',
        ],
      },
      {
        heading: 'Retention & deletion',
        body: [
          'We keep your data while your account is active. Delete your account anytime in Profile → Delete account; we erase your data within 30 days, except where the law requires us to keep records.',
          'You can export a copy of your data from Profile → Export my data.',
        ],
      },
      {
        heading: 'Your rights',
        body: ['You can access, correct, delete, restrict or port your data and object to processing. You may also complain to your local data protection authority.'],
      },
      {
        heading: 'Security',
        body: ['Data is encrypted in transit (TLS) and at rest. Sign-in tokens are kept in your device’s secure enclave storage. No system is perfect, so please use a strong, unique password.'],
      },
      {
        heading: 'Children',
        body: ['Gatemate is not directed to children under 16, and we do not knowingly collect their data.'],
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
