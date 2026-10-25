/* global window */
(function () {
    'use strict'

    /** 圆桌毡布（UNO / 德州）：裁切为圆后中心高光区小，整体偏深 */
    function feltGradientDefs() {
        return (
            '<radialGradient id="card-table-felt" cx="50%" cy="40%" r="65%" gradientUnits="objectBoundingBox">' +
            '<stop offset="0%" stop-color="#22885a"/>' +
            '<stop offset="52%" stop-color="#156841"/>' +
            '<stop offset="100%" stop-color="#0c452c"/>' +
            '</radialGradient>'
        )
    }

    /** 方桌毡布（红心）：同色系但不铺亮绿中心，避免整面方桌显得发淡 */
    function feltGradientDefsSquare() {
        return (
            '<radialGradient id="card-table-felt" gradientUnits="userSpaceOnUse" cx="250" cy="245" r="210">' +
            '<stop offset="0%" stop-color="#156841"/>' +
            '<stop offset="45%" stop-color="#125a38"/>' +
            '<stop offset="100%" stop-color="#0c452c"/>' +
            '</radialGradient>'
        )
    }

    /** UNO / 德州：圆桌（r=150） */
    function circleTable() {
        return (
            '<g class="card-table-surface" aria-hidden="true">' +
            '<circle cx="250" cy="250" r="153" fill="#083d28" opacity="0.35"/>' +
            '<circle cx="250" cy="250" r="151" fill="none" stroke="#2a2a2a" stroke-width="2"/>' +
            '<circle cx="250" cy="250" r="150" fill="url(#card-table-felt)" stroke="rgba(255,255,255,0.32)" stroke-width="1.5"/>' +
            '</g>'
        )
    }

    /** 红心：圆角方桌 */
    function squareTable() {
        return (
            '<g class="card-table-surface" aria-hidden="true">' +
            '<rect x="97" y="97" width="306" height="306" rx="53" fill="#083d28" opacity="0.35"/>' +
            '<rect x="99" y="99" width="302" height="302" rx="51" fill="none" stroke="#2a2a2a" stroke-width="2"/>' +
            '<rect x="100" y="100" width="300" height="300" rx="50" fill="url(#card-table-felt)" stroke="rgba(255,255,255,0.32)" stroke-width="1.5"/>' +
            '</g>'
        )
    }

    function circleTableWithDefs() {
        return '<defs>' + feltGradientDefs() + '</defs>' + circleTable()
    }

    window.CardTableSurface = {
        feltGradientDefs: feltGradientDefs,
        feltGradientDefsSquare: feltGradientDefsSquare,
        circleTable: circleTable,
        squareTable: squareTable,
        circleTableWithDefs: circleTableWithDefs
    }
})()
