(() => {
  const input = document.querySelector('#walletSearch');
  const cards = [...document.querySelectorAll('.profile-card')];
  const filters = [...document.querySelectorAll('.filter')];
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  input?.addEventListener('input', () => {
    const query = normalize(input.value);
    cards.forEach(card => { card.hidden = query && !normalize(card.textContent).includes(query); });
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); input?.focus(); }
  });
  filters.forEach(filter => filter.addEventListener('click', () => {
    filters.forEach(item => item.classList.remove('active'));
    filter.classList.add('active');
    const mode = filter.textContent.trim();
    cards.forEach(card => { card.hidden = mode === 'warnings' ? !card.classList.contains('warning-card') : false; });
  }));
})();
