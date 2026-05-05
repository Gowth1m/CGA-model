import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// --- CONFIGURATION ---
const urlParams = new URLSearchParams(window.location.search);
const MODEL_PATH = urlParams.get('model') || 'R8_LMS_GT4.glb'; // Dynamically load model based on URL
// ---------------------

const container = document.getElementById('canvas-container');
const loadingText = document.getElementById('loading');

// 1. Scene & Camera
const scene = new THREE.Scene();

scene.background = null; // Set to null so the CSS background shows through!

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 3, 5);

// 2. Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // alpha: true enables transparency
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 0); // FORCE the 3D background to be 100% transparent
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Industry standard for photorealism
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; // Enable soft shadows
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// 3. Environment & Studio Lights
// RoomEnvironment creates complex studio reflections on the car's glass and metallic parts
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // Significantly brighter ambient light
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 3); // Main bright light
keyLight.position.set(5, 10, 7.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048; // High-res shadows
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 40;
keyLight.shadow.camera.left = -5;
keyLight.shadow.camera.right = 5;
keyLight.shadow.camera.top = 5;
keyLight.shadow.camera.bottom = -5;
scene.add(keyLight);

// Fill Light to soften harsh shadows on the opposite side
const fillLight = new THREE.DirectionalLight(0xe0eaff, 1.5); // Slight cool tint
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

// Rim Light to highlight the edges of the car
const rimLight = new THREE.SpotLight(0xffffff, 4);
rimLight.position.set(0, 5, -10);
rimLight.angle = Math.PI / 4;
rimLight.penumbra = 0.5;
scene.add(rimLight);

// Showroom Floor
const floorGeometry = new THREE.PlaneGeometry(50, 50);

// ShadowMaterial makes the 3D floor invisible but keeps the car's shadows!
const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.6 }); 
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// High-Tech Grid Overlay
const grid = new THREE.GridHelper(40, 80, 0xcc0000, 0x333333); // Audi red center lines
grid.position.y = 0.01; // Lift slightly to prevent glitching with floor
grid.material.opacity = 0.3;
grid.material.transparent = true;
scene.add(grid);

// 4. Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;     // Add auto-rotation for the showroom effect
controls.autoRotateSpeed = 1.0;
controls.maxPolarAngle = Math.PI / 2; // Prevent camera from rotating below the baseline (ground)

// 5. Load Model
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.load(MODEL_PATH, 
    (gltf) => {
        const car = gltf.scene;
        
        // 1. Auto-scale the model to a reasonable size (5 units wide/tall)
        const box = new THREE.Box3().setFromObject(car);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 5 / maxDim;
        car.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        // 2. Position model: Center horizontally, sit flush on the floor vertically
        const scaledBox = new THREE.Box3().setFromObject(car);
        const center = scaledBox.getCenter(new THREE.Vector3());
        const bottomY = scaledBox.min.y;
        
        car.position.x = -center.x;
        car.position.y = -bottomY; // Moves the lowest point of the tires exactly to Y=0
        car.position.z = -center.z;
        
        // 3. Enable shadow casting on all parts of the car
        car.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        scene.add(car);
        loadingText.style.display = 'none'; // Hide loading screen
    },
    (xhr) => {
        if (xhr.lengthComputable) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            loadingText.innerText = `Loading Car Model... ${percent}%`;
        }
    },
    (error) => {
        console.error("Error loading model:", error);
        loadingText.innerText = "Error: Model not found. Check the filename!";
    }
);

// --- WOW FEATURE: PARALLAX & AI WEBCAM TRACKING ---
let targetX = 0;
let targetY = 0;
let currentX = 0;
let currentY = 0;
let useWebcam = false;
let targetZoom = 1.0;
let currentZoom = 1.0;
let isPinching = false;
let lastHandX = 0;
let lastHandY = 0;

// 1. Mouse Tracking Fallback (Creates an immediate 3D effect)
window.addEventListener('mousemove', (e) => {
    if (!useWebcam) {
        targetX = (e.clientX / window.innerWidth - 0.5) * 5; // Increased mouse sensitivity
        targetY = (e.clientY / window.innerHeight - 0.5) * 5;
    }
});

// Mobile Touch Tracking (Parallax effect for touchscreens)
window.addEventListener('touchmove', (e) => {
    if (!useWebcam && e.touches.length > 0) {
        targetX = (e.touches[0].clientX / window.innerWidth - 0.5) * 5;
        targetY = (e.touches[0].clientY / window.innerHeight - 0.5) * 5;
    }
}, { passive: true }); // passive: true improves performance on mobile

// 2. AI Webcam Tracking (MediaPipe)
const webcamBtn = document.getElementById('webcam-btn');
let cameraUtils = null; // Store globally so we can turn it off
if (webcamBtn) {
    webcamBtn.addEventListener('click', async () => {
        if (useWebcam) {
            // Turn tracking OFF
            if (cameraUtils) cameraUtils.stop();
            useWebcam = false;
            webcamBtn.innerText = "Enable Hand Tracking";
            webcamBtn.style.background = "transparent";
            webcamBtn.style.border = "1px solid white";
            // Gently reset view
            targetX = 0; targetY = 0; targetZoom = 1.0;
            return;
        }
        
        webcamBtn.innerText = "Starting AI...";
        
        const videoElement = document.createElement('video');
        videoElement.style.display = 'none';
        document.body.appendChild(videoElement);

        // Load MediaPipe Hands from the global window object
        const hands = new window.Hands({locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }});
        hands.setOptions({ 
            maxNumHands: 1, 
            modelComplexity: 0, // Reduced from 1 to 0 for MAX performance and zero lag
            minDetectionConfidence: 0.5, 
            minTrackingConfidence: 0.5 
        });

        hands.onResults((results) => {
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const landmarks = results.multiHandLandmarks[0];
                
                // Use the center of the palm (landmark 9) for stable tracking
                const palm = landmarks[9];
                
                // PINCH TO ZOOM: Calculate distance between thumb (4) and index finger (8)
                const thumb = landmarks[4];
                const index = landmarks[8];
                const pinchDist = Math.hypot(index.x - thumb.x, index.y - thumb.y);
                
                // Map pinch distance to zoom (spread = zoom in, pinch = zoom out)
                targetZoom = 0.8 + (pinchDist * 4);
                
                // PINCH TO ROTATE & MOVE (Drag interaction)
                const PINCH_THRESHOLD = 0.08;
                
                if (pinchDist < PINCH_THRESHOLD) {
                    if (!isPinching) {
                        isPinching = true; // Started dragging
                        lastHandX = palm.x;
                        lastHandY = palm.y;
                    } else {
                        // Calculate movement delta
                        const deltaX = palm.x - lastHandX;
                        const deltaY = palm.y - lastHandY;
                        
                        targetX -= deltaX * 15; // Update rotation based on drag distance
                        targetY -= deltaY * 15;
                        
                        // Limit max rotation to prevent sliding the car off-screen and restrict upward tilt
                        targetX = Math.max(-15, Math.min(15, targetX));
                        targetY = Math.max(-2, Math.min(15, targetY)); // Restricted minimum to keep undercarriage hidden
                        
                        lastHandX = palm.x;
                        lastHandY = palm.y;
                    }
                } else {
                    isPinching = false; // Let go
                }
            }
        });

        cameraUtils = new window.Camera(videoElement, {
            onFrame: async () => { await hands.send({image: videoElement}); },
            width: 640, height: 480
        });

        cameraUtils.start().then(() => {
            useWebcam = true;
            webcamBtn.innerText = "AI Tracking Active";
            webcamBtn.style.background = "#cc0000";
            webcamBtn.style.border = "1px solid #cc0000";
        });
    });
}

// 6. Animation Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Apply Parallax Interpolation (Reduced to 0.08 for extremely smooth, natural movement with no jitter)
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    currentZoom += (targetZoom - currentZoom) * 0.08;
    
    // Shift and tilt the scene slightly for a dynamic holographic 3D pop effect
    scene.position.x = -currentX * 0.5;
    scene.position.y = currentY * 0.5;
    scene.rotation.y = currentX * 0.1; 
    // Clamp the backward tilt to prevent exposing the undercarriage during parallax movements
    scene.rotation.x = Math.max(-0.05, currentY * 0.1); 

    // Apply Pinch Zoom
    camera.zoom = currentZoom;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
}

// 7. Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();