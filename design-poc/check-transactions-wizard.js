// Run in transactions.html: agent-browser eval --stdin < check-transactions-wizard.js
(async () => {
  const failures = []; let checks = 0;
  const assert = (ok, message) => { checks++; if (!ok) failures.push(message); };
  const saved = { ...state }, savedRecords = structuredClone(records), savedId = nextId;
  const click = selector => document.querySelector(selector).click();
  const fill = (name, value) => {
    const input = document.querySelector(`[name="${name}"]`);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const submit = () => document.querySelector('#transaction-form')?.requestSubmit();
  const start = type => { openAdd(document.querySelector('#add-transaction')); click(`[data-wizard-type="${type}"]`); };
  try {
    if (document.querySelector('.sheet')) closeSheet();
    Object.assign(state, { id: 'empty', scope: 'all', type: 'all', symbol: 'all' }); render();
    openAdd();
    assert(document.querySelectorAll('[data-wizard-type]').length === 5, 'All four transaction types and reconciliation are direct choices');
    assert(!document.querySelector('.wizard-progress'), 'Chooser has no artificial progress step');
    click('[data-command="request-close"]');
    assert(!draft, 'Untouched chooser exits without a warning');
    const cases = [
      ['buy', 'USD', { symbol: 'nvda', shares: '2.5', price: '100', fee: '1' }, -251],
      ['sell', 'CAD', { symbol: 'AAPL', shares: '2', price: '200', fee: '2' }, 398],
      ['deposit', 'EUR', { amount: '1250', fee: '5' }, 1245],
      ['withdrawal', 'GBP', { amount: '300', fee: '2' }, -302]
    ];
    for (const [type, currency, fields, impact] of cases) {
      const before = records.empty.length;
      start(type);
      assert(draft.step === 2, `${type}: straight to composer, no account-only screen`);
      assert(document.querySelector('[name="account"]') && document.querySelector('[name="currency"]'), `${type}: context editable beside details`);
      assert(!document.querySelector('.entry-extras').open, `${type}: optional details start collapsed`);
      assert(document.querySelector('#form-impact').textContent === '—', `${type}: incomplete amount not misrepresented as zero`);
      fill('currency', currency);
      assert([...document.querySelectorAll('[data-currency-label]')].every(el => el.textContent === currency), `${type}: currency change relabels fields and summary`);
      submit();
      assert(draft.step === 2 && document.activeElement.getAttribute('aria-invalid') === 'true', `${type}: required fields block submit and focus the error`);
      Object.entries(fields).forEach(([key, value]) => fill(key, value));
      document.querySelector('.entry-extras').open = true;
      fill('note', 'Test <safe> & clear');
      assert(document.querySelector('#form-impact').textContent === currencyMoney(impact, currency, true), `${type}: live net amount after fees`);
      submit();
      assert(draft.step === 3 && document.querySelector('.receipt'), `${type}: receipt review`);
      assert(records.empty.length === before, `${type}: review does not save`);
      assert(!document.querySelector('.receipt safe'), `${type}: note is escaped`);
      click('[data-edit-field="transaction-account"]');
      assert(draft.step === 2 && document.activeElement.id === 'transaction-account', `${type}: Edit returns directly to field`);
      assert(document.querySelector('[name="note"]').value === 'Test <safe> & clear', `${type}: editing preserves note`);
      submit(); submit();
      const t = records.empty.at(-1);
      assert(t.type === type && t.currency === currency && cashImpact(t) === impact, `${type}: confirmed record`);
      assert(draft.step === 4 && document.querySelector('.success-body'), `${type}: explicit success state`);
      assert(currencyBalance(0, currency) === impact, `${type}: preview balance updated`);
      const count = records.empty.length;
      confirmDraft(); assert(records.empty.length === count, `${type}: repeated confirmation cannot duplicate`);
      click('[data-command="undo-record"]');
      assert(records.empty.length === before && draft.step === 2, `${type}: undo restores ledger and editable draft`);
      assert(currencyBalance(0, currency) === 0, `${type}: undo restores balance`);
      submit(); submit(); click('[data-command="view-records"]');
      assert(!draft && !document.querySelector('.sheet'), `${type}: View transactions closes confirmation`);
      showDetail(records.empty.at(-1).id);
      assert(document.querySelector('.detail-caption').textContent.includes(currency), `${type}: detail retains currency`); closeSheet();
    }
    start('sell'); fill('symbol', '<bad>'); fill('shares', '1'); fill('price', '10'); submit();
    assert(draft.step === 2 && document.activeElement.id === 'transaction-symbol', 'Invalid ticker focuses symbol');
    fill('symbol', 'NVDA'); fill('fee', '10'); submit();
    assert(draft.step === 2 && document.querySelector('.entry-extras').open && document.activeElement.id === 'transaction-fee', 'Fee error reveals optional section and focuses field');
    click('[data-command="request-close"]');
    assert(document.querySelector('.discard-sheet') && document.querySelector('.wizard-page').inert, 'Dirty entry requires discard confirmation');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert(!document.querySelector('.discard-sheet') && draft.symbol === 'NVDA', 'Escape keeps unfinished entry');
    click('[data-command="request-close"]'); click('[data-command="discard-entry"]');
    assert(!draft, 'Explicit discard exits');
    start('buy'); fill('symbol', 'nvidia');
    assert(document.querySelector('[data-security="NVDA"]'), 'Search supports company names');
    click('[data-security="NVDA"]');
    assert(draft.symbol === 'NVDA' && document.activeElement.id === 'transaction-shares', 'Security shortcut advances focus without inventing a price');
    click('[data-quick-date]'); assert(draft.date === '2025-10-02' && draft.symbol === 'NVDA', 'Yesterday shortcut preserves details');
    click('[data-quick-date]'); assert(draft.date === previewToday, 'Today shortcut restores preview date');
    closeSheet();
    start('balances');
    fill('account', '1');
    assert(draft.date === previewToday && !document.querySelector('[data-command="pick-date"]'), 'Reconciliation uses fixed preview date');
    assert(document.querySelectorAll('[name^="balance-"]').length === 4, 'Four independent currencies');
    assert(document.querySelector('#wizard-next').disabled, 'No-op reconciliation cannot proceed');
    fill('balance-USD', '-1'); assert(document.querySelector('#wizard-next').disabled, 'Negative target rejected');
    fill('balance-USD', '1000.25'); fill('balance-CAD', '200');
    const before = records.empty.length;
    submit(); assert(draft.step === 3 && balanceChanges().length === 2, 'Only changed currencies reviewed');
    assert(records.empty.length === before, 'Balance review does not save');
    assert(document.querySelectorAll('.adjustment-row').length === 2, 'Each generated transaction shown');
    click('[data-edit-field="balance-USD"]');
    assert(document.querySelector('#balance-USD').value === '1000.25' && document.activeElement.id === 'balance-USD', 'Balance Edit preserves value and focuses currency');
    submit(); submit();
    assert(records.empty.length === before + 2, 'Batch creates exactly two deposits');
    assert(currencyBalance(1, 'USD') === 1000.25 && currencyBalance(1, 'CAD') === 200, 'Target balances reached');
    click('[data-command="undo-record"]');
    assert(records.empty.length === before && currencyBalance(1, 'USD') === 0 && currencyBalance(1, 'CAD') === 0, 'Batch undo removes every generated record');
    submit(); submit(); click('[data-command="add-another"]');
    assert(draft.step === 0 && Number(draft.account) === 1, 'Add another retains account context with an empty entry');
    click('[data-wizard-type="balances"]');
    assert(document.querySelector('#balance-USD').value === '1000.25', 'Repeated reconciliation reads latest balances');
    fill('balance-USD', '900.10'); fill('balance-CAD', '250'); submit();
    const changes = balanceChanges();
    assert(changes.find(t => t.currency === 'USD').type === 'withdrawal' && changes.find(t => t.currency === 'USD').amount === 100.15, 'Decrease creates exact withdrawal');
    assert(changes.find(t => t.currency === 'CAD').type === 'deposit' && changes.find(t => t.currency === 'CAD').amount === 50, 'Increase creates deposit');
    submit(); closeSheet();
    start('balances'); fill('balance-USD', '500'); fill('account', '2');
    assert(document.querySelector('#balance-USD').value === '0.00', 'Changing account resets reconciliation targets immediately');
    closeSheet();
    start('balances'); click('[data-command="request-close"]');
    assert(!draft, 'Untouched balances can exit without false dirty warning');
    for (const theme of ['light', 'dark']) for (const fontScale of [100, 115, 140]) {
      Object.assign(state, { theme, fontScale }); render();
      for (const type of ['buy', 'sell', 'deposit', 'withdrawal', 'balances']) {
        start(type);
        await new Promise(requestAnimationFrame);
        const page = document.querySelector('.sheet'), body = document.querySelector('.wizard-body');
        assert(page.scrollWidth <= page.clientWidth && body.scrollWidth <= body.clientWidth, `${theme}/${fontScale}/${type}: no horizontal overflow`);
        const footer = document.querySelector('.wizard-footer').getBoundingClientRect(), box = page.getBoundingClientRect();
        assert(footer.bottom <= box.bottom + 1 && footer.top >= box.top, `${theme}/${fontScale}/${type}: footer inside page`);
        if (type !== 'balances') {
          if (['buy', 'sell'].includes(type)) { fill('symbol', 'NVDA'); fill('shares', '2'); fill('price', '100'); }
          else fill('amount', '200');
          submit();
          assert(document.querySelector('.wizard-body').scrollWidth <= document.querySelector('.wizard-body').clientWidth, `${theme}/${fontScale}/${type}: review fits`);
          submit();
          assert(document.querySelector('.wizard-body').scrollWidth <= document.querySelector('.wizard-body').clientWidth, `${theme}/${fontScale}/${type}: success fits`);
          click('[data-command="undo-record"]');
        }
        closeSheet();
      }
    }
  } catch (error) { failures.push(error.stack); }
  finally {
    if (document.querySelector('.sheet')) closeSheet();
    Object.keys(records).forEach(key => records[key] = savedRecords[key]);
    nextId = savedId; Object.assign(state, saved); render();
  }
  return { checks, failures, pass: failures.length === 0 };
})()
