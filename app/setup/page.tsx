export const dynamic = "force-dynamic";

/**
 * Shown when the deployment is missing its environment variables. Rather than
 * a stack trace, the owner gets the exact steps — this page is the difference
 * between "the app is broken" and "the app is not finished setting up".
 */
export default function SetupPage() {
  const hasDb = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  const hasPass = Boolean(process.env.APP_PASSCODE);
  const hasSecret = Boolean(process.env.AUTH_SECRET);
  const done = hasDb && hasPass && hasSecret;

  return (
    <div className="center-screen">
      <div className="gate" style={{ maxWidth: 540 }}>
        <span className="brand-mark">BK</span>
        <h1>{done ? "Setup complete" : "Two minutes of setup left"}</h1>
        <p>
          {done
            ? "Everything is configured. Open the app."
            : "Bulk Kitchen is deployed but not yet connected to a database. Do this once in your Vercel dashboard."}
        </p>

        <ol>
          <li>
            <b>{hasDb ? "✓ " : ""}Attach a database.</b> In your Vercel project go to{" "}
            <b>Storage → Create Database → Postgres</b>, then <b>Connect</b> it to this project.
            Vercel adds <code>DATABASE_URL</code> for you. Tables are created automatically on first load.
          </li>
          <li>
            <b>{hasPass ? "✓ " : ""}Set a passcode.</b> Under{" "}
            <b>Settings → Environment Variables</b>, add <code>APP_PASSCODE</code> — whatever you
            want to type to open the app.
          </li>
          <li>
            <b>{hasSecret ? "✓ " : ""}Set a signing secret.</b> Add <code>AUTH_SECRET</code>, a long
            random string. Generate one with <code>openssl rand -hex 32</code>.
          </li>
          <li>
            <b>Redeploy.</b> Environment variables only reach the app on a new build:{" "}
            <b>Deployments → ⋯ → Redeploy</b>.
          </li>
        </ol>

        {done && (
          <a className="btn btn-primary" href="/" style={{ marginTop: 18, textAlign: "center", textDecoration: "none" }}>
            Open Bulk Kitchen
          </a>
        )}
      </div>
    </div>
  );
}
