// Everything the home page says below the hero, in one place.
// Facts come from the CV, Wilson's project notes and the records; nothing here is estimated.
// The streams of words in each project ("flood") are illustrative, and the page says so.

export const person = {
  name: 'Wilson Mota',
  role: 'Business Intelligence Manager at Corient',
  place: 'Fribourg, Switzerland',
  email: 'wilson.lisboa@wilsonlisboa.com',
  linkedin: 'https://www.linkedin.com/in/wilson-lisboa-mota/',
  cv: '/cv/',
  pdf: '/cv/wilson-lisboa-mota-cv.pdf',
};

// ---------- Artificial Intelligence ----------
const bot = '/work/ai-trading-bot/';

export const rules = [
  { t: 'I choose the tools. The AI builds.', d: 'In the trading bot, I picked the broker and the AI models that read the news. Claude wrote the code and the tests.', href: `${bot}#who`, a: 'Who did what' },
  { t: 'The bar is set before the results.', d: 'The pass marks were written down before the first test. No idea reached them, and the page says so.', href: `${bot}#research`, a: 'The research' },
  { t: 'Results are checked twice.', d: "A second AI agent redid the bot's calculations on its own. The Bitcoin figures were rebuilt from raw prices.", href: `${bot}bitcoin-study/`, a: 'The Bitcoin study' },
  { t: 'What fails stays on the page.', d: 'Every case study ends with its limits, down to a leaked API key that had to be revoked.', href: `${bot}#limits`, a: "The trading bot's limits" },
];

export interface Project {
  id: string;
  name: string;
  status: string;
  live?: boolean;
  line: string;
  /** What stands between the flood and the answer. */
  gate: string;
  answer: string;
  means: string;
  /** Rows of illustrative words; a leading * marks a word that lights up. */
  flood: string[][];
  href?: string;
  cta?: string;
  aiLabel: string;
  me: string[];
  ai: string[];
  not: string[];
  proof:
    | { kind: 'bars'; cap: string; goal: number; rows: { l: string; v: number; t: string }[] }
    | { kind: 'steps'; cap: string; steps: string[] }
    | { kind: 'phone'; cap: string; src: string; alt: string };
}

export const projects: Project[] = [
  {
    id: 'bot',
    name: 'AI Trading Bot',
    status: 'Live on paper trading',
    live: true,
    line: 'AI builds a trading bot in minutes. The hard part is tuning it to behave the way I would.',
    gate: 'AI reads the news · code decides',
    answer: 'no edge yet.',
    means: 'Three ideas, tested against a bar set in advance. None passed, and the page says so.',
    flood: [
      ['earnings beat', '*upgrade', 'new contract', 'recall', 'guidance cut', 'record quarter', '*profit warning', 'buyback'],
      ['open', 'high', 'low', '*close', 'volume', 'open', 'high', 'low', 'close', '*volume'],
      ['merger talks', '*downgrade', 'lawsuit', 'new product', 'CEO steps down', '*approval', 'strike', 'dividend'],
      ['stop loss', '10% rule', '*diversify', 'paper account', 'stop loss', '10% rule', 'diversify', '*paper account'],
      ['headline', 'headline', '*positive', 'headline', '*negative', 'headline', 'headline', 'neutral'],
    ],
    href: bot,
    cta: 'Read the case study',
    aiLabel: 'What the AI did',
    me: ['Chose the broker: Alpaca, with one paper account per bot.', 'Chose the AI that reads the news: Jev, through OpenRouter.', 'Kept it to stocks, and to paper money.'],
    ai: ['Wrote the test engine, the bots and their tests.', 'A second AI agent redid the research sums and found 3 bugs in the test code.', "An audit of the bot's code added four safety rules before the pilot."],
    not: ['No proven edge: none of the three ideas reached the bar.', 'No real money. The pilot is reviewed on 11 December 2026.'],
    proof: {
      kind: 'bars',
      cap: 'How sure can we be that the edge is real? The bar, set before the tests: 95%.',
      goal: 95,
      rows: [
        { l: 'Follow the trend', v: 62, t: '62%' },
        { l: 'Step back when the market is nervous', v: 91, t: '91%' },
        { l: 'Buy the dip', v: 0.6, t: 'almost 0%' },
      ],
    },
  },
  {
    id: 'cfo',
    name: 'Personal CFO',
    status: 'Working pipeline · product not built',
    line: 'My whole financial situation, live: where the money goes, what changed and what comes next.',
    gate: 'code calculates · AI explains',
    answer: 'a payment lapsed.',
    means: 'One of five things it found that I had missed.',
    flood: [
      ['groceries', 'rent', '*childcare', 'insurance', 'subscription', 'card payment', '*refund', 'utilities'],
      ['transfer', 'standing order', 'cash', '*duplicate?', 'transfer', 'standing order', 'cash', 'annual fee'],
      ['salary', 'tax instalment', '*no payee named', 'pharmacy', 'fuel', 'salary', '*tax instalment', 'school'],
      ['CHF', 'EUR', 'CHF', '*EUR', 'CHF', 'EUR', '*CHF', 'EUR', 'CHF', 'EUR'],
      ['bank export', 'bank export', '*matched', 'bank export', 'bank export', '*recurring', 'bank export', 'gap'],
    ],
    aiLabel: 'What the AI did',
    me: ['Set the rule: the AI never calculates. Code does the sums; the AI classifies and explains.', 'Kept a human check on what the AI classifies.', 'Set a commercial version aside, for three reasons that are on record.'],
    ai: ['Profiled the bank exports: formats, duplicates, transfers and gaps.', 'Wrote the pipeline in Python, from raw exports to analytics.', 'Flagged what it did not know instead of filling the gaps.'],
    not: ['The product itself: phase one is not built.', 'About 29% of spending had no named payee on the statement.', 'The rules were written by hand for these banks. A second user would need new ones.'],
    proof: { kind: 'steps', cap: 'About 2,400 real transactions. Every number traces back to one of them.', steps: ['Raw', 'Standardised', 'Canonical', 'Analytics'] },
  },
  {
    id: 'radar',
    name: 'Property Deal Radar',
    status: 'In alpha · first alerts not sent yet',
    line: 'Brings together the property investments with the best economic viability, and alerts me when a hot deal appears.',
    gate: 'find · check · run the numbers',
    answer: 'no alert sent yet.',
    means: 'In alpha. It is built to speak only when a new hot deal appears.',
    flood: [
      ['new listing', '*price down', 're-listed', 'needs works', 'rented', 'top floor', '*duplicate', 'garage'],
      ['portal A', 'portal B', 'portal C', '*portal A', 'portal B', 'portal C', 'portal A', '*portal B'],
      ['yield ?', 'cash flow ?', '*equity needed', 'yield ?', 'cash flow ?', 'equity needed', '*yield ?', 'vacancy'],
      ['2 rooms', '3 rooms', 'studio', '*building', '2 rooms', 'land', '3 rooms', '*studio'],
      ['removed', 'sold?', '*price up', 'no photos', 'auction', 'removed', '*reserved', 'missing data'],
    ],
    aiLabel: 'What the AI is built to do',
    me: ['Set the criteria for a deal that makes economic sense.', 'Keep one list, so the same property is never shown twice.', 'Asked for an alert only when a new hot deal appears.'],
    ai: ['Find listings across portals and remove the duplicates.', 'Run the numbers: yield, cash flow and the equity needed.', 'Rate the risk, and say what information is missing.'],
    not: ['In alpha: no alert has been sent yet.', 'Not every portal allows automated collection.', 'Rents are estimates, not income.'],
    proof: { kind: 'steps', cap: 'Built for my own investments, and the kind of tool an estate agent would want.', steps: ['Find', 'De-duplicate', 'Run the numbers', 'Rate the risk', 'Alert'] },
  },
  {
    id: 'life',
    name: 'Life HQ',
    status: 'Started November 2026 · app phase one built',
    line: 'Six AI specialists and one shared folder plan my training, meals and recovery around the week I actually have.',
    gate: 'six specialists · one shared brain',
    answer: 'session B, light.',
    means: 'An example of what it says. Every session comes in three versions, so a tired day still counts.',
    flood: [
      ['sleep', 'steps', '*recovery', 'protein', 'energy', 'sleep', 'steps', '*soreness'],
      ['session A', 'session B', 'walk', '*rest', 'session A', 'session B', '*walk', 'rest'],
      ['meal photo', 'breakfast', '*lunch out', 'dinner', 'snack', 'meal photo', '*breakfast', 'water'],
      ['office day', 'home day', '*short night', 'office day', 'home day', 'weekend', '*office day', 'home day'],
      ['waist', 'weight', 'photos', '*effort', 'waist', 'weight', '*consistency', 'mood'],
    ],
    aiLabel: 'What the AI does',
    me: ['Designed the structure: one folder as the shared brain, one owner per file.', 'Set the rules: records are only added, never rewritten, and the AI never invents precision.', 'Make the calls. The specialists analyse and propose.'],
    ai: ['Six chats, each with one job: HQ, training, nutrition, progress, the app and recovery.', 'Built the plan, 14 exercise sheets and a phone app that shows today’s session.', 'Rebuilds the Excel report from the raw files, never by hand.'],
    not: ['Early days: no trend is read before week three.', 'The app is phase one. Reminders and the 3D figure are still to come.'],
    proof: { kind: 'phone', cap: 'The app, phase one: today’s session, in three versions.', src: '/work/life-hq-app.png', alt: 'The phone app, in Portuguese: Tuesday, session B, with a quick, a normal and a light version.' },
  },
];

// ---------- Business Intelligence: the trajectory ----------
export interface Role {
  id: string;
  org: string;
  short: string;
  title: string;
  /** A shorter title for the chart's label, where the full one does not fit. */
  label?: string;
  /** [year, month] */
  from: [number, number];
  to: [number, number] | null;
  when: string;
  /** main: a BI role; side: alongside one; pre: before BI. */
  kind: 'main' | 'side' | 'pre';
  bullets: string[];
  tools: string[];
  note?: string;
}

// Top to bottom, latest first, so the bars climb to the right.
export const roles: Role[] = [
  {
    id: 'corient', org: 'Corient', short: 'Corient', title: 'Business Intelligence Manager', label: 'BI Manager', from: [2025, 1], to: null, when: '01/2025 – today', kind: 'main',
    bullets: [
      'Lead a team of 6 BI developers delivering analytical solutions to the whole group.',
      'Own the Power BI platform, ensuring governance, security and scalability.',
      'Drive automation and AI adoption to increase business performance.',
      'Partner with leadership to shape reporting strategy and ensure compliance.',
    ],
    tools: ['ssms', 'mage', 'powerbi', 'tableau', 'databricks', 'copilot', 'claude'],
    note: 'Stonehage Fleming became part of Corient: one continuous path since 2021.',
  },
  {
    id: 'sf', org: 'Stonehage Fleming', short: 'Stonehage F.', title: 'Senior BI Analyst', from: [2021, 12], to: [2024, 12], when: '12/2021 – 12/2024', kind: 'main',
    bullets: [
      'Led the implementation and configuration of Power BI Service in the company.',
      'Responsible for the Dremio and dbt architecture, security and governance.',
      'Developed several Alteryx processes that support business operations.',
      'Developed products with SSIS, Visual Studio, MDM and Mage.ai.',
    ],
    tools: ['ssms', 'ssis', 'alteryx', 'mage', 'powerbi', 'excel', 'dremio', 'bc', 'copilot'],
  },
  {
    id: 'fl', org: 'Freelance', short: 'Freelance', title: 'BI Consultant', from: [2021, 3], to: [2021, 11], when: '03/2021 – 11/2021', kind: 'main',
    bullets: [
      'Developed Power BI reports that delivered management gains for clients.',
      'Focused on the Power BI user experience, with positive client feedback.',
      'Managed a SQL database and several SSIS ETL processes.',
    ],
    tools: ['ssms', 'ssis', 'powerbi', 'excel'],
  },
  {
    id: 'wv', org: 'WeValue – Consulting', short: 'WeValue', title: 'Co-founder', from: [2019, 11], to: [2021, 1], when: '11/2019 – 01/2021', kind: 'side',
    bullets: ['Management and client advisory: 9 of the 10 projects I submitted were approved.', 'Responsible for public contracts.'],
    tools: ['excel'],
  },
  {
    id: 'sl', org: 'Scores & Levels', short: 'Scores & L.', title: 'BI Analyst', from: [2019, 9], to: [2021, 3], when: '09/2019 – 03/2021', kind: 'main',
    bullets: ['Developed and maintained 10+ advanced Power BI reports.', 'Developed the on-premises (small-scale) data warehouse.'],
    tools: ['ssms', 'ssis', 'powerbi', 'excel'],
  },
  {
    // The CV gives years only for the end ("10/2016 – 2019"); the bar ends where the next role starts.
    id: 'hop', org: 'HOP', short: 'HOP', title: 'Business consulting', from: [2016, 10], to: [2019, 9], when: '2016 – 2019', kind: 'pre',
    bullets: ['Business consulting, before BI.', 'A few highly technical spreadsheets were the first step towards working with data.'],
    tools: [],
  },
];

// Wilson's own table of tools by role (18 Oct 2026). Order: first use, then how long.
export const tools = [
  { id: 'excel', name: 'Excel' },
  { id: 'powerbi', name: 'Power BI' },
  { id: 'ssms', name: 'SQL Server' },
  { id: 'ssis', name: 'SSIS' },
  { id: 'dremio', name: 'Dremio' },
  { id: 'alteryx', name: 'Alteryx' },
  { id: 'bc', name: 'Business Central' },
  { id: 'mage', name: 'Mage.ai' },
  { id: 'copilot', name: 'Copilot' },
  { id: 'tableau', name: 'Tableau' },
  { id: 'databricks', name: 'Databricks' },
  { id: 'claude', name: 'Claude' },
];

// ---------- Leadership ----------
export const today = [
  { t: 'A team of six', d: 'I lead six BI developers who deliver analytical solutions to the whole group.' },
  { t: 'One platform', d: 'I own the Power BI platform, with its governance, security and scalability.' },
  { t: 'Automation and AI', d: "I drive the adoption of automation and AI, to raise the business's performance." },
  { t: 'Reporting strategy', d: "I shape it with the group's leadership, and keep the reporting compliant." },
];

// Only recommendations their authors approved. Excerpts are exact cuts, marked with an ellipsis.
export const quotes = [
  {
    featured: true,
    text: 'I praise his dedication and sense of ownership, as he took every task as his own and could always be counted on to see a problem through to the end. … Any team would be lucky to have him.',
    name: 'Daniela Gomez',
    role: "Operation Team Manager at HOP, and Wilson's manager",
  },
  {
    text: 'Wilson is a hard-working, honest and intelligent person always willing to help the team. … He was able to understand the business needs and helped us gain clarity of strategic objectives…',
    name: 'José Matos',
    role: 'Program Manager, on the same team at Scores & Levels',
    href: 'https://www.linkedin.com/in/wilson-lisboa-mota/',
    a: 'On LinkedIn',
  },
  {
    text: 'From the IT side, what stood out was how well he bridged business and technology. … He was ambitious, yet careful with data, reliable and easy to work with.',
    name: 'Rodrigo Taveira',
    role: 'Head of IT at Scores & Levels',
  },
];
