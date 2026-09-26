import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Check, ChevronRight, Plus } from 'lucide-react';

const spending = [34, 58, 45, 72, 49, 87, 61, 77, 54, 92, 68, 83];

export default function HomePage() {
  return (
    <main className="landing">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Finapp home">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span>finapp</span>
        </Link>
        <nav aria-label="Main navigation" className="site-nav">
          <Link href="#how-it-works">How it works</Link>
          <Link href="#privacy">Privacy</Link>
          <Link className="nav-login" href="/sign-in">
            Log in
          </Link>
          <Link className="nav-cta" href="/sign-up">
            Get started <ChevronRight size={15} />
          </Link>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-dot" /> MONEY, IN SYNC
          </div>
          <h1 id="hero-title">
            Make room for
            <br />
            what <span>matters.</span>
          </h1>
          <p className="hero-description">
            A clearer view of your money, a better rhythm for your everyday. Track spending, build
            momentum, and split life’s little costs without the noise.
          </p>
          <div className="hero-actions">
            <Link className="button-primary" href="/sign-up">
              Create your account <ChevronRight size={17} />
            </Link>
            <Link className="button-text" href="/sign-in">
              I already have an account <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="hero-proof">
            <span className="proof-check">
              <Check size={13} />
            </span>{' '}
            Private by design <i /> Built for real life
          </div>
        </div>

        <div className="preview-wrap" aria-label="Sample Finapp spending overview">
          <div className="preview-orbit preview-orbit-one" />
          <div className="preview-orbit preview-orbit-two" />
          <article className="preview-card">
            <div className="preview-topline">
              <span className="preview-label">SAMPLE VIEW</span>
              <button type="button" aria-label="Add a transaction" className="preview-add">
                <Plus size={16} />
              </button>
            </div>
            <p className="preview-caption">Available this month</p>
            <div className="preview-balance">
              $2,480<span>.50</span>
            </div>
            <div className="preview-change">
              <span className="change-pill">
                <ArrowUpRight size={12} /> 8.4%
              </span>
              <span>from last month</span>
            </div>
            <div className="preview-chart" aria-label="Sample spending bars">
              {spending.map((height, index) => (
                <span
                  key={index}
                  className={index === 9 ? 'bar bar-highlight' : 'bar'}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="preview-months">
              <span>May 01</span>
              <span>May 31</span>
            </div>
            <div className="preview-divider" />
            <div className="preview-activity">
              <span className="activity-icon">
                <ArrowDownRight size={17} />
              </span>
              <span className="activity-copy">
                <strong>Everyday spending</strong>
                <small>Sample category</small>
              </span>
              <strong className="activity-amount">−$384.20</strong>
            </div>
            <div className="preview-activity">
              <span className="activity-icon activity-icon-in">
                <ArrowUpRight size={17} />
              </span>
              <span className="activity-copy">
                <strong>Monthly income</strong>
                <small>Sample category</small>
              </span>
              <strong className="activity-amount amount-in">+$3,200.00</strong>
            </div>
          </article>
          <div className="preview-note">
            <span className="note-spark" /> One clear picture. <span>Less financial fog.</span>
          </div>
        </div>
        <a className="scroll-cue" href="#how-it-works" aria-label="Scroll to how it works">
          <span /> SCROLL TO EXPLORE
        </a>
      </section>

      <section className="clarity-section" id="how-it-works">
        <div className="section-index">
          01 <span>/</span> A LITTLE MORE CLARITY
        </div>
        <div className="clarity-grid">
          <h2>
            Your finances
            <br />
            should feel <span>lighter.</span>
          </h2>
          <p>
            Know where you stand without digging through tabs. Finapp brings the small details and
            the bigger picture together, so your next good decision is easier to see.
          </p>
        </div>
      </section>

      <footer className="site-footer" id="privacy">
        <Link className="brand footer-brand" href="/" aria-label="Finapp home">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span>finapp</span>
        </Link>
        <span>Thoughtful money tools. No noise.</span>
        <Link href="/privacy">
          Privacy, always <ArrowUpRight size={13} />
        </Link>
      </footer>
    </main>
  );
}
