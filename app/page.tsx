"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = "/api";
const ACCENT = "#7fff00";

type Account = {
  id: string;
  fullName: string;
  email: string;
  propAccountId: string;
  submittedAt: string;
  approvalStatus: "pending" | "approved" | "rejected" | "disabled";
  licenseKey: string | null;
  notes: string;
  cancellationRequested?: boolean;
};

const mockPendingAccounts: Account[] = [
  {
    id: "acct_001",
    fullName: "Jordan Miles",
    email: "jordan@example.com",
    propAccountId: "TRD-104882",
    submittedAt: "2026-04-05 10:14 AM",
    approvalStatus: "pending",
    licenseKey: null,
    notes: "",
  },
  {
    id: "acct_002",
    fullName: "Avery Collins",
    email: "avery@example.com",
    propAccountId: "TRD-104913",
    submittedAt: "2026-04-05 11:02 AM",
    approvalStatus: "pending",
    licenseKey: null,
    notes: "",
  },
  {
    id: "acct_003",
    fullName: "Taylor Brooks",
    email: "taylor@example.com",
    propAccountId: "TRD-104927",
    submittedAt: "2026-04-05 11:41 AM",
    approvalStatus: "pending",
    licenseKey: null,
    notes: "",
  },
];

function createMockLicenseKey() {
  const segment = () => Math.random().toString(16).slice(2, 6).toUpperCase();
  return `BC-${segment()}-${segment()}-${segment()}`;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

async function safeApiFetch(path: string, options: RequestInit = {}) {
  try {
    return await apiFetch(path, options);
  } catch (error: any) {
    return { __error: error.message };
  }
}

export default function BrowskiConsultingApp() {
  const [page, setPage] = useState("home");
  const [token, setToken] = useState("");
  const [user, setUser] = useState<any>(null);
  const [dashboardState, setDashboardState] = useState({
    subscriptionStatus: "Not connected",
    tradeifyAccountId: "",
    approvalStatus: "Not submitted",
    licenseKey: "Available after approval",
    cancellationRequested: false,
  });
  const [adminAccounts, setAdminAccounts] = useState<Account[]>([]);
  const [adminMessage, setAdminMessage] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralInfo, setReferralInfo] = useState<{ referralCode: string | null; referralLink: string | null } | null>(null);
  //
  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const savedToken = localStorage.getItem("browski_token");
  const refParam = params.get("ref");
  if (refParam) setReferralCode(refParam.toUpperCase());

  if (params.get("checkout") === "success" || params.get("go") === "dashboard") {
    if (savedToken) {
      const headers = { Authorization: `Bearer ${savedToken}` };
      setToken(savedToken);
      setPage("dashboard");
      setTimeout(() => { loadDashboardData(headers); }, 0);
    } else {
      setPage("dashboard");
    }
  } else if (savedToken) {
    // Restore session on any page load
    const headers = { Authorization: `Bearer ${savedToken}` };
    setToken(savedToken);
    setPage("dashboard");
    setTimeout(() => { loadDashboardData(headers); }, 0);
  }
}, []);

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

async function loadAdminAccounts() {
  try {
    const res = await fetch("/api/admin/accounts?status=all", {
  headers: authHeaders,
});
    const data = await res.json();

    if (data?.error) {
      setAdminMessage(`Admin load error: ${data.error}`);
      return;
    }

    setAdminAccounts(
  (Array.isArray(data) ? data : []).map((acct: any) => ({
        id: acct.id,
        fullName: acct.name || acct.email || "Unknown",
        email: acct.email || "No email saved",
        propAccountId: acct.prop_account_id || "Not submitted",
        submittedAt: acct.created_at,
        approvalStatus: acct.active ? "approved" : "pending",
        licenseKey: null,
        notes: "",
        cancellationRequested: acct.cancellation_requested || false,
      }))
    );
  } catch (err) {
    setAdminMessage("Failed to load admin accounts.");
  }
}
  

  async function loadDashboardData(headersOverride = authHeaders) {
  const accountData = await safeApiFetch("/accounts/me", {
    method: "GET",
    headers: headersOverride,
  });

  // Detect expired/invalid token — force logout so user can re-login fresh
  if (accountData?.__error === "Unauthorized" || accountData?.__error === "Request failed") {
    localStorage.removeItem("browski_token");
    setToken("");
    setUser(null);
    setPage("login");
    return;
  }

  const adminRes = await fetch("/api/admin/check", {
    headers: headersOverride,
  });

  const adminData = await adminRes.json();

  setUser((prev: any) => ({
    ...prev,
    isAdmin: adminData.isAdmin,
  }));

  if (!accountData?._error && Array.isArray(accountData.accounts)) {
    const accounts = accountData.accounts;
    const primary = accounts.find((a: any) => a.approvalStatus === "approved") || accounts[0];

    setDashboardState((prev) => ({
      ...prev,
      accounts: accounts,
      tradeifyAccountId: primary?.propAccountId || "",
      approvalStatus: primary?.approvalStatus || prev.approvalStatus,
      licenseKey: primary?.licenseKey || prev.licenseKey,
      cancellationRequested: primary?.cancellationRequested || false,
    }));
  }

    const subscriptionData = await safeApiFetch("/billing/me", {
      method: "GET",
      headers: headersOverride,
    });

    if (!subscriptionData?.__error) {
      setDashboardState((prev) => ({
        ...prev,
        subscriptionStatus: subscriptionData.error ? `Error: ${subscriptionData.error}` : (subscriptionData.status || prev.subscriptionStatus),
      }));
    }
  }

  async function handleRegister(form: { email: string; password: string; referralCode?: string }) {
    const data = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(form),
    });

    const newToken = data.token;
    const headers = newToken ? { Authorization: `Bearer ${newToken}` } : {};

    if (newToken) localStorage.setItem("browski_token", newToken);
    setToken(newToken);
    setUser(data.user);
    setDashboardState((prev) => ({
      ...prev,
      subscriptionStatus: "Account created — subscription not started",
    }));
    setPage("dashboard");
    setTimeout(async () => {
      loadDashboardData(headers);
      // Load referral info for the dashboard
      const refData = await safeApiFetch("/referral/me", { headers });
      if (!refData?.__error) setReferralInfo(refData);
    }, 0);
  }

  async function handleLogin(form: { email: string; password: string }) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify(form),
    });

    const newToken = data.token;
    const headers = newToken ? { Authorization: `Bearer ${newToken}` } : {};

    if (newToken) localStorage.setItem("browski_token", newToken);
    setToken(newToken);
    setUser(data.user);
    setDashboardState((prev) => ({
      ...prev,
      subscriptionStatus: "Logged in — ready for checkout",
    }));
    setPage("dashboard");
    setTimeout(async () => {
      loadDashboardData(headers);
      const refData = await safeApiFetch("/referral/me", { headers });
      if (!refData?.__error) setReferralInfo(refData);
    }, 0);
  }

  async function handleTradeifySubmit(propAccountId: string, name: string) {
    await apiFetch("/accounts/submit", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ propAccountId, name }),
    });
    await loadDashboardData();
  }

  async function handleCancelRequest() {
    await apiFetch("/accounts/cancel-request", {
      method: "POST",
      headers: authHeaders,
    });
    setDashboardState((prev) => ({ ...prev, cancellationRequested: true }));
  }

  async function handleDownload() {
    try {
      const data = await apiFetch("/download/bot", {
        method: "GET",
        headers: authHeaders,
      });

      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        alert("Download failed: no URL returned. Contact support.");
      }
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  }

  async function handleCheckout(plan: "monthly" | "annual" = "monthly") {
    const data = await apiFetch("/billing/create-checkout-session", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ plan }),
    });

    if (data.url) {
      window.open(data.url, "_blank");
      setDashboardState((prev) => ({
        ...prev,
        subscriptionStatus: "Checkout started",
      }));
    }
  }

  if (page === "signup") {
    return <SignupPage onBack={() => setPage("home")} onSubmit={handleRegister} initialReferralCode={referralCode} />;
  }

  if (page === "login") {
    return <LoginPage onBack={() => setPage("home")} onSubmit={handleLogin} />;
  }

  if (page === "dashboard") {
    return (
      <DashboardPage
        user={user}
        dashboardState={dashboardState}
        referralInfo={referralInfo}
        onBack={() => { localStorage.removeItem("browski_token"); setUser(null); setToken(""); setPage("home"); }}
        onTradeifySubmit={handleTradeifySubmit}
        onCheckout={handleCheckout}
        onDownload={handleDownload}
        onCancelRequest={handleCancelRequest}
        onRefresh={() => loadDashboardData()}
        onOpenAdmin={user?.isAdmin ? async () => {
          setPage("admin");
          await loadAdminAccounts();
        } : undefined}
      />
    );
  }

  if (page === "admin" && user?.isAdmin) {
    return (
      <AdminDashboardPage
        user={user}
        accounts={adminAccounts}
        message={adminMessage}
        onRefresh={loadAdminAccounts}
        onBack={() => setPage("dashboard")}
        onApprove={async (id: string, notes: string) => {
          const data = await safeApiFetch(`/admin/accounts/${encodeURIComponent(id)}/approve`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ notes }),
          });

         if (data?.error) {
  setAdminMessage(`Admin approval error: ${data.error}`);
  return;
}

          setAdminMessage("Account approved successfully.");
          await loadAdminAccounts();
        }}
        onReject={async (id: string, notes: string) => {
          const data = await safeApiFetch(`/admin/accounts/${encodeURIComponent(id)}/reject`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ notes }),
          });

         if (data?.error) {
  setAdminMessage(`Admin reject error: ${data.error}`);
  return;
}

          setAdminMessage("Account rejected successfully.");
          await loadAdminAccounts();
        }}
        onDisable={async (id: string, notes: string) => {
          const data = await safeApiFetch(`/admin/accounts/${encodeURIComponent(id)}/disable`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ notes }),
          });

         if (data?.error) {
  setAdminMessage(`Admin disable error: ${data.error}`);
  return;
}
          setAdminMessage("Account disabled successfully.");
          await loadAdminAccounts();
        }}
      />
    );
  }

  return (
    <LandingPage
      setPage={setPage}
      onOpenAdmin={user?.isAdmin ? async () => {
        setPage("admin");
        await loadAdminAccounts();
      } : undefined}
    />
  );
}

function LandingPage({ setPage, onOpenAdmin }: any) {
  const features = [
    "$499/month or $5,000/year",
    "No profit split",
    "Private member dashboard",
    "Tradeify account activation workflow",
    "Guided onboarding",
    "50% first-month satisfaction guarantee",
  ];

  const dashboardItems = [
    "Subscription status",
    "Tradeify account submission",
    "Approval status",
    "License key access",
    "Setup instructions",
    "Support and refund request form",
  ];

  const steps = [
    "Create your Browski Consulting account",
    "Subscribe to Money Print ORB — monthly or annual plan",
    "Submit your Tradeify account for activation review",
    "Receive approval, onboarding, and licensed access",
  ];

  const faqs = [
    {
      q: "What is Money Print ORB?",
      a: "Money Print ORB is a rules-based automated trading system built for consistency. It removes emotional decision-making from your trading by executing a structured, predefined strategy on NinjaTrader — no chasing trades, no revenge trading.",
    },
    {
      q: "Do you charge a profit split?",
      a: "No. Browski Consulting uses a flat subscription — $499/month or $5,000/year — with no profit-sharing model.",
    },
    {
      q: "How does account activation work?",
      a: "After subscribing, you submit your Tradeify account for review. Once approved, your licensed access and onboarding are activated through the member dashboard.",
    },
    {
      q: "What is the first-month guarantee?",
      a: "If you are not satisfied during your first 30 days, you can request a 50% refund of your first month, subject to review under the satisfaction guarantee policy.",
    },
  ];

  const testimonials = [
    {
      quote: "The onboarding was clear, the activation process was smooth, and the fixed monthly model made the decision easy.",
      name: "Anthony D",
      role: "New Member",
    },
    {
      quote: "I liked that there was no profit split and that the setup felt more like a real set-and-forget service.",
      name: "Yunier C.",
      role: "New Member",
    },
    {
      quote: "The dashboard and approval process made everything feel organized and professional from day one.",
      name: "Luke L.",
      role: "New Member",
    },
  ];

  return (
    <div className="page">
      <header className="sticky-nav">
        <div className="container nav-bar">
          <div className="button-row">
            <div style={{ width: 12, height: 12, borderRadius: 999, background: ACCENT }} />
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em" }}>Browski Consulting</div>
          </div>
          <nav className="nav-links">
            <a href="#pricing">Pricing</a>
            <a href="#dashboard">Dashboard</a>
            <a href="#testimonials">Testimonials</a>
            <a href="#about">About</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="button-row">
            <button onClick={() => setPage("login")} className="btn btn-outline">Login</button>
            <button onClick={() => setPage("signup")} className="btn btn-accent">Create Account</button>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="container hero-inner">
          <div>
            <div className="eyebrow">Browski Consulting • Money Print ORB</div>
            <h1>Premium bot access with fixed pricing, secure account activation, and no profit split.</h1>
            <p className="lede">
              Create your member account, subscribe to Money Print ORB, and activate your licensed access through a private approval workflow.
            </p>
            <div className="button-row" style={{ marginTop: 28 }}>
              <button onClick={() => setPage("signup")} className="btn btn-accent">Get Started</button>
              <a href="#dashboard" className="btn btn-outline">See Member Access</a>
              {onOpenAdmin ? (
  <button onClick={onOpenAdmin} className="btn btn-outline">
    Admin Dashboard
  </button>
) : null}
            </div>
            <div className="grid-3" style={{ marginTop: 28 }}>
              <div className="card-tight"><div className="stat">$499</div><div className="muted">Monthly / $5K annual</div></div>
              <div className="card-tight"><div className="stat">0%</div><div className="muted">Profit split</div></div>
              <div className="card-tight"><div className="stat">50%</div><div className="muted">First-month guarantee</div></div>
            </div>
          </div>

          <div className="hero-offer">
            <div className="card-dark">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                <div>
                  <div className="small">Current offer</div>
                  <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>Money Print ORB</div>
                </div>
                <div className="pill" style={{ background: "rgba(127,255,0,0.15)", color: ACCENT }}>Browski Consulting</div>
              </div>
              <div className="price">$499</div>
              <div className="muted">per month — or $5,000/year (2 months free)</div>
              <ul className="feature-list">
                {features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <button onClick={() => setPage("signup")} className="btn btn-accent full" style={{ marginTop: 18 }}>Create Account</button>
              <button onClick={() => setPage("login")} className="btn btn-outline full" style={{ marginTop: 10 }}>Login</button>
              <div style={{ marginTop: 16, background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.25)", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ fontSize: 13, color: "#f5c518", margin: 0, lineHeight: 1.6 }}>
                  <strong>System requirement:</strong> Money Print ORB requires a Windows PC, or a Mac using a Windows VPS. NinjaTrader must remain open and logged in with live data at all times — if NinjaTrader is closed or logged out, the bot will not trade.
                </p>
              </div>
              <p className="small" style={{ marginTop: 12 }}>
                Create your account first, subscribe, then submit your Tradeify account for activation review.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="center">
            <div className="eyebrow-secondary">Simple offer</div>
            <h2>One product. One clean path to activation.</h2>
            <p className="lede" style={{ marginInline: "auto" }}>
              Money Print ORB is a premium, consistency-focused automated trading system with flexible pricing and no profit split.
            </p>
          </div>
          <div className="grid-3" style={{ marginTop: 32 }}>
            {features.map((feature) => (
              <div key={feature} className="feature-box">{feature}</div>
            ))}
          </div>
        </div>
      </section>

      <section
  id="pricing"
  className="section"
  style={{
    borderTop: "1px solid var(--border)",
    borderBottom: "1px solid var(--border)",
    background: "rgba(255,255,255,0.03)",
  }}
>
  <div className="container">
    <div className="center">
      <div className="eyebrow-secondary">Pricing</div>
      <h2>Money Print ORB membership</h2>
      <p className="lede" style={{ marginInline: "auto" }}>
        A flat subscription with no performance fee, no profit split, and a clear activation process.
      </p>
    </div>

    <div className="card" style={{ marginTop: 34 }}>
      <div className="split split-2">
        <div>
          <h3 style={{ fontSize: 34 }}>Money Print ORB</h3>
          <p className="lede" style={{ fontSize: 17, marginTop: 12 }}>
            Designed for traders who want a structured, consistency-focused automated solution with guided onboarding and licensed activation.
          </p>

          <div className="grid-2" style={{ marginTop: 26 }}>
            <div className="card-tight">$499/month or $5,000/year</div>
            <div className="card-tight">No profit split</div>
            <div className="card-tight">Private dashboard access</div>
            <div className="card-tight">Tradeify account activation review</div>
          </div>
        </div>

        <div className="cta-box">
          <div style={{ fontSize: 14, color: ACCENT }}>Subscription price</div>
          <div className="price" style={{ marginTop: 10 }}>$499</div>
          <div className="muted">billed monthly — or $5,000/year</div>
          <div style={{ fontSize: 12, color: "#7fff00", marginTop: 4 }}>Annual plan saves $988 (2 months free)</div>

          <button
            onClick={() => setPage("signup")}
            className="btn full"
            style={{ marginTop: 20, background: "#fff", color: "#000" }}
          >
            Create Account
          </button>

          <p className="small" style={{ marginTop: 12 }}>
            Account creation comes first, followed by checkout and Tradeify account submission.
          </p>
        </div>
      </div>
    </div>
  </div>
</section>
      <section className="section">
        <div className="container">
          <div className="card">
            <div className="split split-cta">
              <div>
                <div className="eyebrow-secondary">Start here</div>
                <h2>A cleaner path to checkout and activation</h2>
                <p className="lede">
                  Get started with one clear subscription and a guided activation process. Create your account first, subscribe, then submit your Tradeify account for review.
                </p>
                <div className="grid-3" style={{ marginTop: 20 }}>
                  <div className="card-tight">1. Create account</div>
                  <div className="card-tight">2. Subscribe</div>
                  <div className="card-tight">3. Submit Tradeify ID</div>
                </div>
                <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(127,255,0,0.07)", border: "1px solid rgba(127,255,0,0.25)" }}>
                  <p style={{ fontSize: 14, color: "#ccc", margin: 0, lineHeight: 1.6 }}>
                    <strong style={{ color: "#7fff00" }}>Referral program:</strong> Refer up to 4 friends and earn 25% off your next month for each one who subscribes — refer all 4 and your next month is on us. New subscribers get <strong>25% off their first month</strong>.
                  </p>
                </div>
              </div>
              <div className="gradient-box">
                <div style={{ fontSize: 14, color: ACCENT }}>First-month guarantee</div>
                <div style={{ fontSize: 40, fontWeight: 700, marginTop: 8 }}>Satisfaction Guaranteed!</div>
                <p className="lede" style={{ fontSize: 16, marginTop: 10 }}>
                  Try Money Print ORB for your first month. If you're not happy with your results, we'll refund 50% of your first month — no hassle, no questions asked.
                </p>
                <button onClick={() => setPage("signup")} className="btn btn-accent full" style={{ marginTop: 18 }}>Create Account</button>
                <button onClick={() => setPage("login")} className="btn btn-outline full" style={{ marginTop: 10 }}>Login</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="container">
          <div className="center">
            <div className="eyebrow-secondary">Backtest Results</div>
            <h2>$28,000+ cumulative profit — Jan to May 2026</h2>
            <p className="lede" style={{ marginInline: "auto" }}>
              The chart below shows Money Print ORB's simulated performance on NQ futures from January through April 2026, based on historical backtesting with the strategy's default settings.
            </p>
          </div>
          <div style={{ marginTop: 28, borderRadius: 12, overflow: "hidden", border: "1px solid #333" }}>
            <img
              src="/backtest-results.png"
              alt="Money Print ORB backtest cumulative profit chart Jan–May 2026"
              style={{ width: "100%", display: "block" }}
            />
          </div>
          <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: 10, background: "rgba(255,200,0,0.07)", border: "1px solid rgba(255,200,0,0.25)" }}>
            <p style={{ fontSize: 13, color: "#f5c518", margin: 0, lineHeight: 1.7 }}>
              <strong>Important disclaimer:</strong> These results are based on historical backtesting and are provided for informational purposes only. Past performance is not indicative of future results. Backtested results do not account for slippage, commissions, or real-world execution conditions. Trading futures involves substantial risk of loss and is not suitable for all investors. You should never trade with money you cannot afford to lose.
            </p>
          </div>
        </div>
      </section>

      <section id="testimonials" className="section">
        <div className="container">
          <div className="center">
            <div className="eyebrow-secondary">Testimonials</div>
            <h2>What our members are saying</h2>
            <p className="lede" style={{ marginInline: "auto" }}>
              Real feedback from traders who have gone through the activation process and put Money Print ORB to work.
            </p>
          </div>
          <div className="grid-3" style={{ marginTop: 30 }}>
            {testimonials.map((item) => (
              <div key={item.name} className="card">
                <p className="testimonial">“{item.quote}”</p>
                <div className="testimonial-meta">
                  <div className="testimonial-name">{item.name}</div>
                  <div className="testimonial-role">{item.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="section" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
        <div className="container">
          <div className="split split-about">
            <div>
              <div className="eyebrow-secondary">Designed to remove emotion from execution.</div>
              <div className="eyebrow-secondary" style={{ marginTop: 10 }}>Founder / About</div>
              <h2>Built from real trading experience, not theory</h2>
            </div>
            <div className="text-block">
              <p>
                Browski Consulting was created by Trenton Dombrowski after years of trading and running into the same core problem — emotional decision-making. The biggest struggle in his own journey was not finding opportunities, but controlling reactions: overconfidence after wins and frustration after losses.
              </p>
              <p>
                Money Print ORB was built specifically to solve that. The system removes the need to make impulsive decisions by following a structured, rules-based approach. No chasing trades after a win, no revenge trading after a loss — just consistent execution based on predefined conditions.
              </p>
              <p>
                This is for traders who understand that discipline is the real edge but have struggled to maintain it consistently. The goal is not to replace understanding of the market, but to eliminate emotional interference. Used correctly, it becomes a tool for structured execution — where consistency comes first and emotion is taken out of the equation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="guarantee" className="section">
        <div className="container">
          <div className="split split-2">
            <div className="card">
              <div className="eyebrow-secondary">First-month guarantee</div>
              <h2>Satisfaction Guaranteed!</h2>
              <p className="lede">
                Try Money Print ORB for your first month. If you're not satisfied with your results, you can request a 50% refund — no hassle, no questions asked.
              </p>
            </div>
            <div className="gradient-box">
              <div className="eyebrow-secondary" style={{ marginBottom: 10 }}>Guarantee summary</div>
              <div style={{ fontSize: 30, fontWeight: 700 }}>50% back in month one</div>
              <p className="lede" style={{ fontSize: 16, marginTop: 12 }}>
                This is an opportunity, not a promise of profits.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="dashboard" className="section" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
        <div className="container">
          <div className="split split-2">
            <div>
              <div className="eyebrow-secondary">Member dashboard</div>
              <h2>A private dashboard built around activation, licensing, and onboarding</h2>
              <p className="lede">
                After subscribing, you submit your Tradeify account for approval. Once approved, your licensed access and onboarding are activated through your private member dashboard.
              </p>
            </div>
            <div className="grid-3">
              {dashboardItems.map((item) => (
                <div key={item} className="feature-box">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section">
        <div className="container">
          <div className="split split-2">
            <div>
              <div className="eyebrow-secondary">How it works</div>
              <h2>From signup to activation in four steps</h2>
              <p className="lede">
                The flow is designed to get you up and running as simply as possible — from account creation to licensed access in four clear steps.
              </p>
            </div>
            <div className="stack-list">
              {steps.map((step, index) => (
                <div key={step} className="card-tight" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div className="pill" style={{ background: "rgba(127,255,0,0.14)", color: ACCENT, minWidth: 40, justifyContent: "center" }}>
                    {index + 1}
                  </div>
                  <div style={{ paddingTop: 4 }}>{step}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="section">
        <div className="container">
          <div className="center">
            <div className="eyebrow-secondary">FAQ</div>
            <h2>Common questions answered</h2>
          </div>
          <div className="faq-grid" style={{ marginTop: 30 }}>
            {faqs.map((faq) => (
              <div key={faq.q} className="faq-item">
                <h3>{faq.q}</h3>
                <p>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="container">
          <div className="card center" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.05), rgba(127,255,0,0.10))" }}>
            <h2>Ready to trade with discipline?</h2>
            <p className="lede" style={{ marginInline: "auto" }}>
              Join Money Print ORB and get access to a structured, rules-based trading system with flexible pricing, guided onboarding, and a first-month satisfaction guarantee.
            </p>
            <div className="button-row" style={{ justifyContent: "center", marginTop: 24 }}>
              <button onClick={() => setPage("signup")} className="btn btn-accent">Create Account</button>
              <button onClick={() => setPage("login")} className="btn btn-outline">Login</button>
            </div>
            <p className="small" style={{ marginTop: 22 }}>
              Trading involves substantial risk and is not suitable for every trader. Past performance does not guarantee future results.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SignupPage({ onBack, onSubmit, initialReferralCode }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState(initialReferralCode || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit({ email, password, referralCode: referralCode.trim() || undefined });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create Account" onBack={onBack}>
      <form onSubmit={submit} className="form-stack">
        <input placeholder="Email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input
          placeholder="Referral code (optional)"
          className="field"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          style={{ letterSpacing: "0.1em" }}
        />
        {referralCode.trim().length > 0 && (
          <p style={{ fontSize: 13, color: "#7fff00", margin: 0 }}>Referral code applied — you'll get 25% off your first month.</p>
        )}
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={loading} className="btn btn-accent full">
          {loading ? "Creating account..." : "Register"}
        </button>
      </form>
    </AuthShell>
  );
}

function LoginPage({ onBack, onSubmit }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit({ email, password });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Login" onBack={onBack}>
      <form onSubmit={submit} className="form-stack">
        <input placeholder="Email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={loading} className="btn btn-accent full">
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({ title, children, onBack }: any) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h2 style={{ fontSize: 32 }}>{title}</h2>
        <div style={{ marginTop: 20 }}>{children}</div>
        <button onClick={onBack} className="btn btn-outline full" style={{ marginTop: 14 }}>
          Back
        </button>
      </div>
    </div>
  );
}

function TutorialPanel({ title, steps }: { title: string; steps: { n: number; text: string; images?: string[] }[] }) {
  return (
    <div>
      <h4 style={{ fontSize: 20, marginBottom: 16, color: "#7fff00" }}>{title}</h4>
      <ol style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {steps.map((s) => (
          <li key={s.n} style={{ display: "flex", gap: 14, alignItems: "flex-start", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{ background: "#7fff00", color: "#000", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{s.n}</span>
              <span style={{ color: "#ccc", lineHeight: 1.6, paddingTop: 3 }}>{s.text}</span>
            </div>
            {s.images && s.images.length > 0 && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", paddingLeft: 40 }}>
                {s.images.map((src) => (
                  <img key={src} src={src} alt="NinjaTrader configuration" style={{ borderRadius: 8, border: "1px solid #333", maxWidth: 320, width: "100%" }} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function DashboardPage({ user, dashboardState, referralInfo, onBack, onTradeifySubmit, onCheckout, onDownload, onCancelRequest, onRefresh, onOpenAdmin }: any) {
  const [propAccountId, setPropAccountId] = useState(dashboardState.tradeifyAccountId || "");
  const [accountName, setAccountName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("monthly");
  const [activeTutorial, setActiveTutorial] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState({
  tradeifyCreated: false,
  ninjaCreated: false,
  ninjaInstalled: false,
  accountConnected: false,
  submitted: false,
});
  useEffect(() => {
  if (dashboardState.tradeifyAccountId) {
    setOnboarding((prev) => ({ ...prev, submitted: true }));
  }
}, [dashboardState.tradeifyAccountId]);

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      await onTradeifySubmit(propAccountId, accountName);
      setPropAccountId("");
      setAccountName("");
      setMessage("Tradeify account submitted for review.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page dashboard">
      <div className="container">
        <div className="top-row">
          <div>
            <h1 style={{ fontSize: 40 }}>Dashboard</h1>
            <p className="muted" style={{ marginTop: 10 }}>
              {user ? `Logged in as ${user.email}` : "Authenticated session"}
            </p>
          </div>
          <div className="button-row">
            {onOpenAdmin && <button onClick={onOpenAdmin} className="btn btn-outline">Admin Approval UI</button>}
            <button onClick={onRefresh} className="btn btn-outline">Refresh Status</button>
            <button onClick={onBack} className="btn btn-outline">Log out</button>
          </div>
        </div>

        <div className="grid-4">
          <StatusCard title="Subscription" value={dashboardState.subscriptionStatus} />
          <StatusCard title="Accounts Submitted" value={dashboardState.accounts?.length || (dashboardState.tradeifyAccountId ? 1 : 0)} />
          <StatusCard title="Approval Status" value={dashboardState.approvalStatus} />
          <StatusCard title="Accounts Approved" value={dashboardState.accounts?.filter((a: any) => a.approvalStatus === "approved").length || (dashboardState.approvalStatus === "approved" ? 1 : 0)} />
        </div>

        {(() => {
          const approvedAccounts = dashboardState.accounts?.filter((a: any) => a.approvalStatus === "approved") || [];
          if (approvedAccounts.length === 0) return null;
          return (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10 }}>
                {approvedAccounts.length > 1
                  ? "NinjaTrader License Keys — enter each ID into its corresponding bot instance"
                  : "NinjaTrader License Key — enter this ID into the License section of your bot"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {approvedAccounts.map((acct: any, i: number) => (
                  <div key={acct.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "rgba(127,255,0,0.05)", border: "1px solid rgba(127,255,0,0.2)" }}>
                    {approvedAccounts.length > 1 && (
                      <span style={{ fontSize: 12, color: "#aaa", minWidth: 70 }}>Bot instance {i + 1}</span>
                    )}
                    <span style={{ fontSize: 15, fontFamily: "monospace", color: "#7fff00", fontWeight: 700, flex: 1 }}>{acct.propAccountId}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="card" style={{ marginTop: 26 }}>
  <h3 style={{ fontSize: 28 }}>Onboarding Guide</h3>
  <p className="lede" style={{ marginTop: 12 }}>
    Complete these steps to activate your system. Click <strong style={{ color: "#7fff00" }}>View Tutorial</strong> for step-by-step instructions on each item.
  </p>

  {/* Checklist */}
  <ul style={{ marginTop: 20, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
    {[
      {
        key: "tradeifyCreated",
        label: "Create Tradeify account",
        link: { href: "https://tradeify.co", text: "tradeify.co" },
        tutorial: "tradeify-create",
      },
      {
        key: "ninjaCreated",
        label: "Create NinjaTrader account",
        link: { href: "https://ninjatrader.com", text: "ninjatrader.com" },
        tutorial: "ninja-create",
      },
      {
        key: "ninjaInstalled",
        label: "Install NinjaTrader platform",
        link: { href: "https://ninjatrader.com/trading-platform", text: "Download here" },
        tutorial: "ninja-install",
      },
      {
        key: "accountConnected",
        label: "Connect Tradeify account to NinjaTrader",
        tutorial: "ninja-connect",
      },
      {
        key: "submitted",
        label: "Submit Tradeify account ID",
        tutorial: "tradeify-submit",
        readOnly: true,
      },
      {
        key: null,
        label: "Deploy Money Print ORB bot",
        tutorial: "bot-deploy",
      },
    ].map((item) => (
      <li key={item.key ?? item.tutorial} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input
          type="checkbox"
          checked={item.readOnly ? !!onboarding.submitted : item.key ? !!(onboarding as any)[item.key] : false}
          readOnly={item.readOnly || item.key === null}
          onChange={item.key && !item.readOnly ? () => setOnboarding((p) => ({ ...p, [item.key!]: !(p as any)[item.key!] })) : undefined}
          style={{ accentColor: "#7fff00", width: 16, height: 16, flexShrink: 0 }}
        />
        <span style={{ flex: 1 }}>
          {item.label}
          {item.link && (
            <> — <a href={item.link.href} target="_blank" rel="noopener noreferrer" style={{ color: "#7fff00" }}>{item.link.text}</a></>
          )}
        </span>
        <button
          onClick={() => setActiveTutorial(activeTutorial === item.tutorial ? null : item.tutorial)}
          style={{ background: "none", border: "1px solid #7fff00", color: "#7fff00", borderRadius: 6, padding: "2px 10px", fontSize: 13, cursor: "pointer", flexShrink: 0 }}
        >
          {activeTutorial === item.tutorial ? "Hide" : "View Tutorial"}
        </button>
      </li>
    ))}
  </ul>
</div>

{/* Tutorial Panels */}
{activeTutorial && (
  <div className="card" style={{ marginTop: 16, borderColor: "#7fff0033", background: "#0d1a0d" }}>
    {activeTutorial === "tradeify-create" && (
      <TutorialPanel title="How to Create a Tradeify Account" steps={[
        { n: 1, text: "Go to tradeify.co and click \"Get Funded\"." },
        { n: 2, text: "Configure your account as shown below — select Account Type: Select, Account Size: 50K, and Platform: Tradovate. Before checkout, check Tradeify's homepage for a promo code — they are almost always running a discount!", images: ["/tradeify-account-config.png"] },
        { n: 3, text: "Complete registration: enter your name, email, and create a password." },
        { n: 4, text: "Check your email for a verification link and confirm your account." },
        { n: 5, text: "Complete checkout to purchase your Tradeify challenge/funded account." },
        { n: 6, text: "After payment, log into your Tradeify dashboard. Your account ID will be displayed — you'll need this for step 4." },
      ]} />
    )}
    {activeTutorial === "ninja-create" && (
      <TutorialPanel title="How to Create a NinjaTrader Account" steps={[
        { n: 1, text: "Go to ninjatrader.com and click \"Get NinjaTrader Free\"." },
        { n: 2, text: "Fill in your name, email, phone, and country." },
        { n: 3, text: "Check your email for a verification message from NinjaTrader and click the confirmation link." },
        { n: 4, text: "Your NinjaTrader account is now created. You'll use these credentials when setting up the platform." },
      ]} />
    )}
    {activeTutorial === "ninja-install" && (
      <TutorialPanel title="How to Install NinjaTrader" steps={[
        { n: 1, text: "Go to ninjatrader.com/trading-platform and click the download button for Windows." },
        { n: 2, text: "Run the downloaded installer (.exe). Accept any UAC prompts." },
        { n: 3, text: "Follow the setup wizard — accept the license agreement and choose an install location." },
        { n: 4, text: "Once installed, launch NinjaTrader from your desktop or Start menu." },
        { n: 5, text: "On first launch, log in with the NinjaTrader account credentials you created in step 2." },
        { n: 6, text: "NinjaTrader will open to the Control Center. You're ready to connect your broker account." },
      ]} />
    )}
    {activeTutorial === "ninja-connect" && (
      <TutorialPanel title="How to Connect Tradeify to NinjaTrader" steps={[
        { n: 1, text: "Before connecting NinjaTrader, activate your Tradovate data feed: log into trader.tradovate.com/welcome using the credentials shown at the top of your Tradeify dashboard. Select \"Simulation\" (never \"Live\"), and sign the Non-Professional Agreement if prompted. Give it up to 15 minutes to activate, then restart NinjaTrader before continuing." },
        { n: 2, text: "Open NinjaTrader. In the Control Center menu bar, go to Tools → Options (or Tools → Settings)." },
        { n: 3, text: "In the settings window, find the \"General\" section and look for \"Enable multi-provider connections\" or \"Multi-provider connections\". Turn this ON and click OK." },
        { n: 4, text: "Restart NinjaTrader. After restarting, the Connections menu will now be available in the Control Center." },
        { n: 5, text: "Go to Connections → Configure. Click \"New\" and select \"NinjaTrader\" from the provider list." },
        { n: 6, text: "Enter the same Tradovate credentials from step 1. Check \"Connect on Startup\". Under \"Account type\", select \"Simulation\". Name the connection (e.g., \"Tradeify\") and click OK." },
        { n: 7, text: "Go to Connections → Connect → select your Tradeify connection. Once connected, your account balance and instruments will load in the Control Center." },
        { n: 8, text: "Note your Tradeify Account ID from the dashboard — you will submit this in step 5 to activate your license." },
      ]} />
    )}
    {activeTutorial === "tradeify-submit" && (
      <TutorialPanel title="How to Submit Your Tradeify Account ID" steps={[
        { n: 1, text: "Log into your Tradeify dashboard at tradeify.co." },
        { n: 2, text: "Find your Account ID — it is displayed on your account overview or dashboard page (format is usually a number like 12345678)." },
        { n: 3, text: "Return to this dashboard and paste your Tradeify Account ID into the \"Submit Tradeify Account\" form on the right." },
        { n: 4, text: "Click \"Submit Account\". This sends your ID to Browski Consulting for review." },
        { n: 5, text: "You will receive an email when your account is approved. Your license key (your Tradeify ID) will then appear in your dashboard above." },
      ]} />
    )}
    {activeTutorial === "bot-deploy" && (
      <TutorialPanel title="How to Deploy the Money Print ORB Bot" steps={[
        { n: 1, text: "Make sure you have an active subscription and your Tradeify account has been approved. The Download Bot button will appear in your dashboard." },
        { n: 2, text: "Click \"Download Bot (NinjaTrader)\" in your dashboard. A ZIP file (MONEYPRINTORB.zip) will be downloaded." },
        { n: 3, text: "Do NOT unzip the file. NinjaTrader imports strategies directly from the ZIP." },
        { n: 4, text: "Open NinjaTrader. In the Control Center, go to Tools → Import → NinjaScript Add-On..." },
        { n: 5, text: "Browse to the downloaded MONEYPRINTORB.zip file and click Open. NinjaTrader will import and compile the strategy." },
        { n: 6, text: "You will see a confirmation that the import was successful. Restart NinjaTrader." },
        { n: 7, text: "After restart, open a new chart. Set the instrument to NQ (Nasdaq 100 futures) and the chart type to Candlestick with a 3-minute interval. The bot is designed specifically for 3-minute NQ charts." },
        { n: 8, text: "Right-click the chart → Strategies → Add Strategy. Find \"MoneyPrintORB\" in the list and select it." },
        {
          n: 9,
          text: "In the strategy configuration panel, find the \"License\" section and enter your Tradeify Account ID in the \"Tradeify ID\" field. Under \"Setup\", select your live Tradeify account from the Account dropdown. Do not change any other settings — modifying parameters may cause the bot to not work properly.",
          images: ["/nt-config-enabled.png", "/nt-config-license.png", "/nt-config-account.png"],
        },
        { n: 10, text: "Click OK and enable the strategy. The bot will begin trading automatically on the connected Tradeify account." },
      ]} />
    )}
  </div>
)}
        {(dashboardState.subscriptionStatus === "active" || dashboardState.approvalStatus === "approved") && (
          <div className="card" style={{ marginTop: 26, background: "rgba(127,255,0,0.07)", border: "1px solid rgba(127,255,0,0.3)" }}>
            <h3 style={{ fontSize: 28, color: "#7fff00" }}>Download Money Print ORB</h3>
            <p className="lede" style={{ fontSize: 16, marginTop: 10 }}>Your subscription is active. Download the bot ZIP file and follow the Deploy tutorial to install it in NinjaTrader.</p>
            <button onClick={onDownload} className="btn btn-accent" style={{ marginTop: 16, fontSize: 18, padding: "14px 32px" }}>
              Download Bot (NinjaTrader)
            </button>
            <div style={{ marginTop: 14 }}>
              {dashboardState.cancellationRequested
                ? <p className="lede" style={{ fontSize: 14, color: "#ff9b9b" }}>Cancellation requested — we will be in touch.</p>
                : dashboardState.subscriptionStatus === "active" ? <button onClick={onCancelRequest} className="btn btn-outline" style={{ color: "#ff9b9b", borderColor: "rgba(255,107,107,0.35)" }}>Request Cancellation</button> : null
              }
            </div>
          </div>
        )}

        {/* Referral card */}
        <div className="card" style={{ marginTop: 26 }}>
          <h3 style={{ fontSize: 28 }}>Refer a Friend</h3>
          <p className="lede" style={{ fontSize: 16, marginTop: 12 }}>
            Share your referral link and earn 25% off your next month for each friend who subscribes — up to 4 referrals. Refer all 4 and your next month is completely free. Every new subscriber you refer also gets <strong style={{ color: "#7fff00" }}>25% off their first month</strong> automatically.
          </p>
          {referralInfo?.referralLink ? (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 13, color: "#aaa", marginBottom: 6 }}>Your referral link</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  readOnly
                  value={referralInfo.referralLink}
                  className="field"
                  style={{ fontSize: 13, color: "#7fff00", background: "rgba(127,255,0,0.07)", border: "1px solid rgba(127,255,0,0.3)", flex: 1 }}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  className="btn btn-outline"
                  style={{ flexShrink: 0, fontSize: 13, padding: "10px 16px" }}
                  onClick={() => { navigator.clipboard.writeText(referralInfo.referralLink); }}
                >
                  Copy
                </button>
              </div>
              <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                Your code: <span style={{ color: "#7fff00", letterSpacing: "0.1em", fontWeight: 700 }}>{referralInfo.referralCode}</span>
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 14, color: "#666", marginTop: 12 }}>Loading your referral link...</p>
          )}
        </div>

        <div className="grid-2" style={{ marginTop: 26 }}>
          <div className="card">
            <h3 style={{ fontSize: 28 }}>Start Subscription</h3>
            <p className="lede" style={{ fontSize: 16, marginTop: 12 }}>
              Begin access to the Money Print ORB system. Requires a funded trading account (~$120/month, paid directly to the provider) and a NinjaTrader account. Step-by-step setup guide provided after signup.
            </p>

            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                onClick={() => setSelectedPlan("monthly")}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, border: `2px solid ${selectedPlan === "monthly" ? "#7fff00" : "#333"}`, cursor: "pointer", background: selectedPlan === "monthly" ? "rgba(127,255,0,0.07)" : "transparent" }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Monthly</div>
                  <div style={{ fontSize: 13, color: "#aaa", marginTop: 2 }}>$499 / month</div>
                </div>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${selectedPlan === "monthly" ? "#7fff00" : "#555"}`, background: selectedPlan === "monthly" ? "#7fff00" : "transparent", flexShrink: 0 }} />
              </div>
              <div
                onClick={() => setSelectedPlan("annual")}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, border: `2px solid ${selectedPlan === "annual" ? "#7fff00" : "#333"}`, cursor: "pointer", background: selectedPlan === "annual" ? "rgba(127,255,0,0.07)" : "transparent" }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Annual <span style={{ fontSize: 12, background: "rgba(127,255,0,0.2)", color: "#7fff00", borderRadius: 6, padding: "2px 8px", marginLeft: 6 }}>2 months free</span></div>
                  <div style={{ fontSize: 13, color: "#aaa", marginTop: 2 }}>$5,000 / year — save $988</div>
                </div>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${selectedPlan === "annual" ? "#7fff00" : "#555"}`, background: selectedPlan === "annual" ? "#7fff00" : "transparent", flexShrink: 0 }} />
              </div>
            </div>

            <div style={{ marginTop: 14, background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.25)", borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ fontSize: 13, color: "#f5c518", margin: 0, lineHeight: 1.6 }}>
                <strong>Important:</strong> This bot requires a <strong>Windows PC</strong>, or a Mac using a <strong>Windows VPS</strong>. NinjaTrader must remain open and logged in with live data at all times. If NinjaTrader is closed or logged out, the bot will stop trading.
              </p>
            </div>

            <div style={{ marginTop: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ marginTop: 3, accentColor: "#7fff00", flexShrink: 0 }}
              />
              <label htmlFor="terms" style={{ fontSize: 14, color: "#aaa", cursor: "pointer" }}>
                I have read and agree to the{" "}
                <button onClick={() => setShowTerms(true)} style={{ background: "none", border: "none", color: "#7fff00", cursor: "pointer", padding: 0, fontSize: 14, textDecoration: "underline" }}>
                  Terms of Service and Risk Disclosure
                </button>
                . I understand that trading involves substantial risk of loss and that Browski Consulting provides no guarantee of profits.
              </label>
            </div>

            <button onClick={() => onCheckout(selectedPlan)} disabled={!termsAccepted} className="btn btn-accent" style={{ marginTop: 14, opacity: termsAccepted ? 1 : 0.4, cursor: termsAccepted ? "pointer" : "not-allowed" }}>
              Open Checkout
            </button>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 28 }}>Submit Tradeify Account</h3>
            <p className="lede" style={{ fontSize: 16, marginTop: 12 }}>
              Enter your Tradeify account ID to request activation review. You can submit additional accounts (e.g. after passing a combine).
            </p>
            {dashboardState.accounts && dashboardState.accounts.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>Submitted accounts</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dashboardState.accounts.map((acct: any) => (
                    <div key={acct.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid #333" }}>
                      <span style={{ fontSize: 14, fontFamily: "monospace", color: "#fff" }}>{acct.propAccountId}</span>
                      <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: acct.approvalStatus === "approved" ? "rgba(127,255,0,0.15)" : "rgba(255,200,0,0.1)", color: acct.approvalStatus === "approved" ? "#7fff00" : "#f5c518", fontWeight: 600 }}>
                        {acct.approvalStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <form onSubmit={submitAccount} className="form-stack" style={{ marginTop: 18 }}>
              <input placeholder="Your full name" className="field" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
              <input placeholder="Tradeify account ID" className="field" value={propAccountId} onChange={(e) => setPropAccountId(e.target.value)} />
              {message ? <p className="success">{message}</p> : null}
              {error ? <p className="error">{error}</p> : null}
              <button type="submit" disabled={submitting} className="btn btn-accent">
                {submitting ? "Submitting..." : "Submit Account"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {showTerms && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, overflowY: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px" }}>
          <div style={{ background: "#111", border: "1px solid #333", borderRadius: 16, maxWidth: 720, width: "100%", padding: 40 }}>
            <h2 style={{ fontSize: 28, marginBottom: 24 }}>Terms of Service &amp; Risk Disclosure</h2>
            <div style={{ color: "#ccc", lineHeight: 1.8, fontSize: 15 }}>
              <p><strong>Last updated: {new Date().getFullYear()}</strong></p>

              <h3 style={{ color: "#fff", marginTop: 24, marginBottom: 8 }}>1. Not Financial Advice</h3>
              <p>Browski Consulting and the Money Print ORB system do not constitute financial advice, investment advice, trading advice, or any other type of advice. All content, strategies, and tools provided are for informational and educational purposes only. You should not make any financial decision based solely on the information provided by Browski Consulting.</p>

              <h3 style={{ color: "#fff", marginTop: 24, marginBottom: 8 }}>2. Risk of Loss</h3>
              <p>Trading futures, forex, equities, or any other financial instrument involves a substantial risk of loss and is not appropriate for all investors. Past performance of the Money Print ORB system or any strategy discussed is not necessarily indicative of future results. You may lose some or all of your invested capital. Never trade with money you cannot afford to lose.</p>

              <h3 style={{ color: "#fff", marginTop: 24, marginBottom: 8 }}>3. No Guarantee of Profits</h3>
              <p>Browski Consulting makes no guarantee, representation, or warranty that the use of the Money Print ORB system will result in profits or will not result in losses. All trading results shown are hypothetical or illustrative unless explicitly stated otherwise.</p>

              <h3 style={{ color: "#fff", marginTop: 24, marginBottom: 8 }}>4. Limitation of Liability</h3>
              <p>To the fullest extent permitted by applicable law, Browski Consulting, its owner Trenton Dombrowski, affiliates, and partners shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, loss of capital, or loss of data, arising from your use of the Money Print ORB system or reliance on any information provided.</p>

              <h3 style={{ color: "#fff", marginTop: 24, marginBottom: 8 }}>5. Subscription Terms</h3>
              <p>The Money Print ORB subscription is available as a monthly plan ($499/month) or an annual plan ($5,000/year). Subscriptions renew automatically unless cancelled. You may request cancellation at any time through your member dashboard. A 50% refund of your first month's payment may be requested within 30 days of your initial subscription under the satisfaction guarantee, subject to review. No refunds are issued after 30 days.</p>

              <h3 style={{ color: "#fff", marginTop: 24, marginBottom: 8 }}>6. Account Activation</h3>
              <p>Access to the Money Print ORB bot is contingent upon approval of your Tradeify account by Browski Consulting. Browski Consulting reserves the right to deny or revoke access at its sole discretion, including in cases of misuse, violation of these terms, or fraudulent activity.</p>

              <h3 style={{ color: "#fff", marginTop: 24, marginBottom: 8 }}>7. Third-Party Platforms</h3>
              <p>The Money Print ORB system operates through NinjaTrader and requires a funded Tradeify prop trading account. Browski Consulting is not affiliated with NinjaTrader or Tradeify and is not responsible for any issues, losses, or service interruptions arising from those platforms.</p>

              <h3 style={{ color: "#fff", marginTop: 24, marginBottom: 8 }}>8. Governing Law</h3>
              <p>These terms shall be governed by and construed in accordance with the laws of the State of South Carolina, United States, without regard to its conflict of law provisions. Any disputes shall be resolved in the courts of South Carolina.</p>

              <h3 style={{ color: "#fff", marginTop: 24, marginBottom: 8 }}>9. Agreement</h3>
              <p>By checking the agreement box and proceeding to checkout, you confirm that you have read, understood, and agree to these Terms of Service and Risk Disclosure in their entirety.</p>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
              <button onClick={() => { setTermsAccepted(true); setShowTerms(false); }} className="btn btn-accent">
                I Agree
              </button>
              <button onClick={() => setShowTerms(false)} className="btn btn-outline">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminDashboardPage({ user, accounts, message, onRefresh, onBack, onApprove, onReject, onDisable }: any) {
  const [filter, setFilter] = useState("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [copied, setCopied] = useState("");

  const filteredAccounts = accounts.filter((acct: Account) => {
    const matchesFilter = filter === "all" ? true : acct.approvalStatus === filter;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q
      ? true
      : [acct.fullName, acct.email, acct.propAccountId, acct.approvalStatus]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  });

  const selectedAccount = accounts.find((acct: Account) => acct.id === selectedId) || null;

  useEffect(() => {
    if (!selectedAccount && filteredAccounts.length > 0) {
      setSelectedId(filteredAccounts[0].id);
    }
  }, [filteredAccounts, selectedAccount]);

  useEffect(() => {
    if (selectedAccount) {
      setNotes(selectedAccount.notes || "");
    }
  }, [selectedAccount]);

  async function runAction(action: string, id: string) {
    setActionLoading(action);
    try {
      if (action === "approve") await onApprove(id, notes);
      if (action === "reject") await onReject(id, notes);
      if (action === "disable") await onDisable(id, notes);
    } finally {
      setActionLoading("");
    }
  }

  async function copyLicenseKey(value: string | null) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied("License key copied.");
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("Could not copy license key.");
      setTimeout(() => setCopied(""), 1500);
    }
  }

  return (
    <div className="page admin-wrap">
      <div className="container">
        <div className="top-row">
          <div>
            <h1 style={{ fontSize: 40 }}>Admin Approval Dashboard</h1>
            <p className="muted" style={{ marginTop: 10 }}>
              {user ? `Admin session: ${user.fullName || user.email}` : "Review submitted Tradeify accounts and manage activations."}
            </p>
          </div>
          <div className="button-row">
            <button onClick={onRefresh} className="btn btn-outline">Refresh</button>
            <button onClick={onBack} className="btn btn-outline">Back to user dashboard</button>
          </div>
        </div>

        <div className="grid-4" style={{ marginBottom: 20 }}>
          <AdminStatCard title="Pending" value={accounts.filter((a: Account) => a.approvalStatus === "pending").length} />
          <AdminStatCard title="Approved" value={accounts.filter((a: Account) => a.approvalStatus === "approved").length} />
          <AdminStatCard title="Rejected" value={accounts.filter((a: Account) => a.approvalStatus === "rejected").length} />
          <AdminStatCard title="Disabled" value={accounts.filter((a: Account) => a.approvalStatus === "disabled").length} />
        </div>

        <div className="filters">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, Tradeify ID, or status" className="search" />
          {[
            ["pending", "Pending"],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
            ["disabled", "Disabled"],
            ["all", "All"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className="btn"
              style={{ background: filter === value ? ACCENT : "#d4d4d4", color: "#000" }}
            >
              {label}
            </button>
          ))}
        </div>

        {message ? <div className="notice">{message}</div> : null}

        <div className="split split-2">
          <div className="card">
            <div className="top-row" style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: 28 }}>Submitted Accounts</h3>
              <p className="muted">{filteredAccounts.length} shown</p>
            </div>
            <div className="account-list">
              {filteredAccounts.map((account: Account) => (
                <button
                  key={account.id}
                  onClick={() => setSelectedId(account.id)}
                  className={`account-button ${selectedId === account.id ? "active" : ""}`}
                >
                  <div className="account-header">
                    <div>
                      <div style={{ fontWeight: 700 }}>{account.fullName}</div>
                      <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>{account.email}</div>
                      <div style={{ marginTop: 10, fontSize: 14, color: "#d5d5d5" }}>Tradeify ID: {account.propAccountId}</div>
                    </div>
                    <StatusPill status={account.approvalStatus} />
                  </div>
                  <div className="top-row" style={{ marginTop: 12, marginBottom: 0 }}>
                    <div className="small">Submitted: {account.submittedAt}</div>
                    {account.licenseKey ? <div className="small" style={{ color: "#b9ff86" }}>License issued</div> : null}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 28 }}>Review Details</h3>
            {selectedAccount ? (
              <>
                <div className="stack-list" style={{ marginTop: 18 }}>
                  <DetailRow label="Trader" value={selectedAccount.fullName} />
                  <DetailRow label="Email" value={selectedAccount.email} />
                  <DetailRow label="Tradeify Account" value={selectedAccount.propAccountId} />
                  <DetailRow label="Submitted" value={selectedAccount.submittedAt} />
                  <DetailRow label="Status" value={selectedAccount.approvalStatus} />
                  {selectedAccount.cancellationRequested && (
                    <DetailRow label="⚠ Cancellation" value="Requested by user" />
                  )}
                </div>

                <div className="card-tight" style={{ marginTop: 18 }}>
                  <div className="top-row" style={{ marginBottom: 0 }}>
                    <div>
                      <div className="small">License Key</div>
                      <div style={{ marginTop: 8, fontWeight: 700 }}>
                        {selectedAccount.licenseKey || "Issued after approval"}
                      </div>
                    </div>
                    <button onClick={() => copyLicenseKey(selectedAccount.licenseKey)} disabled={!selectedAccount.licenseKey} className="btn btn-outline">
                      Copy
                    </button>
                  </div>
                  {copied ? <p className="success" style={{ marginTop: 10 }}>{copied}</p> : null}
                </div>

                <div style={{ marginTop: 18 }}>
                  <label className="small" style={{ display: "block", marginBottom: 10 }}>Internal Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="textarea" placeholder="Add approval notes, follow-up reminders, or review comments..." />
                </div>

                <div className="grid-3" style={{ marginTop: 18 }}>
                  <button onClick={() => runAction("approve", selectedAccount.id)} disabled={actionLoading !== ""} className="btn btn-accent">
                    {actionLoading === "approve" ? "Approving..." : "Approve"}
                  </button>
                  <button onClick={() => runAction("reject", selectedAccount.id)} disabled={actionLoading !== ""} className="btn" style={{ background: "rgba(255,107,107,0.12)", color: "#ff9b9b", border: "1px solid rgba(255,107,107,0.35)" }}>
                    {actionLoading === "reject" ? "Rejecting..." : "Reject"}
                  </button>
                  <button onClick={() => runAction("disable", selectedAccount.id)} disabled={actionLoading !== ""} className="btn btn-outline">
                    {actionLoading === "disable" ? "Disabling..." : "Disable"}
                  </button>
                </div>
              </>
            ) : (
              <div className="notice" style={{ marginTop: 18 }}>Select an account to review.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, value }: any) {
  return (
    <div className="status-card">
      <div className="status-title">{title}</div>
      <div className="status-value">{value}</div>
    </div>
  );
}

function AdminStatCard({ title, value }: any) {
  return (
    <div className="status-card">
      <div className="status-title">{title}</div>
      <div className="status-value" style={{ fontSize: 30 }}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: any) {
  return (
    <div className="detail-row">
      <div className="label">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const className =
    status === "pending"
      ? "status-pill status-pending"
      : status === "approved"
      ? "status-pill status-approved"
      : status === "rejected"
      ? "status-pill status-rejected"
      : "status-pill status-disabled";

  return <span className={className}>{status}</span>;
}
