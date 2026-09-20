/**
 * The Phase 1 gate, and later the golden fallback.
 *
 * A hand-written block array reproducing proposal/worked-example.md through the
 * same renderer the agent uses. If this does not look excellent, nothing built on
 * top of it will. Copy is taken from the kit verbatim wherever the kit has it.
 *
 *   npm run worked-example    ->  runs/worked-example/proposal.html
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Section } from '../render/blocks.js';
import { Section as SectionSchema } from '../render/blocks.js';
import { renderSections } from '../render/renderer.js';
import { renderDocument } from '../render/template.js';
import { RUNS_DIR } from '../paths.js';
import { isMain } from '../isMain.js';

export const WORKED_EXAMPLE: Section[] = [
  {
    id: 'cover',
    title: 'Cover',
    surface: 'dark',
    blocks: [
      {
        type: 'cover',
        client: 'Meridian Flow Systems Ltd',
        title: 'Your Saudi company, registered in 15 working days',
        date: '30 September 2026',
        reference: '0026.09.30.0000',
        clientSector: 'Flow measurement and metering · United Kingdom',
        sources: ['content/voice.md', 'proposal/section-briefs.md'],
      },
    ],
  },

  {
    id: 'contents',
    title: 'Contents',
    // Two seven-row tables flowing down two columns. One twelve-row table on a
    // 16:9 page is either set too small to read or too tall to fit.
    columns: 2,
    blocks: [
      {
        type: 'table',
        rows: [
          ['Introduction', '[page: introduction]'],
          ['Start Saudi, powered by Taajeel', '[page: about-start-saudi]'],
          ['A founder who was where you are', '[page: founder]'],
          ['About Meridian Flow Systems', '[page: about-the-client]'],
          ['The question that decides everything', '[page: the-question]'],
          ['The whole path', '[page: the-path]'],
          ['What you provide', '[page: the-path--2]'],
        ],
      },
      {
        type: 'table',
        rows: [
          ['Your dates, worked backwards', '[page: your-dates]'],
          ['Tracked separately — bank account and GM residency', '[page: tracked-separately]'],
          ['Not covered', '[page: not-covered]'],
          ['The fees', '[page: the-fees]'],
          ['Government fees', '[page: government-fees]'],
          ['Executive summary — Arabic', '[page: arabic-summary]'],
          ['Signoff and terms', '[page: signoff]'],
        ],
      },
    ],
  },

  {
    id: 'introduction',
    title: 'Introduction',
    blocks: [
      {
        type: 'two_col',
        variant: 'rail',
        left: {
          heading: 'Subject: Registering a Saudi company for Meridian Flow Systems Ltd (the "Assignment")',
          body: [
            'Thank you for the brief of 15 September. This sets out what we would do, how long each part takes, what we need from you, and what it costs.',
            'You asked for a straight answer rather than a polished one. There are two things in here you will not have expected, and one of them may change your capital requirement. They are on page [page: the-question] and we have put them before anything else.',
            'Truly yours,',
            '**Taajeel Business Solutions Co. LLC**',
          ],
        },
        right: {
          heading: '0026.09.30.0000',
          body: [
            '**Meridian Flow Systems Ltd**',
            'Unit 7, Thornfield Business Park, Harrogate, HG3 1QN, United Kingdom',
            '30 September 2026',
            '**Atte:** Ms. Katherine Brody, Managing Director',
            'Mob: +44 7700 900412',
            'Email: k.brody@meridianflow.co.uk',
          ],
        },
        sources: ['proposal/structure.md', 'proposal/section-briefs.md'],
      },
    ],
  },

  {
    id: 'about-start-saudi',
    title: 'Start Saudi, powered by Taajeel',
    blocks: [
      {
        type: 'understanding',
        paragraphs: [
          'Start Saudi registers Saudi companies for foreign founders and foreign companies. We run the whole path. Investment licence, trade name, articles of association, notarisation, commercial registration, government accounts. You sign from wherever you are.',
          'The filings are run by **Taajeel Business Solutions Co. LLC** (CR 1010941670, Riyadh). Start Saudi is Taajeel\'s company-registration arm for foreign entrants. The track record below is Taajeel\'s.',
        ],
        sources: ['content/01-company.md', 'content/03-credentials.md'],
      },
      {
        type: 'stat_row',
        stats: [
          { figure: '4,638+', caption: 'companies opened' },
          { figure: 'SAR 5.1B+', caption: 'attracted in capital and investment' },
          { figure: '407,000+', caption: 'services delivered for clients' },
          { figure: '15 working days', caption: 'to launch' },
        ],
        attribution:
          'Taajeel\'s track record, as published by Taajeel. Self-published and not independently corroborated.',
        sources: ['content/03-credentials.md'],
      },
      {
        type: 'understanding',
        paragraphs: [
          'Companies that launched with Taajeel include PKF Global, Grand View Research, OpenSooq, Ajlan & Bros Holding and iMENA Holding — conglomerates and one-person companies, regulated professional firms and straightforward trading entities.',
        ],
        sources: ['content/03-credentials.md'],
      },
    ],
  },

  {
    id: 'founder',
    title: 'A founder who was where you are',
    blocks: [
      {
        type: 'understanding',
        paragraphs: [
          'Dr. Sulaiman Alsalameh founded **ChiefNest** in the United States and registered it in Saudi Arabia through Taajeel.',
        ],
        sources: ['content/03-credentials.md'],
      },
      {
        type: 'quote',
        text: 'You don\'t know what you don\'t know. And that feeling sucks.',
        attribution: 'Dr. Sulaiman Alsalameh, founder of ChiefNest',
        note: 'Sulaiman is a Taajeel client and a partner in Start Saudi. We tell you that because you should weigh it.',
        sources: ['content/03-credentials.md'],
      },
      {
        type: 'quote',
        text: 'I went to a few places first and lost money.',
        attribution: 'The same',
        note: '[TO CONFIRM: dates and outcome of the ChiefNest registration — OPEN-QUESTIONS Q13.] Until that exists this page is two quotes and a disclosure.',
        sources: ['content/03-credentials.md'],
      },
    ],
  },

  {
    id: 'about-the-client',
    title: 'About Meridian Flow Systems',
    blocks: [
      {
        type: 'two_col',
        variant: 'rail',
        left: {
          heading: 'What we heard',
          body: [
            '**Meridian Flow Systems Ltd** is a private company registered in England and Wales under company number **10284471**, incorporated in **March 2016**, with its registered office at Unit 7, Thornfield Business Park, Harrogate. Eleven employees. Turnover to March 2026 of **£3.1m**.',
            'The company is owned by **Ms. Katherine Brody**, a British national holding **60%**, and **Dr. Assefa Bekele**, an Ethiopian and British dual national, holding **40%**. Both are directors. Ms. Brody is the sole authorised signatory.',
            'Meridian supplies flow-measurement and metering equipment to water utilities and industrial process clients, and services and calibrates what it supplies. The current split is approximately **45% equipment, 55% service and calibration**.',
            'Meridian has worked since 2024 with a Saudi water infrastructure contractor through that contractor\'s UK procurement arm. From the next package, beginning **1 March 2027**, the contractor requires suppliers to hold a Saudi commercial registration. Meridian therefore intends to establish a wholly-owned Saudi subsidiary, invoice in riyals, and employ engineers locally within the first year.',
          ],
        },
        right: {
          heading: 'What that means here',
          body: [
            '**Proposed:** limited liability company — foreign, single corporate shareholder',
            '**Tax:** as a foreign-owned entity, subject to income tax provisions of 20% of net income. Saudi and GCC-owned companies fall under zakat instead, at a much lower headline rate. We state the regime; we are not your tax advisers and you should take your own advice on it',
            '**Your attestation route:** apostille. The United Kingdom is a Hague Apostille Convention member, so your documents are apostilled at home and submitted for Saudi attestation without a separate embassy visit. This is the shorter of the two routes',
            '**Dr. Bekele\'s dual nationality:** not a factor. MISA licences the foreign shareholder; the shareholder here is Meridian Flow Systems Ltd, a UK company',
          ],
        },
        sources: [
          'proposal/sample-rfp.md',
          'content/07-client-types.md',
          'content/02-services/00-document-preparation.md',
        ],
      },
    ],
  },

  {
    id: 'the-question',
    title: 'The question that decides everything',
    surface: 'dark',
    blocks: [
      {
        type: 'statement',
        eyebrow: 'You don\'t know what you don\'t know',
        text: 'Your activity has not been classified yet, and the classification changes your capital requirement by two orders of magnitude.',
        sources: ['content/voice.md', 'content/07-client-types.md'],
      },
      {
        type: 'understanding',
        paragraphs: [
          'You asked whether a company of your type can be 100% foreign-owned. For most activities, yes. Saudi Arabia allows full foreign ownership under an investment licence from the Ministry of Investment. You described yourselves as 45% equipment, 55% service. Those two halves sit in different places:',
          '- **Classified as services** — calibration, maintenance, technical support — there is **no minimum capital fixed in law**. In practice MISA expects capital proportionate to the activity, and the working benchmark commonly cited for a services company is around **SAR 500,000**.',
          '- **Classified as retail or wholesale trading** at 100% foreign ownership, published guidance cites a capital requirement of **SAR 30,000,000** — roughly sixty times that benchmark.',
          'We are not going to guess which applies. Your brief does not give us enough to settle it. **We confirm the classification with MISA before you commit to anything.** It is the first thing on the discovery call, and the call is free.',
          'The second thing you did not ask about is on page [page: tracked-separately]. Someone has to be your General Manager in Saudi Arabia, and neither of you is going to be resident.',
        ],
        sources: [
          'content/07-client-types.md',
          'content/05-pricing.md',
          'content/02-services/01-misa-investment-licence.md',
        ],
      },
    ],
  },

  {
    id: 'the-path',
    title: 'The whole path',
    blocks: [
      {
        type: 'approach_steps',
        steps: [
          {
            title: 'Investment ministry licence',
            text: 'The MISA licence that lets a foreign owner hold the company',
            duration: '10 working days',
          },
          {
            title: 'Trade name reservation',
            text: 'Your company name, reserved with the Ministry of Commerce',
            duration: '48 hours, in parallel with step 1',
          },
          {
            title: 'Articles and notarisation',
            text: 'Articles of association drafted, signed and notarised',
            duration: '72 hours',
          },
          {
            title: 'Commercial registration',
            text: 'The CR is issued. Your company legally exists',
            duration: '24 hours',
          },
          {
            title: 'Government account activation',
            // content/04-process.md verbatim. The portal names moved to the
            // footnote: a node on a path diagram carries one line, not six.
            text: 'Tax, social insurance and labour portals switched on',
            duration: '24 hours',
          },
          {
            title: 'After incorporation',
            text: 'GM visa and bank account, tracked separately',
            duration: 'page [page: tracked-separately]',
          },
        ],
        note: 'Steps 1 and 2 run in parallel, which is why the total is 15 and not 17. **The durations above are the government\'s, not ours.** Fifteen working days means fifteen Saudi business days — Sunday to Thursday, about three calendar weeks from complete documents. A service promise, not a legal guarantee from any ministry. Step 5 covers ZATCA, GOSI, Qiwa, National Address and the Chamber of Commerce.',
        sources: ['content/04-process.md', 'content/02-services/01-misa-investment-licence.md'],
      },
      {
        type: 'understanding',
        heading: 'What you provide',
        paragraphs: [
          'All apostilled and translated into Arabic: Meridian\'s certificate of incorporation; articles of association; a certificate of good standing; a board resolution approving the Saudi company; **financial statements for the last full year**; and a Power of Attorney executed before a notary public in the UK.',
          'Two notes on that list. The Power of Attorney must be **specific, not general** — it has to name the exact acts, including the MISA application and the signing of the articles. And the financial statements we need are your **FY2025** accounts, which are already filed; the 2026 accounts your accountant has do not hold this up.',
        ],
        sources: ['content/02-services/00-document-preparation.md'],
      },
    ],
  },

  {
    id: 'your-dates',
    title: 'Your dates, worked backwards',
    blocks: [
      {
        type: 'timeline',
        phases: [
          {
            when: 'Now — before you choose a provider',
            what: 'Start the apostille on the six documents on page [page: the-path--2]',
            who: 'Yours',
          },
          {
            when: 'By Mon 7 December 2026',
            what: 'Documents complete and with us. **This is the only date that matters**',
            who: 'Yours',
          },
          {
            when: 'Mon 7 Dec → Sun 27 December',
            what: 'The 15 working days. MISA licence and trade name, then articles, notarisation, CR, government accounts',
            who: 'Ours',
          },
          {
            when: 'Sun 27 December',
            what: '**CR issued. The company legally exists.** Enough for your client\'s supplier listing, if their process needs only the CR',
          },
          {
            when: 'Late Dec → mid/late January',
            what: 'Bank account. 2–3 weeks after an active CR, run by the bank',
            who: "The bank's",
          },
          { when: '1 March 2027', what: 'You can invoice in riyals' },
        ],
        note: 'That leaves about five weeks of buffer before 1 March, and about five weeks between the CR and the end-of-January listing.',
        sources: ['content/04-process.md', 'proposal/sample-rfp.md'],
      },
      {
        type: 'understanding',
        heading: 'Three things about this plan you should know',
        paragraphs: [
          '**Registered is not operating.** The CR proves your company exists. It does not mean you can trade. You cannot open a bank account, sign contracts, invoice clients or hire staff until the CR is issued — and invoicing in riyals needs the bank account, not the CR. Ask your client which they need.',
          '**Attestation is the critical path and it is yours.** The fifteen days starts when your documents are complete. Getting them apostilled sits before that, on your side, and across every foreign registration it is the single biggest variable. Start it now; do not wait for 17 October.',
          '**If 7 December slips, everything after it slips by the same amount.** There is buffer at the end, not in the middle.',
        ],
        sources: ['content/04-process.md', 'content/02-services/04-commercial-registration.md'],
      },
    ],
  },

  {
    id: 'tracked-separately',
    title: 'Tracked separately — bank account and GM residency',
    blocks: [
      {
        type: 'two_col',
        left: {
          heading: 'The bank account',
          body: [
            '**2–3 weeks after your CR is active.** The bank runs its own compliance entirely outside the registration process, and it can take as long as the registration itself.',
            'The bank will want the CR, the MISA licence, the articles, the National Address, the ZATCA registration and signatory ID — and, because your shareholder is a company, **Meridian\'s incorporation documents and board resolutions again, attested again, for the bank\'s own file**. Get two sets apostilled in December rather than one.',
            'Depending on the bank, opening the account may need someone to attend in person. We tell you which banks require it before you choose one.',
          ],
        },
        right: {
          heading: 'The General Manager',
          body: [
            'Your Saudi company must have a registered General Manager, and the GM is named in the articles of association — **step 3, not year one**. So this is a December decision, not a 2027 one.',
            'You do not need to be resident to own the company. Ownership and residency are separate questions in Saudi law. But somebody has to be the GM, and that name goes into the articles in December.',
          ],
        },
        sources: [
          'content/02-services/06-bank-account-opening.md',
          'content/02-services/07-gm-visa-and-residency.md',
        ],
      },
      {
        type: 'table',
        headers: ['Route', 'What it means', 'Time', 'Cost'],
        rows: [
          [
            '**Daniel Ayre relocates**',
            'He becomes GM and takes the residency path: MISA support letter, HRSD approval, work visa, contract attestation, embassy, medical, biometrics, Iqama',
            'Roughly **six to eight weeks** after the CR, much of it dependent on his own availability',
            '[TO CONFIRM: Start Saudi\'s fee for the GM residency path], plus government fees on page [page: government-fees]',
          ],
          [
            '**Appoint a resident GM**',
            'Someone already resident in the Kingdom is named',
            'No residency process',
            'Requires finding and trusting someone',
          ],
          [
            '**Temporary General Manager**',
            'A GM is provided while you recruit or while Daniel\'s residency runs',
            '[TO CONFIRM: lead time]',
            '[TO CONFIRM]',
          ],
        ],
        footnote:
          'Two things sit outside the fifteen days. We track both and we tell you where they stand, but they run on their own timelines and neither is in our control.',
        sources: ['content/02-services/07-gm-visa-and-residency.md'],
      },
    ],
  },

  {
    id: 'not-covered',
    title: 'Not covered',
    blocks: [
      {
        // Nine exclusions is a list to scan, not prose to read, so it is set as
        // two columns of four or five rather than one column of nine.
        type: 'two_col',
        left: {
          heading: 'Not in the fee. Available, priced separately',
          body: [
            '- Apostille and legalisation of your documents in the UK, and certified Arabic translation',
            '- Bank account opening support',
            '- The GM residency path, and any employee visas after it',
            '- Employment contracts, payroll and ongoing HR and government-relations operations',
            '- Recruitment of your Saudi engineers',
          ],
        },
        right: {
          heading: 'Also outside this fee',
          body: [
            '- Trademark registration',
            '- Any activity-specific licence beyond the MISA investment licence, should your classification require one',
            '- Annual renewals after year one — the commercial registration, the Chamber of Commerce subscription and the platform subscriptions all renew',
            '- Legal, accounting, Zakat and tax advice. We are not your lawyers or your accountants and our terms say so',
          ],
        },
        sources: ['content/05-pricing.md', 'proposal/terms-and-conditions.md'],
      },
    ],
  },

  {
    id: 'the-fees',
    title: 'The fees',
    blocks: [
      {
        type: 'understanding',
        paragraphs: [
          'The price has two parts. **Taajeel\'s service fee**, for running the filings end to end — the six steps on page [page: the-path]. And **government fees**, set by the authorities and varying by activity and company type. They are on page [page: government-fees]. **Government fees are not included in the service fee.**',
        ],
        sources: ['content/05-pricing.md'],
      },
      {
        type: 'table',
        rows: [
          ['Taajeel service fee', '[TO CONFIRM: service fee for a foreign-owned LLC of this scope — Q17]'],
          ['VAT at 15%, charged on the service fee', '[TO CONFIRM]'],
        ],
        sources: ['content/05-pricing.md'],
      },
      {
        type: 'two_col',
        left: {
          heading: 'Payment',
          body: [
            '- **50%** on signing',
            '- **35%** on approval of the MISA licence',
            '- **15%** on issue of the commercial registration',
            'Two of those three milestones are government outcomes you can verify yourself. You mentioned an adviser who took a deposit and went quiet; this is the structure that answers that, and you should hold us to it.',
          ],
        },
        right: {
          heading: 'Notes',
          body: [
            '- Payments are due within five days of the maturity date',
            '- Payments are non-refundable and payable on signing',
            '- VAT at 15% is charged on fees paid, per ZATCA',
            '- **Share capital is not a fee.** It is money you put into your own company. See page [page: the-question] — the amount depends on your activity classification, and settling that comes first',
          ],
        },
        sources: ['content/05-pricing.md'],
      },
    ],
  },

  {
    id: 'government-fees',
    title: 'Government fees',
    blocks: [
      {
        type: 'table',
        headers: ['Authority', 'Fee'],
        rows: [
          [
            'Ministry of Investment — the MISA licence',
            '**Set on issue.** Published guidance currently contradicts itself on this fee: some 2026 sources report it waived, others cite thousands of riyals annually. We give you the confirmed figure in writing when it is billed, and we do not estimate it',
          ],
          ['Ministry of Commerce — registration', '~SAR 1,775 first year, ~SAR 2,165 on renewal'],
          ['Qiwa platform', '~SAR 1,265 per year'],
          [
            'Muqeem platform',
            '~SAR 1,840 — a subscription of ~SAR 1,265 for the year plus ~SAR 575 for a 2,500-point balance. The points are consumed, so this is not a flat annual figure',
          ],
          ['Riyadh Chamber of Commerce', '~SAR 350 — a balance for issuing 10 letters, not a membership fee'],
          ['**First-year total, excluding the MISA licence**', '**~SAR 5,230**'],
        ],
        footnote:
          'Set by the authorities. Not ours, and not marked up. These figures are indicative — they are the estimates given in a comparable foreign company formation *quoted* in June 2026, a proposal rather than a completed engagement, and not yours. Your confirmed figures come with the written quotation, before you commit. If Daniel takes the residency route, government fees for one Iqama run to roughly **SAR 14,750 per person per year**.',
        sources: ['content/05-pricing.md'],
      },
    ],
  },

  {
    id: 'arabic-summary',
    title: 'Executive summary — Arabic',
    blocks: [
      {
        type: 'rtl_section',
        latinHeading: 'Executive summary · Arabic',
        heading: 'الملخص التنفيذي',
        body: [
          'نُسجّل شركتكم السعودية خلال **15 يوم عمل**، ابتداءً من اكتمال المستندات. ويعني ذلك أيام العمل السعودية، من الأحد إلى الخميس.',
          'نُنفّذ المسار كاملاً: رخصة الاستثمار من وزارة الاستثمار، وحجز الاسم التجاري، وعقد التأسيس وتوثيقه، والسجل التجاري، وتفعيل الحسابات الحكومية. توقّعون من مكانكم.',
          'الخطوتان الأولى والثانية تجريان بالتوازي. **المدد أعلاه مدد الجهات الحكومية، وليست مددنا.** وأمران خارج هذه المدة: الحساب البنكي، وإقامة المدير العام. نتابعهما ونخبركم بوضعهما، ويسير كل منهما على جدوله الخاص.',
          'تصنيف نشاط شركة Meridian Flow Systems Ltd لم يُحدَّد بعد، وهو التصنيف الذي يحدد رأس المال المطلوب: نحو **500,000 ريال** للأنشطة الخدمية، مقابل **30,000,000 ريال** لأنشطة التجزئة والجملة. نؤكّد التصنيف مع وزارة الاستثمار قبل التزامكم.',
          'التاريخ الحاسم هو **7 ديسمبر 2026**: اكتمال مستنداتكم. وكل تأخير بعده يؤخر ما يليه بالقدر نفسه.',
        ],
        sources: ['content/04-process.md', 'content/07-client-types.md'],
      },
    ],
  },

  {
    id: 'signoff',
    title: 'Signoff',
    blocks: [
      {
        type: 'close',
        heading: 'How to say yes',
        cta: 'We hope this proposal meets your requirements for the Assignment. This document constitutes an Engagement Letter for the Assignment presented; kindly sign off and affix your official stamp.',
        signatories: [
          {
            party: 'For and on behalf of Taajeel Business Solutions Co. LLC',
            lines: ['Muath Abdullah A AlZahrani', 'General Manager', 'Signature:', 'Date:'],
          },
          {
            party: 'For and on behalf of Meridian Flow Systems Ltd',
            lines: ['Name:', 'Position:', 'Signature:', 'Date:'],
          },
        ],
        contact: [
          '[TO CONFIRM: whether Start Saudi proposals contract as Taajeel Business Solutions Co. LLC or as a separate entity — Q8]',
        ],
        sources: ['proposal/structure.md', 'proposal/terms-and-conditions.md'],
      },
    ],
  },

  {
    id: 'terms',
    title: 'Terms and conditions',
    blocks: [
      {
        type: 'understanding',
        heading: 'Taajeel\'s nine standard clauses apply in full',
        paragraphs: [
          'Definitions · Role of Taajeel · Authority · Information · Confidentiality · Taajeel Liability · Advertisements · Termination · Notices. They follow this page in full and unaltered. Four of them are worth surfacing here rather than leaving buried:',
          '- **Liability is capped at the fees actually paid.**',
          '- **Disputes go to arbitration** at the GCC Commercial Arbitration Centre.',
          '- **The agreement runs one year and renews automatically** unless either side gives 90 days\' notice.',
          '- **We are not responsible for legal, regulatory, accounting, Zakat or taxation advice.** Page [page: the-question] tells you what we will confirm with MISA; it is not tax advice and you should take your own.',
        ],
        sources: ['proposal/terms-and-conditions.md'],
      },
    ],
  },

  {
    id: 'terms-clauses',
    title: 'Terms and conditions, 1 of 2',
    appendix: true,
    blocks: [
      {
        type: 'understanding',
        heading: 'DEFINITIONS',
        paragraphs: [
          'References in these Terms to the "Letter" and/or "Proposal" mean the covering letter accompanying these Terms. Unless otherwise defined, words defined in the Letter and/or "Proposal" have the same meaning in these Terms.',
        ],
        sources: ['proposal/terms-and-conditions.md'],
      },
      {
        type: 'understanding',
        heading: 'ROLE OF Taajeel',
        paragraphs: [
          'Taajeel will carry out the services set out in the "Letter" and/or "Proposal" and will not be obliged to provide any other advice or services unless it expressly agrees to do so. It will not be responsible for providing other specialist advice (such as on legal, regulatory, accounting, Zakat, or taxation matters), building certain infrastructure that the Client may require or set specifications (such as systems, servers, equipment, programs, etc), or services which the Client has agreed to provide or would usually provide (or which are being provided or would usually be provided by a third party), nor will it be responsible for any due diligence beyond the scope agreed in the "Letter" and/or "Proposal". It is the Client\'s responsibility to consider all advice received from its other advisors, if any, and to ensure that such advice is adequate for the purposes of the Assignment. Taajeel\'s role in connection with the Assignment must not be disclosed by the Client or announced publicly unless Taajeel agrees or is required by law or appropriate regulatory authority.',
        ],
        sources: ['proposal/terms-and-conditions.md'],
      },
      {
        type: 'understanding',
        heading: 'AUTHORITY',
        paragraphs: [
          'The Client agrees that its instructions in relation to the Assignment will be properly authorised if they are given (whether verbally or in writing) by any of the persons referred to in the Letter and/or "Proposal". The Client undertakes to ensure that it and the parties connected with it retain all the authorisations and comply with all laws and regulatory requirements relevant to the Assignment and/or the Project.',
          'Taajeel is authorised by the Client to carry out such steps as it considers necessary to complete the Assignment including acting through agents and using the services of separate legal or other professional advisers of its choice. Any of the services to be performed by Taajeel may, at Taajeel\'s discretion to be performed by any of Taajeel\'s subsidiaries and/or any of their respective officers, employees, representatives, or agents (together the "Taajeel Group" and each a "member of the Taajeel Group").',
        ],
        sources: ['proposal/terms-and-conditions.md'],
      },
      {
        type: 'understanding',
        heading: 'INFORMATION',
        paragraphs: [
          'To enable it to carry out the Assignment, Taajeel may require certain information from the Client which may relate either to the business, assets, operation, or financial condition of the Client. Taajeel will rely on the Client to provide such information in a timely manner and to check that any such information supplied is true, fair, complete and accurate and not misleading in any material respect. If the Client discovers that any information so supplied or published which is material in the context of the Assignment is not true, fair, complete, and accurate or is misleading in any material respect, the Client will notify Taajeel immediately.',
        ],
        sources: ['proposal/terms-and-conditions.md'],
      },
      {
        type: 'understanding',
        heading: 'CONFIDENTIALITY',
        paragraphs: [
          'Taajeel shall not disclose to any person (other than to members of the Taajeel Group or, with the Client\'s consent, Taajeel\'s holding company (the Taajeel Group and Taajeel\'s holding company together the "Group") or its or the holding company\'s professional advisers) any Confidential Information provided to Taajeel pursuant to the Assignment except in the performance of its duties and obligations hereunder or as required by law or any appropriate regulatory authority. For these purposes, "Confidential Information" means any information or data concerning the Client which has been provided to Taajeel by the Client that would appear to a reasonable person to be confidential or proprietary (or that the Client has indicated is confidential or proprietary) and which is not in the public domain (otherwise than as a result of a breach of these Terms by Taajeel) or was already in the possession of Taajeel.',
          'Any advice or documentation provided by Taajeel is, unless otherwise agreed by Taajeel, solely for the benefit of the Client and may not be used or relied on by any third party without Taajeel\'s prior written consent. The Client agrees that it will keep confidential and will not disclose to any person (other than to its other professional advisers) advice or documentation which it receives from Taajeel except as required by law or any appropriate regulatory authority.',
          'Intellectual property rights in all advice and documentation prepared by Taajeel in relation to the Assignment shall vest in Taajeel absolutely, but the Client shall have a licence to copy the documentation in its entire form for the purpose of the Assignment.',
        ],
        sources: ['proposal/terms-and-conditions.md'],
      },
    ],
  },

  {
    id: 'terms-clauses-2',
    title: 'Terms and conditions, 2 of 2',
    appendix: true,
    blocks: [
      {
        type: 'understanding',
        heading: 'Taajeel LIABILITY',
        paragraphs: [
          'The Client agrees that, and for all circumstances, Taajeel\'s unforeseeable liability will not exceed total actual fees paid subject matter of the Letter and/or Proposal given that this Assignment is in effect, thus, after completion of the Project and turning in the deliverables indicated in the Letter and/or Proposal, the Client has no recourse on Taajeel for any fees paid relevant to the Assignment. Furthermore, Taajeel is entitled to renegotiate with the Client the circumstances for proper corrective actions otherwise actual costs incurred by Taajeel and Group will be subtracted from the actual fees received by Taajeel.',
        ],
        sources: ['proposal/terms-and-conditions.md'],
      },
      {
        type: 'understanding',
        heading: 'ADVERTISEMENTS',
        paragraphs: [
          'Any advertisements relating to the Assignment must be agreed between the Client and Taajeel. The Client will ensure that all announcements or documents published, or statements made or issued by it or on its behalf, or previously specifically approved or authorised by it or by Taajeel, in connection with the Assignment or relevant to it will only be made, issued or published after consultation with Taajeel or, where Taajeel is asked to approve such announcement, document, or statement for the purposes of publicity, with the prior agreement of Taajeel. The Client will ensure that all such announcements, documents, and statements will be true and accurate in all material respects and not misleading or defamatory and, where appropriate, will contain all information and expressions of opinion necessary for legal or regulatory purposes and that all opinions expressed will be honestly held and made after due and careful consideration.',
        ],
        sources: ['proposal/terms-and-conditions.md'],
      },
      {
        type: 'understanding',
        heading: 'TERMINATION',
        paragraphs: [
          'The Agreement Duration is what is specified in the timeframe section or one year starting from the date of signing on this Proposal. The Agreement will be automatically renewed for similar period (or periods) unless an official termination letter is furnished by one party to the other 90 days before the end of the Agreement Duration. Taajeel has the right to claim additional fees for additional takes requested by the Client.',
          'Taajeel may terminate the Assignment at any time by notice in writing if the Client commits a material breach of its obligations under these Terms or the Letter which it fails to remedy within 14 days of being requested to do so or such breach is incapable of remedy.',
          'Any conflicts emerging from this Proposal/Engagement Letter, and for any reason will be resolved via Arbitration. Such Arbitration will take place in GCC Commercial Arbitration Centre (www.gcccac.org).',
        ],
        sources: ['proposal/terms-and-conditions.md'],
      },
      {
        type: 'understanding',
        heading: 'NOTICES',
        paragraphs: [
          'Any notice or other document which may be given or served by either the Client or Taajeel pursuant to the Letter and/or Proposal or these Terms shall be deemed to have been duly given or served on the other party if left at or sent by first class post, electronic mail, or by fax to its registered office or to the address (or fax number) of the other party set out in the Letter and/or Proposal or to such other address (or fax number) as may have been notified by one party to the other. In the case of posting, any such notice shall be deemed to have been received 96 hours after posting. In the case of fax transmission, any such notice shall be deemed to have been received by the addressee immediately upon receipt by the sender of such machine record as indicates that the entire fax was sent to the relevant number.',
        ],
        sources: ['proposal/terms-and-conditions.md'],
      },
    ],
  },

  {
    id: 'back-cover',
    title: 'Contact',
    surface: 'dark',
    blocks: [
      {
        type: 'close',
        cta: 'The discovery call is free, and the activity classification is the first thing on it.',
        contact: [
          '**Taajeel Business Solutions Co. LLC** · CR: 1010941670',
          'Tel: +966 92000 6247 · Mob: +966 56 920 7725',
          'Riyadh, RHTA 7697, 7697 Abi Baker Siddiq AlTaawun, First floor, office No. 03 & 04',
          'www.taajeel.sa',
          'Start Saudi · start-saudi.com · Powered by Taajeel',
        ],
        sources: ['content/01-company.md'],
      },
    ],
  },
];

if (isMain(import.meta.url)) {
  const sections = WORKED_EXAMPLE.map((s) => SectionSchema.parse(s));
  const html = renderDocument({
    title: 'Meridian Flow Systems Ltd — Start Saudi proposal',
    sectionsHtml: renderSections(sections),
    assetPrefix: process.argv.includes('--file') ? '../../public/' : '/',
  });
  const dir = join(RUNS_DIR, 'worked-example');
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'proposal.html');
  writeFileSync(out, html, 'utf8');
  console.log(`${sections.length} sections -> ${out}`);
}
