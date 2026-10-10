import crypto from 'node:crypto';
import {initializeApp,applicationDefault,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';

function adminApp(){return getApps()[0]||initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID||'trade-avata'});}
const app=adminApp();export const adminAuth=getAuth(app);export const adminDb=getFirestore(app);const db=adminDb;
function key(){const raw=process.env.CTRADER_TOKEN_ENCRYPTION_KEY||'';const b=Buffer.from(raw,'base64');if(b.length!==32)throw new Error('CTRADER_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key');return b;}
function encrypt(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv),data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]),tag=cipher.getAuthTag();return{v:1,iv:iv.toString('base64'),tag:tag.toString('base64'),data:data.toString('base64')};}
function decrypt(value){if(!value)return null;const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(value.iv,'base64'));decipher.setAuthTag(Buffer.from(value.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString('utf8'));}
export async function verifyBearer(header=''){const m=/^Bearer\s+(.+)$/i.exec(header);if(!m)throw Object.assign(new Error('Sign in required'),{status:401});return adminAuth.verifyIdToken(m[1],true);}
export async function saveSession(uid,session){await db.collection('ctraderPrivateSessions').doc(uid).set({uid,secret:encrypt(session),updatedAt:FieldValue.serverTimestamp()},{merge:true});}
export async function loadSession(uid){const snap=await db.collection('ctraderPrivateSessions').doc(uid).get();if(!snap.exists)return null;return decrypt(snap.data().secret);}
export async function deleteSession(uid){await db.collection('ctraderPrivateSessions').doc(uid).delete().catch(()=>{});}
export async function saveSystemSession(name,session){await db.collection('ctraderSystemSessions').doc(String(name)).set({name:String(name),secret:encrypt(session),updatedAt:FieldValue.serverTimestamp()},{merge:true});}
export async function loadSystemSession(name){const snap=await db.collection('ctraderSystemSessions').doc(String(name)).get();if(!snap.exists)return null;return decrypt(snap.data().secret);}
export async function deleteSystemSession(name){await db.collection('ctraderSystemSessions').doc(String(name)).delete().catch(()=>{});}

function oauthStateHash(value){return crypto.createHash('sha256').update(String(value||'')).digest('hex');}
export async function saveOAuthState(uid,state,scope){
  await db.collection('ctraderOAuthStates').doc(String(uid)).set({uid:String(uid),stateHash:oauthStateHash(state),scope:scope==='trading'?'trading':'accounts',expiresAt:Date.now()+10*60*1000,updatedAt:FieldValue.serverTimestamp()},{merge:false});
}
export async function consumeOAuthState(uid,state){
  const ref=db.collection('ctraderOAuthStates').doc(String(uid));
  return db.runTransaction(async tx=>{
    const snap=await tx.get(ref);if(!snap.exists)throw Object.assign(new Error('OAuth state is missing or expired. Start the cTrader connection again.'),{status:400});
    const row=snap.data()||{};const got=oauthStateHash(state);
    const a=Buffer.from(String(row.stateHash||'')),b=Buffer.from(got);const same=a.length===b.length&&crypto.timingSafeEqual(a,b);
    if(!same||Number(row.expiresAt||0)<Date.now()){tx.delete(ref);throw Object.assign(new Error('OAuth state validation failed. Start the cTrader connection again.'),{status:400});}
    tx.delete(ref);return{scope:row.scope==='trading'?'trading':'accounts'};
  });
}
