import crypto from 'node:crypto';
import {FieldValue} from 'firebase-admin/firestore';
import {adminAuth,adminDb} from './secure-session-store.js';

function taCandidate(){return `TA-${crypto.randomInt(10_000_000,100_000_000)}`;}

async function ensureTaId(uid,{email='',displayName=''}={}){
  const userRef=adminDb.collection('users').doc(uid);
  for(let attempt=0;attempt<20;attempt++){
    const candidate=taCandidate(),taRef=adminDb.collection('taIds').doc(candidate);
    try{
      const result=await adminDb.runTransaction(async tx=>{
        const userSnap=await tx.get(userRef);const current=userSnap.exists?userSnap.data():{};
        if(current?.taId)return current;
        const taSnap=await tx.get(taRef);if(taSnap.exists)throw Object.assign(new Error('TA ID collision'),{code:'TA_ID_COLLISION'});
        const profile={
          uid,email:String(email||current?.email||'').slice(0,254),displayName:String(displayName||current?.displayName||'').slice(0,120),
          role:current?.role||'free',plan:current?.plan||'FREE',taId:candidate,
          createdAt:current?.createdAt||FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()
        };
        tx.set(taRef,{taId:candidate,uid,createdAt:FieldValue.serverTimestamp()},{merge:false});
        tx.set(userRef,profile,{merge:true});return{...current,...profile,taId:candidate};
      });
      return result;
    }catch(err){if(err?.code==='TA_ID_COLLISION')continue;throw err;}
  }
  throw new Error('Could not allocate a unique Trade Avata ID.');
}

async function ensureOwnerClaim(uid){
  const configured=String(process.env.TRADE_AVATA_OWNER_UID||'').trim();
  if(!configured||configured!==uid)return{changed:false};
  const record=await adminAuth.getUser(uid),claims=record.customClaims||{};
  if(String(claims.role||'').toLowerCase()==='owner'&&String(claims.plan||'').toUpperCase()==='OWNER')return{changed:false};
  await adminAuth.setCustomUserClaims(uid,{...claims,role:'owner',plan:'OWNER'});
  await adminDb.collection('users').doc(uid).set({role:'owner',plan:'OWNER',updatedAt:FieldValue.serverTimestamp()},{merge:true});
  return{changed:true};
}

export async function ensureAccountIdentity(decoded){
  const uid=decoded?.uid;if(!uid)throw Object.assign(new Error('Sign in required'),{status:401});
  let profile=await ensureTaId(uid,{email:decoded.email||'',displayName:decoded.name||''});
  const owner=await ensureOwnerClaim(uid);
  if(owner.changed){profile={...profile,role:'owner',plan:'OWNER'};}
  else{
    const snap=await adminDb.collection('users').doc(uid).get();if(snap.exists)profile={...profile,...snap.data()};
  }
  return{profile:{uid,taId:profile.taId,role:profile.role||'free',plan:profile.plan||'FREE',email:profile.email||decoded.email||'',displayName:profile.displayName||decoded.name||''},tokenRefreshRequired:owner.changed};
}
