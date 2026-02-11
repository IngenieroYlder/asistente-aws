const sharp = require('sharp');
console.log('Sharp version:', sharp.versions);
sharp({
  create: {
    width: 10,
    height: 10,
    channels: 4,
    background: { r: 255, g: 0, b: 0, alpha: 0.5 }
  }
}).png().toBuffer()
  .then(() => console.log('Sharp is working correctly!'))
  .catch(err => console.error('Sharp test failed:', err));
