/* global window */
(function () {
    var GLYPH_TEXT = {
        'arrow-up': '↑',
        'arrow-down': '↓',
        'arrow-left': '←',
        'arrow-right': '→',
        'play': '▶',
        'pause': '❚❚',
        'remove': '×',
        'log-out': '⎋',
        'book': '※',
        'knight': '◆',
        'ban-circle': '⊘',
        'forward': '»',
        'fire': '▲',
        'repeat': '↻'
    }

    function glyphSpan(name) {
        if (!name) return ''
        var t = GLYPH_TEXT[name] || String(name)
        return '<span class="card-icon" aria-hidden="true">' + t + '</span>'
    }

    function buildButton(type, text, onclick, opts) {
        opts = opts || {}
        var glyph = opts.glyph || ''
        var onmouseenter = opts.onmouseenter || ''
        var onmouseleave = opts.onmouseleave || ''
        var onmousedown = opts.onmousedown || ''
        var glyph2 = opts.glyph2 || ''
        var typeParts = String(type || 'default').trim().split(/\s+/).filter(Boolean)
        var mainType = typeParts[0] || 'default'
        var modClasses = typeParts.slice(1).join(' ')
        var disabled =
            opts.disabled || modClasses.indexOf('disabled') !== -1 ? ' disabled' : ''
        var extraClass = opts.extraClass ? ' ' + opts.extraClass : ''
        var handlerAttrs = ''
        if (window.CardGameActions && CardGameActions.parseHandlerToAttrs) {
            handlerAttrs = CardGameActions.parseHandlerToAttrs(
                onclick,
                onmouseenter,
                onmouseleave,
                onmousedown
            )
            var onclickTrim = String(onclick || '').trim()
            var skipLegacyOnclick =
                !onclickTrim ||
                /^procHover\(\[/.test(onclickTrim) ||
                onclickTrim === "$(this).css('color','transparent')"
            if (
                onclickTrim &&
                !skipLegacyOnclick &&
                handlerAttrs.indexOf('data-socket') === -1 &&
                handlerAttrs.indexOf('data-tutor') === -1 &&
                handlerAttrs.indexOf('data-action') === -1 &&
                handlerAttrs.indexOf('data-tutor-fold-demo') === -1
            ) {
                handlerAttrs += ' onclick="' + onclick + '"'
            }
            if (onmouseenter && handlerAttrs.indexOf('data-socket-hover') === -1) {
                handlerAttrs +=
                    ' onmouseenter="' + onmouseenter + '" ontouchstart="' + onmouseenter + '"'
            }
            if (onmouseleave && handlerAttrs.indexOf('data-socket-hover-leave') === -1) {
                handlerAttrs += ' onmouseleave="' + onmouseleave + '"'
            }
            if (onmousedown && handlerAttrs.indexOf('data-socket-mdown') === -1) {
                handlerAttrs += ' onmousedown="' + onmousedown + '"'
            }
        } else {
            handlerAttrs =
                (onclick ? ' onclick="' + onclick + '"' : '') +
                (onmouseenter ? ' onmouseenter="' + onmouseenter + '" ontouchstart="' + onmouseenter + '"' : '') +
                (onmouseleave ? ' onmouseleave="' + onmouseleave + '"' : '') +
                (onmousedown ? ' onmousedown="' + onmousedown + '"' : '')
        }

        return (
            '<button class="btn btn-' +
            mainType +
            (modClasses ? ' ' + modClasses : '') +
            extraClass +
            '"' +
            disabled +
            handlerAttrs + '>' +
            glyphSpan(glyph) +
            text +
            (glyph2 ? ' ' + glyphSpan(glyph2).trim() : '') +
            '</button>'
    }

    window.UIButtons = {
        build: buildButton,
        glyph: glyphSpan,
        glyphText: GLYPH_TEXT
    }
})()
