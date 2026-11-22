-- ==============================================================================
-- BIZORA DATABASE MIGRATION - INITIAL SCHEMA
-- Comprehensive schema for Freelance Business Management Platform
-- Includes 10 Normalized Tables, Constraints, Indexes, Triggers, and RLS Policies
-- ==============================================================================

-- 0. Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ==============================================================================
-- 1. TABLE: profiles (user profile and business info)
-- ==============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  business_name text not null default '',
  avatar_url text default '',
  phone text default '',
  website text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- 2. TABLE: business_settings (currency, tax rates, invoice preferences)
-- ==============================================================================
create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  currency text not null default 'USD',
  tax_number text default '',
  invoice_prefix text not null default 'INV-',
  next_invoice_number integer not null default 1001,
  payment_terms_days integer not null default 14 check (payment_terms_days >= 0),
  default_tax_rate numeric(5, 2) not null default 8.5 check (default_tax_rate >= 0 and default_tax_rate <= 100),
  payment_instructions text default 'Please remit payment within agreed terms. Bank ACH details or card links accepted.',
  email_notifications boolean not null default true,
  payment_alerts boolean not null default true,
  reduced_motion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- 3. TABLE: clients (customer records)
-- ==============================================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text default '',
  email text not null,
  phone text default '',
  address text default '',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- 4. TABLE: invoices (invoice metadata, dates, statuses)
-- ==============================================================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  number text not null,
  issue_date date not null default current_date,
  due_date date not null,
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Partially paid', 'Paid', 'Overdue')),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  notes text default '',
  last_reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_user_invoice_number unique(user_id, number)
);

-- ==============================================================================
-- 5. TABLE: invoice_items (itemized goods / photography services)
-- ==============================================================================
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null check (quantity > 0),
  rate numeric(12, 2) not null check (rate >= 0),
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 6. TABLE: payments (full or partial payments against invoices)
-- ==============================================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  date date not null default current_date,
  method text not null check (method in ('Bank transfer', 'Credit card', 'Cash', 'Other')),
  notes text default '',
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 7. TABLE: expenses (business expenses and receipts)
-- ==============================================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  vendor text not null,
  amount numeric(12, 2) not null check (amount > 0),
  date date not null default current_date,
  receipt text default '',
  notes text default '',
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 8. TABLE: reminders (audit log of invoice reminder follow-ups)
-- ==============================================================================
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  sent_at timestamptz not null default now(),
  type text not null default 'due_soon',
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 9. TABLE: shoots (photography projects & calendar scheduling)
-- ==============================================================================
create table if not exists public.shoots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  client_id uuid references public.clients(id) on delete set null,
  location text default '',
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Completed', 'Cancelled')),
  notes text default '',
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 10. TABLE: notifications (in-app alerts and notifications)
-- ==============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  date date not null default current_date,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- PERFORMANCE INDEXES
-- ==============================================================================
create index if not exists idx_clients_user_id on public.clients(user_id);
create index if not exists idx_invoices_user_id on public.invoices(user_id);
create index if not exists idx_invoices_client_id on public.invoices(client_id);
create index if not exists idx_invoices_due_date on public.invoices(due_date);
create index if not exists idx_invoice_items_invoice_id on public.invoice_items(invoice_id);
create index if not exists idx_payments_user_id on public.payments(user_id);
create index if not exists idx_payments_invoice_id on public.payments(invoice_id);
create index if not exists idx_expenses_user_id on public.expenses(user_id);
create index if not exists idx_expenses_date on public.expenses(date);
create index if not exists idx_shoots_user_id on public.shoots(user_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Isolation: Users can only read and mutate their own business data
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.business_settings enable row level security;
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.reminders enable row level security;
alter table public.shoots enable row level security;
alter table public.notifications enable row level security;

-- Profiles Policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Business Settings Policies
create policy "Users can view own settings" on public.business_settings
  for select using (auth.uid() = user_id);
create policy "Users can insert own settings" on public.business_settings
  for insert with check (auth.uid() = user_id);
create policy "Users can update own settings" on public.business_settings
  for update using (auth.uid() = user_id);

-- Clients Policies
create policy "Users can view own clients" on public.clients
  for select using (auth.uid() = user_id);
create policy "Users can insert own clients" on public.clients
  for insert with check (auth.uid() = user_id);
create policy "Users can update own clients" on public.clients
  for update using (auth.uid() = user_id);
create policy "Users can delete own clients" on public.clients
  for delete using (auth.uid() = user_id);

-- Invoices Policies
create policy "Users can view own invoices" on public.invoices
  for select using (auth.uid() = user_id);
create policy "Users can insert own invoices" on public.invoices
  for insert with check (auth.uid() = user_id);
create policy "Users can update own invoices" on public.invoices
  for update using (auth.uid() = user_id);
create policy "Users can delete own invoices" on public.invoices
  for delete using (auth.uid() = user_id);

-- Invoice Items Policies (linked through parent invoice ownership)
create policy "Users can view own invoice items" on public.invoice_items
  for select using (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
      and invoices.user_id = auth.uid()
    )
  );
create policy "Users can insert own invoice items" on public.invoice_items
  for insert with check (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
      and invoices.user_id = auth.uid()
    )
  );
create policy "Users can update own invoice items" on public.invoice_items
  for update using (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
      and invoices.user_id = auth.uid()
    )
  );
create policy "Users can delete own invoice items" on public.invoice_items
  for delete using (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
      and invoices.user_id = auth.uid()
    )
  );

-- Payments Policies
create policy "Users can view own payments" on public.payments
  for select using (auth.uid() = user_id);
create policy "Users can insert own payments" on public.payments
  for insert with check (auth.uid() = user_id);
create policy "Users can update own payments" on public.payments
  for update using (auth.uid() = user_id);
create policy "Users can delete own payments" on public.payments
  for delete using (auth.uid() = user_id);

-- Expenses Policies
create policy "Users can view own expenses" on public.expenses
  for select using (auth.uid() = user_id);
create policy "Users can insert own expenses" on public.expenses
  for insert with check (auth.uid() = user_id);
create policy "Users can update own expenses" on public.expenses
  for update using (auth.uid() = user_id);
create policy "Users can delete own expenses" on public.expenses
  for delete using (auth.uid() = user_id);

-- Reminders Policies
create policy "Users can view own reminders" on public.reminders
  for select using (auth.uid() = user_id);
create policy "Users can insert own reminders" on public.reminders
  for insert with check (auth.uid() = user_id);

-- Shoots Policies
create policy "Users can view own shoots" on public.shoots
  for select using (auth.uid() = user_id);
create policy "Users can insert own shoots" on public.shoots
  for insert with check (auth.uid() = user_id);
create policy "Users can update own shoots" on public.shoots
  for update using (auth.uid() = user_id);
create policy "Users can delete own shoots" on public.shoots
  for delete using (auth.uid() = user_id);

-- Notifications Policies
create policy "Users can view own notifications" on public.notifications
  for select using (auth.uid() = user_id);
create policy "Users can insert own notifications" on public.notifications
  for insert with check (auth.uid() = user_id);
create policy "Users can update own notifications" on public.notifications
  for update using (auth.uid() = user_id);
create policy "Users can delete own notifications" on public.notifications
  for delete using (auth.uid() = user_id);

-- ==============================================================================
-- AUTOMATIC PROFILE & SETTINGS INITIALIZATION TRIGGER
-- Triggers on new user signup in auth.users
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, business_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'business_name', '')
  );

  insert into public.business_settings (user_id)
  values (new.id);

  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
