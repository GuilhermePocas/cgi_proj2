import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../libs/utils.js";
import { ortho, lookAt, flatten, mult, mat4, vec4, vec3, inverse, perspective } from "../libs/MV.js";
import { GUI } from "../libs/dat.gui.module.js";
import {modelView, loadMatrix, multRotationY, multRotationX, multRotationZ, multTranslation, multScale, pushMatrix, popMatrix, multMatrix} from "../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js';
import * as CUBE from '../../libs/objects/cube.js';
import * as CYLINDER from '../../libs/objects/cylinder.js';
import * as PYRAMID from '../../libs/objects/pyramid.js';
import * as TORUS from '../../libs/objects/torus.js';
import { rotateY } from "../libs/MV.js";

/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 1/144.0;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running


const TRAJECTORY_RADIUS = 40;
const GRAVITY = 0.8;

//scenery constants

const FLOOR_SIZE = 140;
const FLOOR_HEIGHT = 4;
const FLOOR_COLOR = vec3(71/255, 170/255, 40/255);

const BUILDING_SIZE = 15;
const BUILDING_MIN_HEIGHT = 10;
const BUILDING_MAX_HEIGHT = 60;

const NUM_TREES = 10;
const TREE_TRUNK_RADIUS = 5;
const TREE_LEAF_WIDTH = 10;
const TREE_MIN_HEIGHT = 30;
const TREE_MAX_HEIGHT = 50; 

const LAKE_DIAMETER = 70;
const LAKE_WIDTH = 0.01;
const LAKE_COLOUR = vec3(5/255, 155/255, 161/255);

const LILY_DIAMETER= 2.5;
const LILY_WIDTH = 0.01;
const LILY_COLOUR =vec3(1/255, 74/255, 30/255)

const FISH_LENGTH = 4;
const FISH_WIDTH = 1;
const FISH_HEIGHT = 2;
const FISH_COLOUR = vec3(196/255, 52/255, 49/255);

const FISH_FIN_LENGTH = 1.5;
const FISH_FIN_WIDTH = 0.25;
const FISH_FIN_HEIGHT = 0.5;

const EYE_RADIUS = 0.4;
const EYE_COLOUR = vec3(0, 0, 0);
const FISH_JUMP_RADIUS = 5;
const FISH_JUMP_SPEED = 250;

const FROG_LENGTH = 3;
const FROG_RADIUS = 1.5;
const FROG_COLOUR = vec3(150/255, 247/255, 126/255);
const CROACK_COLOUR = vec3(243/255, 255/255, 112/255);

const NUM_CLOUDS = 6;
const CLOUD_RADIUS = 10;
const CLOUD_HEIGHT = 80;
const CLOUD_COLOUR = vec3(1, 1, 1);
const CLOUD_MOVE_SPEED = 0.05;


const REED_TOP_LENGTH = 1.5;
const REED_TOP_RADIUS = 0.3;
const REED_TOP_COLOUR = vec3(79/255, 49/255, 1/255);
const REED_LENGTH = 4;
const REED_RADIUS = 0.2;
const REED_COLOUR = vec3(144/255, 255/255, 18/255);
const REED_LEAF_LENGTH = 1;
const REED_LEAF_HEIGHT = 0.1;
const REED_LEAF_WIDTH = 0.5;

//helicopter constants

const MAIN_ROTOR_MAX_SPEED = 5;
const TAIL_ROTOR_MAX_SPEED = 10;

const BODY_COLOR = vec3(207/255, 25/255, 25/255);
const BLADE_COLOR = vec3(250/255, 175/255, 25/255);
const CYLINDER_COLOR = vec3(227/255, 182/255, 20/255);
const BEAM_COLOR = vec3(133/255, 133/255, 133/255);

const BLADE_LENGTH = 4.5;
const BLADE_WIDTH = 0.5;

const ROTOR_RADIUS = 0.08;
const ROTOR_HEIGHT = 0.5;

const TAIL_TIP_LENGTH = 1;
const TAIL_TIP_HEIGHT = 0.5;
const TAIL_TIP_WIDTH = 0.5;

const TAIL_LENGTH = 5;
const TAIL_HEIGHT = 0.5;
const TAIL_WIDTH = 0.5;

const SUPPORT_BEAM_LENGTH = 1.2;
const SUPPORT_BEAM_HEIGHT = 0.15;
const SUPPORT_BEAM_WIDTH = 0.15;

const LANDING_BEAM_LENGTH = 4;
const LANDING_BEAM_RADIUS = 0.30;

const BODY_LENGTH = 5;
const BODY_HEIGHT = 2;
const BODY_WIDTH = 1.5;

const HELICOPTER_MAX_HEIGHT = 60;
const HELICOPTER_LANDING_HEIGHT = HELICOPTER_MAX_HEIGHT/6;
const HELICOPTER_MIN_HEIGHT = FLOOR_HEIGHT+BODY_HEIGHT+LANDING_BEAM_RADIUS/2;
const HELICOPTER_MAX_SPEED = 0.01;
const HELICOPTER_LANDING_SPEED = HELICOPTER_MAX_SPEED/5;
const HELICOPTER_MAX_ANGLE = 30;

const BOX_SIZE = 2;
const BOX_COLOUR = vec3(194/255, 115/255, 19/255);


const VP_DISTANCE = 75;
var camera = { tetha:-30, alpha:45};
var world = {scale: 1, wind: 1, fov: 90}; 

const DEFAULT_COLOURS = {
    blade : BLADE_COLOR,
    body : BODY_COLOR,
    cylinder : CYLINDER_COLOR,
    beam: BEAM_COLOR
};
const DEFAULT_ROTATION = {
    x: 0,
    y: 270,
    z: 0
}

const DEFAULT_POS = {
    x: TRAJECTORY_RADIUS, 
    y: HELICOPTER_MIN_HEIGHT, 
    z: 0
}

const DEFAULT_ROTORS_SPEEDS = {
    mainRate: 0,
    main: 0,
    tailRate: 0,
    tail: 0
}

const HELICOPTER_ACTIONS = {
    CLIMB : 0,
    DESCENT : 1,
    FORWARD : 2,
    BACKWARD : 3
}

const DEFAULT_SCALE = 2.6;
const DEFAULT_VELOCITY = {
    movRate: 0,
    x: 0,
    y: 0
}


const DEFAULT_ACCELERATION = 0;

let helicopters = [];
let buildings = [];
let trees = [];
let clouds = [];
let boxes = [];
let selected_helicopter = 0;

var viewProjectionMatrix = mat4();

const gui = new GUI();
gui.add(camera, "tetha", -180, 180, 1).name("Tetha");
gui.add(camera, "alpha", -180, 180, 1).name("Alpha");
gui.add(world, "scale", 0, 5, 0.1).name("World Scale");
gui.add(world, "wind", 0, 10, 0.1).name("Wind");
gui.add(world, "fov", 0, 180, 1).name("FOV");

let frontView = lookAt([0,0,-1], [0, 0, 0], [0, 1, 0]);
let axometricView = frontView;
let upView = lookAt([0,1,0], [0, 0, 0], [0, 0, -1]);
let rigthView = lookAt([1,0,0], [0, 0, 0], [0, 1, 0]);
let povCamera = lookAt([1,0,0], [0, 0, 0], [0, 1, 0]);
let currentview = axometricView;
let isAxometric = true;
let isPov = false;
let drawBuildings = true;

function setup(shaders)
{
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);

    mode = gl.TRIANGLES; 

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.onkeydown = function(event) {
        console.log(event.key);
        switch(event.key) {
            case 'w':
                mode = gl.LINES; 
                break;
            case 's':
                mode = gl.TRIANGLES;
                break;
            case 'p':
                animation = !animation;
                break;
            case '+':
                if(animation) speed *= 1.1;
                break;
            case '-':
                if(animation) speed /= 1.1;
                break;
            case '1':
                currentview = axometricView;
                isAxometric = true;
                isPov = false;
                mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);
                break;
            case '2':
                currentview = frontView;
                isAxometric = false;
                isPov = false;
                mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);
                break;
            case '3':
                currentview = upView;
                isAxometric = false;
                isPov = false;
                mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);
                break;
            case '4':
                currentview = rigthView;
                isAxometric = false;
                isPov = false;
                mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);
                break;
            case '5':
                currentview = povCamera;
                isAxometric = false;
                isPov = true;
                mProjection = perspective(world.fov,aspect, 1, VP_DISTANCE*2, 4*world.fov);
                break;
            case 'ArrowUp':
                if(helicopters[selected_helicopter].pos.y < HELICOPTER_MAX_HEIGHT) {
                    helicopters[selected_helicopter].pos.y += 0.2;
                    if(helicopters[selected_helicopter].velocity.y < HELICOPTER_MAX_SPEED)
                        helicopters[selected_helicopter].velocity.y += 0.02;
                    handleHeliMovement(HELICOPTER_ACTIONS.CLIMB, helicopters[selected_helicopter]);
                }
                break;
            case 'ArrowDown':
                if(helicopters[selected_helicopter].pos.y >= HELICOPTER_MIN_HEIGHT) {
                    if(HELICOPTER_MIN_HEIGHT <= helicopters[selected_helicopter].pos.y - 0.1)
                        helicopters[selected_helicopter].pos.y -= 0.2;
                    else 
                        helicopters[selected_helicopter].pos.y = HELICOPTER_MIN_HEIGHT;
                    handleHeliMovement(HELICOPTER_ACTIONS.DESCENT, helicopters[selected_helicopter]);
                }
                if(helicopters[selected_helicopter].pos.y < HELICOPTER_LANDING_HEIGHT)
                    helicopters[selected_helicopter].velocity.x = helicopters[selected_helicopter].velocity.x*
                    (helicopters[selected_helicopter].pos.y/HELICOPTER_LANDING_HEIGHT);
                
                break;
            case 'ArrowRight':
                if(canMove(helicopters[selected_helicopter])){
                    if(helicopters[selected_helicopter].velocity.x <= 0)
                        helicopters[selected_helicopter].velocity.x = 0;
                    else
                        helicopters[selected_helicopter].velocity.x -= 0.0001;
                    handleHeliMovement(HELICOPTER_ACTIONS.BACKWARD, helicopters[selected_helicopter]);
                }
                break;
            case 'ArrowLeft':
                if(canMove(helicopters[selected_helicopter])){
                    if(helicopters[selected_helicopter].pos.y < HELICOPTER_LANDING_HEIGHT){
                        if(helicopters[selected_helicopter].velocity.x < HELICOPTER_LANDING_SPEED)
                            helicopters[selected_helicopter].velocity.x += 0.0005;
                    }
                    else {
                        if(helicopters[selected_helicopter].velocity.x < HELICOPTER_MAX_SPEED)
                            helicopters[selected_helicopter].velocity.x += 0.0001;
                    }
                    handleHeliMovement(HELICOPTER_ACTIONS.FORWARD, helicopters[selected_helicopter]);
                }
                break;
            case 'r':
                generateBox();
                break;
            case 'd':
                break;
            case 'f':
                break;
            case 'g':
                break;
            case 'b':
                drawBuildings = !drawBuildings;
                break;
            case " ":
                generateBox();
                break;
        }
    }

    gl.clearColor(17/255, 203/255, 240/255, 1.0);
    SPHERE.init(gl);
    CYLINDER.init(gl);
    CUBE.init(gl);
    PYRAMID.init(gl);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test

    helicopters.push(new HelicopterObject())
    //generateBuildings(6);
    generateTrees(NUM_TREES);
    generateClouds(NUM_CLOUDS);
    
    window.requestAnimationFrame(render);

    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
        mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);
    }

    function generateBuildings(count){
        for(let i = 0; i < count; i++){
            
            var x;
            var z;
            do {
                x = randomNumBetween(-FLOOR_SIZE/2+BUILDING_SIZE/2, FLOOR_SIZE/2-BUILDING_SIZE/2);
                z = randomNumBetween(-FLOOR_SIZE/2+BUILDING_SIZE/2, FLOOR_SIZE/2-BUILDING_SIZE/2);
            } while(isInPath(x,z))

            let build = new BuildingObject(
                {x: x, z: z},
                {height: randomNumBetween(BUILDING_MIN_HEIGHT, HELICOPTER_MAX_HEIGHT)},
                {body: vec3(randomNumBetween(0, 1), randomNumBetween(0, 1), randomNumBetween(0, 1))}
            )
            buildings.push(build);
        }
    }

    function generateTrees(count) {
        for(let i = 0; i < count; i++){
            
            var x;
            var z;
            do {
                x = randomNumBetween(-FLOOR_SIZE/2+TREE_TRUNK_RADIUS, FLOOR_SIZE/2-TREE_TRUNK_RADIUS/2);
                z = randomNumBetween(-FLOOR_SIZE/2+TREE_TRUNK_RADIUS/2, FLOOR_SIZE/2-TREE_TRUNK_RADIUS/2);
            } while(isInPath(x,z) || treeOverlaps(x, z))

            let tree = new TreeObject(
                {x: x, z: z},
                {height: randomNumBetween(TREE_MIN_HEIGHT, TREE_MAX_HEIGHT),
                logRadius: randomNumBetween(2, 4)},
                {logColour: vec3(randomNumBetween(140/255, 150/255), randomNumBetween(50/255, 100/255), randomNumBetween(0, 40/255)),
                leafColour: vec3(randomNumBetween(20/255, 50/255), randomNumBetween(50/255, 130/255), 0)},
                {shakeOffset: randomNumBetween(0, Math.PI*2), shakeRate: 0}
            )
            trees.push(tree);
        }
    }

    function isInPath(x, z) {
        return((Math.pow(x,2) + Math.pow(z,2)) < Math.pow(1.5*TRAJECTORY_RADIUS,2));
    }

    function treeOverlaps(x, z) {
        for(var i=0; i<trees.length; i++) {
            var dist = Math.sqrt(Math.pow(trees[i].pos.x - x, 2) + Math.pow(trees[i].pos.z - z,2));
            if(dist < 2*TREE_LEAF_WIDTH)
                return true;
        }
        return false;
    }

    function generateClouds(count) {
        for(let i = 0; i < count; i++){

            let cloud = new CloudObject(
                {x: randomNumBetween(-FLOOR_SIZE/2, FLOOR_SIZE/2), z: randomNumBetween(-FLOOR_SIZE/2, FLOOR_SIZE/2)},
                randomNumBetween(0, 180),
                randomNumBetween(CLOUD_RADIUS*0.5, CLOUD_RADIUS*2.0),
                randomNumBetween(0.5, 1.5));
            
            clouds.push(cloud);
        }
    }

    function generateBox() {
        let box = new BoxObject()
        box.pos.x = helicopters[selected_helicopter].pos.x;
        box.pos.y = helicopters[selected_helicopter].pos.y;
        box.pos.z = helicopters[selected_helicopter].pos.z;
        box.rotations.y = helicopters[selected_helicopter].rotations.y;
        box.velocity.xMovRate = helicopters[selected_helicopter].velocity.movRate;
        box.velocity.x = helicopters[selected_helicopter].velocity.x;
        box.velocity.y = helicopters[selected_helicopter].velocity.y;
        boxes.push(box);
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(mult(viewProjectionMatrix, modelView())));
    }

    function canMove(heli){
        return heli.isInAir;
    }
/*
    function getMinPossibleHeight(pos){
        return FLOOR_HEIGHT+BODY_HEIGHT;
    }
*/

    function blade(heli) {
        updateColor(heli.colours.blade);
        multScale([BLADE_LENGTH, 0.1, BLADE_WIDTH]);
        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function rotor(heli) {
        multRotationY(heli.rotors_speeds.mainRate);
        pushMatrix();
            updateColor(heli.colours.cylinder);
            multScale([ROTOR_RADIUS, ROTOR_HEIGHT, ROTOR_RADIUS]);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
        popMatrix()
        pushMatrix();
            multRotationY(360/3);
            multTranslation([BLADE_LENGTH/2, ROTOR_HEIGHT/2, 0]);
            blade(heli);
        popMatrix();
        pushMatrix();
            multRotationY(360*2/3);
            multTranslation([BLADE_LENGTH/2, ROTOR_HEIGHT/2, 0]);
            blade(heli);
        popMatrix();
        pushMatrix();
            multRotationY(360*3/3);
            multTranslation([BLADE_LENGTH/2, ROTOR_HEIGHT/2, 0]);
            blade(heli);
        popMatrix();
    }

    function tailRotor(heli) {
        multRotationY(heli.rotors_speeds.tailRate);
        pushMatrix();
            updateColor(heli.colours.cylinder);
            multScale([ROTOR_RADIUS, ROTOR_HEIGHT/2, ROTOR_RADIUS]);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
        popMatrix()
        pushMatrix();
            pushMatrix();
                multScale([1/6, 1, 1/3]);
                multRotationY(360);
                multTranslation([BLADE_LENGTH/2, ROTOR_HEIGHT/8, 0]);
                blade(heli);
            popMatrix();
            pushMatrix();
                multScale([1/6, 1, 1/3]);
                multRotationY(360/2);
                multTranslation([BLADE_LENGTH/2, ROTOR_HEIGHT/8, 0]);
                blade(heli);
            popMatrix();
        popMatrix();
    }

    function tailTip(heli) {
        pushMatrix();
            updateColor(heli.colours.body);
            multScale([TAIL_TIP_LENGTH, TAIL_TIP_HEIGHT, TAIL_TIP_WIDTH]);
            uploadModelView();
            SPHERE.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            multTranslation([0, 0, TAIL_TIP_WIDTH/2]);
            multRotationX(90);
            tailRotor(heli);
        popMatrix();
    }

    function tail(heli) {
        pushMatrix();
            pushMatrix();
                updateColor(heli.colours.body);
                multScale([TAIL_LENGTH, TAIL_HEIGHT, TAIL_WIDTH]);
                uploadModelView();
                SPHERE.draw(gl, program, mode);
            popMatrix();
            pushMatrix();
                multTranslation([TAIL_LENGTH/2, TAIL_HEIGHT*(2/3), 0]);
                multRotationZ(65);
                tailTip(heli);
            popMatrix();
        popMatrix();
    }

    function supportBeam(heli) {
        updateColor(heli.colours.beam);
        pushMatrix();
            multScale([SUPPORT_BEAM_LENGTH, SUPPORT_BEAM_HEIGHT, SUPPORT_BEAM_WIDTH]);
            multRotationZ(90);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
    }

    function landingBeam(heli) {
        updateColor(heli.colours.cylinder);
        pushMatrix();
            multScale([LANDING_BEAM_LENGTH, LANDING_BEAM_RADIUS, LANDING_BEAM_RADIUS]);
            multRotationZ(90);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
        popMatrix();
    }

    function landingStructure(heli) {
        pushMatrix()
            pushMatrix();
                multTranslation([-LANDING_BEAM_LENGTH/5, SUPPORT_BEAM_LENGTH*(3/8), -SUPPORT_BEAM_WIDTH]);
                multRotationZ(55);
                multRotationY(20);
                supportBeam(heli);
            popMatrix();
            pushMatrix();
                multTranslation([LANDING_BEAM_LENGTH/5, SUPPORT_BEAM_LENGTH*(3/8), -SUPPORT_BEAM_WIDTH]);
                multRotationZ(-55);
                multRotationY(-20);
                supportBeam(heli);
            popMatrix();
            pushMatrix();
                landingBeam(heli);
            popMatrix();
        popMatrix();
    }

    function landingGear(heli) {
        pushMatrix();
            pushMatrix();
                multTranslation([0, -BODY_HEIGHT*(5/7), BODY_WIDTH/2]);
                landingStructure(heli);
            popMatrix();
            pushMatrix();
                multTranslation([0, -BODY_HEIGHT*(5/7), -BODY_WIDTH/2]);
                multScale([-1, 1, -1]);
                landingStructure(heli);
            popMatrix();
        popMatrix();
    }


    function helicopterBody(heli) {
        pushMatrix();
            pushMatrix();
                updateColor(heli.colours.body);
                multScale([BODY_LENGTH, BODY_HEIGHT, BODY_WIDTH]);
                uploadModelView();
                SPHERE.draw(gl, program, mode);
            popMatrix();
            pushMatrix();
                multTranslation([TAIL_LENGTH*(3/4), BODY_HEIGHT/8, 0]);
                tail(heli);
            popMatrix();
            pushMatrix();
                multTranslation([BODY_LENGTH*(1/14), BODY_HEIGHT/2, 0]);
                rotor(heli);
            popMatrix();
            pushMatrix();
                landingGear(heli);
            popMatrix();
        popMatrix();
    }

    function helicopter(heli)
    {
        pushMatrix();
            multTranslation([heli.pos.x, heli.pos.y, heli.pos.z]);
            multRotationX(heli.rotations.x);
            multRotationY(heli.rotations.y);
            multRotationZ(heli.rotations.z);
            multScale([heli.scale, heli.scale, heli.scale]);
            uploadModelView();
            helicopterBody(heli);
        popMatrix();
    }

    function leafs(color) {
        pushMatrix();
            updateColor(color);
            uploadModelView();
            PYRAMID.draw(gl, program, mode);
        popMatrix();
    }

    function tree(tree) {
        pushMatrix();
        multTranslation([tree.pos.x, FLOOR_HEIGHT/2 + tree.dimensions.height*(1/12), tree.pos.z]);
            pushMatrix();
                updateColor(tree.colour.logColour);
                multScale([tree.dimensions.logRadius, tree.dimensions.height*(1/6), tree.dimensions.logRadius]);
                uploadModelView();
                CYLINDER.draw(gl, program, mode);
            popMatrix();
            pushMatrix();
                tree.shake.shakeRate += world.wind*0.01;
                multRotationX(Math.sin(tree.shake.shakeOffset + tree.shake.shakeRate)*world.wind*0.2);
                pushMatrix();
                    multTranslation([0, tree.dimensions.height/2, 0]);
                    multScale([ TREE_LEAF_WIDTH, tree.dimensions.height*(5/6), TREE_LEAF_WIDTH]);
                    leafs(tree.colour.leafColour);
                popMatrix();
                pushMatrix();
                    multTranslation([0, tree.dimensions.height/2, 0]);
                    multRotationY(360/3);
                    multScale([ TREE_LEAF_WIDTH, tree.dimensions.height*(5/6), TREE_LEAF_WIDTH]);
                    leafs(tree.colour.leafColour);
                popMatrix();
                pushMatrix();
                    multTranslation([0, tree.dimensions.height/2, 0]);
                    multRotationY(360*(2/3));
                    multScale([ TREE_LEAF_WIDTH, tree.dimensions.height*(5/6), TREE_LEAF_WIDTH]);
                    leafs(tree.colour.leafColour);
                popMatrix();
            popMatrix();
        popMatrix();
    }

    function frogCroack() {
        pushMatrix();
            updateColor(CROACK_COLOUR);
            uploadModelView();
            SPHERE.draw(gl, program, mode);
        popMatrix();
    }

    function frogHead() {
        pushMatrix();
            updateColor(FROG_COLOUR);
            multScale([FROG_LENGTH*(2/3), FROG_RADIUS*(2/3), FROG_RADIUS]);
            uploadModelView();
            SPHERE.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            multTranslation([0, FROG_RADIUS*(2/6), FROG_RADIUS/4]);
            multScale([1, 1/2, 1]);
            eye();
        popMatrix();
        pushMatrix();
            multTranslation([0, FROG_RADIUS*(2/6), -FROG_RADIUS/4]);
            multScale([1, 1/2, 1]);
            eye();
        popMatrix();
        pushMatrix();
            var croackRate = 0.9 + Math.pow(Math.sin(time*2), 2);
            multTranslation([-FROG_LENGTH*(2/12) + croackRate/3, -FROG_RADIUS*(2/6),0]);
            multScale([croackRate, croackRate, croackRate])
            frogCroack();
        popMatrix();
    }

    function frogLeg() {
        pushMatrix();
            updateColor(FROG_COLOUR);
            multScale([ FROG_RADIUS/4, FROG_LENGTH*(3/4), FROG_RADIUS/4]);
            uploadModelView();
            SPHERE.draw(gl, program, mode);
        popMatrix();
    }

    function frog() {
        pushMatrix();
            updateColor(FROG_COLOUR);
            multRotationZ(30);
            multScale([FROG_LENGTH, FROG_RADIUS, FROG_RADIUS]);
            uploadModelView();
            SPHERE.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            multTranslation([FROG_LENGTH/2, FROG_LENGTH/3, 0]);
            frogHead();
        popMatrix();
        pushMatrix();
            multTranslation([FROG_LENGTH/4, -FROG_RADIUS/6, FROG_RADIUS/3]);
            multScale([3/4, 3/4, 3/4]);
            frogLeg();
        popMatrix();
        pushMatrix();
            multTranslation([FROG_LENGTH/4, -FROG_RADIUS/6, -FROG_RADIUS/3]);
            multScale([3/4, 3/4, 3/4]);
            frogLeg();
        popMatrix();
        pushMatrix();
            multTranslation([-FROG_LENGTH/4, -FROG_RADIUS/6, -FROG_RADIUS/2]);
            multRotationX(-20);
            multRotationZ(-20);
            frogLeg();
        popMatrix();
        pushMatrix();
            multTranslation([-FROG_LENGTH/4, -FROG_RADIUS/6, FROG_RADIUS/2]);
            multRotationX(20);
            multRotationZ(-20);
            frogLeg();
        popMatrix();

    }

    function lily() {
        pushMatrix();
            updateColor(LILY_COLOUR);
            multScale([LILY_DIAMETER, LILY_WIDTH, LILY_DIAMETER]);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
        popMatrix();
    }

    function lilies() {
        pushMatrix();
            multTranslation([0, 0, Math.sin(1.0 + time*2)]);
            lily();
        popMatrix();
        pushMatrix();
            multTranslation([LILY_DIAMETER*2, 0, Math.sin(time*2)]);
            pushMatrix() 
                multScale([LILY_DIAMETER*(3/5), 0, LILY_DIAMETER*(3/5)]);
                lily();
            popMatrix();
            pushMatrix();
                multTranslation([0, FROG_LENGTH/3, 0]);
                multRotationY(90);
                frog();
            popMatrix();
        popMatrix();
        
    }

    function fin() {
        pushMatrix();
            updateColor(FISH_COLOUR);
            multScale([ FISH_FIN_HEIGHT, FISH_FIN_LENGTH, FISH_FIN_WIDTH]);
            uploadModelView();
            SPHERE.draw(gl, program, mode);
        popMatrix();
    }

    function eye(){
        pushMatrix();
            updateColor(EYE_COLOUR);
            multScale([EYE_RADIUS, EYE_RADIUS, EYE_RADIUS]);
            uploadModelView();
            SPHERE.draw(gl, program, mode);
        popMatrix();
    }

    function fish() {
        pushMatrix();
            updateColor(FISH_COLOUR);
            multScale([FISH_LENGTH, FISH_HEIGHT, FISH_WIDTH]);
            uploadModelView();
            SPHERE.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            multTranslation([FISH_LENGTH/9, -FISH_HEIGHT/3, -FISH_WIDTH/2]);
            multRotationZ(-10);
            multRotationX(10);
            fin();
        popMatrix();
        pushMatrix();
            multTranslation([FISH_LENGTH/9, -FISH_HEIGHT/3, FISH_WIDTH/2]);
            multRotationZ(-10);
            multRotationX(-10);
            fin();
        popMatrix();
        pushMatrix();
            multTranslation([-FISH_LENGTH/2, 0, 0]);
            multRotationZ(-70);
            multScale([2, 2, 2]);
            fin();
        popMatrix();
        pushMatrix();
            multTranslation([-FISH_LENGTH/2, 0, 0]);
            multRotationZ(70);
            multScale([2, 2, 2]);
            fin();
        popMatrix();
        pushMatrix();
            multTranslation([FISH_LENGTH/4, FISH_HEIGHT/4, FISH_WIDTH/4]);
            eye();
        popMatrix();
        pushMatrix();
            multTranslation([FISH_LENGTH/4, FISH_HEIGHT/4, -FISH_WIDTH/4]);
            eye();
        popMatrix();
    }

    function jumpingFish() {
        pushMatrix();
            multRotationZ(-time * FISH_JUMP_SPEED);
            multTranslation([FISH_JUMP_RADIUS, 0, 0]);
            multRotationZ(-90);
            fish();
        popMatrix();
    }

    function reedTop() {
        pushMatrix();
            updateColor(REED_TOP_COLOUR);
            multScale([REED_TOP_RADIUS, REED_TOP_LENGTH, REED_TOP_RADIUS]);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
        popMatrix();
    }


    function reedLeaf() {
        pushMatrix();
            updateColor(REED_COLOUR);
            multScale([REED_LEAF_LENGTH, REED_LEAF_HEIGHT, REED_LEAF_WIDTH]);
            uploadModelView();
            SPHERE.draw(gl, program, mode);
        popMatrix();
    }

    function reed() {
        pushMatrix();
            multTranslation([0, REED_LENGTH/2, 0]);
            pushMatrix();
                updateColor(REED_COLOUR);
                multScale([REED_RADIUS, REED_LENGTH, REED_RADIUS]);
                uploadModelView();
                CYLINDER.draw(gl, program, mode);
            popMatrix();
            pushMatrix();
                multTranslation([0, REED_LENGTH/2, 0]);
                reedTop();
            popMatrix();
            pushMatrix();
                multRotationZ(45);
                multTranslation([REED_LEAF_LENGTH/2, 0, 0]);
                reedLeaf();
            popMatrix();
        popMatrix();
    }

    function reedGroup() {
        pushMatrix();
            multTranslation([1, 0, 0]);
            multRotationX(-5 * Math.sin(time*2));
            multScale([1.1, 1.1, 1.1]);
            reed();
        popMatrix();
        pushMatrix();
            multTranslation([-1, 0, -2]);
            multRotationZ(5 * Math.cos(time*2));
            multRotationY(150);
            reed();
        popMatrix();
        pushMatrix();
            multTranslation([-1, 0, 0]);
            multRotationX(2.5 * Math.sin(1 +time*2));
            multRotationZ(2.5 * Math.sin(1 +time*2));
            multRotationY(270);
            reed();
        popMatrix();
    }

    function lake() {
        pushMatrix();
            updateColor(LAKE_COLOUR);
            multScale([LAKE_DIAMETER, LAKE_WIDTH, LAKE_DIAMETER]);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            multTranslation([0, LAKE_WIDTH, 0]);
            pushMatrix();
                multTranslation([LAKE_DIAMETER*(1/4), 0, LAKE_DIAMETER*(1/4)]);
                lilies();
            popMatrix();
            pushMatrix();
                multTranslation([LAKE_DIAMETER*(-1/6) + Math.sin(2.0 + time*2), 0, LAKE_DIAMETER*(-1/3)]);
                lily();
            popMatrix();
            pushMatrix();
                multTranslation([-LAKE_DIAMETER/4, 0, LAKE_DIAMETER/3]);
                reedGroup();
            popMatrix();
            pushMatrix();
                multTranslation([-LAKE_DIAMETER/3, 0, -LAKE_DIAMETER/3]);
                multRotationY(90);
                reedGroup();
            popMatrix();
        popMatrix();
        popMatrix();
                multTranslation([LAKE_DIAMETER*(-1/6), 0, LAKE_DIAMETER*(1/8 )]);
                multRotationY(-45);
                jumpingFish();
        pushMatrix();

    }

    function cloud(c) {
        pushMatrix();
            multTranslation([c.pos.x, CLOUD_HEIGHT, c.pos.z]);
            multRotationY(c.rotation);
            pushMatrix();
                updateColor(CLOUD_COLOUR);
                multScale([c.scale*2, c.scale*2, c.scale*2]);
                uploadModelView();
                SPHERE.draw(gl, program, mode);
            popMatrix();
            pushMatrix();
                updateColor(CLOUD_COLOUR);
                multTranslation([c.scale, 0, 0]);
                multScale([c.scale*1.5, c.scale*1.5, c.scale*1.5]);
                uploadModelView();
                SPHERE.draw(gl, program, mode);
            popMatrix();
            pushMatrix();
                updateColor(CLOUD_COLOUR);
                multTranslation([-c.scale, 0, 0]);
                multScale([c.scale*1.25, c.scale*1.25, c.scale*1.25]);
                uploadModelView();
                SPHERE.draw(gl, program, mode);
            popMatrix();
        popMatrix();
    }

    function floor() {
        pushMatrix();
            updateColor(FLOOR_COLOR);
            multScale([FLOOR_SIZE, FLOOR_HEIGHT, FLOOR_SIZE]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            for(const t of trees)
                tree(t);
        popMatrix();
        pushMatrix();
            multTranslation([0, FLOOR_HEIGHT/2, 0])
            lake();
        popMatrix();
    }


    function heliBox(box) {
        pushMatrix();
            updateColor(box.colour);
            multTranslation([box.pos.x, box.pos.y, box.pos.z]);
            multRotationY(box.rotations.y);
            multScale([box.dimensions.length, box.dimensions.height, box.dimensions.width]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
    }

    function render()
    {
        if(animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
        
        loadMatrix(currentview);

        if(isAxometric){
            currentview = axometricView;
            multRotationX(camera.tetha);
            multRotationY(camera.alpha);
        } 
        if(isPov){
            mProjection = perspective(world.fov,aspect, 1, 4*world.fov);
            let zx = helicopters[0].rotations.y;
            let eye = [helicopters[0].pos.x, helicopters[0].pos.y+10, helicopters[0].pos.z];
            let at = [helicopters[0].pos.x+10*Math.sin(degToRad(zx+270)), helicopters[0].pos.y, helicopters[0].pos.z+10*Math.cos(degToRad(zx+270))];
            let up = [0, 1, 0];
            currentview = lookAt(eye, at, up);
        }

        uploadModelView();

        multScale([world.scale, world.scale, world.scale]);

        
        pushMatrix();
            floor();
        popMatrix();
        for(const heli of helicopters){
            pushMatrix();
                if(animation) {
                    if(heli.velocity.x > 0)
                        heli.velocity.x -= 0.00005;
                    updateHeliPos(heli)
                }
                helicopter(heli);
            popMatrix();
        }
        for(const box of boxes) {
            pushMatrix();
                if(animation)
                    updateBoxPos(box)
                heliBox(box);
            popMatrix();
        }
        for(const c of clouds) {
            pushMatrix();
                if(animation)
                    updateClouds(c);
                cloud(c);
            popMatrix();
        }

    }

    function updateColor(color) {
        gl.useProgram(program);
        const uColor = gl.getUniformLocation(program, "uColor");
        gl.uniform3fv(uColor, color);
    }

    function updateHeliPos(heli) {
        if(heli.isInAir){
            let x = heli.pos.x;
            let z = heli.pos.z;
            let zx = (Math.atan2(-z,x) * 360) / (2*Math.PI) + 270;
            zx %= 360;
    
            heli.rotations.z = (HELICOPTER_MAX_ANGLE * heli.velocity.x)/HELICOPTER_MAX_SPEED;
            heli.rotations.y = zx;
            heli.rotations.x = (10 * heli.velocity.x)/HELICOPTER_MAX_SPEED;  
    
            if(heli.rotors_speeds.main < MAIN_ROTOR_MAX_SPEED)
            heli.rotors_speeds.main += heli.velocity.x;
            heli.rotors_speeds.mainRate += heli.rotors_speeds.main;
    
            if(heli.rotors_speeds.tail < TAIL_ROTOR_MAX_SPEED)
            heli.rotors_speeds.tail += heli.velocity.x;
            heli.rotors_speeds.tailRate += heli.rotors_speeds.tail;
    
            heli.velocity.movRate += heli.velocity.x;
            heli.pos.x = Math.cos(heli.velocity.movRate) * TRAJECTORY_RADIUS;
            heli.pos.z = Math.sin(-heli.velocity.movRate) * TRAJECTORY_RADIUS;
    
            heli.pos.x += Math.cos(time)*0.1*Math.max(1, world.wind);
            heli.pos.y += Math.cos(time)*0.0005*Math.max(1, world.wind);
            heli.pos.z += Math.cos(time)*0.1*Math.max(1, world.wind);
        }
        else{
            if(heli.rotors_speeds.main > 0){
                heli.rotors_speeds.main -= 0.01;
                heli.rotors_speeds.mainRate += heli.rotors_speeds.main;
            }
    
            if(heli.rotors_speeds.tail > 0){
                heli.rotors_speeds.tail -= 0.01;
                heli.rotors_speeds.tailRate += heli.rotors_speeds.tail;
            }
            heli.rotors_speeds.main = Math.max(heli.rotors_speeds.main, 0)
            heli.rotors_speeds.tail = Math.max(heli.rotors_speeds.tail, 0)
        }
    }

    function handleHeliMovement(action, heli){
        let x = heli.pos.x;
        let z = heli.pos.z;
        let zx = (Math.atan2(-z,x) * 360) / (2*Math.PI) + 270;
        zx %= 360;

        switch (action){
            case HELICOPTER_ACTIONS.CLIMB:
                if(!heli.isInAir){
                    heli.rotors_speeds.main = 2;
                    heli.rotors_speeds.tail = 4;
                    heli.isInAir = true;
                }
                
                if(heli.rotors_speeds.main < MAIN_ROTOR_MAX_SPEED)
                    heli.rotors_speeds.main += heli.velocity.y;
                heli.rotors_speeds.mainRate += heli.rotors_speeds.main;

                if(heli.rotors_speeds.tail < TAIL_ROTOR_MAX_SPEED)
                    heli.rotors_speeds.tail += heli.velocity.y;
                heli.rotors_speeds.tailRate += heli.rotors_speeds.tail;
                break;

            case HELICOPTER_ACTIONS.DESCENT:

                if(heli.rotors_speeds.main < MAIN_ROTOR_MAX_SPEED)
                    heli.rotors_speeds.main -= heli.velocity.y;
                heli.rotors_speeds.mainRate += heli.rotors_speeds.main;

                if(heli.rotors_speeds.tail < TAIL_ROTOR_MAX_SPEED)
                    heli.rotors_speeds.tail -= heli.velocity.y;
                heli.rotors_speeds.tailRate += heli.rotors_speeds.tail;

                if(heli.pos.y <= HELICOPTER_MIN_HEIGHT)
                    heli.isInAir = false;
                
                break;

            case HELICOPTER_ACTIONS.FORWARD:
                heli.rotations.z = (HELICOPTER_MAX_ANGLE * heli.velocity.x)/HELICOPTER_MAX_SPEED;
                heli.rotations.y = zx;
                heli.rotations.x = (10 * heli.velocity.x)/HELICOPTER_MAX_SPEED;

                if(heli.rotors_speeds.main < MAIN_ROTOR_MAX_SPEED)
                    heli.rotors_speeds.main += heli.velocity.x;
                heli.rotors_speeds.mainRate += heli.rotors_speeds.main;

                if(heli.rotors_speeds.tail < TAIL_ROTOR_MAX_SPEED)
                    heli.rotors_speeds.tail += heli.velocity.x;
                heli.rotors_speeds.tailRate += heli.rotors_speeds.tail;
            

                heli.velocity.movRate += heli.velocity.x;
                heli.pos.x = Math.cos(heli.velocity.movRate) * TRAJECTORY_RADIUS;
                heli.pos.z = Math.sin(-heli.velocity.movRate) * TRAJECTORY_RADIUS;
                break;
            case HELICOPTER_ACTIONS.BACKWARD:
                heli.rotations.z = (HELICOPTER_MAX_ANGLE * heli.velocity.x)/HELICOPTER_MAX_SPEED;
                heli.rotations.y = zx;
                
                if(heli.rotors_speeds.main < MAIN_ROTOR_MAX_SPEED)
                    heli.rotors_speeds.main -= heli.velocity.x;
                heli.rotors_speeds.mainRate += heli.rotors_speeds.main;
heli.rotations.x = (10 * heli.velocity.x)/HELICOPTER_MAX_SPEED;

                if(heli.rotors_speeds.tail < TAIL_ROTOR_MAX_SPEED)
                    heli.rotors_speeds.tail -= heli.velocity.x;
                heli.rotors_speeds.tailRate += heli.rotors_speeds.tail;
        
                heli.velocity.movRate += heli.velocity.x;
                heli.pos.x = Math.cos(heli.velocity.movRate) * TRAJECTORY_RADIUS;
                heli.pos.z = Math.sin(-heli.velocity.movRate) * TRAJECTORY_RADIUS;
                break;
        }
    }

    function updateClouds(c) {
        c.pos.z+=c.speed*CLOUD_MOVE_SPEED * world.wind;
        if(c.pos.z > FLOOR_SIZE*2) {
            c.pos.x = randomNumBetween(-FLOOR_SIZE/2, FLOOR_SIZE/2);
            c.pos.z = -FLOOR_SIZE*2;
            c.rotation = randomNumBetween(0, 180);
            c.scale = randomNumBetween(CLOUD_RADIUS*0.5, CLOUD_RADIUS*2.0);
            c.speed = randomNumBetween(0.5, 1.5);
        }
    }

    function updateBoxPos(box) {
        if(box.life < 5) {
            box.life = time - box.startTime
            if(box.pos.y > FLOOR_HEIGHT/2 + box.dimensions.height/2) {
                box.velocity.y = box.velocity.y*GRAVITY;
                box.velocity.yMovRate += box.velocity.y;
                box.pos.y -= box.velocity.yMovRate;

                box.pos.x += box.velocity.x * Math.sin(degToRad(box.rotations.y+270)) * 20;
                box.pos.z += box.velocity.x * Math.cos(degToRad(box.rotations.y+270)) * 20;
            }
            else
                box.pos.y = FLOOR_HEIGHT/2 + box.dimensions.height/2;
        } else
            boxes.splice(boxes.indexOf(box),1);
    }

    /**
     * Returns a random number between max (inclusive) and min (inclusive)
     * @param {*} min min value
     * @param {*} max min value
     * @returns a random number between max (inclusive) and min (inclusive)
     */
    function randomNumBetween(min, max) {
        return Math.random()*(max-min) + min;
    }

    function radToDeg(angle){
        return (angle * 360) / 2 * Math.PI;
    }

    function degToRad(angle){
        return (angle * 2 * Math.PI) / 360;
    }
}

class HelicopterObject {

    constructor(){
        this.pos = DEFAULT_POS
        this.colours = DEFAULT_COLOURS
        this.rotations = DEFAULT_ROTATION
        this.velocity = DEFAULT_VELOCITY
        this.acceleration = DEFAULT_ACCELERATION
        this.rotors_speeds = DEFAULT_ROTORS_SPEEDS
        this.scale = DEFAULT_SCALE
        this.count = 0;
        this.isInAir = false;
        this.objects = [];
    }
}

class BoxObject{
    constructor() {
        this.pos = {x:0, y:0, z:0};
        this.colour = BOX_COLOUR;
        this.dimensions = {length: BOX_SIZE, height:BOX_SIZE, width:BOX_SIZE};
        this.velocity = {xMovRate: 0, x: 0, yMovRate: 0, y: 0};
        this.rotations = {y: 0};
        this.life = 0;
        this.startTime = time;
    }
}

class BuildingObject {

    constructor(pos, dimensions, colours, scale=1){
        this.pos = pos
        this.dimensions = dimensions
        this.colours = colours
        this.scale = scale
    }
}

class TreeObject {
    constructor(pos, dimensions, colour, shake, scale=1,) {
        this.pos = pos
        this.dimensions = dimensions
        this.colour = colour
        this.scale = scale
        this.shake = shake
    }
}

class CloudObject {
    constructor(pos, rotation, scale, speed) {
        this.pos = pos
        this.rotation = rotation
        this.scale = scale
        this.speed = speed
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))