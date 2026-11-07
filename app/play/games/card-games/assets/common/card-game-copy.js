/* 卡牌页统一文案（copy-style.md） */
(function (window) {
    'use strict'

    window.CardGameCopy = {
        lobbyList: '点「开始对局」，或先看「规则教程」。',
        readyStart: '准备开局',
        readyNext: '下一局',
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
