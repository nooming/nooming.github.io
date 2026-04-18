/* global window */
(function () {
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
            (glyph ? '<span class="glyphicon glyphicon-' + glyph + '"></span> ' : '') +
            text +
            (glyph2 ? ' <span class="glyphicon glyphicon-' + glyph2 + '"></span>' : '') +
            '</button>'
    }

    window.UIButtons = {
        build: buildButton
    }
})()
