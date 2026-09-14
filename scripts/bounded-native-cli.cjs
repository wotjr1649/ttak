'use strict';
// Local collector bridge. The request is a reviewed collector artifact, never model output.
const { boundedNativeProcess } = require('./bounded-native-process.cjs');
let size=0;const chunks=[];
process.stdin.on('data', chunk=>{
  size+=chunk.length;
  if(size>2200000){process.stderr.write('request_too_large\n');process.exit(1);}
  chunks.push(chunk);
});
process.stdin.on('end', async()=>{
  try{
    const request=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const result=await boundedNativeProcess(request,{powershell:process.argv[2],env:process.env});
    process.stdout.write(JSON.stringify(result)+'\n');
  }catch{process.stderr.write('bounded_native_failed_cleanup_unverified\n');process.exitCode=1;}
});
