import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <nav className="privacy-nav" aria-label="Privacy navigation">
        <Link className="privacy-brand" href="/">
          finapp<span>.</span>
        </Link>
        <Link href="/sign-in">Sign in</Link>
      </nav>
      <article className="privacy-content">
        <p className="finance-kicker">PLAIN-LANGUAGE NOTES</p>
        <h1>Your money stays yours.</h1>
        <p className="privacy-lede">
          Finapp stores a working copy in your browser so saved records can remain available
          offline.
        </p>
        <section>
          <h2>Where information is stored</h2>
          <p>
            When you sign in, this web app keeps user-scoped records and pending changes in
            IndexedDB in the current browser profile. When online, it syncs through the Convex
            deployment configured for this app.
          </p>
          <p>
            The browser copy is not separately encrypted by Finapp. Anyone who can use your browser
            profile may be able to access it. Use a trusted, protected device and sign out when
            appropriate.
          </p>
        </section>
        <section>
          <h2>Sync and offline use</h2>
          <p>
            Changes are saved locally first and queued for sync when the network is available. A
            browser copy is not a backup: clearing browser storage or removing the offline copy in
            Settings removes that local copy, but does not delete synced account data.
          </p>
          <p>
            Automatic sync requires a working connection and a configured server. Finapp does not
            currently provide background push notifications.
          </p>
        </section>
        <section>
          <h2>Your controls</h2>
          <p>
            Settings lets you export locally available accounts and transactions as CSV, request
            browser notifications, remove this browser’s offline copy, or sign out. Exports are
            created only after you request them.
          </p>
          <Link className="privacy-settings-link" href="/settings">
            Open settings
          </Link>
        </section>
        <section>
          <h2>Contact and third-party services</h2>
          <p>
            Finapp does not import contacts. Authentication and sync depend on the configured Convex
            deployment and its enabled authentication providers; their operational handling is
            governed by their deployment configuration.
          </p>
        </section>
        <Link className="privacy-back-link" href="/">
          Back to Finapp
        </Link>
      </article>
    </main>
  );
}
