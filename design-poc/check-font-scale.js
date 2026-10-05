(async () => {
  await document.fonts.ready;
  const failures = [];
  let checks = 0;
  const assert = (ok, message) => { checks++; if (!ok) failures.push(message); };
  const frame = () => new Promise(requestAnimationFrame);
  const slider = document.querySelector('#font-scale');
  const output = document.querySelector('#font-scale-value');
  const initialScale = state.fontScale;
  const saved = localStorage.getItem(fontScaleKey);
  const initialWidth = document.querySelector('#phone').style.width;
  const change = async value => {
    slider.value = value;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await frame();
  };
  try {
    await change(100);
    const baseSize = parseFloat(getComputedStyle(document.querySelector('.company')).fontSize);
    const deviceWidth = document.querySelector('#phone').getBoundingClientRect().width;
    screen.scrollTop = 150;
    await change(140);
    assert(output.value === '140%', 'Slider output did not update');
    assert(slider.getAttribute('aria-valuetext') === '140 percent', 'Accessible slider value did not update');
    assert(localStorage.getItem(fontScaleKey) === '140', 'Font preference was not saved');
    assert(Math.abs(parseFloat(getComputedStyle(document.querySelector('.company')).fontSize) / baseSize - 1.4) < 0.01, 'Body text did not scale by 140%');
    assert(document.querySelector('#phone').getBoundingClientRect().width === deviceWidth, 'Device was scaled instead of text');
    assert(screen.scrollTop > 0, 'Slider reset the view to the top');
    state.id = 'fractional'; state.expanded = new Set([0, 1]); render();
    document.querySelector('#phone').style.width = '375px';
    await frame();
    assert(screen.scrollWidth <= screen.clientWidth, 'Large fractional-account layout overflows');
    showLot(0, 0);
    await frame();
    assert(Math.abs(parseFloat(getComputedStyle(document.querySelector('.detail-pair')).fontSize) - 16.8) < 0.1, 'Transaction details did not scale');
    render();
    openSheet('buy', document.querySelector('#actions [data-action="buy"]'));
    assert(Math.abs(parseFloat(getComputedStyle(document.querySelector('.sheet label')).fontSize) - 15.4) < 0.1, 'Buy sheet did not scale');
    closeSheet();
    state.id = 'multi'; render();
    document.querySelector('#phone').style.width = '300px';
    await change(100);
    const originalHeroSize = parseFloat(getComputedStyle(document.querySelector('.hero-value')).fontSize);
    await change(140);
    const hero = document.querySelector('.hero-value');
    assert(hero.scrollWidth <= hero.clientWidth + 1, 'Large headline is clipped');
    await change(100);
    assert(Math.abs(parseFloat(getComputedStyle(hero).fontSize) - originalHeroSize) < 0.1, 'Headline failed to recover after fitting');
    document.querySelector('#font-scale-reset').click();
    assert(state.fontScale === 100 && output.value === '100%', 'Reset did not restore original typography');
  } finally {
    if (activeSheet) closeSheet();
    if (saved === null) localStorage.removeItem(fontScaleKey);
    else localStorage.setItem(fontScaleKey, saved);
    document.querySelector('#phone').style.width = initialWidth;
    state.id = 'multi'; state.expanded.clear(); render();
    setFontScale(initialScale);
  }
  return { checks, failures, pass: failures.length === 0 };
})()
