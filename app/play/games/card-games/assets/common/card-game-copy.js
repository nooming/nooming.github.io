/* 卡牌页统一文案（copy-style.md） */
(function (window) {
    'use strict'

    window.CardGameCopy = {
        pageNote: '本地人机 · 浏览器内演算',
        lobbyLead: '单机对局，无联网房间。',
        lobbyList: '选择「开始对局」，或先打开「规则教程」。',
        start: '开始对局',
        rules: '规则教程',
        readyStart: '准备开局',
        readyNext: '下一局',
        ready: '准备',
        begin: '开始',
        exit: '离开',
        exitConfirm: '再按一次确认离开',
        localNote: '本地演算 · 无数据上传',
        /** 人机对手显示名（非真实人物；教程与对局共用） */
        aiOpponents: ['林薇', '周然', '赵淳']
    }

    window.CardGameCopy.aiNameMap = function (playerCount) {
        var you =
            (typeof window.sso !== 'undefined' && window.sso.realname && window.sso.realname.trim()) ||
            '你'
        var names = { 0: you }
        var list = window.CardGameCopy.aiOpponents
        var n = playerCount == null ? list.length : Math.min(playerCount, list.length)
        for (var i = 0; i < n; i++) names[i + 1] = list[i]
        return names
    }

    window.renderCardGameLobbyList = function () {
        var el = document.querySelector('.list-table')
        if (!el) return
        el.innerHTML =
            '<li class="card-game-lobby__list-item">' + window.CardGameCopy.lobbyList + '</li>'
    }
})(window)
