'use strict';
const { analyzeScenario } = require('./finite-scenario.cjs');
const quoted = value => '`' + value + '`';
const stateText = state => Object.entries(state).map(([cell, value]) => quoted(cell + '=' + value)).join(', ');

function explainScenario(input, language) {
  if (!['en', 'ko'].includes(language)) throw new Error('unsupported_scenario_language');
  const result = analyzeScenario(input), ko = language === 'ko';
  const paragraphs = [];
  paragraphs.push(ko ? '초기 상태: ' + stateText(input.initial) + '.' : 'Initial state: ' + stateText(input.initial) + '.');
  const cells = input.invariant.cells.map(quoted).join(', '), count = input.invariant.at_least;
  paragraphs.push(input.invariant.cells.length ? (ko ? '유지할 조건: ' + cells + ' 중 최소 ' + count + '개가 true여야 합니다.' :
    'Invariant: at least ' + count + ' of ' + cells + ' must be true.') :
    (ko ? '불변식은 무조건 참인 조건입니다.' : 'The invariant is unconditional.'));
  paragraphs.push(input.transactions.map(transaction => ko ?
    '- ' + quoted(transaction.id) + ': ' + (transaction.guard.cells.map(quoted).join(', ') || '빈 상태 집합') + '를 읽어 true가 최소 ' +
      transaction.guard.at_least + '개이면 ' + stateText(transaction.writes) + '로 변경합니다.' :
    '- ' + quoted(transaction.id) + ' reads ' + (transaction.guard.cells.map(quoted).join(', ') || 'no cells') +
      '; if at least ' + transaction.guard.at_least + ' are true, it writes ' + stateText(transaction.writes) + '.').join('\n'));
  const edges = result.potential_read_write_edges;
  paragraphs.push(edges.length ? edges.map(edge => ko ?
    '- ' + quoted(edge.reader) + '가 읽는 ' + edge.cells.map(quoted).join(', ') + '는 ' + quoted(edge.writer) + '가 쓸 수 있는 대상입니다.' :
    '- ' + quoted(edge.reader) + ' reads ' + edge.cells.map(quoted).join(', ') + ', which ' + quoted(edge.writer) + ' can write.').join('\n') :
    (ko ? '선언된 트랜잭션 간 읽기·쓰기 겹침은 없습니다.' : 'There are no declared cross-transaction read/write overlaps.'));
  if (!result.potential_write_write_edges.length && edges.length) paragraphs.push(ko ?
    '쓰기 대상끼리는 겹치지 않지만, 읽기 대상과 다른 트랜잭션의 쓰기 대상은 겹칩니다.' :
    'The declared writes do not overlap each other, but reads overlap another transaction\'s writes.');
  const witness = result.concurrent_start_schedules.find(schedule => !schedule.invariant_preserved) || result.concurrent_start_schedules[0];
  const renderSteps = schedule => schedule.steps.map(step => {
    const outcome = { committed: ko ? '변경을 커밋함' : 'commits its writes',
      guard_false: ko ? '조건이 거짓이므로 변경하지 않음' : 'makes no update because its guard is false',
      write_conflict_abort: ko ? '쓰기 충돌로 중단됨' : 'aborts on a write conflict' }[step.outcome];
    const observed = stateText(step.observed) || (ko ? '상태 읽기 없음' : 'no cells');
    return '- ' + quoted(step.transaction) + ': ' + (ko ? '관측 ' : 'observes ') + observed + '; ' + outcome + '.';
  }).join('\n');
  paragraphs.push((ko ? '모든 스냅샷을 첫 커밋 전에 얻은 실행에서:\n\n' : 'When every snapshot is taken before the first commit:\n\n') +
    renderSteps(witness) + '\n\n' + (ko ? '최종 상태: ' : 'Final state: ') + stateText(witness.final_state) + '.\n\n' +
    (witness.invariant_preserved ? (ko ? '이 실행은 불변식을 유지합니다.' : 'This schedule preserves the invariant.') :
      (ko ? '이 실행은 불변식을 위반합니다.' : 'This schedule violates the invariant.')));
  const serial = result.serial_schedules[0];
  paragraphs.push((ko ? '각 트랜잭션이 스냅샷 획득부터 완료까지 끝난 뒤 다음을 시작하면:\n\n' :
    'When each whole transaction finishes, including snapshot acquisition, before the next begins:\n\n') + renderSteps(serial));
  if (result.concurrent_invariant_violation_found && result.all_serial_orders_preserve_invariant) {
    paragraphs.push(ko ?
      '이 모델에서의 완화책은 관련된 모든 참여자가 전체 트랜잭션을 직렬로 실행하도록 조정하는 것입니다. 스냅샷 획득과 조건 검사도 조정 범위에 포함해야 이후 참여자가 변경된 상태를 검사합니다. 대가는 해당 작업들을 동시에 처리할 수 없다는 점입니다. 모든 관련 참여자가 같은 조정 규칙을 따라야 합니다.' :
      'A mitigation in this model is to coordinate every relevant participant so whole transactions execute serially. Include snapshot acquisition and the guard check in that coordination, so later participants check the resulting state. The trade-off is loss of concurrency among these operations. Every relevant participant must follow the same coordination rule.');
    paragraphs.push((ko ? '검증한 순서: ' : 'Checked ordering: ') + serial.order.map(id =>
      quoted(id) + (ko ? ' 스냅샷 획득 → 조건 검사 → 조건이 참이면 쓰기 → 완료' :
        ' takes snapshot → checks guard → writes if enabled → finishes')).join(ko ? '; 그 다음 ' : '; then ') + '.');
    paragraphs.push(ko ?
      '이미 모든 스냅샷을 얻은 뒤 커밋만 순서대로 처리해도 위의 위반 실행이 남습니다. 검증한 것은 이 구체적인 실행 순서이며, 이름이 붙은 격리 수준이나 잠금 구현이 이 순서를 따르는지는 검증하지 않았습니다.' :
      'Ordering commits after all snapshots have already been taken still admits the violating schedule above. The calculation checked this concrete ordering; it did not establish that a named isolation level or locking implementation follows it.');
  } else if (!result.all_serial_orders_preserve_invariant) paragraphs.push(ko ?
    '직렬 순서에서도 불변식 위반이 있습니다. 직렬화만으로 충분하지 않으며 조건이나 변경 로직을 고쳐야 합니다.' :
    'A serial order also violates the invariant. Serialization alone is insufficient; the guard or update logic needs correction.');
  paragraphs.push(ko ?
    '검증 범위: 주어진 초기 상태에서 동시 시작 후의 커밋 순서 ' + result.concurrent_start_schedules.length + '개와 직렬 순서 ' +
      result.serial_schedules.length + '개를 계산했습니다. 가능한 모든 interleaving을 검사한 것은 아닙니다. 실제 데이터베이스, SQL, 행 잠금이나 재시도 동작은 검증하지 않았습니다.' :
    'Scope: the calculation checked ' + result.concurrent_start_schedules.length + ' concurrent-start commit orders and ' +
      result.serial_schedules.length + ' serial orders from the supplied initial state. It did not check every possible interleaving. It did not verify a real database, SQL, row locking or retry behavior.');
  return { explanation: paragraphs.join('\n\n'), facts: {
    potential_read_write_edges: result.potential_read_write_edges, potential_write_write_edges: result.potential_write_write_edges,
    concurrent_invariant_violation_found: result.concurrent_invariant_violation_found,
    all_serial_orders_preserve_invariant: result.all_serial_orders_preserve_invariant,
    real_database_verified: false, all_possible_interleavings_checked: false } };
}
module.exports = { explainScenario };
