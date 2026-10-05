// Run in transactions.html: agent-browser eval --stdin < check-transactions-date-picker.js
(async () => {
  let checks = 0; const failures = [];
  const assert = (ok, message) => { checks++; if (!ok) failures.push(message); };
  const saved = { ...state }, savedRecords = structuredClone(records), savedId = nextId;
  const click = selector => document.querySelector(selector).click();
  const fill = (name, value) => { const el = document.querySelector(`[name="${name}"]`); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const submit = () => document.querySelector('#transaction-form').requestSubmit();
  const wait = () => new Promise(resolve => setTimeout(resolve, 200));
  const start = () => {
    openAdd(document.querySelector('#add-transaction'));
    click('[data-wizard-type="buy"]');
    fill('symbol', 'NVDA'); fill('shares', '2'); fill('price', '100'); fill('note', 'Preserve this note');
  };
  try {
    if (document.querySelector('.sheet')) closeSheet();
    Object.assign(state, { id: 'empty', scope: 'all', type: 'all', symbol: 'all' }); render(); start();
    const page = document.querySelector('.wizard-page'), box = page.getBoundingClientRect(), phone = document.querySelector('#phone').getBoundingClientRect();
    const top = document.querySelector('.status').getClientRects().length ? document.querySelector('.status').getBoundingClientRect().bottom : phone.top;
    assert(Math.abs(box.top - top) <= 1 && Math.abs(box.bottom - phone.bottom) <= 1, 'Wizard fills the phone below status bar, without modal margins');
    assert(page.getAttribute('role') === 'region' && !document.querySelector('#overlay-root .overlay'), 'Wizard is a page, not a modal overlay');
    assert(!document.querySelector('#overlay-root .sheet-grabber, #overlay-root .close-sheet'), 'No sheet grabber or circular close button');
    assert(!document.querySelector('input[type="date"]'), 'No native date input');
    assert(document.querySelector('#date-chip-text').textContent === 'Today', 'Date defaults to Today');
    click('#transaction-date');
    assert(document.querySelectorAll('.date-wheel').length === 3, 'Month, day and year wheels');
    assert(page.inert, 'Date sheet makes parent page inert');
    assert(document.querySelector('.date-sheet').getAttribute('aria-modal') === 'true', 'Only date sheet is modal');
    click('#date-month-9'); click('#date-day-30');
    assert(draft.date === '2025-09-30', 'Tap wheel values selects a date');
    click('[data-command="date-done"]');
    assert(document.querySelector('#date-chip-text').textContent === 'September 30, 2025', 'Chip shows selected date');
    assert(document.activeElement.id === 'transaction-date', 'Done restores focus to date chip');
    assert(document.querySelector('[name="shares"]').value === '2' && document.querySelector('[name="note"]').value === 'Preserve this note', 'Date selection preserves fields');
    click('#transaction-date'); click('#date-year-2024'); click('#date-month-2'); click('#date-day-29');
    assert(draft.date === '2024-02-29', 'Leap day is selectable');
    click('#date-year-2023'); assert(draft.date === '2023-02-28', 'Leap day clamps when changing to non-leap year');
    const dayWheel = document.querySelector('[data-date-part="day"]'); dayWheel.focus();
    dayWheel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    assert(draft.date === '2023-02-27', 'Arrow keys move the focused wheel');
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    assert(draft.date === '2023-02-28', 'End selects final available day');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert(!document.querySelector('.date-sheet') && document.querySelector('.wizard-page') && draft.step === 2, 'Escape dismisses picker, not wizard');
    click('#transaction-date');
    document.querySelector('[data-date-part="day"]').scrollTop = 9 * 44;
    await wait(); assert(draft.date === '2023-02-10', 'Scrolling wheel commits its snapped value');
    document.querySelector('[data-date-part="day"]').scrollTop = 14 * 44;
    click('[data-command="date-done"]');
    assert(draft.date === '2023-02-15', 'Done commits visible wheel even before scroll debounce');
    click('#transaction-date'); click('#date-month-12'); click('#date-day-31'); click('#date-year-2025');
    assert(draft.date === previewToday, 'Year change clamps dates beyond preview today');
    assert(!document.querySelector('#date-month-11, #date-day-4'), 'Future months and days are unavailable');
    click('.date-overlay'); assert(!document.querySelector('.date-sheet') && draft, 'Backdrop dismisses date sheet only');
    click('#transaction-date'); click('#date-month-9'); click('#date-day-22'); click('[data-command="date-done"]');
    submit(); click('[data-edit-field="transaction-account"]'); assert(draft.step === 2, 'Receipt edit revisits composer');
    fill('account', '1');
    assert(draft.date === '2025-09-22' && document.querySelector('[name="shares"]').value === '2', 'Account edit preserves date and trade details');
    submit(); assert(document.querySelector('.receipt').textContent.includes('September 22, 2025'), 'Review shows selected date');
    submit(); assert(records.empty.at(-1).date === '2025-09-22' && records.empty.at(-1).account === 1, 'Confirmation records selected date and edited account');
    openAdd(); click('[data-command="wizard-back"]'); assert(!draft && !document.querySelector('.wizard-page'), 'Top back at first step returns to transactions');
    for (const theme of ['light', 'dark']) for (const fontScale of [100, 115, 140]) {
      Object.assign(state, { theme, fontScale }); render(); start(); click('#transaction-date');
      await new Promise(requestAnimationFrame);
      const sheet = document.querySelector('.date-sheet');
      assert(sheet.scrollWidth <= sheet.clientWidth, `${theme}/${fontScale}: date sheet has no horizontal overflow`);
      for (const wheel of document.querySelectorAll('.date-wheel')) {
        const selected = wheel.querySelector('[aria-selected="true"]'), row = selected.getBoundingClientRect(), band = document.querySelector('.wheel-band').getBoundingClientRect();
        assert(Math.abs(row.top - band.top) <= 1, `${theme}/${fontScale}/${wheel.dataset.datePart}: selected option aligns with hairline band`);
        assert(wheel.scrollWidth <= wheel.clientWidth, `${theme}/${fontScale}/${wheel.dataset.datePart}: wheel fits column`);
      }
      closeSheet();
    }
  } catch (error) { failures.push(error.stack); }
  finally {
    if (document.querySelector('.sheet')) closeSheet();
    Object.keys(records).forEach(key => records[key] = savedRecords[key]);
    nextId = savedId; Object.assign(state, saved); render();
  }
  return { checks, failures, pass: failures.length === 0 };
})()
