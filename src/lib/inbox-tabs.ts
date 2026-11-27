const inbox = document.querySelector<HTMLElement>('[data-inbox]');

if (inbox) {
  const tablists = [...inbox.querySelectorAll<HTMLElement>('[role="tablist"]')];
  const tabs = [...inbox.querySelectorAll<HTMLButtonElement>('[data-inbox-route]')];
  const whatsapp = inbox.querySelector<HTMLElement>('#inbox-whatsapp');
  const requests = inbox.querySelector<HTMLElement>('#inbox-requests');
  const retreats = inbox.querySelector<HTMLElement>('#inbox-retreat');
  const circles = inbox.querySelector<HTMLElement>('#inbox-circle');

  if (whatsapp && requests && retreats && circles) {
    let requestRoute = 'solicitudes';
    const selectView = () => {
      const route = location.hash.slice(1);
      const showCircles = route === 'solicitudes-circulos';
      const showRequests = route === 'solicitudes' || showCircles;
      if (showRequests) requestRoute = route;
      const selected = new Set([
        showRequests ? 'inbox-requests' : 'inbox-whatsapp',
        showCircles ? 'inbox-circle' : 'inbox-retreat',
      ]);

      for (const tab of tabs) {
        const active = selected.has(tab.getAttribute('aria-controls') ?? '');
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      }
      whatsapp.hidden = showRequests;
      requests.hidden = !showRequests;
      retreats.hidden = showCircles;
      circles.hidden = !showCircles;
      for (const panel of [whatsapp, retreats, circles]) {
        panel.dispatchEvent(new Event('inbox-view-change'));
      }
    };

    for (const tab of tabs) {
      tab.addEventListener('click', () => {
        const hash = '#' + (tab.id === 'inbox-requests-tab' ? requestRoute : tab.dataset.inboxRoute);
        if (location.hash === hash) return;
        history.pushState(null, '', hash);
        selectView();
      });
    }

    for (const tablist of tablists) {
      const list = [...tablist.querySelectorAll<HTMLButtonElement>('button[role="tab"]')];
      tablist.addEventListener('keydown', event => {
        const index = list.indexOf(event.target as HTMLButtonElement);
        if (index === -1) return;
        const positions: Record<string, number | undefined> = {
          ArrowRight: (index + 1) % list.length,
          ArrowLeft: (index + list.length - 1) % list.length,
          Home: 0,
          End: list.length - 1,
        };
        const nextIndex = positions[event.key];
        if (nextIndex === undefined) return;
        event.preventDefault();
        list[nextIndex].focus();
        list[nextIndex].click();
      });
    }

    window.addEventListener('popstate', selectView);
    window.addEventListener('hashchange', selectView);
    selectView();
  }
}
