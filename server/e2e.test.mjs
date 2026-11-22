// End-to-End Verification Test for Bizora Supabase & Backend Integration
import assert from 'node:assert/strict';
import { supabasePublic, getAuthenticatedSupabase } from './supabase.mjs';

const BASE_URL = 'http://localhost:4000/api';

async function runE2E() {
  console.log('--- Starting Bizora End-to-End Integration Verification ---');

  // 1. API Health Check
  console.log('1. Checking API Health Endpoint...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  assert.equal(healthRes.status, 200, 'Health endpoint should return 200');
  const healthData = await healthRes.json();
  assert.equal(healthData.status, 'ok');
  console.log('   ✓ Health check passed:', healthData);

  // 2. Unauthenticated user isolation test
  console.log('2. Verifying Unauthenticated Access Restrictions...');
  const unauthInsert = await supabasePublic.from('clients').insert({
    id: '00000000-0000-0000-0000-000000000099',
    user_id: '00000000-0000-0000-0000-000000000099',
    name: 'Unauth Intruder',
    email: 'intruder@test.com',
  });
  assert.ok(
    unauthInsert.error && unauthInsert.error.message.includes('row-level security'),
    'Unauthenticated direct insert must be blocked by RLS'
  );
  console.log('   ✓ RLS strictly blocks unauthenticated write');

  // 3. Supabase Auth: Register Test User A and User B
  const ts = Date.now();
  const emailA = `test_a_${ts}@bizora-verification.test`;
  const emailB = `test_b_${ts}@bizora-verification.test`;
  const password = 'Password123!';

  console.log('3. Registering Supabase Auth Test Accounts...');
  const { data: authA, error: errA } = await supabasePublic.auth.signUp({
    email: emailA,
    password,
    options: { data: { full_name: 'Studio Owner A', business_name: 'Studio Alpha' } },
  });
  if (errA) throw new Error(`User A signup failed: ${errA.message}`);
  const userA = authA.user;
  const sessionA = authA.session;
  console.log('   ✓ User A registered in Supabase Auth:', userA.id);

  const { data: authB, error: errB } = await supabasePublic.auth.signUp({
    email: emailB,
    password,
    options: { data: { full_name: 'Studio Owner B', business_name: 'Studio Beta' } },
  });
  if (errB) throw new Error(`User B signup failed: ${errB.message}`);
  const userB = authB.user;
  const sessionB = authB.session;
  console.log('   ✓ User B registered in Supabase Auth:', userB.id);

  // Get tokens
  let tokenA = sessionA?.access_token;
  if (!tokenA) {
    const { data: signA } = await supabasePublic.auth.signInWithPassword({ email: emailA, password });
    tokenA = signA.session?.access_token;
  }
  let tokenB = sessionB?.access_token;
  if (!tokenB) {
    const { data: signB } = await supabasePublic.auth.signInWithPassword({ email: emailB, password });
    tokenB = signB.session?.access_token;
  }

  const headersA = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` };
  const headersB = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` };

  // 4. User A adds a client via Node.js Backend API
  console.log('4. User A adding client via Node.js Backend API (POST /api/clients)...');
  const clientPayload = {
    name: 'Eleanor Vance',
    company: 'Hill House Interiors',
    email: 'eleanor@hillhouse.test',
    phone: '+1 555 444 3322',
    address: '42 Hillcrest Ave, Boston, MA',
  };
  const addClientRes = await fetch(`${BASE_URL}/clients`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify(clientPayload),
  });
  assert.equal(addClientRes.status, 201, 'POST /api/clients should return 201');
  const createdClient = await addClientRes.json();
  assert.ok(createdClient.id, 'Created client must have an ID');
  assert.equal(createdClient.name, clientPayload.name);
  console.log('   ✓ Client created through backend:', createdClient.id, createdClient.name);

  // 5. Verify client persists in Supabase directly
  console.log('5. Verifying client in Supabase PostgreSQL...');
  const supabaseA = getAuthenticatedSupabase(tokenA);
  const { data: supaClient, error: supaClientErr } = await supabaseA
    .from('clients')
    .select('*')
    .eq('id', createdClient.id)
    .single();
  assert.ok(!supaClientErr, `Supabase fetch error: ${supaClientErr?.message}`);
  assert.equal(supaClient.name, clientPayload.name);
  console.log('   ✓ Client verified in Supabase PostgreSQL');

  // 6. User B isolation test: User B cannot see User A's client
  console.log('6. Verifying Cross-Account Isolation (User B cannot see User A\'s records)...');
  const listClientsB = await fetch(`${BASE_URL}/clients`, { headers: headersB });
  const clientsForB = await listClientsB.json();
  const hasClientA = clientsForB.some((c) => c.id === createdClient.id);
  assert.equal(hasClientA, false, 'User B must NOT see User A\'s client');
  console.log('   ✓ Cross-account isolation verified (RLS enforced)');

  // 7. User A creates an invoice for that client
  console.log('7. User A creating invoice with line items (POST /api/invoices)...');
  const invoicePayload = {
    clientId: createdClient.id,
    issueDate: '2026-11-01',
    dueDate: '2026-12-15',
    taxRate: 8,
    notes: 'Editorial shoot at Hill House',
    items: [
      { description: 'Full Day Shoot', quantity: 1, rate: 2000 },
      { description: 'Retouching (5 images)', quantity: 5, rate: 100 },
    ],
  };
  const createInvRes = await fetch(`${BASE_URL}/invoices`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify(invoicePayload),
  });
  assert.equal(createInvRes.status, 201, 'POST /api/invoices should return 201');
  const createdInvoice = await createInvRes.json();
  assert.ok(createdInvoice.id, 'Invoice must have ID');
  assert.equal(createdInvoice.total, 2700); // (2000 + 500) * 1.08 = 2700
  console.log('   ✓ Invoice created:', createdInvoice.number, 'Total:', createdInvoice.total);

  // 8. User A sends invoice and records a partial payment
  console.log('8. User A sending invoice (POST /api/invoices/:id/send)...');
  const sendRes = await fetch(`${BASE_URL}/invoices/${createdInvoice.id}/send`, {
    method: 'POST',
    headers: headersA,
  });
  assert.equal(sendRes.status, 200, 'Sending invoice should return 200');
  console.log('   ✓ Invoice marked as Sent');

  console.log('   Recording partial payment (POST /api/invoices/:id/payments)...');
  const paymentPayload = {
    amount: 1000,
    date: '2026-11-05',
    method: 'Bank transfer',
    notes: 'Initial 50% deposit',
  };
  const payRes = await fetch(`${BASE_URL}/invoices/${createdInvoice.id}/payments`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify(paymentPayload),
  });
  assert.equal(payRes.status, 201, 'Payment should return 201');
  const paymentData = await payRes.json();
  assert.equal(paymentData.amount, 1000);
  console.log('   ✓ Partial payment of $1,000 recorded');

  // 9. Verify updated invoice balance
  console.log('9. Checking updated invoice balance and status...');
  const getInvRes = await fetch(`${BASE_URL}/invoices/${createdInvoice.id}`, { headers: headersA });
  const updatedInv = await getInvRes.json();
  assert.equal(updatedInv.balance, 1700); // 2700 - 1000 = 1700
  assert.equal(updatedInv.effectiveStatus, 'Partially paid');
  console.log('   ✓ Invoice balance correctly updated to $1,700, status: Partially paid');

  // 10. Verify Summary & Forecast APIs
  console.log('10. Checking Financial Summary & Deterministic Forecast APIs...');
  const summaryRes = await fetch(`${BASE_URL}/summary`, { headers: headersA });
  const summary = await summaryRes.json();
  assert.equal(summary.revenueMonth, 1000);
  assert.equal(summary.outstanding, 1700);
  console.log('   ✓ Summary reflects revenue ($1,000) and outstanding balance ($1,700)');

  const forecastRes = await fetch(`${BASE_URL}/forecast?horizon=30&lateDays=15`, { headers: headersA });
  const forecastData = await forecastRes.json();
  assert.equal(forecastData.horizonDays, 30);
  assert.ok(forecastData.baseline, 'Forecast baseline exists');
  assert.ok(forecastData.scenario, 'Forecast scenario exists');
  console.log('   ✓ 30-day forecast and 15-day late payment simulator calculated');

  // Clean up
  console.log('11. Cleaning up test records...');
  await supabaseA.from('payments').delete().eq('invoice_id', createdInvoice.id);
  await supabaseA.from('invoice_items').delete().eq('invoice_id', createdInvoice.id);
  await supabaseA.from('invoices').delete().eq('id', createdInvoice.id);
  await supabaseA.from('clients').delete().eq('id', createdClient.id);
  console.log('   ✓ Test data cleaned up successfully');

  console.log('\n======================================================');
  console.log('🎉 ALL END-TO-END SUPABASE & BACKEND CHECKS PASSED!');
  console.log('======================================================\n');
}

runE2E().catch((err) => {
  console.error('❌ E2E Verification failed:', err);
  process.exit(1);
});
