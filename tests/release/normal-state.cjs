'use strict';
// Preserve the exact task-owned evidence before a later native turn replaces it.
// Read-only; never copies authentication, unrelated state or hidden reasoning.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {checkedData,exact}=require('../../scripts/verification-packet.cjs');
const {possibleSecret}=require('../../scripts/review-native-format.cjs');
const area=path.resolve(__dirname,'../../.superpowers');
function readStateFile(file){
 const resolved=path.resolve(file),relative=path.relative(area,resolved);
 if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('evidence_state_scope');
 let stat;try{stat=fs.lstatSync(resolved);}catch(error){if(error.code==='ENOENT')return {source_path:resolved,exists:false};throw error;}
 if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>32768||fs.realpathSync(resolved)!==resolved)throw new Error('evidence_state_file');
 const raw=fs.readFileSync(resolved),text=raw.toString('utf8');
 if(possibleSecret(text))throw new Error('evidence_state_withheld');
 const state=checkedData(JSON.parse(text));
 return {source_path:resolved,exists:true,sha256:createHash('sha256').update(raw).digest('hex'),state};
}
function snapshot(value){
 const spec=checkedData(value);exact(spec,['profile','installed','session']);
 if(typeof spec.session!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(spec.session))throw new Error('evidence_state_session');
 const profiles=['claude','codex'].map(host=>path.join(area,'release-run-03/profiles',host+'-ttak'));
 if(!profiles.includes(spec.profile)||fs.realpathSync(spec.profile)!==spec.profile||typeof spec.installed!=='string'||fs.realpathSync(spec.installed)!==spec.installed)throw new Error('evidence_state_profile');
 const parts=path.relative(path.join(spec.profile,'plugins/cache'),spec.installed).split(path.sep);
 if(parts.length!==3||!/^ttak-[a-z0-9-]+$/.test(parts[0])||parts[1]!=='ttak'||!parts[2]||parts[2]==='..')throw new Error('evidence_state_candidate');
 const file=path.join(spec.profile,'plugins/data','ttak-'+parts[0],'scenario-evidence-v1',createHash('sha256').update(spec.session).digest('hex')+'.json');
 return {session:spec.session,...readStateFile(file),scope:'Exact post-turn retained state; independent native replay is still required'};
}
module.exports={readStateFile,snapshot};
if(require.main===module){let input='',bytes=0;process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{bytes+=Buffer.byteLength(chunk);if(bytes>8192){process.stdin.destroy();process.exitCode=1;}else input+=chunk;});
 process.stdin.on('end',()=>{try{console.log(JSON.stringify(snapshot(JSON.parse(input))));}catch{console.log('{"error":"evidence_state_unavailable"}');process.exitCode=1;}});
}
