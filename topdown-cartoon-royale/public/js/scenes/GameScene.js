export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data) {
        this.socket = data.socket;
        this.roomCode = data.roomCode;
    }

    create() {
        this.world = {w: 1600, h: 1000};
        this.cameras.main.setBounds(0,0,this.world.w,this.world.h);
        this.physics.world.setBounds(0,0,this.world.w,this.world.h);

        // Boden (Cartoon-Gras)
        const grass = this.add.graphics();
        grass.fillStyle(0x7fb96b, 1);
        grass.fillRect(0,0,this.world.w,this.world.h);
        // Wiesenflecken
        for (let i=0;i<40;i++) {
            grass.fillStyle(0x8cc57a, Math.random()*0.4+0.2);
            grass.fillCircle(Math.random()*this.world.w, Math.random()*this.world.h, Math.random()*20+8);
        }

        // Deckung
        this.obstacles = this.physics.add.staticGroup();
        for (let i=0;i<8;i++) {
            const x = 150 + i*180 + Math.random()*60;
            const y = 150 + (i%3)*250;
            const rock = this.add.graphics();
            rock.fillStyle(0xb89a6a, 1);
            rock.fillRoundedRect(-40,-30,80,60, 12);
            rock.fillStyle(0xd7be8a, 1);
            rock.fillRoundedRect(-36,-24,72,30, 10);
            this.obstacles.add(this.add.container(x,y,[rock]));
        }
        for (let i=0;i<5;i++) {
            const x = 250 + i*220;
            const y = 650 + Math.random()*80;
            const box = this.add.graphics();
            box.fillStyle(0x8d6748, 1);
            box.fillRect(-32,-32,64,64);
            box.fillStyle(0xa9845a, 1);
            box.fillRect(-28,-28,56,28);
            this.obstacles.add(this.add.container(x,y,[box]));
        }

        this.players = this.add.group();
        this.bots = this.add.group();
        this.loots = this.add.group();
        this.bullets = this.add.group();

        this.playerId = this.socket.id;
        this.myPlayer = null;

        this.zone = this.add.graphics();
        this.zone.setDepth(100);

        this.hpFill = document.getElementById('hp-fill');
        this.ammoCount = document.getElementById('ammo-count');
        this.killsCount = document.getElementById('kills-count');
        this.zoneStatus = document.getElementById('zone-status');
        this.leaderboard = document.getElementById('leaderboard');
        document.getElementById('hud').style.display = 'block';

        this.cursors = this.input.keyboard.addKeys({up:Phaser.Input.Keyboard.KeyCodes.W, down:Phaser.Input.Keyboard.KeyCodes.S, left:Phaser.Input.Keyboard.KeyCodes.A, right:Phaser.Input.Keyboard.KeyCodes.D, pickup:Phaser.Input.Keyboard.KeyCodes.E});

        this.socket.on('state:update', (state) => this.updateState(state));
        this.socket.on('game:over', (d) => {
            document.getElementById('game-over').style.display = 'flex';
            document.getElementById('winner-text').textContent = d.winner && d.winner.startsWith('bot') ? 'Bot gewinnt' : (d.winner === this.playerId ? 'Du gewinnst!' : (d.winner === 'Niemand' ? 'Unentschieden' : 'Jemand anderes gewinnt'));
        });

        this.lastSend = 0;
    }

    update(time, dt) {
        if (!this.myPlayer || !this.myPlayer.alive) return;
        const speed = 220;
        let vx=0,vy=0;
        if (this.cursors.left.isDown) vx=-1;
        if (this.cursors.right.isDown) vx=1;
        if (this.cursors.up.isDown) vy=-1;
        if (this.cursors.down.isDown) vy=1;
        const len = Math.hypot(vx,vy);
        if (len>0) { vx/=len; vy/=len; }
        this.myPlayerSprite.x += vx*speed*dt/1000;
        this.myPlayerSprite.y += vy*speed*dt/1000;
        this.physics.collide(this.myPlayerSprite, this.obstacles);

        const mx = this.input.mousePointer.worldX;
        const myp = this.input.mousePointer.worldY;
        const angle = Phaser.Math.Angle.Between(this.myPlayerSprite.x, this.myPlayerSprite.y, mx, myp);
        this.myPlayerSprite.angle = angle;

        if (time - this.lastSend > 50) {
            this.socket.emit('input', {code:this.roomCode, x:this.myPlayerSprite.x, y:this.myPlayerSprite.y, angle});
            this.lastSend = time;
        }

        if (this.input.mousePointer.leftButtonDown() && time - this.lastShot > 200) {
            this.lastShot = time;
            const target = null; // einfache Hitscan
            this.socket.emit('shoot', {code:this.roomCode});
            const flash = this.add.circle(this.myPlayerSprite.x + Math.cos(angle)*24, this.myPlayerSprite.y + Math.sin(angle)*24, 6, 0xffe08a);
            this.tweens.add({targets:flash, alpha:0, scale:1.5, duration:80, onComplete:()=>flash.destroy()});
        }

        if (Phaser.Input.Keyboard.JustDown(this.cursors.pickup)) {
            let nearest = null, dmin=9999;
            this.loots.children.entries.forEach(l=>{
                const d = Phaser.Math.Distance.Between(this.myPlayerSprite.x,this.myPlayerSprite.y,l.x,l.y);
                if (d < 50 && d < dmin) { dmin=d; nearest=l; }
            });
            if (nearest) this.socket.emit('pickup', {code:this.roomCode, lootId:nearest.getData('id')});
        }

        this.cameras.main.centerOn(this.myPlayerSprite.x, this.myPlayerSprite.y);
    }

    drawCartoonPlayer(x,y,angle,alive,weapon) {
        const c = this.add.container(x,y);
        c.angle = Phaser.Math.RadToDeg(angle)+90;
        const body = this.add.graphics();
        body.fillStyle(0x4fa3e3, 1);
        body.fillRoundedRect(-16,-20,32,40, 10);
        body.fillStyle(0x7fc7ff, 1);
        body.fillRoundedRect(-12,-16,24,20, 8);
        const head = this.add.graphics();
        head.fillStyle(0xf2d7b6, 1);
        head.fillCircle(0,-14,12);
        head.fillStyle(0x8d6748, 1);
        head.fillEllipse(0,-10,16,6);
        const gun = this.add.graphics();
        gun.fillStyle(0x666666, 1);
        gun.fillRect(8,-6,20,6);
        gun.fillRect(14,-10,10,6);
        if (!alive) { c.setAlpha(0.4); }
        c.add([body,head,gun]);
        return c;
    }

    updateState(state) {
        this.players.clear(true,true);
        this.bots.clear(true,true);
        this.loots.clear(true,true);

        Object.values(state.players).forEach(p=>{
            const spr = this.drawCartoonPlayer(p.x,p.y,p.angle,p.alive,p.weapon);
            spr.setDepth(10);
            this.players.add(spr);
            if (p.id === this.playerId) {
                this.myPlayer = p;
                this.myPlayerSprite = spr;
            }
        });

        (state.bots||[]).forEach(b=>{
            if (!b.alive) return;
            const spr = this.drawCartoonPlayer(b.x,b.y,b.angle,true,'smg');
            spr.setTint(0x9fcf7a);
            spr.setDepth(9);
            this.bots.add(spr);
        });

        (state.loots||[]).forEach(l=>{
            const g = this.add.graphics();
            if (l.type==='smg') g.fillStyle(0x5a9bd3,1);
            else if (l.type==='rifle') g.fillStyle(0x7ac77a,1);
            else g.fillStyle(0xf2d77b,1);
            g.fillRoundedRect(-14,-14,28,28,6);
            g.lineStyle(3,0xffffff,0.4).strokeRoundedRect(-14,-14,28,28,6);
            const t = this.add.text(0,0,l.type==='ammo'?'M':(l.type==='smg'?'SMG':'AR'), {fontSize:'10px',fontWeight:'700',color:'#111'}).setOrigin(0.5);
            const c = this.add.container(l.x,l.y,[g,t]);
            c.setData('id', l.id);
            this.loots.add(c);
        });

        if (this.myPlayer) {
            this.hpFill.style.width = (this.myPlayer.hp/this.myPlayer.maxHp*100)+'%';
            this.ammoCount.textContent = this.myPlayer.ammo + '/' + this.myPlayer.maxAmmo;
            this.killsCount.textContent = this.myPlayer.kills;
        }

        // Zone
        this.zone.clear();
        if (state.zone && state.zone.active) {
            this.zone.lineStyle(6, 0xe85c5c, 0.9);
            this.zone.strokeCircle(state.zone.x, state.zone.y, state.zone.r);
            this.zone.lineStyle(2, 0xffa3a3, 0.4);
            this.zone.strokeCircle(state.zone.x, state.zone.y, state.zone.r+10);
            this.zoneStatus.textContent = 'Schrumpft';
        } else {
            this.zoneStatus.textContent = 'Wartet...';
        }

        // Leaderboard
        let lb = '<b>Leaderboard</b>';
        const all = Object.values(state.players).concat((state.bots||[]).map(b=>({...b,name:'Bot'})));
        all.sort((a,b)=>(b.kills-a.kills));
        all.slice(0,6).forEach(e=>{
            if (e.alive || state.game_over) lb += '<div>' + (e.name||'Bot') + ': ' + (e.kills||0) + '</div>';
        });
        this.leaderboard.innerHTML = lb;
    }
}
