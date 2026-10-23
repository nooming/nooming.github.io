/* Minimal jQuery-like DOM helper for card-games pages. Not full jQuery. */
(function (window) {
    'use strict'

    function toCamel(prop) {
        return String(prop).replace(/-([a-z])/g, function (_, c) {
            return c.toUpperCase()
        })
    }

    function Dom(nodes) {
        this.length = nodes.length
        for (var i = 0; i < nodes.length; i++) this[i] = nodes[i]
    }

    Dom.prototype.each = function (fn) {
        for (var i = 0; i < this.length; i++) fn.call(this[i], i, this[i])
        return this
    }

    Dom.prototype.html = function (val) {
        if (val === undefined) return this[0] ? this[0].innerHTML : undefined
        return this.each(function () { this.innerHTML = val })
    }

    Dom.prototype.text = function (val) {
        if (val === undefined) return this[0] ? this[0].textContent : undefined
        return this.each(function () { this.textContent = val })
    }

    Dom.prototype.css = function (prop, val) {
        if (typeof prop === 'object') {
            var self = this
            Object.keys(prop).forEach(function (k) { self.css(k, prop[k]) })
            return this
        }
        var key = toCamel(prop)
        if (val === undefined) {
            return this[0] ? this[0].style[key] : undefined
        }
        return this.each(function () {
            this.style[key] = val
        })
    }

    Dom.prototype.show = function () {
        return this.each(function () {
            this.style.display = ''
            this.hidden = false
            if (window.getComputedStyle(this).display === 'none') {
                this.style.display = this.tagName === 'SPAN' || this.tagName === 'A' ? 'inline' : 'block'
            }
        })
    }

    Dom.prototype.hide = function () {
        return this.each(function () {
            this.style.display = 'none'
        })
    }

    Dom.prototype.addClass = function (cls) {
        var parts = String(cls || '').split(/\s+/).filter(Boolean)
        return this.each(function () {
            for (var i = 0; i < parts.length; i++) this.classList.add(parts[i])
        })
    }

    Dom.prototype.removeClass = function (cls) {
        var parts = String(cls || '').split(/\s+/).filter(Boolean)
        return this.each(function () {
            for (var i = 0; i < parts.length; i++) this.classList.remove(parts[i])
        })
    }

    Dom.prototype.toggleClass = function (cls) {
        return this.each(function () {
            this.classList.toggle(cls)
        })
    }

    Dom.prototype.hasClass = function (cls) {
        return !!(this[0] && this[0].classList.contains(cls))
    }

    Dom.prototype.on = function (type, handler) {
        return this.each(function () {
            this.addEventListener(type, handler)
        })
    }

    Dom.prototype.attr = function (name, val) {
        if (val === undefined) return this[0] ? this[0].getAttribute(name) : undefined
        return this.each(function () {
            if (val === null) this.removeAttribute(name)
            else this.setAttribute(name, val)
        })
    }

    Dom.prototype.remove = function () {
        return this.each(function () {
            if (this.parentNode) this.parentNode.removeChild(this)
        })
    }

    Dom.prototype.siblings = function () {
        var out = []
        this.each(function () {
            var parent = this.parentNode
            if (!parent) return
            var kids = parent.children
            for (var i = 0; i < kids.length; i++) {
                if (kids[i] !== this) out.push(kids[i])
            }
        })
        return new Dom(out)
    }

    Dom.prototype.click = function () {
        return this.each(function () { this.click() })
    }

    /** SVG-friendly class helpers (class attribute, not className). */
    Dom.prototype.addSvgClass = function (className) {
        return this.each(function () {
            var attr = this.getAttribute('class') || ''
            var parts = attr.split(/\s+/).filter(Boolean)
            if (parts.indexOf(className) === -1) {
                parts.push(className)
                this.setAttribute('class', parts.join(' '))
            }
        })
    }

    Dom.prototype.removeSvgClass = function (className) {
        return this.each(function () {
            var attr = this.getAttribute('class') || ''
            this.setAttribute('class', attr.split(/\s+/).filter(function (item) {
                return item && item !== className
            }).join(' '))
        })
    }

    function $(sel) {
        if (typeof sel === 'function') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', sel)
            } else {
                sel()
            }
            // Allow $(fn)(fn2)() ASI footgun used by tutorial-shell.js
            return $
        }
        if (sel == null || sel === '') return new Dom([])
        if (sel.nodeType) return new Dom([sel])
        if (sel instanceof Dom) return sel
        var nodes = document.querySelectorAll(sel)
        return new Dom(Array.prototype.slice.call(nodes))
    }

    $.fn = Dom.prototype
    $.trim = function (s) {
        return String(s == null ? '' : s).trim()
    }

    window.$ = $
})(window)
