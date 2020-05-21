document.addEventListener('DOMContentLoaded', () => {
  const el_butt = document.getElementsByTagName('button')[0];
  if (el_butt)
    el_butt.addEventListener('click', () => {
      window.location.href = el_butt.dataset.href!;
    });
}, { once: true, passive: true });
