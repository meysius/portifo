// Run on any POC or the app: agent-browser eval --stdin < design-poc/check-field-focus.js
// Uses disposable, unsaved fields to verify the shared CSS, including when the
// real app is logged out. No accounts or transactions are read or written.
(async () => {
  const failures = [];
  let checks = 0;
  const assert = (ok, message) => { checks++; if (!ok) failures.push(message); };
  const phone = document.querySelector('.phone');
  const host = phone || document.body;
  const originalFocus = document.activeElement;
  const dark = phone ? phone.classList.contains('dark') : document.documentElement.classList.contains('ion-palette-dark');
  const themeRoot = phone || document.documentElement;
  const themeClass = phone ? 'dark' : 'ion-palette-dark';
  const fixture = document.createElement('section');
  fixture.className = `focus-check ${phone ? 'sheet' : 'ds-screen'}`;
  fixture.style.cssText = 'position:fixed;left:23px;top:60px;width:270px;z-index:9999;padding:10px;background:var(--bg,var(--ds-bg));';
  fixture.innerHTML = `
    <input class="focus-check-box" type="text" aria-label="Focus test text">
    <input class="focus-check-box" type="number" aria-label="Focus test number">
    <select class="focus-check-box" aria-label="Focus test select"><option>USD</option></select>
    <input class="focus-check-name ${phone ? 'name-field' : 'acct-name'}" aria-label="Focus test name">
    <div class="${phone ? 'search-field' : 'tl-search-field'}"><input type="search" aria-label="Focus test search"></div>
    ${phone ? '' : '<label class="wiz-field"><input aria-label="Focus test figure"></label><div class="wiz-inline"><input class="wiz-text" aria-label="Focus test inline"></div>'}
    <input type="radio" aria-label="Focus test radio">
    <input type="range" aria-label="Focus test range">
    <button type="button">Focus test action</button>`;
  const styles = document.createElement('style');
  styles.textContent = `
    :where(.focus-check) .focus-check-box { width:220px;height:36px;border:1px solid var(--line,var(--ds-line));border-radius:8px;background:var(--subtle,var(--ds-subtle));margin-bottom:8px; }
    :where(.focus-check) .focus-check-name { width:220px;margin:0;border:0;border-bottom:1px solid var(--line,var(--ds-line));border-radius:0; }
    .focus-check button { padding:8px; }
  `;
  document.head.append(styles);host.append(fixture);
  const frame = () => new Promise(requestAnimationFrame);
  try {
    for (const mode of ['light', 'dark']) {
      themeRoot.classList.toggle(themeClass, mode === 'dark');
      const accent = getComputedStyle(fixture).getPropertyValue(phone ? '--accent' : '--ds-accent').trim();
      const swatch = document.createElement('span');swatch.style.color = accent;fixture.append(swatch);
      const expected = getComputedStyle(swatch).color;swatch.remove();
      for (const el of fixture.querySelectorAll('.focus-check-box')) {
        el.blur();const before = el.getBoundingClientRect();el.focus();await frame();
        const css = getComputedStyle(el),after = el.getBoundingClientRect();
        assert(css.outlineStyle === 'none', `${mode}/${el.type}: no exterior field outline`);
        assert(css.borderColor === expected, `${mode}/${el.type}: theme-aware accent border`);
        assert(css.boxShadow.includes('inset') && css.boxShadow.includes('1px'), `${mode}/${el.type}: contained focus indicator`);
        assert(before.width === after.width && before.height === after.height, `${mode}/${el.type}: no layout shift`);
      }
      const number = fixture.querySelector('input[type="number"]');
      assert(getComputedStyle(number).appearance === 'textfield', `${mode}: number spinner chrome removed`);
      const name = fixture.querySelector('.focus-check-name');name.focus();
      assert(getComputedStyle(name).outlineStyle === 'none' && getComputedStyle(name).boxShadow.includes('0px -1px'), `${mode}: name remains an underline field`);
      const search = fixture.querySelector('input[type="search"]');search.focus();
      assert(getComputedStyle(search).outlineStyle === 'none' && getComputedStyle(search).boxShadow === 'none', `${mode}: no nested search focus rectangle`);
      assert(getComputedStyle(search.parentElement).boxShadow.includes('inset'), `${mode}: search shell has a focus indicator`);
      if (!phone) {
        for (const selector of ['.wiz-field input', '.wiz-inline input']) {
          const input = fixture.querySelector(selector);input.focus();
          assert(getComputedStyle(input).outlineStyle === 'none' && getComputedStyle(input).boxShadow === 'none', `${mode}/${selector}: parent owns focus indicator`);
          assert(getComputedStyle(input.parentElement).boxShadow.includes('inset'), `${mode}/${selector}: visible parent focus indicator`);
        }
        name.classList.add('taken');name.focus();
        assert(getComputedStyle(name).borderBottomColor !== expected, `${mode}: invalid account name retains error colour`);
        name.classList.remove('taken');
      }
      // Force the browser's keyboard modality before checking action controls.
      search.focus();search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      for (const el of fixture.querySelectorAll('button,input[type="radio"],input[type="range"]')) {
        el.focus();
        if (el.matches(':focus-visible')) assert(getComputedStyle(el).outlineStyle !== 'none', `${mode}/${el.type}: keyboard focus is retained`);
      }
    }
  } finally {
    themeRoot.classList.toggle(themeClass, dark);fixture.remove();styles.remove();
    originalFocus?.focus({ preventScroll: true });
  }
  return { checks, failures, pass: failures.length === 0, target: phone ? document.title : 'App CSS (disposable fixtures)' };
})()
