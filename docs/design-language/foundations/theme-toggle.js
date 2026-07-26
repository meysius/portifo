function setTheme(mode, btn){
  if(mode){ document.documentElement.setAttribute('data-theme', mode); }
  else{ document.documentElement.removeAttribute('data-theme'); }
  document.querySelectorAll('.theme-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
}
