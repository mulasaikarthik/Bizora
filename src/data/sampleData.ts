/* FICTIONAL SAMPLE DATA — for demonstration only */

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Partially paid';
export type PaymentMethod = 'Bank transfer' | 'Card' | 'Cash' | 'PayPal';
export type ExpenseCategory = 'Gear' | 'Travel' | 'Software' | 'Studio rent' | 'Marketing' | 'Insurance';

export const INVOICE_STATUSES: InvoiceStatus[] = ['Draft', 'Sent', 'Partially paid', 'Paid', 'Overdue'];
export const PAYMENT_METHODS: PaymentMethod[] = ['Bank transfer', 'Card', 'Cash', 'PayPal'];
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['Gear', 'Travel', 'Software', 'Studio rent', 'Marketing', 'Insurance'];

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: InvoiceStatus;
  items: LineItem[];
  taxRate: number; // percent
  notes: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
}

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  vendor: string;
  amount: number;
  receipt?: string; // filename only
}

export interface Shoot {
  id: string;
  title: string;
  date: string;
  clientId: string;
  location: string;
}

export interface Notification {
  id: string;
  text: string;
  date: string;
  read: boolean;
}

export interface Settings {
  businessName: string;
  address: string;
  taxNumber: string;
  currency: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  paymentTermsDays: number;
  defaultTaxRate: number;
  notifyPaymentReceived: boolean;
  notifyOverdue: boolean;
  notifyShootReminders: boolean;
  reducedMotionOverride: boolean;
}

export interface SampleData {
  clients: Client[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  shoots: Shoot[];
  notifications: Notification[];
  settings: Settings;
}

/* Dates are generated relative to today so the sample always looks current. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const TODAY = new Date();
const day = (offset: number): string => ymd(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + offset));
const monthsAgo = (months: number, dayOfMonth: number): string =>
  ymd(new Date(TODAY.getFullYear(), TODAY.getMonth() - months, dayOfMonth));

const clients: Client[] = [
  { id: 'cl-1', name: 'Mara Lindqvist', company: 'Lindqvist & Co. Interiors', email: 'mara.lindqvist@example.test', phone: '+1 555 010 2201', address: '18 Alder Street, Portland, OR' },
  { id: 'cl-2', name: 'Tomas Reyes', company: 'Reyes Architects', email: 'tomas@reyes-arch.example.test', phone: '+1 555 010 2202', address: '240 Canal Road, Seattle, WA' },
  { id: 'cl-3', name: 'Priya Nair', company: 'Nair Hospitality Group', email: 'priya.nair@example.test', phone: '+1 555 010 2203', address: '9 Harbor Plaza, San Diego, CA' },
  { id: 'cl-4', name: 'Jonas Whitfield', company: 'Whitfield Outdoor Co.', email: 'jonas@whitfield-outdoor.example.test', phone: '+1 555 010 2204', address: '77 Ridge Lane, Boise, ID' },
  { id: 'cl-5', name: 'Elena Marsh', company: 'Marsh Bakehouse', email: 'elena@marshbakehouse.example.test', phone: '+1 555 010 2205', address: '5 Millrace Court, Eugene, OR' },
  { id: 'cl-6', name: 'Daniel Okafor', company: 'Okafor Fitness Studio', email: 'daniel.okafor@example.test', phone: '+1 555 010 2206', address: '312 Pine Avenue, Tacoma, WA' },
  { id: 'cl-7', name: 'Hana Sato', company: 'Sato Ceramics', email: 'hana@satoceramics.example.test', phone: '+1 555 010 2207', address: '41 Kiln Way, Bend, OR' },
  { id: 'cl-8', name: 'Rafael Duarte', company: 'Duarte Realty Partners', email: 'rafael@duarte-realty.example.test', phone: '+1 555 010 2208', address: '600 Summit Drive, Reno, NV' },
];

const item = (id: string, description: string, quantity: number, rate: number): LineItem => ({ id, description, quantity, rate });

const invoices: Invoice[] = [
  { id: 'inv-1', number: 'INV-1030', clientId: 'cl-1', issueDate: monthsAgo(4, 2), dueDate: monthsAgo(4, 16), status: 'Paid', taxRate: 8, notes: 'Thank you for the brand session.', items: [item('i1', 'Brand portrait session', 1, 1200), item('i2', 'Retouching (per image)', 12, 45)] },
  { id: 'inv-2', number: 'INV-1031', clientId: 'cl-2', issueDate: monthsAgo(3, 5), dueDate: monthsAgo(3, 19), status: 'Paid', taxRate: 8, notes: '', items: [item('i3', 'Architecture shoot, half day', 1, 850), item('i4', 'Usage licence, 12 months', 1, 300)] },
  { id: 'inv-3', number: 'INV-1032', clientId: 'cl-3', issueDate: day(-75), dueDate: day(-61), status: 'Partially paid', taxRate: 8, notes: 'Second payment due on delivery.', items: [item('i5', 'Hotel lobby photography', 2, 650), item('i6', 'Travel and second unit', 1, 180)] },
  { id: 'inv-4', number: 'INV-1033', clientId: 'cl-4', issueDate: day(-60), dueDate: day(-46), status: 'Overdue', taxRate: 8, notes: '', items: [item('i7', 'Product catalogue, per product', 24, 60), item('i8', 'Studio setup', 1, 150)] },
  { id: 'inv-5', number: 'INV-1034', clientId: 'cl-5', issueDate: day(-45), dueDate: day(-31), status: 'Overdue', taxRate: 0, notes: 'Menu shoot, rush delivery.', items: [item('i9', 'Bakery menu shoot', 1, 700)] },
  { id: 'inv-6', number: 'INV-1035', clientId: 'cl-6', issueDate: day(-30), dueDate: day(-16), status: 'Sent', taxRate: 8, notes: '', items: [item('i10', 'Class coverage, evening session', 1, 900), item('i11', 'Social cut-downs', 6, 80)] },
  { id: 'inv-7', number: 'INV-1036', clientId: 'cl-7', issueDate: day(-20), dueDate: day(-6), status: 'Paid', taxRate: 8, notes: '', items: [item('i12', 'Product portraits', 8, 120)] },
  { id: 'inv-8', number: 'INV-1037', clientId: 'cl-8', issueDate: day(-12), dueDate: day(2), status: 'Sent', taxRate: 8, notes: 'Listing photos for spring release.', items: [item('i13', 'Property listing photos', 1, 1400), item('i14', 'Aerial add-on', 1, 350)] },
  { id: 'inv-9', number: 'INV-1038', clientId: 'cl-1', issueDate: day(-8), dueDate: day(6), status: 'Sent', taxRate: 8, notes: '', items: [item('i15', 'Showroom detail series', 1, 980)] },
  { id: 'inv-10', number: 'INV-1039', clientId: 'cl-3', issueDate: day(-5), dueDate: day(9), status: 'Draft', taxRate: 8, notes: '', items: [item('i16', 'Rooftop bar campaign', 1, 2100)] },
  { id: 'inv-11', number: 'INV-1040', clientId: 'cl-2', issueDate: day(-2), dueDate: day(12), status: 'Paid', taxRate: 8, notes: '', items: [item('i17', 'Competition boards, retouch', 1, 640)] },
  { id: 'inv-12', number: 'INV-1041', clientId: 'cl-5', issueDate: day(-1), dueDate: day(13), status: 'Draft', taxRate: 0, notes: '', items: [item('i18', 'Seasonal menu refresh', 1, 520)] },
  { id: 'inv-13', number: 'INV-1042', clientId: 'cl-6', issueDate: day(-40), dueDate: day(-26), status: 'Partially paid', taxRate: 8, notes: '', items: [item('i19', 'Instructor headshots', 10, 65)] },
  { id: 'inv-14', number: 'INV-1043', clientId: 'cl-4', issueDate: day(0), dueDate: day(14), status: 'Draft', taxRate: 8, notes: '', items: [item('i20', 'Spring lookbook, day rate', 2, 780)] },
];

const payments: Payment[] = [
  { id: 'pay-1', invoiceId: 'inv-1', amount: 1296, date: monthsAgo(4, 12), method: 'Bank transfer' },
  { id: 'pay-2', invoiceId: 'inv-2', amount: 1242, date: monthsAgo(3, 15), method: 'Card' },
  { id: 'pay-3', invoiceId: 'inv-3', amount: 1000, date: day(-58), method: 'Bank transfer' },
  { id: 'pay-4', invoiceId: 'inv-7', amount: 1036.8, date: day(-9), method: 'PayPal' },
  { id: 'pay-5', invoiceId: 'inv-11', amount: 691.2, date: day(-1), method: 'Card' },
  { id: 'pay-6', invoiceId: 'inv-13', amount: 300, date: day(-22), method: 'Cash' },
  { id: 'pay-7', invoiceId: 'inv-5', amount: 0, date: day(-60), method: 'Card' },
];
// Keep only real payments (the zero-amount entry above is removed so totals stay clean).
const realPayments = payments.filter((p) => p.amount > 0);

const expenseSeed: Array<[number, ExpenseCategory, string, number, string | undefined]> = [
  [0, 'Software', 'Lightroom subscription', 22.99, undefined],
  [2, 'Studio rent', 'Eastside studio, monthly', 1150, undefined],
  [4, 'Gear', 'Replacement flash trigger', 189, 'trigger-receipt.pdf'],
  [6, 'Travel', 'Fuel, coastal shoot', 74.5, undefined],
  [9, 'Insurance', 'Equipment cover, quarterly', 310, 'policy-q2.pdf'],
  [12, 'Marketing', 'Portfolio website hosting', 36, undefined],
  [15, 'Software', 'Cloud storage, 2 TB', 9.99, undefined],
  [18, 'Studio rent', 'Eastside studio, monthly', 1150, undefined],
  [24, 'Gear', 'Backdrop paper, 3 rolls', 96, 'backdrop-order.pdf'],
  [28, 'Travel', 'Train tickets, client site', 128, undefined],
  [33, 'Marketing', 'Printed promo cards', 142, undefined],
  [39, 'Software', 'Lightroom subscription', 22.99, undefined],
  [45, 'Studio rent', 'Eastside studio, monthly', 1150, undefined],
  [52, 'Gear', 'Lens cleaning kit', 48, undefined],
  [61, 'Travel', 'Hotel, two nights', 260, 'hotel-folio.pdf'],
  [70, 'Marketing', 'Paid social campaign', 210, undefined],
  [78, 'Software', 'Culling and proofing app', 39, undefined],
  [85, 'Studio rent', 'Eastside studio, monthly', 1150, undefined],
  [96, 'Insurance', 'Public liability, annual', 420, undefined],
  [110, 'Gear', 'Memory cards, 4-pack', 118, undefined],
  [124, 'Travel', 'Parking, city shoots', 36, undefined],
  [140, 'Marketing', 'Business cards', 64, undefined],
  [160, 'Software', 'Accounting add-on', 16, undefined],
  [175, 'Gear', 'Strobe modifier set', 265, 'modifier-invoice.pdf'],
  [200, 'Studio rent', 'Eastside studio, monthly', 1150, undefined],
  [240, 'Travel', 'Rental van, day hire', 140, undefined],
  [290, 'Gear', 'Tripod head', 185, undefined],
  [320, 'Marketing', 'Directory listing', 75, undefined],
];

const expenses: Expense[] = expenseSeed.map(([ago, category, vendor, amount, receipt], i) => ({
  id: `exp-${i + 1}`,
  date: day(-ago),
  category,
  vendor,
  amount,
  receipt,
}));

const shoots: Shoot[] = [
  { id: 'sh-1', title: 'Lookbook day 1', date: day(1), clientId: 'cl-4', location: 'Ridge Lane trailhead' },
  { id: 'sh-2', title: 'Showroom detail series', date: day(3), clientId: 'cl-1', location: 'Alder Street showroom' },
  { id: 'sh-3', title: 'Bakery menu flat lays', date: day(5), clientId: 'cl-5', location: 'Millrace Court kitchen' },
  { id: 'sh-4', title: 'Rooftop campaign scout', date: day(9), clientId: 'cl-3', location: 'Harbor Plaza, roof level' },
];

const notifications: Notification[] = [
  { id: 'n-1', text: 'INV-1033 is 46 days overdue for Whitfield Outdoor Co.', date: day(0), read: false },
  { id: 'n-2', text: 'Payment of $1,036.80 received from Sato Ceramics', date: day(-9), read: false },
  { id: 'n-3', text: 'Shoot reminder: Lookbook day 1 tomorrow', date: day(0), read: false },
  { id: 'n-4', text: 'INV-1037 was viewed by Duarte Realty Partners', date: day(-2), read: true },
];

const settings: Settings = {
  businessName: 'Northlight Studio (sample)',
  address: '12 Foundry Lane, Suite 3, Portland, OR 97209',
  taxNumber: 'US-TAX-000-000 (sample)',
  currency: 'USD',
  invoicePrefix: 'INV-',
  nextInvoiceNumber: 1043,
  paymentTermsDays: 14,
  defaultTaxRate: 8,
  notifyPaymentReceived: true,
  notifyOverdue: true,
  notifyShootReminders: true,
  reducedMotionOverride: false,
};

export const SAMPLE_DATA: SampleData = {
  clients,
  invoices,
  payments: realPayments,
  expenses,
  shoots,
  notifications,
  settings,
};
