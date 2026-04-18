let cens = [], out = [], history = [["Y9", 0.41730104345968133, 0.3135678562320261, -1.2735873739645578]]
function tutor(step) {
    let str = '', str2 = '', k
    cur = {
        plist: [0, 1, 2],
        cards: {
            0: ["G-", "R-", "R8", "R5", "R9", "RR", "Y9"],
            1: ["!!", "B9", "B7", "G1", "G9", "Y2", "Y9"],
            2: ["!+", "B2", "B8", "G7", "R4", "Y+", "Y3"]
        },
        allLeft: 93,
        name: { 0: sso.realname, 1: '李行', 2: '甄历骇' },
        isIngame: { 0: 1, 1: 1, 2: 1 },
        isReady: { 0: 1, 1: 1, 2: 1 },
        left: { 0: 7, 1: 7, 2: 7 },
        won: { 0: 0, 1: 0, 2: 0 },
        givenup: { 0: 0, 1: 0, 2: 0 },
        history: history,
        cen: 'Y5',
        isOffline: {},
        you: 0,
        now: 0,
        ban: 0,
        rot: 1,
        st: 1,
        initLeft: 7,
        toDraw: 0
    }
    $('.uno-svg').css('opacity', '0.5')
    cur.allLeft = [93, 93, 93, 93, 93, 92, 92, 92, 91, 90, 89, 88, 88, 88, 88, 88, 87, 86, 85, 84, 84, 84, 84, 84][step]
    switch (step) {
        case 0:
            out = []
            $('.tutor').html('<h3>① 发牌</h3><p style="margin-top:-8px">每位玩家发 7 张牌，并翻开 1 张牌作为起始牌。</p>')
            str += `<line x1="80" y1="460" x2="103" y2="460" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
            str += `<text x="45" y="468" font-size="20">×7</text>`
            str += `<rect x="30" y="450" width="14" height="20" rx="2" fill="#ddd" stroke="#333" stroke-width="1.5"></rect>`
            // str += `<line x1="180" y1="250" x2="203" y2="250" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
            // str += `<text x="135" y="258" font-size="20">×93</text>`
            // str += `<rect x="120" y="240" width="14" height="20" rx="2" fill="#ddd" stroke="#333" stroke-width="1.5"></rect>`
            str += `<line x1="320" y1="250" x2="297" y2="250" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
            str += `<text x="340" y="258" font-size="20">×1</text>`
            str += `<rect x="325" y="240" width="14" height="20" rx="2" fill="#ddd" stroke="#333" stroke-width="1.5"></rect>`
            str += drawCard(262.5, 250, cur.cen, cur.history[cur.history.length - 1][1])
            k = cur.cards[0]
            for (let j = 0; j < k.length; j++) {
                if (k.length < 12) str += drawCard(265 - 20 * k.length + 40 * j, 460, k[j], 0, 0, `card-${j}`)
                else if (k.length < 17) str += drawCard(265 - 15 * k.length + 30 * j, 460, k[j], 0, 0, `card-${j}`)
                else str += drawCard(265 - 10 * k.length + 20 * j, 460, k[j], 0, 0, `card-${j}`)
            }
            $('.uno-btns-down').html(getButton('default', `②`, `tutor(1)`, 0, 0, 0, 0, 'arrow-right'))
            break
        case 1:
            out = []
            me.card = ''
            $('.tutor').html('<h3>② 出牌</h3><p>要和桌上的牌同色或同数字。</p>')
            str += `<line class="line-0" x1="250" y1="399" x2="250" y2="340" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"></line>`
                + `<text x="250" y="420" text-anchor="middle">${sso.realname}</text>`
                + `<circle cx="${sso.realname.length * 8 + 258}" cy="414" r="5" class="blink"></circle>`
            str += `<line x1="320" y1="250" x2="297" y2="245" stroke="#333" stroke-width="1.5" transform="rotate(50,250,250)" marker-end="url(#arrow)"/>`
            str += drawCard(342.5, 250, 'YX', 60)
            str += drawCard(332.5, 250, 'X5', 40)
            str += drawCard(262.5, 250, cur.cen, cur.history[cur.history.length - 1][1])
            k = cur.cards[0]
            for (let j = 0; j < k.length; j++) {
                if (validCard(cur.cen, k[j])) str += drawCard(265 - 20 * k.length + 40 * j, 460, k[j], 0, 0, `card-${j}`)
            }
            $('.uno-btns-down').html(`${getButton('primary', `出牌`, `if(me.card)tutor(2)`, 'arrow-up')}`)
            break
        case 2:
            $('.tutor').html('<h3>② 出牌</h3>')
            out = [me.card]
            cur.left = { 0: 6, 1: 7, 2: 7 }
            cur.history.push([0, Math.random() * 10 - 5])
            let gg = out[0]
            cur.cards[0] = cur.cards[0].filter(e => e != gg ? 1 : gg = 0)
            if (me.card != '') cens[2] = me.card
            cur.cen = me.card || cens[2]
            cur.now = 1
            me.card = ''
            str += `<line x1="270" y1="185" x2="270" y2="210" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
            str += drawCard(260, 150, cur.cen[0] + 'X', 10)
            str += drawCard(270, 150, 'X' + cur.cen[1], -10)
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `①`, `tutor(0)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(3)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 3:
            $('.tutor').html('<h3>② 出牌</h3>')
            cur.left = { 0: 6, 1: 6, 2: 7 }
            cur.history.push([0, Math.random() * 10 - 5])
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4", "Y+"]
            cur.now = 2
            if (!cens[3]) cens[3] = cens[2][0] + '6'
            cur.cen = cens[3]
            cens[4] = ''
            me.card = ''
            str += `<line x1="320" y1="250" x2="297" y2="250" stroke="#333" stroke-width="1.5" transform="rotate(10,250,250)" marker-end="url(#arrow)"/>`
            str += drawCard(342.5, 250, cur.cen[0] + 'X', 20)
            str += drawCard(332.5, 250, 'X' + cur.cen[1], 0)
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(2)`, 'arrow-left')}${getButton('default', `③`, `tutor(4)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 4:
            $('.tutor').html('<h3>③ 摸牌</h3><p>无牌可出时，可以摸一张牌。</p>')
            cur.left = { 0: 6, 1: 6, 2: 6 }
            cur.history.push([0, Math.random() * 10 - 5])
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4", "Y+"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+"]
            cur.now = 0
            cur.toDraw = 1
            if (!cens[4]) cens[4] = 'B' + cens[3][1]
            cur.cen = cens[4]
            cens[5] = ''
            me.card = ''
            $('.uno-svg').css('opacity', '0.3')
            str += `<rect class="cards-rect" x="212.5" y="225" transform="rotate(0,250,250)" width="35" height="50" rx="5" fill="white" stroke="#333" stroke-width="1.5" onmouseenter="$('.cards-rect,.cards-left,.cards-arrow').css('translate','0 3px')" onmouseleave="$('.cards-rect,.cards-left,.cards-arrow').css('translate','0')" onclick="tutor(5)" style="cursor: pointer;"></rect>`
                + `<text class="nomouse cards-arrow" x="229.5" y="270" text-anchor="middle" font-family="Glyphicons Halflings" fill="#333"></text>`
                + `<text class="nomouse cards-left" x="229.5" y="243" text-anchor="middle" font-size="12" fill="#333">摸牌</text>`
            $('.uno-btns-down').html(`${getButton('primary disabled', `出牌`, ``, 'arrow-up')}`)
            break
        case 5:
            $('.tutor').html('<h3>③ 摸牌</h3><p>摸到的牌本回合可打出。</p>')
            cur.left = { 0: 7, 1: 6, 2: 6 }
            cur.cards[0] = ["G-", "R-", "R8", "R5", "R9", "RR", "Y9", "B+"]
            for (let i = 0; i < out.length; i++) {
                let gg = out[i]
                cur.cards[0] = cur.cards[0].filter(e => e != gg ? 1 : gg = 0)
            }
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4", "Y+"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+"]
            cur.now = 0
            cur.toDraw = 0
            cur.cen = cens[4]
            me.card = ''
            k = cur.cards[0]
            for (let j = 0; j < k.length; j++) {
                if (validCard(cur.cen, k[j])) {
                    if (k.length < 12) str += drawCard(265 - 20 * k.length + 40 * j, 460, k[j], 0, 0, `card-${j}`)
                    else if (k.length < 17) str += drawCard(265 - 15 * k.length + 30 * j, 460, k[j], 0, 0, `card-${j}`)
                    else str += drawCard(265 - 10 * k.length + 20 * j, 460, k[j], 0, 0, `card-${j}`)
                }
            }
            $('.uno-svg').css('opacity', '0.3')
            str += `<rect class="cards-rect" x="212.5" y="225" transform="rotate(0,250,250)" width="35" height="50" rx="5" fill="white" stroke="#333" stroke-width="1.5" onmouseenter="$('.cards-rect,.cards-left,.cards-arrow').css('translate','0 3px')" onmouseleave="$('.cards-rect,.cards-left,.cards-arrow').css('translate','0')" onclick="tutor(5)" style="cursor: pointer;"></rect>`
                + `<text class="nomouse cards-arrow" x="229.5" y="270" text-anchor="middle" font-family="Glyphicons Halflings" fill="#333"></text>`
                + `<text class="nomouse cards-left" x="229.5" y="243" text-anchor="middle" font-size="12" fill="#333">摸牌</text>`
            str += `<text class="card-text nomouse card-6-text" x="395" y="455" width="40" textWrap="wrap" transform="rotate(0,250,250)" font-size="12" fill="#333" style="display: none;">强制下一玩家<tspan x="395" y="472">摸两张牌</tspan></text>`
            $('.uno-btns-down').html(`${getButton('primary', `出牌`, `if(me.card=='B+')tutor(6)`, 'arrow-up')}`)
            break
        case 6:
            $('.tutor').html(`<h3>④ 功能牌</h3><p>这是一张功能牌，对下一玩家生效。${cur.name[1]}接下来需要摸两张牌……</p>`)
            cur.left = { 0: 6, 1: 6, 2: 6 }
            cur.history.push([0, Math.random() * 10 - 5])
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4", "Y+"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+"]
            cens[6] = 'B+'
            cur.cen = cens[6]
            cur.now = 1
            cur.banDraw = cur.toDraw = 2
            me.card = ''
            str += `<line x1="270" y1="185" x2="270" y2="210" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
            str += drawCard(262, 150, 'X' + cur.cen[1], 0)
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `②`, `tutor(3)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(7)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 7:
            $('.tutor').html(`<h3>④ 功能牌</h3><p>……或者用同样的功能牌和它叠加。现在${cur.name[2]}要摸四张牌了。</p>`)
            cur.left = { 0: 6, 1: 5, 2: 6 }
            cur.history.push([0, Math.random() * 10 - 5])
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+"]
            cens[7] = 'G+'
            cur.cen = cens[7]
            cur.now = 2
            cur.banDraw = cur.toDraw = 4
            me.card = ''
            str += `<line x1="270" y1="185" x2="270" y2="210" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
            str += drawCard(262, 150, 'X' + cur.cen[1], 0)
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(6)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(8)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 8:
            $('.tutor').html(`<h3>④ 功能牌</h3><p>……或者用同样的功能牌和它叠加。现在${cur.name[2]}要摸四张牌了。</p>`)
            cur.left = { 0: 6, 1: 5, 2: 7 }
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+"]
            cur.cen = cens[7]
            cur.now = 2
            cur.banDraw = cur.toDraw = 3
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(7)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(9)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 9:
            $('.tutor').html(`<h3>④ 功能牌</h3><p>……或者用同样的功能牌和它叠加。现在${cur.name[2]}要摸四张牌了。</p>`)
            cur.left = { 0: 6, 1: 5, 2: 8 }
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+"]
            cur.cen = cens[7]
            cur.now = 2
            cur.banDraw = cur.toDraw = 2
            me.card = ''
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(8)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(10)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 10:
            $('.tutor').html(`<h3>④ 功能牌</h3><p>……或者用同样的功能牌和它叠加。现在${cur.name[2]}要摸四张牌了。</p>`)
            cur.left = { 0: 6, 1: 5, 2: 9 }
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+", "Y+"]
            cur.cen = cens[7]
            cur.now = 2
            cur.banDraw = cur.toDraw = 1
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(9)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(11)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 11:
            $('.tutor').html(`<h3>④ 功能牌</h3><p>效果发挥完之后，它就和普通牌一样了。</p>`)
            cur.left = { 0: 6, 1: 5, 2: 10 }
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+", "Y+", "Y+"]
            cur.cen = cens[7]
            cur.now = 0
            str += `<line x1="320" y1="250" x2="297" y2="245" stroke="#333" stroke-width="1.5" transform="rotate(50,250,250)" marker-end="url(#arrow)"/>`
            str += drawCard(342.5, 250, cur.cen[0] + 'X', 60)
            str += drawCard(332.5, 250, 'X' + cur.cen[1], 40)
            $('.uno-svg').css('opacity', '0.5')
            for (let i = 0; i < out.length; i++) {
                let gg = out[i]
                cur.cards[0] = cur.cards[0].filter(e => e != gg ? 1 : gg = 0)
            }
            k = cur.cards[0]
            for (let j = 0; j < k.length; j++) {
                if (validCard(cur.cen, k[j])) str += drawCard(265 - 20 * k.length + 40 * j, 460, k[j], 0, 0, `card-${j}`)
            }
            $('.uno-btns-down').html(`${getButton('primary', `出牌`, `if(me.card)tutor(12)`, 'arrow-up')}`)
            break
        case 12:
            $('.tutor').html(`<h3>④ 功能牌</h3><p style="margin-top:17px">　 　 禁止下家出牌或摸牌，只能跳过。</p>`)
            cur.left = { 0: 5, 1: 5, 2: 10 }
            cur.history.push([0, Math.random() * 10 - 5])
            cur.cards[0] = ["R-", "R8", "R5", "R9", "RR", "Y9"]
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+", "Y+", "Y+"]
            cens[12] = 'G-'
            cur.cen = cens[12]
            cur.now = 1
            str2 += drawCard(10, 75, 'X-', 0)
            // str += drawCard(122.5, 250, 'X-', 30)
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(10)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(13)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 13:
            $('.tutor').html(`<h3>④ 功能牌</h3><p></p>`)
            cur.left = { 0: 5, 1: 5, 2: 10 }
            cur.cards[0] = ["R-", "R8", "R5", "R9", "RR", "Y9"]
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+", "Y+", "Y+"]
            cur.cen = cens[12]
            cur.now = 2
            str += `<line x1="270" y1="185" x2="270" y2="210" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
            str += drawCard(260, 150, cur.cen[0] + 'X', 10)
            str += drawCard(270, 150, 'X' + cur.cen[1], -10)
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(12)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(14)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 14:
            $('.tutor').html(`<h3>④ 功能牌</h3><p style="margin-top:17px">　 　 反转出牌顺序。现在出牌从顺时针变成逆时针了。</p>`)
            cur.left = { 0: 5, 1: 5, 2: 9 }
            cur.history.push([0, Math.random() * 10 - 5])
            cur.cards[0] = ["R-", "R8", "R5", "R9", "RR", "Y9"]
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+", "Y+"]
            cens[14] = 'GR'
            cur.cen = cens[14]
            cur.now = 1
            cur.rot = 0
            str2 += drawCard(10, 75, 'XR', 0)
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(13)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(15)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 15:
            $('.tutor').html(`<h3>④ 功能牌</h3><p style="margin-top:10px;line-height:37px">　 　 有双重效果——1. 强制下家摸四张牌……</p>`)
            cur.left = { 0: 5, 1: 4, 2: 9 }
            cur.history.push([0, Math.random() * 10 - 5])
            cur.cards[0] = ["R-", "R8", "R5", "R9", "RR", "Y9"]
            cur.cards[1] = ["B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+", "Y+"]
            cens[15] = '!+'
            cur.cen = cens[15]
            cur.now = 1
            cur.rot = 0
            cur.banDraw = cur.toDraw = 4
            str2 += drawCard(10, 75, '!+', 0)
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(14)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(16)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 16:
            $('.tutor').html(`<h3>④ 功能牌</h3><p style="margin-top:10px;line-height:37px">　 　 有双重效果——1. 强制下家摸四张牌 2. 选定颜色。<br>现在你只能摸四张牌了。</p>`)
            cur.left = { 0: 5, 1: 4, 2: 9 }
            cur.cards[0] = ["R-", "R8", "R5", "R9", "RR", "Y9"]
            cur.cards[1] = ["B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+", "Y+"]
            cens[16] = '!+G'
            cur.cen = cens[16]
            cur.rot = 0
            cur.banDraw = cur.toDraw = 4
            str2 += drawCard(10, 75, '!+', 0)
            str += `<rect class="cards-rect" x="212.5" y="225" transform="rotate(0,250,250)" width="35" height="50" rx="5" fill="white" stroke="#333" stroke-width="1.5" onmouseenter="$('.cards-rect,.cards-left,.cards-arrow').css('translate','0 3px')" onmouseleave="$('.cards-rect,.cards-left,.cards-arrow').css('translate','0')" onclick="tutor(17)" style="cursor: pointer;"></rect>`
                + `<text class="nomouse cards-arrow" x="229.5" y="270" text-anchor="middle" font-family="Glyphicons Halflings" fill="#333"></text>`
                + `<text class="nomouse cards-left" x="229.5" y="243" text-anchor="middle" font-size="12" fill="#333">摸牌</text>`
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`${getButton('primary disabled', `出牌`, ``, 'arrow-up')}`)
            break
        case 17:
            $('.tutor').html(`<h3>④ 功能牌</h3><p style="margin-top:10px;line-height:37px">　 　 有双重效果——1. 强制下家摸四张牌 2. 选定颜色。<br>现在你只能摸四张牌了。</p>`)
            cur.left = { 0: 6, 1: 4, 2: 9 }
            cur.cards[0] = ["R-", "R8", "R5", "R9", "RR", "Y9", "Y2"]
            cur.cards[1] = ["B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+", "Y+"]
            cur.cen = cens[16]
            cur.rot = 0
            cur.banDraw = cur.toDraw = 3
            str2 += drawCard(10, 75, '!+', 0)
            str += `<rect class="cards-rect" x="212.5" y="225" transform="rotate(0,250,250)" width="35" height="50" rx="5" fill="white" stroke="#333" stroke-width="1.5" onmouseenter="$('.cards-rect,.cards-left,.cards-arrow').css('translate','0 3px')" onmouseleave="$('.cards-rect,.cards-left,.cards-arrow').css('translate','0')" onclick="tutor(18)" style="cursor: pointer;"></rect>`
                + `<text class="nomouse cards-arrow" x="229.5" y="270" text-anchor="middle" font-family="Glyphicons Halflings" fill="#333"></text>`
                + `<text class="nomouse cards-left" x="229.5" y="243" text-anchor="middle" font-size="12" fill="#333">摸牌</text>`
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`${getButton('primary disabled', `出牌`, ``, 'arrow-up')}`)
            break
        case 18:
            $('.tutor').html(`<h3>④ 功能牌</h3><p style="margin-top:10px;line-height:37px">　 　 有双重效果——1. 强制下家摸四张牌 2. 选定颜色。<br>现在你只能摸四张牌了。</p>`)
            cur.left = { 0: 7, 1: 4, 2: 9 }
            cur.cards[0] = ["R-", "R8", "R5", "R9", "RR", "Y9", "Y2", "G+"]
            cur.cards[1] = ["B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+", "Y+"]
            cur.cen = cens[16]
            cur.rot = 0
            cur.banDraw = cur.toDraw = 2
            str2 += drawCard(10, 75, '!+', 0)
            str += `<rect class="cards-rect" x="212.5" y="225" transform="rotate(0,250,250)" width="35" height="50" rx="5" fill="white" stroke="#333" stroke-width="1.5" onmouseenter="$('.cards-rect,.cards-left,.cards-arrow').css('translate','0 3px')" onmouseleave="$('.cards-rect,.cards-left,.cards-arrow').css('translate','0')" onclick="tutor(19)" style="cursor: pointer;"></rect>`
                + `<text class="nomouse cards-arrow" x="229.5" y="270" text-anchor="middle" font-family="Glyphicons Halflings" fill="#333"></text>`
                + `<text class="nomouse cards-left" x="229.5" y="243" text-anchor="middle" font-size="12" fill="#333">摸牌</text>`
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`${getButton('primary disabled', `出牌`, ``, 'arrow-up')}`)
            break
        case 19:
            $('.tutor').html(`<h3>④ 功能牌</h3><p style="margin-top:10px;line-height:37px">　 　 有双重效果——1. 强制下家摸四张牌 2. 选定颜色。<br>现在你只能摸四张牌了。</p>`)
            cur.left = { 0: 8, 1: 4, 2: 9 }
            cur.cards[0] = ["R-", "R8", "R5", "R9", "RR", "Y9", "Y2", "G+", "!!"]
            cur.cards[1] = ["B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+", "Y+"]
            cur.cen = cens[16]
            cur.rot = 0
            cur.banDraw = cur.toDraw = 1
            str2 += drawCard(10, 75, '!+', 0)
            str += `<rect class="cards-rect" x="212.5" y="225" transform="rotate(0,250,250)" width="35" height="50" rx="5" fill="white" stroke="#333" stroke-width="1.5" onmouseenter="$('.cards-rect,.cards-left,.cards-arrow').css('translate','0 3px')" onmouseleave="$('.cards-rect,.cards-left,.cards-arrow').css('translate','0')" onclick="tutor(20)" style="cursor: pointer;"></rect>`
                + `<text class="nomouse cards-arrow" x="229.5" y="270" text-anchor="middle" font-family="Glyphicons Halflings" fill="#333"></text>`
                + `<text class="nomouse cards-left" x="229.5" y="243" text-anchor="middle" font-size="12" fill="#333">摸牌</text>`
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`${getButton('primary disabled', `出牌`, ``, 'arrow-up')}`)
            break
        case 20:
            $('.tutor').html(`<h3>④ 功能牌</h3><p style="margin-top:10px;line-height:37px">　 　 有双重效果——1. 强制下家摸四张牌 2. 选定颜色。<br>${cur.name[2]}只能出选定颜色的牌。</p>`)
            cur.left = { 0: 9, 1: 4, 2: 9 }
            cur.cards[0] = ["R-", "R8", "R5", "R9", "RR", "Y9", "Y2", "G+", "!!", "G3"]
            cur.cards[1] = ["B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+", "Y+"]
            cur.cen = cens[16]
            cur.rot = 0
            cur.now = 2
            str2 += drawCard(10, 75, '!+', 0)
            str += `<line x1="320" y1="250" x2="300" y2="250" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
            str += drawCard(335, 250, cur.cen[2] + 'X', 0)
            str += `<rect class="cards-rect" x="212.5" y="225" transform="rotate(0,250,250)" width="35" height="50" rx="5" fill="white" stroke="#333" stroke-width="1.5" onmouseenter="$('.cards-rect,.cards-left,.cards-arrow').css('translate','0 3px')" onmouseleave="$('.cards-rect,.cards-left,.cards-arrow').css('translate','0')" onclick="tutor(17)" style="cursor: pointer;"></rect>`
                + `<text class="nomouse cards-arrow" x="229.5" y="270" text-anchor="middle" font-family="Glyphicons Halflings" fill="#333"></text>`
                + `<text class="nomouse cards-left" x="229.5" y="243" text-anchor="middle" font-size="12" fill="#333">摸牌</text>`
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(15)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(21)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 21:
            $('.tutor').html(`<h3>④ 功能牌</h3><p style="margin-top:-10px;line-height:37px">不过，彩牌可以看作任何颜色。比如：<br>　 　 也可以选定颜色。<br></p>`)
            cur.left = { 0: 9, 1: 4, 2: 8 }
            cur.history.push([0, Math.random() * 10 - 5])
            cur.cards[0] = ["R-", "R8", "R5", "R9", "RR", "Y9", "Y2", "G+", "!!", "G3"]
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+"]
            cens[21] = '!!'
            cur.cen = cens[21]
            cur.rot = 0
            cur.now = 2
            str2 += drawCard(10, 100, '!!', 0)
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(20)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(22)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 22:
            $('.tutor').html(`<h3>④ 功能牌</h3><p style="margin-top:-10px;line-height:37px">不过，彩牌可以看作任何颜色。比如：<br>　 　 也可以选定颜色。<br></p>`)
            cur.left = { 0: 9, 1: 4, 2: 8 }
            cur.cards[0] = ["R-", "R8", "R5", "R9", "RR", "Y9", "Y2", "G+", "!!", "G3"]
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+"]
            cens[21] = '!!R'
            cur.cen = cens[21]
            cur.rot = 0
            cur.now = 1
            str2 += drawCard(10, 100, '!!', 0)
            str += `<line x1="320" y1="250" x2="300" y2="250" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
            str += drawCard(335, 250, cur.cen[2] + 'X', 0)
            $('.uno-svg').css('opacity', '1')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(21)`, 'arrow-left')}${getButton('default', `⑤`, `tutor(23)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 23:
            $('.tutor').html(`<h3>⑤ 结算</h3><p>这样一直出下去，先出完牌就算胜利。</p>`)
            cur.left = { 0: 9, 1: 4, 2: 8 }
            cur.cards[0] = ["R-", "R8", "R5", "R9", "RR", "Y9", "Y2", "G+", "!!", "G3"]
            cur.cards[1] = ["!+", "B2", "B8", "G7", "R4"]
            cur.cards[2] = ["!+", "B2", "B8", "G7", "R4", "Y+", "Y+", "Y+"]
            cens[21] = '!!R'
            cur.cen = cens[21]
            cur.rot = 0
            cur.st = 3
            $('.uno-svg').css('opacity', '0.3')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `④`, `tutor(22)`, 'arrow-left')}${getButton('default', `牌型`, `tutor(24)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 24:
            $('.tutor').html(`<h3>牌型</h3>`)
            str2 += drawCardsDes(10, 80, ['R0', 'Y1', 'G2', 'B3'], '数字牌。')
            str2 += drawCardsDes(10, 140, ['R+', 'G+', 'B+', 'Y+'], '强制下家摸两张牌。')
            str2 += drawCardsDes(10, 200, ['G-', 'B-', 'Y-', 'R-'], '禁止下家出牌或摸牌。')
            str2 += drawCardsDes(10, 260, ['BR', 'RR', 'YR', 'GR'], '反转出牌顺序。只有两人时，禁止下家出牌或摸牌。')
            str2 += drawCardsDes(10, 320, ['!!'], '选定颜色。')
            str2 += drawCardsDes(10, 380, ['!+'], '强制下家摸四张牌；选定颜色。')
            $('.uno-btns-down').html(`<div class="btn-group">${getButton('default', `⑤`, `tutor(23)`, 'arrow-left')}${getButton('danger', `离开`, `endTutor()`, 'log-out')}</div>`)
            break
    }
    for (let i = 0; i < out.length; i++) {
        let gg = out[i]
        cur.cards[0] = cur.cards[0].filter(e => e != gg ? 1 : gg = 0)
    }
    $('.tutor-svg').html(str)
    $('.tutor-svg-2').html(str2)
    tt = cur.st
    if (step <= 23) drawTable(), $('.uno-svg').show()
    else ($('.uno-svg').hide())
    if (cur.now == 0 && cur.toDraw) {
        $('.cards-rect').attr('fill', 'white').attr('onmouseenter', `$('.cards-rect,.cards-left,.cards-arrow').css('translate','0 3px')`).attr('onmouseleave', `$('.cards-rect,.cards-left,.cards-arrow').css('translate','0')`).css('cursor', 'pointer')
        $('.cards-arrow').attr('fill', '#333')
        $('.cards-left').text('摸牌').attr('fill', '#333')
    } else {
        $('.cards-rect').attr('fill', '#ddd').attr('onmouseenter', '').attr('onmouseleave', '').attr('onclick', '').css('cursor', '')
        $('.cards-arrow').attr('fill', '#bbb')
        $('.cards-left').text(cur.allLeft).attr('fill', '#999')
    }
    if (cur.banDraw) $('.cards-text').text('+' + cur.toDraw)
}
function drawCardsDes(x, y, card, text) {
    let str = ''
    for (let i = 0; i < card.length; i++) {
        str += drawCardDes(x + i * 10, y, card[i], i * 5)
    }
    str += `<text x="${x + 21 + card.length * 10}" y="${y + 7}">${text}</text>`
    return str
}
function drawCardDes(x, y, card, rot = 0, flipped = 0, cl = 0) {
    let col = card[0], num = card[1]
    let colMap = { 'C': 'club', 'D': 'diamond', 'H': 'heart', 'S': 'spade' }
    let colColMap = { 'R': '#ed1c25', 'G': '#01a24f', 'B': '#0095da', 'Y': '#fede02' }
    if (num == '+') num = col != '!' ? '+2' : '+4'
    let str = ''
    // <use x="${x - 4}" y="${y - 8}" transform="rotate(${rot},${x},${y})" href="#${colMap[col]}" />
    if (flipped == 2) str = `<rect class="cards-rect" x="${x - 10}" y="${y - 25}" transform="rotate(${rot},${x},${y})" width="35" height="50" rx="5" fill="#ddd" stroke="#333" stroke-width="1.5"></rect>`
        + `<text class="nomouse cards-arrow" x="${x + 7}" y="${y + 20}" text-anchor="middle" font-family="Glyphicons Halflings">&#xE094;</text>`
        + `<text class="nomouse cards-left" x="${x + 7}" y="${y - 7}" text-anchor="middle" font-size="12"></text>`
        + `<text class="nomouse cards-text" x="${x + 7}" y="${y - 30}" text-anchor="middle" font-size="12" fill="#333"></text>`
    else if (flipped) str = `<rect x="${x - 10}" y="${y - 25}" transform="rotate(${rot},${x},${y})" width="35" height="50" rx="5" fill="#ddd" stroke="#333" stroke-width="1.5"></rect>`
    else {
        // str = `<rect ${cl ? `class="card ${cl}"` : ''} style="cursor:pointer" x="${x - 11}" y="${y - 26}" transform="rotate(${rot},${x},${y})" width="37" height="52" rx="6" fill="${colColMap[col]}" stroke="#333" stroke-width="5"></rect>`
        str = `<rect ${(cl) ? `class="card ${cl}" onmouseenter="$(this).attr('class').match('selected')?1:($('.${cl}').css('translate','0 -3px'),$('.${cl}-text').show())" onmouseleave="$(this).attr('class').match('selected')?1:($('.${cl}').css('translate','0'),$('.${cl}-text').hide())" onclick="selectCard('${cl}')"` : ''} style="cursor:pointer" x="${x - 10}" y="${y - 25}" transform="rotate(${rot},${x},${y})" width="35" height="50" rx="5" fill="${colColMap[col]}" stroke-width="1.5" stroke="white"></rect>`
        if (cl && cl.match('card-old')) str = `<rect class="card ${cl}" style="cursor:pointer" x="${x - 10}" y="${y - 25}" transform="rotate(${rot},${x},${y})" width="35" height="50" rx="5" fill="${colColMap[col]}" stroke-width="1.5" stroke="white"></rect>`
        if (cl) cl = 'nomouse ' + cl
        if (col == '!' && card[2]) {
            str += `<circle cx="${x + 6}" cy="${y + 40}" r="8" fill="${colColMap[card[2]]}" stroke="#333" stroke-width="1.5"></circle>`
        }
        if (num == '+2') str +=
            `<text ${cl ? `class="card-text ${cl}-text"` : ''} x="${x}" y="${y + 35}" transform="rotate(${rot},${x},${y})" font-size="12" fill="#333" style="display:none">+2</text>`
            + `<rect ${cl ? `class="${cl}"` : ''} x="${x + 4.5}" y="${y - 5.5}" transform="rotate(${rot},${x},${y})" width="15" height="21" rx="3" fill="#0009"></rect>`
            + `<rect ${cl ? `class="${cl}"` : ''} x="${x + 3}" y="${y - 7}" transform="rotate(${rot},${x},${y})" width="14" height="20" rx="2" fill="white"></rect>`
            + `<rect ${cl ? `class="${cl}"` : ''} x="${x - 1.5}" y="${y - 13.5}" transform="rotate(${rot},${x},${y})" width="15" height="21" rx="3" fill="#0009"></rect>`
            + `<rect ${cl ? `class="${cl}"` : ''} x="${x - 3}" y="${y - 15}" transform="rotate(${rot},${x},${y})" width="14" height="20" rx="2" fill="white"></rect>`
        else if (num == '-') str +=
            `<text ${cl ? `class="card-text ${cl}-text"` : ''} x="${x - 5}" y="${y + 35}" transform="rotate(${rot},${x},${y})" font-size="12" fill="#333" style="display:none">禁止</text>`
            + `<use ${cl ? `class="${cl}"` : ''} x="${x - 3}" y="${y - 10}" transform="rotate(${rot},${x},${y})" href="#ban-shadow" />`
            + `<use ${cl ? `class="${cl}"` : ''} x="${x - 5}" y="${y - 12}" transform="rotate(${rot},${x},${y})" href="#ban" />`
        else if (num == 'R') {
            str +=
                `<text ${cl ? `class="card-text ${cl}-text"` : ''} x="${x - 5}" y="${y + 35}" transform="rotate(${rot},${x},${y})" font-size="12" fill="#333" style="display:none">反转</text>`
            x += 1
            if ((!cl) ^ cur.rot == 1) str += `<use ${cl ? `class="${cl}"` : ''} x="${x - 5}" y="${y - 12}" transform="translate(-${(x - 5) * 0.4},-${(y - 12) * 0.4}) scale(1.4) rotate(${rot},${x},${y})" href="#cycle-shadow" />`
                + `<use ${cl ? `class="${cl}"` : ''} x="${x - 7}" y="${y - 14}" transform=" translate(-${(x - 7) * 0.4},-${(y - 14) * 0.4}) scale(1.4) rotate(${rot},${x},${y})" href="#cycle" />`
            else str += `<use ${cl ? `class="${cl}"` : ''} x="${x - 5}" y="${y - 12}" transform="translate(${(x - 5) * 2.4 + 28},${(12 - y) * 0.4}) scale(-1.4,1.4) rotate(${rot},${x},${y})" href="#cycle-shadow" />`
                + `<use ${cl ? `class="${cl}"` : ''} x="${x - 7}" y="${y - 14}" transform=" translate(${(x - 7) * 2.4 + 28},${(14 - y) * 0.4}) scale(-1.4,1.4) rotate(${rot},${x},${y})" href="#cycle" />`
        } else if (num == '!') str +=
            `<text ${cl ? `class="card-text ${cl}-text"` : ''} x="${x - 5}" y="${y + 35}" transform="rotate(${rot},${x},${y})" font-size="12" fill="#333" style="display:none">调色</text>`
            + `<use ${cl ? `class="${cl}"` : ''} x="${x + 8}" y="${y - 15}" transform="rotate(${rot},${x},${y})" href="#b-frag" />`
            + `<use ${cl ? `class="${cl}"` : ''} x="${x + 8}" y="${y}" transform="rotate(${rot},${x},${y})" href="#g-frag" />`
            + `<use ${cl ? `class="${cl}"` : ''} x="${x - 7}" y="${y}" transform="rotate(${rot},${x},${y})" href="#y-frag" />`
            + `<use ${cl ? `class="${cl}"` : ''} x="${x - 7}" y="${y - 15}" transform="rotate(${rot},${x},${y})" href="#r-frag" />`
        else if (num == '+4') str +=
            `<text ${cl ? `class="card-text ${cl}-text"` : ''} x="${x}" y="${y + 35}" transform="rotate(${rot},${x},${y})" font-size="12" fill="#333" style="display:none">+4</text>`
            + `<rect ${cl ? `class="${cl}"` : ''} x="${x}" y="${y - 2}" transform="rotate(${rot},${x},${y})" width="14" height="20" rx="2" fill="#fede02" stroke="black" stroke-width="1.5"></rect>`
            + `<rect ${cl ? `class="${cl}"` : ''} x="${x + 6}" y="${y - 8}" transform="rotate(${rot},${x},${y})" width="14" height="20" rx="2" fill="#01a24f" stroke="black" stroke-width="1.5"></rect>`
            + `<rect ${cl ? `class="${cl}"` : ''} x="${x + 2}" y="${y - 18}" transform="rotate(${rot},${x},${y})" width="14" height="20" rx="2" fill="#0095da" stroke="black" stroke-width="1.5"></rect>`
            + `<rect ${cl ? `class="${cl}"` : ''} x="${x - 6}" y="${y - 13}" transform="rotate(${rot},${x},${y})" width="14" height="20" rx="2" fill="#ed1c25" stroke="black" stroke-width="1.5"></rect>`
        else if (parseInt(num) == num) str += `<text ${cl ? `class="${cl}"` : ''} x="${x + 1}" y="${y + 12}" transform="rotate(${rot},${x},${y})" font-size="28" font-weight="500" fill="#0009">${num}</text><text ${cl ? `class="${cl}"` : ''} x="${x - 1}" y="${y + 10}" transform="rotate(${rot},${x},${y})" font-size="28" font-weight="500" fill="white">${num}</text>`
    }
    return str
}
function startTutor() {
    if (window.TutorialShell) window.TutorialShell.open()
    else {
        $('.list-all').hide()
        $('.chat').show()
        $('.tutor').show()
        $('.decor').hide()
        $('.tutor-svg').show()
        $('.tutor-svg-2').html('')
        $('.btn-exit').removeClass('btn-danger')
    }
    tutor(0)
}
function endTutor() {
    if (window.TutorialShell) window.TutorialShell.close()
    else {
        $('.list-all').show()
        $('.chat').hide()
        $('.tutor').hide()
        $('.decor').show()
    }
    $('.uno-svg').html('').css('opacity', '1')
    $('.tutor-svg').html('')
    $('.tutor-svg').hide('')
    $('.tutor-svg-2').html('')
    $('.uno-btns').html('')
    $('.uno-btns-down').html('')
}