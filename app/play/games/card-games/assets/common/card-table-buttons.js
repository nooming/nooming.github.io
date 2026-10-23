/* global window, UIButtons */
(function () {
    window.getButton = function (type, text, onclick, glyph, onmouseenter, onmouseleave, onmousedown, glyph2) {
        glyph = glyph || 0
        onmouseenter = onmouseenter || 0
        onmouseleave = onmouseleave || 0
        onmousedown = onmousedown || 0
        glyph2 = glyph2 || 0
        if (window.UIButtons && UIButtons.build) {
            return UIButtons.build(type, text, onclick || '', {
                glyph: glyph || '',
                glyph2: glyph2 || '',
                onmouseenter: onmouseenter || '',
                onmouseleave: onmouseleave || '',
                onmousedown: onmousedown || ''
            })
        }
        return (
            '<button class="btn btn-' +
            type +
            '" onclick="' +
            onclick +
            '"' +
            (onmouseenter ? ' onmouseenter="' + onmouseenter + '" ontouchstart="' + onmouseenter + '"' : '') +
            (onmouseleave ? ' onmouseleave="' + onmouseleave + '"' : '') +
            (onmousedown ? ' onmousedown="' + onmousedown + '"' : '') +
            '>' +
            (glyph && window.UIButtons ? UIButtons.glyph(glyph) : '') +
            text +
            (glyph2 && window.UIButtons ? ' ' + UIButtons.glyph(glyph2).trim() : '') +
            '</button>'
        )
    }
})()
