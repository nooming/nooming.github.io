// Hearts tutorial overlay, similar to texas/uno tutors
// Renders on .tutor-svg and controls via .hearts-btns-down
// Uses drawCard from hearts.js for visual consistency

let ht_step = 0
let ht_passDir = 0 // 0: left, 1: right, 2: across, 3: none

function heartsTutor(step) {
    ht_step = step
    let str = '', str2 = ''

    // Simple helpers
    const order = '23456789XJQKA'
    const suits = 'CDSH'
    function makeSuit(s, n) { return s + order[n] }
    function defs() {
        return `<defs>
            <marker id="arrow" fill="#333" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
        </defs>`
    }

    function fan(cards, cx, cy, faceDown = false, spread = 18, rotStep = 3, extraCls = '') {
        let out = ''
        const cnt = cards.length
        for (let i = 0; i < cnt; i++) {
            const offset = i - (cnt - 1) / 2
            const x = cx + offset * spread
            const y = cy - 3 * Math.cos(offset / Math.PI) + 3
            const rot = offset * rotStep
            out += drawCard(x, y, faceDown ? 'C2' : cards[i], { rotation: rot, faceDown, clickable: false, extraClass: extraCls })
        }
        return out
    }
    function centerStack(cards, biasX = 0, biasY = 0, opacity = 1, history = false) {
        // Render 4 cards in the center (a trick)
        const seatBias = [ { x: 0, y: 60 }, { x: -60, y: 0 }, { x: 0, y: -60 }, { x: 60, y: 0 } ]
        const seatRot = [0, -90, 180, 90]
        let out = ''
        cards.forEach((entry, idx) => {
            const bias = seatBias[idx] || { x: 0, y: 0 }
            const dx = (entry.dx || 0) * 4 + bias.x + biasX
            const dy = (entry.dy || 0) * 4 + bias.y + biasY
            const rot = (entry.rot || 0) + (seatRot[idx] || 0)
            out += drawCard(250 + dx, 250 + dy, entry.card, {
                rotation: rot,
                faceDown: !!entry.faceDown,
                clickable: false,
                opacity: history ? 0.3 : opacity,
                extraClass: history ? 'trick-history' : `trick-card trick-${idx}`
            })
        })
        return out
    }
    function renderHands(opts = {}) {
        const counts = opts.counts || [13, 13, 13, 13]
        const spread = opts.spread || 18
        const rotStep = opts.rotStep || 3
        const youCards = (opts.youCards || you).slice(0, counts[0])
        const fillDown = n => Array(Math.max(n, 0)).fill('C2')
        let out = ''
        out += fan(youCards, 250, 465, false, spread, rotStep)
        out += `<g transform="rotate(-90,250,250)">${fan(fillDown(counts[1]), 250, 465, true, spread, rotStep)}</g>`
        out += `<g transform="rotate(180,250,250)">${fan(fillDown(counts[2]), 250, 465, true, spread, rotStep)}</g>`
        out += `<g transform="rotate(90,250,250)">${fan(fillDown(counts[3]), 250, 465, true, spread, rotStep)}</g>`
        return out
    }
    function dropCards(list, toDrop) {
        const remaining = [...list]
        toDrop.forEach(card => {
            const idx = remaining.indexOf(card)
            if (idx !== -1) remaining.splice(idx, 1)
        })
        return remaining
    }
    function getButton(type, text, onclick, glyph = 0) {
        const icon = glyph ? `<span class="glyphicon glyphicon-${glyph}"></span> ` : ''
        return `<button class="btn btn-${type}" onclick="${onclick}">${icon}${text}</button>`
    }

    // Prebaked example hands (13 each)
    const you = ['C2','C5','C9','CX','DA','D5','D7','H4','H6','H9','SQ','S7','SA']
    const left = Array(13).fill('C2')
    const top = Array(13).fill('C2')
    const right = Array(13).fill('C2')

    // Clear overlays
    $('.tutor').show()
    $('.tutor-svg-2').html('')

    switch (step) {
        case 0: {
            // Deal: show backs, ×13, arrows from center to seats (no text block)
            $('.tutor').html('<h3>① 发牌</h3><p style="margin-top:-8px">每位玩家发 13 张牌，准备进入传牌阶段。</p>')
            str += defs()
            str += '<rect x="100" y="100" width="300" height="300" rx="50" stroke="#333" stroke-width="1.5" fill="transparent"></rect>'
            // deck at center
            str += drawCard(250, 250, 'C2', { faceDown: true, clickable: false })
            // to bottom (you)
            str += `<line x1="250" y1="250" x2="250" y2="420" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"></line>`
            str += drawCard(250, 460, 'C2', { faceDown: true, clickable: false })
            str += `<text x="235" y="445" font-size="18" fill="#333">×13</text>`
            // to left
            str += `<line x1="250" y1="250" x2="180" y2="250" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"></line>`
            str += drawCard(155, 250, 'C2', { faceDown: true, clickable: false })
            str += `<text x="140" y="230" font-size="16" fill="#333">×13</text>`
            // to top
            str += `<line x1="250" y1="250" x2="250" y2="180" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"></line>`
            str += drawCard(250, 155, 'C2', { faceDown: true, clickable: false })
            str += `<text x="265" y="145" font-size="16" fill="#333">×13</text>`
            // to right
            str += `<line x1="250" y1="250" x2="320" y2="250" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"></line>`
            str += drawCard(345, 250, 'C2', { faceDown: true, clickable: false })
            str += `<text x="352" y="230" font-size="16" fill="#333">×13</text>`
            // always show all hands (facedown for others)
            str += renderHands({ counts: [13, 13, 13, 13], spread: 18, rotStep: 2 })
            $('.hearts-svg').css('opacity', '0.3')
            $('.hearts-btns-down').html(getButton('default', '②', 'heartsTutor(1)', 'arrow-right'))
            break
        }
        case 1: {
            // Passing explanation with direction cycle, interactive toggles
            $('.tutor').html('<h3>② 传牌</h3><p style="margin-top:-8px">方向依次：左 → 右 → 对家 → 无需传牌</p>')
            str += defs()
            str += '<rect x="100" y="100" width="300" height="300" rx="50" stroke="#333" stroke-width="1.5" fill="transparent"></rect>'
            // Your hand with three highlighted outbound cards
            const passCards = ['SQ','H9','DA']
            const keepCards = you.filter(c => passCards.indexOf(c) === -1)
            // other seats hands stay visible
            str += renderHands({ counts: [13, 13, 13, 13], youCards: you, spread: 18, rotStep: 3 })
            // outbound
            passCards.forEach((c, i) => {
                str += drawCard(250 + 40 * (i - 1), 430, c, { rotation: 0, clickable: false })
                // arrow towards target per current ht_passDir
                if (ht_passDir === 0) str += `<line x1="${250 + 40 * (i - 1)}" y1="415" x2="${250 + 40 * (i - 1) - 60}" y2="415" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"></line>`
                else if (ht_passDir === 1) str += `<line x1="${250 + 40 * (i - 1)}" y1="415" x2="${250 + 40 * (i - 1) + 60}" y2="415" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"></line>`
                else if (ht_passDir === 2) str += `<line x1="${250 + 40 * (i - 1)}" y1="415" x2="${250 + 40 * (i - 1)}" y2="365" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"></line>`
            })
            // Destinations: show three facedown cards at target seat based on ht_passDir
            const facedown = [{ card: 'C2' }, { card: 'C2' }, { card: 'C2' }]
            if (ht_passDir === 0) str += `<g transform="rotate(-90,250,250)">${centerStack(facedown.map(c => ({ ...c, faceDown: true })), 0, 0, 1, false)}</g>` // left
            else if (ht_passDir === 1) str += `<g transform="rotate(90,250,250)">${centerStack(facedown.map(c => ({ ...c, faceDown: true })), 0, 0, 1, false)}</g>` // right
            else if (ht_passDir === 2) str += `<g transform="rotate(180,250,250)">${centerStack(facedown.map(c => ({ ...c, faceDown: true })), 0, 0, 1, false)}</g>` // across
            else str += ''
            $('.hearts-svg').css('opacity', '0.3')
            $('.hearts-btns-down').html(`
                <div class="btn-group">
                    ${getButton('default','①','heartsTutor(0)','arrow-left')}
                    ${getButton('default','③','heartsTutor(2)','arrow-right')}
                </div>
                <div class="btn-group" style="margin-left:10px;">
                    ${getButton(ht_passDir===0?'primary':'default','向左','(ht_passDir=0,heartsTutor(1))','arrow-left')}
                    ${getButton(ht_passDir===1?'primary':'default','向右','(ht_passDir=1,heartsTutor(1))','arrow-right')}
                    ${getButton(ht_passDir===2?'primary':'default','对家','(ht_passDir=2,heartsTutor(1))','arrow-up')}
                    ${getButton(ht_passDir===3?'primary':'default','无需','(ht_passDir=3,heartsTutor(1))','ban-circle')}
                </div>`)
            break
        }
        case 2: {
            $('.tutor').html('<h3>③ 首墩</h3><p>第一墩必须从<span style="color:#333">梅花 2</span>起牌；首家定花色，其余必须跟花色。</p>')
            str += defs()
            str += '<rect x="100" y="100" width="300" height="300" rx="50" stroke="#333" stroke-width="1.5" fill="transparent"></rect>'
            const youAfterPlay = dropCards(you, ['C2'])
            str += renderHands({ counts: [12, 12, 12, 12], youCards: youAfterPlay, spread: 18, rotStep: 3 })
            str += centerStack([
                { card: 'C2' },
                { card: 'C8' },
                { card: 'CA' },
                { card: 'C5' }
            ])
            $('.hearts-svg').css('opacity', '0.3')
            $('.hearts-btns-down').html(`<div class="btn-group">${getButton('default','②','heartsTutor(1)','arrow-left')}${getButton('default','④','heartsTutor(3)','arrow-right')}</div>`)
            break
        }
        case 3: {
            $('.tutor').html('<h3>④ 跟花色</h3><p>有首家花色必须跟；没有时可出任意牌。</p>')
            str += defs()
            str += '<rect x="100" y="100" width="300" height="300" rx="50" stroke="#333" stroke-width="1.5" fill="transparent"></rect>'
            str += renderHands({ counts: [12, 12, 12, 12], youCards: dropCards(you, ['C2']), spread: 18, rotStep: 3 })
            str += centerStack([
                { card: 'S5' },
                { card: 'HK' },
                { card: 'HA' },
                { card: 'S3' }
            ])
            // annotate invalid follow for H when lead is S
            str += `<text x="210" y="180" font-size="14" fill="#d9534f">非首家花色（不能赢）</text>`
            $('.hearts-svg').css('opacity', '0.3')
            $('.hearts-btns-down').html(`<div class="btn-group">${getButton('default','③','heartsTutor(2)','arrow-left')}${getButton('default','⑤','heartsTutor(4)','arrow-right')}</div>`)
            break
        }
        case 4: {
            $('.tutor').html('<h3>⑤ 首墩禁分</h3><p>首墩不能出红心或黑桃 Q；红心未破时，也不能主动出红心。</p>')
            str += defs()
            str += '<rect x="100" y="100" width="300" height="300" rx="50" stroke="#333" stroke-width="1.5" fill="transparent"></rect>'
            str += renderHands({ counts: [12, 12, 12, 12], youCards: dropCards(you, ['C2']), spread: 18, rotStep: 3 })
            str += centerStack([
                { card: 'D8' },
                { card: 'SQ' },
                { card: 'H8' },
                { card: 'D7' }
            ])
            str += `<text x="195" y="180" font-size="14" fill="#d9534f">首墩禁分</text>`
            $('.hearts-svg').css('opacity', '0.3')
            $('.hearts-btns-down').html(`<div class="btn-group">${getButton('default','④','heartsTutor(3)','arrow-left')}${getButton('default','⑥','heartsTutor(5)','arrow-right')}</div>`)
            break
        }
        case 5: {
            $('.tutor').html('<h3>⑥ 计分</h3><p>红心每张 1 分，黑桃 Q 13 分。由本墩赢家收分并下一墩首家。</p>')
            str += defs()
            str += '<rect x="100" y="100" width="300" height="300" rx="50" stroke="#333" stroke-width="1.5" fill="transparent"></rect>'
            // Example trick with points going to the S5 vs S3 winner
            str += renderHands({ counts: [12, 12, 12, 12], youCards: dropCards(you, ['C2']), spread: 18, rotStep: 3 })
            str += centerStack([
                { card: 'S5' },
                { card: 'HK' },
                { card: 'HA' },
                { card: 'S3' }
            ])
            str += `<text x="160" y="330" font-size="14" fill="#333">本墩分数：2</text>`
            str += `<text x="160" y="350" font-size="14" fill="#333">赢家：最大同花色（此例为黑桃 5）</text>`
            $('.hearts-svg').css('opacity', '0.3')
            $('.hearts-btns-down').html(`<div class="btn-group">${getButton('default','⑤','heartsTutor(4)','arrow-left')}${getButton('danger','离开','endHeartsTutor()','log-out')}</div>`)
            break
        }
    }
    $('.tutor-svg').html(str)
}

function startTutor() {
    if (window.TutorialShell) window.TutorialShell.open()
    else {
        $('.list-all').hide()
        $('.chat').show()
        $('.decor').hide()
        $('.tutor').show()
        $('.tutor-svg').show()
        $('.tutor-svg-2').html('')
        $('.btn-exit').removeClass('btn-danger')
    }
    heartsTutor(0)
}

function endHeartsTutor() {
    if (window.TutorialShell) window.TutorialShell.close()
    else {
        $('.list-all').show()
        $('.chat').hide()
        $('.decor').show()
        $('.tutor').hide()
    }
    $('.hearts-svg').css('opacity', '1')
    $('.tutor-svg').hide('')
    $('.tutor-svg').html('')
    $('.tutor-svg-2').html('')
    $('.hearts-btns').html('')
    $('.hearts-btns-down').html('')
}

/** 与德州 / UNO 页「离开」按钮上的 endTutor 名称一致 */
function endTutor() {
    endHeartsTutor()
}
