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
        return '<span class="card-icon" aria-hidden="true">' + t + '</span> '
    }

    function buildButton(type, text, onclick, opts) {
        opts = opts || {}
        var glyph = opts.glyph || ''
        var onmouseenter = opts.onmouseenter || ''
        var onmouseleave = opts.onmouseleave || ''
        var onmousedown = opts.onmousedown || ''
        var glyph2 = opts.glyph2 || ''
        return '<button class="btn btn-' + type + '" onclick="' + onclick + '"' +
            (onmouseenter ? ' onmouseenter="' + onmouseenter + '" ontouchstart="' + onmouseenter + '"' : '') +
            (onmouseleave ? ' onmouseleave="' + onmouseleave + '"' : '') +
            (onmousedown ? ' onmousedown="' + onmousedown + '"' : '') + '>' +
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
