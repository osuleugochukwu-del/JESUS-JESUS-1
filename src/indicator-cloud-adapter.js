/* Trade Avata Indicator Portal cloud metadata adapter.
 * Firestore is authoritative for signed-in project metadata and entitlement records.
 * Source/package blobs are deliberately NOT written to Firestore; they remain in the local
 * draft vault until a secure backend staging/build service accepts them.
 */
import {
  collection,query,where,getDocs,doc,setDoc,deleteDoc,serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const clean=(v,max=240)=>String(v??'').trim().slice(0,max);
const arr=(v,max=200)=>Array.isArray(v)?v.slice(0,max):[];
const current=()=>window.TRADE_AVATA_AUTH_ADAPTER?.getCurrentUser?.()||null;
const db=()=>window.TRADE_AVATA_AUTH_ADAPTER?.db||null;

function requireSession(){
  const user=current(),firestore=db();
  if(!user?.uid||!firestore)throw new Error('Sign in to Trade Avata before syncing Indicator Portal projects.');
  return{user,firestore};
}

function sanitizeFileMeta(files=[]){
  return arr(files,32).map(f=>({
    name:clean(f?.name,180),size:Math.max(0,Number(f?.size)||0),type:clean(f?.type,100),
    extension:clean(f?.extension,16).toLowerCase(),sha256:clean(f?.sha256,80),accepted:!!f?.accepted,
    warnings:arr(f?.warnings,20).map(x=>clean(x,240)),errors:arr(f?.errors,20).map(x=>clean(x,240))
  }));
}

function sanitizeProject(project,user){
  return{
    ownerUid:user.uid,
    projectId:clean(project?.id,120),
    name:clean(project?.name,160)||'Untitled Indicator',
    version:clean(project?.version,32)||'1.0',
    targetPlatform:clean(project?.targetPlatform,80)||'Trade Avata',
    description:clean(project?.description,4000),
    parameters:arr(project?.parameters,200).map(x=>clean(x,240)),
    visibility:clean(project?.visibility,64)||'Draft',
    sharedTaIds:arr(project?.sharedTaIds,500).map(x=>clean(x,40).toUpperCase()).filter(Boolean),
    createdAt:project?.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    licensingDefaults:{
      mode:clean(project?.licensing?.mode,40)||'until-revoked',
      startDate:project?.licensing?.startDate||null,
      expiry:project?.licensing?.expiry||null,
      deviceAllowance:Math.max(1,Math.min(20,Number(project?.licensing?.deviceAllowance)||2))
    },
    draftMetadata:{
      files:sanitizeFileMeta(project?.files),
      localSourceVault:true,
      sourceStoredInFirestore:false
    }
  };
}

async function listProjects(){
  const{user,firestore}=requireSession();
  const snap=await getDocs(query(collection(firestore,'indicatorProjects'),where('ownerUid','==',user.uid)));
  return snap.docs.map(d=>{const x={id:d.id,...d.data()};for(const k of ['createdAt','updatedAt'])if(x[k]?.toDate)x[k]=x[k].toDate().toISOString();if(x.licensingDefaults)x.licensing=x.licensingDefaults;return x;});
}

async function saveProject(project){
  const{user,firestore}=requireSession();
  if(!project?.id)throw new Error('Indicator project ID is required.');
  const payload=sanitizeProject(project,user);
  await setDoc(doc(firestore,'indicatorProjects',String(project.id)),{...payload,updatedAt:serverTimestamp()},{merge:true});
  return payload;
}

async function deleteProject(projectId){
  const{firestore}=requireSession();
  await deleteDoc(doc(firestore,'indicatorProjects',String(projectId)));
  return true;
}

async function listEntitlements(){
  const{user,firestore}=requireSession();
  const snap=await getDocs(query(collection(firestore,'indicatorEntitlements'),where('uid','==',user.uid)));
  return snap.docs.map(d=>{const x={id:d.id,...d.data()};for(const k of ['startsAt','expiresAt','createdAt','updatedAt'])if(x[k]?.toDate)x[k]=x[k].toDate().toISOString();return x;});
}

async function listVersions(projectId=null){
  const{user,firestore}=requireSession();
  const snap=await getDocs(query(collection(firestore,'indicatorVersions'),where('ownerUid','==',user.uid)));
  const rows=snap.docs.map(d=>{const x={id:d.id,...d.data()};for(const k of ['createdAt','updatedAt'])if(x[k]?.toDate)x[k]=x[k].toDate().toISOString();return x;});
  return projectId==null?rows:rows.filter(v=>String(v.projectId)===String(projectId));
}

async function saveDraftVersion(project,version){
  const{user,firestore}=requireSession();
  if(!project?.id||!version?.version)throw new Error('Project and version are required.');
  const id=`${project.id}__${String(version.version).replace(/[^0-9A-Za-z._-]/g,'_')}`;
  const payload={
    ownerUid:user.uid,projectId:String(project.id),version:clean(version.version,32),
    createdAt:version.createdAt||new Date().toISOString(),updatedAt:serverTimestamp(),
    draft:true,notes:clean(version.notes||'',2000)
  };
  await setDoc(doc(firestore,'indicatorVersions',id),payload,{merge:true});
  return{id,...payload};
}

const adapter={listProjects,saveProject,deleteProject,listEntitlements,listVersions,saveDraftVersion};
window.TRADE_AVATA_INDICATOR_CLOUD=adapter;
export default adapter;
