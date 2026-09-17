'use strict';

// Bounded, conservative checks of draft prose against a finite model, not a general
// natural-language verifier. No I/O, execution, model calls or user-supplied claim labels.
const { analyzeScenario } = require('./finite-scenario.cjs');
const MAX_DRAFT = 24000;
const MAX_SENTENCES = 256;
// Reviewed reference summaries, not instructions supplied by the draft. No runtime retrieval.
const ISOLATION_REFERENCES = Object.freeze([
  Object.freeze({ id: 'pg18-isolation', url: 'https://www.postgresql.org/docs/18/transaction-iso.html',
    scope: 'PostgreSQL 18 SERIALIZABLE (SSI), not every database isolation implementation',
    summary: 'Committed transactions have effects consistent with a serial order, while execution can overlap. Applications retry the entire transaction after serialization failure. Dependency monitoring and repeated work have costs; their size depends on the workload and implementation. No fixed slowdown or negligible-cost guarantee follows from load alone.' }),
  Object.freeze({ id: 'pg18-ssi', url: 'https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/storage/lmgr/README-SSI',
    scope: 'PostgreSQL 18 SSI conflict tracking',
    summary: 'An individual read/write anti-dependency is not by itself sufficient to require an abort. SSI detects dangerous structures involving adjacent read/write anti-dependencies, with ordering checks, to prevent serialization anomalies; conservative detection can also abort executions that would have been serializable.' }),
  Object.freeze({ id: 'pg18-row-locks', url: 'https://www.postgresql.org/docs/18/explicit-locking.html',
    scope: 'PostgreSQL 18 SQL row locks, separate from application-level transaction coordination',
    summary: 'SQL row locks restrict conflicting writers and lockers of the same row, not ordinary MVCC queries. FOR UPDATE does not by itself prevent other transactions from taking snapshots. Whole-transaction coordination outside SQL row locking is a different mechanism.' })
]);

function sentences(draft) {
  if (typeof draft !== 'string' || !draft.trim() || draft.length > MAX_DRAFT || !draft.isWellFormed()) {
    throw new Error('invalid_scenario_draft');
  }
  const rows = [];
  let fenced = false, offset = 0;
  for (const line of draft.match(/[^\n]*(?:\n|$)/g)) {
    if (!line) continue;
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; offset += line.length; continue; }
    if (!fenced && !/^\s*>/.test(line)) {
      for (const match of line.matchAll(/[^.!?。！？\n]+[.!?。！？]?/gu)) {
        if (!match[0].trim()) continue;
        if (rows.length >= MAX_SENTENCES) throw new Error('too_many_draft_sentences');
        rows.push({ start: offset + match.index, end: offset + match.index + match[0].length,
          text: match[0] });
      }
    }
    offset += line.length;
  }
  return rows;
}

function indirect(text) {
  // Questions, quotations, hypotheses and rebuttals need context this parser does not own.
  return /[?？"“”‘’「」『』]/u.test(text) ||
    /\b(?:if|suppose|assuming|hypothetically|claims?|claimed|says?|said|incorrect|incorrectly|false claim|not true|wrong|mistaken|misleading|deny|denies)\b/i.test(text) ||
    /(?:가정|만약|주장|틀린|틀렸|잘못|사실이 아|라고|라는|냐|인가)/u.test(text);
}

function namedIsolationRows(draft) {
  const rows=sentences(draft), selected=[];
  let context=false;
  for(const paragraph of draft.matchAll(/[^\r\n]+(?:\r?\n(?!\r?\n)[^\r\n]+)*/g)) {
    const parts=rows.filter(row=>row.start>=paragraph.index&&row.end<=paragraph.index+paragraph[0].length);
    const named=parts.some(row=>/\bserializab(?:le|ility)\b/i.test(row.text)&&!indirect(row.text));
    const heading=/^\s*(?:#{1,6}\s+[^\n]+|\*\*[^\n]+\*\*)\s*$/.test(paragraph[0]);
    if(heading)context=named;
    else if(named)context=true;
    if(context)selected.push(...parts);
  }
  return selected;
}

function reviewIsolationOrdering(draft, language = 'en') {
  if (!['en', 'ko'].includes(language)) throw new Error('unsupported_scenario_language');
  const rows = sentences(draft), issues = [];
  const paragraphs = [...draft.matchAll(/[^\r\n]+(?:\r?\n(?!\r?\n)[^\r\n]+)*/g)];
  let namedSection = false;
  for (const paragraph of paragraphs) {
    const parts = rows.filter(row => row.start >= paragraph.index && row.end <= paragraph.index + paragraph[0].length);
    const heading = /^\s*(?:#{1,6}\s+[^\n]+|\*\*[^\n]+\*\*)\s*$/.test(paragraph[0]);
    if (heading) namedSection = parts.some(row => /\bserializab(?:le|ility)\b/i.test(row.text) && !indirect(row.text));
    const namedHere = namedSection || parts.some(row => /\bserializab(?:le|ility)\b/i.test(row.text) && !indirect(row.text));
    if (!namedHere) continue;
    for (const row of parts) {
      const text = row.text.replace(/[`*_]/g, '');
      if (indirect(text) || /\bas if\b|\bone possible\b|\bfor example\b|\bdoes not (?:require|guarantee)\b|\bexplicit(?:ly)? (?:serial|coordinat)|처럼|보장하지/i.test(text)) continue;
      const physical = /\bone (?:transaction )?(?:must )?(?:complete|finish)s?(?: (?:entirely|fully))?(?:\s*\([^)]{0,160}\)|[—–-][^.!?\n]{0,160}[—–-])?\s*before (?:the other|the next) (?:begins|starts)\b/i.test(text) ||
        /\btransactions that could have (?:run|executed) in parallel are now serialized\b/i.test(text) ||
        /\b[A-Za-z][A-Za-z0-9_-]{0,40}'s (?:read and write|transaction) must (?:complete|finish) before [A-Za-z][A-Za-z0-9_-]{0,40}'s (?:read|transaction) begins\b/i.test(text) ||
        /\b(?:all|every|the) transactions? (?:must |will )?(?:run|execute) (?:one at a time|one after another)\b/i.test(text) ||
        /트랜잭션(?:은|이)?\s*(?:반드시\s*)?(?:차례대로|순차적으로)\s*실행/u.test(text);
      if (!physical) continue;
      issues.push({ start: row.start, end: row.end, kind: 'not_established', check: 'named_isolation_ordering',
        evidence: { real_database_verified: false, distinction: 'result_equivalence_is_not_physical_ordering' },
        feedback: language === 'ko' ? 'SERIALIZABLE의 결과 동등성과 실제 순차 실행을 구분하세요. 이 격리 수준만으로 다음 트랜잭션이 이전 commit 이후 snapshot을 얻는다고 보장할 수 없습니다. 실제 순차 조정 방법을 설명하거나 동시 실행과 전체 트랜잭션 재시도가 가능한 격리 수준의 동작을 정확히 설명하세요.' :
          'Distinguish SERIALIZABLE result equivalence from physical serial execution. This isolation level alone does not guarantee that the next transaction takes its snapshot after the previous commit. Explain an explicit whole-transaction coordination scheme, or accurately describe isolation that can allow concurrent execution and whole-transaction retries.' });
    }
  }
  return issues;
}

function reviewRowLockSnapshots(draft, language) {
  const rows=sentences(draft),issues=[];
  let postgres18=false;
  for(const paragraph of draft.matchAll(/[^\r\n]+(?:\r?\n(?!\r?\n)[^\r\n]+)*/g)){
    const parts=rows.filter(row=>row.start>=paragraph.index&&row.end<=paragraph.index+paragraph[0].length);
    // A named implementation establishes the context; an explicitly different or
    // fictional implementation ends it. No inference from the word "lock" alone.
    if(/\b(?:MySQL|MariaDB|SQLite|SQL Server|Oracle|CockroachDB|fictional|hypothetical|toy database)\b/i.test(paragraph[0])||
      /\bPostgreSQL\s+(?!18\b)\d+/i.test(paragraph[0]))postgres18=false;
    else if(parts.some(row=>/\bPostgreSQL\s+18\b/i.test(row.text)&&!indirect(row.text)))postgres18=true;
    if(!postgres18)continue;
    // An outer coordination protocol can constrain its own participants. This
    // parser does not establish its ordering and must not conflate it with SQL locks.
    if(/\b(?:mutex|advisory|semaphore|scheduler|coordinat\w*|application[- ]level|whole[- ]transaction)\b/i.test(paragraph[0]))continue;
    let rowLockContext=false;
    for(const row of parts){
      const text=row.text.replace(/[`*_]/g,''),rowLock=/\b(?:row[- ](?:level[- ])?lock(?:s|ing)?|FOR\s+UPDATE)\b/i.test(text);
      const refersToLock=rowLock||(rowLockContext&&/^\s*(?:this|it)\b/i.test(text));
      rowLockContext=rowLock||refersToLock;
      if(!refersToLock)continue;
      const claim=/\bprevent(?:s|ing)?\s+(?:all\s+)?concurrent\s+snapshots\b(?!\s+(?:anomal(?:y|ies)|errors?|conflicts?|violations?)\b)/i.exec(text);
      if(!claim)continue;
      const prefix=text.slice(0,claim.index+claim[0].length);
      if(/[?？]/u.test(text)||indirect(prefix)||/\b(?:not|never|cannot|can't|doesn't|don't)\b/i.test(prefix))continue;
      issues.push({start:row.start,end:row.end,kind:'not_established',check:'row_lock_snapshot_scope',
        evidence:{implementation:'PostgreSQL 18',ordinary_mvcc_queries_blocked_by_row_locks:false,real_database_verified:false},
        reference_ids:['pg18-row-locks'],
        feedback:language==='ko'?'PostgreSQL 18의 SQL 행 잠금은 같은 행의 충돌 쓰기·잠금 요청을 제한하며 일반 MVCC 조회나 snapshot 획득 자체를 막지 않습니다. 행 잠금과 별도의 전체 트랜잭션 조정을 구분하고, 잠금만으로 동시 snapshot을 방지한다는 보장을 수정하세요. 참고: https://www.postgresql.org/docs/18/explicit-locking.html':
          'PostgreSQL 18 SQL row locks restrict conflicting writers and lockers of the same row, not ordinary MVCC queries or snapshot acquisition itself. Distinguish row locking from separate whole-transaction coordination; correct the claim that row locks alone prevent concurrent snapshots. Reference: https://www.postgresql.org/docs/18/explicit-locking.html'});
    }
  }
  return issues;
}

function reviewFinalScope(draft, language = 'en') {
  const issues = [...reviewIsolationOrdering(draft, language),...reviewRowLockSnapshots(draft, language)];
  if (!/\bserializab(?:le|ility)\b/i.test(draft)) return issues;
  for (const row of namedIsolationRows(draft)) {
    const text = row.text.replace(/[`*_]/g, '');
    if (indirect(text)) continue;
    const excludesSize = /\b(?:the )?(?:cost|overhead) is proportional to contention,? (?:but |and )?not (?:to |on )?(?:transaction size|transaction length|read[\s/–-]*write footprint)\b/i.test(text) ||
      /\b(?:transaction size|transaction length|read[\s/–-]*write footprint) (?:does not|cannot) affect (?:the )?(?:cost|overhead)\b/i.test(text);
    const qualified = /\b(?:may|might|can|could|depends?|measured|benchmark|observed|in (?:this|our) workload|never|does not|do not|is not|are not|not necessarily|not always)\b/i.test(text);
    const costMagnitude = !qualified && (/\b(?:cost|costlier|costliest|expensive|overhead|degradation|slowdown|throughput|latency|performance)\b/i.test(text) &&
      /\b(?:negligible|significant|significantly|considerable|considerably|minimal|always|zero|costliest|expensive)\b|\b\d+(?:[–-]\d+)?\s*%/i.test(text));
    if (excludesSize || costMagnitude) issues.push({ start: row.start, end: row.end, kind: 'not_established', check: 'isolation_cost_scope',
      evidence: { universal_cost_formula_verified: false },
      reference_ids: ['pg18-isolation'],
      feedback: language === 'ko' ? 'SERIALIZABLE의 성능 크기를 부하만으로 단정하지 마세요. PostgreSQL 18에서는 읽기/쓰기 의존성 추적과 전체 트랜잭션 재실행에 비용이 듭니다. 읽기/쓰기 범위와 재실행할 작업량도 영향을 줍니다. 측정 근거가 없다면 무시 가능한 비용·큰 처리량 하락·고정 비율 대신 이 비용 요인과 조건을 설명하세요.' :
        'Do not assert negligible overhead, significant slowdown or a fixed performance ratio from load alone, or declare transaction size irrelevant. For PostgreSQL 18, explain dependency monitoring, read/write footprint and the work repeated on whole-transaction retries. Cost magnitude depends on workload and implementation; a measured estimate needs its actual measurement conditions. Reference: https://www.postgresql.org/docs/18/transaction-iso.html' });
    const singleDependency = !qualified && /\b(?:forces?|requires?|always|automatically|must)\b/i.test(text) && /\babort\b/i.test(text) &&
      /\b(?:when|whenever|because|each|every|single)\b/i.test(text) && /\bread\b/i.test(text) && /\bwrite\b/i.test(text) &&
      /\b(?:invalidat\w*|dependenc\w*|conflict\w*)\b/i.test(text) && !/\b(?:cycle|dangerous|structure|nonserializable|anomaly)\b|serial order/i.test(text);
    if (singleDependency) issues.push({start:row.start,end:row.end,kind:'not_established',check:'isolation_abort_scope',
      evidence:{single_read_write_dependency_sufficient:false},reference_ids:['pg18-ssi'],
      feedback:language==='ko' ? '읽기/쓰기 의존성 하나만으로 반드시 abort한다고 설명하지 마세요. PostgreSQL 18 SSI는 직렬화 이상을 일으킬 수 있는 의존성 구조와 순서 조건을 검사합니다. 이 의사 예시의 의존성 순환과 일반적인 단일 의존성을 구분하고, serialization failure 시 전체 트랜잭션을 재시도한다고 설명하세요.' :
        'A single read/write dependency does not by itself force an abort. Name the implementation: PostgreSQL 18 SSI checks dangerous dependency structures and ordering conditions to prevent serialization anomalies. Distinguish the cycle in this example from one dependency in general, and retry the whole transaction after serialization failure. Reference: https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/storage/lmgr/README-SSI'});
  }
  return issues;
}

function reviewScenarioDraft(scenario, draft, language) {
  if (!['en', 'ko'].includes(language)) throw new Error('unsupported_scenario_language');
  const result = analyzeScenario(scenario), rows = sentences(draft), ko = language === 'ko';
  const issues = [], assessed = [];
  const edges = result.potential_read_write_edges;
  // A declared edge may never execute. Only use a witness in which its writer commits.
  const actualEdges = edges.filter(edge => result.concurrent_start_schedules.some(schedule =>
    schedule.steps.some(step => step.transaction === edge.writer && step.outcome === 'committed')));
  for (const row of rows) {
    const text = row.text.replace(/[`*_]/g, '').trim();
    if (indirect(text)) continue;
    const deniesOverlap = /\bneither (?:transaction|participant) (?:writes?|updates?) (?:to )?(?:a |any )?(?:cell|row|value|item) (?:that |which )?the other reads?(?: from)?\b/i.test(text) ||
      /\bno (?:row|cell|item) is both read and written by different (?:transactions|participants)\b/i.test(text) ||
      /\bno (?:cross[- ](?:transaction|row) )?read[\s/–-]+write (?:overlaps?|dependencies)\b/i.test(text) ||
      /\bread[\s/–-]+write (?:sets|targets) (?:do not overlap|are disjoint)\b/i.test(text) ||
      /트랜잭션\s*간\s*읽기[·/\s-]*쓰기\s*(?:겹침|의존성)(?:은|는|이|가)?\s*없/u.test(text);
    if (deniesOverlap) {
      assessed.push({ start: row.start, end: row.end, check: 'cross_read_write_overlap' });
      if (actualEdges.length) issues.push({ start: row.start, end: row.end, kind: 'contradicted',
        check: 'cross_read_write_overlap', evidence: actualEdges,
        feedback: ko ? '이 예시에는 실제로 실행 가능한 교차 읽기/쓰기가 있습니다. 각 reader가 읽는 cells를 다른 writer가 씁니다. 쓰기 대상끼리 겹치지 않는다는 사실과 구분해 이 문장을 수정하세요.' :
          'The modeled example has executable cross-read/write overlaps: each listed reader reads cells written by the listed writer. Correct this sentence by distinguishing those overlaps from disjoint write targets.' });
    }
    const exclusive = /\b(?:the )?only (?:fix|solution|mitigation) (?:is|requires?|involves?)\b/i.test(text) ||
      /유일한\s*(?:해결책|완화책|해법)(?:은|는|이|가)/u.test(text);
    const universal = /\b(?:(?:any|all) (?:two )?)?transactions (?:that (?:read|touch)|(?:reading|touching)) overlapping (?:state|data) (?:cannot|can't) (?:run|execute) (?:in parallel|concurrently)\b/i.test(text) ||
      /겹치는\s*(?:상태|데이터)를\s*읽는\s*모든\s*트랜잭션은\s*(?:동시|병렬)\s*실행(?:할\s*수\s*없|이\s*불가능)/u.test(text);
    if (exclusive || universal) {
      assessed.push({ start: row.start, end: row.end, check: 'mitigation_scope' });
      issues.push({ start: row.start, end: row.end, kind: 'not_established', check: 'mitigation_scope',
        evidence: { real_database_verified: false, all_possible_interleavings_checked: false },
        feedback: ko ? '계산은 주어진 유한모델의 실행 순서만 검사했습니다. 이 완화책이 유일하다는 주장이나 모든 데이터베이스 실행에 대한 일반화를 뒷받침하지 않습니다. 제안한 방법의 구체적 조건과 비용으로 범위를 좁히세요.' :
          'This calculation checks only the supplied finite model. It does not establish an exclusive remedy or a universal concurrency restriction. Limit the sentence to the concrete conditions and cost of the proposed mitigation.' });
    }
  }
  for (const issue of reviewFinalScope(draft, language)) {
    assessed.push({ start: issue.start, end: issue.end, check: issue.check });
    issues.push(issue);
  }
  return { status: issues.length ? 'needs_revision' : 'no_supported_issue_found', issues,
    // A partial draft can omit a remedy that the final answer later adds. These
    // implementation boundaries must not depend on the model mentioning a keyword.
    reference_notes: ISOLATION_REFERENCES.map(note=>({...note})),
    assessed_spans: assessed,
    unchecked_spans: rows.filter(row => !assessed.some(span => span.start <= row.start && span.end >= row.end))
      .map(({ start, end }) => ({ start, end })),
    draft_semantics_verified: false, final_answer_verified: false,
    scope: 'Only supported declarative overlap denials, mitigation overclaims, named-isolation ordering, abort and cost claims, and PostgreSQL 18 row-lock snapshot overclaims are checked. Reference notes describe PostgreSQL 18 separately from the finite model. Other prose, quotations, questions, code and rebuttals are not certified.' };
}

module.exports = { reviewScenarioDraft, reviewIsolationOrdering, reviewFinalScope, MAX_DRAFT };
