// Run in the transactions.html browser context (for example, agent-browser eval --stdin).
(async () => {
  const failures = [];
  let checks = 0;
  const assert = (ok, message) => { checks++; if (!ok) failures.push(message); };
  const saved = { ...state };
  const choose = value => {
    const input = [...document.querySelectorAll('#filter-options input')].find(el => el.value === value);
    input.click();
  };
  const apply = () => document.querySelector('#filter-form').requestSubmit();
  const open = key => document.querySelector(`[data-filter="${key}"]`).click();
  const reset = () => { Object.assign(state, { id: 'mixed', scope: 'all', symbol: 'all', type: 'all' }); render(); };
  try {
    if (document.querySelector('.sheet')) closeSheet();
    reset();
    assert(document.querySelectorAll('[data-filter]').length === 3, 'Exactly three filters are visible');
    assert(visibleRows().length === 12, 'Initial count includes the full history');
    assert(!document.querySelector('#period-button, #period-select'), 'Period dropdown is removed');
    assert(!document.querySelector('.flow-summary, .page-subtitle, .export-button'), 'Removed summary, subtitle and export are absent');
    open('symbol');
    const search = document.querySelector('#symbol-search');
    search.value = 'nvidia'; search.dispatchEvent(new Event('input', { bubbles: true }));
    assert(document.querySelectorAll('#filter-options input').length === 2, 'Company search returns NVIDIA and All symbols');
    choose('NVDA');
    assert(document.querySelector('#apply-filter').textContent === 'Show 2 records', 'Draft previews record count');
    assert(state.symbol === 'all', 'Selecting does not apply before confirmation');
    apply();
    assert(state.symbol === 'NVDA' && visibleRows().length === 2, 'Symbol filter applies');
    assert(document.activeElement.dataset.filter === 'symbol', 'Focus returns to replaced filter chip');
    assert(document.querySelector('[data-filter="symbol"]').classList.contains('is-active'), 'Selected filter is highlighted');
    open('type'); choose('withdrawal');
    assert(document.querySelector('#apply-filter').textContent === 'Show 0 records', 'Conflicting filters preview zero results');
    closeSheet();
    assert(state.type === 'all', 'Cancel discards draft');
    open('type'); choose('withdrawal'); apply();
    assert(visibleRows().length === 0 && document.querySelector('.empty-state'), 'Conflicting filters show empty state');
    document.querySelector('#clear-history-filters').click();
    assert(visibleRows().length === 12, 'Clear all restores the full history');
    assert(document.querySelector('#clear-history-filters').hidden, 'Reset hides clear action');
    open('scope'); choose('1'); apply();
    assert(state.scope === '1' && visibleRows().length === 4, 'Account filter applies');
    assert(document.querySelector('[data-filter="scope"]').textContent.includes('Tax-free savings'), 'Account chip shows the chosen account');
    open('scope'); choose('0'); apply();
    assert(document.querySelector('[data-filter="scope"]').textContent.includes('Brokerage'), 'Account chip follows a new choice');
    assert(visibleRows().length === 6, 'Changing the account updates records');
    reset();
    for (const scope of ['all', '0', '1', '2']) {
      for (const type of ['all', 'buy', 'sell', 'deposit', 'withdrawal']) {
        for (const symbol of ['all', 'NVDA', 'AAPL', 'MSFT', 'VTI', 'AMZN']) {
          Object.assign(state, { scope, type, symbol });
          const expected = seed.filter(t => (scope === 'all' || t.account === Number(scope)) && (type === 'all' || t.type === type) && (symbol === 'all' || t.symbol === symbol));
          assert(visibleRows().length === expected.length, `Combined filters: ${scope}/${type}/${symbol}`);
        }
      }
    }
    for (const id of ['mixed', 'trades', 'cash', 'empty']) {
      Object.assign(state, { id, scope: 'all', symbol: 'all', type: 'all' }); render();
      open('symbol');
      assert(document.querySelector('input[value="all"]'), `${id}: All symbols is always available`);
      if (id === 'cash' || id === 'empty') assert(document.querySelectorAll('#filter-options input').length === 1, `${id}: no unrelated symbols`);
      closeSheet();
    }
    reset();
    for (const theme of ['light', 'dark']) for (const fontScale of [100, 115, 140]) {
      Object.assign(state, { theme, fontScale }); render();
      await new Promise(requestAnimationFrame);
      const filters = document.querySelector('#history-filters');
      assert(filters.scrollWidth <= filters.clientWidth, `${theme}/${fontScale}: filters do not overflow`);
      for (const key of ['symbol', 'type', 'scope']) {
        open(key);
        assert(document.querySelector('.sheet').scrollWidth <= document.querySelector('.sheet').clientWidth, `${theme}/${fontScale}/${key}: picker does not overflow`);
        assert(document.querySelector('#apply-filter').getClientRects().length, `${theme}/${fontScale}/${key}: apply button visible`);
        closeSheet();
      }
    }
  } finally {
    if (document.querySelector('.sheet')) closeSheet();
    Object.assign(state, saved); render();
  }
  return { checks, failures, pass: failures.length === 0 };
})()
