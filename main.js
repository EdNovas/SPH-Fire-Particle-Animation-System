const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
if (!gl) {
    alert('WebGL is not supported by your browser. Please try another browser.');
}

class Particle {
    constructor(x, y, temperature, lifetime) {
        this.position = { x: x, y: y };
        this.velocity = { x: 0, y: 0 };
        this.acceleration = { x: 0, y: 0 };
        this.density = 0;
        this.pressure = 0;
        this.temperature = temperature;
        this.lifetime = lifetime;
        this.buoyancy = 0;
        this.coolingRate = 0.5
    }
}

const timeStep = 0.01;
let smoothingRadius = 3;
let mass = 1;
let gasConstant = 8000;
let viscosity = 1;
let gravity = -9.8;
let maxTemperature = 5;
let maxLifetime = 2;
let emissionRate = 50;
let buoyancyConstant = -150;
let particleSize = 10;
let fireSourceY = 0;
let emitVelocity = 50;
let fireSourceRange = 50;

let numParticles = 800;
const particles = [];

// Create event listeners for the sliders
document.getElementById('smoothingRadius').addEventListener('input', function (event) {
    smoothingRadius = parseFloat(event.target.value);
    document.getElementById('smoothingRadiusValue').textContent = smoothingRadius;
});

document.getElementById('mass').addEventListener('input', function (event) {
    mass = parseFloat(event.target.value);
    document.getElementById('massValue').textContent = mass;
});

document.getElementById('gasConstant').addEventListener('input', function (event) {
    gasConstant = parseFloat(event.target.value);
    document.getElementById('gasConstantValue').textContent = gasConstant;
});

document.getElementById('viscosity').addEventListener('input', function (event) {
    viscosity = parseFloat(event.target.value);
    document.getElementById('viscosityValue').textContent = viscosity;
});

document.getElementById('gravity').addEventListener('input', function (event) {
    gravity = parseFloat(event.target.value);
    document.getElementById('gravityValue').textContent = gravity;
});

const maxTemperatureSelect = document.getElementById('maxTemperature');
maxTemperatureSelect.addEventListener('change', (event) => {
    maxTemperature = parseFloat(event.target.value);
});

document.getElementById('maxLifetime').addEventListener('input', function (event) {
    maxLifetime = parseFloat(event.target.value);
    document.getElementById('maxLifetimeValue').textContent = maxLifetime;
});

document.getElementById('numParticles').addEventListener('input', function (event) {
    numParticles = parseInt(event.target.value);
    document.getElementById('numParticlesValue').textContent = numParticles;
});

document.getElementById('emissionRate').addEventListener('input', function (event) {
    emissionRate = parseInt(event.target.value);
    document.getElementById('emissionRateValue').textContent = emissionRate;
});

document.getElementById('buoyancyConstant').addEventListener('input', function (event) {
    buoyancyConstant = parseFloat(event.target.value);
    document.getElementById('buoyancyConstantValue').textContent = buoyancyConstant;
});

document.getElementById('particleSize').addEventListener('input', function (event) {
    particleSize = parseFloat(event.target.value);
    document.getElementById('particleSizeValue').textContent = particleSize;
});

document.getElementById('fireSourceY').addEventListener('input', function (event) {
    fireSourceY = parseFloat(event.target.value);
    document.getElementById('fireSourceYValue').textContent = fireSourceY;
});

document.getElementById('emitVelocity').addEventListener('input', function (event) {
    emitVelocity = parseFloat(event.target.value);
    document.getElementById('emitVelocityValue').textContent = emitVelocity;
});

document.getElementById('fireSourceRange').addEventListener('input', function (event) {
    fireSourceRange = parseFloat(event.target.value);
    document.getElementById('fireSourceRangeValue').textContent = fireSourceRange;
});

// Set the initial values for the labels
document.getElementById('smoothingRadiusValue').textContent = smoothingRadius;
document.getElementById('massValue').textContent = mass;
document.getElementById('gasConstantValue').textContent = gasConstant;
document.getElementById('viscosityValue').textContent = viscosity;
document.getElementById('gravityValue').textContent = gravity;
document.getElementById('maxLifetimeValue').textContent = maxLifetime;
document.getElementById('numParticlesValue').textContent = numParticles;
document.getElementById('emissionRateValue').textContent = emissionRate;
document.getElementById('buoyancyConstantValue').textContent = buoyancyConstant;
document.getElementById('particleSizeValue').textContent = particleSize;
document.getElementById('fireSourceYValue').textContent = fireSourceY;
document.getElementById('emitVelocityValue').textContent = emitVelocity;
document.getElementById('fireSourceRangeValue').textContent = fireSourceRange;

for (let i = 0; i < numParticles; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const temperature = Math.random() * maxTemperature;
    const lifetime = Math.random() * maxLifetime;
    particles.push(new Particle(x, y, temperature, lifetime));
}

function emitParticles(emissionRate) {

    const fireSourceX = Math.floor(Math.random() * fireSourceRange) - (fireSourceRange/2) + (canvas.width / 2);
    for (let i = 0; i < emissionRate; i++) {
        const temperature = Math.random() * maxTemperature;
        const lifetime = Math.random() * maxLifetime;
        const particle = new Particle(fireSourceX, fireSourceY, temperature, lifetime);
        particle.velocity.x = (Math.random() - 0.5) * emitVelocity;
        particles.push(particle);
    }
}

function poly6Kernel(r, h) {
    const coefficient = 315 / (64 * Math.PI * Math.pow(h, 9));
    const r2 = r * r;
    const h2 = h * h;
    return coefficient * Math.pow(h2 - r2, 3);
}

function spikyGradientKernel(r, h) {
    const coefficient = -45 / (Math.PI * Math.pow(h, 6));
    const h_r = h - r;
    return coefficient * Math.pow(h_r, 2);
}

function viscosityLaplacianKernel(r, h) {
    const coefficient = 45 / (Math.PI * Math.pow(h, 6));
    return coefficient * (h - r);
}

function computeDensityAndPressure() {
    for (let i = 0; i < numParticles; i++) {
        let density = 0;
        for (let j = 0; j < numParticles; j++) {
            const dx = particles[i].position.x - particles[j].position.x;
            const dy = particles[i].position.y - particles[j].position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < smoothingRadius) {
                density += mass * poly6Kernel(distance, smoothingRadius);
            }
        }
        particles[i].density = density;
        particles[i].pressure = gasConstant * (density - 1);
    }
}

function computeForces() {
    for (let i = 0; i < numParticles; i++) {
        let pressureForceX = 0;
        let pressureForceY = 0;
        let viscosityForceX = 0;
        let viscosityForceY = 0;
        for (let j = 0; j < numParticles; j++) {
            if (i !== j) {
                const dx = particles[i].position.x - particles[j].position.x;
                const dy = particles[i].position.y - particles[j].position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < smoothingRadius) {
                    const spikyGradient = spikyGradientKernel(distance, smoothingRadius);
                    const pressureTerm = -mass * (particles[i].pressure + particles[j].pressure) / (2 * particles[j].density) * spikyGradient;
                    
                    pressureForceX += dx * pressureTerm / distance;
                    pressureForceY += dy * pressureTerm / distance;
                    
                    const viscosityLaplacian = viscosityLaplacianKernel(distance, smoothingRadius);
                    const viscosityTerm = viscosity * mass / particles[j].density * viscosityLaplacian;

                    viscosityForceX += (particles[j].velocity.x - particles[i].velocity.x) * viscosityTerm;
                    viscosityForceY += (particles[j].velocity.y - particles[i].velocity.y) * viscosityTerm;
                }
            }
        }
        particles[i].buoyancy = -gravity * (particles[i].density - 1) * buoyancyConstant;
        particles[i].acceleration.x = pressureForceX + viscosityForceX;
        particles[i].acceleration.y = pressureForceY + viscosityForceY + gravity + particles[i].buoyancy;
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].velocity.x += particles[i].acceleration.x * timeStep;
        particles[i].velocity.y += particles[i].acceleration.y * timeStep;

        particles[i].position.x += particles[i].velocity.x * timeStep;
        particles[i].position.y += particles[i].velocity.y * timeStep;

        // Update the particle's lifetime
        particles[i].lifetime -= timeStep;
        if (particles[i].lifetime <= 0) {
            particles.splice(i, 1);
            continue;
        }
        // Update the particle's temperature
        particles[i].temperature -= particles[i].coolingRate * timeStep;
        particles[i].temperature = Math.max(particles[i].temperature, 0); // ensure temperature doesn't go below 0
        
        // Keep the particles within the canvas bounds
        particles[i].position.x = Math.min(Math.max(particles[i].position.x, 0), canvas.width);
        particles[i].position.y = Math.min(Math.max(particles[i].position.y, 0), canvas.height);
    }
}

const vertexShaderSource = `
    attribute vec2 a_position;
    uniform vec2 u_resolution;
    uniform float u_particleSize;

    void main() {
        vec2 position = (a_position / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(position, 0, 1);
        gl_PointSize = u_particleSize;
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    uniform float u_maxTemperature;
    void main() {
        float dist = length(gl_PointCoord - vec2(0.5, 0.5));
        if (dist < 0.5) {
            float intensity = 1.0 - dist;
            float temperature = intensity * u_maxTemperature;
            vec3 color = vec3(1.0, 1.0, 1.0);
            if (temperature > 3.0) {
                color = vec3(1.0, 0.0, 0.0); // red
            } 
            else if (temperature > 2.0) {
                color = vec3(1.0, 0.5, 0.0); // orange
            } 
            else if (temperature > 1.0) {
                color = vec3(1.0, 1.0, 0.0); // yellow
            }
            gl_FragColor = vec4(color, 1.0);
        } 
        else {
            discard;
        }
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`Error compiling shader: ${gl.getShaderInfoLog(shader)}`);
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function drawParticles(particles) {
    // Update the position and temperature data in the buffer
    const data = new Float32Array(particles.length * 3);
    for (let i = 0; i < particles.length; i++) {
        data[i * 3] = particles[i].position.x;
        data[i * 3 + 1] = particles[i].position.y;
        data[i * 3 + 2] = particles[i].temperature;
    }
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    
    // Set up the WebGL viewport and clear the color buffer
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use the WebGL program and set the uniform and attribute values
    gl.useProgram(program);
    gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(program, 'u_maxTemperature'), maxTemperature);
    gl.uniform1f(gl.getUniformLocation(program, 'u_particleSize'), particleSize);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

    // Draw the particles
    gl.drawArrays(gl.POINTS, 0, particles.length);
}

function time() {
    var date = new Date();
    var time = date.getTime();
    return time;
}

// Display the FPS
let frameTime = 18;
let lastTime = time();
let tempTime = time();
function displayFPS() {
    currentTime = time();
    frameTime = frameTime * 0.9 + (currentTime - lastTime) * 0.1;
    fps = 1000.0/frameTime;
    if (currentTime - tempTime > 100) {
        document.getElementById("fps").textContent = "FPS: " + Math.round(fps);
        tempTime = currentTime;
    }
    lastTime = currentTime;
}

function mainLoop() {
    displayFPS();
    emitParticles(emissionRate);
    // Update the simulation (e.g., call your SPH update functions)
    computeDensityAndPressure();
    computeForces();
    updateParticles();

    // Render the particles
    drawParticles(particles);

    // Request the next frame
    requestAnimationFrame(mainLoop);
}

// initialize the WebGL context
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(`Error linking program: ${gl.getProgramInfoLog(program)}`);
}

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
gl.enableVertexAttribArray(positionAttributeLocation);
gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');

mainLoop();
