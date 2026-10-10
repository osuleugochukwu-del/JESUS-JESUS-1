/* Trade Avata production Firebase authentication adapter.
 * Keeps the approved V11.1 login UI and supplies the real authentication methods it expects.
 * Passwords are handled only by Firebase Authentication.
 */
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  getIdToken,
  getIdTokenResult
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const firebaseConfig={
  apiKey:'AIzaSyBGFTYCvR_IQsdUt0kPYmBbV_N7DVEvnEQ',
  authDomain:'trade-avata.firebaseapp.com',
  projectId:'trade-avata',
  storageBucket:'trade-avata.firebasestorage.app',
  messagingSenderId:'912818772251',
  appId:'1:912818772251:web:a66373dbf4f44f01299bbe',
  measurementId:'G-ZPGTX6CW50'
};

const firebaseApp=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(firebaseApp);
const db=getFirestore(firebaseApp);
const googleProvider=new GoogleAuthProvider();
googleProvider.setCustomParameters({prompt:'select_account'});

let currentNormalizedUser=null;
let persistenceReady=setPersistence(auth,browserLocalPersistence).catch(err=>{
  console.warn('[Trade Avata Auth] Could not set local persistence.',err);
});

function cleanString(v,max=160){return String(v??'').trim().slice(0,max);}

function backendBase(){
  const raw=window.TRADE_AVATA_BACKEND_CONFIG?.apiHttp||window.TRADE_AVATA_CTRADER_CONFIG?.gatewayHttp||'';
  return String(raw||'').trim().replace(/\/$/,'');
}
const bootstrapCache=new Map();
async function bootstrapBackendIdentity(user){
  const base=backendBase();if(!base||!user?.uid)return null;
  const cached=bootstrapCache.get(user.uid);if(cached&&Date.now()-cached.at<60000)return cached.value;
  const token=await getIdToken(user,false);
  const r=await fetch(`${base}/api/account/bootstrap`,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:'{}'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||`Trade Avata account bootstrap returned ${r.status}.`);
  if(data.tokenRefreshRequired)await getIdToken(user,true);
  const value=data.profile||null;bootstrapCache.set(user.uid,{at:Date.now(),value});return value;
}

async function readProfile(uid){
  try{
    const snap=await getDoc(doc(db,'users',uid));
    return snap.exists()?snap.data():null;
  }catch(err){
    console.warn('[Trade Avata Auth] Profile read unavailable.',err?.code||err?.message||err);
    return null;
  }
}

async function ensureFreeProfile(user){
  if(!user?.uid)return null;
  const ref=doc(db,'users',user.uid);
  try{
    const snap=await getDoc(ref);
    if(snap.exists())return snap.data();
    const profile={
      uid:user.uid,
      email:cleanString(user.email,254),
      displayName:cleanString(user.displayName||'',120),
      taId:null,
      role:'free',
      plan:'FREE',
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    };
    await setDoc(ref,profile,{merge:false});
    return profile;
  }catch(err){
    // Public authentication still works if Firestore profile rules/backend are not deployed yet.
    // We deliberately do not invent Owner authority or a final TA ID in browser storage.
    console.warn('[Trade Avata Auth] Profile creation unavailable.',err?.code||err?.message||err);
    return null;
  }
}

async function normalizeFirebaseUser(user,{ensureProfile=false}={}){
  if(!user)return null;
  let profile=ensureProfile?await ensureFreeProfile(user):await readProfile(user.uid);
  if(!profile&&ensureProfile)profile=await readProfile(user.uid);
  try{const secured=await bootstrapBackendIdentity(user);if(secured)profile={...(profile||{}),...secured};}catch(err){console.warn('[Trade Avata Auth] Secure TA ID/role bootstrap unavailable.',err?.message||err);}
  let claims={};
  try{claims=(await getIdTokenResult(user,true)).claims||{};}catch{}

  // Client-side role display is convenient only. Protected backend operations must
  // verify Firebase ID tokens/custom claims server-side. Never trust this field alone.
  const claimRole=cleanString(claims.role||'',40).toLowerCase();
  const profileRole=cleanString(profile?.role||'free',40).toLowerCase()||'free';
  // Production Owner authority is accepted only from a Firebase custom claim.
  // A profile field may describe ordinary roles, but a stale/profile-only "owner" is downgraded client-side.
  const role=claimRole||(profileRole==='owner'?'free':profileRole);
  const claimPlan=cleanString(claims.plan||'',40).toUpperCase();
  const profilePlan=cleanString(profile?.plan||'FREE',40).toUpperCase()||'FREE';
  const plan=claimRole==='owner'?(claimPlan||'OWNER'):(claimPlan||profilePlan);
  return {
    uid:user.uid,
    email:user.email||'',
    displayName:user.displayName||profile?.displayName||'',
    photoURL:user.photoURL||'',
    emailVerified:!!user.emailVerified,
    role,
    plan,
    roleVerified:!!claimRole&&claimRole===role,
    authoritySource:claimRole?'firebase-custom-claim':(profile?.role?'profile-display':'default'),
    // TA-PENDING stops older frontend fallback code from minting a browser-local TA ID.
    // Production TA IDs should be written to users/{uid}.taId only by trusted backend/admin code.
    taId:profile?.taId||'TA-PENDING',
    providerIds:(user.providerData||[]).map(x=>x.providerId).filter(Boolean)
  };
}

function emitAuthState(user){
  currentNormalizedUser=user;
  window.dispatchEvent(new CustomEvent('tradeavata:auth-state',{detail:{user}}));
}

const sessionReady=(async()=>{
  await persistenceReady;
  return new Promise(resolve=>{
    const unsub=onAuthStateChanged(auth,async user=>{
      try{
        const normalized=await normalizeFirebaseUser(user);
        emitAuthState(normalized);
        resolve(normalized);
      }catch(err){
        console.error('[Trade Avata Auth] Session restoration failed.',err);
        emitAuthState(null);
        resolve(null);
      }
      // Keep the listener active after resolving; do not unsubscribe.
      void unsub;
    });
  });
})();

async function signIn(input,passwordMaybe){
  await persistenceReady;
  const email=typeof input==='string'?input:input?.email;
  const password=typeof input==='string'?passwordMaybe:input?.password;
  const cred=await signInWithEmailAndPassword(auth,cleanString(email,254),String(password??''));
  const user=await normalizeFirebaseUser(cred.user,{ensureProfile:true});
  emitAuthState(user);
  return user;
}

async function createAccount(input,passwordMaybe){
  await persistenceReady;
  const email=typeof input==='string'?input:input?.email;
  const password=typeof input==='string'?passwordMaybe:input?.password;
  const displayName=typeof input==='object'?cleanString(input?.displayName||'',120):'';
  const cred=await createUserWithEmailAndPassword(auth,cleanString(email,254),String(password??''));
  if(displayName)await updateProfile(cred.user,{displayName});
  await ensureFreeProfile(cred.user);
  const user=await normalizeFirebaseUser(cred.user);
  emitAuthState(user);
  return user;
}

async function resetPassword(input){
  await persistenceReady;
  const email=typeof input==='string'?input:input?.email;
  if(!cleanString(email,254))throw new Error('Enter your email address.');
  await sendPasswordResetEmail(auth,cleanString(email,254));
  return true;
}

async function signInWithGoogle(){
  await persistenceReady;
  const cred=await signInWithPopup(auth,googleProvider);
  await ensureFreeProfile(cred.user);
  const user=await normalizeFirebaseUser(cred.user);
  emitAuthState(user);
  return user;
}

async function signOut(){
  await firebaseSignOut(auth);
  emitAuthState(null);
  return true;
}

async function getSession(){
  await sessionReady;
  return currentNormalizedUser;
}

async function getAuthToken(forceRefresh=false){
  if(!auth.currentUser)return null;
  return getIdToken(auth.currentUser,!!forceRefresh);
}

const adapter={
  firebaseApp,
  auth,
  db,
  signIn,
  login:signIn,
  createAccount,
  signUp:createAccount,
  resetPassword,
  sendPasswordResetEmail:resetPassword,
  forgotPassword:resetPassword,
  signInWithGoogle,
  googleSignIn:signInWithGoogle,
  signOut,
  restoreSession:getSession,
  getSession,
  getCurrentUser:()=>currentNormalizedUser,
  getIdToken:getAuthToken,
  bootstrapIdentity:async()=>auth.currentUser?bootstrapBackendIdentity(auth.currentUser):null,
  sessionReady
};

window.TRADE_AVATA_AUTH_ADAPTER=adapter;
export default adapter;
