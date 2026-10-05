// Run in accounts.html, e.g. agent-browser eval --stdin < check-accounts.js
(async () => {
  const failures = [];
  let checks = 0;
  const assert = (ok, message) => { checks++; if (!ok) failures.push(message); };
  const saved = { ...state }, savedRecords = structuredClone(records), savedNextId = nextId;
  const tick = () => new Promise(requestAnimationFrame);
  const fill = (name, value) => { document.querySelector(`[name="${name}"]`).value = value; };
  const reset = () => { Object.assign(state, { id: 'balanced', theme: 'light', fontScale: 115 }); render(); };
  try {
    if (document.querySelector('.sheet')) closeSheet();
    reset();
    assert(records.balanced.length === 3, 'Three initial accounts');
    assert(Math.abs(records.balanced.reduce((n, a) => n + total(a), 0) - 128462.5) < .001, 'Total matches portfolio overview');
    assert(!document.querySelector('#hero, #account-tools, #account-search, #sort-button, #result-count'), 'Summary, search, count and sort controls are removed');
    assert(document.querySelector('.page-heading').nextElementSibling.id === 'account-list', 'Page title leads directly into account list');
    assert(document.querySelectorAll('.account-row').length === 3, 'All accounts are rendered');
    const row = document.querySelector('[data-account="1"]');
    row.click();
    assert(document.querySelector('[role="dialog"]'), 'Account detail opens');
    assert(document.querySelector('.sheet').textContent.includes('$55,061.75'), 'Detail investment balance');
    assert(document.querySelector('#screen').inert && document.querySelector('#tab-bar').inert, 'Background is inert');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    assert(document.activeElement.classList.contains('close-sheet'), 'Tab enters dialog');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    assert(document.activeElement.textContent === 'Done', 'Shift+Tab wraps inside dialog');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert(!document.querySelector('.sheet') && !document.querySelector('#screen').inert, 'Escape dismisses dialog');
    assert(document.activeElement === row, 'Detail restores focus');
    row.click();
    document.querySelector('[data-edit="1"]').click();
    fill('name', '   ');
    document.querySelector('#account-form').requestSubmit();
    assert(!document.querySelector('#form-error').hidden, 'Whitespace-only name rejected');
    fill('name', 'A long account name to check wrapping and narrow screen layout');
    fill('institution', '<img src=x onerror="alert(1)">');
    const before = total(records.balanced[0]);
    document.querySelector('#account-form').requestSubmit();
    assert(records.balanced[0].name.startsWith('A long'), 'Account renamed');
    assert(total(records.balanced[0]) === before, 'Editing metadata does not change balances');
    assert(!document.querySelector('.account-row img'), 'User-entered content is escaped');
    assert(document.activeElement.dataset.account === '1', 'Editing restores focus to replaced account row');
    for (const id of ['balanced', 'cash', 'single', 'empty']) {
      Object.assign(state, { id }); render();
      assert(records[id].length === ({balanced:3,cash:3,single:1,empty:0})[id], `${id}: scenario count`);
      if (id === 'empty') {
        assert(!document.querySelector('.account-row'), 'Empty state has no invented accounts');
        assert(document.querySelector('.empty-state'), 'Empty onboarding is visible');
      }
      if (id === 'cash') {
        assert(records[id].every(a => a.investments === 0 && a.holdings === 0), 'Cash-only accounts have no invented holdings');
        assert([...document.querySelectorAll('.mix-bar .cash')].every(el => el.style.width === '100%'), 'Cash-only bars are fully sage');
      }
      for (const theme of ['light', 'dark']) for (const fontScale of [100,115,140]) {
        Object.assign(state, { theme, fontScale }); render(); await tick();
        assert(document.documentElement.scrollWidth <= window.innerWidth, `${id}/${theme}/${fontScale}: page has no horizontal overflow`);
        const screen = document.querySelector('#screen');
        assert(screen.scrollWidth <= screen.clientWidth, `${id}/${theme}/${fontScale}: screen has no horizontal overflow`);
        document.querySelector('#add-account').click();
        const sheet = document.querySelector('.sheet');
        assert(sheet.scrollWidth <= sheet.clientWidth, `${id}/${theme}/${fontScale}: form has no horizontal overflow`);
        closeSheet();
        const account = document.querySelector('.account-row');
        if (account) {
          account.click();
          const detail = document.querySelector('.sheet');
          assert(detail.scrollWidth <= detail.clientWidth, `${id}/${theme}/${fontScale}: detail has no horizontal overflow`);
          closeSheet();
        }
      }
    }
    Object.assign(state, { id: 'empty', fontScale: 115 }); render();
    document.querySelector('[data-command="add"]').click();
    assert(document.querySelectorAll('#account-form input, #account-form select').length === 1 && document.querySelector('#account-name'), 'Add form only asks for an account name');
    fill('name', '   ');
    document.querySelector('#account-form').requestSubmit();
    assert(!document.querySelector('#form-error').hidden && records.empty.length === 0, 'Adding rejects whitespace-only names');
    fill('name', '  Rainy day  ');
    document.querySelector('#account-form').requestSubmit();
    assert(records.empty.length === 1 && records.empty[0].name === 'Rainy day' && total(records.empty[0]) === 0, 'Name-only account starts with a zero balance');
    assert(records.empty[0].institution === '' && records.empty[0].type === 'brokerage', 'New account uses default metadata');
    assert(records.empty[0].investments === 0 && records.empty[0].holdings === 0, 'New account has no invented investments');
    assert(document.querySelectorAll('.account-row').length === 1 && !document.querySelector('.empty-state'), 'Adding first account replaces empty state');
    document.querySelector('#add-account').click();
    fill('name', 'Zero balance');
    document.querySelector('#account-form').requestSubmit();
    assert(records.empty.length === 2 && records.empty[1].cash === 0, 'Name-only add works from the header button');
    assert(records.balanced.length === 3, 'Scenario data remains isolated');
    document.querySelector('[data-command="settings"]').click();
    document.querySelector('[data-mobile-theme="dark"]').click();
    assert(document.querySelector('#phone').classList.contains('dark'), 'Mobile appearance changes theme');
    const slider = document.querySelector('#mobile-font'); slider.value = '140'; slider.dispatchEvent(new Event('input', { bubbles: true }));
    assert(state.fontScale === 140 && document.querySelector('#mobile-font-value').textContent === '140%', 'Mobile text-size control updates');
    closeSheet();
  } finally {
    if (document.querySelector('.sheet')) closeSheet();
    for (const key of Object.keys(records)) records[key] = savedRecords[key];
    nextId = savedNextId; Object.assign(state, saved); render();
    clearTimeout(toastTimer); document.querySelector('#toast').hidden = true;
  }
  return { checks, failures, pass: failures.length === 0, viewport: [window.innerWidth, window.innerHeight] };
})()
