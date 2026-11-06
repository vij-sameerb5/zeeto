/*! Zeeto Checkout · drop-in USDT payments on Whitechain · MIT */
/**
 * <script src="https://YOUR-ZEETO-HOST/checkout.js"></script>
 *
 * Zeeto.open(sessionUrl, { onPaid(result) {}, onClose() {} })
 *   Opens Zeeto's hosted checkout in a popup. The shopper signs in with phone or email and pays gas-free.
 *   onPaid gets { session, orderId, reference }. Treat it as a hint only: confirm on your server with
 *   GET /api/checkout?id=<session> (your secret key) or the signed `payment.succeeded` webhook before you ship.
 *
 * Zeeto.button(element, { createSession: () => Promise<{ url }>, onPaid, label })
 *   Turns any element into a "Pay with Zeeto" button. createSession must call YOUR backend, which calls
 *   POST /api/checkout with your secret key. Never put the secret key in the browser.
 */
(function () {
  'use strict';
  var script = document.currentScript;
  var ORIGIN = script ? new URL(script.src).origin : location.origin;

  function open(sessionUrl, opts) {
    opts = opts || {};
    var url = new URL(sessionUrl, ORIGIN);
    if (url.origin !== ORIGIN) throw new Error('Zeeto: session URL must be on ' + ORIGIN);
    var w = 420, h = 760;
    var left = Math.max(0, (screen.width - w) / 2), top = Math.max(0, (screen.height - h) / 2);
    var popup = window.open(url.toString(), 'zeeto-checkout', 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top);
    if (!popup) { location.href = url.toString(); return; } // popup blocked: full-page redirect still works
    var done = false;
    function onMessage(e) {
      if (e.origin !== ORIGIN || !e.data || e.data.type !== 'zeeto:paid') return;
      done = true;
      cleanup();
      try { popup.close(); } catch (_) {}
      if (opts.onPaid) opts.onPaid({ session: e.data.session, orderId: e.data.orderId, reference: e.data.reference });
    }
    var timer = setInterval(function () {
      if (popup.closed) { cleanup(); if (!done && opts.onClose) opts.onClose(); }
    }, 500);
    function cleanup() { clearInterval(timer); window.removeEventListener('message', onMessage); }
    window.addEventListener('message', onMessage);
    return popup;
  }

  function button(el, opts) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) throw new Error('Zeeto: button element not found');
    if (!el.textContent.trim()) el.textContent = opts.label || 'Pay with Zeeto';
    el.addEventListener('click', function () {
      // Open the window inside the click so browsers don't block it, then point it at the session.
      var popup = window.open('', 'zeeto-checkout', 'width=420,height=760');
      el.disabled = true;
      Promise.resolve(opts.createSession()).then(function (s) {
        open(s.url, opts); // same window name: reuses the popup opened during the click
      }).catch(function (err) {
        if (popup) popup.close();
        if (opts.onError) opts.onError(err); else alert('Could not start checkout: ' + (err && err.message || err));
      }).then(function () { el.disabled = false; });
    });
  }

  window.Zeeto = { open: open, button: button, origin: ORIGIN, version: '1.0.0' };
})();
