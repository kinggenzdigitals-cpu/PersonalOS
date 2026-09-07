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
ok('exact-ish',  r.merchantSimilarity('Shell Fuel','SHELL SERVICE STATION') >= 0.5);
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
