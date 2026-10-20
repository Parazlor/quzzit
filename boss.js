(function() {
    'use strict';

    var overlay = document.getElementById('bossOverlay');
    if (!overlay) return;

    var intro = document.getElementById('bossIntro');
    var stage = document.getElementById('bossStage');
    var canvas = document.getElementById('bossCanvas');
    var ctx = canvas.getContext('2d');
    var bossBarFill = document.getElementById('bossBarFill');
    var bossShieldFill = document.getElementById('bossShieldFill');
    var livesEl = document.getElementById('bossLives');
    var messageEl = document.getElementById('bossMessage');

    var W = 0;
    var H = 0;
    var state = 'idle';
    var running = false;
    var rafId = 0;
    var startTimer = 0;
    var endTimer = 0;
    var lastTime = 0;
    var onFinish = null;
    var keys = {};
    var player = null;
    var boss = null;
    var shots = [];
    var enemyShots = [];
    var minions = [];
    var pickups = [];
    var particles = [];
    var stars = [];
    var upgraded = false;
    var noticeTimer = 0;
    var shieldNoticeTimer = 0;
    var phaseFlash = 0;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function rectsOverlap(a, b) {
        return Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
               Math.abs(a.y - b.y) < (a.h + b.h) / 2;
    }

    function pointInEllipse(px, py, cx, cy, rx, ry) {
        var dx = (px - cx) / rx;
        var dy = (py - cy) / ry;
        return dx * dx + dy * dy <= 1;
    }

    function shieldCenterY() {
        return boss.y + boss.h * 0.05;
    }

    function shieldRadiusX() {
        return boss.w * 0.5 + 58;
    }

    function shieldRadiusY() {
        return boss.h * 0.5 + 44;
    }

    function clearTimers() {
        if (startTimer) window.clearTimeout(startTimer);
        if (endTimer) window.clearTimeout(endTimer);
        if (rafId) window.cancelAnimationFrame(rafId);
        startTimer = 0;
        endTimer = 0;
        rafId = 0;
    }

    function removeInput() {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('resize', resizeCanvas);
        keys = {};
    }

    function onKeyDown(event) {
        if (state !== 'play') return;

        if (event.code === 'Space') {
            event.preventDefault();
            if (!event.repeat) shoot();
            return;
        }

        if (event.code === 'KeyA' || event.code === 'KeyD' ||
            event.code === 'KeyW' || event.code === 'KeyS') {
            event.preventDefault();
            keys[event.code] = true;
        }
    }

    function onKeyUp(event) {
        if (keys[event.code]) keys[event.code] = false;
    }

    function start(options) {
        onFinish = options && options.onFinish;
        removeInput();
        clearTimers();

        var quiz = document.getElementById('quizContainer');
        if (quiz) quiz.classList.add('hidden');

        overlay.classList.remove('hidden');
        overlay.classList.remove('boss-blackout');
        overlay.setAttribute('aria-hidden', 'false');

        intro.classList.remove('hidden');
        stage.classList.add('hidden');
        stage.classList.remove('boss-stage-fade');

        messageEl.className = 'boss-message hidden';
        messageEl.textContent = '';

        state = 'intro';
        running = true;

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('resize', resizeCanvas);

        startTimer = window.setTimeout(function() {
            if (!running) return;
            intro.classList.add('hidden');
            stage.classList.remove('hidden');
            resizeCanvas();
            resetGame();
            state = 'play';
            lastTime = performance.now();
            rafId = window.requestAnimationFrame(loop);
        }, 2300);
    }

    function stop() {
        running = false;
        state = 'idle';
        removeInput();
        clearTimers();
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.setAttribute('aria-hidden', 'true');
        }
    }

    function resizeCanvas() {
        if (!canvas) return;
        var rect = canvas.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) return;

        W = Math.round(rect.width);
        H = Math.round(rect.height);

        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (state === 'play' && player && boss) {
            boss.x = W / 2;
            boss.w = Math.min(340, Math.max(210, W * 0.5));
            boss.h = boss.w * 0.42;
            boss.y = Math.max(148, 88 + boss.h * 0.64);
            player.x = clamp(player.x, 22 + player.w / 2, W - 22 - player.w / 2);
            player.y = clamp(player.y, H * 0.42, H - 30 - player.h / 2);
        }
    }

    function resetGame() {
        W = canvas.clientWidth || W;
        H = canvas.clientHeight || H;

        player = {
            x: W / 2,
            y: H - 82,
            w: 40,
            h: 48,
            speed: 380,
            lives: 3,
            invuln: 0
        };

        var bossW = Math.min(340, Math.max(210, W * 0.5));
        var bossH = bossW * 0.42;

        boss = {
            x: W / 2,
            y: Math.max(148, 88 + bossH * 0.64),
            w: bossW,
            h: bossH,
            hp: 100,
            maxHp: 100,
            phase: 1,
            shieldHp: 10,
            shieldBroken: false,
            shieldFlash: 0,
            shootTimer: 1.4,
            minionTimer: 5.0,
            beamState: 'idle',
            beamTimer: 2.2,
            beamCharge: 0,
            beamActive: 0,
            beamX: W / 2,
            corePulse: 0
        };

        shots = [];
        enemyShots = [];
        minions = [];
        pickups = [];
        particles = [];
        stars = [];
        upgraded = false;
        noticeTimer = 0;
        shieldNoticeTimer = 0;
        phaseFlash = 0;

        for (var i = 0; i < 90; i++) {
            stars.push(makeStar(true));
        }

        updateHud();
    }

    function makeStar(initial) {
        return {
            x: Math.random() * W,
            y: initial ? Math.random() * H : -10,
            speed: 18 + Math.random() * 65,
            size: 0.6 + Math.random() * 1.7,
            alpha: 0.25 + Math.random() * 0.65
        };
    }

    function updateHud() {
        if (!player || !boss) return;
        livesEl.textContent = 'Жизни: ' + player.lives;
        bossBarFill.style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
        bossBarFill.classList.toggle('phase-2', boss.phase === 2);
        bossShieldFill.style.width = (boss.shieldBroken ? 0 : boss.shieldHp / 10 * 100) + '%';
        bossShieldFill.classList.toggle('broken', boss.shieldBroken);
    }

    function loop(timestamp) {
        if (state !== 'play') return;

        var dt = (timestamp - lastTime) / 1000;
        if (dt < 0) dt = 0;
        if (dt > 0.05) dt = 0.05;
        lastTime = timestamp;

        update(dt);
        draw();

        rafId = window.requestAnimationFrame(loop);
    }

    function update(dt) {
        updateStars(dt);
        updatePlayer(dt);
        updateBoss(dt);
        updateShots(dt);
        updateEnemyShots(dt);
        updateMinions(dt);
        updatePickups(dt);
        updateParticles(dt);

        if (noticeTimer > 0) noticeTimer -= dt;
        if (shieldNoticeTimer > 0) shieldNoticeTimer -= dt;
        if (phaseFlash > 0) phaseFlash -= dt;
    }

    function updateStars(dt) {
        for (var i = 0; i < stars.length; i++) {
            var star = stars[i];
            star.y += star.speed * dt;
            if (star.y > H + 4) {
                star.y = -4;
                star.x = Math.random() * W;
            }
        }
    }

    function updatePlayer(dt) {
        if (player.invuln > 0) player.invuln -= dt;

        var dx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
        var dy = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);

        if (dx !== 0 && dy !== 0) {
            dx *= 0.7071;
            dy *= 0.7071;
        }

        player.x += dx * player.speed * dt;
        player.y += dy * player.speed * 0.72 * dt;

        player.x = clamp(player.x, 22 + player.w / 2, W - 22 - player.w / 2);
        player.y = clamp(player.y, H * 0.42, H - 30 - player.h / 2);
    }

    function updateBoss(dt) {
        boss.shieldFlash = Math.max(0, boss.shieldFlash - dt);
        boss.corePulse += dt;

        if (boss.phase === 1) {
            boss.shootTimer -= dt;
            if (boss.shootTimer <= 0) {
                fireVolley(1);
                boss.shootTimer = 0.9 + Math.random() * 0.45;
            }

            boss.minionTimer -= dt;
            if (boss.minionTimer <= 0) {
                spawnMinion(true);
                boss.minionTimer = 6.0 + Math.random() * 1.5;
            }
        } else {
            boss.shootTimer -= dt;
            if (boss.shootTimer <= 0) {
                fireVolley(2);
                boss.shootTimer = 0.55 + Math.random() * 0.25;
            }

            boss.minionTimer -= dt;
            if (boss.minionTimer <= 0) {
                spawnMinion(!upgraded);
                boss.minionTimer = 3.8 + Math.random() * 1.4;
            }

            updateBeam(dt);
        }
    }

    function fireVolley(phase) {
        var count = phase === 2 ? 5 : 3;
        var baseY = boss.y + boss.h * 0.32;

        for (var i = 0; i < count; i++) {
            var offset = (i - (count - 1) / 2) * boss.w * 0.105;
            var sx = boss.x + offset + (Math.random() - 0.5) * 12;
            var sy = baseY;
            var spread = phase === 2 ? 180 : 90;
            var targetX = player.x + (Math.random() - 0.5) * spread;
            var vx = targetX - sx;
            var vy = H * 0.55;
            var length = Math.sqrt(vx * vx + vy * vy) || 1;
            var speed = phase === 2 ? 440 : 340;

            enemyShots.push({
                x: sx,
                y: sy,
                vx: vx / length * speed,
                vy: vy / length * speed,
                w: 9,
                h: 28
            });
        }

        if (enemyShots.length > 140) {
            enemyShots.splice(0, enemyShots.length - 140);
        }
    }

    function updateBeam(dt) {
        if (boss.beamState === 'idle') {
            boss.beamTimer -= dt;
            if (boss.beamTimer <= 0) {
                boss.beamState = 'charge';
                boss.beamCharge = 2.3;
                boss.beamX = boss.x;
            }
            return;
        }

        if (boss.beamState === 'charge') {
            boss.beamCharge -= dt;

            var trackSpeed = 150;
            var aimDelta = player.x - boss.beamX;
            var maxStep = trackSpeed * dt;
            boss.beamX += clamp(aimDelta, -maxStep, maxStep);

            if (boss.beamCharge <= 0) {
                boss.beamState = 'active';
                boss.beamActive = 1.0;
                burst(boss.beamX, boss.y + boss.h * 0.1, '#ff334d', 18);
            }
            return;
        }

        if (boss.beamState === 'active') {
            boss.beamActive -= dt;

            if (Math.abs(player.x - boss.beamX) < 45 + player.w / 2 && player.y > boss.y) {
                killPlayer();
                return;
            }

            if (boss.beamActive <= 0) {
                boss.beamState = 'idle';
                boss.beamTimer = 7.5 + Math.random() * 3;
            }
        }
    }

    function spawnMinion(forceDrop) {
        if (minions.length >= 6) return;

        var w = 30 + Math.random() * 12;
        var x = clamp(60 + Math.random() * (W - 120), 50, W - 50);
        var hasDrop = false;

        if (forceDrop && !upgraded && pickups.length === 0) {
            hasDrop = true;
            for (var i = 0; i < minions.length; i++) {
                if (minions[i].drop) {
                    hasDrop = false;
                    break;
                }
            }
        }

        minions.push({
            x: x,
            y: boss.y + boss.h * 0.5 + 62,
            w: w,
            h: w * 0.62,
            speed: 85 + Math.random() * 50,
            sway: Math.random() * Math.PI * 2,
            drop: hasDrop,
            hp: 2
        });
    }

    function shoot() {
        if (state !== 'play' || !player) return;

        if (upgraded) {
            shots.push({
                x: player.x,
                y: player.y - 30,
                vy: -720,
                w: 12,
                h: 34,
                type: 'torpedo',
                damage: 3
            });
        } else {
            shots.push({
                x: player.x,
                y: player.y - 28,
                vy: -790,
                w: 5,
                h: 24,
                type: 'basic',
                damage: 0
            });
        }
    }

    function updateShots(dt) {
        for (var i = shots.length - 1; i >= 0; i--) {
            var shot = shots[i];
            shot.y += shot.vy * dt;

            if (shot.y < -50) {
                shots.splice(i, 1);
                continue;
            }

            var sx = boss.x;
            var sy = shieldCenterY();
            var inShield = !boss.shieldBroken &&
                pointInEllipse(shot.x, shot.y, sx, sy, shieldRadiusX(), shieldRadiusY());

            if (shot.type === 'basic' && inShield) {
                boss.shieldFlash = 1.0;
                burst(shot.x, shot.y, '#ff4b5e', 9);
                shots.splice(i, 1);
                continue;
            }

            if (shot.type === 'torpedo' && inShield) {
                damageShield(1);
                burst(shot.x, shot.y, '#ff9aa7', 16);
                shots.splice(i, 1);
                continue;
            }

            var hitBoss = rectsOverlap(shot, {
                x: boss.x,
                y: boss.y,
                w: boss.w * 0.72,
                h: boss.h * 0.62
            });

            if (hitBoss) {
                damageBoss(shot.damage);
                burst(shot.x, shot.y, shot.type === 'torpedo' ? '#ffd08a' : '#bde8ff', 12);
                shots.splice(i, 1);
                continue;
            }

            var hitMinion = false;
            for (var j = minions.length - 1; j >= 0; j--) {
                if (rectsOverlap(shot, minions[j])) {
                    hitMinion = true;
                    minions[j].hp -= 1;
                    burst(shot.x, shot.y, '#ff8a9d', 7);
                    shots.splice(i, 1);

                    if (minions[j].hp <= 0) {
                        destroyMinion(j);
                    }
                    break;
                }
            }

            if (hitMinion) continue;
        }
    }

    function destroyMinion(index) {
        var minion = minions[index];
        burst(minion.x, minion.y, minion.drop ? '#ffd966' : '#ff556e', 18);

        if (minion.drop && !upgraded) {
            pickups.push({
                x: minion.x,
                y: minion.y,
                w: 30,
                h: 30,
                vy: 72,
                phase: 0
            });
        }

        minions.splice(index, 1);
    }

    function updateEnemyShots(dt) {
        for (var i = enemyShots.length - 1; i >= 0; i--) {
            var shot = enemyShots[i];
            shot.x += shot.vx * dt;
            shot.y += shot.vy * dt;

            if (shot.y > H + 50 || shot.x < -60 || shot.x > W + 60) {
                enemyShots.splice(i, 1);
                continue;
            }

            if (player.invuln <= 0 && rectsOverlap(shot, player)) {
                enemyShots.splice(i, 1);
                hitPlayer();
            }
        }
    }

    function updateMinions(dt) {
        for (var i = minions.length - 1; i >= 0; i--) {
            var minion = minions[i];
            minion.sway += dt * 2.2;
            minion.x += Math.sin(minion.sway) * 28 * dt;
            minion.y += minion.speed * dt;

            minion.x = clamp(minion.x, 30, W - 30);

            if (minion.y > H + 60) {
                minions.splice(i, 1);
                continue;
            }

            if (player.invuln <= 0 && rectsOverlap(minion, player)) {
                minions.splice(i, 1);
                hitPlayer();
            }
        }
    }

    function updatePickups(dt) {
        for (var i = pickups.length - 1; i >= 0; i--) {
            var pickup = pickups[i];
            pickup.y += pickup.vy * dt;
            pickup.phase += dt * 3.5;

            if (pickup.y > H + 50) {
                pickups.splice(i, 1);
                continue;
            }

            if (rectsOverlap(pickup, player)) {
                upgraded = true;
                noticeTimer = 2.6;
                burst(pickup.x, pickup.y, '#7dffcf', 34);
                pickups.splice(i, 1);
            }
        }
    }

    function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var particle = particles[i];
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.vx *= 0.985;
            particle.vy *= 0.985;
            particle.life -= dt;

            if (particle.life <= 0) particles.splice(i, 1);
        }
    }

    function hitPlayer() {
        if (state !== 'play' || player.invuln > 0) return;

        player.lives -= 1;
        player.invuln = 1.5;
        updateHud();
        burst(player.x, player.y, '#8fe8ff', 26);

        if (player.lives <= 0) {
            endGame(false);
        }
    }

    function killPlayer() {
        if (state !== 'play') return;
        player.lives = 0;
        updateHud();
        burst(player.x, player.y, '#ffffff', 46);
        endGame(false);
    }

    function damageShield(amount) {
        if (state !== 'play' || boss.shieldBroken) return;

        boss.shieldHp = Math.max(0, boss.shieldHp - amount);
        boss.shieldFlash = 1.0;
        updateHud();

        if (boss.shieldHp <= 0) {
            boss.shieldBroken = true;
            boss.shieldFlash = 0;
            shieldNoticeTimer = 2.4;

            for (var i = 0; i < 5; i++) {
                burst(
                    boss.x + (Math.random() - 0.5) * shieldRadiusX() * 1.5,
                    shieldCenterY() + (Math.random() - 0.5) * shieldRadiusY() * 1.5,
                    '#ff4b5e',
                    18
                );
            }

            updateHud();
        }
    }

    function damageBoss(amount) {
        if (state !== 'play' || amount <= 0) return;

        boss.hp = Math.max(0, boss.hp - amount);
        updateHud();

        if (boss.hp <= boss.maxHp / 2 && boss.phase === 1) {
            boss.phase = 2;
            boss.beamTimer = 2.0;
            boss.minionTimer = 1.2;
            boss.shootTimer = 0.7;
            phaseFlash = 1.3;
            burst(boss.x, boss.y, '#ff334d', 58);
            updateHud();
        }

        if (boss.hp <= 0) {
            endGame(true);
        }
    }

    function endGame(victory) {
        if (state !== 'play') return;

        state = 'ending';
        running = false;
        if (rafId) window.cancelAnimationFrame(rafId);
        rafId = 0;
        removeInput();
        if (endTimer) window.clearTimeout(endTimer);

        if (victory) {
            burst(boss.x, boss.y, '#ffd966', 80);
        } else {
            burst(player.x, player.y, '#ff4b5e', 40);
        }
        draw();

        messageEl.className = 'boss-message';
        messageEl.classList.add(victory ? 'boss-win' : 'boss-lose');
        messageEl.textContent = victory ? 'Ты искупил себя' : 'Ты не мой друг.....';

        stage.classList.add('boss-stage-fade');

        window.setTimeout(function() {
            if (state !== 'ending') return;
            messageEl.classList.add('boss-message-visible');
        }, 480);

        endTimer = window.setTimeout(function() {
            overlay.classList.add('hidden');
            overlay.setAttribute('aria-hidden', 'true');
            stage.classList.remove('boss-stage-fade');
            messageEl.className = 'boss-message hidden';
            messageEl.textContent = '';

            var quiz = document.getElementById('quizContainer');
            if (quiz) quiz.classList.remove('hidden');

            state = 'idle';
            running = false;

            if (typeof onFinish === 'function') {
                var callback = onFinish;
                onFinish = null;
                callback(victory);
            }
        }, 3200);
    }

    function burst(x, y, color, count) {
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 30 + Math.random() * 190;
            var life = 0.35 + Math.random() * 0.7;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 1.5 + Math.random() * 3.5,
                color: color,
                life: life,
                maxLife: life
            });
        }
    }

    function draw() {
        if (!ctx || !player || !boss) return;

        ctx.clearRect(0, 0, W, H);
        drawBackground();
        drawStars();
        drawShield();
        drawBoss();
        drawMinions();
        drawPickups();
        drawEnemyShots();
        drawPlayerShots();
        drawPlayer();
        drawParticles();
        drawBeam();
        drawCanvasMessages();
    }

    function drawBackground() {
        var gradient = ctx.createRadialGradient(W / 2, H * 0.22, 30, W / 2, H * 0.22, Math.max(W, H));
        gradient.addColorStop(0, '#121b3f');
        gradient.addColorStop(0.42, '#080b1d');
        gradient.addColorStop(1, '#02030a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);
    }

    function drawStars() {
        for (var i = 0; i < stars.length; i++) {
            var star = stars[i];
            ctx.globalAlpha = star.alpha;
            ctx.fillStyle = '#cfe6ff';
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawBoss() {
        var w = boss.w;
        var h = boss.h;

        ctx.save();
        ctx.translate(boss.x, boss.y);

        ctx.shadowColor = 'rgba(122, 102, 255, 0.55)';
        ctx.shadowBlur = 34;

        ctx.beginPath();
        ctx.moveTo(-w * 0.5, -h * 0.02);
        ctx.quadraticCurveTo(-w * 0.38, -h * 0.5, -w * 0.13, -h * 0.4);
        ctx.lineTo(0, -h * 0.64);
        ctx.lineTo(w * 0.13, -h * 0.4);
        ctx.quadraticCurveTo(w * 0.38, -h * 0.5, w * 0.5, -h * 0.02);
        ctx.lineTo(w * 0.34, h * 0.27);
        ctx.lineTo(w * 0.17, h * 0.18);
        ctx.lineTo(0, h * 0.44);
        ctx.lineTo(-w * 0.17, h * 0.18);
        ctx.lineTo(-w * 0.34, h * 0.27);
        ctx.closePath();
        ctx.fillStyle = '#37355f';
        ctx.fill();
        ctx.strokeStyle = '#c4b6ff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.moveTo(-w * 0.42, -h * 0.02);
        ctx.lineTo(-w * 0.24, h * 0.12);
        ctx.lineTo(-w * 0.1, h * 0.02);
        ctx.lineTo(w * 0.1, h * 0.02);
        ctx.lineTo(w * 0.24, h * 0.12);
        ctx.lineTo(w * 0.42, -h * 0.02);
        ctx.strokeStyle = 'rgba(255, 217, 102, 0.7)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-w * 0.48, h * 0.06);
        ctx.lineTo(-w * 0.35, h * 0.22);
        ctx.moveTo(w * 0.48, h * 0.06);
        ctx.lineTo(w * 0.35, h * 0.22);
        ctx.strokeStyle = '#8f7bff';
        ctx.lineWidth = 5;
        ctx.stroke();

        var coreY = h * 0.03;
        var pulse = 0.5 + 0.5 * Math.sin(boss.corePulse * 3.2);
        var charge = boss.beamState === 'charge' ? 1 - boss.beamCharge / 2 : 0;
        var coreRadius = 15 + pulse * 4 + charge * 14;

        var coreGradient = ctx.createRadialGradient(0, coreY, 2, 0, coreY, coreRadius * 2.6);
        coreGradient.addColorStop(0, '#ffffff');
        coreGradient.addColorStop(0.28, charge > 0 ? '#ff8796' : '#ffd966');
        coreGradient.addColorStop(1, 'rgba(255, 30, 45, 0)');

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(0, coreY, coreRadius * 2.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = charge > 0 ? '#ffffff' : '#ff6a7d';
        ctx.beginPath();
        ctx.arc(0, coreY, coreRadius, 0, Math.PI * 2);
        ctx.fill();

        if (boss.phase === 2) {
            ctx.strokeStyle = 'rgba(255, 80, 96, 0.85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, coreY, coreRadius + 10 + pulse * 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawShield() {
        if (boss.shieldBroken) return;

        var rx = shieldRadiusX();
        var ry = shieldRadiusY();
        var cy = shieldCenterY();
        var flash = boss.shieldFlash > 0 ? Math.min(1, boss.shieldFlash) : 0;
        var integrity = boss.shieldHp / 10;
        var damageLevel = 10 - boss.shieldHp;
        var fillAlpha = 0.022 + (1 - integrity) * 0.04 + flash * 0.13;
        var lineAlpha = 0.12 + (1 - integrity) * 0.14 + flash * 0.6;

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(boss.x, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 42, 64, ' + fillAlpha + ')';
        ctx.fill();
        ctx.clip();

        drawHoneycomb(boss.x, cy, rx, ry, 'rgba(255, 82, 98, ' + lineAlpha + ')', damageLevel);
        drawShieldCracks(rx, ry, cy, damageLevel);
        ctx.restore();

        ctx.beginPath();
        ctx.ellipse(boss.x, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 82, 98, ' + (0.18 + damageLevel * 0.025 + flash * 0.55) + ')';
        ctx.lineWidth = 2 + flash * 2;
        ctx.stroke();
    }

    function drawShieldCracks(rx, ry, cy, damageLevel) {
        if (damageLevel <= 0) return;

        ctx.strokeStyle = 'rgba(255, 130, 148, ' + (0.18 + damageLevel * 0.035) + ')';
        ctx.lineWidth = 1.5;

        for (var i = 0; i < damageLevel; i++) {
            var angle = i * 2.37 + 0.8;
            var sx = boss.x + Math.cos(angle) * rx * 0.94;
            var sy = cy + Math.sin(angle) * ry * 0.94;
            var mx = boss.x + Math.cos(angle + 0.24) * rx * 0.55;
            var my = cy + Math.sin(angle + 0.24) * ry * 0.55;
            var ex = boss.x + Math.cos(angle - 0.12) * rx * 0.18;
            var ey = cy + Math.sin(angle - 0.12) * ry * 0.18;

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(mx, my);
            ctx.lineTo(ex, ey);
            ctx.stroke();
        }
    }

    function drawHoneycomb(cx, cy, rx, ry, color, damageLevel) {
        var size = 24;
        var stepX = size * 1.5;
        var stepY = Math.sqrt(3) * size;
        var cols = Math.ceil(rx / stepX) + 2;
        var rows = Math.ceil(ry / stepY) + 2;
        var missing = damageLevel || 0;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;

        for (var col = -cols; col <= cols; col++) {
            for (var row = -rows; row <= rows; row++) {
                var hash = Math.abs((col * 37 + row * 91) % 11);
                if (hash < missing) continue;

                var x = cx + col * stepX;
                var y = cy + row * stepY + (col % 2 ? stepY / 2 : 0);
                drawHex(x, y, size);
            }
        }
    }

    function drawHex(x, y, size) {
        ctx.beginPath();
        for (var i = 0; i < 6; i++) {
            var angle = Math.PI / 3 * i;
            var px = x + Math.cos(angle) * size;
            var py = y + Math.sin(angle) * size;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
    }

    function drawPlayer() {
        if (player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0) return;

        ctx.save();
        ctx.translate(player.x, player.y);

        var flame = 10 + Math.random() * 10;
        var flameGradient = ctx.createLinearGradient(0, player.h * 0.35, 0, player.h * 0.35 + flame);
        flameGradient.addColorStop(0, 'rgba(130, 235, 255, 0.95)');
        flameGradient.addColorStop(1, 'rgba(50, 110, 255, 0)');
        ctx.fillStyle = flameGradient;
        ctx.beginPath();
        ctx.moveTo(-7, player.h * 0.32);
        ctx.lineTo(0, player.h * 0.32 + flame);
        ctx.lineTo(7, player.h * 0.32);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = '#6fe6ff';
        ctx.shadowBlur = 18;

        ctx.beginPath();
        ctx.moveTo(0, -player.h / 2);
        ctx.lineTo(player.w / 2, player.h / 3);
        ctx.lineTo(8, player.h / 2);
        ctx.lineTo(0, player.h * 0.34);
        ctx.lineTo(-8, player.h / 2);
        ctx.lineTo(-player.w / 2, player.h / 3);
        ctx.closePath();
        ctx.fillStyle = '#d9f7ff';
        ctx.fill();
        ctx.strokeStyle = '#66d9ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#2b8cff';
        ctx.beginPath();
        ctx.arc(0, -player.h * 0.06, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawPlayerShots() {
        for (var i = 0; i < shots.length; i++) {
            var shot = shots[i];
            ctx.save();
            ctx.shadowBlur = 12;

            if (shot.type === 'torpedo') {
                ctx.shadowColor = '#ffb347';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = shot.w;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(shot.x, shot.y + shot.h / 2);
                ctx.lineTo(shot.x, shot.y - shot.h / 2);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(255, 179, 71, 0.85)';
                ctx.lineWidth = shot.w + 5;
                ctx.globalAlpha = 0.45;
                ctx.beginPath();
                ctx.moveTo(shot.x, shot.y + shot.h / 2);
                ctx.lineTo(shot.x, shot.y - shot.h / 2);
                ctx.stroke();
            } else {
                ctx.shadowColor = '#9fdcff';
                ctx.strokeStyle = '#e8f8ff';
                ctx.lineWidth = shot.w;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(shot.x, shot.y + shot.h / 2);
                ctx.lineTo(shot.x, shot.y - shot.h / 2);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(120, 210, 255, 0.6)';
                ctx.lineWidth = shot.w + 4;
                ctx.beginPath();
                ctx.moveTo(shot.x, shot.y + shot.h / 2);
                ctx.lineTo(shot.x, shot.y - shot.h / 2);
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    function drawEnemyShots() {
        for (var i = 0; i < enemyShots.length; i++) {
            var shot = enemyShots[i];
            var angle = Math.atan2(shot.vy, shot.vx) - Math.PI / 2;

            ctx.save();
            ctx.translate(shot.x, shot.y);
            ctx.rotate(angle);
            ctx.shadowColor = '#ff1e2d';
            ctx.shadowBlur = 14;
            ctx.strokeStyle = '#ff8a9d';
            ctx.lineWidth = shot.w;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, -shot.h / 2);
            ctx.lineTo(0, shot.h / 2);
            ctx.stroke();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -shot.h / 2);
            ctx.lineTo(0, shot.h / 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    function drawMinions() {
        for (var i = 0; i < minions.length; i++) {
            var minion = minions[i];
            ctx.save();
            ctx.translate(minion.x, minion.y);

            if (minion.drop) {
                ctx.shadowColor = '#ffd966';
                ctx.shadowBlur = 20;
                ctx.strokeStyle = 'rgba(255, 217, 102, 0.75)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, minion.w * 0.7, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.shadowColor = '#ff4b5e';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(0, minion.h / 2);
            ctx.lineTo(minion.w / 2, -minion.h / 2);
            ctx.lineTo(0, -minion.h * 0.2);
            ctx.lineTo(-minion.w / 2, -minion.h / 2);
            ctx.closePath();
            ctx.fillStyle = '#5b1830';
            ctx.fill();
            ctx.strokeStyle = '#ff8a9d';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffd0d8';
            ctx.beginPath();
            ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawPickups() {
        for (var i = 0; i < pickups.length; i++) {
            var pickup = pickups[i];
            ctx.save();
            ctx.translate(pickup.x, pickup.y);
            ctx.rotate(pickup.phase);

            ctx.shadowColor = '#7dffcf';
            ctx.shadowBlur = 26;
            ctx.fillStyle = '#7dffcf';
            ctx.beginPath();
            ctx.moveTo(0, -pickup.h / 2);
            ctx.lineTo(pickup.w / 2, 0);
            ctx.lineTo(0, pickup.h / 2);
            ctx.lineTo(-pickup.w / 2, 0);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
            var particle = particles[i];
            ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawBeam() {
        if (boss.beamState === 'idle') return;

        var coreY = boss.y + boss.h * 0.1;

        if (boss.beamState === 'charge') {
            var pulse = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(boss.corePulse * 18));
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 60, 82, ' + pulse + ')';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 8]);
            ctx.beginPath();
            ctx.moveTo(boss.beamX, coreY);
            ctx.lineTo(boss.beamX, H);
            ctx.stroke();
            ctx.restore();
            return;
        }

        var beamWidth = 100;
        var gradient = ctx.createLinearGradient(boss.beamX - beamWidth / 2, 0, boss.beamX + beamWidth / 2, 0);
        gradient.addColorStop(0, 'rgba(255, 30, 45, 0)');
        gradient.addColorStop(0.22, 'rgba(255, 30, 45, 0.75)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.78, 'rgba(255, 30, 45, 0.75)');
        gradient.addColorStop(1, 'rgba(255, 30, 45, 0)');

        ctx.save();
        ctx.fillStyle = gradient;
        ctx.fillRect(boss.beamX - beamWidth / 2, coreY, beamWidth, H - coreY);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(boss.beamX - 7, coreY, 14, H - coreY);
        ctx.restore();
    }

    function drawCanvasMessages() {
        if (shieldNoticeTimer > 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, shieldNoticeTimer);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ff1e2d';
            ctx.shadowBlur = 24;
            ctx.font = '900 22px "Segoe UI", Roboto, sans-serif';
            ctx.fillText('ЩИТ РАЗРУШЕН', W / 2, H * 0.31);
            ctx.restore();
        }

        if (noticeTimer > 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, noticeTimer);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#7dffcf';
            ctx.shadowBlur = 22;
            ctx.font = '900 20px "Segoe UI", Roboto, sans-serif';
            ctx.fillText('ТОРПЕДЫ УЛУЧШЕНЫ', W / 2, H * 0.34);
            ctx.restore();
        }

        if (phaseFlash > 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, phaseFlash);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ff1e2d';
            ctx.shadowBlur = 26;
            ctx.font = '900 26px "Segoe UI", Roboto, sans-serif';
            ctx.fillText('ФИНАЛЬНАЯ СТАДИЯ', W / 2, H * 0.42);
            ctx.restore();
        }
    }

    window.BossChallenge = {
        start: start,
        stop: stop
    };
})();
