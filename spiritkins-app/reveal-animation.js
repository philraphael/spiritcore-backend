/**
 * reveal-animation.js
 * Handles the canvas-based particle and constellation animation for custom Spiritkin reveal.
 */

class RevealAnimation {
  constructor(canvasId, palette) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.palette = palette;
    this.particles = [];
    this.constellations = [];
    this.animationFrameId = null;

    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas.bind(this));
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start() {
    this.createParticles();
    this.createConstellations();
    this.animate();
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.particles = [];
    this.constellations = [];
  }

  createParticles() {
    const particleCount = 100;
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        radius: Math.random() * 1.5 + 0.5,
        color: this.getRandomPaletteColor(),
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.2
      });
    }
  }

  createConstellations() {
    const constellationCount = 5;
    for (let i = 0; i < constellationCount; i++) {
      const numStars = Math.floor(Math.random() * 5) + 3;
      const stars = [];
      for (let j = 0; j < numStars; j++) {
        stars.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          radius: Math.random() * 1 + 0.5,
          color: this.getRandomPaletteColor(),
          opacity: Math.random() * 0.8 + 0.2
        });
      }
      this.constellations.push({
        stars: stars,
        lineColor: `rgba(255, 255, 255, ${Math.random() * 0.2 + 0.1})`,
        lineWidth: Math.random() * 0.5 + 0.1,
        rotationSpeed: (Math.random() - 0.5) * 0.001
      });
    }
  }

  getRandomPaletteColor() {
    const colors = [this.palette.primary, this.palette.secondary, this.palette.glow, '#FFFFFF'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.updateParticles();
    this.drawParticles();
    this.drawConstellations();
  }

  updateParticles() {
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;
    });
  }

  drawParticles() {
    this.particles.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(${this.hexToRgb(p.color)}, ${p.opacity})`;
      this.ctx.fill();
    });
  }

  drawConstellations() {
    this.constellations.forEach(c => {
      this.ctx.strokeStyle = c.lineColor;
      this.ctx.lineWidth = c.lineWidth;

      for (let i = 0; i < c.stars.length; i++) {
        const star1 = c.stars[i];
        this.ctx.beginPath();
        this.ctx.arc(star1.x, star1.y, star1.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(${this.hexToRgb(star1.color)}, ${star1.opacity})`;
        this.ctx.fill();

        for (let j = i + 1; j < c.stars.length; j++) {
          const star2 = c.stars[j];
          const dist = this.getDistance(star1, star2);
          if (dist < 150) { // Connect stars if they are close enough
            this.ctx.beginPath();
            this.ctx.moveTo(star1.x, star1.y);
            this.ctx.lineTo(star2.x, star2.y);
            this.ctx.stroke();
          }
        }
      }
    });
  }

  getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  hexToRgb(hex) {
    if (!hex) return '255,255,255'; // Default to white if hex is undefined
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RevealAnimation;
}
