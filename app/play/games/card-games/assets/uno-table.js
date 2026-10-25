/* global $, CardGameCopy, getButton, CardGameActions, procHover */
const AI_ONLY_MODE = true
            $(() => {
                initAIMode()
            })
            var cur = { num: 0, plist: [], cards: {} }, me = { cards: {}, card: '' }, tt = 0
            // 0 准备 1 打牌 2 选色 3 结算
            // spade diamond club heart
            function validCard(cen, a) {
                if (!cen) return true
                if (a[0] == '!') return true
                if (!cur.ban && (a[0] == cen[0] || a[0] == cen[2])) return true
                if (cen[1] == '+') {
                    if (cen[0] == a[0]) return true
                    if (cen[0] != '!' && a[1] == '+') return true
                    return false
                }
                if (a[1] == cen[1]) return true
                return false
            }
            function selectCard(cl) {
                if (cur.now == cur.you && (!cur.ban || (cur.ban == '+' && me.cards[cl][1] == '+' && validCard(cur.cen, me.cards[cl])))) {
                    me.card = me.cards[cl]
                    $(`.${cl}`).siblings().removeSvgClass('selected').css('translate', '')
                    $(`.card-text`).hide()
                    $(`.${cl}`).addSvgClass('selected').css('translate', '0 -8px')
                    $(`.${cl}-text`).show()
                    if (validCard(cur.cen, me.card)) $(`.btn-up`).removeClass('disabled')
                    else $(`.btn-up`).addClass('disabled')
                }
            }
            function drawCard(x, y, card, rot = 0, flipped = 0, cl = 0) {
                let col = card[0], num = card[1]
                let colColMap = { 'R': '#ed1c25', 'G': '#01a24f', 'B': '#0095da', 'Y': '#fede02' }
                if (num == '+') num = col != '!' ? '+2' : '+4'
                let str = ''
                if (flipped == 2) str = `<rect class="cards-rect" x="${x - 10}" y="${y - 25}" transform="rotate(${rot},250,250)" width="35" height="50" rx="5" fill="#ddd" stroke="#333" stroke-width="1.5"></rect>`
                    + `<text class="nomouse cards-arrow" x="${x + 7}" y="${y + 20}" text-anchor="middle" font-size="14">↓</text>`
                    + `<text class="nomouse cards-left" x="${x + 7}" y="${y - 7}" text-anchor="middle" font-size="12"></text>`
                    + `<text class="nomouse cards-text" x="${x + 7}" y="${y - 30}" text-anchor="middle" font-size="12" fill="#333"></text>`
                else if (flipped) str = `<rect x="${x - 10}" y="${y - 25}" transform="rotate(${rot},250,250)" width="35" height="50" rx="5" fill="#ddd" stroke="#333" stroke-width="1.5"></rect>`
                else {
                    if (cl && String(cl).match('card-old')) {
                        str = `<rect class="card ${cl}" x="${x - 10}" y="${y - 25}" transform="rotate(${rot},250,250)" width="35" height="50" rx="5" fill="${colColMap[col]}" stroke-width="1.5" stroke="white"></rect>`
                    } else {
                        str = `<rect ${cl ? `class="card card-hit ${cl}" data-card-slot="${cl}"` : ''} x="${x - 10}" y="${y - 25}" transform="rotate(${rot},250,250)" width="35" height="50" rx="5" fill="${colColMap[col]}" stroke-width="1.5" stroke="white"></rect>`
                    }
                    if (cl) cl = 'nomouse ' + cl
                    if (col == '!' && card[2]) {
                        str += `<circle cx="${x + 6}" cy="${y + 40}" r="8" fill="${colColMap[card[2]]}" stroke="#333" stroke-width="1.5"></circle>`
                    }
                    if (num == '+2') str +=
                        `<text ${cl ? `class="card-text ${cl}-text"` : ''} x="${x}" y="${y + 35}" transform="rotate(${rot},250,250)" font-size="12" fill="#333" style="display:none">+2</text>`
                        + `<rect ${cl ? `class="${cl}"` : ''} x="${x + 4.5}" y="${y - 5.5}" transform="rotate(${rot},250,250)" width="15" height="21" rx="3" fill="#0009"></rect>`
                        + `<rect ${cl ? `class="${cl}"` : ''} x="${x + 3}" y="${y - 7}" transform="rotate(${rot},250,250)" width="14" height="20" rx="2" fill="white"></rect>`
                        + `<rect ${cl ? `class="${cl}"` : ''} x="${x - 1.5}" y="${y - 13.5}" transform="rotate(${rot},250,250)" width="15" height="21" rx="3" fill="#0009"></rect>`
                        + `<rect ${cl ? `class="${cl}"` : ''} x="${x - 3}" y="${y - 15}" transform="rotate(${rot},250,250)" width="14" height="20" rx="2" fill="white"></rect>`
                    else if (num == '-') str +=
                        `<text ${cl ? `class="card-text ${cl}-text"` : ''} x="${x - 5}" y="${y + 35}" transform="rotate(${rot},250,250)" font-size="12" fill="#333" style="display:none">禁止</text>`
                        + `<use ${cl ? `class="${cl}"` : ''} x="${x - 3}" y="${y - 10}" transform="rotate(${rot},250,250)" href="#ban-shadow" />`
                        + `<use ${cl ? `class="${cl}"` : ''} x="${x - 5}" y="${y - 12}" transform="rotate(${rot},250,250)" href="#ban" />`
                    else if (num == 'R') {
                        str +=
                            `<text ${cl ? `class="card-text ${cl}-text"` : ''} x="${x - 5}" y="${y + 35}" transform="rotate(${rot},250,250)" font-size="12" fill="#333" style="display:none">反转</text>`
                        if ((!cl) ^ cur.rot == 1) str += `<use ${cl ? `class="${cl}"` : ''} x="${x - 5}" y="${y - 12}" transform="translate(-${(x - 5) * 0.4},-${(y - 12) * 0.4}) scale(1.4) rotate(${rot},250,250)" href="#cycle-shadow" />`
                            + `<use ${cl ? `class="${cl}"` : ''} x="${x - 7}" y="${y - 14}" transform=" translate(-${(x - 7) * 0.4},-${(y - 14) * 0.4}) scale(1.4) rotate(${rot},250,250)" href="#cycle" />`
                        else str += `<use ${cl ? `class="${cl}"` : ''} x="${x - 5}" y="${y - 12}" transform="translate(${(x - 5) * 2.4 + 28},${(12 - y) * 0.4}) scale(-1.4,1.4) rotate(${rot},250,250)" href="#cycle-shadow" />`
                            + `<use ${cl ? `class="${cl}"` : ''} x="${x - 7}" y="${y - 14}" transform=" translate(${(x - 7) * 2.4 + 28},${(14 - y) * 0.4}) scale(-1.4,1.4) rotate(${rot},250,250)" href="#cycle" />`
                    } else if (num == '!') str +=
                        `<text ${cl ? `class="card-text ${cl}-text"` : ''} x="${x - 5}" y="${y + 35}" transform="rotate(${rot},250,250)" font-size="12" fill="#333" style="display:none">调色</text>`
                        + `<use ${cl ? `class="${cl}"` : ''} x="${x + 8}" y="${y - 15}" transform="rotate(${rot},250,250)" href="#b-frag" />`
                        + `<use ${cl ? `class="${cl}"` : ''} x="${x + 8}" y="${y}" transform="rotate(${rot},250,250)" href="#g-frag" />`
                        + `<use ${cl ? `class="${cl}"` : ''} x="${x - 7}" y="${y}" transform="rotate(${rot},250,250)" href="#y-frag" />`
                        + `<use ${cl ? `class="${cl}"` : ''} x="${x - 7}" y="${y - 15}" transform="rotate(${rot},250,250)" href="#r-frag" />`
                    else if (num == '+4') str +=
                        `<text ${cl ? `class="card-text ${cl}-text"` : ''} x="${x}" y="${y + 35}" transform="rotate(${rot},250,250)" font-size="12" fill="#333" style="display:none">+4</text>`
                        + `<rect ${cl ? `class="${cl}"` : ''} x="${x}" y="${y - 2}" transform="rotate(${rot},250,250)" width="14" height="20" rx="2" fill="#fede02" stroke="black" stroke-width="1.5"></rect>`
                        + `<rect ${cl ? `class="${cl}"` : ''} x="${x + 6}" y="${y - 8}" transform="rotate(${rot},250,250)" width="14" height="20" rx="2" fill="#01a24f" stroke="black" stroke-width="1.5"></rect>`
                        + `<rect ${cl ? `class="${cl}"` : ''} x="${x + 2}" y="${y - 18}" transform="rotate(${rot},250,250)" width="14" height="20" rx="2" fill="#0095da" stroke="black" stroke-width="1.5"></rect>`
                        + `<rect ${cl ? `class="${cl}"` : ''} x="${x - 6}" y="${y - 13}" transform="rotate(${rot},250,250)" width="14" height="20" rx="2" fill="#ed1c25" stroke="black" stroke-width="1.5"></rect>`
                    else if (parseInt(num) == num) str += `<text ${cl ? `class="${cl}"` : ''} x="${x + 1}" y="${y + 12}" transform="rotate(${rot},250,250)" font-size="28" font-weight="500" fill="#0009">${num}</text><text ${cl ? `class="${cl}"` : ''} x="${x - 1}" y="${y + 10}" transform="rotate(${rot},250,250)" font-size="28" font-weight="500" fill="white">${num}</text>`
                }
                return str
            }
            function prec(num) {
                num = parseFloat(num)
                return parseInt(num) == num ? num : num.toFixed(1)
            }
            function drawCards() {
                let str = '', cards = cur.cards, plist = cur.plist, nnum = cur.num, num = cur.plist.length
                if (tt) {
                    let offset = 0, sumIn = 0, winCnt = 0, winningType = 0
                    for (let i = 0; i < num; i++) {
                        if (!cur.winner || !cur.type[plist[i]]) break
                        if (!cur.winner[plist[i]]) sumIn += cur.in[plist[i]]
                        else winCnt++
                        winningType = cur.type[plist[i]][0]
                    }
                    for (let i = 0; i < num; i++) {
                        offset = i
                        if (plist[i] == cur.you) break
                    }
                    str += drawCard(222.5, 250, 'C1', 0, 2)
                    str += drawCard(262.5, 250, cur.cen, cur.history[cur.history.length - 1][1], !cur.cen, cur.msg == 'no' ? 'card-danger' : 0)
                    for (let gi = 0; gi < num; gi++) {
                        let i = (gi + offset) % num
                        let k = cards[plist[i]]
                        for (let j = 0; j < k.length; j++) {
                            if (plist[i] != cur.you) {
                                str += drawCard(245 - 4 * k.length + 8 * j, 460, k[j], 360 * gi / num, 1)
                                if (j == k.length - 1) str += `<text x="${252.5 - 4 * k.length + 8 * j}" y="${469}" transform="rotate(${360 * gi / num},250,250)" text-anchor="middle" fill="#bbb" font-size="24">${cur.left[plist[i]]}</text>`
                            } else {
                                if (k.length < 12) str += drawCard(265 - 20 * k.length + 40 * j, 460, k[j], 0, 0, `card-${j}`)
                                else if (k.length < 17) str += drawCard(265 - 15 * k.length + 30 * j, 460, k[j], 0, 0, `card-${j}`)
                                else str += drawCard(265 - 10 * k.length + 20 * j, 460, k[j], 0, 0, `card-${j}`)
                                me.cards[`card-${j}`] = k[j]
                            }
                        }
                        if (cur.wasReady == plist[i]) str += `<text class="person-ready" x="250" y="420" transform="rotate(${360 * gi / num},250,250)" text-anchor="middle">${cur.name[plist[i]]}</text>`
                        str += `<text ${cur.wasReady == plist[i] ? 'class="person-unready" style="display:none"' : ''} x="250" y="420" transform="rotate(${360 * gi / num},250,250)" text-anchor="middle">${cur.name[plist[i]]}</text>`
                        if (cur.st < 3) str += `<circle cx="${cur.name[plist[i]].length * 8 + 258}" cy="414" r="5" ${plist[i] == cur.now ? 'class="blink"' : 'fill="transparent"'} transform="rotate(${360 * gi / num},250,250)"></circle>`
                        else str += `<circle cx="${cur.name[plist[i]].length * 8 + 258}" cy="414" r="5" fill="${cur.isReady[plist[i]] ? '#333' : '#ddd'}" transform="rotate(${360 * gi / num},250,250)"></circle>`
                        if (cur.won[plist[i]]) {
                            str += `<text x="230" y="340" transform="rotate(${360 * gi / num},250,250) rotate(90,230,370)" text-anchor="middle" fill="#999">#${cur.wonList.indexOf(plist[i]) + 1}</text>`
                            str += `<line x1="250" y1="399" x2="250" y2="340" stroke="#ddd" stroke-width="1.5" transform="rotate(${360 * gi / num},250,250)" marker-end="url(#arrow-grey)"/>`
                        } else {
                            str += `<line class="line-${plist[i]}" x1="250" y1="399" x2="250" y2="340" stroke="#${plist[i] == cur.now ? '333' : 'ddd'}" stroke-width="1.5" transform="rotate(${360 * gi / num},250,250)" marker-end="url(#arrow${plist[i] == cur.now ? '' : '-grey'})"/>`
                            str += `<line style="display:none" class="line-${plist[i]}-blue" x1="250" y1="399" x2="250" y2="340" stroke="#337ab7" stroke-width="1.5" transform="rotate(${360 * gi / num},250,250)" marker-end="url(#arrow-blue)"/>`
                            str += `<line style="display:none" class="line-${plist[i]}-red" x1="250" y1="399" x2="250" y2="340" stroke="#d9534f" stroke-width="1.5" transform="rotate(${360 * gi / num},250,250)" marker-end="url(#arrow-red)"/>`
                        }
                    }
                    if (cur.now == cur.you && tt == 2) {
                        str += `<g data-sel-wheel="1"><path class="sel sel-B" data-sel-preview="B" fill="#0095da" d="M 250 202 A 48 48 0 0 1 298 250 L 250 250 Z" stroke="#333" stroke-width="1.5"></path>` +
                            `<path class="sel sel-G" data-sel-preview="G" fill="#01a24f" d="M 298 250 A 48 48 0 0 1 250 298 L 250 250 Z" stroke="#333" stroke-width="1.5"></path>` +
                            `<path class="sel sel-Y" data-sel-preview="Y" fill="#fede02" d="M 250 298 A 48 48 0 0 1 202 250 L 250 250 Z" stroke="#333" stroke-width="1.5"></path>` +
                            `<path class="sel sel-R" data-sel-preview="R" fill="#ed1c25" d="M 202 250 A 48 48 0 0 1 250 202 L 250 250 Z" stroke="#333" stroke-width="1.5"></path>` +
                            `<path class="sel-h sel-h-B" data-sel-color="B" fill="#0095da" d="M 250 192 A 58 58 0 0 1 308 250 L 250 250 Z" stroke="#333" stroke-width="1.5"></path>` +
                            `<path class="sel-h sel-h-G" data-sel-color="G" fill="#01a24f" d="M 308 250 A 58 58 0 0 1 250 308 L 250 250 Z" stroke="#333" stroke-width="1.5"></path>` +
                            `<path class="sel-h sel-h-Y" data-sel-color="Y" fill="#fede02" d="M 250 308 A 58 58 0 0 1 192 250 L 250 250 Z" stroke="#333" stroke-width="1.5"></path>` +
                            `<path class="sel-h sel-h-R" data-sel-color="R" fill="#ed1c25" d="M 192 250 A 58 58 0 0 1 250 192 L 250 250 Z" stroke="#333" stroke-width="1.5"></path></g>`
                            + `<text x="250" y="325" text-anchor="middle" fill="#333">调色</text>`
                    }
                } else {
                    for (let i = 0; i < num; i++) {
                        offset = i
                        if (plist[i] == cur.you) break
                    }
                    for (let gi = 0; gi < num; gi++) {
                        let i = (gi + offset) % num
                        for (let j = 0; j < cur.initLeft; j++) {
                            str += drawCard(245 - 4 * cur.initLeft + 8 * j, 460, 'C1', 360 * gi / num, tt < 5)
                        }
                        if (cur.wasReady == plist[i]) str += `<text class="person-ready" x="250" y="420" transform="rotate(${360 * gi / num},250,250)" text-anchor="middle" font-weight="bold">${cur.name[plist[i]]}</text>`
                        str += `<text ${cur.wasReady == plist[i] ? 'class="person-unready" style="display:none"' : ''} x="250" y="420" fill="${cur.isOffline[plist[i]] ? '#bbb' : '#333'}" transform="rotate(${360 * gi / num},250,250)" text-anchor="middle">${cur.name[plist[i]]}</text>`
                        str += `<circle cx="${cur.name[plist[i]].length * 8 + 258}" cy="414" r="5" fill="${cur.isReady[plist[i]] ? '#333' : '#ddd'}" transform="rotate(${360 * gi / num},250,250)"></circle>`
                    }
                }
                return str
            }
            function drawPeople() {
                let str = '', isIngame = cur.isIngame, num = cur.plist.length
                if (tt) {
                    for (let i in isIngame) {
                        if (!isIngame[i]) str += `<text x="250" y="420" transform="rotate(${360 * i * 1.3 / num},250,250)" text-anchor="middle" fill="#bbb">${cur.name[i]}</text>`
                    }
                }
                return str
            }
            function getUnoCardSymbolDefs() {
                return `<path id="ban" fill="white" d="M20.46 11.992v-.059a8.24 8.24 0 0 0-1.376-4.571l.019.031l-11.757 11.74a8.26 8.26 0 0 0 4.606 1.388h.026h-.001h.029a8.2 8.2 0 0 0 3.321-.699l-.052.021c3.074-1.315 5.188-4.314 5.188-7.807v-.045v.002zM4.884 16.654L16.657 4.897a8.1 8.1 0 0 0-4.607-1.42h-.074h.004h-.064a8.26 8.26 0 0 0-4.231 1.159l.038-.021C5.179 6.125 3.5 8.859 3.5 11.984c0 1.736.518 3.352 1.408 4.7l-.02-.032zm19.066-4.662v.035c0 1.678-.35 3.273-.981 4.718l.03-.076c-1.842 4.36-6.082 7.363-11.024 7.363S2.793 21.028.981 16.747l-.029-.078C.351 15.29.001 13.684.001 11.995S.351 8.7.982 7.244l-.03.077C2.794 2.961 7.034-.042 11.976-.042s9.182 3.004 10.994 7.285l.029.078a11.6 11.6 0 0 1 .952 4.631v.041v-.002z"/>
                <path id="ban-shadow" fill="#0009" d="M20.46 11.992v-.059a8.24 8.24 0 0 0-1.376-4.571l.019.031l-11.757 11.74a8.26 8.26 0 0 0 4.606 1.388h.026h-.001h.029a8.2 8.2 0 0 0 3.321-.699l-.052.021c3.074-1.315 5.188-4.314 5.188-7.807v-.045v.002zM4.884 16.654L16.657 4.897a8.1 8.1 0 0 0-4.607-1.42h-.074h.004h-.064a8.26 8.26 0 0 0-4.231 1.159l.038-.021C5.179 6.125 3.5 8.859 3.5 11.984c0 1.736.518 3.352 1.408 4.7l-.02-.032zm19.066-4.662v.035c0 1.678-.35 3.273-.981 4.718l.03-.076c-1.842 4.36-6.082 7.363-11.024 7.363S2.793 21.028.981 16.747l-.029-.078C.351 15.29.001 13.684.001 11.995S.351 8.7.982 7.244l-.03.077C2.794 2.961 7.034-.042 11.976-.042s9.182 3.004 10.994 7.285l.029.078a11.6 11.6 0 0 1 .952 4.631v.041v-.002z"/>
                <path id="cycle" fill="white" d="M5.516 14.224c-2.262-2.432-2.222-6.244.128-8.611a6.07 6.07 0 0 1 3.414-1.736L8.989 1.8a8.1 8.1 0 0 0-4.797 2.351c-3.149 3.17-3.187 8.289-.123 11.531l-1.741 1.752l5.51.301l-.015-5.834zm6.647-11.959l.015 5.834l2.307-2.322c2.262 2.434 2.222 6.246-.128 8.611a6.07 6.07 0 0 1-3.414 1.736l.069 2.076a8.12 8.12 0 0 0 4.798-2.35c3.148-3.172 3.186-8.291.122-11.531l1.741-1.754z"/>
                <path id="cycle-shadow" fill="#0009" d="M5.516 14.224c-2.262-2.432-2.222-6.244.128-8.611a6.07 6.07 0 0 1 3.414-1.736L8.989 1.8a8.1 8.1 0 0 0-4.797 2.351c-3.149 3.17-3.187 8.289-.123 11.531l-1.741 1.752l5.51.301l-.015-5.834zm6.647-11.959l.015 5.834l2.307-2.322c2.262 2.434 2.222 6.246-.128 8.611a6.07 6.07 0 0 1-3.414 1.736l.069 2.076a8.12 8.12 0 0 0 4.798-2.35c3.148-3.172 3.186-8.291.122-11.531l1.741-1.754z"/>
                <path id="b-frag" fill="#0095da" d="M 0 2 A 13 13 0 0 1 13 15 L 0 15 Z" stroke="black" stroke-width="1.5"></path>
                <path id="g-frag" fill="#01a24f" d="M 13 0 A 13 13 0 0 1 0 13 L 0 0 Z" stroke="black" stroke-width="1.5"></path>
                <path id="y-frag" fill="#fede02" d="M 15 13 A 13 13 0 0 1 2 0 L 15 0 Z" stroke="black" stroke-width="1.5"></path>
                <path id="r-frag" fill="#ed1c25" d="M 2 15 A 13 13 0 0 1 15 2 L 15 15 Z" stroke="black" stroke-width="1.5"></path>
                <path id="chip" fill="#333" d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24M60.4 71.72l17.07 17.07a63.66 63.66 0 0 0-13 31.21h-24.1A87.6 87.6 0 0 1 60.4 71.72M40.37 136h24.15a63.66 63.66 0 0 0 13 31.21L60.4 184.28A87.6 87.6 0 0 1 40.37 136M120 215.63a87.6 87.6 0 0 1-48.28-20l17.07-17.07A63.66 63.66 0 0 0 120 191.48Zm0-151.11a63.66 63.66 0 0 0-31.21 13L71.72 60.4a87.6 87.6 0 0 1 48.28-20ZM215.63 120h-24.15a63.66 63.66 0 0 0-12.95-31.21l17.07-17.07A87.6 87.6 0 0 1 215.63 120M136 40.37a87.6 87.6 0 0 1 48.28 20l-17.07 17.1a63.66 63.66 0 0 0-31.21-13Zm0 175.26v-24.15a63.66 63.66 0 0 0 31.21-12.95l17.07 17.07A87.6 87.6 0 0 1 136 215.63m59.6-31.35l-17.07-17.07A63.66 63.66 0 0 0 191.48 136h24.15a87.6 87.6 0 0 1-20.03 48.28"/>`
            }
            function drawTable() {
                let str = `<defs>
                <marker id="arrow" fill="#333" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                <marker id="gaveup" fill="red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 10 0 L 0 5 L 10 10 z" /></marker>
                <marker id="arrow-grey" fill="#ddd" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                <marker id="arrow-blue" fill="#337ab7" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                <marker id="arrow-red" fill="#d9534f" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>`
                + getUnoCardSymbolDefs()
                + (window.CardTableSurface ? CardTableSurface.feltGradientDefs() : '')
                + `</defs>`
                + (window.CardTableSurface ? CardTableSurface.circleTable() : '<circle cx="250" cy="250" r="150" stroke="#333" stroke-width="1.5" fill="transparent"></circle>')
                str += drawCards()
                str += drawPeople()
                $('.uno-svg').html(str)
                $('.sel-h').hide()
                setTimeout(() => {
                    $('.btn-ready').removeClass('btn-danger')
                    $('.card.card-danger').removeSvgClass('card-danger')
                    $('.person-ready').remove()
                    $('.person-unready').css('display', 'block')
                }, 100)
            }
            function drawButtons(msg = '') {
                let str = '', str2 = msg
                if (window.CardGameActions) {
                    CardGameActions.setUnoDrawPile(null)
                    $('.cards-left').text(cur.allLeft).attr('fill', '#999')
                } else {
                    $('.cards-rect').attr('fill', '#ddd')
                    $('.cards-arrow').attr('fill', '#bbb')
                    $('.cards-left').text(cur.allLeft).attr('fill', '#999')
                }
                if (tt == 0) {
                    let f = ''
                    if (!AI_ONLY_MODE) {
                        for (let i in cur.isOffline) if (cur.isOffline[i]) f += (f.length ? '、' : '') + (cur.name[i] == '' ? '玩家' : cur.name[i])
                    }
                    const readyLabel = AI_ONLY_MODE ? (CardGameCopy.readyStart || '准备开局') : '启动'
                    if (f.length) {
                        str += `<div class="hearts-alert" style="text-align:center;margin-top:-50px;margin-bottom:10px">${f} 暂离。<br>请稍后${cur.num > 1 ? '，或' : '。'}</div>`
                        if (cur.num > 1) str += `${getButton(`default ${cur.wasReady != -1 ? 'btn-danger' : ''} btn-ready`, CardGameCopy.readyNext || '下一局', 0, 'play', 0, 0, `socket.send('ready')`)} ${cur.readyCnt} / ${cur.num}`
                    } else if (cur.num > 1) str += `${getButton(`default ${cur.wasReady != -1 ? 'btn-danger' : ''} btn-ready`, readyLabel, 0, 'play', 0, 0, `socket.send('ready')`)} ${cur.readyCnt} / ${cur.num}`
                }
                else if (tt < 3 && cur.now == cur.you) {
                    if (tt == 1) {
                        if (cur.ban == '-') {
                            str2 += `${getButton('default btn-skip', `跳过`, `socket.send('up skip')`, 'ban-circle')}`
                        } else if (cur.ban == '+') {
                            if (!cur.toDraw) return socket.send('up skip')
                            else if (cur.toDraw == cur.banDraw) {
                                str2 += `${getButton('primary btn-up', `出牌`, `socket.send(\`up \${me.card}\`)`, 'arrow-up')}`
                                if (window.CardGameActions) CardGameActions.setUnoDrawPile('draw')
                                $('.cards-text').text('+' + cur.toDraw)
                            } else {
                                if (window.CardGameActions) CardGameActions.setUnoDrawPile('draw')
                                if (cur.banDraw) $('.cards-text').text('+' + cur.toDraw)
                            }
                        } else {
                            if (!cur.toDraw) {
                                let canSelect = 0, cu = cur.cards[cur.you]
                                for (let i = 0; i < cu.length - 1; i++) {
                                    let c = cu[i]
                                    if (validCard(cur.cen, c)) {
                                        canSelect = 1
                                        break
                                    }
                                }
                                if (canSelect || (cu.length && !validCard(cur.cen, cu[cu.length - 1]))) return socket.send('up skip')
                                str2 += `<div class="btn-group">${getButton('default btn-skip', `跳过`, `socket.send('up skip')`, 'forward')}${getButton('primary btn-up', `出牌`, `socket.send(\`up \${me.card}\`)`, 'arrow-up')}</div>`
                            } else {
                                str2 += `${getButton('primary btn-up', `出牌`, `socket.send(\`up \${me.card}\`)`, 'arrow-up')}`
                                if (window.CardGameActions) CardGameActions.setUnoDrawPile('draw')
                            }
                        }
                    } else if (tt == 2) {
                        $('.sel').show()
                    }
                } else if (tt == 3) {
                    str2 += `${getButton(`default ${cur.wasReady != -1 ? 'btn-danger' : ''} btn-ready`, '下一局', 0, 'play', 0, 0, `socket.send('ready')`)} ${cur.readyCnt} / ${cur.num}`
                }

                $('.uno-btns').html(str)
                $('.uno-btns-down').html(str2)
                $('.btn-up').addClass('disabled')
            }
            function drawUnoAll() {
                let col = 'RGBY', num = '1122334455667788990--++RR', s = []
                for (let i = 0; i < 4; i++) {
                    for (let j = 0; j < num.length; j++) {
                        s.push(col[i] + num[j])
                    }
                }
                s.push('!+', '!+', '!+', '!+', '!!', '!!', '!!', '!!')
                return s
            }
            function fillLobbyDecor() {
                const arr = drawUnoAll()
                let str = '<defs>' + getUnoCardSymbolDefs() + '</defs>'
                for (let i = 0; i < 7; i++) {
                    let x = Math.random(), y = Math.random()
                    x = 1.5 * x - 0.5 * x * x
                    y = 1.5 * y - 0.5 * y * y
                    const ar = arr[Math.floor(Math.random() * arr.length)]
                    str += drawCard(x * 400 + 50, y * 350 + 80, ar, ar[1] == 'R' ? 0 : Math.random() * 40 - 20)
                }
                $('.decor').html(str)
            }
            function initAIMode() {
                if (typeof renderCardGameLobbyList === 'function') renderCardGameLobbyList()
                fillLobbyDecor()
            }

window.selectCard = selectCard
window.getUnoCardSymbolDefs = getUnoCardSymbolDefs
