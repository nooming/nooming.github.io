/* global window, $ */
(function () {
    'use strict'

    function escAttr(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
    }

    function sendSocket(cmd) {
        if (window.socket && typeof window.socket.send === 'function') {
            window.socket.send(cmd)
        }
    }

    function runTexasHover(cmd) {
        if (typeof window.procHover !== 'function' || !window.cur) return
        var parts = cmd.replace(/^hover\s+/, '').split(/\s+/)
        var action = parts[0]
        var val = parts.slice(1).join(' ')
        if (action === 'nothing') {
            window.procHover(['nothing'], window.cur.now)
            return
        }
        window.procHover([action, parseFloat(val) || val], window.cur.now)
    }

    function resolveSocketClick(el) {
        var cmd = el.getAttribute('data-socket')
        if (!cmd) return false
        if (cmd === 'up' && el.getAttribute('data-socket-var') === 'me.card') {
            if (window.me && window.me.card) sendSocket('up ' + window.me.card)
            return true
        }
        sendSocket(cmd)
        return true
    }

    function runNamedAction(name) {
        switch (name) {
            case 'hearts.submitPass':
                if (window.heartsSubmitPass) window.heartsSubmitPass()
                return true
            case 'hearts.play':
                if (window.heartsPlay) window.heartsPlay()
                return true
            case 'hearts.ready':
                if (window.heartsReady) window.heartsReady()
                return true
            case 'lobby.startAi':
                if (window.startAIBattle) window.startAIBattle()
                return true
            case 'lobby.tutor':
                if (window.startTutor) window.startTutor()
                return true
            case 'exit.confirm':
                handleExitClick()
                return true
            case 'tutor.end':
                if (window.endTutor) window.endTutor()
                return true
            default:
                return false
        }
    }

    function applyTutorTexasHover(spec, playerId) {
        if (typeof window.procHover !== 'function') return
        var parts = String(spec || '').split(':')
        var action = parts[0]
        var val = parts.length > 1 ? parts[1] : ''
        window.procHover([action, val], playerId == null ? '0' : String(playerId))
    }

    function handleExitClick() {
        var btn = document.querySelector('.btn-exit')
        if (!btn) return
        if (btn.classList.contains('btn-danger')) {
            if (window.socket) {
                window.socket.send('closing')
                window.socket.close()
            } else if (window.endTutor) {
                window.endTutor()
            }
            btn.classList.remove('btn-danger')
        } else {
            btn.classList.add('btn-danger')
        }
    }

    function onClick(ev) {
        var el = ev.target.closest(
            '[data-socket],[data-tutor],[data-action],[data-card-slot],[data-draw-pile],[data-sel-color],[data-tutor-draw]'
        )
        if (!el || el.disabled) return

        if (el.hasAttribute('data-card-slot')) {
            if (typeof window.selectCard === 'function') {
                window.selectCard(el.getAttribute('data-card-slot'))
            }
            ev.preventDefault()
            return
        }
        if (el.hasAttribute('data-draw-pile')) {
            sendSocket('down')
            ev.preventDefault()
            return
        }
        if (el.hasAttribute('data-sel-color')) {
            sendSocket('sel ' + el.getAttribute('data-sel-color'))
            ev.preventDefault()
            return
        }
        if (el.hasAttribute('data-tutor-fold-demo')) {
            el.style.color = 'transparent'
            ev.preventDefault()
            return
        }
        if (el.hasAttribute('data-tutor-draw')) {
            var step = parseInt(el.getAttribute('data-tutor-draw'), 10)
            if (!isNaN(step) && typeof window.tutor === 'function') window.tutor(step)
            ev.preventDefault()
            return
        }
        if (el.hasAttribute('data-tutor')) {
            var req = el.getAttribute('data-tutor-require')
            if (req === 'me.card' && !(window.me && window.me.card)) return
            if (req === "me.card=='B+'" && !(window.me && window.me.card === 'B+')) return
            if (req === 'me.card' && el.getAttribute('data-tutor-if') === '1') {
                if (!(window.me && window.me.card)) return
            }
            var tStep = parseInt(el.getAttribute('data-tutor'), 10)
            if (!isNaN(tStep) && typeof window.tutor === 'function') window.tutor(tStep)
            ev.preventDefault()
            return
        }
        if (el.hasAttribute('data-action')) {
            if (runNamedAction(el.getAttribute('data-action'))) {
                ev.preventDefault()
            }
            return
        }
        if (el.hasAttribute('data-socket')) {
            resolveSocketClick(el)
            ev.preventDefault()
        }
    }

    function onPointerEnter(ev) {
        var el = ev.target.closest('[data-card-slot]')
        if (el && !el.classList.contains('selected')) {
            var slot = el.getAttribute('data-card-slot')
            $('.' + slot)
                .not('.selected')
                .css('translate', '0 -3px')
            $('.' + slot + '-text').show()
            return
        }
        el = ev.target.closest('[data-sel-preview]')
        if (el) {
            var c = el.getAttribute('data-sel-preview')
            $('.sel-h-' + c).show()
            return
        }
        el = ev.target.closest('[data-socket-hover]')
        if (el) {
            var h = el.getAttribute('data-socket-hover')
            if (h.indexOf('hover') === 0) runTexasHover(h)
            else sendSocket(h)
            return
        }
        el = ev.target.closest('[data-tutor-hover]')
        if (el) {
            applyTutorTexasHover(
                el.getAttribute('data-tutor-hover'),
                el.getAttribute('data-tutor-hover-player')
            )
            return
        }
        el = ev.target.closest('[data-tutor-preview]')
        if (el && window.TutorTexasUI && typeof TutorTexasUI.preview === 'function') {
            TutorTexasUI.preview(el.getAttribute('data-tutor-preview'))
        }
    }

    function onPointerLeave(ev) {
        var el = ev.target.closest('[data-card-slot]')
        if (el && !el.classList.contains('selected')) {
            var slot = el.getAttribute('data-card-slot')
            $('.' + slot).css('translate', '')
            $('.' + slot + '-text').hide()
            return
        }
        el = ev.target.closest('[data-sel-preview],[data-sel-color]')
        if (el) {
            var c =
                el.getAttribute('data-sel-preview') || el.getAttribute('data-sel-color')
            if (c) $('.sel-h-' + c).hide()
            return
        }
        el = ev.target.closest('[data-socket-hover-leave]')
        if (el) {
            var lv = el.getAttribute('data-socket-hover-leave')
            if (lv.indexOf('hover') === 0) runTexasHover(lv)
            else sendSocket(lv)
        }
        if (ev.target.closest('[data-sel-wheel]')) {
            $('.sel-h').hide()
        }
        el = ev.target.closest('[data-tutor-preview-reset]')
        if (el && window.TutorTexasUI && typeof TutorTexasUI.reset === 'function') {
            TutorTexasUI.reset(el.getAttribute('data-tutor-preview-reset'))
        }
        el = ev.target.closest('[data-tutor-leave]')
        if (el && !el.contains(ev.relatedTarget)) {
            var leave = el.getAttribute('data-tutor-leave')
            if (leave === 'redraw-table' && typeof window.drawTable === 'function') window.drawTable()
        }
        var group = ev.target.closest('[data-hover-leave]')
        if (group && !group.contains(ev.relatedTarget)) {
            runTexasHover(group.getAttribute('data-hover-leave'))
        }
        var pile = ev.target.closest('[data-draw-pile]')
        if (pile) {
            var svg = pile.closest('.uno-svg')
            if (svg) svg.classList.remove('draw-pile-hover')
        }
    }

    function onDrawPileEnter(ev) {
        var pile = ev.target.closest('[data-draw-pile]')
        if (!pile) return
        var svg = pile.closest('.uno-svg')
        if (svg) svg.classList.add('draw-pile-hover')
    }

    function onMouseDown(ev) {
        var el = ev.target.closest('[data-socket-mdown]')
        if (!el) return
        sendSocket(el.getAttribute('data-socket-mdown'))
    }

    function onHeartsClick(ev) {
        var g = ev.target.closest('[data-hearts-card]')
        if (!g || g.getAttribute('data-disabled') === 'true') return
        var card = g.getAttribute('data-hearts-card')
        if (ev.type === 'dblclick') {
            if (window.heartsAutoAct) window.heartsAutoAct(card)
        } else if (window.heartsSelectCard) {
            window.heartsSelectCard(card)
        }
    }

    function socketSendLiteral(code) {
        var m = String(code || '').trim().match(/^socket\.send\('([^']*)'\)$/)
        return m ? m[1] : null
    }

    function procHoverLiteral(code) {
        var m = String(code || '')
            .trim()
            .match(/^procHover\(\['([^']+)'(?:,'([^']*)')?\],'(\d+)'\)$/)
        return m ? { action: m[1], val: m[2] || '', player: m[3] } : null
    }

    function tutorUiLiteral(code, method) {
        var m = String(code || '')
            .trim()
            .match(new RegExp('^TutorTexasUI\\.' + method + "\\('([^']+)'\\)$"))
        return m ? m[1] : null
    }

    function parseHandlerToAttrs(onclick, onmouseenter, onmouseleave, onmousedown) {
        var attrs = ' type="button"'
        var trimmed = String(onclick || '').trim()
        var lit = socketSendLiteral(trimmed)
        if (lit != null) {
            attrs += ' data-socket="' + escAttr(lit) + '"'
        } else if (trimmed.indexOf('up ${me.card}') !== -1 || trimmed.indexOf('up \\${me.card}') !== -1) {
            attrs += ' data-socket="up" data-socket-var="me.card"'
        } else if ((lit = trimmed.match(/^tutor\((\d+)\)$/))) {
            attrs += ' data-tutor="' + lit[1] + '"'
        } else if (trimmed === 'if(me.card)tutor(2)') {
            attrs += ' data-tutor="2" data-tutor-require="me.card"'
        } else if (trimmed === "if(me.card=='B+')tutor(6)") {
            attrs += ' data-tutor="6" data-tutor-require="me.card==\'B+\'"'
        } else if (trimmed === 'if(me.card)tutor(12)') {
            attrs += ' data-tutor="12" data-tutor-require="me.card"'
        } else if (
            trimmed === 'window.heartsSubmitPass && heartsSubmitPass()' ||
            trimmed === 'hearts.submitPass'
        ) {
            attrs += ' data-action="hearts.submitPass"'
        } else if (trimmed === 'window.heartsPlay && heartsPlay()' || trimmed === 'hearts.play') {
            attrs += ' data-action="hearts.play"'
        } else if (
            trimmed === 'window.heartsReady && heartsReady()' ||
            trimmed === 'hearts.ready'
        ) {
            attrs += ' data-action="hearts.ready"'
        } else if (trimmed === "socket && socket.send('ready')") {
            attrs += ' data-socket="ready"'
        } else if (trimmed === 'endTutor()') {
            attrs += ' data-action="tutor.end"'
        }

        lit = socketSendLiteral(onmouseenter)
        if (lit != null) attrs += ' data-socket-hover="' + escAttr(lit) + '"'
        lit = socketSendLiteral(onmouseleave)
        if (lit != null) attrs += ' data-socket-hover-leave="' + escAttr(lit) + '"'
        lit = socketSendLiteral(onmousedown)
        if (lit != null) attrs += ' data-socket-mdown="' + escAttr(lit) + '"'

        var proc = procHoverLiteral(onmouseenter)
        if (proc) {
            attrs +=
                ' data-tutor-hover="' +
                escAttr(proc.action + ':' + proc.val) +
                '" data-tutor-hover-player="' +
                escAttr(proc.player) +
                '"'
        }
        var preview = tutorUiLiteral(onmouseenter, 'preview')
        if (preview) attrs += ' data-tutor-preview="' + escAttr(preview) + '"'
        var previewReset = tutorUiLiteral(onmouseleave, 'reset')
        if (previewReset) attrs += ' data-tutor-preview-reset="' + escAttr(previewReset) + '"'

        proc = procHoverLiteral(onclick)
        if (proc && attrs.indexOf('data-tutor-hover') === -1) {
            attrs +=
                ' data-tutor-hover="' +
                escAttr(proc.action + ':' + proc.val) +
                '" data-tutor-hover-player="' +
                escAttr(proc.player) +
                '"'
        }
        if (String(onclick || '').trim() === "$(this).css('color','transparent')") {
            attrs += ' data-tutor-fold-demo="1"'
        }

        return attrs
    }

    function bind() {
        document.addEventListener('click', onClick)
        document.addEventListener('pointerenter', onPointerEnter, true)
        document.addEventListener('pointerenter', onDrawPileEnter, true)
        document.addEventListener('pointerleave', onPointerLeave, true)
        document.addEventListener('mousedown', onMouseDown, true)
        document.addEventListener('click', onHeartsClick)
        document.addEventListener('dblclick', onHeartsClick)
        document.querySelectorAll('.btn-start-ai').forEach(function (btn) {
            if (!btn.hasAttribute('data-action')) {
                btn.setAttribute('data-action', 'lobby.startAi')
                btn.setAttribute('type', 'button')
            }
        })
        document.querySelectorAll('.btn-exit').forEach(function (btn) {
            btn.removeAttribute('onclick')
            btn.setAttribute('data-action', 'exit.confirm')
            btn.setAttribute('type', 'button')
        })
    }

    window.CardGameActions = {
        bind: bind,
        parseHandlerToAttrs: parseHandlerToAttrs,
        sendSocket: sendSocket,
        setUnoDrawPile: function (mode) {
            var svg = document.querySelector('.uno-svg')
            if (!svg) return
            var active = mode === 'draw'
            svg.classList.toggle('draw-pile-active', active)
            svg.classList.remove('draw-pile-hover')
            var rect = svg.querySelector('.cards-rect')
            if (rect) {
                rect.setAttribute('fill', active ? 'white' : '#ddd')
                if (active) rect.setAttribute('data-draw-pile', '1')
                else rect.removeAttribute('data-draw-pile')
            }
            var arrow = svg.querySelector('.cards-arrow')
            if (arrow) arrow.setAttribute('fill', active ? '#333' : '#bbb')
            var left = svg.querySelector('.cards-left')
            if (left) {
                left.textContent = active ? '摸牌' : String(window.cur && window.cur.allLeft != null ? window.cur.allLeft : '')
                left.setAttribute('fill', active ? '#333' : '#999')
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind)
    } else {
        bind()
    }
})()
