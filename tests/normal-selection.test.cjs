'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {selectionEdits}=require('./release/normal-select.cjs');
test('normal selection changes only enabled fields in the exact saved owned set',()=>{
  const previous={'ttak@ttak-release':true,'ttak@ttak-values201':false,'eli5@ttak-original-codex-v4':false};
  const actual=Object.fromEntries(Object.entries(previous).map(([key,enabled])=>[key,{enabled}]));
  const baseline=Object.fromEntries(Object.keys(previous).map(key=>[key,false]));
  assert.deepEqual(selectionEdits(actual,previous,baseline),[{keyPath:'plugins."ttak@ttak-release".enabled',value:false,mergeStrategy:'replace'}]);
  assert.deepEqual(selectionEdits(actual,previous,previous),[]);
  const original={...baseline,'eli5@ttak-original-codex-v4':true};
  const changes=selectionEdits(actual,previous,original);assert.equal(changes.length,2);
  assert.ok(changes.every(change=>change.keyPath.endsWith('.enabled')));
  assert.equal(actual['ttak@ttak-release'].enabled,true);
});
test('concurrent changes, new targets, malformed flags and non-owned changes reject before a write',()=>{
  const previous={'ttak@ttak-release':true},actual={'ttak@ttak-release':{enabled:true}};
  for(const [observed,expected,target]of [
    [{'ttak@ttak-release':{enabled:false}},previous,previous],
    [actual,previous,{...previous,'eli5@ttak-original-codex-v4':true}],
    [actual,previous,{'ttak@ttak-release':1}],
    [{'unrelated@outside':{enabled:true}},{'unrelated@outside':true},{'unrelated@outside':false}],
    [{'ttak@ttak-release':{}},previous,previous]])assert.throws(()=>selectionEdits(observed,expected,target));
  let invoked=0;const hostile={};Object.defineProperty(hostile,'ttak@ttak-release',{enumerable:true,get(){invoked++;return {enabled:true};}});
  assert.throws(()=>selectionEdits(hostile,previous,previous));assert.equal(invoked,0);
});
test('saved personal and unrelated entries can be preserved but cannot be changed by campaign selection',()=>{
  const saved={'ttak@personal':false,'unrelated@outside':true,'ttak@ttak-release':true};
  const actual=Object.fromEntries(Object.entries(saved).map(([key,enabled])=>[key,{enabled}]));
  assert.deepEqual(selectionEdits(actual,saved,saved),[]);
  const changes=selectionEdits(actual,saved,{...saved,'ttak@ttak-release':false});assert.equal(changes.length,1);
  for(const key of ['ttak@personal','unrelated@outside'])assert.throws(()=>selectionEdits(actual,saved,{...saved,[key]:!saved[key]}));
});
