export class Environment {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.time = 0; // Tracks progress through the day-night cycle
      this.cycleDuration = 60; // Duration of one full cycle in seconds
      this.cloudFreeDays = Math.random() > 0.5; // 50% chance of cloud-free days
  
      // Clouds array
      this.clouds = [];
      const numClouds = 10; // Number of clouds
      for (let i = 0; i < numClouds; i++) {
        this.clouds.push({
          x: Math.random() * canvas.width,
          y: Math.random() * (canvas.height / 3) + canvas.height / 4, // Clouds in middle third
          size: Math.random() * 50 + 20, // Random size between 20 and 70
          speed: Math.random() * 0.5 + 0.2, // Random speed
          opacity: Math.random() * 0.3 + 0.4 // Gradual appearance/disappearance
        });
      }
  
      // Stars array
      this.stars = [];
      const numStars = 100; // Number of stars
      for (let i = 0; i < numStars; i++) {
        this.stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 1.5 + 0.5, // Small stars
          twinkle: Math.random() > 0.8, // 20% chance to twinkle
          opacity: Math.random() * 0.3 + 0.4 // Gradual appearance/disappearance
        });
      }
    }
  
    // Function to interpolate between two colors
    lerpColor(color1, color2, t) {
      return {
        r: Math.floor(color1.r + (color2.r - color1.r) * t),
        g: Math.floor(color1.g + (color2.g - color1.g) * t),
        b: Math.floor(color1.b + (color2.b - color1.b) * t)
      };
    }
  
    drawSky() {
      const t = (this.time % this.cycleDuration) / this.cycleDuration; // Normalize time to [0, 1]
    
      // Pre-dawn: Deep blue to purple
      const predawnColor = { r: 40, g: 40, b: 80 };
      // Sunrise: Purple to orange-gold
      const sunriseColor = { r: 255, g: 180, b: 50 };
      // Day: Light blue
      const dayColor = { r: 135, g: 206, b: 235 };
      // Sunset: Orange-pink
      const sunsetColor = { r: 255, g: 100, b: 80 };
      // Night: Deep blue
      const nightColor = { r: 20, g: 20, b: 60 };
    
      let skyColor;
      // Pre-dawn: 0.9 - 0.95
      if (t >= 0.9 && t < 0.95) {
        skyColor = this.lerpColor(nightColor, predawnColor, (t - 0.9) * 20); // 0-1 over 5% of cycle
      }
      // Sunrise: 0.95 - 0.05
      else if (t >= 0.95 || t < 0.05) {
        const normalizedT = t >= 0.95 ? (t - 0.95) * 10 : (t + 0.05) * 10; // 0-1 over 10% of cycle
        skyColor = this.lerpColor(predawnColor, sunriseColor, normalizedT);
      }
      // Morning to Midday: 0.05 - 0.4
      else if (t >= 0.05 && t < 0.4) {
        skyColor = this.lerpColor(sunriseColor, dayColor, (t - 0.05) * (1/0.35));
      }
      // Midday to Late afternoon: 0.4 - 0.7
      else if (t >= 0.4 && t < 0.7) {
        skyColor = this.lerpColor(dayColor, sunsetColor, (t - 0.4) * (1/0.3));
      }
      // Sunset to Night: 0.7 - 0.9
      else {
        skyColor = this.lerpColor(sunsetColor, nightColor, (t - 0.7) * (1/0.2));
      }
    
      // Define horizon colors
      const darkHorizon = { r: 10, g: 10, b: 30 }; // Night/dawn/dusk horizon
      const lightHorizonFactor = { r: -40, g: -20, b: -20 }; // Day horizon offset from sky color
    
      // Smoothly interpolate horizon color
      let horizonColor;
      if (t < 0.3) {
        // Night to dawn (0.0 - 0.3): Stay at dark horizon
        horizonColor = darkHorizon;
      } else if (t >= 0.3 && t < 0.5) {
        // Dawn to day (0.3 - 0.5): Transition from dark to light horizon
        const lerpT = (t - 0.3) * 5; // 0-1 over 0.2 of cycle
        horizonColor = this.lerpColor(
          darkHorizon,
          {
            r: Math.max(skyColor.r + lightHorizonFactor.r, 0),
            g: Math.max(skyColor.g + lightHorizonFactor.g, 0),
            b: Math.max(skyColor.b + lightHorizonFactor.b, 0)
          },
          lerpT
        );
      } else if (t >= 0.5 && t < 0.7) {
        // Day (0.5 - 0.7): Stay at light horizon
        horizonColor = {
          r: Math.max(skyColor.r + lightHorizonFactor.r, 0),
          g: Math.max(skyColor.g + lightHorizonFactor.g, 0),
          b: Math.max(skyColor.b + lightHorizonFactor.b, 0)
        };
      } else if (t >= 0.7 && t < 0.9) {
        // Dusk (0.7 - 0.9): Transition from light to dark horizon
        const lerpT = (t - 0.7) * 5; // 0-1 over 0.2 of cycle
        horizonColor = this.lerpColor(
          {
            r: Math.max(skyColor.r + lightHorizonFactor.r, 0),
            g: Math.max(skyColor.g + lightHorizonFactor.g, 0),
            b: Math.max(skyColor.b + lightHorizonFactor.b, 0)
          },
          darkHorizon,
          lerpT
        );
      } else {
        // Night (0.9 - 1.0): Stay at dark horizon
        horizonColor = darkHorizon;
      }
    
      // Create a linear gradient
      const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      gradient.addColorStop(0, `rgb(${skyColor.r}, ${skyColor.g}, ${skyColor.b})`);
      gradient.addColorStop(1, `rgb(${horizonColor.r}, ${horizonColor.g}, ${horizonColor.b})`);
    
      // Draw the gradient
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  
    // Function to draw clouds
    drawClouds() {
      if (this.cloudFreeDays) return; // Skip clouds on cloud-free days
      
      const t = (this.time % this.cycleDuration) / this.cycleDuration;
      
      // Clouds appear afternoon (0.6)
      const cloudPeak = 0.6; // Slightly before noon
      const cloudRange = 0.3; // How long clouds are visible
      
      // Calculate cloud visibility based on proximity to noon
      const cloudVisibility = 1 - Math.min(1, Math.abs(t - cloudPeak) / cloudRange);
      
      if (cloudVisibility > 0) {
        this.clouds.forEach(cloud => {
          // Update cloud position
          cloud.x -= cloud.speed;
          if (cloud.x + cloud.size < 0) cloud.x = this.canvas.width; // Wrap around
  
          // Apply the visibility factor to cloud opacity
          const opacity = cloudVisibility * cloud.opacity;
  
          // Draw the cloud as an ellipse
          this.ctx.beginPath();
          this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          this.ctx.ellipse(
            cloud.x,
            cloud.y,
            cloud.size,
            cloud.size / 2,
            0,
            0,
            Math.PI * 2
          );
          this.ctx.fill();
        });
      }
    }
  
  // Function to draw stars
  drawStars() {
    const t = (this.time % this.cycleDuration) / this.cycleDuration;
    
    // Stars visibility calculation with smooth transitions
    let starVisibility = 0;
    
    // Stars should be fully visible during full night (0.75 to 0.95)
    // With transition periods at dusk (0.7 to 0.75) and dawn (0.95 to 1.0)
    
    if (t >= 0.7 && t < 0.75) {
      // Dusk transition - stars gradually appear
      starVisibility = (t - 0.7) / 0.05; // Smooth ramp from 0 to 1 during dusk
    } 
    else if (t >= 0.75 && t < 0.95) {
      // Full night - stars fully visible
      starVisibility = 1.0;
    }
    else if (t >= 0.95) {
      // Dawn transition start - stars begin to fade
      starVisibility = 1.0 - ((t - 0.95) / 0.05);
      starVisibility = Math.max(0, starVisibility); // Ensure it doesn't go negative
    }
    
    if (starVisibility > 0) {
      this.stars.forEach(star => {
        // Twinkle effect
        if (star.twinkle && Math.random() > 0.95) {
          star.radius = Math.random() * 1.5 + 0.5; // Change size slightly
        }
        
        // Calculate final opacity with visibility factor
        const opacity = starVisibility * star.opacity;
        
        // Draw the star
        this.ctx.beginPath();
        this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        this.ctx.fill();
      });
    }
  }
  
    // Function to calculate sun position along a parabolic path
    calculateSunPosition(progress) {
      // progress is 0 at sunrise (bottom left), 0.5 at noon (top center), 1 at sunset (bottom right)
      const x = this.canvas.width * progress; // Linear horizontal movement
      
      // Parabolic curve for vertical movement
      // We want the vertex at (0.5 * canvas.width, 0.1 * canvas.height) 
      // and the points at (0, canvas.height) and (canvas.width, canvas.height)
      const h = this.canvas.width / 2; // x-coordinate of vertex (center of canvas)
      const k = 0.1 * this.canvas.height; // y-coordinate of vertex (slightly below top)
      const a = (this.canvas.height - k) / Math.pow(h, 2); // Coefficient to make parabola reach bottom at edges
      
      const y = a * Math.pow(x - h, 2) + k; // Parabolic function
      
      return { x, y };
    }
  
    // Function to calculate moon position along a flatter parabolic path
    calculateMoonPosition(progress) {
      // progress is 0 at moonrise (bottom left), 0.5 at midnight (not as high), 1 at moonset (bottom right)
      const x = this.canvas.width * progress; // Linear horizontal movement
      
      // Flatter parabolic curve for vertical movement
      // We want the vertex at (0.5 * canvas.width, 0.4 * canvas.height) 
      // and the points at (0, canvas.height) and (canvas.width, canvas.height)
      const h = this.canvas.width / 2; // x-coordinate of vertex (center of canvas)
      const k = 0.4 * this.canvas.height; // y-coordinate of vertex (lower than sun)
      const a = (this.canvas.height - k) / Math.pow(h, 2); // Coefficient to make parabola reach bottom at edges
      
      const y = a * Math.pow(x - h, 2) + k; // Parabolic function
      
      return { x, y };
    }
  
    // Function to draw the sun
    drawSun() {
      const t = (this.time % this.cycleDuration) / this.cycleDuration;
    
      // Sun is visible from sunrise to sunset (0.95 to 0.05 to 0.75 across the cycle)
      const sunVisible = (t >= 0.95 || t < 0.75);
    
      if (sunVisible) {
        // Map t to sun progress (0 at sunrise, 1 at sunset) across the full sun visibility period
        let sunProgress;
        const sunriseT = 0.95; // Sunrise start
        const sunsetT = 0.75;  // Sunset end
        const sunDuration = (1 - sunriseT) + sunsetT; // Total duration of sun visibility (0.8 of cycle: 0.95-1.0 + 0.0-0.75)
    
        if (t >= 0.95) {
          // From sunrise (0.95) to end of cycle (1.0): maps to 0 to 0.0625 of progress
          sunProgress = (t - 0.95) / (1 - 0.95); // 0 to 1 over 0.05 of cycle
          sunProgress *= (1 - sunriseT) / sunDuration; // Scale to portion of total sun duration (0 to 0.0625)
        } else {
          // From start of cycle (0.0) to sunset (0.75): maps to 0.0625 to 1 of progress
          sunProgress = (t + (1 - sunriseT)) / sunDuration; // 0.05 to 0.8 maps to 0.0625 to 1
        }
    
        // Calculate position along the parabolic curve
        const { x, y } = this.calculateSunPosition(sunProgress);
    
        // Create smooth color transitions
        const orangeR = 255, orangeG = 160, orangeB = 60;  // Orange for dawn/dusk
        const yellowR = 255, yellowG = 255, yellowB = 0;   // Yellow for day
    
        let r, g, b;
        if (t >= 0.95 || t < 0.05) {
          // Dawn transition (orange to yellow)
          const dawnT = t >= 0.95 ? (t - 0.95) / 0.1 : (t + 0.05) / 0.1;
          r = orangeR;
          g = orangeG + (yellowG - orangeG) * dawnT;
          b = orangeB + (yellowB - orangeB) * dawnT;
        } else if (t >= 0.65 && t < 0.75) {
          // Dusk transition (yellow to orange)
          const duskT = (t - 0.65) / 0.1;
          r = yellowR;
          g = yellowG - (yellowG - orangeG) * duskT;
          b = yellowB - (yellowB - orangeB) * duskT;
        } else {
          // Middle of day (yellow)
          r = yellowR;
          g = yellowG;
          b = yellowB;
        }
    
        const sunColor = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
        const sunRadius = 30;
    
        // Draw the sun
        this.ctx.beginPath();
        this.ctx.arc(x, y, sunRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = sunColor;
        this.ctx.fill();
    
        // Add a glow effect
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b/2)}, 0.5)`;
        this.ctx.fill();
        this.ctx.shadowBlur = 0; // Reset shadow
      }
    }
  
  // Function to draw the moon
  drawMoon() {
    const t = (this.time % this.cycleDuration) / this.cycleDuration;
    
    // Moon is visible from sunset to sunrise (0.7 to 0.95)
    // This gives a short overlap with the sun at dusk and dawn
    const moonVisible = (t >= 0.7 && t < 0.95);
    
    if (moonVisible) {
      // Map t from [0.7, 0.95] to [0, 1] for moon's complete arc
      const moonProgress = (t - 0.7) / 0.25;
      
      // Calculate position along the flatter parabolic curve
      const { x, y } = this.calculateMoonPosition(moonProgress);
      const moonRadius = 25;
      
      // Create a smooth color transition
      // At t=0.7 and t=0.95 (dusk/dawn): yellow-tinted (255, 250, 230)
      // At t=0.825 (middle of night): pure white (255, 255, 255)
      
      let yellowness;
      if (t <= 0.825) {
        // Transition from yellow to white (0.7 to 0.825)
        yellowness = 1 - ((t - 0.7) / 0.125);
      } else {
        // Transition from white to yellow (0.825 to 0.95)
        yellowness = ((t - 0.825) / 0.125);
      }
      
      // Calculate the RGB values based on the yellowness factor
      const red = 255;
      const green = 250 + (5 * (1 - yellowness)); // 250 to 255
      const blue = 230 + (25 * (1 - yellowness)); // 230 to 255
      
      const moonColor = `rgb(${red}, ${Math.round(green)}, ${Math.round(blue)})`;
      
      // Draw the moon
      this.ctx.beginPath();
      this.ctx.arc(x, y, moonRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = moonColor;
      this.ctx.fill();
      
      // Add a glow effect
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
      this.ctx.fill();
      this.ctx.shadowBlur = 0; // Reset shadow
    }
  }
  
    // Decide if today is a cloud-free day
    newDay() {
      this.cloudFreeDays = Math.random() > 0.5; // 50% chance of cloud-free days
    }
  
    // Update and render the environment
    update() {
      // Detect when a new day cycle starts
      const previousTime = this.time;
      this.time += 0.01; // Increment time (adjust speed here)
      
      // Check if we've crossed a new day boundary
      if (Math.floor(previousTime / this.cycleDuration) !== Math.floor(this.time / this.cycleDuration)) {
        this.newDay();
      }
  
      // Clear the canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
      // Draw the sky, stars, clouds, sun, and moon
      this.drawSky();
      this.drawStars();
      this.drawClouds();
      this.drawSun();
      this.drawMoon();
    }
  }