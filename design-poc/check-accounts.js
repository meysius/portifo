// Run in accounts.html: agent-browser eval --stdin < design-poc/check-accounts.js
(async () => {
  const failures = [];
  let checks = 0;
  const assert = (ok, message) => { checks++; if (!ok) failures.push(message); };
  const saved = { ...state }, savedRecords = structuredClone(records), savedNextId = nextId;
  const savedScroll = listScroll;
  const tick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const fill = (selector, value) => {
    const el = document.querySelector(selector);
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const submit = selector => document.querySelector(selector).requestSubmit();
  const click = selector => document.querySelector(selector).click();
  const within = (selector, label) => {
    const el = document.querySelector(selector);
    assert(el.scrollWidth <= el.clientWidth + 1, `${label}: no horizontal overflow`);
  };
  try {
    closeSheet(false);
    Object.assign(state, { theme: 'light', fontScale: 115, currency: 'USD' });
    selectScenario('balanced');
    assert(document.querySelectorAll('.account-row').length === 6, 'Six accounts inspired by the supplied screenshots');
    assert(Math.abs(total(records.balanced[0]) - 101887.59) < .001, 'TFSA includes USD and converted CAD cash');
    assert(Math.abs(total(records.balanced[2]) - 53274.86) < .001, 'Margin total matches screenshot');
    assert(!document.querySelector('.hero, .account-search, .mix-bar'), 'List has no repeated portfolio hero, search, or decorative allocation bars');
    assert(document.querySelector('.page-heading').nextElementSibling.id === 'account-list', 'Title leads directly into the list');
    assert(!document.querySelector('#tab-bar').hidden, 'Root shows the tab bar');
    assert(!document.querySelector('.account-meta, .account-bottom'), 'List has no holdings counts or cash-only labels');
    const icons = [...document.querySelectorAll('.account-row .account-icon')];
    assert(new Set(icons.map(el => el.innerHTML)).size === 1 && icons.every(el => !el.classList.contains('cash')), 'Every account uses the same generic icon');
    const firstRow = document.querySelector('.account-row');
    assert(getComputedStyle(firstRow).minHeight === '60px' && getComputedStyle(firstRow).gap === '10px', 'Rows match transaction ledger height and spacing');
    assert(parseFloat(getComputedStyle(firstRow.querySelector('.account-value')).fontSize) === 12.65, 'Amount uses transaction ledger typography at 115%');
    assert(firstRow.querySelector('.account-value').getBoundingClientRect().left > firstRow.querySelector('.account-name').getBoundingClientRect().left, 'Account amount is on the right');
    const row = document.querySelector('[data-account="3"]');
    row.click();
    assert(!document.querySelector('[role="dialog"]'), 'Account opens as a pushed page, not a sheet');
    assert(document.querySelector('#tab-bar').hidden, 'Pushed account hides root tab bar');
    const back = document.querySelector('.back'), backIcon = back.querySelector('svg');
    assert(parseFloat(getComputedStyle(back).fontSize) === 17.25 && getComputedStyle(back).paddingTop === '9px', 'Back button matches holding-detail typography and padding');
    assert(backIcon.getAttribute('width') === '22' && backIcon.getAttribute('height') === '24' && backIcon.getAttribute('stroke-width') === '2' && backIcon.querySelector('path').getAttribute('d') === 'm14 5-7 7 7 7', 'Back chevron matches the other POC');
    assert(document.querySelector('.hero-value').textContent === '$53,274.86', 'Detail headline matches account total');
    assert(document.querySelectorAll('.holding-row').length === 3, 'Margin has three holdings');
    assert(document.querySelector('.cash-row').textContent.includes('−$0.12'), 'Negative cash remains neutral, signed, and accurate');
    assert(document.querySelectorAll('.holding-return .negative').length === 1, 'URA has a negative unrealized return');
    click('[data-holding="URA"]');
    assert(document.querySelector('[role="dialog"]'), 'Holding preview opens');
    assert(document.querySelector('.sheet').textContent.includes('This account only'), 'Holding preview keeps account scope explicit');
    assert(document.querySelector('#screen').inert && document.querySelector('#navigation').inert, 'Dialog background is inert');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    assert(document.activeElement.classList.contains('close-sheet'), 'Tab enters the dialog');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    assert(document.activeElement.tagName === 'A', 'Shift+Tab wraps to the last dialog control');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert(!document.querySelector('.sheet') && !document.querySelector('#screen').inert, 'Escape dismisses dialog and removes inert');
    assert(document.activeElement.dataset.holding === 'URA', 'Closing restores focus to holding row');
    click('[data-command="back"]');
    assert(document.activeElement.dataset.account === '3', 'Back restores focus to the account row');
    click('[data-account="1"]');
    assert(document.querySelectorAll('.cash-row').length === 2, 'Multi-currency cash shown as separate native balances');
    assert(document.querySelector('[data-cash="CAD"]').textContent.includes('CA$2,000.00'), 'CAD balance stays native');
    const usdTotal = total(currentAccount());
    click('[data-command="currency"]');
    click('[data-display-currency="CAD"]');
    assert(Math.abs(total(currentAccount()) - usdTotal / .735) < .001, 'Display currency converts the total');
    assert(document.querySelector('[data-cash="USD"]').textContent.includes('$6,750.00'), 'Currency change does not convert native cash rows');
    click('[data-command="back"]');
    assert(document.querySelector('[data-account="1"] .account-value').textContent === '$101,887.59', 'List stays in USD after changing detail currency');
    assert(document.querySelector('[data-account="5"] .account-value').textContent === '$11,613.18', 'Cash-only account total is converted to USD');
    click('[data-account="1"]');
    state.currency = 'USD'; render();
    click('[data-cash="CAD"]');
    fill('#cash-amount', '-125.50'); submit('#cash-form');
    assert(currentAccount().balances.find(b => b.currency === 'CAD').amount === -125.5, 'Cash balance can be set negative');
    assert(document.activeElement.dataset.cash === 'CAD', 'Saving cash restores focus to the updated row');
    const before = total(currentAccount());
    click('[data-command="rename"]');
    fill('#account-name', '   '); submit('#rename-form');
    assert(!document.querySelector('#form-error').hidden, 'Rename rejects whitespace');
    fill('#account-name', '<img src=x onerror="alert(1)">'); submit('#rename-form');
    assert(!document.querySelector('#screen img'), 'Account names are escaped');
    assert(total(currentAccount()) === before, 'Rename leaves holdings and balances unchanged');
    selectScenario('cash');
    assert(!document.querySelector('.holding-row, .balance-split'), 'Cash-only detail has no invented holdings or redundant split');
    assert(document.querySelector('.cash-row') && document.querySelector('.hero-value'), 'Cash-only detail retains its cash and value');
    selectScenario('empty');
    assert(document.querySelector('.empty-state') && !document.querySelector('.account-row'), 'Empty scenario has honest onboarding');
    click('[data-command="add"]');
    assert(document.querySelector('.sheet.create'), 'Create is a focused full-screen form');
    assert(document.querySelector('#create-submit').disabled, 'Create stays disabled without a name');
    fill('#account-name', '   ');
    assert(document.querySelector('#create-submit').disabled, 'Whitespace does not enable Create');
    submit('#account-form');
    assert(!document.querySelector('#form-error').hidden, 'Submit validation also rejects whitespace');
    fill('#account-name', '  Rainy day  '); submit('#account-form');
    assert(records.empty.length === 1 && records.empty[0].name === 'Rainy day', 'Name-only account is trimmed and added');
    assert(records.empty[0].positions.length === 0 && records.empty[0].balances.length === 0, 'Blank opening cash creates no invented balances or investments');
    assert(!document.querySelector('.empty-state'), 'First account replaces onboarding');
    assert(document.activeElement.classList.contains('account-row'), 'Creating focuses the new account row');
    click('[data-account="7"]');
    assert(document.querySelector('.empty-state') && document.querySelector('[data-command="cash-add"]'), 'New zero-balance account offers an honest empty state and cash action');
    click('[data-command="back"]');
    click('#add-account');
    fill('#account-name', 'Multi-currency wallet');
    fill('[data-balance-index="0"]', '500');
    click('[data-command="add-currency"]');
    fill('[data-balance-index="1"]', '-100');
    fill('[data-currency-index="1"]', 'USD');
    submit('#account-form');
    assert(document.querySelector('#form-error').textContent.includes('each currency once'), 'Duplicate currencies rejected');
    fill('[data-currency-index="1"]', 'CAD'); submit('#account-form');
    assert(records.empty.length === 2, 'Multi-currency account is created');
    assert(Math.abs(total(records.empty[1]) - 426.5) < .001, 'Opening balances contribute using illustrative FX');
    assert(records.balanced.length === 6, 'Scenario data remains isolated');
    click('#add-account');
    fill('#account-name', 'Too large');fill('[data-balance-index="0"]', '1000000000000');submit('#account-form');
    assert(!document.querySelector('#form-error').hidden && records.empty.length === 2, 'Excessively large cash rejected');
    click('[data-remove-balance="0"]');
    assert(document.querySelectorAll('.balance-entry').length === 0, 'Opening cash is removable');
    submit('#account-form');
    assert(records.empty.length === 3 && records.empty[2].balances.length === 0, 'Creation works after removing all cash fields');
    click('[data-command="settings"]');
    click('[data-mobile-theme="dark"]');
    assert(document.querySelector('#phone').classList.contains('dark'), 'Mobile settings changes appearance');
    fill('#mobile-font', '140');
    assert(state.fontScale === 140 && document.querySelector('#mobile-font-value').textContent === '140%', 'Mobile settings changes text size');
    closeSheet(false);
    // Probe long names, large balances, every state, theme and text size at the current viewport.
    records.balanced[0].name = 'A long account name to check wrapping and narrow screen layout';
    records.balanced[0].balances[0].amount = 999999999999;
    for (const id of ['balanced', 'detail', 'cash', 'empty']) {
      for (const theme of ['light', 'dark']) for (const fontScale of [100, 115, 140]) {
        Object.assign(state, { theme, fontScale });selectScenario(id);await tick();
        const label = `${id}/${theme}/${fontScale}`;
        assert(document.documentElement.scrollWidth <= window.innerWidth, `${label}: page has no horizontal overflow`);
        within('#screen', `${label}: screen`);
        document.querySelectorAll('.account-value').forEach(el => assert(el.scrollWidth <= el.clientWidth + 1, `${label}: amount is not clipped`));
        if (state.view === 'list') click('#add-account');else click('[data-command="cash-add"]');
        await tick();within('.sheet', `${label}: dialog`);
        if (document.querySelector('.form-body')) within('.form-body', `${label}: form body`);
        closeSheet(false);
        if (id === 'balanced') {
          click('[data-account="1"]');await tick();within('#screen', `${label}: long-name, large-balance detail`);
        }
      }
    }
  } finally {
    closeSheet(false);
    for (const key of Object.keys(records)) records[key] = savedRecords[key];
    nextId = savedNextId; listScroll = savedScroll;Object.assign(state, saved);render();
    clearTimeout(toastTimer);document.querySelector('#toast').hidden = true;
  }
  return { checks, failures, pass: failures.length === 0, viewport: [window.innerWidth, window.innerHeight] };
})()
