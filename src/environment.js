export class Environment {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.time = 0;
    this.cycleDuration = 10; // One day = 2 seconds
    this.cloudFreeDays = Math.random() > 0.5;

    // Clouds array
    this.clouds = [];
    const numClouds = 10;
    for (let i = 0; i < numClouds; i++) {
      this.clouds.push({
        x: Math.random() * canvas.width,
        y: Math.random() * (canvas.height / 3) + canvas.height / 4,
        size: Math.random() * 50 + 20,
        speed: Math.random() * 0.5 + 0.2,
        opacity: Math.random() * 0.3 + 0.4,
      });
    }

    // Stars array
    this.stars = [];
    const numStars = 100;
    for (let i = 0; i < numStars; i++) {
      this.stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5 + 0.5,
        twinkle: Math.random() > 0.8,
        opacity: Math.random() * 0.3 + 0.4,
      });
    }
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
    if (this.cloudFreeDays) return;
    const t = (this.time % this.cycleDuration) / this.cycleDuration;
    const cloudPeak = 0.6;
    const cloudRange = 0.3;
    const cloudVisibility = 1 - Math.min(1, Math.abs(t - cloudPeak) / cloudRange);

    if (cloudVisibility > 0) {
      this.clouds.forEach((cloud) => {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.size < 0) cloud.x = this.canvas.width;
        const opacity = cloudVisibility * cloud.opacity;
        this.ctx.beginPath();
        this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        this.ctx.ellipse(cloud.x, cloud.y, cloud.size, cloud.size / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();
      });
    }
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
    // Save the current context state
    this.ctx.save();
    
    // Draw the base moon (white circle)
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = "rgb(255, 255, 255)"; // Base white
    this.ctx.fill();
    
    // Proper phase sequence:
    // 0.0 = New Moon (fully dark)
    // 0.25 = First Quarter (right half illuminated)
    // 0.5 = Full Moon (fully illuminated)
    // 0.75 = Last Quarter (left half illuminated)
    // 1.0 = New Moon again (fully dark)
    
    // Skip shadow for full moon
    if (phase !== 0.5) {
      // Setup clipping region to only show within the moon circle
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.clip();
      
      // Calculate shadow circle offset
      // For phases 0-0.5 (New to Full): shadow starts at left (covering moon) and moves leftward (revealing right side)
      // For phases 0.5-1 (Full to New): shadow starts at right and moves rightward (covering moon from left to right)
      let offset;
      if (phase < 0.5) {
        // New to Full (0 to 0.5): shadow moves leftward (from 0 to -2*radius)
        offset = (phase * 4 - 1) * -radius;
      } else {
        // Full to New (0.5 to 1): shadow moves rightward (from 2*radius to 0)
        offset = ((1 - phase) * 4 - 1) * radius;
      }
      
      // Draw the shadow circle
      this.ctx.beginPath();
      this.ctx.arc(x + offset, y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = "rgb(50, 50, 50)"; // Shadow color
      this.ctx.fill();
    }
    
    // Restore the context state
    this.ctx.restore();
  }

  drawMoon() {
    const t = (this.time % this.cycleDuration) / this.cycleDuration;
    const moonVisible = t >= 0.7 && t < 0.95;

    if (moonVisible) {
      const moonProgress = (t - 0.7) / 0.25;
      const { x, y } = this.calculateMoonPosition(moonProgress);
      const moonRadius = 25;

      // Calculate Moon phase (sped up for testing with short cycle)
      const currentDay = Math.floor(this.time / this.cycleDuration);
      const lunarCycleDays = 28; // Shortened lunar cycle for testing
      const acceleratedLunarCycle = 28; // Full cycle every 5 days
      const moonPhaseProgress = (currentDay % acceleratedLunarCycle) / acceleratedLunarCycle;

      // Draw the Moon with phase
      this.drawMoonWithPhase(x, y, moonRadius, moonPhaseProgress);

      // Apply color transition using globalCompositeOperation
      this.ctx.save();
      
      // Calculate yellowness for the moon color
      let yellowness;
      if (t <= 0.825) {
        yellowness = 1 - (t - 0.7) / 0.125;
      } else {
        yellowness = (t - 0.825) / 0.125;
      }
      
      // Create moon glow color
      const red = 255;
      const green = 250 + 5 * (1 - yellowness);
      const blue = 230 + 25 * (1 - yellowness);
      
      // Add glow effect
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
      this.ctx.beginPath();
      this.ctx.arc(x, y, moonRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = "transparent";
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      
      // Apply subtle color tint
      this.ctx.globalCompositeOperation = "source-atop";
      this.ctx.beginPath();
      this.ctx.arc(x, y, moonRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(${red}, ${Math.round(green)}, ${Math.round(blue)}, 0.2)`;
      this.ctx.fill();
      
      this.ctx.restore();
    }
  }

  newDay() {
    this.cloudFreeDays = Math.random() > 0.5;
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
    this.drawClouds();
    this.drawSun();
    this.drawMoon();
  }
}