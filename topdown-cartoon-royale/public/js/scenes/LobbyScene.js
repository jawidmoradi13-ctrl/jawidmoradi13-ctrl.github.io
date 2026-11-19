export default class LobbyScene extends Phaser.Scene {
    constructor() {
        super('LobbyScene');
    }

    create() {
        const socket = io();
        this.socket = socket;

        document.getElementById('create-btn').onclick = () => {
            socket.emit('create_room');
        };

        document.getElementById('join-btn').onclick = () => {
            const code = document.getElementById('code-input').value.trim().toUpperCase();
            const name = document.getElementById('name-input').value.trim() || 'Spieler';
            socket.emit('join_room', {code, name});
        };

        socket.on('room:created', (data) => {
            const code = data.code;
            document.getElementById('code-input').value = code;
            const name = document.getElementById('name-input').value.trim() || 'Spieler';
            socket.emit('join_room', {code, name});
        });

        socket.on('joined', (data) => {
            document.getElementById('lobby-ui').innerHTML = '<h1>Lobby</h1><p>Raum: <b>' + data.code + '</b></p><p>Warte auf Start...</p><p class="small">Gleich geht's los</p>';
            this.roomCode = data.code;
            this.startGame();
        });

        socket.on('game:started', () => {
            this.scene.start('GameScene', {socket: this.socket, roomCode: this.roomCode});
        });

        // IP anzeigen
        fetch('/api/ip').then(r=>r.json()).then(d=>{
            document.getElementById('ip').textContent = d.ip;
        }).catch(()=>{});
    }

    startGame() {
        // wird durch server getriggert
    }
}
