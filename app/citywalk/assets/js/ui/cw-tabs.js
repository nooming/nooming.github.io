// ========== 侧栏 Tab 切换 ==========

CW.activePanelTab = 'agent';
CW.resultTabAvailable = false;

const PANEL_TAB_IDS = {
    agent: 'tabBtnAgent',
    manual: 'tabBtnManual',
    result: 'tabBtnResult',
};

const PANEL_TAB_PANEL_IDS = {
    agent: 'tab-panel-agent',
    manual: 'tab-panel-manual',
    result: 'tab-panel-result',
};

function setResultTabAvailable(available) {
    CW.resultTabAvailable = !!available;
    const btn = document.getElementById(PANEL_TAB_IDS.result);
    const panel = document.getElementById(PANEL_TAB_PANEL_IDS.result);
    if (btn) {
        if (available) {
            btn.hidden = false;
            btn.removeAttribute('hidden');
            btn.disabled = false;
            btn.classList.remove('panel-tab--disabled');
        } else {
            btn.hidden = true;
            btn.disabled = true;
            btn.classList.add('panel-tab--disabled');
            btn.setAttribute('aria-selected', 'false');
        }
    }
    if (panel) {
        panel.classList.toggle('result-tab-has-route', available);
        if (!available) {
            panel.classList.remove('tab-panel--active');
            panel.hidden = true;
        }
    }
}

function switchPanelTab(name, options) {
    const opts = options || {};
    if (name === 'result' && !CW.resultTabAvailable && !opts.force) {
        return;
    }
    if (name === 'result' && opts.force && !CW.resultTabAvailable) {
        CW.resultTabAvailable = true;
        setResultTabAvailable(true);
    }
    if (!PANEL_TAB_IDS[name]) {
        return;
    }

    CW.activePanelTab = name;

    Object.keys(PANEL_TAB_IDS).forEach((key) => {
        const tabBtn = document.getElementById(PANEL_TAB_IDS[key]);
        const tabPanel = document.getElementById(PANEL_TAB_PANEL_IDS[key]);
        const isActive = key === name;

        if (tabBtn) {
            if (!tabBtn.hidden) {
                tabBtn.classList.toggle('panel-tab--active', isActive);
                tabBtn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            } else if (isActive && key === 'result') {
                tabBtn.hidden = false;
                tabBtn.removeAttribute('hidden');
                tabBtn.classList.add('panel-tab--active');
                tabBtn.setAttribute('aria-selected', 'true');
            }
        }

        if (tabPanel) {
            if (key === 'result' && !CW.resultTabAvailable) {
                tabPanel.classList.remove('tab-panel--active');
                tabPanel.hidden = true;
                return;
            }
            tabPanel.classList.toggle('tab-panel--active', isActive);
            tabPanel.hidden = !isActive;
        }
    });

    const shared = document.getElementById('panel-shared');
    if (shared) {
        shared.classList.toggle('panel-shared--hidden', name === 'result');
        shared.classList.toggle('panel-shared--tab-agent', name === 'agent');
    }

    if (opts.auto && typeof showToast === 'function') {
        showToast('路线已生成，可在「路线结果」中查看', 2800, 'success');
    }
}

function initPanelTabs() {
    document.querySelectorAll('.panel-tabs .panel-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (!tab) return;
            if (tab === 'result' && !CW.resultTabAvailable) return;
            switchPanelTab(tab);
        });
    });
    setResultTabAvailable(false);
    switchPanelTab('agent');
}
