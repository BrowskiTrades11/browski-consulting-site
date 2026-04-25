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
  });
  const [adminAccounts, setAdminAccounts] = useState<Account[]>([]);
  const [adminMessage, setAdminMessage] = useState("");
  //
  useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (params.get("checkout") === "success") {
    setDashboardState((prev) => ({
      ...prev,
      subscriptionStatus: "Active subscription",
    }));

    setPage("dashboard");
  }
}, []);

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  async function loadAdminAccounts() {
    const data = await safeApiFetch("/admin/accounts/pending", {
      method: "GET",
      headers: authHeaders,
    });

    if (data?.__error) {
      setAdminMessage(`Preview mode: ${data.__error}`);
      return;
    }

    const mapped: Account[] = (data.accounts || []).map((acct: any) => ({
      id: acct.id,
      fullName: acct.fullName || acct.user?.fullName || "Unknown User",
      email: acct.email || acct.user?.email || "",
      propAccountId: acct.propAccountId,
      submittedAt: acct.submittedAt || acct.createdAt || "",
      approvalStatus: acct.approvalStatus,
      licenseKey: acct.licenseKey || null,
      notes: acct.notes || acct.approvalNotes || "",
    }));

    setAdminAccounts(mapped);
    setAdminMessage(mapped.length ? "Loaded admin accounts from backend." : "No pending accounts returned from backend.");
  }

  async function loadDashboardData(headersOverride = authHeaders) {
    const accountData = await safeApiFetch("/accounts/me", {
      method: "GET",
      headers: headersOverride,
    });

    if (!accountData?.__error && Array.isArray(accountData.accounts) && accountData.accounts.length > 0) {
      const account = accountData.accounts[0];
      setDashboardState((prev) => ({
        ...prev,
        tradeifyAccountId: account.propAccountId || "",
        approvalStatus: account.approvalStatus || prev.approvalStatus,
        licenseKey: account.licenseKey || prev.licenseKey,
      }));
    }

    const subscriptionData = await safeApiFetch("/billing/me", {
      method: "GET",
      headers: headersOverride,
    });

    if (!subscriptionData?.__error) {
      setDashboardState((prev) => ({
        ...prev,
        subscriptionStatus: subscriptionData.status || prev.subscriptionStatus,
      }));
    }
  }

  async function handleRegister(form: { fullName: string; email: string; password: string }) {
    const data = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(form),
    });

    const newToken = data.token;
    const headers = newToken ? { Authorization: `Bearer ${newToken}` } : {};

    setToken(newToken);
    setUser(data.user);
    setDashboardState((prev) => ({
      ...prev,
      subscriptionStatus: "Account created — subscription not started",
    }));
    setPage("dashboard");
    setTimeout(() => {
      loadDashboardData(headers);
    }, 0);
  }

  async function handleLogin(form: { email: string; password: string }) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify(form),
    });

    const newToken = data.token;
    const headers = newToken ? { Authorization: `Bearer ${newToken}` } : {};

    setToken(newToken);
    setUser(data.user);
    setDashboardState((prev) => ({
      ...prev,
      subscriptionStatus: "Logged in — ready for checkout",
    }));
    setPage("dashboard");
    setTimeout(() => {
      loadDashboardData(headers);
    }, 0);
  }

  async function handleTradeifySubmit(propAccountId: string) {
    const data = await apiFetch("/accounts/submit", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ propAccountId }),
    });

    setDashboardState((prev) => ({
      ...prev,
      tradeifyAccountId: data.account.propAccountId,
      approvalStatus: data.account.approvalStatus,
    }));
  }

  async function handleCheckout() {
    const data = await apiFetch("/billing/create-checkout-session", {
      method: "POST",
      headers: authHeaders,
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
    return <SignupPage onBack={() => setPage("home")} onSubmit={handleRegister} />;
  }

  if (page === "login") {
    return <LoginPage onBack={() => setPage("home")} onSubmit={handleLogin} />;
  }

  if (page === "dashboard") {
    return (
      <DashboardPage
        user={user}
        dashboardState={dashboardState}
        onBack={() => setPage("home")}
        onTradeifySubmit={handleTradeifySubmit}
        onCheckout={handleCheckout}
        onOpenAdmin={async () => {
          setPage("admin");
          await loadAdminAccounts();
        }}
      />
    );
  }

  if (page === "admin") {
    return (
      <AdminDashboardPage
        user={user}
        accounts={adminAccounts.length ? adminAccounts : mockPendingAccounts}
        message={adminMessage}
        onRefresh={loadAdminAccounts}
        onBack={() => setPage("dashboard")}
        onApprove={async (id: string, notes: string) => {
          const data = await safeApiFetch(`/admin/accounts/${id}/approve`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ notes }),
          });

          if (data?.__error) {
            setAdminMessage(`Preview mode: ${data.__error}. Showing local approval state.`);
            const licenseKey = createMockLicenseKey();
            setAdminAccounts((prev) =>
              (prev.length ? prev : mockPendingAccounts).map((acct) =>
                acct.id === id ? { ...acct, approvalStatus: "approved", licenseKey, notes: notes || acct.notes } : acct
              )
            );
            return;
          }

          setAdminMessage("Account approved successfully.");
          await loadAdminAccounts();
        }}
        onReject={async (id: string, notes: string) => {
          const data = await safeApiFetch(`/admin/accounts/${id}/reject`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ notes }),
          });

          if (data?.__error) {
            setAdminMessage(`Preview mode: ${data.__error}. Showing local rejection state.`);
            setAdminAccounts((prev) =>
              (prev.length ? prev : mockPendingAccounts).map((acct) =>
                acct.id === id ? { ...acct, approvalStatus: "rejected", notes: notes || acct.notes } : acct
              )
            );
            return;
          }

          setAdminMessage("Account rejected successfully.");
          await loadAdminAccounts();
        }}
        onDisable={async (id: string, notes: string) => {
          const data = await safeApiFetch(`/admin/accounts/${id}/disable`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ notes }),
          });

          if (data?.__error) {
            setAdminMessage(`Preview mode: ${data.__error}. Showing local disabled state.`);
            setAdminAccounts((prev) =>
              (prev.length ? prev : mockPendingAccounts).map((acct) =>
                acct.id === id ? { ...acct, approvalStatus: "disabled", notes: notes || acct.notes } : acct
              )
            );
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
      onOpenAdmin={async () => {
        setPage("admin");
        await loadAdminAccounts();
      }}
    />
  );
}

function LandingPage({ setPage, onOpenAdmin }: any) {
  const features = [
    "Fixed $499/month pricing",
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
    "Subscribe to Money Print ORB for $499/month",
    "Submit your Tradeify account for activation review",
    "Receive approval, onboarding, and licensed access",
  ];

  const faqs = [
    {
      q: "What is Money Print ORB?",
      a: "Money Print ORB is the system offered by Browski Consulting. It is positioned as a consistency-focused automated trading solution with fixed monthly pricing.",
    },
    {
      q: "Do you charge a profit split?",
      a: "No. Browski Consulting uses a flat $499 monthly subscription with no profit-sharing model.",
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
              Create your member account, subscribe to Money Print ORB for $499 per month, and activate your licensed access through a private approval workflow.
            </p>
            <div className="button-row" style={{ marginTop: 28 }}>
              <button onClick={() => setPage("signup")} className="btn btn-accent">Get Started</button>
              <a href="#dashboard" className="btn btn-outline">See Member Access</a>
              <button onClick={onOpenAdmin} className="btn btn-outline">Admin Preview</button>
            </div>
            <div className="grid-3" style={{ marginTop: 28 }}>
              <div className="card-tight"><div className="stat">$499</div><div className="muted">Monthly flat rate</div></div>
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
              <div className="muted">per month</div>
              <ul className="feature-list">
                {features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <button onClick={() => setPage("signup")} className="btn btn-accent full" style={{ marginTop: 18 }}>Create Account</button>
              <button onClick={() => setPage("login")} className="btn btn-outline full" style={{ marginTop: 10 }}>Login</button>
              <p className="small" style={{ marginTop: 14 }}>
                Users create an account first, then subscribe, then submit their Tradeify account for activation review.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="center">
            <div className="eyebrow-secondary">Simple offer</div>
            <h2>One product. One price. One clean path to activation.</h2>
            <p className="lede" style={{ marginInline: "auto" }}>
              Money Print ORB is positioned as a premium, consistency-focused trading system with a clear monthly subscription model.
            </p>
          </div>
          <div className="grid-3" style={{ marginTop: 32 }}>
            {features.map((feature) => (
              <div key={feature} className="feature-box">{feature}</div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="section" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
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
                <div className="card" style={{ marginTop: 26 }}>
  <h3 style={{ fontSize: 28 }}>Onboarding Guide</h3>

  <p className="lede" style={{ fontSize: 16, marginTop: 12 }}>
    Follow these steps to activate your Money Print ORB system.
  </p>

  <div className="grid-2" style={{ marginTop: 22 }}>
    <div className="card-tight">
      <strong>Step 1: Create Tradeify Account</strong>
      <p className="small" style={{ marginTop: 8 }}>
        Create your funded trading account through Tradeify or the approved provider.
      </p>
    </div>

    <div className="card-tight">
      <strong>Step 2: Create NinjaTrader Account</strong>
      <p className="small" style={{ marginTop: 8 }}>
        Create a free NinjaTrader account so the system can be connected properly.
      </p>
    </div>

    <div className="card-tight">
      <strong>Step 3: Install NinjaTrader</strong>
      <p className="small" style={{ marginTop: 8 }}>
        Download and install NinjaTrader using the setup tutorial provided after signup.
      </p>
    </div>

    <div className="card-tight">
      <strong>Step 4: Connect Your Account</strong>
      <p className="small" style={{ marginTop: 8 }}>
        Follow the tutorial to connect your funded account to NinjaTrader.
      </p>
    </div>

    <div className="card-tight">
      <strong>Step 5: Submit Tradeify ID</strong>
      <p className="small" style={{ marginTop: 8 }}>
        Enter your Tradeify account ID below so your activation can be reviewed.
      </p>
    </div>

    <div className="card-tight">
      <strong>Step 6: Wait for Approval</strong>
      <p className="small" style={{ marginTop: 8 }}>
        Once reviewed, your license key and activation status will appear in your dashboard.
      </p>
    </div>
  </div>
</div>
                <div className="grid-2" style={{ marginTop: 26 }}>
                  <div className="card-tight">$499 monthly subscription</div>
                  <div className="card-tight">No profit split</div>
                  <div className="card-tight">Private dashboard access</div>
                  <div className="card-tight">Tradeify account activation review</div>
                </div>
              </div>
              <div className="cta-box">
                <div style={{ fontSize: 14, color: ACCENT }}>Subscription price</div>
                <div className="price" style={{ marginTop: 10 }}>$499</div>
                <div className="muted">billed monthly</div>
                <button onClick={() => setPage("signup")} className="btn full" style={{ marginTop: 20, background: "#fff", color: "#000" }}>
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
              </div>
              <div className="gradient-box">
                <div style={{ fontSize: 14, color: ACCENT }}>Launch offer</div>
                <div style={{ fontSize: 40, fontWeight: 700, marginTop: 8 }}>Money Print ORB</div>
                <p className="lede" style={{ fontSize: 16, marginTop: 10 }}>
                  $499/month with a 50% first-month satisfaction guarantee.
                </p>
                <button onClick={() => setPage("signup")} className="btn btn-accent full" style={{ marginTop: 18 }}>Create Account</button>
                <button onClick={() => setPage("login")} className="btn btn-outline full" style={{ marginTop: 10 }}>Login</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="testimonials" className="section">
        <div className="container">
          <div className="center">
            <div className="eyebrow-secondary">Testimonials</div>
            <h2>Positioned like a premium software product</h2>
            <p className="lede" style={{ marginInline: "auto" }}>
              Placeholder testimonials you can replace with real client feedback once you begin onboarding members.
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
              <h2>Reduce hesitation with a clear satisfaction offer</h2>
              <p className="lede">
                New members can try Money Print ORB during their first month and request a 50% refund if they are not satisfied, subject to your satisfaction guarantee review process.
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
                Members create their account first, subscribe, then submit their Tradeify account for approval before licensed access is activated.
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
                The flow is built to keep the process simple for customers while keeping your licensing and approval workflow controlled.
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
            <h2>Clear answers to the biggest buyer questions</h2>
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
            <h2>Launch Money Print ORB under Browski Consulting</h2>
            <p className="lede" style={{ marginInline: "auto" }}>
              The website is aligned around one product, one price, secure licensing, Tradeify account review, and your first-month satisfaction guarantee.
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

function SignupPage({ onBack, onSubmit }: any) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit({ fullName, email, password });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create Account" onBack={onBack}>
      <form onSubmit={submit} className="form-stack">
        <input placeholder="Full name" className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input placeholder="Email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
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

function DashboardPage({ user, dashboardState, onBack, onTradeifySubmit, onCheckout, onOpenAdmin }: any) {
  const [propAccountId, setPropAccountId] = useState(dashboardState.tradeifyAccountId || "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      await onTradeifySubmit(propAccountId);
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
              {user ? `Logged in as ${user.fullName || user.email}` : "Authenticated session"}
            </p>
          </div>
          <div className="button-row">
            <button onClick={onOpenAdmin} className="btn btn-outline">Admin Approval UI</button>
            <button onClick={onBack} className="btn btn-outline">Back to landing page</button>
          </div>
        </div>

        <div className="grid-4">
          <StatusCard title="Subscription" value={dashboardState.subscriptionStatus} />
          <StatusCard title="Tradeify Account" value={dashboardState.tradeifyAccountId || "Not submitted"} />
          <StatusCard title="Approval Status" value={dashboardState.approvalStatus} />
          <StatusCard title="License Key" value={dashboardState.licenseKey} />
        </div>

        <div className="grid-2" style={{ marginTop: 26 }}>
          <div className="card">
            <h3 style={{ fontSize: 28 }}>Start Subscription</h3>
            <p className="lede" style={{ fontSize: 16, marginTop: 12 }}>
              Begin access to the Money Print ORB system ($499/month). Requires a funded trading account (~$120/month, paid directly to the provider) and a NinjaTrader account. Step-by-step setup guide provided after signup.
            </p>
            <button onClick={onCheckout} className="btn btn-accent" style={{ marginTop: 20 }}>
              Open Checkout
            </button>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 28 }}>Submit Tradeify Account</h3>
            <p className="lede" style={{ fontSize: 16, marginTop: 12 }}>
              Enter your Tradeify account ID to request activation review.
            </p>
            <form onSubmit={submitAccount} className="form-stack" style={{ marginTop: 18 }}>
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
