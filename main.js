import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// --- CONFIGURATION ---
const MODEL_PATH = 'car.glb'; // Change this to your actual filename!
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

// 6. Animation Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// 7. Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();