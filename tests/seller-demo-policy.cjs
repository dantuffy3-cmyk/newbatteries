const fs=require('fs'),vm=require('vm'),assert=require('assert');
const h=fs.readFileSync(__dirname+'/../seller-demo.html','utf8');
const d=JSON.parse(h.match(/<script id="demo-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const scriptMatch=h.match(/<script>([\s\S]*?)<\/script>/);assert(scriptMatch,'Expected an inline executable script');const script=scriptMatch[1];new vm.Script(script);
assert.equal((script.match(/\/\/ POLICY START/g)||[]).length,1,'Expected one POLICY START marker');assert.equal((script.match(/\/\/ POLICY END/g)||[]).length,1,'Expected one POLICY END marker');assert(script.indexOf('// POLICY START')<script.indexOf('// POLICY END'),'Policy markers must be in order');const policy=script.split('// POLICY START')[1].split('\n').slice(1).join('\n').split('// POLICY END')[0];
const box={URL};vm.createContext(box);vm.runInContext(policy,box);
let count=1;function check(n,fn){fn();console.log('PASS '+n);count++}
const s=d.scenarios[0];
check('Autobarn exact destination',()=>{const t=box.handoffTarget(s,'Autobarn',d.sources);assert.equal(t.sku,'EL14396');assert(t.url.endsWith('/EL14396'))});
check('Supercheap exact destination',()=>{const t=box.handoffTarget(s,'Supercheap Auto',d.sources);assert.equal(t.sku,'602480');assert(t.url.endsWith('/602480.html'))});
check('Conflict blocks direct handoff',()=>assert.equal(box.handoffTarget(d.scenarios[1],'Autobarn',d.sources),null));
check('Unknown vehicle case has no seller handoff',()=>assert.equal(box.handoffTarget(d.scenarios[2],'Autobarn',d.sources),null));
check('Unknown merchant blocks',()=>assert.equal(box.handoffTarget(s,'Other',d.sources),null));
check('Unreviewed mapping blocks',()=>{const x=structuredClone(s);x.merchant_mappings[0].mapping_state='unreviewed';assert.equal(box.handoffTarget(x,'Autobarn',d.sources),null)});
check('New conflict blocks previously positive case',()=>{const x=structuredClone(s);x.conflicts.push({field:'identity'});assert.equal(box.handoffTarget(x,'Autobarn',d.sources),null)});
check('Missing source blocks',()=>assert.equal(box.handoffTarget(s,'Autobarn',[]),null));
check('Wrong merchant host blocks',()=>{const src=structuredClone(d.sources);src.find(x=>x.id==='AB-NS70L').url='https://example.com/';assert.equal(box.handoffTarget(s,'Autobarn',src),null)});
check('Javascript URL blocks',()=>{const src=structuredClone(d.sources);src.find(x=>x.id==='AB-NS70L').url='javascript:alert(1)';assert.equal(box.handoffTarget(s,'Autobarn',src),null)});
check('Handoff does not alter evidence or fitment',()=>{const old=JSON.stringify(d);box.handoffTarget(s,'Autobarn',d.sources);assert.equal(JSON.stringify(d),old);assert(d.scenarios.every(x=>x.fitment_state==='unconfirmed'))});
check('No tracking or storage code',()=>{assert(!/localStorage|sessionStorage|fetch\(|XMLHttpRequest|sendBeacon/.test(script));assert(!/src=["']https:/.test(h))});
check('Research metadata excludes private workflow',()=>{assert(!('gate_b0_dependency' in d));assert(!('design_decisions' in d));assert(!/Gate B0|session-state|4931650/.test(h))});
check('Fixture implementation metadata matches release',()=>{assert.equal(d.version,'0.3.1');assert.equal(d.implementation,'local_clickable_demo_only')});
for(const merchant of ['Autobarn','Supercheap Auto']){
 const m=s.merchant_mappings.find(x=>x.merchant===merchant);
 const original=d.sources.find(x=>x.id===m.source_id).url;
 for(const [name,url] of [['homepage',new URL(original).origin+'/'],['another SKU',original.replace(m.sku,'WRONGSKU')],['query added',original+'?redirect=1'],['fragment added',original+'#other'],['different port',original.replace('.au/','.au:444/')]]){
  check(merchant+' rejects '+name,()=>{const src=structuredClone(d.sources);src.find(x=>x.id===m.source_id).url=url;assert.equal(box.handoffTarget(s,merchant,src),null)});
 }
 check(merchant+' rejects changed mapping SKU',()=>{const x=structuredClone(s);x.merchant_mappings.find(y=>y.merchant===merchant).sku='OTHER';assert.equal(box.handoffTarget(x,merchant,d.sources),null)});
 check(merchant+' rejects changed source binding',()=>{const x=structuredClone(s);x.merchant_mappings.find(y=>y.merchant===merchant).source_id='C-NS70L';assert.equal(box.handoffTarget(x,merchant,d.sources),null)});
}
check('Changed product model blocks handoff',()=>{const x=structuredClone(s);x.product.model='OTHER';assert.equal(box.handoffTarget(x,'Autobarn',d.sources),null)});
check('Three cases keep fitment and purchase withheld',()=>{assert.equal(d.scenarios.length,3);assert(d.scenarios.every(x=>x.fitment_state==='unconfirmed'&&!x.actions.purchase_recommendation&&!x.actions.replacement_match))});
check('Research and source rights remain unapproved',()=>{assert.equal(d.global_controls.canonical_source_admission,false);assert(d.sources.every(x=>x.production_admission===false&&x.publication_rights==='not_assessed'&&x.raw_snapshot_saved===false))});
console.log('TOTAL '+count+' passed; 0 failed (includes JavaScript syntax check)');
