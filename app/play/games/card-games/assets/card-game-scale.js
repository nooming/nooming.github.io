/* global window, document */
(function () {
    var mq = window.matchMedia('(max-width: 767.98px)')
    var STAGE_CANVAS_W = 760
    var STAGE_VISUAL_W = 580
    var STAGE_DECOR_W = 610
    var STAGE_VISUAL_H = 500
    var PLAYING_BOOST = 1.05

    function shellBottomPx() {
        if (!document.body.classList.contains('shell-active')) return 0
        var n = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--shell-bottom-h'))
        return n || 58
    }

    function dockBlockPx() {
        if (!document.body.classList.contains('shell-active')) return 0
        var dock = document.querySelector('.card-game-viewport > .card-game-dock')
        if (!dock || !dock.textContent.trim()) return 0
        var h = dock.getBoundingClientRect().height
        return h > 8 ? h + 4 : 36
    }

    function updateCardScale() {
        var vp = document.querySelector('.card-game-viewport')
        if (!vp) return
        if (!mq.matches) {
            vp.style.removeProperty('--card-scale-num')
            return
        }

        var playing = document.body.classList.contains('card-game-playing')
        var innerW = window.innerWidth - (playing ? 4 : 8)
        var wScale = Math.min(innerW / STAGE_VISUAL_W, innerW / STAGE_DECOR_W)
        if (!playing) wScale = Math.min(wScale, innerW / STAGE_CANVAS_W)

        var stageTop = Math.max(0, vp.getBoundingClientRect().top)
        var hAvail = window.innerHeight - shellBottomPx() - dockBlockPx() - 2 - stageTop
        if (hAvail < STAGE_VISUAL_H * 0.35) hAvail = window.innerHeight * 0.55
        var hScale = hAvail / STAGE_VISUAL_H

        var scale = Math.min(1, wScale, hScale)
        if (playing) scale = Math.min(1, hScale, wScale * PLAYING_BOOST)
        if (!isFinite(scale) || scale <= 0) scale = innerW / STAGE_CANVAS_W

        vp.style.setProperty('--card-scale-num', String(scale))
    }

    function bind() {
        updateCardScale()
        requestAnimationFrame(updateCardScale)
        window.addEventListener('resize', updateCardScale)
        window.addEventListener('orientationchange', function () {
            setTimeout(updateCardScale, 100)
        })
        new MutationObserver(updateCardScale).observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        })
        var vp = document.querySelector('.card-game-viewport')
        if (vp) {
            new MutationObserver(updateCardScale).observe(vp, {
                childList: true,
                subtree: true,
                characterData: true
            })
        }
        if (mq.addEventListener) mq.addEventListener('change', updateCardScale)
        else if (mq.addListener) mq.addListener(updateCardScale)
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind)
    else bind()
})()
