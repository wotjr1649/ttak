'use strict';
// Pure collection bridge: native stdout enters only memory. Emit visible records
// and usage, never a raw transcript or hidden reasoning. No native execution.
const {collectClaude,collectReport}=require('./normal-events.cjs');
const {possibleSecret}=require('../../scripts/review-native-format.cjs');
function parse({host,stdout,process:result,checkpoint_text=null}){
  if(!['claude','codex'].includes(host)||typeof stdout!=='string'||Buffer.byteLength(stdout)>1048576||
    !result||typeof result!=='object')throw new Error('normal_parse_input');
  let report;
  if(host==='claude'){
    report=collectClaude(stdout);
    report.collection={source:'supervisor_stdout',complete:result.status==='exited'&&!report.incomplete_tail,
      stdout_withheld:result.status!=='exited',unreported_inflight_usage_possible:result.status!=='exited'};
  }else report=collectReport(stdout,result,()=>{
    if(typeof checkpoint_text!=='string'||Buffer.byteLength(checkpoint_text)>1048576)throw new Error('normal_checkpoint_unavailable');
    return checkpoint_text;
  });
  if(possibleSecret(JSON.stringify(report)))throw new Error('normal_report_withheld');
  return report;
}
module.exports={parse};
if(require.main===module){
  const chunks=[];let bytes=0;
  process.stdin.on('data',chunk=>{bytes+=chunk.length;if(bytes>2200000){process.stdin.destroy();process.exitCode=1;}else chunks.push(chunk);});
  process.stdin.on('end',()=>{try{process.stdout.write(JSON.stringify(parse(JSON.parse(Buffer.concat(chunks).toString('utf8'))))+'\n');}
    catch{process.stderr.write('normal_parse_failed\n');process.exitCode=1;}});
}
