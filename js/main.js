import { Day1Scene }    from './scenes/Day1Scene.js';
import { SummaryScene } from './scenes/SummaryScene.js';

const config = {
  type: Phaser.AUTO,
  width:  1056,
  height: 768,
  backgroundColor: '#060810',
  scene: [Day1Scene, SummaryScene],
  parent: document.getElementById('game-wrapper'),
  pixelArt: false,
  antialias: true,
};

new Phaser.Game(config);
