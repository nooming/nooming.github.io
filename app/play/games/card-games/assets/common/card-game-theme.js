/* global drawTable, fillLobbyDecor, $ */
(function () {
    'use strict'

    function isCardGameActive() {
        return document.body.classList.contains('card-game-playing')
    }

    function refreshCardGameTheme() {
        var playing = isCardGameActive()

        if (!playing && typeof $ === 'function') {
            $('.texas-svg, .uno-svg, .hearts-svg').html('')
        }

        if (typeof fillLobbyDecor === 'function') {
            var lobby = document.querySelector('.list-all')
            if (lobby && lobby.offsetParent !== null) {
                try {
                    fillLobbyDecor()
                } catch (e) {
                    /* ignore */
                }
            }
        }

        if (playing && typeof drawTable === 'function') {
            try {
                drawTable()
            } catch (e) {
                /* ignore */
            }
        }
    }

    document.documentElement.addEventListener('noomings:prefs', function (ev) {
        if (!ev || !ev.detail || !ev.detail.theme) return
        refreshCardGameTheme()
    })
})()
