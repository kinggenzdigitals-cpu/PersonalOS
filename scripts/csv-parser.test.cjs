const c = require('../.tmp-test/csv.js');
let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.log(`FAIL ${name}\n  got  ${g}\n  want ${w}`); }
};

// --- amounts (PH statement realities) ---
eq('plain',        c.parseAmount('1,234.56'), 1234.56);
eq('peso sign',    c.parseAmount('₱1,234.56'), 1234.56);
eq('parens neg',   c.parseAmount('(500.00)'), -500);
eq('minus',        c.parseAmount('-250'), -250);
eq('DR suffix',    c.parseAmount('1,000.00 DR'), -1000);
eq('trailing neg', c.parseAmount('750.00-'), -750);
eq('euro style',   c.parseAmount('1.234,56'), 1234.56);
eq('blank',        c.parseAmount('  '), null);
eq('undefined',    c.parseAmount(undefined), null);
eq('rounds',       c.parseAmount('10.005'), 10.01);

// --- dates ---
eq('iso',        c.parseDate('2026-03-05'), '2026-03-05');
eq('mdy',        c.parseDate('03/05/2026', false), '2026-03-05');
eq('dmy',        c.parseDate('05/03/2026', true), '2026-03-05');
eq('day>12',     c.parseDate('25/03/2026', false), '2026-03-25'); // infers day
eq('named',      c.parseDate('5 Jan 2026'), '2026-01-05');
eq('named2',     c.parseDate('Jan 5, 2026'), '2026-01-05');
eq('dash named', c.parseDate('05-MAR-2026'), '2026-03-05');
eq('2digit yr',  c.parseDate('05/03/26', true), '2026-03-05');
eq('invalid',    c.parseDate('not a date'), null);
eq('feb30',      c.parseDate('2026-02-30'), null);

// --- day-first inference ---
eq('infer dayfirst', c.inferDayFirst(['05/03/2026','25/03/2026']), true);
eq('infer monthfirst', c.inferDayFirst(['03/25/2026']), false);

// --- quoted CSV with embedded comma + escaped quotes + CRLF ---
const t1 = c.parseCsv('Date,Description,Amount\r\n2026-03-05,"SM SUPERMARKET, MAKATI",-1500.00\r\n2026-03-06,"He said ""hi""",2000\r\n');
eq('headers', t1.headers, ['Date','Description','Amount']);
eq('rowcount', t1.rows.length, 2);
eq('embedded comma', t1.rows[0][1], 'SM SUPERMARKET, MAKATI');
eq('escaped quote', t1.rows[1][1], 'He said "hi"');

// --- semicolon delimiter + preamble junk before header ---
const t2 = c.parseCsv('Account Statement\nGenerated 2026-03-01\nDate;Details;Debit;Credit\n05/03/2026;PETRON;1500,00;\n06/03/2026;SALARY;;25000,00\n');
eq('semicolon delim', t2.delimiter, ';');
eq('skips preamble', t2.headers, ['Date','Details','Debit','Credit']);
eq('t2 rows', t2.rows.length, 2);

// --- auto-detect ---
const m2 = c.autoDetectColumns(t2.headers);
eq('detect date', m2.date, 0);
eq('detect desc', m2.description, 1);
eq('detect debit', m2.debit, 2);
eq('detect credit', m2.credit, 3);
eq('pair beats amount', m2.amount, null);

// --- buildRows with debit/credit pair ---
const b2 = c.buildRows(t2, m2, { accountId: 'acc1', dayFirst: true, expenseIsNegative: true });
eq('b2 count', b2.rows.length, 2);
eq('debit -> expense', [b2.rows[0].type, b2.rows[0].amount], ['expense', 1500]);
eq('credit -> income', [b2.rows[1].type, b2.rows[1].amount], ['income', 25000]);
eq('b2 date', b2.rows[0].date, '2026-03-05');

// --- signed amount column, and the flipped-sign toggle ---
const m1 = c.autoDetectColumns(t1.headers);
const b1 = c.buildRows(t1, m1, { accountId: 'acc1', dayFirst: false, expenseIsNegative: true });
eq('neg -> expense', b1.rows[0].type, 'expense');
eq('pos -> income', b1.rows[1].type, 'income');
const b1f = c.buildRows(t1, m1, { accountId: 'acc1', dayFirst: false, expenseIsNegative: false });
eq('flipped', b1f.rows[0].type, 'income');

// --- fingerprint stability & sensitivity ---
const f = (d) => c.fingerprint(Object.assign({accountId:'a',date:'2026-03-05',amount:100,type:'expense',description:'SM Supermarket, Makati'}, d));
eq('fp stable', f({}), f({}));
eq('fp normalises', f({description:'SM   SUPERMARKET,  MAKATI!!'}), f({description:'sm supermarket makati'}));
eq('fp amount matters', f({amount:101}) === f({}), false);
eq('fp account matters', f({accountId:'b'}) === f({}), false);

// --- bad rows are reported, not silently dropped ---
const t3 = c.parseCsv('Date,Description,Amount\nnope,BAD DATE,100\n2026-03-05,NO AMOUNT,\n2026-03-06,GOOD,50\n');
const b3 = c.buildRows(t3, c.autoDetectColumns(t3.headers), { accountId:'a', dayFirst:false, expenseIsNegative:true });
eq('good rows kept', b3.rows.length, 1);
eq('errors reported', b3.errors.length, 2);
eq('error lines', b3.errors.map(e=>e.line), [1,2]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
