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


  /* NALADIMARTH_CONSENT_MANAGER */
  const analyticsMeasurementId = 'G-81Q427QWZV';
  const analyticsConsentKey = 'naladimarth_analytics_consent_v1';
  let analyticsLoaded = false;
  let consentBanner = null;

  function readAnalyticsConsent() {
    try {
      const value = window.localStorage.getItem(analyticsConsentKey);
      return value === 'granted' || value === 'denied' ? value : null;
    } catch (_) {
      return null;
    }
  }

  function saveAnalyticsConsent(value) {
    try {
      window.localStorage.setItem(analyticsConsentKey, value);
    } catch (_) {
      // If browser storage is unavailable, apply the choice for this page only.
    }
  }

  function ensureGtagQueue() {
    window.dataLayer = window.dataLayer || [];

    if (typeof window.gtag !== 'function') {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
    }
  }

  function deniedConsentState() {
    return {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    };
  }

  function grantedAnalyticsState() {
    return {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted'
    };
  }

  function clearAnalyticsCookies() {
    const analyticsCookiePrefixes = ['_ga', '_gid', '_gat'];
    const cookies = document.cookie ? document.cookie.split(';') : [];
    const hostname = window.location.hostname;

    cookies.forEach((cookie) => {
      const name = cookie.split('=')[0].trim();

      if (!analyticsCookiePrefixes.some((prefix) => name.startsWith(prefix))) {
        return;
      }

      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;

      if (hostname.includes('.')) {
        document.cookie = `${name}=; Max-Age=0; path=/; domain=${hostname}; SameSite=Lax`;
        document.cookie = `${name}=; Max-Age=0; path=/; domain=.${hostname}; SameSite=Lax`;
      }
    });
  }

  function disableAnalytics() {
    window[`ga-disable-${analyticsMeasurementId}`] = true;

    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', deniedConsentState());
    }

    clearAnalyticsCookies();
  }

  function loadAnalytics() {
    window[`ga-disable-${analyticsMeasurementId}`] = false;

    ensureGtagQueue();

    /*
      Basic Consent Mode:
      This code runs only after a user has granted analytics consent.
      Ad-related consent remains denied.
    */
    window.gtag('consent', 'default', deniedConsentState());
    window.gtag('consent', 'update', grantedAnalyticsState());

    window.gtag('set', {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });

    if (!analyticsLoaded) {
      analyticsLoaded = true;

      const script = document.createElement('script');
      script.async = true;
      script.src =
        `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsMeasurementId)}`;
      script.dataset.naladimarthAnalytics = 'true';
      document.head.appendChild(script);

      window.gtag('js', new Date());

      window.gtag('config', analyticsMeasurementId, {
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
    } else {
      window.gtag('config', analyticsMeasurementId, {
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
    }
  }

  function hideConsentBanner() {
    if (consentBanner) {
      consentBanner.hidden = true;
    }
  }

  function showConsentBanner() {
    if (consentBanner) {
      consentBanner.hidden = false;
    }
  }

  function createConsentBanner() {
    const banner = document.createElement('section');

    banner.className = 'consent-banner';
    banner.hidden = true;
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-labelledby', 'analytics-consent-title');
    banner.setAttribute('aria-describedby', 'analytics-consent-description');

    banner.innerHTML = `
      <div class="consent-dialog">
        <div class="consent-copy">
          <p class="consent-kicker">Privacy choice</p>
          <h2 class="consent-title" id="analytics-consent-title">Analytics preferences</h2>
          <p class="consent-text" id="analytics-consent-description">
            We use Google Analytics only if you allow it. It helps us understand visits
            and improve Naladimarth. Rejecting analytics does not affect website functionality.
          </p>
          <a class="consent-policy-link" href="/nala-website-privacy-policy.html">
            Read website privacy policy
          </a>
        </div>

        <div class="consent-actions">
          <button type="button" class="consent-button consent-reject" data-consent-reject>
            Reject analytics
          </button>
          <button type="button" class="consent-button consent-accept" data-consent-accept>
            Accept analytics
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    banner.querySelector('[data-consent-reject]').addEventListener('click', () => {
      saveAnalyticsConsent('denied');
      disableAnalytics();
      hideConsentBanner();
    });

    banner.querySelector('[data-consent-accept]').addEventListener('click', () => {
      saveAnalyticsConsent('granted');
      loadAnalytics();
      hideConsentBanner();
    });

    return banner;
  }

  consentBanner = createConsentBanner();

  document.querySelectorAll('[data-privacy-settings]').forEach((control) => {
    control.addEventListener('click', showConsentBanner);
  });

  const storedAnalyticsConsent = readAnalyticsConsent();

  if (storedAnalyticsConsent === 'granted') {
    loadAnalytics();
  } else if (storedAnalyticsConsent === 'denied') {
    disableAnalytics();
  } else {
    showConsentBanner();
  }

  body.classList.add('js-ready');
  updateScrollState();
})();
