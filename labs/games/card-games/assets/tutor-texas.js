function tutor(step) {
    let str = '', str2 = ''
    cur = {
        plist: [0, 1, 2],
        cards: { n: ["D5", "C9", "SK", "H9", "HA"], p: { 0: ["C4", "H9"], 1: ["SA", "C9"], 2: ["CA", "C5"] } },
        name: { 0: sso.realname, 1: '李行', 2: '甄历骇' },
        isIngame: { 0: 1, 1: 1, 2: 1 },
        isReady: { 0: 1, 1: 1, 2: 1 },
        cash: { 0: 1000, 1: 1000, 2: 1000 },
        in: { 0: 0, 1: 0, 2: 0 },
        givenup: { 0: 0, 1: 0, 2: 0 },
        isOffline: {},
        you: 0,
        st: 1
    }
    if (step > 2) cur.isReady = {}
    if (step >= 10) {
        cur.in = { 0: 100, 1: 10, 2: 100 }
        cur.cash = { 0: 900, 1: 990, 2: 900 }
        if (step == 20) cur.cash[0] = 1110
    }
    $('.texas-svg').css('opacity', '0.5')
    switch (step) {
        case 0:
            $('.tutor').html('<h3>① 发牌</h3><p style="margin-top:-8px">每位玩家发 2 张手牌，桌面预留 5 张公共牌。</p>')
            str += `<line x1="180" y1="470" x2="203" y2="470" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
            str += `<text x="145" y="478" font-size="20">×2</text>`
            str += `<rect x="130" y="460" width="14" height="20" rx="2" fill="#ddd" stroke="#333" stroke-width="1.5"></rect>`
            // str += `<line x1="150" y1="470" x2="200" y2="470" stroke="#333" stroke-width="1.5" transform="rotate(120,250,250)" marker-end="url(#arrow)"/>`
            // str += `<line x1="150" y1="470" x2="200" y2="470" stroke="#333" stroke-width="1.5" transform="rotate(240,250,250)" marker-end="url(#arrow)"/>`
            str += `<line x1="160" y1="275" x2="183" y2="275" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
            str += `<text x="125" y="283" font-size="20">×5</text>`
            str += `<rect x="110" y="265" width="14" height="20" rx="2" fill="#ddd" stroke="#333" stroke-width="1.5"></rect>`
            $('.texas-btns-down').html(getButton('default', `②`, `tutor(1)`, 0, 0, 0, 0, 'arrow-right'))
            break
        case 1:
            $('.tutor').html('<h3>② 下注 Ⅰ</h3><p>前两位玩家强制下注，称为盲注。<span style="color:#337ab7">小盲</span>是大盲的一半。</p>')
            str += `<line class="line-0" x1="250" y1="399" x2="250" y2="340" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"></line>`
                + `<line class="line-0-blue" x1="250" y1="399" x2="250" y2="340" stroke="#337ab7" stroke-width="1.5" marker-end="url(#arrow-blue)" style="display:none"></line>`
                + `<text class="in-t" x="260" y="370" transform="rotate(0,250,250) rotate(90,260,370)" text-anchor="middle" fill="#337ab7"></text>`
                + `<text x="250" y="440" text-anchor="middle">${sso.realname}</text>`
                + `<circle cx="${sso.realname.length * 8 + 258}" cy="434" r="5" class="blink"></circle>`
                + `<text x="250" y="420" text-anchor="middle" fill="#999">◉1000</text>`
            str += `<path d="M 280 414 Q 316,404 283,374" fill="transparent" stroke="white" stroke-width="4.5"/>`
            str += `<path d="M 280 414 Q 316,404 283,374" fill="transparent" stroke="#337ab7" stroke-width="1.5" marker-end="url(#arrow-blue)"/>`
            $('.texas-btns-down').html(`${getButton('primary', `小盲 5`, `tutor(2)`, 'arrow-up', `$('.line-0').hide();$('.line-0-blue').show();$('.in-t').attr('fill', '#337ab7').text('◉5')`, `$('.line-0').show();$('.line-0-blue').hide();$('.in-t').text('')`)}`)
            break
        case 2:
            $('.tutor').html('<h3>② 下注 Ⅰ</h3><p>前两位玩家强制下注，称为盲注。大盲是小盲的两倍。</p>')
            cur.now = 1
            cur.in[0] = 5
            cur.cash[0] = 995
            str += `<path d="M 280 414 Q 316,404 283,374" fill="transparent" stroke="white" transform="rotate(120,250,250)" stroke-width="4.5"/>`
            str += `<path d="M 280 414 Q 316,404 283,374" fill="transparent" stroke="#333" transform="rotate(120,250,250)" stroke-width="1.5" marker-end="url(#arrow)"/>`
            $('.texas-svg').css('opacity', '1')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `①`, `tutor(0)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(3)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 3:
            $('.tutor').html('<h3>② 下注 Ⅰ</h3><p>此后可以选择<span style="color:#d9534f">放弃</span>、跟注或<span style="color:#337ab7">加注</span>。</p>')
            cur.now = 2
            cur.in[0] = 5
            cur.cash[0] = 995
            cur.in[1] = 10
            cur.cash[1] = 990
            str += `<path d="M 280 414 Q 316,404 283,374" fill="transparent" stroke="white" transform="rotate(240,250,250)" stroke-width="4.5"/>`
            str += `<path d="M 280 414 Q 316,404 283,374" fill="transparent" stroke="#333" transform="rotate(240,250,250)" stroke-width="1.5" marker-end="url(#arrow)"/>`
            $('.texas-svg').css('opacity', '1')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(2)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(4)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 4:
            $('.tutor').html('<h3>② 下注 Ⅰ</h3><p>此后可以选择<span style="color:#d9534f">放弃</span>、跟注或<span style="color:#337ab7">加注</span>。<br>——要么放弃，要么下注金额不少于当前的最大值。</p>')
            cur.now = 0
            cur.in = { 0: 5, 1: 10, 2: 50 }
            cur.cash = { 0: 995, 1: 990, 2: 950 }
            str += `<text class="in-2" x="260" y="370" transform="rotate(240,250,250) rotate(90,260,370)" text-anchor="middle" fill="#333">◉50</text>`
                + `<path d="M 344 196 Q 390,314 283,360" fill="transparent" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)" marker-start="url(#arrow)"/>`
                + `<text x="340" y="294" text-anchor="middle" fill="#333" transform="rotate(-50,340,294)">≥<text/>`
            $('.texas-svg').css('opacity', '1')
            $('.texas-btns-down').html(`<div class="btn-group" onmouseleave="drawTable()">${getButton('danger', `放弃`, `$(this).css('color','transparent')`, 'remove', `procHover(['nope'],'0')`)}`
                + `${getButton('default', `跟注 ${prec(50)}<span style="position:absolute;display:inline-block;margin-top:-30px;margin-left:-60px">下一步</span>`, `tutor(5)`, 'arrow-right', `procHover(['follow','50'],'0')`)}`
                + `${getTutorAddButtons(50, 5)}</div>`)
            break
        case 5:
            $('.tutor').html('<h3>② 下注 Ⅰ</h3><p>此后可以选择<span style="color:#d9534f">放弃</span>、跟注或<span style="color:#337ab7">加注</span>。<br>——要么放弃，要么下注金额不少于当前的最大值。</p>')
            cur.now = 1
            cur.in = { 0: 50, 1: 10, 2: 50 }
            cur.cash = { 0: 950, 1: 990, 2: 950 }
            str += `<text class="in-2" x="260" y="370" transform="rotate(0,250,250) rotate(90,260,370)" text-anchor="middle" fill="#333">◉50</text>`
                + `<path d="M 344 196 Q 390,314 283,360" fill="transparent" transform="rotate(120,250,250)" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)" marker-start="url(#arrow)"/>`
                + `<text x="340" y="294" text-anchor="middle" fill="#333" transform="rotate(120,250,250) rotate(-50,340,294)">≥<text/>`
            $('.texas-svg').css('opacity', '1')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(3)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(6)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 6:
            $('.tutor').html('<h3>② 下注 Ⅰ</h3><p><span style="color:#d9534f">放弃</span>后，本局不能再参与下注，也不能拿回筹码。</p>')
            cur.now = -1
            cur.givenup[1] = 1
            cur.in = { 0: 50, 1: 10, 2: 50 }
            cur.cash = { 0: 950, 1: 990, 2: 950 }
            $('.texas-svg').css('opacity', '1')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(5)`, 'arrow-left')}${getButton('default', `③`, `tutor(7)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 7:
            $('.tutor').html('<h3>③ 翻牌 Ⅰ</h3><p>所有玩家下注相同时，可以翻牌。</p>')
            cur.st = 2
            cur.now = -1
            cur.givenup[1] = 1
            cur.in = { 0: 50, 1: 10, 2: 50 }
            cur.cash = { 0: 950, 1: 990, 2: 950 }
            str += `<text class="in-2" x="260" y="370" transform="rotate(0,250,250) rotate(90,260,370)" text-anchor="middle" fill="#333">◉50</text>`
                + `<text class="in-2" x="260" y="370" transform="rotate(240,250,250) rotate(90,260,370)" text-anchor="middle" fill="#333">◉50</text>`
                + drawCard(202.5, 275, cur.cards.n[0], 0)
                + drawCard(242.5, 275, cur.cards.n[1], 0)
                + drawCard(282.5, 275, cur.cards.n[2], 0)
            // str += `<line x1="160" y1="275" x2="183" y2="275" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
            str += `<text x="145" y="283" font-size="20">×3</text>`
            str += `<rect x="130" y="265" width="14" height="20" rx="2" fill="#ddd" stroke="#333" stroke-width="1.5"></rect>`
                + `<path d="M 129 280 Q 98,275 131,274.2" fill="transparent" stroke="white" stroke-width="3"></path>`
                + `<path d="M 130 280 Q 95,275 138,274" fill="transparent" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"></path>`
            $('.texas-svg').css('opacity', '0.3')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `②`, `tutor(6)`, 'arrow-left')}${getButton('default', `④`, `tutor(8)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 8:
            $('.tutor').html('<h3>④ 下注 Ⅱ</h3><p>翻牌后，可以继续加注。</p>')
            cur.st = 2
            cur.now = 2
            cur.givenup[1] = 1
            cur.in = { 0: 50, 1: 10, 2: 50 }
            cur.cash = { 0: 950, 1: 990, 2: 950 }
            $('.texas-svg').css('opacity', '1')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `③`, `tutor(7)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(9)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 9:
            $('.tutor').html('<h3>④ 下注 Ⅱ</h3><p>翻牌后，可以继续加注。</p>')
            cur.st = 2
            cur.now = 0
            cur.givenup[1] = 1
            cur.in = { 0: 50, 1: 10, 2: 100 }
            cur.cash = { 0: 950, 1: 990, 2: 900 }
            $('.texas-svg').css('opacity', '1')
            $('.texas-btns-down').html(`<div class="btn-group" onmouseleave="drawTable()">${getButton('danger', `放弃`, `$(this).css('color','transparent')`, 'remove', `procHover(['nope'],'0')`)}`
                + `${getButton('default', `跟注 ${prec(100)}<span style="position:absolute;display:inline-block;margin-top:-30px;margin-left:-60px">下一步</span>`, `tutor(10)`, 'arrow-right', `procHover(['follow','100'],'0')`)}`
                + `${getTutorAddButtons(100, 50)}</div>`)
            break
        case 10:
            $('.tutor').html('<h3>⑤ 翻牌 Ⅱ</h3>')
            cur.st = 3
            cur.now = -1
            cur.givenup[1] = 1
            str += `<text class="in-2" x="260" y="370" transform="rotate(0,250,250) rotate(90,260,370)" text-anchor="middle" fill="#333">◉100</text>`
                + `<text class="in-2" x="260" y="370" transform="rotate(240,250,250) rotate(90,260,370)" text-anchor="middle" fill="#333">◉100</text>`
            str += drawCard(222.5, 220, cur.cards.n[3], 0, 0)
            // str += `<line x1="160" y1="275" x2="183" y2="275" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
            str += `<rect x="190" y="210" width="14" height="20" rx="2" fill="#ddd" stroke="#333" stroke-width="1.5"></rect>`
                + `<path d="M 189 225 Q 168,220 191,219.3" fill="transparent" stroke="white" stroke-width="3"></path>`
                + `<path d="M 190 225 Q 165,220 198,219" fill="transparent" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"></path>`
            $('.texas-svg').css('opacity', '0.3')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `④`, `tutor(8)`, 'arrow-left')}${getButton('default', `⑥`, `tutor(11)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 11:
            $('.tutor').html('<h3>⑥ 下注 Ⅲ</h3>')
            cur.st = 3
            cur.now = 0
            cur.givenup[1] = 1
            $('.texas-svg').css('opacity', '1')
            $('.texas-btns-down').html(`<div class="btn-group" onmouseleave="drawTable()">`
                + `${getButton('default', `过<span style="position:absolute;display:inline-block;margin-top:-30px;margin-left:-43px">下一步</span>`, `tutor(12)`, 'arrow-right', `procHover(['follow','100'],'0')`)}`
                + `${getTutorAddButtons(100, 100)}</div>`)
            break
        case 12:
            $('.tutor').html('<h3>⑥ 下注 Ⅲ</h3>')
            cur.st = 3
            cur.now = 2
            cur.givenup[1] = 1
            $('.texas-svg').css('opacity', '1')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `⑤`, `tutor(10)`, 'arrow-left')}${getButton('default', `⑦`, `tutor(13)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 13:
            $('.tutor').html('<h3>⑦ 翻牌 Ⅲ</h3>')
            cur.st = 4
            cur.now = -1
            cur.givenup[1] = 1
            str += `<text class="in-2" x="260" y="370" transform="rotate(0,250,250) rotate(90,260,370)" text-anchor="middle" fill="#333">◉100</text>`
                + `<text class="in-2" x="260" y="370" transform="rotate(240,250,250) rotate(90,260,370)" text-anchor="middle" fill="#333">◉100</text>`
            str += drawCard(262.5, 220, cur.cards.n[4], 0, 0)
            // str += `<line x1="160" y1="275" x2="183" y2="275" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>`
            str += `<rect x="305" y="210" width="14" height="20" rx="2" fill="#ddd" stroke="#333" stroke-width="1.5"></rect>`
                + `<path d="M 304 225 Q 283,220 306,219.4" fill="transparent" stroke="white" stroke-width="3"></path>`
                + `<path d="M 305 225 Q 280,220 313,219" fill="transparent" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"></path>`
            $('.texas-svg').css('opacity', '0.3')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `⑥`, `tutor(12)`, 'arrow-left')}${getButton('default', `⑧`, `tutor(14)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 14:
            $('.tutor').html('<h3>⑧ 下注 Ⅳ</h3>')
            cur.st = 4
            cur.now = 2
            cur.givenup[1] = 1
            $('.texas-svg').css('opacity', '1')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `⑦`, `tutor(13)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(15)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 15:
            $('.tutor').html('<h3>⑧ 下注 Ⅳ</h3>')
            cur.st = 4
            cur.now = 0
            cur.givenup[1] = 1
            $('.texas-svg').css('opacity', '1')
            $('.texas-btns-down').html(`<div class="btn-group" onmouseleave="drawTable()">`
                + `${getButton('default', `过<span style="position:absolute;display:inline-block;margin-top:-30px;margin-left:-43px">下一步</span>`, `tutor(16)`, 'arrow-right', `procHover(['follow','100'],'0')`)}`
                + `${getTutorAddButtons(100, 100)}</div>`)
            break
        case 16:
            $('.tutor').html('<h3>⑨ 七选五</h3><p>下注结束，每人从手里和桌上的七张里选五张，然后比大小。</p>')
            cur.st = 5
            cur.now = 0
            cur.givenup[1] = 1
            cur.winner = { 0: 1, 1: 0, 2: 0 }
            cur.won = { 0: 110 }
            // cur.type = { 0: [3, 7, 12], 1: [6, 7, 12], 2: [2, 12, 7, 11] }
            cur.type = { 0: [10, 7, 12], 1: [10, 7, 12], 2: [10, 12, 7, 11] }
            str += `<circle cx="250" cy="250" r="150" stroke="#333" stroke-width="1.5" fill="white"></circle>`
                + drawCard(202.5, 245, cur.cards.n[0], 0)
                + drawCard(242.5, 245, cur.cards.n[1], 0)
                + drawCard(282.5, 245, cur.cards.n[2], 0)
                + drawCard(222.5, 190, cur.cards.n[3], 0)
                + drawCard(262.5, 190, cur.cards.n[4], 0)
                + drawCard(262.5, 315, cur.cards.p[0][0])
                + drawCard(222.5, 315, cur.cards.p[0][1])
                + `<rect x="210" y="444" transform="rotate(0,250,250)" width="100" height="60" rx="5" fill="white" stroke="white" stroke-width="1.5"></rect>`
            str += `<path d="M 300 454 Q 350,434 295,348" fill="transparent" stroke="white" transform="rotate(0,250,250)" stroke-width="4.5"/>`
            str += `<path d="M 300 454 Q 350,434 295,348" fill="transparent" stroke="#333" transform="rotate(0,250,250)" stroke-width="1.5" marker-end="url(#arrow)"/>`
            $('.texas-svg').css('opacity', '0.3')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `⑧`, `tutor(14)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(17)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 17:
            $('.tutor').html('<h3>⑨ 七选五</h3><p>下注结束，每人从手里和桌上的七张里选五张，然后比大小。<br>三条是三张数字相同的牌。</p>')
            cur.st = 5
            cur.now = 0
            cur.givenup[1] = 1
            cur.winner = { 0: 1, 1: 0, 2: 0 }
            cur.won = { 0: 110 }
            // cur.type = { 0: [3, 7, 12], 1: [6, 7, 12], 2: [2, 12, 7, 11] }
            cur.type = { 0: [3, 7, 12], 1: [10, 7, 12], 2: [10, 12, 7, 11] }
            str += `<circle cx="250" cy="250" r="150" stroke="#333" stroke-width="1.5" fill="white"></circle>`
                + drawCard(202.5, 245, cur.cards.n[0], 0, 1)
                + drawCard(242.5, 245, cur.cards.n[1], 0)
                + drawCard(282.5, 245, cur.cards.n[2], 0)
                + drawCard(222.5, 190, cur.cards.n[3], 0)
                + drawCard(262.5, 190, cur.cards.n[4], 0)
                + drawCard(262.5, 315, cur.cards.p[0][0], 0, 1)
                + drawCard(222.5, 315, cur.cards.p[0][1], 0)
                + `<rect x="210" y="444" transform="rotate(0,250,250)" width="100" height="60" rx="5" fill="white" stroke="white" stroke-width="1.5"></rect>`
                + `<text x="230" y="370" transform="rotate(0,250,250) rotate(90,230,370)" text-anchor="middle" fill="#333">三条</text>`
                + `<line x1="250" y1="395" x2="250" y2="345" stroke="#333" stroke-width="1.5" transform="rotate(0,250,250)" marker-start="url(#arrow)"></line>`
            $('.texas-svg').css('opacity', '0.3')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(16)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(18)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 18:
            $('.tutor').html(`<h3>⑨ 七选五</h3><p>下注结束，每人从手里和桌上的七张里选五张，然后比大小。<br>葫芦是三带二。${cur.name[1]}此前已放弃，不能参与比大小。</p>`)
            cur.st = 5
            cur.now = 0
            cur.givenup[1] = 1
            cur.winner = { 0: 1, 1: 0, 2: 0 }
            cur.won = { 0: 110 }
            // cur.type = { 0: [3, 7, 12], 1: [6, 7, 12], 2: [2, 12, 7, 11] }
            cur.type = { 0: [3, 7, 12], 1: [6, 7, 12], 2: [10, 12, 7, 11] }
            str += `<circle cx="250" cy="250" r="150" stroke="#333" stroke-width="1.5" fill="white"></circle>`
                + drawCard(202.5, 275, cur.cards.n[0], 0, 1)
                + drawCard(242.5, 275, cur.cards.n[1], 0)
                + drawCard(282.5, 275, cur.cards.n[2], 0, 1)
                + drawCard(222.5, 220, cur.cards.n[3], 0)
                + drawCard(262.5, 220, cur.cards.n[4], 0)
                + drawCard(262.5, 470, cur.cards.p[1][1], 120)
                + drawCard(222.5, 470, cur.cards.p[1][0], 120)
                + `<text x="230" y="370" transform="rotate(0,250,250) rotate(90,230,370)" text-anchor="middle" fill="#ddd">三条</text>`
                + `<line x1="250" y1="395" x2="250" y2="345" stroke="#ddd" stroke-width="1.5" transform="rotate(0,250,250)" marker-start="url(#arrow-grey)"></line>`
                + `<text x="230" y="370" transform="rotate(120,250,250) rotate(90,230,370)" text-anchor="middle" fill="red">葫芦</text>`
                + `<line x1="250" y1="399" x2="250" y2="340" stroke="red" stroke-width="1.5" transform="rotate(120,250,250)" marker-end="url(#gaveup)"></line>`
            $('.texas-svg').css('opacity', '0.3')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(17)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(19)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 19:
            $('.tutor').html('<h3>⑨ 七选五</h3><p>下注结束，每人从手里和桌上的七张里选五张，然后比大小。<br>两对是两对数字相同的牌。</p>')
            cur.st = 5
            cur.now = 0
            cur.givenup[1] = 1
            cur.winner = { 0: 1, 1: 0, 2: 0 }
            cur.won = { 0: 110 }
            // cur.type = { 0: [3, 7, 12], 1: [6, 7, 12], 2: [2, 12, 7, 11] }
            cur.type = { 0: [3, 7, 12], 1: [6, 7, 12], 2: [2, 12, 7, 11] }
            str += `<circle cx="250" cy="250" r="150" stroke="#333" stroke-width="1.5" fill="white"></circle>`
                + drawCard(202.5, 275, cur.cards.n[0], 0)
                + drawCard(242.5, 275, cur.cards.n[1], 0, 1)
                + drawCard(282.5, 275, cur.cards.n[2], 0)
                + drawCard(222.5, 220, cur.cards.n[3], 0, 1)
                + drawCard(262.5, 220, cur.cards.n[4], 0)
                + drawCard(262.5, 470, cur.cards.p[2][1], 240)
                + drawCard(222.5, 470, cur.cards.p[2][0], 240)
                + `<text x="230" y="370" transform="rotate(0,250,250) rotate(90,230,370)" text-anchor="middle" fill="#ddd">三条</text>`
                + `<line x1="250" y1="395" x2="250" y2="345" stroke="#ddd" stroke-width="1.5" transform="rotate(0,250,250)" marker-start="url(#arrow-grey)"></line>`
                + `<text x="230" y="370" transform="rotate(120,250,250) rotate(90,230,370)" text-anchor="middle" fill="#ddd">葫芦</text>`
                + `<line x1="250" y1="395" x2="250" y2="345" stroke="#ddd" stroke-width="1.5" transform="rotate(120,250,250)" marker-start="url(#arrow-grey)"></line>`
                + `<text x="230" y="370" transform="rotate(240,250,250) rotate(90,230,370)" text-anchor="middle" fill="#333">两对</text>`
                + `<line x1="250" y1="395" x2="250" y2="345" stroke="#333" stroke-width="1.5" transform="rotate(240,250,250)" marker-start="url(#arrow)"></line>`
            $('.texas-svg').css('opacity', '0.3')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(18)`, 'arrow-left')}${getButton('default', `下一步`, `tutor(20)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 20:
            $('.tutor').html('<h3>⑨ 七选五</h3><p>下注结束，每人从手里和桌上的七张里选五张，然后比大小。<br>未放弃的玩家中，你的三条是最大的。你赢得桌上全部筹码，本局结束。</p>')
            cur.st = 5
            cur.now = 0
            cur.givenup[1] = 1
            cur.winner = { 0: 1, 1: 0, 2: 0 }
            cur.won = { 0: 110 }
            // cur.type = { 0: [3, 7, 12], 1: [6, 7, 12], 2: [2, 12, 7, 11] }
            cur.type = { 0: [3, 7, 12], 1: [6, 7, 12], 2: [2, 12, 7, 11] }
            $('.texas-svg').css('opacity', '1')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `上一步`, `tutor(19)`, 'arrow-left')}${getButton('default', `牌型`, `tutor(21)`, 0, 0, 0, 0, 'arrow-right')}</div>`)
            break
        case 21:
            $('.tutor').html('<h3>牌型</h3><p>先比牌型大小。牌型相同，再比数字大小。</p>')
            str2 += drawFiveCards(12, 50, ['TS2', 'TC7', 'TH4', 'DK', 'TH3'], '① 高牌')
            str2 += drawFiveCards(12, 140, ['S2', 'C2', 'TH4', 'TDK', 'TH3'], '② 一对')
            str2 += drawFiveCards(12, 230, ['S7', 'C7', 'H4', 'D4', 'TH3'], '③ 两对')
            str2 += drawFiveCards(12, 320, ['S7', 'C7', 'H7', 'TD4', 'TH3'], '④ 三条')
            str2 += drawFiveCards(12, 410, ['S3', 'C4', 'H5', 'D6', 'H7'], '⑤ 顺子')
            str2 += drawFiveCards(312, 50, ['D7', 'D4', 'D3', 'DK', 'D5'], '⑥ 同花')
            str2 += drawFiveCards(312, 140, ['S7', 'C7', 'H7', 'D4', 'H4'], '⑦ 葫芦')
            str2 += drawFiveCards(312, 230, ['S7', 'C7', 'H7', 'D7', 'TH4'], '⑧ 四条')
            str2 += drawFiveCards(312, 320, ['H2', 'H3', 'H4', 'H5', 'H6'], '⑨ 同花顺')
            str2 += drawFiveCards(312, 410, ['SX', 'SJ', 'SQ', 'SK', 'SA'], '⑩ 皇家同花顺')
            $('.texas-btns-down').html(`<div class="btn-group">${getButton('default', `⑨`, `tutor(20)`, 'arrow-left')}${getButton('danger', `离开`, `endTutor()`, 'log-out')}</div>`)
            break
    }
    $('.tutor-svg').html(str)
    $('.tutor-svg-2').html(str2)
    tt = cur.st
    if (step <= 20) drawTable(), $('.texas-svg').show()
    else ($('.texas-svg').hide())
}
function drawTransparentCard(x, y, card, rot = 0, flipped = 1) {
    let col = card[1], num = card[2]
    if (num == 'X') num = '10'
    let colMap = { 'C': 'club', 'D': 'diamond', 'H': 'heart', 'S': 'spade' }
    let colColMap = { 'C': '#333', 'D': 'red', 'H': 'red', 'S': '#333' }
    let str = ''
    str = `<rect x="${x - 10}" y="${y - 25}" transform="rotate(${rot},250,250)" width="35" height="50" rx="5" fill="transparent" stroke="#333" stroke-width="1.5" ${flipped ? 'opacity="0.3"' : ''}></rect>
        <use x="${x - 4}" y="${y - 8}" transform="rotate(${rot},250,250)" href="#${colMap[col]}" ${flipped ? 'opacity="0.3"' : ''}/>
        <text x="${x - 7}" y="${y - 8}" transform="rotate(${rot},250,250)" font-size="16" fill="${colColMap[col]}" ${flipped ? 'opacity="0.3"' : ''}>${num}</text>`
    return str
}
function drawFiveCards(x, y, card, text) {
    let str = ''
    for (let i = 0; i < 5; i++) {
        if (card[i][0] == 'T') str += drawTransparentCard(x + 40 * i, y, card[i], 0)
        else str += drawCard(x + 40 * i, y, card[i], 0)
    }
    str += `<text x="${x - 10}" y="${y - 33}">${text}</text>`
    return str
}
function getTutorAddButtons(up, me, max) {
    if (!me) me = 0
    up = parseInt(up)
    let str = getButton('primary', `加注 ${up + 5}`, `procHover(['up','${up + 5}'],'0')`, 'arrow-up', `procHover(['up','${up + 5}'],'0')`)
    if (up + 5 - me >= cur.cash[cur.you]) str = ''
    let arr = [10, 15, 20, 30, 50, 70, 90, 190, 490]
    for (let i = 0; i < arr.length; i++) {
        if (up + arr[i] - me >= cur.cash[cur.you]) {
            str += getButton('primary', `全押`, `procHover(['up','${cur.cash[cur.you] + me}'],'0')`, 'fire', `procHover(['up','${cur.cash[cur.you] + me}'],'0')`)
            break
        }
        str += getButton('primary btn-up', up + arr[i], `procHover(['up','${up + arr[i]}'],'0')`, 0, `procHover(['up','${up + arr[i]}'],'0')`)
    }
    return str
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
    tutor(0)
}
function endTutor() {
    if (window.TutorialShell) window.TutorialShell.close()
    else {
        $('.list-all').show()
        $('.chat').hide()
        $('.decor').show()
        $('.tutor').hide()
    }
    $('.texas-svg').html('').css('opacity', '1')
    $('.tutor-svg').hide('')
    $('.tutor-svg-2').html('')
    $('.texas-btns').html('')
    $('.texas-btns-down').html('')
}