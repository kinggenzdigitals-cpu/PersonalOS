const r = require('../.tmp-test/reconcile.js');
let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${g}\n  want ${w}`); }
};
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.log(`FAIL ${name}`); } };

const tx = (o) => Object.assign({
  id: 'x', amount: 2000, date: '2026-09-05',
  merchant: 'Shell Fuel', type: 'expense', accountId: 'acc1',
}, o);

// --- the spec's own example ---
const manual   = tx({ id: 'm1', merchant: 'Shell Fuel' });
const imported = tx({ id: 'i1', merchant: 'SHELL SERVICE STATION' });
const m = r.scoreMatch(imported, manual);
ok('spec example matches', m !== null);
eq('spec example state', m.state, 'possible'); // spec: "Suggest a possible match"
ok('spec example high score', m.score >= 85);

// --- hard blockers: these must never match ---
eq('different amount', r.scoreMatch(imported, tx({id:'m2', amount: 2000.01})), null);
eq('different account', r.scoreMatch(imported, tx({id:'m3', accountId:'acc2'})), null);
eq('different type',    r.scoreMatch(imported, tx({id:'m4', type:'income'})), null);
eq('too far apart',     r.scoreMatch(imported, tx({id:'m5', date:'2026-09-11'})), null);
eq('self',              r.scoreMatch(imported, tx({id:'i1'})), null);

// --- centavo precision (float equality would break this) ---
ok('centavos equal', r.sameAmount(0.1 + 0.2, 0.3));
ok('centavos differ', !r.sameAmount(10.00, 10.01));

// --- date tolerance: cards post late ---
const d2 = r.scoreMatch(imported, tx({id:'m6', date:'2026-09-07'}));
ok('2 days apart still matches', d2 !== null);
eq('2 days apart is not "matched"', d2.state, 'possible');
eq('daysApart reported', d2.daysApart, 2);

// --- merchant similarity ---
ok('exact-ish',  r.merchantSimilarity('Shell Fuel','SHELL SERVICE STATION') > 0);
ok('prefix',     r.merchantSimilarity('SM Supermarket','SM SUPERMART MAKATI') > 0.5);
eq('no overlap', r.merchantSimilarity('Jollibee','Petron') , 0);
eq('empty',      r.merchantSimilarity('', 'Shell'), 0);
// generic words alone must not imply a match
eq('stopwords only', r.merchantSimilarity('POS PURCHASE MAKATI','POS DEBIT CITY'), 0);
// digits alone must not imply a match
eq('digits only', r.merchantSimilarity('12345','67890'), 0);

// --- amount+account+date can match with NO merchant evidence, but only weakly ---
const noName = r.scoreMatch(tx({id:'i2', merchant:''}), tx({id:'m7', merchant:''}));
ok('blank merchants still pair', noName !== null);
ok('blank merchants not "matched"', noName.state !== 'matched');

// --- bestMatch picks the strongest ---
const best = r.bestMatch(imported, [
  tx({ id:'m8', date:'2026-09-08', merchant:'Unknown' }),
  tx({ id:'m9', date:'2026-09-05', merchant:'Shell Fuel' }),
  tx({ id:'m10', amount: 999 }),
]);
eq('bestMatch id', best.candidate.id, 'm9');
eq('bestMatch none', r.bestMatch(imported, [tx({id:'z', amount: 1})]), null);

// --- tokenize drops noise ---
eq('tokenize', r.tokenize('SHELL SERVICE STATION 1234 MAKATI'), ['shell','service','station']);


// --- nearPrefix: the rule a plain startsWith got wrong ---
ok('supermarket~supermart', r.nearPrefix('supermarket','supermart'));
ok('supermart pair scores', r.merchantSimilarity('SM Supermarket','SM SUPERMART MAKATI') > 0.5);
ok('not petron~pepsi', !r.nearPrefix('petron','pepsi'));
ok('not jollibee~jollof', !r.nearPrefix('jollibee','jollof'));
ok('too short rejected', !r.nearPrefix('shel','shell'));
ok('identical long', r.nearPrefix('starbucks','starbucks'));


// ===== regressions found by adversarial review =====

// HIGH: a one-word manual entry scored similarity 1.0 against any descriptor
// containing it, reaching the strongest "matched" label — whose primary button
// deletes the user's row. Two different PHP500 fill-ups on one day is enough.
const generic = [
  ['PETRON GAS STATION EDSA', 'Gas'],
  ['PUREGOLD GROCERY BGC', 'Grocery'],
  ['GCASH SEND MONEY', 'Gcash'],
  ['GLOBE LOAD 100', 'Load'],
  ['MERCURY DRUG STORE', 'Mercury'],
];
for (const [bank, manual] of generic) {
  const m = r.scoreMatch(tx({ id:'i', merchant: bank }), tx({ id:'m', merchant: manual }));
  ok(`one-word "${manual}" is not "matched"`, m && m.state !== 'matched');
  ok(`one-word "${manual}" still offered`, m !== null);
}

// ...while a genuinely multi-word agreement still reaches "matched".
const strong = r.scoreMatch(
  tx({ id:'i', merchant:'SM SUPERMARKET MAKATI' }),
  tx({ id:'m', merchant:'SM Supermarket' }),
);
eq('multi-word agreement is matched', strong.state, 'matched');
eq('dice: identical single token', r.merchantSimilarity('SM SUPERMARKET MAKATI','SM Supermarket'), 1);
ok('dice: one generic word is weak', r.merchantSimilarity('Gas','PETRON GAS STATION EDSA') < 0.6);

// HIGH: one manual row could back several imported rows, so confirming each
// pair deleted several genuinely distinct transactions.
const manualOne = tx({ id:'m1', merchant:'Grab', date:'2026-09-05', amount:150 });
const importedTwo = [
  { id:'i1', candidate: tx({ id:'i1', merchant:'GRAB *TRIP 8821', date:'2026-09-05', amount:150 }) },
  { id:'i2', candidate: tx({ id:'i2', merchant:'GRAB *TRIP 9074', date:'2026-09-08', amount:150 }) },
];
const assigned = r.assignMatches(importedTwo, [manualOne]);
eq('candidate claimed once only', assigned.length, 1);
eq('strongest pair wins', assigned[0].item.id, 'i1');

// two manual rows -> both imported rows can pair
const assigned2 = r.assignMatches(importedTwo, [
  manualOne,
  tx({ id:'m2', merchant:'Grab', date:'2026-09-08', amount:150 }),
]);
eq('two candidates -> two pairs', assigned2.length, 2);
ok('distinct candidates used',
   assigned2[0].match.candidate.id !== assigned2[1].match.candidate.id);

// MAX_DAYS_APART boundary
ok('4 days still matches', r.scoreMatch(tx({id:'i'}), tx({id:'m', date:'2026-09-09'})) !== null);
eq('5 days rejected', r.scoreMatch(tx({id:'i'}), tx({id:'m', date:'2026-09-10'})), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
