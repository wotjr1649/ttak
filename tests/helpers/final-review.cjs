'use strict';
// Synthetic review records for protocol tests only. This is not a semantic judge.
const {canonical}=require('../../scripts/verification-packet.cjs');
function reviewChecks(){return {
  requirement_review:{essential_requirements:'pass',reader_format:'pass'},
  claim_review:{actors_targets:'pass',conditions_outcomes:'pass',timing_negation:'pass',guarantees_scope_costs:'pass'},
  fact_review:{source_support:'pass',computed_outcomes:'pass',internal_consistency:'pass'}};}
function checkedReviewAnswer(issueCount=0){
  const checks=reviewChecks();if(issueCount)checks.claim_review.actors_targets=Array.from({length:issueCount},(_,index)=>index);
  return canonical(Object.fromEntries(Object.entries(checks).map(([key,value])=>[key,canonical(value)])));
}
function finalReviewAnswer(claim='The proposed claims match the supplied fictional definition.'){
  return canonical({requirement_review:'The requested mechanism and output constraints are covered.',
    claim_review:claim,fact_review:'The supplied factual reasons are consistent with the original hypothetical definition.'});
}
function finalReviewSubmission(result){
  let reviews=JSON.parse(result.answer);
  if(Object.values(reviews).every(value=>typeof value==='string'&&value.startsWith('{')))reviews=Object.fromEntries(Object.entries(reviews).map(([key,value])=>[key,JSON.parse(value)]));
  return {challenge:result.challenge,final_decision:result.verdict==='complete'?'approve_explanation':'revise_explanation',
    ...reviews,checked_questions:result.checked_questions,issues:result.issues};
}
module.exports={reviewChecks,checkedReviewAnswer,finalReviewAnswer,finalReviewSubmission};
