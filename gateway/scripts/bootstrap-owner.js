import {adminAuth,adminDb} from '../secure-session-store.js';
import {FieldValue} from 'firebase-admin/firestore';

const uidArg=process.argv.find(x=>x.startsWith('--uid='))?.slice(6)||process.env.TRADE_AVATA_OWNER_UID||'';
const emailArg=process.argv.find(x=>x.startsWith('--email='))?.slice(8)||process.env.TRADE_AVATA_OWNER_EMAIL||'';
if(!uidArg&&!emailArg){console.error('Usage: node scripts/bootstrap-owner.js --uid=FIREBASE_UID  OR  --email=owner@example.com');process.exit(2);}
const user=uidArg?await adminAuth.getUser(uidArg):await adminAuth.getUserByEmail(emailArg);
const claims=user.customClaims||{};
await adminAuth.setCustomUserClaims(user.uid,{...claims,role:'owner',plan:'OWNER'});
await adminDb.collection('users').doc(user.uid).set({uid:user.uid,email:user.email||'',displayName:user.displayName||'',role:'owner',plan:'OWNER',updatedAt:FieldValue.serverTimestamp()},{merge:true});
console.log(`Owner claim applied to Firebase UID ${user.uid}. The user must refresh/sign in again to receive the new ID token.`);
