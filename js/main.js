import { Day1Scene }    from './scenes/Day1Scene.js';
import { SummaryScene } from './scenes/SummaryScene.js';

const TILE_SIZE = 48;

function getGameDimensions() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  return {
    width: w,
    height: h,
  };
}

const dims = getGameDimensions();

const config = {
  type: Phaser.AUTO,
  width:  dims.width,
  height: dims.height,
  backgroundColor: '#060810',
  scene: [Day1Scene, SummaryScene],
  parent: document.getElementById('game-wrapper'),
  pixelArt: false,
  antialias: true,
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  const newDims = getGameDimensions();
  game.scale.resize(newDims.width, newDims.height);
  game.scene.scenes.forEach(scene => {
    if (scene.onWindowResize) {
      scene.onWindowResize(newDims);
    }
  });
});
