import LobbyScene from './scenes/LobbyScene.js';
import GameScene from './scenes/GameScene.js';

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    backgroundColor: '#7fb96b',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: [LobbyScene, GameScene]
};

window.game = new Phaser.Game(config);
