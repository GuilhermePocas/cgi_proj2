import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../libs/utils.js";
import { ortho, lookAt, flatten, mult, mat4, vec4, vec3, inverse } from "../libs/MV.js";
import { GUI } from "../libs/dat.gui.module.js";
import {modelView, loadMatrix, multRotationY, multRotationX, multRotationZ, multTranslation, multScale, pushMatrix, popMatrix, multMatrix  } from "../libs/stack.js";

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


const HELICOPTER_LENGHT = 10;
const TRAJECTORY_RADIUS = 30;

const HELICOPTER_MAX_HEIGHT = 60;
const HELICOPTER_MIN_HEIGHT = 3.15;
var helicopterCurrentHeight = 10;
const HELICOPTER_MAX_SPEED = 100;
var helicopterCurrentSpeed = HELICOPTER_MAX_SPEED * helicopterCurrentHeight/HELICOPTER_MAX_HEIGHT;
const HELICOPTER_MAX_ANGLE = 30;
var helicopterCurrentAngle = HELICOPTER_MAX_ANGLE * helicopterCurrentHeight/HELICOPTER_MAX_HEIGHT;

const MAIN_ROTOR_MAX_SPEED = 2000;
var mainRotorCurrentSpeed = MAIN_ROTOR_MAX_SPEED * helicopterCurrentHeight/HELICOPTER_MAX_HEIGHT;
const TAIL_ROTOR_MAX_SPEED = 3000;
var tailRotorCurrentSpeed = TAIL_ROTOR_MAX_SPEED * helicopterCurrentHeight/HELICOPTER_MAX_HEIGHT;

const BODY_COLOR = vec3(207/255, 25/255, 25/255);
const BLADE_COLOR = vec3(17/255, 203/255, 240/255);
const CYLINDER_COLOR = vec3(227/255, 182/255, 20/255);
const BEAM_COLOR = vec3(133/255, 133/255, 133/255);
const FLOOR_COLOR = vec3(71/255, 133/255, 46/255);

const BLADE_LENGTH = 50;
const BLADE_WIDTH = 5;

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

const BODY_LENGHT = 5;
const BODY_HEIGHT = 2;
const BODY_WIDTH = 1.5;

const FLOOR_SIZE = 120;
const FLOOR_HEIGHT = 3;

const BUILDING_SIZE = 15;
const BUILDING_MIN_HEIGHT = 10;
const BUILDING_MAX_HEIGHT = HELICOPTER_MAX_HEIGHT-2;

const VP_DISTANCE = 70;
var currColor = vec3(0,0,0);
var camera = { tetha:-30, alpha:45, betha:0};
var world = {scale: 1}; 

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
    y: HELICOPTER_MIN_HEIGHT, z: 0
}

const DEFAULT_ROTORS_SPEEDS = {
    main: 500,
    tail: 500
}

const HELICOPTER_ACTIONS = {
    CLIMB : 0,
    DESCENT : 1,
    FORWARD : 2,
    BACKWARD : 3
}

const DEFAULT_SCALE = 1;
const DEFAULT_VELOCITY = {
    x: 0,
    y: 1
}

const DEFAULT_ACCELERATION = 0;

let helicopters = [];
let buildings = [];
let selected_helicopter = 0;

const gui = new GUI();
gui.add(camera, "tetha", -180, 180, 1).name("Tetha");
gui.add(camera, "alpha", -180, 180, 1).name("Alpha");
gui.add(camera, "betha", -180, 180, 1).name("Betha");
gui.add(world, "scale", 0, 5, 0.1).name("World Scale");

let frontView = lookAt([0,0,-1], [0, 0, 0], [0, 1, 0]);
let axometricView = frontView;
let upView = lookAt([0,1,0], [0, 0, 0], [0, 0, -1]);
let rigthView = lookAt([1,0,0], [0, 0, 0], [0, 1, 0]);
let currentview = axometricView;
let isAxometric = true;

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
                break;
            case '2':
                currentview = frontView;
                isAxometric = false;
                break;
            case '3':
                currentview = upView;
                isAxometric = false;
                break;
            case '4':
                currentview = rigthView;
                isAxometric = false;
                break;
            case 'ArrowUp':
                if(helicopters[selected_helicopter].pos.y < HELICOPTER_MAX_HEIGHT) {
                    helicopters[selected_helicopter].isInAir = true;
                    helicopters[selected_helicopter].pos.y += 0.1;
                    updateHeliPos(HELICOPTER_ACTIONS.CLIMB, helicopters[selected_helicopter]);
                }
                break;
            case 'ArrowDown':
                let minHeight = getMinPossibleHeight(helicopters[selected_helicopter].pos);
                if(helicopters[selected_helicopter].pos.y > minHeight) {
                    if(minHeight+0.25 <= helicopters[selected_helicopter].pos.y - 0.25)
                        helicopters[selected_helicopter].pos.y -= 0.25;
                    else
                    helicopters[selected_helicopter].pos.y = minHeight;
                    updateHeliPos(HELICOPTER_ACTIONS.DESCENT, helicopters[selected_helicopter]);
                }
                break;
            case 'ArrowRight':
                if(canMove(helicopters[selected_helicopter])){
                    helicopters[selected_helicopter].velocity += 0.01;
                    console.log("bruh");
                }
                break;
            case 'ArrowLeft':
                updateHeliPos(HELICOPTER_ACTIONS.BACKWARD, helicopters[selected_helicopter]);
                break;
            case 'r':
                break;
            case 'd':
                break;
            case 'f':
                break;
            case 'g':
                break;
        }
    }

    gl.clearColor(0.0, 0.5, 1.0, 1.0);
    SPHERE.init(gl);
    CYLINDER.init(gl);
    CUBE.init(gl);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test

    helicopters.push(new HelicopterObject())
    generateBuildings(6);
    
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
            let build = new BuildingObject(
                {x: randomNumBetween(-FLOOR_SIZE/2+BUILDING_SIZE/2, FLOOR_SIZE/2-BUILDING_SIZE/2), y: FLOOR_HEIGHT, z: randomNumBetween(-FLOOR_SIZE/2+BUILDING_SIZE/2, FLOOR_SIZE/2-BUILDING_SIZE/2)},
                {height: randomNumBetween(BUILDING_MIN_HEIGHT, HELICOPTER_MAX_HEIGHT)},
                {body: vec3(randomNumBetween(0, 1), randomNumBetween(0, 1), randomNumBetween(0, 1))}
            )
            buildings.push(build);
        }
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function canMove(heli){
        return heli.isInAir;
    }

    function getMinPossibleHeight(pos){
        return HELICOPTER_MIN_HEIGHT;
    }

    function blade(heli) {
        updateColor(heli.colours.blade);
        multScale([BLADE_LENGTH, 0.1, BLADE_WIDTH]);
        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function rotor(heli) {
        pushMatrix();
            updateColor(heli.colours.cylinder);
            multScale([ROTOR_RADIUS, ROTOR_HEIGHT, ROTOR_RADIUS]);
            multRotationY(heli.rotors_speeds.main * time);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
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
        popMatrix();
    }

    function tailRotor(heli) {
        pushMatrix();
            updateColor(heli.colours.cylinder);
            multScale([ROTOR_RADIUS, ROTOR_HEIGHT/2, ROTOR_RADIUS]);
            multRotationY(heli.rotors_speeds.tail * time);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
            pushMatrix();
                pushMatrix();
                    multScale([1/6, 1, 1/3]);
                    multRotationY(360);
                    multTranslation([BLADE_LENGTH/2, ROTOR_HEIGHT/2, 0]);
                    blade(heli);
                popMatrix();
                pushMatrix();
                    multScale([1/6, 1, 1/3]);
                    multRotationY(360/2);
                    multTranslation([BLADE_LENGTH/2, ROTOR_HEIGHT/2, 0]);
                    blade(heli);
                popMatrix();
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
                multScale([BODY_LENGHT, BODY_HEIGHT, BODY_WIDTH]);
                uploadModelView();
                SPHERE.draw(gl, program, mode);
            popMatrix();
            pushMatrix();
                multTranslation([TAIL_LENGTH*(3/4), BODY_HEIGHT/8, 0]);
                tail(heli);
            popMatrix();
            pushMatrix();
                multTranslation([BODY_LENGHT*(1/14), BODY_HEIGHT/2, 0]);
                rotor(heli);
            popMatrix();
            pushMatrix();
                landingGear(heli);
            popMatrix();
        popMatrix();
    }

    function helicopter(heli)
    {
        multTranslation([heli.pos.x, heli.pos.y, heli.pos.z]);
        multRotationX(heli.rotations.x);
        multRotationY(heli.rotations.y);
        multRotationZ(heli.rotations.z);
        pushMatrix();
            multScale([heli.scale, heli.scale, heli.scale]);
            uploadModelView();
            helicopterBody(heli);
        popMatrix();
    }

    function building(build){
        pushMatrix();
            updateColor(build.colours.body);
            multTranslation([build.pos.x, build.dimensions.height/2, build.pos.z]);
            multScale([BUILDING_SIZE, build.dimensions.height, BUILDING_SIZE]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
    }

    function floor() {
        pushMatrix();
            updateColor(FLOOR_COLOR);
            multScale([FLOOR_SIZE, FLOOR_HEIGHT, FLOOR_SIZE]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
        for(const build of buildings)
            building(build);
    }

    function render()
    {
        if(animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        var transformMatrix = mat4(
            vec4(1, 0, 0, 0),
            vec4(0, 1, 0, 0),
            vec4(0, 0, 0, 0),
            vec4(0, 0, 0, 1));
        
        //loadMatrix(mult(transformMatrix, rotateY(90)));
        //axometricView = lookAt([camera.x,camera.y,camera.z], [0, 0, 0], [0, 1, 0]);
        axometricView = frontView;

        loadMatrix(currentview);

        if(isAxometric){
            currentview = axometricView;
            multRotationX(camera.tetha);
            multRotationY(camera.alpha);
            multRotationZ(camera.betha);
        } 

        uploadModelView();

        multScale([world.scale, world.scale, world.scale]);

        pushMatrix();
            floor();
        popMatrix();
        for(const heli of helicopters){
            pushMatrix();
                updateHeliPos(HELICOPTER_ACTIONS.FORWARD, heli)
                helicopter(heli);
            popMatrix();
        }
    }

    function updateColor(color) {
        gl.useProgram(program);
        const uColor = gl.getUniformLocation(program, "uColor");
        gl.uniform3fv(uColor, color);
    }

    function updateHeliPos(action, heli) {
        switch (action){
            case HELICOPTER_ACTIONS.CLIMB:
                break;
            case HELICOPTER_ACTIONS.DESCENT:
                console.log(heli)
                if(heli.pos.y == HELICOPTER_MIN_HEIGHT)
                    heli.isInAir = false;
                break;
            case HELICOPTER_ACTIONS.FORWARD:
                let count = helicopters[selected_helicopter].count+=0.1;
                heli.rotations.z = 30;
                heli.rotations.x = 10;
                let x = heli.pos.x;
                let z = heli.pos.z;
                let zx = (Math.atan2(-z,x) * 360) / (2*Math.PI) + 270;
                heli.rotations.y = zx;
                heli.pos.x = Math.cos(time * helicopters[selected_helicopter].velocity) * TRAJECTORY_RADIUS;
                heli.pos.z = Math.sin(-time * helicopters[selected_helicopter].velocity) * TRAJECTORY_RADIUS;
                break;
            case HELICOPTER_ACTIONS.BACKWARD:
                break;
        }
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
}

class HelicopterObject {

    constructor(){
        this.pos = DEFAULT_POS
        this.colours = DEFAULT_COLOURS
        this.rotations = DEFAULT_ROTATION
        this.velocity = 1//DEFAULT_VELOCITY
        this.acceleration = DEFAULT_ACCELERATION
        this.rotors_speeds = DEFAULT_ROTORS_SPEEDS
        this.scale = DEFAULT_SCALE
        this.count = 0;
        this.isInAir = false;
        this.objects = [];
    }
}

class BoxObject{
    constructor(){

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

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))