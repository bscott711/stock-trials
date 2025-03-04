export class Environment {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.time = 0;
    this.cycleDuration = 10; // One day = 10 seconds
    this.cloudFreeDays = 0//Math.random() > 0.5;
    // Initialize clouds and stars
    this.initializeClouds();
    this.initializeStars();
  }

  initializeStars() {
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
    console.log('initializeClouds')
    this.clouds = [];
    const numClouds = 10;
    const cloudTypes = ['cumulus', 'cirrus', 'stratus'];

    for (let i = 0; i < numClouds; i++) {
      const cloudBase = {
        x: Math.random() * this.canvas.width,
        y: Math.random() * (this.canvas.height / 3) + this.canvas.height / 4,
        maxSize: Math.random() * 50 + 20,
        speed: Math.random() * 0.5 + 0.2,
        opacity: Math.random() * 0.3 + 0.4,
        type: cloudTypes[Math.floor(Math.random() * cloudTypes.length)]
      };

      // Add type-specific properties
      const cloud = this.addCloudTypeProperties(cloudBase);

      // Validate the cloud object
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
          { offsetX: -cloud.maxSize * 0.2, offsetY: 0, radius: cloud.maxSize * 0.4 },
          { offsetX: cloud.maxSize * 0.1, offsetY: -cloud.maxSize * 0.15, radius: cloud.maxSize * 0.35 },
          { offsetX: cloud.maxSize * 0.3, offsetY: cloud.maxSize * 0.1, radius: cloud.maxSize * 0.3 }
        ];
        cloud.opacity *= 0.9;
        cloud.speed *= 0.9;
        cloud.shadow = {
          offsetX: cloud.maxSize * 0.1,
          offsetY: cloud.maxSize * 0.1,
          blur: cloud.maxSize * 0.05,
          opacity: 0.3
        };
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
        break;
    }
    return cloud;
}

validateCloud(cloud) {
    // Ensure all required properties are present
    const requiredProperties = ['x', 'y', 'maxSize', 'speed', 'opacity', 'type'];
    return requiredProperties.every(prop => cloud.hasOwnProperty(prop));
}

  // // Update the drawClouds method to use Perlin noise
  // drawClouds(ctx, time) {
  //   this.clouds.forEach(cloud => {
  //     // Move clouds
  //     cloud.x += cloud.speed * this.windDirection;

  //     // Wrap clouds around screen
  //     if (cloud.x > this.canvas.width + cloud.maxSize) {
  //       cloud.x = -cloud.maxSize;
  //     } else if (cloud.x < -cloud.maxSize) {
  //       cloud.x = this.canvas.width + cloud.maxSize;
  //     }

  //     // Draw cloud based on type
  //     ctx.save();

  //     switch(cloud.type) {
  //       case 'cumulus':
  //         this.drawCumulusCloud(ctx, cloud);
  //         break;
  //       case 'cirrus':
  //         this.drawCirrusCloud(ctx, cloud);
  //         break;
  //       case 'stratus':
  //         this.drawStratusCloud(ctx, cloud);
  //         break;
  //     }

  //     ctx.restore();
  //   });
  // }

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
    if (t >= 0.9 && t < 0.95) {
      skyColor = this.lerpColor(nightColor, predawnColor, (t - 0.9) * 20);
    } else if (t >= 0.95 || t < 0.05) {
      const normalizedT = t >= 0.95 ? (t - 0.95) * 10 : (t + 0.05) * 10;
      skyColor = this.lerpColor(predawnColor, sunriseColor, normalizedT);
    } else if (t >= 0.05 && t < 0.4) {
      skyColor = this.lerpColor(sunriseColor, dayColor, (t - 0.05) * (1 / 0.35));
    } else if (t >= 0.4 && t < 0.7) {
      skyColor = this.lerpColor(dayColor, sunsetColor, (t - 0.4) * (1 / 0.3));
    } else {
      skyColor = this.lerpColor(sunsetColor, nightColor, (t - 0.7) * (1 / 0.2));
    }

    const darkHorizon = { r: 10, g: 10, b: 30 };
    const lightHorizonFactor = { r: -40, g: -20, b: -20 };
    let horizonColor;
    if (t < 0.3) {
      horizonColor = darkHorizon;
    } else if (t >= 0.3 && t < 0.5) {
      const lerpT = (t - 0.3) * 5;
      horizonColor = this.lerpColor(
        darkHorizon,
        {
          r: Math.max(skyColor.r + lightHorizonFactor.r, 0),
          g: Math.max(skyColor.g + lightHorizonFactor.g, 0),
          b: Math.max(skyColor.b + lightHorizonFactor.b, 0),
        },
        lerpT
      );
    } else if (t >= 0.5 && t < 0.7) {
      horizonColor = {
        r: Math.max(skyColor.r + lightHorizonFactor.r, 0),
        g: Math.max(skyColor.g + lightHorizonFactor.g, 0),
        b: Math.max(skyColor.b + lightHorizonFactor.b, 0),
      };
    } else if (t >= 0.7 && t < 0.9) {
      const lerpT = (t - 0.7) * 5;
      horizonColor = this.lerpColor(
        {
          r: Math.max(skyColor.r + lightHorizonFactor.r, 0),
          g: Math.max(skyColor.g + lightHorizonFactor.g, 0),
          b: Math.max(skyColor.b + lightHorizonFactor.b, 0),
        },
        darkHorizon,
        lerpT
      );
    } else {
      horizonColor = darkHorizon;
    }

    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, `rgb(${skyColor.r}, ${skyColor.g}, ${skyColor.b})`);
    gradient.addColorStop(1, `rgb(${horizonColor.r}, ${horizonColor.g}, ${horizonColor.b})`);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawClouds() {
    console.log(this.clouds);
    console.log(this.cloudFreeDays)
    if (this.cloudFreeDays) return;

    const t = (this.time % this.cycleDuration) / this.cycleDuration;
    const cloudPeak = 0.6;
    const cloudRange = 0.3;
    const cloudVisibility = 1 - Math.min(1, Math.abs(t - cloudPeak) / cloudRange);

    if (cloudVisibility > 0) {
      this.clouds.forEach((cloud) => {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.maxSize < 0) cloud.x = this.canvas.width + cloud.maxSize;

        const opacity = cloudVisibility * cloud.opacity;

        switch (cloud.type) {
          case 'cumulus':
            this.drawCumulusCloud(cloud, opacity);
            break;
          case 'cirrus':
            this.drawCirrusCloud(cloud, opacity);
            break;
          case 'stratus':
            this.drawStratusCloud(cloud, opacity);
            break;
          default:
            this.drawCumulusCloud(cloud, opacity);
        }
      });
    }
  }

  drawCumulusCloud(cloud, opacity) {
    this.ctx.save();

    const centerX = cloud.x;
    const centerY = cloud.y;
    const maxSize = cloud.maxSize;

    const baseColor = `rgba(255, 255, 255, ${opacity})`;
    const shadowColor = `rgba(220, 220, 240, ${opacity * 0.7})`;

    // Define noise for variation
    const noise = Math.random() * 0.2;

    this.ctx.beginPath();
    const resolution = 32;
    for (let i = 0; i <= resolution; i++) {
      const angle = (i / resolution) * Math.PI * 2;
      const radius = maxSize * 0.5;

      const variedRadius = radius * (1 + noise);
      const x = centerX + Math.cos(angle) * variedRadius;
      const y = centerY + Math.sin(angle) * variedRadius * 0.6;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.closePath();

    // Draw shadow
    this.ctx.fillStyle = shadowColor;
    this.ctx.fill();

    // Draw main cloud
    this.ctx.translate(5, 5); // Adjust shadow offset
    this.ctx.fillStyle = baseColor;
    this.ctx.fill();

    this.ctx.restore();
  }

  drawCirrusCloud(cloud, opacity) {
    this.ctx.save();

    const centerX = cloud.x;
    const centerY = cloud.y;
    const width = cloud.maxSize * 2;
    const height = cloud.maxSize * 0.4;

    const wisps = cloud.wisps || [
      { offsetY: 0, curve: 0.2, width: 1 },
      { offsetY: height * 0.4, curve: -0.15, width: 0.8 },
      { offsetY: -height * 0.3, curve: 0.1, width: 0.7 }
    ];

    // Define noise for variation
    const noise = Math.random() * 0.2;

    wisps.forEach(wisp => {
      this.ctx.beginPath();
      const segments = 20;

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = centerX - width / 2 + (width * t);

        const y = centerY + wisp.offsetY +
          Math.sin(t * Math.PI) * height * wisp.curve +
          noise * height * 0.3;

        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }

      this.ctx.lineWidth = height * 0.2 * wisp.width;
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.7})`;
      this.ctx.stroke();
    });

    this.ctx.restore();
  }

  drawStratusCloud(cloud, opacity) {
    this.ctx.save();

    const centerX = cloud.x;
    const centerY = cloud.y;
    const width = cloud.maxSize * 2.5;
    const height = cloud.maxSize * 0.6;

    const layers = cloud.layers || [
      { offsetY: 0, width: 1, opacity: 1 },
      { offsetY: height * 0.3, width: 0.85, opacity: 0.8 },
      { offsetY: height * 0.6, width: 0.7, opacity: 0.6 }
    ];

    // Define noise for variation
    const noise = Math.random() * 0.2;

    layers.forEach(layer => {
      const layerWidth = width * layer.width;
      const layerOpacity = opacity * layer.opacity;

      this.ctx.beginPath();
      const segments = 20;

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = centerX - layerWidth / 2 + (layerWidth * t);
        const y = centerY + layer.offsetY - height * 0.25 + noise * height * 0.2;

        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }

      this.ctx.lineTo(centerX + layerWidth / 2, centerY + layer.offsetY + height * 0.25);
      this.ctx.lineTo(centerX - layerWidth / 2, centerY + layer.offsetY + height * 0.25);
      this.ctx.closePath();

      const gradient = this.ctx.createLinearGradient(
        centerX - layerWidth / 2, centerY + layer.offsetY,
        centerX + layerWidth / 2, centerY + layer.offsetY
      );
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
    let starVisibility = 0;
    if (t >= 0.7 && t < 0.75) {
      starVisibility = (t - 0.7) / 0.05;
    } else if (t >= 0.75 && t < 0.95) {
      starVisibility = 1.0;
    } else if (t >= 0.95) {
      starVisibility = 1.0 - (t - 0.95) / 0.05;
      starVisibility = Math.max(0, starVisibility);
    }

    if (starVisibility > 0) {
      this.stars.forEach((star) => {
        if (star.twinkle && Math.random() > 0.95) {
          star.radius = Math.random() * 1.5 + 0.5;
        }
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
    const a = (this.canvas.height - k) / Math.pow(h, 2);
    const y = a * Math.pow(x - h, 2) + k;
    return { x, y };
  }

  calculateMoonPosition(progress) {
    const x = this.canvas.width * progress;
    const h = this.canvas.width / 2;
    const k = 0.4 * this.canvas.height;
    const a = (this.canvas.height - k) / Math.pow(h, 2);
    const y = a * Math.pow(x - h, 2) + k;
    return { x, y };
  }

  drawSun() {
    const t = (this.time % this.cycleDuration) / this.cycleDuration;
    const sunVisible = t >= 0.95 || t < 0.75;

    if (sunVisible) {
      let sunProgress;
      const sunriseT = 0.95;
      const sunsetT = 0.75;
      const sunDuration = (1 - sunriseT) + sunsetT;

      if (t >= 0.95) {
        sunProgress = (t - 0.95) / (1 - 0.95);
        sunProgress *= (1 - sunriseT) / sunDuration;
      } else {
        sunProgress = (t + (1 - sunriseT)) / sunDuration;
      }

      const { x, y } = this.calculateSunPosition(sunProgress);
      const orangeR = 255,
        orangeG = 160,
        orangeB = 60;
      const yellowR = 255,
        yellowG = 255,
        yellowB = 0;

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
        r = yellowR;
        g = yellowG;
        b = yellowB;
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

      let offset;
      if (phase < 0.5) {
        offset = -radius - (2 * (phase - 0.5) * radius);
      } else {
        offset = radius - (2 * (phase - 0.5) * radius);
      }

      this.ctx.beginPath();
      this.ctx.arc(x + offset, y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = "rgba(50, 50, 50, 0.6)";
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  drawMoon() {
    const t = (this.time % this.cycleDuration) / this.cycleDuration;
    const moonVisible = t >= 0.7 && t < 0.95;

    if (moonVisible) {
      const moonProgress = (t - 0.7) / 0.25;
      const { x, y } = this.calculateMoonPosition(moonProgress);
      const moonRadius = 25;

      const currentDay = Math.floor(this.time / this.cycleDuration);
      const acceleratedLunarCycle = 28;
      const moonPhaseProgress = (currentDay % acceleratedLunarCycle) / acceleratedLunarCycle;

      this.drawMoonWithPhase(x, y, moonRadius, moonPhaseProgress);

      this.ctx.save();

      let yellowness;
      if (t <= 0.825) {
        yellowness = 1 - (t - 0.7) / 0.125;
      } else {
        yellowness = (t - 0.825) / 0.125;
      }

      const red = 255;
      const green = 250 + 5 * (1 - yellowness);
      const blue = 230 + 25 * (1 - yellowness);

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
  }

  newDay() {
    this.cloudFreeDays = 0 //Math.random() > 0.5;
    console.log('New day:', this.time);
    console.log(this.cloudFreeDays)
  }

  update() {
    const previousTime = this.time;
    this.time += 0.01;

    if (Math.floor(previousTime / this.cycleDuration) !== Math.floor(this.time / this.cycleDuration)) {
      this.newDay();
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawSky();
    this.drawStars();
    this.drawSun();
    this.drawMoon();
    this.drawClouds();
  }
}