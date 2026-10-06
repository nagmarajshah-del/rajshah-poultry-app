import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, IndianRupee, Wallet } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export type DuesPaymentMethod = 'cash' | 'upi';
export type DuesBill = {
  id: string;
  billNumber: string;
  createdAt: string;
  total: number;
  paidAmount: number;
  remainingDue: number;
};
export type DuesCustomer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalDue: number;
  openBills: DuesBill[];
};
export type DuesPaymentHistoryItem = {
  id: string;
  customerName: string;
  amount: number;
  method: DuesPaymentMethod;
  recordedAt: string;
  allocations: { billNumber: string; amount: number }[];
};
export type RecordDuesPaymentInput = { customerId: string; amount: number; method: DuesPaymentMethod };
export type DuesLedgerPageProps = {
  customers: DuesCustomer[];
  paymentHistory: DuesPaymentHistoryItem[];
  onRecordPayment: (input: RecordDuesPaymentInput) => string | null;
};

const formSchema = z.object({
  customerId: z.string().min(1, 'Choose a customer with unpaid bills.'),
  amount: z.string().refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, 'Enter an amount greater than zero.'),
  method: z.enum(['cash', 'upi']),
});
type FormValues = z.infer<typeof formSchema>;
const money = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
const formatDate = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function DuesLedgerPage({ customers, paymentHistory, onRecordPayment }: DuesLedgerPageProps) {
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { customerId: '', amount: '', method: 'cash' },
  });
  const selectedCustomerId = form.watch('customerId');
  const amountValue = Number(form.watch('amount')) || 0;
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const balances = useMemo(() => [...customers].sort((a, b) => a.name.localeCompare(b.name)), [customers]);
  const allocations = useMemo(() => {
    if (!selectedCustomer || amountValue <= 0) return [];
    let remaining = amountValue;
    return [...selectedCustomer.openBills]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.billNumber.localeCompare(b.billNumber))
      .flatMap((bill) => {
        if (remaining <= 0) return [];
        const allocated = Math.min(remaining, bill.remainingDue);
        remaining = Math.max(0, Math.round((remaining - allocated) * 100) / 100);
        return allocated > 0 ? [{ billNumber: bill.billNumber, amount: allocated }] : [];
      });
  }, [amountValue, selectedCustomer]);
  const exceedsBalance = Boolean(selectedCustomer && amountValue > selectedCustomer.totalDue + 0.001);

  function submit(values: FormValues) {
    const amount = Math.round(Number(values.amount) * 100) / 100;
    const error = onRecordPayment({ customerId: values.customerId, amount, method: values.method });
    if (error) {
      setNotice({ kind: 'error', text: error });
      return;
    }
    setNotice({ kind: 'success', text: `Payment of ${money(amount)} recorded and allocated to the oldest unpaid bill(s).` });
    form.reset({ customerId: values.customerId, amount: '', method: values.method });
  }

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">Customer accounts</span><h1>Customer dues & payments</h1><p>Record cash or UPI collections and keep each bill balance up to date.</p></div>
      <span className="date-tag"><Wallet size={15} /> Oldest bills paid first</span>
    </div>

    <div className="dues-summary-grid">
      <section className="panel dues-total-card" data-testid="panel-total-customer-dues">
        <span className="eyebrow">Total pending</span>
        <strong data-testid="value-total-customer-dues">{money(customers.reduce((sum, customer) => sum + customer.totalDue, 0))}</strong>
        <small>Across {customers.length} customer{customers.length === 1 ? '' : 's'} with open bills</small>
      </section>
      <section className="panel dues-total-card dues-count-card" data-testid="panel-customer-dues-count">
        <span className="eyebrow">Open accounts</span>
        <strong data-testid="value-customer-dues-count">{customers.length}</strong>
        <small>Payments are applied to the oldest unpaid bills first.</small>
      </section>
    </div>

    <div className="dues-layout">
      <section className="panel form-card" aria-labelledby="record-payment-title">
        <h2 id="record-payment-title">Record a later payment</h2>
        <p className="form-help">A collection is automatically applied to this customer’s oldest outstanding bill first.</p>
        {!balances.length
          ? <div className="notice" data-testid="notice-no-customer-dues">No customer balances are currently due.</div>
          : <Form {...form}><form onSubmit={form.handleSubmit(submit)} noValidate data-testid="form-record-customer-payment">
            <FormField control={form.control} name="customerId" render={({ field }) => <FormItem className="form-field">
              <FormLabel>Customer *</FormLabel>
              <FormControl><select {...field} data-testid="select-dues-customer">
                <option value="">Select a customer with dues</option>
                {balances.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · Due {money(customer.totalDue)}</option>)}
              </select></FormControl>
              <FormMessage />
            </FormItem>} />
            {selectedCustomer && <div className="dues-selected-customer" data-testid="text-selected-dues-customer">
              <b>{selectedCustomer.name}</b><span>{selectedCustomer.phone}</span><strong>Outstanding: {money(selectedCustomer.totalDue)}</strong>
            </div>}
            <div className="form-grid">
              <FormField control={form.control} name="amount" render={({ field }) => <FormItem className="form-field">
                <FormLabel>Amount received *</FormLabel>
                <FormControl><input {...field} type="number" inputMode="decimal" min="0.01" max={selectedCustomer?.totalDue} step="0.01" placeholder="Enter amount" data-testid="input-dues-payment-amount" /></FormControl>
                <FormMessage />
              </FormItem>} />
              <FormField control={form.control} name="method" render={({ field }) => <FormItem className="form-field">
                <FormLabel>Payment method *</FormLabel>
                <FormControl><select {...field} data-testid="select-dues-payment-method"><option value="cash">Cash</option><option value="upi">UPI</option></select></FormControl>
                <FormMessage />
              </FormItem>} />
            </div>
            {selectedCustomer && amountValue > 0 && <div className="dues-allocation-preview" aria-live="polite" data-testid="panel-payment-allocation-preview">
              <b>Payment allocation · oldest bill first</b>
              {exceedsBalance
                ? <p className="dues-error" role="alert">This amount is more than the customer’s outstanding balance.</p>
                : allocations.map((allocation) => <div className="dues-allocation-row" key={allocation.billNumber}><span>{allocation.billNumber}</span><strong>{money(allocation.amount)}</strong></div>)}
            </div>}
            {notice && <p className={notice.kind === 'success' ? 'notice dues-success' : 'error-state'} role={notice.kind === 'success' ? 'status' : 'alert'} data-testid={`status-dues-payment-${notice.kind}`}>{notice.text}</p>}
            <div className="form-actions"><button className="primary-button" type="submit" disabled={!balances.length || exceedsBalance} data-testid="button-save-dues-payment"><Check size={16} /> Record payment</button></div>
          </form></Form>}
      </section>

      <section className="panel form-card" aria-labelledby="outstanding-title">
        <div className="section-row" style={{ marginTop: 0 }}><h2 id="outstanding-title">Outstanding by customer</h2></div>
        {balances.length
          ? <div className="dues-customer-list" data-testid="list-customer-outstanding">{balances.map((customer) => <details className="dues-customer-item" key={customer.id} data-testid={`row-customer-outstanding-${customer.id}`}>
            <summary><span><b>{customer.name}</b><small>{customer.phone}</small></span><strong>{money(customer.totalDue)}</strong></summary>
            <div className="dues-open-bills">{customer.openBills.map((bill) => <div className="dues-open-bill" key={bill.id} data-testid={`row-open-due-bill-${bill.id}`}>
              <span><b>{bill.billNumber}</b><small>{formatDate(bill.createdAt)} · Paid {money(bill.paidAmount)}</small></span><strong>{money(bill.remainingDue)}</strong>
            </div>)}</div>
          </details>)}</div>
          : <div className="empty-state"><span className="empty-mark"><IndianRupee size={22} /></span><h3>All accounts are clear</h3><p>New unpaid or partial bills will appear here.</p></div>}
      </section>
    </div>

    <div className="section-row"><h2>Payment collection history</h2><span className="pill" data-testid="text-ledger-payment-count">{paymentHistory.length} collections</span></div>
    {paymentHistory.length
      ? <div className="dues-history-list" data-testid="list-customer-payment-history">{paymentHistory.map((payment) => <article className="panel dues-history-row" key={payment.id} data-testid={`row-ledger-payment-${payment.id}`}>
        <div className="dues-history-main"><b>{payment.customerName}</b><small>{formatDate(payment.recordedAt)} · {payment.method === 'cash' ? 'Cash' : 'UPI'}</small></div>
        <strong>{money(payment.amount)}</strong>
        <div className="dues-history-allocation"><span>Applied to</span>{payment.allocations.length ? payment.allocations.map((allocation) => <small key={allocation.billNumber}>{allocation.billNumber}: {money(allocation.amount)}</small>) : <small>No bill allocation saved</small>}</div>
      </article>)}</div>
      : <div className="panel empty-state"><span className="empty-mark"><IndianRupee size={22} /></span><h3>No later payments recorded</h3><p>Payments collected after a bill is created will appear here with their allocations.</p></div>}
  </>;
}
