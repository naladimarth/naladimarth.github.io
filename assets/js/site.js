(() => {
  const root = document.documentElement;
  const body = document.body;
  const header = document.querySelector('[data-header]');
  const progress = document.querySelector('.scroll-progress span');
  const navLinks = [...document.querySelectorAll('.site-nav a')];
  const sections = [...document.querySelectorAll('.section-anchor')];
  const revealEls = [...document.querySelectorAll('.reveal')];
  const parallaxEls = [...document.querySelectorAll('[data-parallax]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let ticking = false;
  let lastY = window.scrollY;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function updateScrollState() {
    const y = window.scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const pct = clamp((y / maxScroll) * 100, 0, 100);
    root.style.setProperty('--progress', `${pct}%`);

    if (header) {
      if (y > lastY && y > 220) header.classList.add('is-hidden');
      else header.classList.remove('is-hidden');
    }
    lastY = y;

    if (!reducedMotion && window.innerWidth > 760) {
      const viewportMid = window.innerHeight / 2;
      for (const el of parallaxEls) {
        const rect = el.getBoundingClientRect();
        const elMid = rect.top + rect.height / 2;
        const factor = Number(el.dataset.parallax || 0);
        const offset = clamp((elMid - viewportMid) * factor, -34, 34);
        el.style.setProperty('--parallax-y', `${offset.toFixed(2)}px`);
      }
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateScrollState);
    }
  }, { passive: true });

  if (!reducedMotion) {
    window.addEventListener('pointermove', (event) => {
      root.style.setProperty('--cursor-x', `${event.clientX}px`);
      root.style.setProperty('--cursor-y', `${event.clientY}px`);
    }, { passive: true });
  }

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -5% 0px' });

  revealEls.forEach((el) => revealObserver.observe(el));

  const navObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;
    const id = visible.target.id;
    navLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
    });
  }, {
    threshold: [0.18, 0.35, 0.55],
    rootMargin: '-18% 0px -48% 0px'
  });

  sections.forEach((section) => navObserver.observe(section));

  navLinks.forEach((link) => {
    link.addEventListener('click', () => header?.classList.remove('is-hidden'));
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateScrollState();
  });

  body.classList.add('js-ready');
  updateScrollState();
})();
