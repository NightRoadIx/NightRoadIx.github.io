/**
 * Simulación de camino aleatorio (Fotón Solar) - Three.js
 */
function RWS() {
    // Variable inst de esta (this) clase
    var inst = this;
    inst.scene;		// Escena
    inst.camera;	// Camara
    inst.controls;	// Controles
    inst.renderer;	// Renderizado
    inst.mesh;		// Malla
    inst.simulation;// Simulacion

    // constantes
    var ROTATION_SPEED = 0.01;
    var STAR_COUNT = 1000;
    var STAR_MIN_DISTANCE = 3000;
    var SUN_OPACITY = 8;
    var SUN_DENSITY = 1408;
    var SUN_RADIUS = 0.005;
    var SPEED_OF_LIGHT = 2.99 * Math.pow(10, 8);
    var SCALE_FACTOR = 100000;


	// Función para el inicio de inst
    inst.initialize = function(autostart) {
        // iniciar three.js
        inst.scene = new THREE.Scene();		// Crear la escena
		// Crear la camara con la vista inicial (punto de vista vertical, aspecto, plano de cercania, plano de lejania)
        inst.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 12000);
        inst.renderer = new THREE.WebGLRenderer();		// El renderizado de la escena
        inst.renderer.setSize(window.innerWidth, window.innerHeight);	// Colocar el tamaño de la ventana
        document.body.appendChild(inst.renderer.domElement);
        inst.camera.position.z = 1100;		// posicion de la camara en el eje z
        inst.controls = new THREE.OrbitControls(inst.camera);	// Control de orbita de la camara
        inst.controls.damping = 0.2;		// Dar una especie de "incercia" cuando se muevan los controles

        // iniciar la malla y el renderizado
        inst.simulation = new Object();		// Iniciar un nuevo objeto
        inst.simulation.isActive = true;	// la simulacion esta activa
        inst.simulation.steps = 0;			// iniciar los pasos de la simulacion a 0
        inst.simulation.startTime = new Date().getTime() / 1000;	// Tiempo de inicio
        inst.simulation.l = 1 / (SUN_OPACITY * SUN_DENSITY);
        inst.initMesh();					// iniciar el mallado
        inst.bindEvents();					// 
        inst.displayHint();					// 
        if (autostart || typeof autostart == 'undefined') inst.render();
    };

    /**
     * Iniciar los objetos de la malla
     */
    inst.initMesh = function() {
        inst.mesh = new Object(); 

        // Composición del Sol
		// Zona convectiva
		// Generar una esfera
        var gSun = new THREE.SphereGeometry(SUN_RADIUS * SCALE_FACTOR, 26, 26);
		// Propieades con las que se mostrará a la esfera
		// color, mallado, opacidad, transparencia
        var mSun = new THREE.MeshBasicMaterial({ color: 0xFF9933, wireframe: true, opacity: 0.2, transparent: true });
		// Crear el objeto sun
        inst.mesh.sun = new THREE.Mesh(gSun, mSun);
		// Añadir a la escena
        inst.scene.add(inst.mesh.sun);
		
		// Zona radiativa
        var gSun2 = new THREE.SphereGeometry(0.003 * SCALE_FACTOR, 26, 26);
        var mSun2 = new THREE.MeshBasicMaterial({ color: 0xFFFF33, wireframe: true, opacity: 0.2, transparent: true });
        inst.mesh.sun2 = new THREE.Mesh(gSun2, mSun2);
        inst.scene.add(inst.mesh.sun2);
		
		// Núcleo
        var gSun3 = new THREE.SphereGeometry(0.001 * SCALE_FACTOR, 26, 26);
        var mSun3 = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, wireframe: true, opacity: 0.2, transparent: true });
        inst.mesh.sun3 = new THREE.Mesh(gSun3, mSun3);
        inst.scene.add(inst.mesh.sun3);	

        // Fotón
        var gPhoton = new THREE.SphereGeometry(10, 8, 6);
        var mPhoton = new THREE.MeshBasicMaterial({ color: 0x09F282 });
        inst.mesh.photon = new THREE.Mesh(gPhoton, mPhoton);
        inst.scene.add(inst.mesh.photon);

        // Fondo estrellado
        for (var i=0; i < STAR_COUNT; i++) {
            var gStar = new THREE.SphereGeometry(6, 8, 6);
            var mStar = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
            var star = new THREE.Mesh(gStar, mStar);
            
            star.position.x = inst.rnd();
            star.position.y = inst.rnd();
            star.position.z = inst.rnd();

            // en caso de que una estrella este muy cercana al sol
            // no se añade a la escena
            if (inst.calc3dDistance(star) >= STAR_MIN_DISTANCE)
                inst.scene.add(star);
        }
    }

    /**
     * Ciclo de renderizado
     */
    inst.render = function() {
		// pedir un cuadro de la animacion
        requestAnimationFrame(inst.render);
		// Verificar si la simulacion esta activa
        if (inst.simulation.isActive)
            inst.processSimulation();		// Si es así, ejecutarla
		// renderizar con la escena y la camara
        inst.renderer.render(inst.scene, inst.camera);
    };

    /**
     * Enlazar los eventos de la simulación
     */
    inst.bindEvents = function() {
        // sin eventos especificos
    };

    /**
     * Procesar cada cuadro de la simulación.
	 * Esta es la sección donde se ejecuta la simulación
     *
     * Este método procesa un paso de la simulación (60 pasos hacen
     * 1 segundo de la escena).
     */
    inst.processSimulation = function() {
        inst.simulation.steps++								// Aumentar los pasos de la simulación
        var oldVector = inst.getVector3(inst.mesh.photon);	// obtener la posición anterior
		
        var pxl = inst.simulation.l * SCALE_FACTOR * 2;		// Distancia de los pasos
		// Hacer el muestreo de los ángulos con los que se moverá el fotón
        var theta = 2 * Math.PI * Math.random();			// Angulo sobre plano x-y [0, 2Pi]
		var phi = Math.PI - 2 * Math.PI * Math.random();	// Angulo sobre el plano z [-Pi, Pi]
		/* Cálculo de la nueva posición del fotón (x,y,z) */
        inst.mesh.photon.position.x += pxl * Math.sin(phi) * Math.cos(theta);
        inst.mesh.photon.position.y += pxl * Math.sin(phi) * Math.sin(theta);
        inst.mesh.photon.position.z += pxl * Math.cos(phi);

        var newVector = inst.getVector3(inst.mesh.photon);	// obtener la nueva posición
        inst.createLine(oldVector, newVector);				// crear una nueva línea
		
		// Dejar dibujado cada punto donde viajo el fotón
        var gPunkt = new THREE.SphereGeometry(2, 8, 6);
        var mPunkt = new THREE.MeshBasicMaterial({ color: 0x0000CC });
        var punkt = new THREE.Mesh(gPunkt, mPunkt);
		punkt.position.x = inst.mesh.photon.position.x;
		punkt.position.y = inst.mesh.photon.position.y;
		punkt.position.z = inst.mesh.photon.position.z;		
        inst.scene.add(punkt);
		
		// Cambiar el tamaño del fotón por cada interaccion
		// inst.mesh.photon.scale.set(2.2,2.2,0.2);

		// calcular la distancia
        dist = inst.calc3dDistance(inst.mesh.photon);
		// verificar si la distancia del foton ya sobrepaso el radiomaximo del sol
        if (dist > inst.mesh.sun.geometry.parameters.radius) {
            console.log('Finalizo la simulación');	// Detener la simulación e imprimir los resultados
            inst.simulation.isActive = false;		// Desactivar la simulacion
            inst.simulation.endTime = new Date().getTime() / 1000;	// Hallar el tiempo de finalizacion de la simulacion
            inst.displayStats();					// Mostrar las estadisticas
        }   
    };

    /**
     * Genera números aleatorios para el posicionamiento de las estrellas
     * 
     * @return {Número aleatorio}
     */
    inst.rnd = function() {
        return Math.floor((Math.random() * 10000) - 5000);
    };


    /**
     * Calculo 3D de la distancia del punto central de la escena(0, 0, 0)
     * 
     * @param {THREE.Mesh} mesh 
     * @return {Number}
     */
    inst.calc3dDistance = function(mesh) {
        return Math.sqrt(Math.pow(mesh.position.x, 2) 
                + Math.pow(mesh.position.y, 2) + Math.pow(mesh.position.z, 2));
    };

    /**
     * Obtiene un objeto Vector3 de la posición de la rejilla
     * 
     * @param {THREE.Mesh} mesh
     */
    inst.getVector3 = function(mesh) {
        return new THREE.Vector3(
            mesh.position.x,
            mesh.position.y,
            mesh.position.z
        );
    };

    /**
     * Crear una nueva línea con el fin de desplegarla en la
     * trayectoria del fotón.
     * 
     * @param {THREE.Vector3} oldVector 
     * @param {THREE.Vector3} newVector 
     */
    inst.createLine = function(oldVector, newVector) {
        var gLine = new THREE.Geometry();		// un objeto de geometria de la libreria THREE
        gLine.vertices.push(oldVector);			// a partir del vector de posicion anterior
        gLine.vertices.push(newVector);			// al nuevo vector de posicion
		// Crear una nueva linea con sus caracteristicas
		// color, ancho, transparencia, opacidad
        var mLine = new THREE.LineBasicMaterial({ color: 0xFF2424, linewidth: 1, transparent: true, opacity: 1.0 });
		// Se genera el objeto Line
        var line = new THREE.Line(gLine, mLine);
        inst.scene.add(line);					// Añadir a la escena
    };

    /**
     * Mostrar las estadísticas de la simulación
     *
     * Este método es llamado cuando el fotón alcanza la superficie del sol
     * y despliega las estadísticas de la simulación (número de pasos, 
     * tiempo de simulación, tiempo real del fotón en años etc ...)
     */
    inst.displayStats = function() {
        var html = 
            '<strong>Resultados de la simulacion</strong><br>' +
            'Duracion: ' + Number(inst.simulation.endTime - inst.simulation.startTime).toFixed(2) + 's<br>' +
            'Pasos Totales: ' + inst.simulation.steps + '<br>' +
            'Tiempo de escape: ' + Math.round(48.32 * inst.simulation.steps * inst.simulation.l / Math.pow(SUN_RADIUS, 2)) + ' Años';


		// Caracteristicas del elemento a desplegar
        var div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.minWidth = '286px';
        div.style.top = '10px';
        div.style.left = '10px';
        div.style.padding = '20px';
        div.style.backgroundColor = '#FFF';
        div.style.font = '16px arial, helvetica';
        div.style.lineHeight = '1.4';
        div.innerHTML = html;
        document.body.appendChild(div);
    };

    /**
     * Desplegar la ventana de sugerencia
     */
    inst.displayHint = function() {
		// Caracteristicas del elemento a desplegar
        var html = '<strong>Utilizar el raton para cambiar el punto de vista.</strong>';
        var div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.top = '10px';
        div.style.right = '10px';
        div.style.padding = '10px';
        div.style.font = '11px arial, helvetica';
        div.style.color= '#FFF';
        div.innerHTML = html;
        document.body.appendChild(div);
    };
}