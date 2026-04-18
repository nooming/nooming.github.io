let x = 40, y = 40, vx = 0, vy = 0, forcex = 0, forcey = 0, ex = 0, ey = 0, tex = 0, tey = 0, b = 0, tb = 0, bvx = 0, bvy = 0
let vbx = 0, vby = 0, cbx = 0, cby = 0
let vb = 0, cb = 0, bleft = 0
let vex = 0, vey = 0, cex = 0, cey = 0, eleft = 0
let vfx = 0, vfy = 0, cfx = 0, cfy = 0, fleft = 0
let lastfr = [0, 0]
let isfr = 1, bound = 0
const lx = 0, rx = 500, ly = 0, ry = 500, fr = 0.01, mFr = 0.2
let t = 1
let delay = 0
            function loop() {
                $('.v').text(Math.sqrt(vx * vx + vy * vy).toFixed(2))
                let dvx = 0, dvy = 0, gstr = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" fill="#2de842" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                    <marker id="arr" fill="#333" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                    <marker id="arr-r" fill="red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                    <marker id="arr-g" fill="#2de842" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                    <marker id="arr-b" fill="#4d70c2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                </defs>`

                if (t) {
                    x += vx * t, y += vy * t
                    dvx += forcex, dvy += forcey
                    dvx += ex, dvy += ey
                    bvx = vy * b * t * 0.1, bvy = -vx * b * t * 0.1
                    let th = Math.acos(
                        Math.abs((bvx + vx) * vx + (bvy + vy) * vy) / Math.sqrt(((bvx + vx) * (bvx + vx) + (bvy + vy) * (bvy + vy)) * (vx * vx + vy * vy))
                    )
                    if (th == th && t)
                        dvx += ((bvx + vx) * Math.cos(th) - vx) / t, dvy += ((bvy + vy) * Math.cos(th) - vy) / t

                    let force = Math.sqrt(dvx * dvx + dvy * dvy), v = Math.sqrt(vx * vx + vy * vy)
                    if (isfr) {
                        if (v <= 0.05 && force && force < mFr) {
                            gstr += `<line x1="50" y1="50" x2="${-100 * dvx + 50}" y2="${-100 * dvy + 50}" stroke="#333" marker-end="url(#arr)"/>`

                            dvx = 0, dvy = 0
                        } else if (isfr == 1) {
                            if (v > 0.05) {
                                dvx -= mFr * vx / v
                                dvy -= mFr * vy / v
                                let ddx = mFr * vx / v - lastfr[0], ddy = mFr * vy / v - lastfr[1]
                                if (Math.sqrt(ddx * ddx + ddy * ddy) > 0.3) vx /= 5, vy /= 5
                                lastfr = [mFr * vx / v, mFr * vy / v]
                                gstr += `<line x1="50" y1="50" x2="${-100 * mFr * vx / v + 50}" y2="${-100 * mFr * vy / v + 50}" stroke="#333" marker-end="url(#arr)"/>`

                            } else {
                                if (force && force < mFr) vx = vy = 0
                                gstr += `<line x1="50" y1="50" x2="${50}" y2="${50}" stroke="#333" marker-end="url(#arr)"/>`
                            }
                        } else if (isfr == 10) {
                            dvx -= vx * fr * isfr
                            dvy -= vy * fr * isfr
                            gstr += `<line x1="50" y1="50" x2="${-vx * isfr + 50}" y2="${-vy * isfr + 50}" stroke="#333" marker-end="url(#arr)"/>`
                        }
                    }
                }
                if (ex || ey) {
                    gstr += `<line x1="50" y1="50" x2="${ex * 100 + 50}" y2="${ey * 100 + 50}" stroke="#2de84a" marker-end="url(#arr-g)"/>`

                }
                if (b) {
                    if (vx * vx * b * b + vy * vy * b * b > 40)
                        gstr += `<line x1="50" y1="50" x2="${vy * 10 * b + 50}" y2="${-vx * 10 * b + 50}" stroke="#4d70c2"  marker-end="url(#arr-b)"/>`
                    else gstr += `<line x1="50" y1="50" x2="${vy * 10 * b + 50}" y2="${-vx * 10 * b + 50}" stroke="#4d70c2cc"  marker-end="url(#arr-b)"/>`
                }
                if (!bound) {
                    if (x < lx * 100) x += (rx - lx) * 100
                    if (x > rx * 100) x -= (rx - lx) * 100
                    if (y < ly * 100) y += (ry - ly) * 100
                    if (y > ry * 100) y -= (ry - ly) * 100
                    let str = `<defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" fill="#2de842" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                        <marker id="arr" fill="#333" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                        <marker id="arrow-grey" fill="#ddd" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                        <marker id="arrow-blue" fill="#337ab7" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                        <marker id="arrow-red" fill="#d9534f" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                    </defs>`
                    let d, r, dd
                    if (ex || ey) {
                        d = Math.sqrt(ex * ex + ey * ey)
                        dd = Math.abs(50 / d) + 0.1
                        r = (ey < 0 ? -1 : 1) * Math.acos(ex / d)
                        let i = -500
                        if (Math.abs(ex) > Math.abs(ey)) {
                            i = (-y % 500 + x * Math.tan(r)) % 500 - 500
                        }
                        else i = (-x % 500 + y / Math.tan(r)) % 500 - 500
                        for (; i < 1000; i += dd) {
                            if (Math.abs(ex) > Math.abs(ey)) {
                                if (ex > 0)
                                    str += `<line x1="0" y1="${i}" x2="500" y2="${i + 700 * Math.sin(r)}" stroke="#2de842" marker-end="url(#arrow)" />`
                                else
                                    str += `<line x1="500" y1="${i}" x2="0" y2="${i + 700 * Math.sin(r)}" stroke="#2de842" marker-end="url(#arrow)" />`
                            } else {
                                if (ey > 0)
                                    str += `<line x1="${i}" y1="0" x2="${i + 700 * Math.cos(r)}" y2="500" stroke="#2de842" marker-end="url(#arrow)" />`
                                else
                                    str += `<line x1="${i}" y1="500" x2="${i + 700 * Math.cos(r)}" y2="0" stroke="#2de842" marker-end="url(#arrow)" />`
                            }
                        }
                    }
                    dd = Math.abs(5 / b) + 0.1
                    for (let i = (-x + vx) % 500 - 510; i < 510; i += 50 * (-Math.abs(b) + 2)) {
                        for (let j = (-y + vy) % 500 - 510; j < 510; j += 50 * (-Math.abs(b) + 2)) {
                            if (i < 0 || y < 0) continue
                            str += getx(i, j, b <= 0, vx, vy)
                        }
                    }
                    $('.m-svg').html(str)
                    $('.cursor').css('margin-left', `${250 + 100}px`)
                        .css('margin-top', `${247 + 200}px`)
                    $('.cursor').css('border-color', `#333`)
                }
                else {
                    let bx = Math.pow(Math.max(0, lx - x) * 0.04, 2) - Math.pow(Math.max(0, x - rx) * 0.04, 2)
                    let by = Math.pow(Math.max(0, ly - y) * 0.04, 2) - Math.pow(Math.max(0, y - ry) * 0.04, 2)
                    dvx += bx
                    dvy += by
                    $('.m-div').css('border-color', '#ddd')
                    if (cbx != cbx) cbx = 0
                    if (cby != cby) cby = 0
                    if (x < cbx + lx || x > cbx + rx) {
                        let k = Math.min(lx, x) + Math.max(0, x - rx)
                        vbx = (k - cbx) / t
                        cbx = Math.min(lx, x) + Math.max(0, x - rx)
                        $('.m-div').css('border-color', '#ebb')
                    } else cbx += vbx * t
                    if (y < cby + ly || y > cby + ry) {
                        let k = Math.min(ly, y) + Math.max(0, y - ry)
                        vby = (k - cby) / t
                        cby = Math.min(ly, y) + Math.max(0, y - ry)
                        $('.m-div').css('border-color', '#ebb')
                    } else cby += vby * t
                    vbx -= bx * t * 0.1, vby -= by * t * 0.1
                    vbx -= cbx * 0.1 * t, vby -= cby * 0.1 * t
                    vbx -= vbx * 0.1 * t, vby -= vby * 0.1 * t
                    $('.m-div')
                        .css('margin-left', `${120 + cbx}px`)
                        .css('top', `${200 + cby}px`)
                    $('.cursor').css('margin-left', `${x + 100}px`)
                        .css('margin-top', `${y + 200}px`)
                    if (x < lx || x > rx || y < ly || y > ry) $('.cursor').css('border-color', `red`)
                    else $('.cursor').css('border-color', `#333`)

                    gstr += `<line x1="50" y1="50" x2="${bx * 100 + 50}" y2="${by * 100 + 50}" stroke="red" marker-end="url(#arr-r)"/>`
                }
                gstr += `<line x1="50" y1="50" x2="${forcex * 100 + 50}" y2="${forcey * 100 + 50}" stroke="#333" marker-end="url(#arr)"/>`
                $('.g-svg').html(gstr)
                vx += dvx * t, vy += dvy * t
                if (eleft) {
                    cex += vex * t, cey += vey * t
                    vex -= cex * 0.1 * t, vey -= cey * 0.1 * t
                    vex -= vex * 0.1 * t, vey -= vey * 0.1 * t
                }
                $('.E-div').css('margin-left', `${cex}px`)
                $('.E-div').css('top', `${290 + cey}px`)
                if (fleft) {
                    cfx += vfx * t, cfy += vfy * t
                    vfx -= cfx * 0.1 * t, vfy -= cfy * 0.1 * t
                    vfx -= vfx * 0.1 * t, vfy -= vfy * 0.1 * t
                }
                $('.f-div').css('margin-left', `${cfx}px`)
                $('.f-div').css('top', `${400 + cfy}px`)
                if (bleft) {
                    cb += vb * t
                    vb -= cb * 0.1 * t
                    vb -= vb * 0.1 * t
                }
                $('.B-div').css('top', `${510 + cb}px`)
            }
            function setforce(e, leave = 0) {
                if (delay) return
                if (!e) e = { offsetX: 50, offsetY: 51 }
                forcex = 0.01 * (e.offsetX - 50)
                forcey = 0.01 * (e.offsetY - 51)
                if (leave) {
                    vfx = cfx - forcex * 5
                    vfy = cfy - forcey * 5
                    fleft = delay = 1
                    setTimeout(() => { delay = 0 }, 100)
                } else vfx = vfy = fleft = 0
                cfx = forcex * 5
                cfy = forcey * 5
            }
            function setE(e, set = 0, leave = 0) {
                if (delay) return
                if (!e) {
                    if (set) ex = 0, ey = 0
                    else ex = tex, ey = tey
                    if (!ex && !ey) $('.rmE').hide()
                } else {
                    ex = 0.01 * (e.offsetX - 50)
                    ey = 0.01 * (e.offsetY - 51)
                    $('.rmE').show()
                }
                if (set) tex = ex, tey = ey
                if (ex || ey) {

                    let str = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" fill="#2de842" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" />
                      </marker></defs>`
                    let d = Math.sqrt(ex * ex + ey * ey), dd = Math.abs(5 / d) + 0.1, r = (ey < 0 ? -1 : 1) * Math.acos(ex / d)
                    for (let i = -100; i < 200; i += dd) {
                        if (Math.abs(ex) > Math.abs(ey)) {
                            if (ex > 0)
                                str += `<line x1="0" y1="${i}" x2="100" y2="${i + 125 * Math.sin(r)}" stroke="#2de842" marker-end="url(#arrow)" />`
                            else
                                str += `<line x1="100" y1="${i}" x2="0" y2="${i + 125 * Math.sin(r)}" stroke="#2de842" marker-end="url(#arrow)" />`
                        } else {
                            if (ey > 0)
                                str += `<line x1="${i}" y1="0" x2="${i + 125 * Math.cos(r)}" y2="100" stroke="#2de842" marker-end="url(#arrow)" />`
                            else
                                str += `<line x1="${i}" y1="100" x2="${i + 125 * Math.cos(r)}" y2="0" stroke="#2de842" marker-end="url(#arrow)" />`
                        }
                    }
                    $('.E-svg').html(str)
                } else $('.E-svg').html(''), $('.E').css('opacity', '0')
                if (leave) {
                    vex = cex - ex * 5
                    vey = cey - ey * 5
                    eleft = delay = 1
                    setTimeout(() => { delay = 0 }, 100)
                } else vex = vey = eleft = 0
                cex = ex * 5
                cey = ey * 5
                drawBound()
            }
            function getx(i, j, d, vx = 0, vy = 0) {
                let str = ''
                if (vx) str += `<line x1="${i}" y1="${j}" x2="${i + vx}" y2="${j + vy}" stroke="${b ? '#4d70c233' : '#eee'}" stroke-width="3" />`
                if (d)
                    str += `<circle cx="${i}" cy="${j}" r="2" fill="${b ? '#4d70c2' : '#bbb'}" />`
                else str += `<line x1="${i - 2.5}" y1="${j - 2.5}" x2="${i + 2.5}" y2="${j + 2.5}" stroke="${b ? '#4d70c2' : '#bbb'}" />`
                    + `<line x1="${i + 2.5}" y1="${j - 2.5}" x2="${i - 2.5}" y2="${j + 2.5}" stroke="${b ? '#4d70c2' : '#bbb'}" />`
                return str
            }
            function setB(e, set = 0, leave = 0) {
                if (delay) return
                if (!e) {
                    if (set) b = 0
                    else b = tb
                    if (!b) $('.rmB').hide()
                    $('.lB').css('border-color', 'transparent')
                } else {
                    b = 0.02 * (e.offsetY - 51)
                    $('.rmB').show()
                }
                if (set) tb = b
                if (b) {
                    if (b > 0) $('.lB').css('margin-top', '560px').css('height', `${b / 0.02}px`)
                    else $('.lB').css('margin-top', `${560 + b / 0.02}px`).css('height', `${-b / 0.02}px`)
                    $('.lB').css('border-color', '#4d70c2')
                    let str = ''
                    let dd = Math.abs(5 / b) + 0.1
                    for (let i = 50; i < 110; i += dd) {
                        for (let j = 50; j < 110; j += dd) {
                            str += getx(i, j, b < 0)
                        }
                        for (let j = 50; j > -10; j -= dd) {
                            str += getx(i, j, b < 0)
                        }
                    }
                    for (let i = 50; i > -10; i -= dd) {
                        for (let j = 50; j < 110; j += dd) {
                            str += getx(i, j, b < 0)
                        }
                        for (let j = 50; j > -10; j -= dd) {
                            str += getx(i, j, b < 0)
                        }
                    }
                    $('.B-svg').html(str)
                } else $('.B-svg').html(''), $('.B').css('opacity', '0')
                if (leave) {
                    vb = cb - b * 5
                    bleft = delay = 1
                    setTimeout(() => { delay = 0 }, 100)
                } else vb = bleft = 0
                cb = b * 5
                drawBound()
            }
            function setMiddle() {
                $('.m-div')
                    .css('margin-left', `${120}px`)
                    .css('top', `${200}px`)
                    .css('border-color', '#ddd')
                while (x < lx) x += (rx - lx)
                while (x > rx) x -= (rx - lx)
                while (y < ly) y += (ry - ly)
                while (y > ry) y -= (ry - ly)
            }
            function drawBound() {
                if (!bound) return
                let str = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" fill="#2de842" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker></defs>`
                if (ex || ey) {
                    let d = Math.sqrt(ex * ex + ey * ey), dd = Math.abs(50 / d) + 0.1, r = (ey < 0 ? -1 : 1) * Math.acos(ex / d)
                    for (let i = -500; i < 1000; i += dd) {
                        if (Math.abs(ex) > Math.abs(ey)) {
                            if (ex > 0) str += `<line x1="0" y1="${i}" x2="500" y2="${i + 500 * Math.sin(r)}" stroke="#2de842" marker-end="url(#arrow)" />`
                            else str += `<line x1="500" y1="${i}" x2="0" y2="${i + 500 * Math.sin(r)}" stroke="#2de842" marker-end="url(#arrow)" />`
                        } else {
                            if (ey > 0) str += `<line x1="${i}" y1="0" x2="${i + 500 * Math.cos(r)}" y2="500" stroke="#2de842" marker-end="url(#arrow)" />`
                            else str += `<line x1="${i}" y1="500" x2="${i + 500 * Math.cos(r)}" y2="0" stroke="#2de842" marker-end="url(#arrow)" />`
                        }
                    }
                }
                if (b) {
                    for (let i = 250; i < 510; i += 50 * (-Math.abs(b) + 2)) {
                        for (let j = 250; j >= -10; j -= 50 * (-Math.abs(b) + 2)) {
                            str += getx(i, j, b <= 0, 0.001, 0)
                        }
                        for (let j = 250; j < 510; j += 50 * (-Math.abs(b) + 2)) {
                            str += getx(i, j, b <= 0, 0.001, 0)
                        }
                    }
                    for (let i = 250; i >= -10; i -= 50 * (-Math.abs(b) + 2)) {
                        for (let j = 250; j >= -10; j -= 50 * (-Math.abs(b) + 2)) {
                            str += getx(i, j, b <= 0, 0.001, 0)
                        }
                        for (let j = 250; j < 510; j += 50 * (-Math.abs(b) + 2)) {
                            str += getx(i, j, b <= 0, 0.001, 0)
                        }
                    }
                }
                $('.m-svg').html(str)
            }
            let fst = 0
            $(() => {
                $('.rmE').hide()
                $('.rmB').hide()
                setInterval(loop, 10)
                $('body')[0].addEventListener("keydown", function (event) {
                    let g = event.key
                    if (g == 1) $('.sp1').click()
                    if (g == 2) $('.sp2').click()
                    if (g == 3) $('.sp3').click()
                    if (g == 4) $('.sp4').click()
                    if (g == 'f') {
                        if (fst) isfr = 10, $('.spf').text('刹车').addClass('btn-danger').removeClass('btn-primary'), $('.dragger').show()
                        else $('.spf').text('阻力')
                        fst = 1
                    }
                    if (g == 's') $('.sps').click()
                    if (g == 'e') $('.rmE').click()
                    if (g == 'b') $('.rmB').click()
                });
                $('body')[0].addEventListener("keyup", function (event) {
                    let g = event.key
                    if (g == 'f') {
                        if ($('.spf').hasClass('btn-danger')) {
                            $('.spf').text('阻力').removeClass('btn-danger').addClass('btn-primary')
                            isfr = 1
                        } else {
                            $('.spf').text('阻力').removeClass('btn-danger').click()
                        }
                        fst = 0
                    }
                });
            })
