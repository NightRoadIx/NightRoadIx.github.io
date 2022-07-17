var camera;
var scene;
var renderer;
var controls;
var spotLight;
var counter = 0;

init();
animate();

function init() {
    
	// Crear una escena
    scene = new THREE.Scene();
    
	// Añadir la escena
    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, 180, 350);
    
    // Añadir los elementos a la escena
    addSceneElements();
    
    // Añadir las luces de la iluminación
    addLights();
    
	// Crear el Renderizador WebGL
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    
    // Anexar el renderizado al cuerpo
    document.body.appendChild( renderer.domElement );

    // Añadir un evento escucha de redimensionamiento
    window.addEventListener( 'resize', onWindowResize, false );
    
    // Añadir los controles orbitales con el mouse
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target = new THREE.Vector3(0, 100, 0);     
}

/* Función de la iluminación*/
function addLights() {
		
    var bluePoint = new THREE.PointLight(0x0011ff, 5, 150);
    bluePoint.position.set( 70, 5, 70 );
    scene.add(bluePoint);
    scene.add(new THREE.PointLightHelper(bluePoint, 5));
    
    var greenPoint = new THREE.PointLight(0x11ff00, 5, 150);
    greenPoint.position.set( -70, 5, 70 );
    scene.add(greenPoint);
    scene.add(new THREE.PointLightHelper(greenPoint, 5));
	
    var redPoint = new THREE.PointLight(0xff1100, 5, 150);
    redPoint.position.set( 0, 5, -70 );
    scene.add(redPoint);
    scene.add(new THREE.PointLightHelper(redPoint, 5));
    
    spotLight = new THREE.SpotLight(0xffffff, 5, 200, 45, 10);
    spotLight.position.set( 0, 150, 0 );
    
    var spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, 0);
    spotLight.target = spotTarget;
    
    scene.add(spotLight);
    scene.add(new THREE.PointLightHelper(spotLight, 1));	    
    
    var hemLight = new THREE.HemisphereLight(0xffe5bb, 0xFFBF00, .1);
    scene.add(hemLight);
}

function addSceneElements() {
    // Crear un cubo para construir las paredes y el piso
    var cube = new THREE.CubeGeometry( 200, 1, 200);  
    
    // Crear diferentes materiales
    var floorMat = new THREE.MeshPhongMaterial( { map: THREE.ImageUtils.loadTexture('images/wood-floor.jpg') } );
    var wallMat = new THREE.MeshPhongMaterial( { map: THREE.ImageUtils.loadTexture('images/bricks.jpg') } );
    var redMat = new THREE.MeshPhongMaterial( { color: 0xff3300, specular: 0x555555, shininess: 30 } );
	var cyanMat = new THREE.MeshPhongMaterial( { color: 0x00e6ff, specular: 0x555555, shininess: 10 } );
	var aquaMat = new THREE.MeshPhongMaterial( { color: 0xa0a0a0, specular: 0x555555, shininess: 30 } );
    var purpleMat = new THREE.MeshPhongMaterial( { color: 0x6F6CC5, specular: 0x555555, shininess: 30 } );

    // Piso
    var floor = new THREE.Mesh(cube, floorMat );
    scene.add( floor );
    
    // Pared trasera
    var backWall = new THREE.Mesh(cube, wallMat );
    backWall.rotation.x = Math.PI/180 * 90;
    backWall.position.set(0,100,-100);
    scene.add( backWall );
    
    // Pared izquierda
    var leftWall = new THREE.Mesh(cube, wallMat );
    leftWall.rotation.x = Math.PI/180 * 90;
    leftWall.rotation.z = Math.PI/180 * 90;
    leftWall.position.set(-100,100,0);
    scene.add( leftWall );
    
    // Pared derecha
    var rightWall = new THREE.Mesh(cube, wallMat );
    rightWall.rotation.x = Math.PI/180 * 90;
    rightWall.rotation.z = Math.PI/180 * 90;
    rightWall.position.set(100,100,0);
    scene.add( rightWall );
    
    // Esfera1
    var sphere = new THREE.Mesh(new THREE.SphereGeometry(20, 70, 20), redMat);
    sphere.position.set(-25, 100, -20);
    scene.add(sphere);
    
	// Esfera 2
    var sphere = new THREE.Mesh(new THREE.SphereGeometry(20, 70, 20), cyanMat);
    sphere.position.set(25, 50, -20);
    scene.add(sphere);
	
	// Esfera 3
    var sphere = new THREE.Mesh(new THREE.SphereGeometry(20, 70, 20), aquaMat);
    sphere.position.set(-25, 25, -10);
    scene.add(sphere);	
	
    // Nudo
    var knot = new THREE.Mesh(new THREE.TorusKnotGeometry( 40, 3, 100, 16 ), purpleMat);
    knot.position.set(0, 60, 30);
    scene.add(knot);
}

function animate() {
	renderer.render( scene, camera );
    requestAnimationFrame( animate );
    controls.update();
    
    counter += .1;
    spotLight.target.position.x = Math.sin(counter) * 180;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}
