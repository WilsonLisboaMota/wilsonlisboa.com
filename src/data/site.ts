// Everything the home page says below the hero, in one place.
// Facts come from the CV, Wilson's project notes and the records; nothing here is estimated.
// The small moving drawings on the cards are illustrations, except the trading bot's bars, which are its real results.

export const person = {
  name: 'Wilson Mota',
  role: 'Business Intelligence Manager at Corient',
  place: 'Switzerland',
  email: 'wilson.lisboa@wilsonlisboa.com',
  linkedin: 'https://www.linkedin.com/in/wilson-lisboa-mota/',
  github: 'https://github.com/WilsonLisboaMota',
  cv: '/cv/',
  pdf: '/cv/wilson-lisboa-mota-cv.pdf',
};

// ---------- Artificial Intelligence ----------
const bot = '/work/ai-trading-bot/';

export interface Work {
  id: string;
  name: string;
  status: string;
  /** The status in a word or two, for the card. The full one is on the sheet. */
  tag: string;
  live?: boolean;
  /** Which small drawing the card carries. */
  viz: 'radar' | 'orbit' | 'stack' | 'seal' | 'house' | 'flow' | 'trade' | 'term';
  /** AI projects: the part of Wilson's life it is for, its icon, and what it does there, in a few words. */
  area?: string;
  icon?: 'heart' | 'home' | 'coins' | 'pin' | 'trend';
  benefit?: string;
  /** A large tile (with the app on a phone when there is one), and the names of its parts. */
  big?: boolean;
  parts?: string[];
  /** Proof cards (Business Intelligence): the few words on the card. */
  answer?: string;
  /** One sentence, shown when the card is opened. */
  line?: string;
  href?: string;
  cta?: string;
  /** A card with no sheet behind it: it leaves the site. */
  external?: boolean;
  aiLabel?: string;
  me?: string[];
  ai?: string[];
  not?: string[];
  proof?:
    | { kind: 'bars'; cap: string; goal: number; rows: { l: string; v: number; t: string }[] }
    | { kind: 'steps'; cap: string; steps: string[] }
    | { kind: 'stats'; cap: string; stats: { v: string; l: string }[] }
    | { kind: 'phone'; cap: string; src: string; alt: string };
}

// The trading bot's research results: how sure the edge is real, against the bar set before the tests.
export const sure = { goal: 95, rows: [{ l: 'Follow the trend', v: 62, t: '62%' }, { l: 'Step back when the market is nervous', v: 91, t: '91%' }, { l: 'Buy the dip', v: 0.6, t: 'almost 0%' }] };

// What the AI does in Wilson's life, one project per part of it (12 Nov 2026). Each says what it is for first.
// The smart home comes from that project's own handover file; nothing about the house itself is given here
// (no place, no names, no routines).
export const projects: Work[] = [
  {
    id: 'life',
    name: 'Life HQ',
    status: 'Started November 2026 · app at version 3',
    tag: 'Version 3',
    viz: 'orbit',
    area: 'Health',
    icon: 'heart',
    big: true,
    benefit: 'Six AI specialists plan my training, meals and recovery.',
    parts: ['Training', 'Nutrition', 'Recovery', 'Progress', 'The app', 'HQ'],
    line: 'Six AI specialists and one shared folder plan my training, meals and recovery around the week I actually have.',
    aiLabel: 'What the AI does',
    me: ['Designed the structure: one folder as the shared brain, one owner per file.', 'Set the rules: records are only added, never rewritten, and the AI never invents precision.', 'Make the calls. The specialists analyse and propose.'],
    ai: ['Six chats, each with one job: HQ, training, nutrition, progress, the app and recovery.', 'Built the plan, 14 exercise sheets and a phone app with a 3D figure.', 'Rebuilds the Excel report from the raw files, never by hand.'],
    not: ['Early days: no trend is read before week three.', 'The app has not been tested on a real phone yet.'],
    proof: { kind: 'phone', cap: 'A walking day. Shown in English here; the app itself is in Portuguese.', src: '/work/life-hq-app.jpg', alt: 'The phone app on a walking day: today asks only for a walk, 20 to 30 minutes on the treadmill, shown by a small 3D figure.' },
  },
  {
    id: 'home',
    name: 'Smart home',
    status: 'Running at home since autumn 2026',
    tag: 'Running at home',
    live: true,
    viz: 'house',
    area: 'Home',
    icon: 'home',
    big: true,
    benefit: 'The house follows the sun, the weather and the energy.',
    parts: ['Blinds that follow the sun', 'A wall display', 'Solar and energy', 'The heat pump', 'What to wear, by AI', 'A voice shopping list'],
    line: 'A Home Assistant system that moves the blinds with the sun, shows the solar power and the energy on a wall display, keeps an eye on the heat pump, and has an AI say each morning what to wear for the weather.',
    aiLabel: 'What the AI does',
    me: ['Set the rules: check first, simulate before changing, back up before every change.', 'An automation never overrides something done by hand.', 'The AI only suggests. Nothing physical moves without my consent.'],
    ai: ['Writes the configuration and the wall display, straight through Home Assistant.', 'Simulated 25 cases with fake sensors before one set of rules went live.', 'Works inside the house too: what to wear, morning and evening, and a plan for the day.'],
    not: ['The lighting routine is written, but not yet seen live.', 'Knowing which room is in use is still to come.'],
    proof: { kind: 'stats', cap: 'From the project’s own record.', stats: [{ v: '9', l: 'screens on the wall display' }, { v: '10', l: 'blinds under its routines' }, { v: '25', l: 'cases simulated before going live' }] },
  },
  {
    id: 'cfo',
    name: 'Personal CFO',
    status: 'Working pipeline · product not built',
    tag: 'Working pipeline',
    viz: 'flow',
    area: 'Money',
    icon: 'coins',
    benefit: 'Traces where the money goes.',
    line: 'My whole financial situation, live: where the money goes, what changed and what comes next.',
    aiLabel: 'What the AI did',
    me: ['Set the rule: the AI never calculates. Code does the sums; the AI classifies and explains.', 'Kept a human check on what the AI classifies.', 'Set a commercial version aside, for three reasons that are on record.'],
    ai: ['Profiled the bank exports: formats, duplicates, transfers and gaps.', 'Wrote the pipeline in Python, from raw exports to analytics.', 'Flagged what it did not know instead of filling the gaps.'],
    not: ['The product itself: phase one is not built.', 'About 29% of spending had no named payee on the statement.', 'The rules were written by hand for these banks. A second user would need new ones.'],
    proof: { kind: 'steps', cap: 'About 2,400 real transactions. Every number traces back to one of them.', steps: ['Bank exports come in', 'They are cleaned', 'They become one ledger', 'The ledger is analysed'] },
  },
  {
    id: 'radar',
    name: 'Property Deal Radar',
    status: 'In alpha · first alerts not sent yet',
    tag: 'In alpha',
    viz: 'radar',
    area: 'Property',
    icon: 'pin',
    benefit: 'Looks for deals that add up.',
    line: 'Brings together the property investments with the best economic viability, and alerts me when a hot deal appears.',
    aiLabel: 'What the AI is built to do',
    me: ['Set the criteria for a deal that makes economic sense.', 'Keep one list, so the same property is never shown twice.', 'Asked for an alert only when a new hot deal appears.'],
    ai: ['Find listings across portals and remove the duplicates.', 'Run the numbers: yield, cash flow and the equity needed.', 'Rate the risk, and say what information is missing.'],
    not: ['In alpha: no alert has been sent yet.', 'Not every portal allows automated collection.', 'Rents are estimates, not income.'],
    proof: { kind: 'steps', cap: 'Built for my own investments, and the kind of tool an estate agent would want.', steps: ['Find the listings', 'Remove the duplicates', 'Run the numbers', 'Rate the risk', 'Alert me'] },
  },
  {
    id: 'bot',
    name: 'AI Trading Bot',
    status: 'Live on paper trading',
    tag: 'Live on paper',
    live: true,
    viz: 'trade',
    area: 'Investing',
    icon: 'trend',
    benefit: 'Tests trading ideas on paper.',
    line: 'AI builds a trading bot in minutes. The hard part is tuning it to behave the way I would.',
    href: bot,
    cta: 'Read the case study',
    aiLabel: 'What the AI did',
    me: ['Chose the broker: Alpaca, with one paper account per bot.', 'Chose the AI that reads the news: Jev, through OpenRouter.', 'Kept it to stocks, and to paper money.'],
    ai: ['Wrote the test engine, the bots and their tests.', 'A second AI agent redid the research sums and found 3 bugs in the test code.', "An audit of the bot's code added four safety rules before the pilot."],
    not: ['No proven edge: none of the three ideas reached the bar.', 'No real money. The pilot is reviewed on 11 December 2026.'],
    proof: { kind: 'bars', cap: 'How sure can we be that the edge is real? The bar, set before the tests: 95%.', ...sure },
  },
];

// ---------- Business Intelligence ----------
// What the role is today, as four things to see. From the four lines of the CV for Corient.
export const todayTiles: { icon: 'team' | 'layers' | 'spark' | 'compass'; t: string }[] = [
  { icon: 'team', t: 'A team of six developers' },
  { icon: 'layers', t: 'The Power BI platform' },
  { icon: 'spark', t: 'Automation and AI' },
  { icon: 'compass', t: 'Reporting strategy' },
];

export interface Role {
  id: string;
  org: string;
  short: string;
  title: string;
  when: string;
  from: number;
  /** How high the step stands on the path. */
  level: number;
  /** main: a BI role; side: alongside one; pre: before BI. */
  kind: 'main' | 'side' | 'pre';
  bullets: string[];
  tools: string[];
  note?: string;
}

// In the order they happened, so the steps climb to the right.
export const roles: Role[] = [
  {
    // The CV gives years only for the end ("10/2016 – 2019").
    id: 'hop', org: 'HOP', short: 'HOP', title: 'Business consulting', when: '2016 – 2019', from: 2016, level: 1, kind: 'pre',
    bullets: ['Led the market research team.', 'Business consulting, before BI.', 'A few highly technical spreadsheets were the first step towards working with data.'],
    tools: [],
  },
  {
    id: 'sl', org: 'Scores & Levels', short: 'Scores & L.', title: 'BI Analyst', when: '09/2019 – 03/2021', from: 2019, level: 2, kind: 'main',
    bullets: ['Developed and maintained 10+ advanced Power BI reports.', 'Developed the on-premises (small-scale) data warehouse.'],
    tools: ['SQL Server', 'SSIS', 'Power BI', 'Excel'],
  },
  {
    id: 'wv', org: 'WeValue – Consulting', short: 'WeValue', title: 'Co-founder', when: '11/2019 – 01/2021', from: 2019, level: 2, kind: 'side',
    bullets: ['Management and client advisory: 9 of the 10 projects I submitted were approved.', 'Responsible for public contracts.'],
    tools: ['Excel'],
  },
  {
    id: 'fl', org: 'Freelance', short: 'Freelance', title: 'BI Consultant', when: '03/2021 – 11/2021', from: 2021, level: 3, kind: 'main',
    bullets: ['Developed Power BI reports that delivered management gains for clients.', 'Focused on the Power BI user experience, with positive client feedback.', 'Managed a SQL database and several SSIS ETL processes.'],
    tools: ['SQL Server', 'SSIS', 'Power BI', 'Excel'],
  },
  {
    id: 'sf', org: 'Stonehage Fleming', short: 'Stonehage F.', title: 'Senior BI Analyst', when: '12/2021 – 05/2025', from: 2021, level: 4, kind: 'main',
    bullets: ['Led the implementation and configuration of Power BI Service in the company.', 'Responsible for the Dremio and dbt architecture, security and governance.', 'Developed several Alteryx processes that support business operations.', 'Developed products with SSIS, Visual Studio, MDM and Mage.ai.'],
    tools: ['SQL Server', 'SSIS', 'Alteryx', 'Mage.ai', 'Power BI', 'Excel', 'Dremio', 'Business Central', 'Copilot'],
  },
  {
    id: 'corient', org: 'Corient', short: 'Corient', title: 'Business Intelligence Manager', when: '06/2025 – today', from: 2025, level: 5, kind: 'main',
    bullets: ['Lead a team of 6 BI developers delivering analytical solutions to the whole group.', 'Own the Power BI platform, ensuring governance, security and scalability.', 'Drive automation and AI adoption to increase business performance.', 'Partner with leadership to shape reporting strategy and ensure compliance.'],
    tools: ['SQL Server', 'Mage.ai', 'Power BI', 'Tableau', 'Databricks', 'Copilot', 'Claude'],
    note: 'Stonehage Fleming became part of Corient: one continuous path since 2021.',
  },
];

export const proofs: Work[] = [
  {
    id: 'mcp',
    name: 'Claude × Power BI',
    status: 'Live · read-only',
    tag: 'Live · read-only',
    live: true,
    viz: 'term',
    answer: '7 of 98 measures fail.',
    line: 'The AI asks the model, under my permissions. It never touches the data. On its first day it ran every measure once.',
    href: '/work/power-bi-mcp/',
    cta: 'Read the case study',
    aiLabel: 'What the AI did',
    me: ['A live connection, not screenshots: the version an interviewer can watch.', 'Read-only, under a named user, with no secret stored anywhere.', 'The data: my own CRM report, masked.'],
    ai: ["Planned the four pieces from Microsoft's documentation.", 'Registered the app and set the tenant setting, each step with my permission.', 'Diagnosed why every query failed at first, and found the fix.'],
    not: ['Not public: a visitor cannot open it. It is shown live in conversation.', 'It runs on a trial licence that ends on 16 December 2026.', "Microsoft's endpoint is in preview and may change."],
    proof: { kind: 'steps', cap: 'Four pieces, and none of them is custom code.', steps: ['A tenant', 'An app', 'A connector', 'A model'] },
  },
  {
    id: 'crm',
    name: 'My version vs AI version',
    status: 'Audit done · the AI version is next',
    tag: 'In progress',
    viz: 'stack',
    answer: 'same model, two reports.',
    line: 'My own report next to one Claude builds on the same model, so anyone can compare the two. Recorded, so the comparison can be watched.',
    aiLabel: 'What the AI did',
    me: ['Built my version, and keep it untouched as the reference.', 'Set the rule: improvements are measured, not claimed.'],
    ai: ['Audited the model through the live connection: 98 measures, 7 failing, 2 root causes.'],
    not: ['The AI version has not been built yet.', 'The recording is still to come.'],
  },
  {
    id: 'dbx',
    name: 'Databricks Data Analyst',
    status: 'Certified · 2026',
    tag: 'Certified · 2026',
    viz: 'seal',
    answer: 'verify the credential.',
    href: 'https://credentials.databricks.com/c63b7e6e-c357-4cc9-9085-9081abb1aeb8#acc.pgCm5w0a',
    external: true,
  },
];

// ---------- Leadership ----------
// Only recommendations their authors approved. Excerpts are exact cuts, marked with an ellipsis.
// cut: the few words on the card, an exact cut of the excerpt. text: the excerpt, shown when the card is opened.
export const quotes = [
  {
    id: 'cr',
    cut: 'I would recommend him without hesitation.',
    text: 'He takes ownership, asks the right questions before building anything and turns complex data into something leadership can act on. I would recommend him without hesitation.',
    name: 'Carla Silva Reis',
    job: 'CEO',
    org: "Scores & Levels · Wilson's manager",
    role: 'CEO at Scores & Levels. Wilson reported directly to her',
  },
  {
    id: 'dg',
    cut: 'Any team would be lucky to have him.',
    text: 'I praise his dedication and sense of ownership, as he took every task as his own and could always be counted on to see a problem through to the end. … Any team would be lucky to have him.',
    name: 'Daniela Gomez',
    job: 'Operation Team Manager',
    org: "HOP · Wilson's manager",
    role: "Operation Team Manager at HOP, and Wilson's manager",
  },
  {
    id: 'jm',
    cut: '…helped us gain clarity of strategic objectives…',
    text: 'Wilson is a hard-working, honest and intelligent person always willing to help the team. … He was able to understand the business needs and helped us gain clarity of strategic objectives…',
    name: 'José Matos',
    job: 'Program Manager',
    org: 'Scores & Levels · same team',
    role: 'Program Manager, on the same team at Scores & Levels',
    href: 'https://www.linkedin.com/in/wilson-lisboa-mota/',
    a: 'On LinkedIn',
  },
  {
    id: 'rt',
    cut: '…how well he bridged business and technology.',
    text: 'From the IT side, what stood out was how well he bridged business and technology. … He was ambitious, yet careful with data, reliable and easy to work with.',
    name: 'Rodrigo Taveira',
    job: 'Head of IT',
    org: 'Scores & Levels',
    role: 'Head of IT at Scores & Levels',
  },
];
