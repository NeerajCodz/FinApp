import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Fingerprint,
  Globe2,
  Layers3,
  LockKeyhole,
  ReceiptText,
  Target,
  Users,
  Wallet,
} from 'lucide-react';
import appIcon from '../../mobile/assets/icon.png';
import { ProductPreview } from '@/components/landing/ProductPreview';

export const metadata: Metadata = {
  title: 'Finapp | Your money. Your people. One clear place.',
  description:
    'Track everyday spending, plan your savings, and split expenses with your people. Bring your money into focus with Finapp.',
  openGraph: {
    title: 'Finapp | Money, without the mental load.',
    description: 'Everyday spending, savings, and shared expenses. One clear place.',
    type: 'website',
  },
};

const questions = [
  {
    question: 'What can I do with Finapp?',
    answer:
      'Keep track of accounts and transactions, organise spending by category, set budgets and savings goals, and manage shared expenses with groups.',
  },
  {
    question: 'How do shared expenses work?',
    answer:
      'Create a group, add an expense, and choose how to split it. Finapp keeps track of the balances so everyone can see who owes what and record a settlement.',
  },
  {
    question: 'Can I use it when I’m offline?',
    answer:
      'Once your account is set up and your records are saved on this device, you can keep working offline. Pending changes sync when a connection is available again.',
  },
  {
    question: 'Can I take my data with me?',
    answer:
      'Yes. Export your accounts, transactions, categories, groups, and settlements as portable CSV files from the privacy page.',
  },
];

function Brand() {
  return (
    <Link className="landing-brand" href="/" aria-label="Finapp home">
      <span className="landing-logo">
        <Image src={appIcon} alt="" width={72} height={72} />
      </span>
      <span>finapp<span className="landing-volt">.</span></span>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="marketing">
      <a className="landing-skip" href="#main">Skip to content</a>
      <header className="landing-header landing-container">
        <Brand />
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#features">The app</a>
          <a href="#together">Shared money</a>
          <a href="#questions">FAQs</a>
        </nav>
        <div className="landing-header-actions">
          <Link className="landing-login" href="/sign-in">Log in</Link>
          <Link className="landing-button landing-button-small" href="/sign-up">Get started <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
      </header>

      <main id="main">
        <section className="landing-hero landing-container" aria-labelledby="hero-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">A little clarity. A lot more living.</p>
            <h1 id="hero-title">Money, without<br /><span>the mental load.</span></h1>
            <p className="landing-hero-description">Your spending, savings, and shared expenses.<br />Finally, in one clear place.</p>
            <div className="landing-hero-actions">
              <Link className="landing-button" href="/sign-up">Get started <ArrowUpRight size={20} aria-hidden="true" /></Link>
              <a className="landing-text-link" href="#features">Meet your new money app <ArrowDownLeft size={18} aria-hidden="true" /></a>
            </div>
          </div>
          <div className="landing-hero-visual">
            <span className="landing-hero-monogram" aria-hidden="true">f</span>
            <ProductPreview />
          </div>
        </section>

        <div className="landing-capabilities landing-container" aria-label="Finapp capabilities">
          <span><Wallet size={18} aria-hidden="true" /> Everyday money</span>
          <span><Users size={18} aria-hidden="true" /> Shared expenses</span>
          <span><Target size={18} aria-hidden="true" /> Savings goals</span>
          <span><Globe2 size={18} aria-hidden="true" /> Built for web & mobile</span>
        </div>

        <section className="landing-features landing-container" id="features" aria-labelledby="features-title">
          <div className="landing-section-heading">
            <h2 id="features-title">Less figuring it out.<br /><span>More having it together.</span></h2>
            <p>Give every part of your money a place. Leave the spreadsheet juggling behind.</p>
          </div>
          <div className="landing-feature-grid">
            <article className="landing-feature landing-feature-spending">
              <div className="landing-feature-symbol"><ReceiptText size={24} aria-hidden="true" /></div>
              <h3>See the whole picture.</h3>
              <p>Accounts, categories, and transactions. Know what’s coming in and where it’s going.</p>
              <div className="landing-category-visual" aria-label="Organise your spending into categories">
                <span>YOUR EVERYDAY, ORGANISED</span>
                <div><span>Food & drinks</span><ArrowUpRight size={20} aria-hidden="true" /></div>
                <div><span>Getting around</span><ArrowUpRight size={20} aria-hidden="true" /></div>
                <div><span>The good stuff</span><ArrowUpRight size={20} aria-hidden="true" /></div>
              </div>
            </article>
            <article className="landing-feature landing-feature-goals">
              <div className="landing-feature-symbol"><Target size={24} aria-hidden="true" /></div>
              <h3>Make room for what’s next.</h3>
              <p>The trip. The move. The just-in-case fund. Set a goal and build towards it.</p>
              <div className="landing-goal-image">
                <Image src="/landing/mountain-goal.webp" alt="Mountain peaks above the clouds at sunrise" width={1000} height={667} sizes="(max-width: 767px) 100vw, 45vw" />
              </div>
            </article>
            <article className="landing-feature landing-feature-budgets">
              <div className="landing-feature-symbol"><Layers3 size={24} aria-hidden="true" /></div>
              <div><h3>A plan, not a restriction.</h3><p>Set category budgets and track your spending against them. Keep the things you love in the picture.</p></div>
              <span className="landing-budget-art" aria-hidden="true">plan.<br /><span>spend.</span><br />breathe.</span>
            </article>
          </div>
        </section>

        <section className="landing-together landing-container" id="together" aria-labelledby="together-title">
          <div className="landing-together-image">
            <Image src="/landing/shared-table.webp" alt="A restaurant with tables ready for a meal together" width={1200} height={800} sizes="(max-width: 767px) 100vw, 55vw" />
          </div>
          <div className="landing-together-copy">
            <span className="landing-feature-symbol"><Users size={28} aria-hidden="true" /></span>
            <h2 id="together-title">Good company.<br /><span>Clear balances.</span></h2>
            <p>Dinner with friends. A place with roommates. A weekend away. Split the expense, not the friendship.</p>
            <ul className="landing-checks">
              <li><Check size={18} aria-hidden="true" /> One group for your people</li>
              <li><Check size={18} aria-hidden="true" /> Flexible splits for real life</li>
              <li><Check size={18} aria-hidden="true" /> Know who owes what</li>
            </ul>
          </div>
        </section>

        <section className="landing-privacy landing-container" aria-labelledby="privacy-title">
          <Fingerprint className="landing-fingerprint" size={104} strokeWidth={1} aria-hidden="true" />
          <h2 id="privacy-title">Personal finance.<br /><span>Emphasis on personal.</span></h2>
          <p>Your financial values stay out of ordinary telemetry. Your data stays portable. Your space stays yours.</p>
          <Link className="landing-text-link" href="/privacy">Read our privacy notes <ArrowRight size={18} aria-hidden="true" /></Link>
          <div className="landing-privacy-notes">
            <span><LockKeyhole size={18} aria-hidden="true" /> Private financial values</span>
            <span><ArrowUpRight size={18} aria-hidden="true" /> Export your records</span>
          </div>
        </section>

        <section className="landing-faq landing-container" id="questions" aria-labelledby="questions-title">
          <h2 id="questions-title">A few things<br /><span>worth knowing.</span></h2>
          <div className="landing-faq-list">
            {questions.map(({ question, answer }) => (
              <details key={question}>
                <summary>{question}<ChevronDown size={20} aria-hidden="true" /></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-closing landing-container" aria-labelledby="closing-title">
          <p>YOUR MONEY. YOUR PEOPLE. ONE CLEAR PLACE.</p>
          <h2 id="closing-title">Life’s full.<br /><span>Money can be simple.</span></h2>
          <Link className="landing-button" href="/sign-up">Get started <ArrowUpRight size={20} aria-hidden="true" /></Link>
        </section>
      </main>

      <footer className="landing-footer landing-container">
        <Brand />
        <span>Built for everyday money.</span>
        <nav aria-label="Footer navigation">
          <Link href="/privacy">Privacy</Link>
          <Link href="/welcome">Open the app <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </nav>
      </footer>
    </div>
  );
}
