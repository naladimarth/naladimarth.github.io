(() => {
  const consentKey = 'naladimarth_analytics_consent_v1';
  const measurementId = 'G-81Q427QWZV';
  const liveHosts = ['naladimarth.com', 'www.naladimarth.com', 'naladimarth.in', 'www.naladimarth.in'];
  const live = location.protocol === 'https:' && liveHosts.includes(location.hostname);
  const disabledKey = 'ga-disable-' + measurementId;
  let choice = 'denied';
  let tagRequested = false;
  let memoryOnly = false;

  function readChoice() {
    if (memoryOnly) return choice;
    try {
      return localStorage.getItem(consentKey) === 'granted' ? 'granted' : 'denied';
    } catch {
      return choice;
    }
  }

  function clearAnalyticsCookies() {
    const base = location.hostname.replace(/^www\./, '');
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (!/^(_ga($|_)|_gid$|_gat($|_))/.test(name)) continue;
      const expired = name + '=; Max-Age=0; Path=/';
      document.cookie = expired;
      document.cookie = expired + '; Domain=' + base;
    }
  }

  function applyChoice(value) {
    choice = value;
    if (!live) return;
    const allowed = value === 'granted';
    window[disabledKey] = !allowed;
    if (!allowed) {
      clearAnalyticsCookies();
      if (tagRequested && !memoryOnly) location.reload(); // Unload the tag and its event listeners.
      return;
    }
    if (tagRequested) return;
    tagRequested = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'
    });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.append(script);
  }

  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="privacy-dialog" aria-labelledby="privacy-title">
      <form method="dialog">
        <h2 id="privacy-title">Privacy settings</h2>
        <p>Allow Google Analytics to measure visits and link clicks on the live website. You can change your choice here at any time.</p>
        <label><input type="checkbox" id="analytics-choice"> Allow analytics</label>
        <div class="dialog-actions"><button class="button" value="cancel">Cancel</button><button class="button" value="save">Save preference</button></div>
      </form>
    </dialog>
  `);
  const dialog = document.getElementById('privacy-dialog');
  const checkbox = document.getElementById('analytics-choice');
  document.getElementById('privacy-settings').addEventListener('click', () => {
    checkbox.checked = choice === 'granted';
    dialog.returnValue = '';
    dialog.showModal();
  });
  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'save') return;
    const next = checkbox.checked ? 'granted' : 'denied';
    try {
      localStorage.setItem(consentKey, next);
      memoryOnly = false;
    } catch {
      memoryOnly = true;
    }
    applyChoice(next);
  });
  window.addEventListener('storage', event => {
    if (event.storageArea === localStorage && (event.key === consentKey || event.key === null)) {
      applyChoice(readChoice());
      checkbox.checked = choice === 'granted';
    }
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) applyChoice(readChoice());
  });
  applyChoice(readChoice());
})();
