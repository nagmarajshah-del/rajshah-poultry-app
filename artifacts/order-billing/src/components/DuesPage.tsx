import { useMemo, useState, type FormEvent } from 'react';
import { Banknote, Check, CircleAlert, Clock3, CreditCard, IndianRupee, ReceiptText, UserRound, Wallet } from 'lucide-react';
import './dues-page.css';

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

export type DuesPayment = {
  id: string;
  customerName: string;
  amount: number;
  method: 'cash' | 'upi';
  recordedAt: string;
  allocations: { billNumber: string; amount: number }[];
};

export type RecordPaymentInput = {
  customerId: string;
  amount: number;
  method: 'cash' | 'upi';
};

export interface DuesPageProps {
  customers: DuesCustomer[];
  paymentHistory: DuesPayment[];
  onRecordPayment: (input: RecordPaymentInput) => string | null;
}

const money = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);

const dateTime = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

function oldestFirst(bills: DuesBill[]) {
  return [...bills].filter((bill) => bill.remainingDue > 0).sort((a, b) => {
    const byDate = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return byDate || a.billNumber.localeCompare(b.billNumber);
  });
}

export default function DuesPage({ customers, paymentHistory, onRecordPayment }: DuesPageProps) {
  const [customerId, setCustomerId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<'cash' | 'upi'>('cash');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const customer = customers.find((item) => item.id === customerId);
  const customerBills = useMemo(() => oldestFirst(customer?.openBills ?? []), [customer]);
  const outstandingCustomers = customers.filter((item) => item.totalDue > 0);
  const totalOutstanding = customers.reduce((sum, item) => sum + Math.max(0, item.totalDue), 0);
  const enteredAmount = Number(amountText);
  const canPreview = Number.isFinite(enteredAmount) && enteredAmount > 0 && !!customer;
  let amountLeft = canPreview ? enteredAmount : 0;
  const previewAllocations = customerBills.flatMap((bill) => {
    if (amountLeft <= 0) return [];
    const allocation = Math.min(bill.remainingDue, amountLeft);
    amountLeft = Number((amountLeft - allocation).toFixed(2));
    return allocation > 0 ? [{ ...bill, allocation }] : [];
  });

  const sortedHistory = useMemo(
    () => [...paymentHistory].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()),
    [paymentHistory],
  );

  function changeCustomer(nextId: string) {
    setCustomerId(nextId);
    setAmountText('');
    setError('');
    setSuccess('');
  }

  function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    const amount = Number(amountText);
    if (!customer) {
      setError('Select a customer before recording a payment.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (customer.totalDue <= 0) {
      setError('This customer has no outstanding balance to collect.');
      return;
    }
    if (amount > customer.totalDue) {
      setError(`Amount is more than the outstanding balance of ${money(customer.totalDue)}.`);
      return;
    }

    setSaving(true);
    try {
      const result = onRecordPayment({ customerId: customer.id, amount, method });
      if (result) {
        setError(result);
      } else {
        setSuccess(`${money(amount)} recorded for ${customer.name}. Allocated to oldest unpaid bills first.`);
        setAmountText('');
      }
    } catch {
      setError('Payment could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="dues-page" data-testid="page-customer-dues">
      <header className="dues-heading">
        <div>
          <span className="dues-eyebrow">Collections & balances</span>
          <h1>Customer dues</h1>
          <p>Record a payment and keep every bill accounted for.</p>
        </div>
        <div className="dues-total-chip" data-testid="value-total-outstanding">
          <span className="dues-total-icon"><IndianRupee size={17} /></span>
          <span><small>Outstanding total</small><strong>{money(totalOutstanding)}</strong></span>
        </div>
      </header>

      {!customers.length ? (
        <section className="dues-empty panel" data-testid="empty-dues-no-customers">
          <span className="dues-empty-mark"><UserRound size={22} /></span>
          <h2>No customers to collect from</h2>
          <p>Saved customer records will appear here when they have a balance to settle.</p>
        </section>
      ) : (
        <div className="dues-layout">
          <section className="dues-collection panel">
            <div className="dues-card-heading">
              <span className="dues-step">01</span>
              <div><h2>Record collection</h2><p>Choose who paid, then enter the amount received.</p></div>
            </div>

            {!outstandingCustomers.length && (
              <div className="dues-clear-notice" role="status" data-testid="notice-no-outstanding-dues">
                <Check size={17} /><span>All customer balances are clear. There are no dues to collect.</span>
              </div>
            )}

            <form onSubmit={recordPayment} noValidate data-testid="form-record-payment">
              <label className="dues-field">
                <span>Customer</span>
                <select value={customerId} onChange={(event) => changeCustomer(event.target.value)} data-testid="select-dues-customer">
                  <option value="">Select a customer</option>
                  {customers.map((item) => (
                    <option value={item.id} key={item.id}>{item.name} · {money(item.totalDue)} due</option>
                  ))}
                </select>
              </label>

              {customer && (
                <div className="dues-customer-identity" data-testid={`identity-dues-customer-${customer.id}`}>
                  <span className="dues-avatar">{customer.name.trim().slice(0, 1).toUpperCase()}</span>
                  <div><strong>{customer.name}</strong><span>{customer.phone}</span></div>
                  <b>{money(customer.totalDue)}<small> outstanding</small></b>
                </div>
              )}

              <label className="dues-field">
                <span>Amount received <small>INR</small></span>
                <div className="dues-amount-input">
                  <span aria-hidden="true">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    max={customer?.totalDue ?? undefined}
                    placeholder="0.00"
                    value={amountText}
                    onChange={(event) => { setAmountText(event.target.value); setError(''); setSuccess(''); }}
                    disabled={!customer || customer.totalDue <= 0}
                    data-testid="input-payment-amount"
                  />
                </div>
              </label>

              <fieldset className="dues-method">
                <legend>Payment method</legend>
                <div className="dues-method-options">
                  <button type="button" aria-pressed={method === 'cash'} className={method === 'cash' ? 'selected' : ''} onClick={() => setMethod('cash')} data-testid="button-method-cash">
                    <Banknote size={17} /> Cash
                  </button>
                  <button type="button" aria-pressed={method === 'upi'} className={method === 'upi' ? 'selected' : ''} onClick={() => setMethod('upi')} data-testid="button-method-upi">
                    <CreditCard size={17} /> UPI
                  </button>
                </div>
              </fieldset>

              {error && <div className="dues-feedback dues-feedback-error" role="alert" data-testid="error-record-payment"><CircleAlert size={16} />{error}</div>}
              {success && <div className="dues-feedback dues-feedback-success" role="status" data-testid="status-payment-saved"><Check size={16} />{success}</div>}

              <button className="dues-submit" type="submit" disabled={saving || !customer || customer.totalDue <= 0} data-testid="button-record-payment">
                <Check size={17} />{saving ? 'Saving payment…' : 'Record payment'}
              </button>
            </form>
          </section>

          <section className="dues-allocation panel" aria-live="polite" data-testid="section-fifo-allocation">
            <div className="dues-card-heading">
              <span className="dues-step dues-step-muted">02</span>
              <div><h2>Bill allocation</h2><p>FIFO · oldest unpaid bill is cleared first.</p></div>
            </div>

            {!customer ? (
              <div className="dues-allocation-empty" data-testid="empty-allocation-select-customer">
                <ReceiptText size={21} /><span>Select a customer to see their unpaid bills.</span>
              </div>
            ) : !customerBills.length ? (
              <div className="dues-allocation-empty" data-testid="empty-allocation-no-bills">
                <Check size={21} /><span>{customer.name} has no outstanding bills.</span>
              </div>
            ) : (
              <>
                <div className="dues-fifo-note"><Clock3 size={14} /> Bills shown oldest to newest</div>
                <div className="dues-bill-list">
                  {customerBills.map((bill, index) => {
                    const allocation = previewAllocations.find((item) => item.id === bill.id)?.allocation ?? 0;
                    return (
                      <div className={`dues-bill-row ${allocation > 0 ? 'has-allocation' : ''}`} key={bill.id} data-testid={`row-allocation-${bill.id}`}>
                        <span className="dues-bill-order">{String(index + 1).padStart(2, '0')}</span>
                        <span className="dues-bill-main"><strong>{bill.billNumber}</strong><small>{dateTime(bill.createdAt)}</small></span>
                        <span className="dues-bill-values"><b>{money(bill.remainingDue)}</b><small>due</small></span>
                        <span className="dues-bill-allocation">{allocation > 0 ? <><small>Apply</small><b>{money(allocation)}</b></> : <span>—</span>}</span>
                      </div>
                    );
                  })}
                </div>
                {canPreview && (
                  <div className="dues-allocation-total" data-testid="value-payment-allocation-total">
                    <span>Payment allocated</span><strong>{money(enteredAmount - Math.max(0, amountLeft))}</strong>
                  </div>
                )}
                {canPreview && amountLeft > 0 && (
                  <p className="dues-overflow-hint" data-testid="notice-unallocated-amount">
                    {money(amountLeft)} remains beyond the listed bill balances. Check the customer balance before saving.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <section className="dues-balances-section">
        <div className="dues-section-title">
          <div><span className="dues-eyebrow">Who still owes</span><h2>Outstanding balances</h2></div>
          <span className="dues-count" data-testid="text-outstanding-customer-count">{outstandingCustomers.length} {outstandingCustomers.length === 1 ? 'customer' : 'customers'}</span>
        </div>
        {outstandingCustomers.length ? (
          <div className="dues-balance-list" data-testid="list-outstanding-balances">
            {[...outstandingCustomers].sort((a, b) => b.totalDue - a.totalDue).map((item) => (
              <button type="button" className={`dues-balance-row ${customerId === item.id ? 'active' : ''}`} onClick={() => changeCustomer(item.id)} key={item.id} data-testid={`button-select-balance-customer-${item.id}`}>
                <span className="dues-avatar">{item.name.trim().slice(0, 1).toUpperCase()}</span>
                <span className="dues-balance-name"><strong>{item.name}</strong><small>{item.phone}</small></span>
                <span className="dues-balance-bills">{item.openBills.filter((bill) => bill.remainingDue > 0).length} unpaid {item.openBills.filter((bill) => bill.remainingDue > 0).length === 1 ? 'bill' : 'bills'}</span>
                <strong className="dues-balance-value">{money(item.totalDue)}</strong>
              </button>
            ))}
          </div>
        ) : (
          <div className="dues-all-clear" data-testid="empty-outstanding-balances"><Check size={18} />All customer balances are settled.</div>
        )}
      </section>

      <section className="dues-history-section">
        <div className="dues-section-title">
          <div><span className="dues-eyebrow">Recent collections</span><h2>Payment history</h2></div>
          <span className="dues-count" data-testid="text-payment-history-count">{paymentHistory.length} {paymentHistory.length === 1 ? 'payment' : 'payments'}</span>
        </div>
        {sortedHistory.length ? (
          <div className="dues-history-list" data-testid="list-payment-history">
            {sortedHistory.map((payment) => (
              <article className="dues-history-row" key={payment.id} data-testid={`row-payment-history-${payment.id}`}>
                <span className="dues-history-icon">{payment.method === 'cash' ? <Wallet size={17} /> : <CreditCard size={17} />}</span>
                <span className="dues-history-main"><strong>{payment.customerName}</strong><small>{dateTime(payment.recordedAt)} · {payment.method === 'cash' ? 'Cash' : 'UPI'}</small></span>
                <span className="dues-history-allocation">{payment.allocations.map((allocation) => <small key={allocation.billNumber}>{allocation.billNumber} <b>{money(allocation.amount)}</b></small>)}</span>
                <strong className="dues-history-amount">−{money(payment.amount)}</strong>
              </article>
            ))}
          </div>
        ) : (
          <div className="dues-history-empty" data-testid="empty-payment-history"><ReceiptText size={19} /><span>No payments recorded yet. Your collections will appear here.</span></div>
        )}
      </section>
    </main>
  );
}
