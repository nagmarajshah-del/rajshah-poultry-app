import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Calculator,
  Check, ChevronRight, CircleHelp, Clock3, FileText, IndianRupee, Leaf,
  LogOut, MessageCircle, Plus, Printer, ReceiptText, ShieldCheck, Sparkles,
  UserRound, Weight,
} from 'lucide-react';
import {
  Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams,
} from 'wouter';

type Order = {
  id: string;
  number: string;
  createdAt: string;
  customerName: string;
  phone: string;
  itemName: string;
  quantity: number;
  weight: number;
  rate: number;
  total: number;
};

type Draft = {
  customerName: string;
  phone: string;
  itemName: string;
  quantity: string;
  weight: string;
  rate: string;
};

const queryClient = new QueryClient();
const storageKeyForUser = (userId: string) => `order-billing-orders-v1:${userId}`;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#294660',
    colorForeground: '#293a47',
    colorMutedForeground: '#75827e',
    colorDanger: '#c85d53',
    colorBackground: '#fffefa',
    colorInput: '#ffffff',
    colorInputForeground: '#293a47',
    colorNeutral: '#dce4df',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffefa] rounded-[24px] w-[440px] max-w-full overflow-hidden shadow-[0_24px_80px_rgba(37,55,69,.14)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#243c51] font-bold tracking-tight',
    headerSubtitle: 'text-[#74827e]',
    socialButtonsBlockButtonText: 'text-[#31495b] font-semibold',
    formFieldLabel: 'text-[#53645f] font-semibold',
    footerActionLink: 'text-[#2b735e] font-semibold',
    footerActionText: 'text-[#78837e]',
    dividerText: 'text-[#89918d]',
    identityPreviewEditButton: 'text-[#2b735e]',
    formFieldSuccessText: 'text-[#26755b]',
    alertText: 'text-[#9b433d]',
    logoBox: 'mb-2',
    logoImage: 'rounded-xl',
    socialButtonsBlockButton: 'border-[#dce4df] bg-white hover:bg-[#f4f8f5]',
    formButtonPrimary: 'bg-[#294660] hover:bg-[#203b54] shadow-none',
    formFieldInput: 'border-[#dce4df] bg-white text-[#293a47]',
    footerAction: 'text-[#78837e]',
    dividerLine: 'bg-[#e5e9e5]',
    alert: 'bg-[#fff3f1] border-[#efd4d0]',
    otpCodeFieldInput: 'border-[#dce4df] bg-white',
    formFieldRow: 'mb-4',
    main: 'gap-5',
  },
};

const money = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

function getOrders(userId: string): Order[] {
  const storageKey = storageKeyForUser(userId);
  try {
    const value = localStorage.getItem(storageKey);
    if (!value) {
      const tabValue = sessionStorage.getItem(storageKey);
      return tabValue ? (JSON.parse(tabValue) as Order[]) : [];
    }
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as Order[]) : [];
  } catch {
    try {
      const tabValue = sessionStorage.getItem(storageKey);
      return tabValue ? (JSON.parse(tabValue) as Order[]) : [];
    } catch {
      return [];
    }
  }
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand-lockup" data-testid="link-home-logo">
      <span className="brand-mark"><ReceiptText size={19} strokeWidth={2.1} /></span>
      {!compact && <span className="brand-word">order<span>billing</span></span>}
    </Link>
  );
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <LoadingScreen />;
  return isSignedIn ? <Redirect to="/workspace" /> : <HomePage />;
}

function HomePage() {
  return (
    <main className="app-shell min-h-[100dvh] overflow-hidden">
      <header className="landing-nav">
        <Logo />
        <nav className="landing-links">
          <a href="#how-it-works" data-testid="link-how-it-works">How it works</a>
          <Link href="/sign-in" className="landing-login" data-testid="link-sign-in">Sign in <ArrowUpRight size={15} /></Link>
        </nav>
      </header>
      <section className="hero-wrap">
        <div className="hero-copy animate-in">
          <div className="hero-pill"><span className="status-dot" /> Made for the everyday shop</div>
          <h1 className="section-title">Good orders.<br /><em>Clear bills.</em></h1>
          <p className="hero-subtitle">A little less paperwork, a lot more peace of mind. Make a neat bill in seconds and send it straight to your customer.</p>
          <div className="hero-actions">
            <Link href="/sign-up" className="primary-button" data-testid="button-get-started">Create your account <ArrowRight size={17} /></Link>
            <span className="hero-caption"><ShieldCheck size={15} /> Private to your account</span>
          </div>
          <div className="hero-proof">
            <div className="proof-avatars" aria-hidden="true"><span>R</span><span>M</span><span>A</span></div>
            <span>Built for the way small shops work</span>
          </div>
        </div>
        <div className="hero-art animate-in delay-1" aria-label="A preview of a customer bill">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="receipt-float">
            <div className="receipt-brand"><span className="receipt-stamp"><ReceiptText size={15} /></span><span>ORDER BILLING<small>YOUR SHOP, MADE SIMPLE</small></span><BadgeCheck className="receipt-check" size={17} /></div>
            <div className="receipt-rule" />
            <div className="receipt-idline"><span>RECEIPT</span><span>#OB-1048</span></div>
            <div className="receipt-customer"><small>BILLED TO</small><strong>Meera Sharma</strong></div>
            <div className="receipt-product"><span><b>Fresh mangoes</b><small>3 संख्या · 2.5 kg</small></span><strong>₹375</strong></div>
            <div className="receipt-rule dotted" />
            <div className="receipt-total"><span>Total paid</span><strong>₹375.00</strong></div>
            <div className="receipt-thanks"><Check size={13} /> Thanks for shopping local</div>
          </div>
          <div className="float-chip chip-secure"><span className="chip-icon"><ShieldCheck size={17} /></span><span>Saved as you go<small>Your bills stay close</small></span></div>
          <div className="float-chip chip-share"><span className="share-icon"><MessageCircle size={17} /></span><span>Ready to share<small>Right on WhatsApp</small></span></div>
          <div className="art-sparkle"><Sparkles size={21} /></div>
        </div>
      </section>
      <section className="trust-strip" aria-label="Product benefits">
        <div><span className="trust-icon"><Clock3 size={17} /></span><p><b>Quick by design</b><small>Back to your shop in seconds</small></p></div>
        <div><span className="trust-icon"><IndianRupee size={17} /></span><p><b>Totals you can trust</b><small>Weight × rate, done right</small></p></div>
        <div><span className="trust-icon"><MessageCircle size={17} /></span><p><b>Easy to pass along</b><small>A tidy bill, sent direct</small></p></div>
      </section>
      <section className="how-section" id="how-it-works">
        <div className="how-intro">
          <span className="eyebrow">A calmer way to bill</span>
          <h2 className="section-title">Three small steps.<br />One less thing to worry about.</h2>
          <p>From the counter to your customer’s phone, your order stays clear at every step.</p>
        </div>
        <div className="steps-list">
          <div className="step-row"><span className="step-index">01</span><div className="step-icon"><UserRound size={19} /></div><div><b>Add your customer</b><p>Name and WhatsApp number. That’s all we need.</p></div><ChevronRight size={17} /></div>
          <div className="step-row"><span className="step-index">02</span><div className="step-icon"><Weight size={19} /></div><div><b>Enter the order</b><p>Quantity, weight and your rate per kilogram.</p></div><ChevronRight size={17} /></div>
          <div className="step-row"><span className="step-index">03</span><div className="step-icon"><ReceiptText size={19} /></div><div><b>Make it official</b><p>Keep a receipt or send it straight on WhatsApp.</p></div><ChevronRight size={17} /></div>
        </div>
      </section>
      <section className="landing-cta">
        <span className="eyebrow">Your next bill starts here</span>
        <h2 className="section-title">Make room for the good work.</h2>
        <Link href="/sign-up" className="primary-button" data-testid="button-bottom-signup">Get started, it’s free <ArrowRight size={17} /></Link>
      </section>
      <footer className="landing-footer"><Logo /><span>Made for good business, every day.</span><Link href="/sign-in" data-testid="link-footer-signin">Already have an account? Sign in</Link></footer>
    </main>
  );
}

function SignInPage() {
  return <div className="auth-shell"><div className="auth-back"><Link href="/" data-testid="link-auth-home"><ArrowLeft size={16} /> Back to home</Link></div><div className="auth-brand"><Logo /><p>Keep your shop moving.</p></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="auth-shell"><div className="auth-back"><Link href="/" data-testid="link-auth-home"><ArrowLeft size={16} /> Back to home</Link></div><div className="auth-brand"><Logo /><p>Your next order, made simpler.</p></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function WorkspaceGate() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <LoadingScreen />;
  return isSignedIn && user ? <WorkspacePage key={user.id} /> : <Redirect to="/" />;
}

const emptyDraft: Draft = { customerName: '', phone: '', itemName: '', quantity: '', weight: '', rate: '' };

function WorkspacePage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const total = (Number(draft.weight) || 0) * (Number(draft.rate) || 0);
  const displayName = user?.firstName || user?.fullName?.split(' ')[0] || 'there';

  useEffect(() => { setOrders(user?.id ? getOrders(user.id) : []); }, [user?.id]);

  function update(field: keyof Draft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.id) return;
    const nextErrors: Record<string, string> = {};
    if (!draft.customerName.trim()) nextErrors.customerName = 'Add the customer’s name.';
    if (!draft.phone.trim()) nextErrors.phone = 'Add a WhatsApp number.';
    else if (draft.phone.replace(/\D/g, '').length < 10) nextErrors.phone = 'Enter a valid phone number.';
    if (!draft.itemName.trim()) nextErrors.itemName = 'What did they order?';
    if (!draft.quantity || Number(draft.quantity) <= 0) nextErrors.quantity = 'Enter a quantity above zero.';
    if (!draft.weight || Number(draft.weight) <= 0) nextErrors.weight = 'Enter a weight above zero.';
    if (!draft.rate || Number(draft.rate) <= 0) nextErrors.rate = 'Enter a rate above zero.';
    if (total <= 0 || !Number.isFinite(total)) nextErrors.rate = 'Check the weight and rate.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const now = new Date();
    const order: Order = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      number: `OB-${String(Date.now()).slice(-6)}`,
      createdAt: now.toISOString(),
      customerName: draft.customerName.trim(),
      phone: draft.phone.trim(),
      itemName: draft.itemName.trim(),
      quantity: Number(draft.quantity),
      weight: Number(draft.weight),
      rate: Number(draft.rate),
      total: Number(total.toFixed(2)),
    };
    const nextOrders = [order, ...orders];
    setOrders(nextOrders);
    const storageKey = storageKeyForUser(user.id);
    let storageFallback = false;
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextOrders));
    } catch {
      storageFallback = true;
      try { sessionStorage.setItem(storageKey, JSON.stringify(nextOrders)); } catch { /* storage is unavailable */ }
    }
    setDraft(emptyDraft);
    setLocation(`/workspace/receipt/${order.id}${storageFallback ? '?storage=tab' : ''}`);
  }

  function restoreOrder(order: Order) {
    setDraft({
      customerName: order.customerName, phone: order.phone, itemName: order.itemName,
      quantity: String(order.quantity), weight: String(order.weight), rate: String(order.rate),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main className="app-shell workspace-shell min-h-[100dvh]">
      <header className="workspace-topbar">
        <Logo />
        <div className="topbar-right">
          <span className="user-greeting"><span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span><span className="greeting-name">Hi, {displayName}</span></span>
          <button className="signout-button" type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={16} /><span>Sign out</span></button>
        </div>
      </header>
      <div className="workspace-content">
        <div className="workspace-heading animate-in">
          <div><span className="eyebrow">Your workspace</span><h1 className="section-title">Let’s make a bill.</h1><p>A few details, then you’re all set.</p></div>
          <div className="today-tag"><Clock3 size={15} /> {new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</div>
        </div>
        <div className="workspace-grid">
          <section className="form-card glass animate-in delay-1">
            <div className="form-card-heading"><div className="form-heading-icon"><Calculator size={18} /></div><div><h2>New order</h2><p>Enter a few details to get started</p></div><span className="step-count">01 / 01</span></div>
            <form onSubmit={submit} noValidate>
              <div className="form-section">
                <div className="form-section-label"><span className="form-section-number">1</span><span>Customer details</span></div>
                <div className="field-grid">
                  <Field label="Customer name" id="customerName" value={draft.customerName} placeholder="e.g. Meera Sharma" icon={<UserRound size={16} />} error={errors.customerName} onChange={(value) => update('customerName', value)} />
                  <Field label="WhatsApp number" id="phone" value={draft.phone} placeholder="10-digit phone number" icon={<MessageCircle size={16} />} inputMode="tel" error={errors.phone} onChange={(value) => update('phone', value)} />
                </div>
              </div>
              <div className="form-section">
                <div className="form-section-label"><span className="form-section-number">2</span><span>Order details</span></div>
                <Field label="Item name" id="itemName" value={draft.itemName} placeholder="e.g. Fresh mangoes" icon={<Leaf size={16} />} error={errors.itemName} onChange={(value) => update('itemName', value)} />
                <div className="field-grid measure-grid">
                  <Field label="संख्या · Quantity" id="quantity" value={draft.quantity} placeholder="e.g. 3" type="number" min="0.01" step="any" icon={<FileText size={16} />} error={errors.quantity} onChange={(value) => update('quantity', value)} />
                  <Field label="वज़न · Weight (kg)" id="weight" value={draft.weight} placeholder="e.g. 2.5" type="number" min="0.01" step="any" icon={<Weight size={16} />} error={errors.weight} onChange={(value) => update('weight', value)} />
                </div>
                <Field label="Rate per kilogram" id="rate" value={draft.rate} placeholder="e.g. 150" type="number" min="0.01" step="any" icon={<IndianRupee size={16} />} error={errors.rate} onChange={(value) => update('rate', value)} prefix="₹" />
              </div>
              <div className="total-preview" aria-live="polite">
                <div><span className="total-kicker">BILL TOTAL</span><small>{draft.weight && draft.rate ? `${draft.weight} kg × ${money(Number(draft.rate))} per kg` : 'Calculated from weight × rate'}</small></div>
                <strong data-testid="text-live-total">{money(total)}</strong>
              </div>
              <button type="submit" className="primary-button submit-button" data-testid="button-create-bill">Create bill <ArrowRight size={17} /></button>
              <p className="privacy-line"><ShieldCheck size={14} /> Your orders are saved on this device.</p>
            </form>
          </section>
          <aside className="recent-panel animate-in delay-2">
            <div className="recent-heading"><div><span className="eyebrow">Your records</span><h2>Recent bills</h2></div><span className="order-count" data-testid="text-order-count">{orders.length}</span></div>
            {orders.length === 0 ? (
              <div className="empty-state glass" data-testid="empty-recent-bills">
                <div className="empty-illustration"><span className="empty-paper"><ReceiptText size={25} /></span><span className="empty-spark empty-spark-a" /><span className="empty-spark empty-spark-b" /></div>
                <h3>Your first bill is waiting.</h3><p>Once you make a bill, it’ll be saved here for a quick return.</p>
                <button type="button" className="quiet-link" onClick={() => document.getElementById('customerName')?.focus()} data-testid="button-start-first-order">Start a new order <ArrowDownRight size={15} /></button>
              </div>
            ) : (
              <div className="recent-list" data-testid="list-recent-bills">
                {orders.slice(0, 6).map((order) => (
                  <div className="recent-item glass" key={order.id} data-testid={`card-order-${order.id}`}>
                    <button className="recent-main" type="button" onClick={() => setLocation(`/workspace/receipt/${order.id}`)} data-testid={`button-open-order-${order.id}`}>
                      <span className="recent-avatar">{order.customerName.slice(0, 1).toUpperCase()}</span>
                      <span className="recent-details"><b>{order.customerName}</b><small>{order.number} <span>·</span> {new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(order.createdAt))}</small></span>
                      <span className="recent-amount">{money(order.total)}<ChevronRight size={15} /></span>
                    </button>
                    <button className="repeat-order" type="button" onClick={() => restoreOrder(order)} data-testid={`button-repeat-order-${order.id}`} aria-label={`Use ${order.customerName}'s order as a starting point`}><Plus size={14} /> Repeat</button>
                  </div>
                ))}
                {orders.length > 6 && <p className="more-records">Showing your latest 6 of {orders.length} bills.</p>}
              </div>
            )}
            <div className="records-note"><CircleHelp size={15} /> Bills are stored privately in this browser.</div>
          </aside>
        </div>
      </div>
      <div className="workspace-footer">A little more order in your day. <span>Made for small shops.</span></div>
    </main>
  );
}

function Field({ label, id, value, placeholder, type = 'text', min, step, icon, error, onChange, inputMode, prefix }: {
  label: string; id: string; value: string; placeholder: string; type?: string;
  min?: string; step?: string; icon: ReactNode; error?: string; inputMode?: 'tel' | 'decimal' | 'numeric';
  onChange: (value: string) => void; prefix?: string;
}) {
  return (
    <div className={`form-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap"><span className="input-icon">{icon}</span>{prefix && <span className="input-prefix">{prefix}</span>}
        <input id={id} className={`field ${prefix ? 'has-prefix' : ''}`} type={type} min={min} step={step} inputMode={inputMode} value={value} placeholder={placeholder} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} data-testid={`input-${id}`} />
        {type === 'number' && id !== 'phone' && <span className="input-suffix">{id === 'weight' ? 'kg' : id === 'quantity' ? 'pcs' : 'per kg'}</span>}
      </div>
      {error && <span className="field-error" id={`${id}-error`} role="alert" data-testid={`error-${id}`}>{error}</span>}
    </div>
  );
}

function ReceiptGate() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <LoadingScreen />;
  return isSignedIn && user
    ? <ReceiptRoute key={user.id} userId={user.id} />
    : <Redirect to="/" />;
}

function ReceiptRoute({ userId }: { userId: string }) {
  const params = useParams<{ id: string }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [, setLocation] = useLocation();
  useEffect(() => {
    setOrders(getOrders(userId));
    setOrdersLoaded(true);
  }, [userId]);
  const order = orders.find((item) => item.id === params.id);
  const usedSessionStorage = new URLSearchParams(window.location.search).get('storage') === 'tab';

  if (!ordersLoaded) return <LoadingScreen />;
  if (!order) return <main className="app-shell receipt-not-found"><div className="receipt-missing glass"><span className="missing-icon"><ReceiptText size={25} /></span><h1 className="section-title">We couldn’t find that bill.</h1><p>It may have been cleared from this browser.</p><Link href="/workspace" className="primary-button" data-testid="link-return-workspace">Back to your workspace <ArrowRight size={16} /></Link></div></main>;

  const digits = order.phone.replace(/\D/g, '');
  const whatsappPhone = digits.length === 10 ? `91${digits}` : digits;
  const message = [
    `Your bill from Order Billing`,
    `Bill ${order.number}`,
    `Item: ${order.itemName}`,
    `Quantity: ${order.quantity}`,
    `Weight: ${order.weight} kg`,
    `Rate: ${money(order.rate)} per kg`,
    `Total: ${money(order.total)}`,
    `Thank you, ${order.customerName}.`,
  ].join('\n');
  const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
  const date = new Date(order.createdAt);

  return (
    <main className="app-shell min-h-[100dvh]">
      <header className="workspace-topbar no-print"><Logo /><button className="signout-button" type="button" onClick={() => setLocation('/workspace')} data-testid="button-back-to-workspace"><ArrowLeft size={16} /><span>Back to workspace</span></button></header>
      <div className="receipt-page print-layout">
        <div className="receipt-page-heading no-print animate-in"><span className="eyebrow">A job well done</span><h1 className="section-title">Your bill is ready.</h1><p>Keep a copy, or send it on its way.</p></div>
        <article className="receipt-paper animate-in delay-1" data-testid="receipt-order">
          <div className="receipt-top-accent" />
          <div className="bill-head"><div className="bill-brand-row"><span className="brand-mark"><ReceiptText size={19} /></span><div><b>Order Billing</b><small>A clear record of your order</small></div></div><span className="bill-status"><Check size={12} /> BILL READY</span></div>
          <div className="bill-number-row"><div><small>RECEIPT NUMBER</small><strong data-testid="value-order-number">{order.number}</strong></div><div className="bill-date"><small>DATE & TIME</small><strong data-testid="value-order-date">{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)}</strong></div></div>
          <div className="bill-customer"><span className="bill-section-label">BILLED TO</span><strong data-testid="value-customer-name">{order.customerName}</strong><span data-testid="value-customer-phone">{order.phone}</span></div>
          <div className="bill-items">
            <div className="bill-table-head"><span>ITEM DETAILS</span><span>AMOUNT</span></div>
            <div className="bill-item-name"><b data-testid="value-item-name">{order.itemName}</b><span>{order.quantity} संख्या <i>·</i> {order.weight} kg</span></div>
            <div className="bill-math"><span>Rate per kilogram</span><b data-testid="value-rate">{money(order.rate)} / kg</b></div>
            <div className="bill-math"><span>Weight</span><b data-testid="value-weight">{order.weight} kg</b></div>
          </div>
          <div className="bill-total-row"><div><small>AMOUNT DUE</small><span>Weight × rate</span></div><strong data-testid="value-total">{money(order.total)}</strong></div>
          <div className="bill-footer"><span className="bill-footer-check"><Check size={14} /></span><span>Thank you for choosing a local shop.<br /><small>Please keep this receipt for your records.</small></span></div>
          <div className="receipt-edge" />
        </article>
        <div className="receipt-actions no-print animate-in delay-2">
          <button type="button" className="primary-button whatsapp-button" onClick={() => window.open(whatsappUrl, '_blank', 'noopener,noreferrer')} data-testid="button-send-whatsapp"><MessageCircle size={18} /> Send on WhatsApp <ArrowUpRight size={15} /></button>
          <button type="button" className="secondary-button" onClick={() => window.print()} data-testid="button-print-receipt"><Printer size={17} /> Print receipt</button>
          <button type="button" className="new-order-link" onClick={() => setLocation('/workspace')} data-testid="button-another-order"><Plus size={16} /> Start another order</button>
        </div>
        {usedSessionStorage && <p className="storage-warning" role="status" data-testid="status-storage-warning">Your browser could not save this bill across visits. It will remain available in this tab.</p>}
        <p className="receipt-local-note no-print"><ShieldCheck size={14} /> A copy of this bill is saved in your recent bills.</p>
      </div>
    </main>
  );
}

function LoadingScreen() {
  return <main className="app-shell loading-page" aria-label="Loading"><div className="loading-mark"><ReceiptText size={19} /></div><span className="loading-bar" /><span className="sr-only">Loading your workspace</span></main>;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to pick up where you left off.' } },
        signUp: { start: { title: 'Make billing a little easier', subtitle: 'Create an account for your shop.' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/workspace/receipt/:id" component={ReceiptGate} />
        <Route path="/workspace" component={WorkspaceGate} />
        <Route component={NotFound} />
      </Switch>
    </ClerkProvider>
  );
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><ClerkRoutes /></ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
