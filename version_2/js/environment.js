import { TerrainAddons } from './terrainAddons.js';
export class Environment {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.time = 0;
    this.cycleDuration = 120; // One day = 10 seconds
    this.cloudFreeDays = 0; //Math.random() > 0.5
    this.PIXELS_PER_DAY = 200; // Define the constant here, matching game.js
    this.moonPhaseOffset = Math.floor(Math.random() * 28); // Random offset: 0-27 days

    // Synchronous initializations
    this.path = []; // Initialize path as empty until initializeGround is called
    this.initializeClouds();
    this.initializeStars();
    this.addons = null; // Initialize as null; set after ground is ready
  }

  // Asynchronous ground initialization (call this separately)
  async initializeGround() {
    this.path = [];
    try {
      const response = await fetch('https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=AAPL&apikey=98QKC7GE5OJVUCOE');
      const data = await response.json();
      if (!data['Time Series (Daily)']) throw new Error('Invalid API response');

      const timeSeries = data['Time Series (Daily)'];
      const dates = Object.keys(timeSeries).sort();
      const prices = dates.map(date => parseFloat(timeSeries[date]['4. close']));
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      // Normalize and map base stock data
      const basePath = prices.map((price, i) => [
        i * this.PIXELS_PER_DAY,
        this.canvas.height - ((price - minPrice) / (maxPrice - minPrice)) * 300
      ]);

      // Extend path by repeating with variation
      const repeats = 10; // Extend to ~1000 days (200,000px, ~1000s at 200px/s)
      const baseLength = basePath.length;
      for (let r = 0; r < repeats; r++) {
        const offsetX = baseLength * r * this.PIXELS_PER_DAY;
        basePath.forEach(([x, y], i) => {
          // Add variation: flip every other repeat, add slight noise
          const variedY = (r % 2 === 0)
            ? y + (Math.random() - 0.5) * 50 // Noise: ±25px
            : this.canvas.height - (y - this.canvas.height) + (Math.random() - 0.5) * 50; // Flip + noise
          this.path.push([offsetX + x, variedY]);
        });
      }

    } catch (error) {
      console.error('Error fetching stock data:', error);
      this.generateSamplePath(); // Fallback to procedural if fetch fails
    }

    // Initialize addons after path is set
    this.addons = new TerrainAddons(this.getPathY.bind(this));
    this.addons.initializeAddons();
  }

  generateSamplePath() {
    // Generate a longer procedural path (e.g., 1000 points = 200,000px)
    this.path = Array.from({ length: 1000 }, (_, i) => [
      i * this.PIXELS_PER_DAY,
      this.canvas.height - Math.random() * 300
    ]);

    // Smooth the procedural path to avoid abrupt jumps
    for (let i = 1; i < this.path.length - 1; i++) {
      const [prevX, prevY] = this.path[i - 1];
      const [currX, currY] = this.path[i];
      const [nextX, nextY] = this.path[i + 1];
      this.path[i][1] = (prevY + currY + nextY) / 3; // Simple averaging for smoothness
    }
  }

  getPathY(worldX) {
    const index = Math.floor(worldX / this.PIXELS_PER_DAY);
    if (index < 0 || this.path.length === 0) {
      return this.canvas.height / 2; // Before start or no path
    }
    if (index >= this.path.length - 1) {
      // Extend procedurally if beyond path
      const lastIndex = this.path.length - 1;
      const [lastX, lastY] = this.path[lastIndex];
      const [prevX, prevY] = this.path[lastIndex - 1];
      const slope = (lastY - prevY) / (lastX - prevX);
      const extraX = worldX - lastX;
      return lastY + slope * extraX + (Math.random() - 0.5) * 50; // Continue slope with noise
    }
    const [x1, y1] = this.path[index];
    const [x2, y2] = this.path[index + 1];
    const t = (worldX - x1) / (x2 - x1);
    return y1 + t * (y2 - y1);
  }

  getPathSlope(worldX) {
    const index = Math.floor(worldX / this.PIXELS_PER_DAY);
    if (index < 0 || this.path.length === 0) {
      return 0; // Before start or no path
    }
    if (index >= this.path.length - 1) {
      // Use last segment’s slope if beyond path
      const lastIndex = this.path.length - 1;
      const [x1, y1] = this.path[lastIndex - 1];
      const [x2, y2] = this.path[lastIndex];
      return (y2 - y1) / (x2 - x1);
    }
    const [x1, y1] = this.path[index];
    const [x2, y2] = this.path[index + 1];
    return (y2 - y1) / (x2 - x1);
  }

  drawGround(bikeX) {
    if (this.path.length === 0) return;

    const startX = bikeX - this.canvas.width / 2;
    const endX = bikeX + this.canvas.width / 2;
    let startIndex = Math.max(0, Math.floor(startX / this.PIXELS_PER_DAY));
    let endIndex = Math.min(this.path.length - 1, Math.ceil(endX / this.PIXELS_PER_DAY));

    // Extend drawing beyond path if needed
    const extendedPath = [];
    for (let i = startIndex; i <= endIndex || i * this.PIXELS_PER_DAY <= endX; i++) {
      const wx = i * this.PIXELS_PER_DAY;
      if (i < this.path.length) {
        extendedPath.push(this.path[i]);
      } else {
        const y = this.getPathY(wx);
        extendedPath.push([wx, y]);
      }
    }

    // Draw grass below the path
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.canvas.height);
    extendedPath.forEach(([wx, wy]) => {
      this.ctx.lineTo(wx - startX, wy);
    });
    this.ctx.lineTo(this.canvas.width, this.canvas.height);
    this.ctx.closePath();
    this.ctx.fillStyle = '#32CD32';
    this.ctx.fill();

    // Draw path (ground line)
    this.ctx.beginPath();
    for (let i = 0; i < extendedPath.length - 1; i++) {
      const [wx1, wy1] = extendedPath[i];
      const [wx2, wy2] = extendedPath[i + 1];
      this.ctx.moveTo(wx1 - startX, wy1);
      this.ctx.lineTo(wx2 - startX, wy2);
    }
    this.ctx.strokeStyle = 'black';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  initializeStars() {
    console.log('Canvas dimensions in initializeStars:', this.canvas.width, this.canvas.height);
    this.stars = [];
    const numStars = 100;
    for (let i = 0; i < numStars; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        radius: Math.random() * 1.5 + 0.5,
        twinkle: Math.random() > 0.8,
        opacity: Math.random() * 0.3 + 0.4,
      });
    }
  }

  initializeClouds() {
    this.clouds = [];
    const numClouds = 10;

    const cloudTypes = ['cumulus', 'cirrus', 'stratus'];
    const weights = [0.4, 0.3, 0.3];

    function getWeightedRandomCloudType(cloudTypes, weights) {
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      const random = Math.random() * totalWeight;
      let cumulativeWeight = 0;
      for (let i = 0; i < weights.length; i++) {
        cumulativeWeight += weights[i];
        if (random < cumulativeWeight) return cloudTypes[i];
      }
      return cloudTypes[cloudTypes.length - 1];
    }

    for (let i = 0; i < numClouds; i++) {
      const cloudBase = {
        x: Math.random() * this.canvas.width,
        y: Math.random() * (this.canvas.height / 3) + this.canvas.height / 4,
        maxSize: Math.random() * 50 + 20,
        speed: Math.random() * 0.5 + 0.2,
        opacity: Math.random() * 0.3 + 0.4,
        type: getWeightedRandomCloudType(cloudTypes, weights)
      };

      const cloud = this.addCloudTypeProperties(cloudBase);
      if (!this.validateCloud(cloud)) {
        console.warn('Invalid cloud object:', cloud);
        continue;
      }
      this.clouds.push(cloud);
    }
  }

  addCloudTypeProperties(cloud) {
    switch (cloud.type) {
      case 'cumulus':
        cloud.y += this.canvas.height / 16;
        cloud.puffs = [
          { offsetX: -cloud.maxSize * 0.2, offsetY: -cloud.maxSize * 0.15, radiusX: cloud.maxSize * 0.8, radiusY: cloud.maxSize * 0.5, rotation: Math.random() * 0.2 - 0.1 },
          { offsetX: cloud.maxSize * 0.1, offsetY: -cloud.maxSize * 0.1, radiusX: cloud.maxSize * 0.7, radiusY: cloud.maxSize * 0.4, rotation: Math.random() * 0.2 - 0.1 },
          { offsetX: cloud.maxSize * 0.3, offsetY: cloud.maxSize * 0.1, radiusX: cloud.maxSize * 0.6, radiusY: cloud.maxSize * 0.35, rotation: Math.random() * 0.2 - 0.1 }
        ];
        cloud.opacity *= 0.9;
        cloud.speed *= 0.8;
        cloud.shadow = { offsetX: cloud.maxSize * 0.15, offsetY: cloud.maxSize * 0.15, blur: cloud.maxSize * 0.15, opacity: 0.3 };
        break;
      case 'cirrus':
        cloud.y -= this.canvas.height / 8;
        cloud.wisps = [
          { offsetY: 0, curve: 0.2, width: 1 },
          { offsetY: cloud.maxSize * 0.4, curve: -0.15, width: 0.8 },
          { offsetY: -cloud.maxSize * 0.3, curve: 0.1, width: 0.7 }
        ];
        cloud.opacity *= 0.8;
        cloud.speed *= 0.7;
        break;
      case 'stratus':
        cloud.y += this.canvas.height / 12;
        cloud.layers = [
          { offsetY: 0, width: 1, opacity: 1 },
          { offsetY: cloud.maxSize * 0.3, width: 0.85, opacity: 0.8 },
          { offsetY: cloud.maxSize * 0.6, width: 0.7, opacity: 0.6 }
        ];
        cloud.speed *= 0.8;
        break;
      default:
        console.warn(`Unknown cloud type: ${cloud.type}`);
    }
    return cloud;
  }

  validateCloud(cloud) {
    const requiredProperties = ['x', 'y', 'maxSize', 'speed', 'opacity', 'type'];
    return requiredProperties.every(prop => cloud.hasOwnProperty(prop));
  }

  lerpColor(color1, color2, t) {
    return {
      r: Math.floor(color1.r + (color2.r - color1.r) * t),
      g: Math.floor(color1.g + (color2.g - color1.g) * t),
      b: Math.floor(color1.b + (color2.b - color1.b) * t),
    };
  }

  drawSky() {
    const t = (this.time % this.cycleDuration) / this.cycleDuration;
    const predawnColor = { r: 40, g: 40, b: 80 };
    const sunriseColor = { r: 255, g: 180, b: 50 };
    const dayColor = { r: 135, g: 206, b: 235 };
    const sunsetColor = { r: 255, g: 100, b: 80 };
    const nightColor = { r: 20, g: 20, b: 60 };

    let skyColor;
    if (t >= 0.9 && t < 0.95) skyColor = this.lerpColor(nightColor, predawnColor, (t - 0.9) * 20);
    else if (t >= 0.95 || t < 0.05) {
      const normalizedT = t >= 0.95 ? (t - 0.95) * 10 : (t + 0.05) * 10;
      skyColor = this.lerpColor(predawnColor, sunriseColor, normalizedT);
    } else if (t >= 0.05 && t < 0.4) skyColor = this.lerpColor(sunriseColor, dayColor, (t - 0.05) / 0.35);
    else if (t >= 0.4 && t < 0.7) skyColor = this.lerpColor(dayColor, sunsetColor, (t - 0.4) / 0.3);
    else skyColor = this.lerpColor(sunsetColor, nightColor, (t - 0.7) / 0.2);

    const darkHorizon = { r: 10, g: 10, b: 30 };
    const lightHorizonFactor = { r: -40, g: -20, b: -20 };
    let horizonColor;
    if (t < 0.3) horizonColor = darkHorizon;
    else if (t >= 0.3 && t < 0.5) horizonColor = this.lerpColor(darkHorizon, { r: Math.max(skyColor.r + lightHorizonFactor.r, 0), g: Math.max(skyColor.g + lightHorizonFactor.g, 0), b: Math.max(skyColor.b + lightHorizonFactor.b, 0) }, (t - 0.3) * 5);
    else if (t >= 0.5 && t < 0.7) horizonColor = { r: Math.max(skyColor.r + lightHorizonFactor.r, 0), g: Math.max(skyColor.g + lightHorizonFactor.g, 0), b: Math.max(skyColor.b + lightHorizonFactor.b, 0) };
    else if (t >= 0.7 && t < 0.9) horizonColor = this.lerpColor({ r: Math.max(skyColor.r + lightHorizonFactor.r, 0), g: Math.max(skyColor.g + lightHorizonFactor.g, 0), b: Math.max(skyColor.b + lightHorizonFactor.b, 0) }, darkHorizon, (t - 0.7) * 5);
    else horizonColor = darkHorizon;

    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, `rgb(${skyColor.r}, ${skyColor.g}, ${skyColor.b})`);
    gradient.addColorStop(1, `rgb(${horizonColor.r}, ${horizonColor.g}, ${horizonColor.b})`);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawClouds() {
    if (this.cloudFreeDays) return;

    const t = (this.time % this.cycleDuration) / this.cycleDuration;
    const cloudPeak = 0.6;
    const cloudRange = 0.3;
    const cloudVisibility = 1 - Math.min(1, Math.abs(t - cloudPeak) / cloudRange);

    if (cloudVisibility > 0) {
      this.clouds.forEach(cloud => {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.maxSize < 0) cloud.x = this.canvas.width + cloud.maxSize;

        const opacity = cloudVisibility * cloud.opacity;
        switch (cloud.type) {
          case 'cumulus': this.drawCumulusCloud(cloud, opacity); break;
          case 'cirrus': this.drawCirrusCloud(cloud, opacity); break;
          case 'stratus': this.drawStratusCloud(cloud, opacity); break;
          default: this.drawCumulusCloud(cloud, opacity);
        }
      });
    }
  }

  drawCumulusCloud(cloud, opacity) {
    this.ctx.save();
    const centerX = cloud.x, centerY = cloud.y, maxSize = cloud.maxSize;
    if (!cloud.noiseOffset) cloud.noiseOffset = Math.random() * 0.2;
    const baseColor = `rgba(255, 255, 255, ${opacity})`, shadowColor = `rgba(220, 220, 240, ${opacity * 0.7})`;

    this.ctx.beginPath();
    this.ctx.ellipse(centerX + cloud.shadow.offsetX, centerY + cloud.shadow.offsetY, maxSize * 0.5, maxSize * 0.3, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = shadowColor;
    this.ctx.fill();

    cloud.puffs.forEach(puff => {
      this.ctx.beginPath();
      this.ctx.ellipse(centerX + puff.offsetX, centerY + puff.offsetY, puff.radiusX, puff.radiusY, puff.rotation, 0, Math.PI * 2);
      this.ctx.fillStyle = baseColor;
      this.ctx.fill();
    });
    this.ctx.restore();
  }

  drawCirrusCloud(cloud, opacity) {
    this.ctx.save();
    const centerX = cloud.x, centerY = cloud.y, width = cloud.maxSize * 2, height = cloud.maxSize * 0.4;
    if (!cloud.noiseOffset) cloud.noiseOffset = Math.random() * 0.2;
    const noise = cloud.noiseOffset;

    cloud.wisps.forEach(wisp => {
      this.ctx.beginPath();
      const segments = 20;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = centerX - width / 2 + (width * t);
        const y = centerY + wisp.offsetY + Math.sin(t * Math.PI) * height * wisp.curve + noise * height * 0.3;
        i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
      }
      this.ctx.lineWidth = height * 0.2 * wisp.width;
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.7})`;
      this.ctx.stroke();
    });
    this.ctx.restore();
  }

  drawStratusCloud(cloud, opacity) {
    this.ctx.save();
    const centerX = cloud.x, centerY = cloud.y, width = cloud.maxSize * 2.5, height = cloud.maxSize * 0.6;
    if (!cloud.noiseOffset) cloud.noiseOffset = Math.random() * 0.05;
    const noise = cloud.noiseOffset;

    cloud.layers.forEach(layer => {
      const layerWidth = width * layer.width, layerOpacity = opacity * layer.opacity;
      this.ctx.beginPath();
      const segments = 20;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = centerX - layerWidth / 2 + (layerWidth * t);
        const y = centerY + layer.offsetY - height * 0.25 + noise * height * 0.2;
        i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
      }
      this.ctx.lineTo(centerX + layerWidth / 2, centerY + layer.offsetY + height * 0.25);
      this.ctx.lineTo(centerX - layerWidth / 2, centerY + layer.offsetY + height * 0.25);
      this.ctx.closePath();

      const gradient = this.ctx.createLinearGradient(centerX - layerWidth / 2, centerY + layer.offsetY, centerX + layerWidth / 2, centerY + layer.offsetY);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${layerOpacity * 0.4})`);
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${layerOpacity})`);
      gradient.addColorStop(1, `rgba(255, 255, 255, ${layerOpacity * 0.4})`);
      this.ctx.fillStyle = gradient;
      this.ctx.fill();
    });
    this.ctx.restore();
  }

  roundRect(x, y, width, height, radius, fillStyle) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
    this.ctx.fillStyle = fillStyle;
    this.ctx.fill();
  }

  drawStars() {
    const t = (this.time % this.cycleDuration) / this.cycleDuration;
    let starVisibility = t >= 0.7 && t < 0.75 ? (t - 0.7) / 0.05 : t >= 0.75 && t < 0.95 ? 1.0 : t >= 0.95 ? Math.max(0, 1.0 - (t - 0.95) / 0.05) : 0;

    if (starVisibility > 0) {
      this.stars.forEach(star => {
        if (star.twinkle && Math.random() > 0.95) star.radius = Math.random() * 1.5 + 0.5;
        const opacity = starVisibility * star.opacity;
        this.ctx.beginPath();
        this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        this.ctx.fill();
      });
    }
  }

  calculateSunPosition(progress) {
    const x = this.canvas.width * progress;
    const h = this.canvas.width / 2;
    const k = 0.1 * this.canvas.height;
    const a = (this.canvas.height - k) / (h * h);
    const y = a * (x - h) * (x - h) + k;
    return { x, y };
  }

  calculateMoonPosition(progress) {
    const x = this.canvas.width * progress;
    const h = this.canvas.width / 2;
    const k = 0.4 * this.canvas.height;
    const a = (this.canvas.height - k) / (h * h);
    const y = a * (x - h) * (x - h) + k;
    return { x, y };
  }

  drawSun() {
    const t = (this.time % this.cycleDuration) / this.cycleDuration;
    if (!(t >= 0.95 || t < 0.75)) return;

    let sunProgress = t >= 0.95 ? ((t - 0.95) / 0.05) * 0.25 : (t + 0.25) / 1;
    const { x, y } = this.calculateSunPosition(sunProgress);

    const orangeR = 255, orangeG = 160, orangeB = 60;
    const yellowR = 255, yellowG = 255, yellowB = 0;
    let r, g, b;
    if (t >= 0.95 || t < 0.05) {
      const dawnT = t >= 0.95 ? (t - 0.95) / 0.1 : (t + 0.05) / 0.1;
      r = orangeR;
      g = orangeG + (yellowG - orangeG) * dawnT;
      b = orangeB + (yellowB - orangeB) * dawnT;
    } else if (t >= 0.65 && t < 0.75) {
      const duskT = (t - 0.65) / 0.1;
      r = yellowR;
      g = yellowG - (yellowG - orangeG) * duskT;
      b = yellowB - (yellowB - orangeB) * duskT;
    } else {
      r = yellowR; g = yellowG; b = yellowB;
    }

    const sunColor = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    const sunRadius = 30;

    this.ctx.beginPath();
    this.ctx.arc(x, y, sunRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = sunColor;
    this.ctx.fill();

    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b / 2)}, 0.5)`;
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
  }

  drawMoonWithPhase(x, y, radius, phase) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = "rgb(255, 255, 255)";
    this.ctx.fill();

    if (phase === 0 || phase === 1) {
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = "rgba(50, 50, 50, 1)";
      this.ctx.fill();
    } else if (phase !== 0.5) {
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.clip();
      const offset = phase < 0.5 ? -radius - (2 * (phase - 0.5) * radius) : radius - (2 * (phase - 0.5) * radius);
      this.ctx.beginPath();
      this.ctx.arc(x + offset, y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = "rgba(50, 50, 50, 0.6)";
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawMoon() {
    const t = (this.time % this.cycleDuration) / this.cycleDuration;
    if (!(t >= 0.7 && t < 0.95)) return;

    const moonProgress = (t - 0.7) / 0.25;
    const { x, y } = this.calculateMoonPosition(moonProgress);
    const moonRadius = 25;

    const currentDay = Math.floor(this.time / this.cycleDuration);
    const acceleratedLunarCycle = 28;
    const moonPhaseProgress = ((currentDay + this.moonPhaseOffset) % acceleratedLunarCycle) / acceleratedLunarCycle;

    this.drawMoonWithPhase(x, y, moonRadius, moonPhaseProgress);

    this.ctx.save();
    const yellowness = t <= 0.825 ? 1 - (t - 0.7) / 0.125 : (t - 0.825) / 0.125;
    const red = 255, green = 250 + 5 * (1 - yellowness), blue = 230 + 25 * (1 - yellowness);

    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
    this.ctx.beginPath();
    this.ctx.arc(x, y, moonRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = "transparent";
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    this.ctx.globalCompositeOperation = "source-atop";
    this.ctx.beginPath();
    this.ctx.arc(x, y, moonRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = `rgba(${red}, ${Math.round(green)}, ${Math.round(blue)}, 0.2)`;
    this.ctx.fill();
    this.ctx.restore();
  }

  newDay() {
    this.cloudFreeDays = 0; //Math.random() > 0.5
  }

  update(bikeX = 0) {
    const previousTime = this.time;
    this.time += 0.01;

    if (Math.floor(previousTime / this.cycleDuration) !== Math.floor(this.time / this.cycleDuration)) {
      this.newDay();
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawSky();
    this.drawSun();
    this.drawMoon();
    this.drawClouds();
    this.addons.draw(this.ctx, bikeX); // Add rocks, trees, mountain, beach after ground
    this.drawStars();
    this.drawGround(bikeX);

  }
}