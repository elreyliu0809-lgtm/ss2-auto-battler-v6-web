(() => {
  'use strict';
  const VERSION = 'source53-r3-svn323591-20261113-r2';
  const script = document.currentScript;
  const base = new URL('./', script ? script.src : document.baseURI);
  const status = window.SS2Source53Web = {
    version: VERSION,
    scope: base.href,
    supported: false,
    registrationStatus: 'unavailable',
    controlStatus: 'uncontrolled',
    controllerURL: null,
    controllerVersion: null,
    updateStatus: 'not-requested'
  };
  let sw;
  let registration;
  function refreshControl() {
    const controller = sw.controller;
    status.controlStatus = controller ? 'controlled' : 'uncontrolled';
    status.controllerURL = controller ? controller.scriptURL : null;
    status.controllerVersion = null;
    if (!controller || typeof MessageChannel === 'undefined') return;
    const channel = new MessageChannel();
    const timer = setTimeout(() => channel.port1.close(), 3000);
    channel.port1.onmessage = event => {
      clearTimeout(timer);
      channel.port1.close();
      if (sw.controller === controller && event.data &&
          event.data.type === 'SS2_SOURCE53_STATUS') {
        status.controllerVersion = event.data.version;
      }
    };
    try {
      controller.postMessage({type: 'SS2_SOURCE53_STATUS'}, [channel.port2]);
    } catch (_) {
      clearTimeout(timer);
      channel.port1.close();
    }
  }
  function refreshRegistration() {
    const worker = registration.installing || registration.waiting || registration.active;
    status.registrationStatus = worker ? worker.state : 'registered';
  }
  try {
    sw = navigator.serviceWorker;
    if (!sw || !window.isSecureContext) return;
    status.supported = true;
    status.registrationStatus = 'registering';
    sw.addEventListener('controllerchange', refreshControl);
    refreshControl();
    sw.register(new URL('sw.js', base).href, {
      scope: base.href,
      updateViaCache: 'none'
    }).then(async result => {
      registration = result;
      status.scope = result.scope;
      const watch = worker => {
        if (worker) worker.addEventListener('statechange', refreshRegistration);
      };
      watch(result.installing);
      watch(result.waiting);
      watch(result.active);
      result.addEventListener('updatefound', () => {
        watch(result.installing);
        refreshRegistration();
      });
      refreshRegistration();
      refreshControl();
      status.updateStatus = 'checking';
      try {
        await result.update();
        status.updateStatus = 'checked';
      } catch (_) {
        status.updateStatus = 'unavailable';
      }
      refreshRegistration();
    }).catch(() => {
      status.registrationStatus = 'unavailable';
    });
  } catch (_) {
    status.registrationStatus = 'unavailable';
  }
})();
