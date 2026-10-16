(() => {
  const modal = document.querySelector('#repPreview');
  const video = document.querySelector('#repPreviewVideo');
  if (!modal) return;

  const open = () => {
    modal.hidden = false;
    modal.style.display = 'grid';
    if (video) video.play?.().catch(() => {});
  };

  const close = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    try { video?.pause?.(); } catch {}
    modal.hidden = true;
    modal.style.display = 'none';
    try { localStorage.setItem('repPreviewSeen', '1'); } catch {}
  };

  document.querySelector('#repPreviewClose')?.addEventListener('click', close);
  document.querySelector('#repPreviewEnter')?.addEventListener('click', close);
  modal.addEventListener('click', event => {
    if (event.target === modal) close(event);
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) close(event);
  });

  open();
})();
