import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const here=path.dirname(fileURLToPath(import.meta.url));
const packageRoot=path.dirname(here);
const target=path.resolve(process.argv[2]||'');
if(!process.argv[2]){console.error('Usage: node scripts/install-into-clone.mjs <path-to-your-JESUS-JESUS-clone>');process.exit(2);}
const f=p=>path.join(target,p);
if(!fs.existsSync(f('src/app.js'))||!fs.existsSync(f('index.html'))){console.error('STOP: target does not look like a JESUS-JESUS repository clone. Nothing was changed.');process.exit(2);}
const sha256File=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const BASELINE_MANIFEST_SHA256='b32a6d77ceebf5e18bc06529c0a48102b20ec7440cbe4cfab6900cd295255f9b';
const CURRENT_WORKFLOW_SHA256='5a6c4d383fe567b48d3ea9c89e70fc2948378783f576ab12383d944f57a40fd1';
const baselineManifest=f('V11.1-SHA256.txt');
if(!fs.existsSync(baselineManifest)||sha256File(baselineManifest)!==BASELINE_MANIFEST_SHA256){
  console.error('STOP: V11.1 baseline manifest is missing or does not match the inspected JESUS-JESUS repository. Nothing was changed.');process.exit(3);
}
const baselineRows=fs.readFileSync(baselineManifest,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{const m=/^([a-f0-9]{64})\s+\.\/(.+)$/.exec(line);return m?{sha:m[1],p:m[2]}:null;}).filter(Boolean);
const baselineFailures=[];
// The checked-in V11.1 fingerprint predates the current deploy.yml formatting-only repaste.
// Protect every other baseline file against the manifest, then protect the CURRENT GitHub workflow separately.
for(const {p,sha} of baselineRows){
  if(p==='.github/workflows/deploy.yml')continue;
  const file=f(p);if(!fs.existsSync(file)||sha256File(file)!==sha)baselineFailures.push(p);
}
if(baselineFailures.length){console.error(`STOP: ${baselineFailures.length} baseline file(s) differ or are missing. Nothing was changed.`);for(const p of baselineFailures.slice(0,20))console.error(` - ${p}`);process.exit(3);}
const currentWorkflow=f('.github/workflows/deploy.yml');
if(!fs.existsSync(currentWorkflow)||sha256File(currentWorkflow)!==CURRENT_WORKFLOW_SHA256){
  console.error('STOP: deploy workflow does not match the current inspected JESUS-JESUS main branch. Nothing was changed.');
  process.exit(3);
}

const backup=path.join(target,'.trade-avata-backup-v11.1');fs.mkdirSync(backup,{recursive:true});
for(const p of ['index.html','sw.js','package.json','.github/workflows/deploy.yml'])if(fs.existsSync(f(p)))fs.copyFileSync(f(p),path.join(backup,p==='.github/workflows/deploy.yml'?'deploy.yml':path.basename(p)));

function copyEntry(rel){
  const src=path.join(packageRoot,rel),dst=f(rel);if(!fs.existsSync(src))return;
  const st=fs.statSync(src);if(st.isDirectory()){fs.mkdirSync(dst,{recursive:true});for(const name of fs.readdirSync(src))copyEntry(path.join(rel,name));return;}
  fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);
}
const copyEntries=[
  '.github/workflows/deploy.yml','index.html','ctrader-callback.html','sw.js','package.json','firestore.rules','README-FIRST.txt','LIVE-ACTIVATION-LATER.txt','SOURCE-BASELINE.txt','LIVE-READY-SHA256.txt','VERIFY-AFTER-INSTALL.bat','APPLY-TO-JESUS-JESUS.bat',
  'assets/live-ready-upgrade.css',
  'src/firebase-auth-adapter.js','src/indicator-cloud-adapter.js','src/live-ready-config.js','src/market-feed-adapter.js','src/ctrader-feed-adapter.js','src/ctrader-oauth-callback.js','src/live-ready-upgrade.js',
  'scripts/install-into-clone.mjs','scripts/verify-live-ready.mjs','tests/live-ready.test.js','gateway',
  'docs/FINAL-LIVE-READY-RELEASE.md','docs/PRESERVATION-AUDIT.md','docs/R2-FINAL-AUDIT.md','docs/R3-THREE-WAY-AUDIT.md','docs/CTRADER-LIVE-PLUG.md','docs/LIVE-READY-MANIFEST.md'
];
for(const p of copyEntries)copyEntry(p);
console.log(`Upgrade files copied after validating ${baselineRows.length-1} manifest-protected baseline files plus the current deploy workflow. No original chart/indicator/image/asset file was deleted.`);
const check=spawnSync(process.execPath,['scripts/verify-live-ready.mjs'],{cwd:target,stdio:'inherit'});
if(check.status!==0){console.error('Verification failed. Original index/sw/package backups are in .trade-avata-backup-v11.1');process.exit(check.status||1);}
console.log('\nTrade Avata V11.2 Live-Ready Final R3 installed successfully on the fully verified V11.1 baseline.');
console.log('Later live activation is configuration/deployment: Firebase Authorized Domain + Firestore rules + secure gateway + cTrader credentials + Owner UID.');
