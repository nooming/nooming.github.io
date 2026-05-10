(function () {
  "use strict";

  function applyTabState(tabKey) {
    document.querySelectorAll(".side-tab").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.tab === tabKey);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.tabPanel === tabKey);
    });
  }

  window.ParkingTabUtils = {
    applyTabState,
  };
})();
