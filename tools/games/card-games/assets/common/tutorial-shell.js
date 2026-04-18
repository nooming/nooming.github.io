/* global $, window */
(function () {
    function open(opts) {
        opts = opts || {}
        $('.list-all').hide()
        $('.chat').show()
        $('.decor').hide()
        $('.tutor').show()
        $('.tutor-svg').show()
        $('.tutor-svg-2').html('')
        $('.btn-exit').removeClass('btn-danger')
        if (typeof opts.onOpen === 'function') opts.onOpen()
    }

    function close(opts) {
        opts = opts || {}
        $('.list-all').show()
        $('.chat').hide()
        $('.decor').show()
        $('.tutor').hide()
        if (typeof opts.onClose === 'function') opts.onClose()
    }

    window.TutorialShell = {
        open: open,
        close: close
    }
})()
