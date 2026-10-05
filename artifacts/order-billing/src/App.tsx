import { useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowLeft, ArrowRight, BadgeIndianRupee, BookOpen, CalendarDays, ChartNoAxesCombined,
  Check, ChevronRight, ClipboardList, Download, Edit3, FilePlus2, History, LogOut,
  MessageCircle, Plus, Printer, Search, Settings2, Store, Trash2, Users, X,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { z } from 'zod';

type Customer = { id: string; shopName: string; ownerName: string; address: string; whatsapp: string };
type RateMap = Record<string, number>;
type Order = {
  id: string; billNumber: string; createdAt: string; customerId: string;
  customer: Customer; quantity: number; weightKg: number; ratePerKg: number; total: number;
};
const customerSchema = z.object({
  shopName: z.string().trim().min(1, 'Enter the shop name.'),
  ownerName: z.string().trim().min(1, 'Enter the owner name.'),
  address: z.string().trim().min(1, 'Enter the address.'),
  whatsapp: z.string().trim().refine((value) => {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }, 'Enter a valid WhatsApp number.'),
});
const rateSchema = z.object({
  date: z.string().min(1, 'Choose a calendar day.'),
  rate: z.string().refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, 'Enter a rate greater than zero.'),
});
const orderSchema = z.object({
  customerId: z.string().min(1, 'Select a saved customer.'),
  quantity: z.string().refine((value) => Number.isInteger(Number(value)) && Number(value) >= 1, 'Enter a whole number of at least one piece.'),
  weight: z.string().refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, 'Enter a weight greater than zero.'),
});
type CustomerFormValues = z.infer<typeof customerSchema>;
type RateFormValues = z.infer<typeof rateSchema>;
type OrderFormValues = z.infer<typeof orderSchema>;

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const FARM = 'RAJSHAH POULTRY FARM';
const TAGLINE = 'HEALTHY BIRDS • FRESH MEAT • BETTER TOMORROW';
const logoUrl = `${basePath || ''}/logo.png`;
const money = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const orderStorageKey = (id: string) => `rajshah-farm:orders:v1:${id}`;
const customerStorageKey = (id: string) => `rajshah-farm:customers:v1:${id}`;
const rateStorageKey = (id: string) => `rajshah-farm:rates:v1:${id}`;
const randomId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
const clerkAppearance = {
  theme: shadcn, cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${logoUrl}` },
  variables: {
    colorPrimary: '#a82f38', colorForeground: '#292e34', colorMutedForeground: '#777a7d',
    colorDanger: '#a82f38', colorBackground: '#fbf9f4', colorInput: '#fffdf9',
    colorInputForeground: '#292e34', colorNeutral: '#e5ddd2', fontFamily: 'DM Sans, sans-serif', borderRadius: '0.8rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#fbf9f4] rounded-[18px] w-[460px] max-w-full overflow-hidden shadow-[0_22px_70px_rgba(40,35,29,.13)]',
    card: '!shadow-none !border-0 !bg-transparent', footer: '!shadow-none !border-0 !bg-transparent',
    headerTitle: 'text-[#292e34] font-bold', headerSubtitle: 'text-[#777a7d]', formFieldLabel: 'text-[#505257] font-semibold',
    footerActionLink: 'text-[#a82f38] font-semibold', footerActionText: 'text-[#5d6064]',
    formButtonPrimary: 'bg-[#a82f38] hover:bg-[#8f252e] !text-white',
    socialButtonsBlockButton: 'border-[#ded8cf] bg-white hover:bg-[#f8f4ef]',
    socialButtonsBlockButtonText: 'text-[#292e34] font-semibold',
    formFieldInput: 'border-[#ded8cf] bg-[#fffdf9] text-[#292e34]', logoImage: 'rounded-xl',
  },
};

function safeLoad<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { /* try tab storage below */ }
  if (!raw) try { raw = sessionStorage.getItem(key); } catch { /* storage unavailable */ }
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
function persist<T>(key: string, value: T) {
  const serialized = JSON.stringify(value);
  try { localStorage.setItem(key, serialized); }
  catch { try { sessionStorage.setItem(key, serialized); } catch { /* browser storage unavailable */ } }
}
function useFarmData(userId: string) {
  const [customers, setCustomers] = useState<Customer[]>(() => safeLoad(customerStorageKey(userId), []));
  const [rates, setRates] = useState<RateMap>(() => safeLoad(rateStorageKey(userId), {}));
  const [orders, setOrders] = useState<Order[]>(() => safeLoad(orderStorageKey(userId), []));
  const saveCustomers = (value: Customer[]) => { setCustomers(value); persist(customerStorageKey(userId), value); };
  const saveRates = (value: RateMap) => { setRates(value); persist(rateStorageKey(userId), value); };
  const saveOrders = (value: Order[]) => { setOrders(value); persist(orderStorageKey(userId), value); };
  return { customers, rates, orders, saveCustomers, saveRates, saveOrders };
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/workspace" className="brand-lockup" data-testid="link-brand-home">
    <img className="brand-logo" src={logoUrl} alt={`${FARM} logo`} data-testid="img-farm-logo" />
    {!compact && <span className="brand-copy"><b>{FARM}</b><small>{TAGLINE}</small></span>}
  </Link>;
}
const NAV = [
  { href: '/workspace', label: 'Overview', Icon: ChartNoAxesCombined },
  { href: '/workspace/new-order', label: 'New order', Icon: FilePlus2 },
  { href: '/workspace/history', label: 'History', Icon: History },
  { href: '/workspace/customers', label: 'Customers', Icon: Users },
  { href: '/workspace/rates', label: 'Mandi rate', Icon: BadgeIndianRupee },
];

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <LoadingScreen />;
  return isSignedIn ? <Redirect to="/workspace" /> : <Redirect to="/sign-in" />;
}
function AuthPage({ signup = false }: { signup?: boolean }) {
  return <main className="auth-shell"><div className="auth-inner">
    <Link href="/" className="auth-back" data-testid="link-auth-back"><ArrowLeft size={14} /> Back</Link>
    <div className="auth-brand"><Brand /><p>{signup ? 'A clearer way to manage the counter.' : 'Your poultry counter, in good order.'}</p></div>
    <div className="auth-card">{signup
      ? <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      : <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />}</div>
  </div></main>;
}
function SignInPage() { return <AuthPage />; }
function SignUpPage() { return <AuthPage signup />; }

function WorkspaceGate({ page }: { page: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn || !user) return <Redirect to="/" />;
  return <Workspace key={user.id} userId={user.id} displayName={user.firstName || user.fullName || 'Farm owner'}>{page}</Workspace>;
}
function Workspace({ userId, displayName, children }: { userId: string; displayName: string; children: ReactNode }) {
  const { signOut } = useClerk();
  const [location] = useLocation();
  const initials = displayName.trim().slice(0, 1).toUpperCase();
  return <main className="app-shell">
    <header className="topbar"><Brand />
      <div className="top-actions"><span className="user-pill"><span className="avatar">{initials}</span><span data-testid="text-current-user">{displayName}</span></span>
        <button className="button-quiet" type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={16} /> Sign out</button>
      </div>
    </header>
    <div className="workspace">
      <nav className="navrail" aria-label="Main navigation">{NAV.map(({ href, label, Icon }) => <Link key={href} href={href} className={`navlink ${location === href ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={16} />{label}</Link>)}</nav>
      {children}
    </div>
    <nav className="mobile-nav" aria-label="Main navigation">{NAV.map(({ href, label, Icon }) => <Link key={href} href={href} className={`navlink ${location === href ? 'active' : ''}`} data-testid={`mobile-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon />{label}</Link>)}</nav>
  </main>;
}
function DashboardRoute() {
  const { user } = useUser();
  if (!user) return <LoadingScreen />;
  return <WorkspaceGate page={<Dashboard userId={user.id} />} />;
}
function Dashboard({ userId }: { userId: string }) {
  const { orders, rates } = useFarmData(userId);
  const today = localDateKey();
  const todayOrders = orders.filter((order) => localDateKey(new Date(order.createdAt)) === today);
  const sales = todayOrders.reduce((sum, order) => sum + order.total, 0);
  const weight = todayOrders.reduce((sum, order) => sum + order.weightKg, 0);
  const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <>
    <div className="page-heading"><div><span className="eyebrow">Counter overview</span><h1>Good morning.</h1><p>Today's business, at a glance.</p></div><span className="date-tag"><CalendarDays size={15} />{new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}</span></div>
    <div className="dashboard-grid">
      <section className="panel sales-panel" data-testid="panel-today-sales"><span className="eyebrow">Today's sales</span><h2 data-testid="value-today-sales">{money(sales)}</h2><p>Based on orders recorded today</p>
        <div className="sales-foot"><div><strong data-testid="value-today-weight">{weight.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg</strong><span>Weight sold</span></div><div><strong data-testid="value-today-orders">{todayOrders.length}</strong><span>Orders today</span></div></div>
      </section>
      <section className="panel rate-card"><div><span className="eyebrow">Mandi rate · today</span><h2>Today's chicken rate</h2><span className="rate-value" data-testid="value-current-rate">{rates[today] ? `${money(rates[today])} / kg` : 'Not set'}</span></div><div className="rate-foot"><span>{rates[today] ? 'Ready for order entry' : 'Set a rate before taking an order'}</span><Link className="text-link" href="/workspace/rates" data-testid="link-set-rate">Manage <ArrowRight size={14} /></Link></div></section>
    </div>
    <div className="quick-actions">
      <Link href="/workspace/new-order" className="panel quick-action" data-testid="link-quick-new-order"><span className="quick-icon"><FilePlus2 size={19} /></span><span><b>Record an order</b><small>Customer, pieces and weight</small></span><ChevronRight size={17} /></Link>
      <Link href="/workspace/customers" className="panel quick-action" data-testid="link-quick-customers"><span className="quick-icon"><Store size={19} /></span><span><b>Customer directory</b><small>Manage shops and contacts</small></span><ChevronRight size={17} /></Link>
      <Link href="/workspace/history" className="panel quick-action" data-testid="link-quick-history"><span className="quick-icon"><BookOpen size={19} /></span><span><b>Order history</b><small>Browse all saved receipts</small></span><ChevronRight size={17} /></Link>
    </div>
    <div className="section-row"><h2>Recent orders</h2><Link className="text-link" href="/workspace/history" data-testid="link-view-all-orders">View history <ArrowRight size={14} /></Link></div>
    {sorted.length ? <OrderList orders={sorted.slice(0, 5)} /> : <EmptyState title="No orders recorded yet" copy="Your daily totals will take shape after your first saved order." action={<Link className="primary-button" href="/workspace/new-order" data-testid="link-first-order"><Plus size={16} /> Record first order</Link>} />}
  </>;
}
function PageHeading({ eyebrow, title, copy, trailing }: { eyebrow: string; title: string; copy: string; trailing?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>{trailing}</div>;
}
function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <section className="panel empty-state" data-testid="empty-state"><span className="empty-mark"><ClipboardList size={22} /></span><h3>{title}</h3><p>{copy}</p>{action}</section>;
}
function OrderList({ orders }: { orders: Order[] }) {
  const [, setLocation] = useLocation();
  return <div className="order-list" data-testid="list-orders">{orders.map((order) => <button className="panel order-row" key={order.id} type="button" onClick={() => setLocation(`/workspace/receipt/${order.id}`)} data-testid={`button-open-order-${order.id}`}>
    <span className="order-main"><span className="order-initial">{order.customer.shopName.slice(0, 1).toUpperCase()}</span><span><b>{order.customer.shopName}</b><small>{order.billNumber} · {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt))}</small></span></span>
    <span className="order-amount">{money(order.total)}</span><span className="order-weight">{order.quantity} pieces · {order.weightKg} kg</span>
  </button>)}</div>;
}

function CustomersRoute() {
  const { user } = useUser();
  return user ? <WorkspaceGate page={<CustomersPage userId={user.id} />} /> : <LoadingScreen />;
}
function CustomersPage({ userId }: { userId: string }) {
  const { customers, saveCustomers } = useFarmData(userId);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { shopName: '', ownerName: '', address: '', whatsapp: '' },
  });
  const visible = customers.filter((c) => `${c.shopName} ${c.ownerName} ${c.whatsapp}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.shopName.localeCompare(b.shopName));
  function begin(customer?: Customer) {
    setEditing(customer ?? null);
    form.reset(customer
      ? { shopName: customer.shopName, ownerName: customer.ownerName, address: customer.address, whatsapp: customer.whatsapp }
      : { shopName: '', ownerName: '', address: '', whatsapp: '' });
    setShowForm(true);
  }
  function submit(values: CustomerFormValues) {
    const next: Customer = { ...values, id: editing?.id ?? randomId() };
    saveCustomers(editing ? customers.map((c) => c.id === editing.id ? next : c) : [...customers, next]);
    setShowForm(false);
  }
  function remove(customer: Customer) {
    if (window.confirm(`Remove ${customer.shopName} from the directory? Existing receipts keep their saved customer details.`)) saveCustomers(customers.filter((c) => c.id !== customer.id));
  }
  return <>
    <PageHeading eyebrow="People & shops" title="Customer directory" copy="Keep your regular buyers and their contact details close." trailing={<button className="primary-button" type="button" onClick={() => begin()} data-testid="button-add-customer"><Plus size={16} /> Add customer</button>} />
    {showForm && <Form {...form}><form className="panel form-card" onSubmit={form.handleSubmit(submit)} noValidate data-testid="form-customer"><div className="section-row" style={{ marginTop: 0 }}><h2>{editing ? 'Edit customer' : 'Add a customer'}</h2><button type="button" className="icon-button" aria-label="Close form" onClick={() => setShowForm(false)} data-testid="button-close-customer-form"><X size={17} /></button></div>
      <div className="form-grid">
        <FormField control={form.control} name="shopName" render={({ field }) => <FormItem className="form-field"><FormLabel>Shop name *</FormLabel><FormControl><input {...field} placeholder="Shop or buyer name" data-testid="input-shop-name" /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="ownerName" render={({ field }) => <FormItem className="form-field"><FormLabel>Owner name *</FormLabel><FormControl><input {...field} placeholder="Contact person" data-testid="input-owner-name" /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="whatsapp" render={({ field }) => <FormItem className="form-field"><FormLabel>WhatsApp number *</FormLabel><FormControl><input {...field} type="tel" inputMode="tel" placeholder="Phone number" data-testid="input-customer-whatsapp" /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="address" render={({ field }) => <FormItem className="form-field"><FormLabel>Address *</FormLabel><FormControl><input {...field} placeholder="Area or delivery address" data-testid="input-customer-address" /></FormControl><FormMessage /></FormItem>} />
      </div><div className="form-actions"><button type="submit" className="primary-button" data-testid="button-save-customer">{editing ? 'Save changes' : 'Save customer'}</button><button type="button" className="secondary-button" onClick={() => setShowForm(false)} data-testid="button-cancel-customer">Cancel</button></div>
    </form></Form>}
    <div className="section-row"><h2>Saved customers <span className="pill" data-testid="text-customer-count">{customers.length}</span></h2></div>
    <div className="list-toolbar"><div className="searchbox"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search shops or contacts" aria-label="Search customers" data-testid="input-search-customers" /></div></div>
    {visible.length ? <><div className="table-head"><span>SHOP / OWNER</span><span>WHATSAPP</span><span>ADDRESS</span><span>ACTIONS</span></div>{visible.map((c) => <div className="panel customer-row" key={c.id} data-testid={`row-customer-${c.id}`}><div><b>{c.shopName}</b><small>{c.ownerName}</small></div><div><b>{c.whatsapp}</b><small>WhatsApp contact</small></div><div><b>{c.address || 'Address not added'}</b></div><div className="customer-actions"><button className="icon-button" type="button" onClick={() => begin(c)} aria-label={`Edit ${c.shopName}`} data-testid={`button-edit-customer-${c.id}`}><Edit3 size={15} /></button><button className="icon-button" type="button" onClick={() => remove(c)} aria-label={`Remove ${c.shopName}`} data-testid={`button-delete-customer-${c.id}`}><Trash2 size={15} /></button></div></div>)}</>
      : <EmptyState title={query ? 'No matching customers' : 'Your directory starts here'} copy={query ? 'Try a different shop name or contact.' : 'Add a saved customer before creating an order. No sample records are added.'} action={!query && <button type="button" className="primary-button" onClick={() => begin()} data-testid="button-empty-add-customer"><Plus size={16} /> Add customer</button>} />}
  </>;
}

function RatesRoute() {
  const { user } = useUser();
  return user ? <WorkspaceGate page={<RatesPage userId={user.id} />} /> : <LoadingScreen />;
}
function RatesPage({ userId }: { userId: string }) {
  const { rates, saveRates } = useFarmData(userId);
  const today = localDateKey();
  const [date, setDate] = useState(today);
  const [message, setMessage] = useState('');
  const form = useForm<RateFormValues>({
    resolver: zodResolver(rateSchema),
    defaultValues: { date: today, rate: rates[today] ? String(rates[today]) : '' },
  });
  const entries = Object.entries(rates).sort(([a], [b]) => b.localeCompare(a));
  function chooseDate(next: string) {
    setDate(next);
    form.setValue('date', next, { shouldValidate: true });
    form.setValue('rate', rates[next] ? String(rates[next]) : '', { shouldValidate: true });
    setMessage('');
  }
  function submit(values: RateFormValues) {
    const amount = Number(values.rate);
    saveRates({ ...rates, [values.date]: amount });
    setMessage(`Rate saved for ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(`${values.date}T12:00:00`))}.`);
  }
  return <>
    <PageHeading eyebrow="Daily market" title="Mandi rate" copy="Set the selling rate per kilogram for a local calendar day." />
    <div className="form-layout">
      <Form {...form}><form className="panel form-card" onSubmit={form.handleSubmit(submit)} noValidate data-testid="form-daily-rate"><h2>Chicken rate</h2><p className="form-help">Orders use today's saved rate and keep a permanent snapshot of it.</p>
        <FormField control={form.control} name="date" render={({ field }) => <FormItem className="form-field"><FormLabel>Calendar day *</FormLabel><FormControl><input {...field} type="date" value={date} onChange={(event) => chooseDate(event.target.value)} data-testid="input-rate-date" /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="rate" render={({ field }) => <FormItem className="form-field"><FormLabel>Rate per kilogram (INR) *</FormLabel><FormControl><input {...field} type="number" min="0.01" step="0.01" placeholder="Enter rate in rupees" data-testid="input-rate-amount" /></FormControl><FormMessage /></FormItem>} />
        {message && <p role="status" className="notice" data-testid="status-rate-saved">{message}</p>}
        <div className="form-actions"><button className="primary-button" type="submit" data-testid="button-save-rate"><Check size={16} /> Save rate</button><button className="secondary-button" type="button" onClick={() => chooseDate(today)} data-testid="button-select-today">Today's rate</button></div>
      </form></Form>
      <aside className="panel form-card"><span className="eyebrow">For today</span><h2 style={{ marginTop: 10 }}>Counter rate</h2><div className="rate-value" data-testid="value-today-rate">{rates[today] ? `${money(rates[today])} / kg` : 'Not set'}</div><p className="form-help">{rates[today] ? 'This is the frozen rate for orders created today.' : 'A rate is required before a new order can be saved.'}</p></aside>
    </div>
    <div className="section-row"><h2>Saved daily rates</h2></div>
    {entries.length ? <div className="order-list" data-testid="list-daily-rates">{entries.map(([day, amount]) => <button className="panel order-row" type="button" key={day} onClick={() => chooseDate(day)} data-testid={`button-edit-rate-${day}`}><span className="order-main"><span className="order-initial"><CalendarDays size={17} /></span><span><b>{day === today ? "Today's rate" : new Intl.DateTimeFormat('en-IN', { dateStyle: 'full' }).format(new Date(`${day}T12:00:00`))}</b><small>{day}</small></span></span><span className="order-amount">{money(amount)} / kg</span><span className="order-weight">Select to edit</span></button>)}</div>
      : <EmptyState title="No daily rates saved" copy="Save a rate for a day to make it available during order entry." />}
  </>;
}

function NewOrderRoute() {
  const { user } = useUser();
  return user ? <WorkspaceGate page={<NewOrderPage userId={user.id} />} /> : <LoadingScreen />;
}
function NewOrderPage({ userId }: { userId: string }) {
  const { customers, rates, orders, saveOrders } = useFarmData(userId);
  const [, setLocation] = useLocation();
  const today = localDateKey();
  const rate = rates[today];
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: { customerId: '', quantity: '', weight: '' },
  });
  const customerId = form.watch('customerId');
  const quantity = form.watch('quantity');
  const weight = form.watch('weight');
  const amount = Number(weight) * (rate || 0);
  const chosenCustomer = customers.find((c) => c.id === customerId);
  function submit(values: OrderFormValues) {
    const pieces = Number(quantity), kg = Number(weight);
    if (!customers.length) { form.setError('root', { type: 'manual', message: 'Add a customer to the directory before recording an order.' }); return; }
    if (!rate || rate <= 0) { form.setError('root', { type: 'manual', message: "Save today's mandi rate before recording an order." }); return; }
    if (!chosenCustomer) { form.setError('customerId', { type: 'manual', message: 'Select a saved customer.' }); return; }
    const now = new Date();
    const order: Order = {
      id: randomId(), billNumber: `RPF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Date.now()).slice(-5)}`,
      createdAt: now.toISOString(), customerId: values.customerId, customer: { ...chosenCustomer },
      quantity: pieces, weightKg: kg, ratePerKg: rate, total: Number((kg * rate).toFixed(2)),
    };
    saveOrders([order, ...orders]); setLocation(`/workspace/receipt/${order.id}`);
  }
  return <>
    <PageHeading eyebrow="Counter entry" title="New order" copy="Choose a saved customer, then record today's chicken order." />
    {!rate && <div className="notice" style={{ marginBottom: 15 }} data-testid="notice-rate-required">Today's mandi rate is not set. <Link className="text-link" href="/workspace/rates" data-testid="link-go-set-rate">Set today's rate <ArrowRight size={14} /></Link></div>}
    {!customers.length && <div className="notice" style={{ marginBottom: 15 }} data-testid="notice-customer-required">No saved customers yet. <Link className="text-link" href="/workspace/customers" data-testid="link-go-add-customer">Add a customer <ArrowRight size={14} /></Link></div>}
    <div className="form-layout">
      <Form {...form}><form className="panel form-card" onSubmit={form.handleSubmit(submit)} noValidate data-testid="form-new-order"><h2>Order details</h2>
        {form.formState.errors.root?.message && <div className="error-state" role="alert" data-testid="error-new-order">{form.formState.errors.root.message}</div>}
        <FormField control={form.control} name="customerId" render={({ field }) => <FormItem className="form-field"><FormLabel>Customer / shop *</FormLabel><FormControl><select {...field} data-testid="select-order-customer"><option value="">Select a saved customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.shopName} · {c.ownerName}</option>)}</select></FormControl><FormMessage /></FormItem>} />
        {chosenCustomer && <div className="notice" style={{ marginBottom: 15 }} data-testid="text-selected-customer">{chosenCustomer.ownerName} · {chosenCustomer.whatsapp}{chosenCustomer.address ? ` · ${chosenCustomer.address}` : ''}</div>}
        <div className="form-grid">
          <FormField control={form.control} name="quantity" render={({ field }) => <FormItem className="form-field"><FormLabel>Whole chicken quantity (pieces) *</FormLabel><FormControl><input {...field} type="number" min="1" step="1" placeholder="e.g. 12" data-testid="input-order-quantity" /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="weight" render={({ field }) => <FormItem className="form-field"><FormLabel>Total weight (kg) *</FormLabel><FormControl><input {...field} type="number" min="0.01" step="0.01" placeholder="Total order weight" data-testid="input-order-weight" /></FormControl><FormMessage /></FormItem>} />
        </div>
        <div className="amount-preview" aria-live="polite"><span><small>LIVE ORDER TOTAL</small><span className="form-help">{weight && rate ? `${weight} kg × ${money(rate)} / kg` : rate ? `${money(rate)} / kg today` : 'Set today’s rate to calculate'}</span></span><strong data-testid="value-live-order-total">{money(Number.isFinite(amount) ? amount : 0)}</strong></div>
        <div className="form-actions"><button className="primary-button" type="submit" disabled={!rate || !customers.length} data-testid="button-save-order"><Check size={16} /> Save order & receipt</button><Link className="secondary-button" href="/workspace" data-testid="link-cancel-order">Cancel</Link></div>
      </form></Form>
      <aside className="panel form-card"><span className="eyebrow">Today's rate</span><h2 style={{ marginTop: 10 }}>{rate ? money(rate) : 'Not set'}<span style={{ fontFamily: 'var(--app-font-sans)', fontSize: 13, color: '#888' }}>{rate ? ' / kg' : ''}</span></h2><p className="form-help">The order saves a frozen copy of this rate. Later daily changes do not alter existing receipts.</p><Link className="text-link" href="/workspace/rates" data-testid="link-edit-todays-rate"><Settings2 size={14} /> Manage daily rate</Link></aside>
    </div>
  </>;
}

function HistoryRoute() {
  const { user } = useUser();
  return user ? <WorkspaceGate page={<HistoryPage userId={user.id} />} /> : <LoadingScreen />;
}
function HistoryPage({ userId }: { userId: string }) {
  const { orders } = useFarmData(userId);
  const [query, setQuery] = useState('');
  const sorted = useMemo(() => [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [orders]);
  const visible = sorted.filter((o) => `${o.billNumber} ${o.customer.shopName} ${o.customer.ownerName}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeading eyebrow="Saved records" title="Order history" copy={`${orders.length} ${orders.length === 1 ? 'order' : 'orders'} recorded on this device.`} />
    <div className="list-toolbar"><div className="searchbox"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search bill, shop or owner" aria-label="Search orders" data-testid="input-search-orders" /></div><span className="pill" data-testid="text-history-count">{visible.length} shown</span></div>
    {visible.length ? <OrderList orders={visible} /> : <EmptyState title={query ? 'No matching orders' : 'No orders yet'} copy={query ? 'Try another bill number or customer.' : 'Saved orders will appear here newest first. Create an order to produce its receipt.'} action={!query && <Link className="primary-button" href="/workspace/new-order" data-testid="link-history-new-order"><Plus size={16} /> New order</Link>} />}
  </>;
}

function ReceiptRoute() {
  const { user } = useUser();
  return user ? <WorkspaceGate page={<ReceiptPage userId={user.id} />} /> : <LoadingScreen />;
}
function ReceiptPage({ userId }: { userId: string }) {
  const { id } = useParams<{ id: string }>();
  const { orders } = useFarmData(userId);
  const [status, setStatus] = useState('');
  const foundOrder = orders.find((o) => o.id === id);
  if (!foundOrder) return <><PageHeading eyebrow="Receipt" title="Receipt unavailable" copy="This order is not saved in this account's browser records." /><EmptyState title="No matching receipt" copy="It may have been cleared from this device. Existing user data is never shared across accounts." action={<Link className="primary-button" href="/workspace/history" data-testid="link-receipt-history"><ArrowLeft size={15} /> Order history</Link>} /></>;
  const order: Order = foundOrder;
  const date = new Date(order.createdAt);
  const phoneDigits = order.customer.whatsapp.replace(/\D/g, '');
  const whatsAppNumber = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
  const shareText = `${FARM}\n${TAGLINE}\nReceipt ${order.billNumber}\nShop: ${order.customer.shopName}\nOwner: ${order.customer.ownerName}\nDate: ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)}\nQuantity: ${order.quantity} pieces\nWeight: ${order.weightKg} kg\nRate: ${money(order.ratePerKg)} / kg\nTotal: ${money(order.total)}`;
  function shareWhatsApp() {
    if (!whatsAppNumber || whatsAppNumber.length < 10) { setStatus('This customer has no valid WhatsApp number. Edit the customer record to update it.'); return; }
    window.open(`https://wa.me/${whatsAppNumber}?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
    setStatus('WhatsApp opened with receipt details as text. Add the receipt image separately if needed.');
  }
  async function shareImage() {
    setStatus('Preparing receipt image…');
    try {
      const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 1320;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.fillStyle = '#fffdf8'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#a82f38'; ctx.fillRect(0, 0, canvas.width, 13);
      const image = new Image(); image.src = logoUrl;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Logo unavailable')); });
      ctx.drawImage(image, 75, 65, 150, 150);
      ctx.fillStyle = '#292e34'; ctx.font = 'bold 35px sans-serif'; ctx.fillText(FARM, 255, 119);
      ctx.fillStyle = '#a82f38'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(TAGLINE, 257, 153);
      ctx.strokeStyle = '#e8ded2'; ctx.beginPath(); ctx.moveTo(70, 250); ctx.lineTo(930, 250); ctx.stroke();
      ctx.fillStyle = '#a29a8f'; ctx.font = 'bold 17px sans-serif'; ctx.fillText('RECEIPT', 76, 300);
      ctx.fillStyle = '#303238'; ctx.font = 'bold 28px sans-serif'; ctx.fillText(order.billNumber, 76, 343);
      ctx.fillStyle = '#67696c'; ctx.font = '22px sans-serif'; ctx.fillText(new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date), 76, 390);
      const lines = [
        ['SHOP', order.customer.shopName], ['OWNER', order.customer.ownerName], ['WHATSAPP', order.customer.whatsapp],
        ['QUANTITY', `${order.quantity} pieces`], ['TOTAL WEIGHT', `${order.weightKg} kg`], ['RATE PER KG', `${money(order.ratePerKg)} / kg`],
      ];
      let y = 485;
      lines.forEach(([label, value]) => {
        ctx.fillStyle = '#9c958c'; ctx.font = 'bold 16px sans-serif'; ctx.fillText(label, 78, y);
        ctx.fillStyle = '#34373b'; ctx.font = 'bold 23px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(value, 920, y); ctx.textAlign = 'left';
        y += 80; ctx.strokeStyle = '#eee7dc'; ctx.beginPath(); ctx.moveTo(78, y - 34); ctx.lineTo(920, y - 34); ctx.stroke();
      });
      ctx.fillStyle = '#a82f38'; ctx.font = 'bold 23px sans-serif'; ctx.fillText('TOTAL AMOUNT', 78, 1010);
      ctx.textAlign = 'right'; ctx.font = 'bold 46px sans-serif'; ctx.fillText(money(order.total), 920, 1015); ctx.textAlign = 'left';
      ctx.fillStyle = '#89847d'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Thank you for your business.', 500, 1150); ctx.textAlign = 'left';
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not generate image')), 'image/png'));
      const file = new File([blob], `${order.billNumber}.png`, { type: 'image/png' });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: `${FARM} · ${order.billNumber}`, text: shareText, files: [file] });
        setStatus('Receipt image shared.');
      } else {
        const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${order.billNumber}.png`; anchor.click(); URL.revokeObjectURL(url);
        setStatus('Receipt image downloaded. Attach the downloaded image in your messaging app.');
      }
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to prepare receipt image. Try printing instead.'); }
  }
  return <div className="receipt-page">
    <div className="page-heading"><div><span className="eyebrow">Saved order · {order.billNumber}</span><h1>Order receipt</h1><p>Share or print a copy for your customer.</p></div><Link className="secondary-button" href="/workspace/history" data-testid="link-back-history"><ArrowLeft size={15} /> History</Link></div>
    <article className="receipt-paper" data-testid="receipt-order"><div className="receipt-accent" />
      <header className="receipt-brand"><img src={logoUrl} alt={`${FARM} logo`} data-testid="img-receipt-logo" /><div><b data-testid="text-receipt-brand">{FARM}</b><small data-testid="text-receipt-tagline">{TAGLINE}</small></div></header>
      <div className="receipt-meta"><div><small>BILL NUMBER</small><strong data-testid="value-bill-number">{order.billNumber}</strong></div><div style={{ textAlign: 'right' }}><small>DATE & TIME</small><strong data-testid="value-receipt-date">{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)}</strong></div></div>
      <section className="receipt-customer"><span className="receipt-section-label">CUSTOMER / SHOP</span><strong data-testid="value-receipt-shop">{order.customer.shopName}</strong><p data-testid="value-receipt-owner">{order.customer.ownerName} · {order.customer.whatsapp}{order.customer.address ? ` · ${order.customer.address}` : ''}</p></section>
      <div className="receipt-lines">
        <div className="receipt-line"><span>Whole chicken quantity</span><strong data-testid="value-receipt-quantity">{order.quantity} pieces</strong></div>
        <div className="receipt-line"><span>Total weight</span><strong data-testid="value-receipt-weight">{order.weightKg} kg</strong></div>
        <div className="receipt-line"><span>Rate per kilogram</span><strong data-testid="value-receipt-rate">{money(order.ratePerKg)} / kg</strong></div>
      </div>
      <div className="receipt-total"><span><small>TOTAL · WEIGHT × RATE</small><span className="sr-only">Calculated order total</span></span><strong data-testid="value-receipt-total">{money(order.total)}</strong></div>
      <footer className="receipt-footer">{TAGLINE}</footer>
    </article>
    <div className="receipt-actions">
      <button className="primary-button" type="button" onClick={shareWhatsApp} data-testid="button-share-whatsapp"><MessageCircle size={17} /> Share text on WhatsApp</button>
      <button className="secondary-button" type="button" onClick={shareImage} data-testid="button-share-image"><Download size={16} /> Share / download image</button>
      <button className="secondary-button" type="button" onClick={() => window.print()} data-testid="button-print-receipt"><Printer size={16} /> Print receipt</button>
    </div>
    {status && <p className="status-message" role="status" data-testid="status-receipt-share">{status}</p>}
    <div className="form-actions" style={{ justifyContent: 'center', marginTop: 14 }}><Link className="primary-button" href="/workspace/new-order" data-testid="link-create-another-order"><Plus size={16} /> Record another order</Link></div>
  </div>;
}
function LoadingScreen() {
  return <main className="app-shell loading-page" aria-label="Loading" data-testid="loading-screen"><div className="skeleton skeleton-block" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line" /><span className="sr-only">Loading farm workspace</span></main>;
}
function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to your farm account.' } }, signUp: { start: { title: 'Create your account', subtitle: 'Keep your poultry orders organized.' } } }}
    routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/workspace/receipt/:id" component={ReceiptRoute} />
      <Route path="/workspace/new-order" component={NewOrderRoute} />
      <Route path="/workspace/history" component={HistoryRoute} />
      <Route path="/workspace/customers" component={CustomersRoute} />
      <Route path="/workspace/rates" component={RatesRoute} />
      <Route path="/workspace" component={DashboardRoute} />
      <Route component={NotFound} />
    </Switch>
  </ClerkProvider>;
}
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><ClerkRoutes /></ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
