(async () => {
  await document.fonts.ready;
  const failures = [];
  let checks = 0;
  const assert = (ok, message) => { checks++; if (!ok) failures.push(message); };
  const initialFontScale = state.fontScale;
  for (const fontScale of [100, 115, 140]) for (const width of [375, 390, 430]) {
    setFontScale(fontScale);
    document.querySelector('#phone').style.width = width + 'px';
    for (const theme of ['light', 'dark']) {
      state.theme = theme;
      for (const scenario of scenarios) {
        state.id = scenario.id;
        state.expanded = new Set([0, 1, 2]);
        render();
        await new Promise(requestAnimationFrame);
        const d = data(), t = totals(d);
        const key = `${scenario.id}/${theme}/${width}`;
        assert(screen.scrollWidth <= screen.clientWidth, `${key}: horizontal overflow`);
        document.querySelectorAll('#screen .money').forEach(el => {
          if (!el.getClientRects().length) return;
          const width = el.getBoundingClientRect().width;
          const available = el.parentElement.getBoundingClientRect().width;
          assert(width <= available + 1, `${key}: money exceeds its parent: ${el.textContent}`);
          if (el.clientWidth) assert(el.scrollWidth <= el.clientWidth + 1, `${key}: clipped money: ${el.textContent}`);
        });
        if (scenario.closed) {
          assert(!document.querySelector('#actions [data-action="sell"]'), `${key}: closed position has Sell`);
          assert(!document.querySelector('[data-lot]'), `${key}: closed position has lots`);
          assert(screen.textContent.includes('Realized gain'), `${key}: wrong closed hero`);
          assert(document.querySelector('.market .metric-main').textContent === money(d.price), `${key}: closed symbol's current price is missing`);
          assert(document.querySelector('#chart path') && document.querySelectorAll('[data-range]').length === 7, `${key}: closed holding price chart and ranges are missing`);
          assert(!document.querySelector('.today-return'), `${key}: closed holding has an invented daily position return`);
          assert(!document.querySelector('.hero').textContent.includes('$0.00'), `${key}: closed headline shows a zero position value`);
        } else if (!scenario.unknown && d.price !== null) {
          assert(document.querySelector('.hero .today-return'), `${key}: today's position return is not grouped with the hero`);
          assert(document.querySelector('.market .metric-label').textContent.startsWith('Share price'), `${key}: share price does not lead the market section`);
          assert(!document.querySelector('.market').textContent.includes('Today’s return'), `${key}: position return is still in the market section`);
        }
        if (scenario.id === 'missing') {
          assert(!document.querySelector('.market'), `${key}: missing quote has market figures`);
          assert(!screen.textContent.includes('Unrealized return'), `${key}: missing quote has return`);
          assert(screen.textContent.includes(money(t.cost)), `${key}: known cost absent`);
        }
        if (scenario.unknown) assert(!document.querySelector('#actions [data-action="buy"]'), `${key}: unknown has Buy`);
      }
    }
  }
  setFontScale(initialFontScale);
  state.id = 'multi'; state.theme = 'light'; state.expanded.clear(); render();
  assert(totals(data()).shares === 250, 'Multi-account shares wrong');
  assert(Math.abs(totals(data()).cost - 23762.25) < 0.001, 'Multi-account cost wrong');
  state.id = 'closed'; state.range = '1M'; render();
  const closedChart = document.querySelector('#chart').innerHTML;
  document.querySelector('[data-range="1Y"]').click();
  assert(state.range === '1Y' && document.querySelector('#chart').innerHTML !== closedChart, 'Closed holding chart range did not update');
  assert(document.querySelector('#chart').getAttribute('aria-label').includes('1Y NVDA'), 'Chart accessible label did not follow the selected range');
  assert(document.querySelector('.hero-value').textContent === '+$4,600.00', 'Market chart changed historical realized gain');
  state.id = 'loss'; state.lossVariant = 'gain'; render();
  assert(screen.textContent.includes('+1,332%'), 'Four-digit percentage is incorrectly formatted');
  state.lossVariant = 'loss'; render();
  assert(screen.textContent.includes('−87.0%'), 'Loss missing true minus or correct percent');
  state.id = 'fractional'; render();
  assert(screen.textContent.includes('3.4521'), 'Four decimal shares lost');
  state.id = 'partial'; render(); showLot(0, 0);
  assert(screen.textContent.includes('40'), 'Partial-sale original purchase shares incorrect');
  assert(screen.textContent.includes('30'), 'Partial-sale remaining shares incorrect');
  render();
  openSheet('sell', document.querySelector('#actions [data-action="sell"]'));
  document.querySelector('#transaction-shares').value = '1000';
  document.querySelector('#transaction-form').requestSubmit();
  assert(document.querySelector('#form-error').textContent.includes('holds 90 shares'), 'Overselling not prevented');
  document.querySelector('#transaction-shares').value = '5';
  document.querySelector('#transaction-form').requestSubmit();
  assert(document.querySelector('#sheet-title').textContent === 'Review sale', 'Review flow did not open');
  closeSheet();
  state.id = 'multi'; state.theme = 'light'; state.range = '1M'; state.expanded.clear();
  document.querySelector('#phone').style.width = '';
  render();
  return { checks, failures, pass: failures.length === 0 };
})()
