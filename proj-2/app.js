import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../libs/utils.js";
import { ortho, lookAt, flatten, mult, mat4, vec4, inverse } from "../libs/MV.js";
import { GUI } from "../libs/dat.gui.module.js";
import {modelView, loadMatrix, multRotationY, multRotationX, multRotationZ, multTranslation, multScale, pushMatrix, popMatrix  } from "../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js';
import * as CUBE from '../../libs/objects/cube.js';
import * as CYLINDER from '../../libs/objects/cylinder.js';
import * as PYRAMID from '../../libs/objects/pyramid.js';
import * as TORUS from '../../libs/objects/torus.js';
import { rotateY } from "../libs/MV.js";

/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 1/60.0;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running


const HELICOPTER_SCALE = 1;    // scale that will apply to each planet and satellite
const ORBIT_SCALE = 1/60;   // scale that will apply to each orbit around the sun

const HELICOPTER_LENGHT = 10;
const TRAJECTORY_RADIUS = 30;

const BODY_COLOR = vec3(207/255, 25/255, 25/255);
const BLADE_COLOR = vec3(17/255, 203/255, 240/255);
const CYLINDER_COLOR = vec3(227/255, 182/255, 20/255);
const BEAM_COLOR = vec3(133/255, 133/255, 133/255);

const BLADE_LENGTH = 50;
const BLADE_WIDTH = 5;

const ROTOR_RADIUS = 0.08;
const ROTOR_HEIGHT = 0.5;
const ROTOR_SPEED = 60;

const TAIL_TIP_LENGTH = 1;
const TAIL_TIP_HEIGHT = 0.5;
const TAIL_TIP_WIDTH = 0.5;

const TAIL_LENGTH = 5;
const TAIL_HEIGHT = 0.5;
const TAIL_WIDTH = 0.5;

const SUPPORT_BEAM_LENGTH = 1.3;
const SUPPORT_BEAM_HEIGHT = 0.15;
const SUPPORT_BEAM_WIDTH = 0.15;

const GROUND_SUPPORT_LENGTH = 4;
const GROUND_SUPPORT_HEIGHT = 0.15;
const GROUND_SUPPORT_WIDTH = 0.15;

const BODY_LENGHT = 5;
const BODY_HEIGHT = 2;
const BODY_WIDTH = 1.5;

const VP_DISTANCE = 10;
var currColor = vec3(0,0,0);
var camera = { x:1, y:1, z:1, scale:1};
var world = {scale: 1};
var helicopter_settings = {scale: 1};

const gui = new GUI();
gui.add(camera, "x", -10, 10, 0.1).name("X");
gui.add(camera, "y", -10, 10, 0.1).name("Y");
gui.add(camera, "z", -10, 10, 0.1).name("Z");
gui.add(world, "scale", 0, 5, 0.1).name("World Scale");
gui.add(helicopter_settings, "scale", 0, 5, 0.1).name("Helicopter Scale");

let axometricView = lookAt([camera.x,camera.y,camera.z], [0, 0, 0], [0, 1, 0]);
let frontView = lookAt([-1,0,0], [0, 0, 0], [0, 1, 0]);
let upView = lookAt([0,1,0], [0, 0, 0], [0, 0, 1]);
let rigthView = lookAt([0,0,1], [0, 0, 0], [0, 1, 0]);
let currentview = axometricView;

function setup(shaders)
{
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);

    mode = gl.LINES; 

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
                break;
            case '2':
                currentview = frontView;
                break;
            case '3':
                currentview = upView;
                break;
            case '4':
                currentview = rigthView;
                break;
        }
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    SPHERE.init(gl);
    CYLINDER.init(gl);
    CUBE.init(gl);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);


    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
        mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function blade() {
        updateColor(BLADE_COLOR);
        multScale([BLADE_LENGTH, 0.1, BLADE_WIDTH]);
        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function rotor() {
        pushMatrix();
            updateColor(CYLINDER_COLOR);
            multScale([ROTOR_RADIUS, ROTOR_HEIGHT, ROTOR_RADIUS]);
            multRotationY(time*ROTOR_SPEED);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
            pushMatrix();
                multRotationY(360/3);
                multTranslation([BLADE_LENGTH/2, ROTOR_HEIGHT/2, 0]);
                blade();
            popMatrix();
            pushMatrix();
                multRotationY(360*2/3);
                multTranslation([BLADE_LENGTH/2, ROTOR_HEIGHT/2, 0]);
                blade();
            popMatrix();
            pushMatrix();
                multRotationY(360*3/3);
                multTranslation([BLADE_LENGTH/2, ROTOR_HEIGHT/2, 0]);
                blade();
            popMatrix();
        popMatrix();
    }

    function tailRotor() {
        pushMatrix();
            updateColor(CYLINDER_COLOR);
            multScale([ROTOR_RADIUS, ROTOR_HEIGHT/2, ROTOR_RADIUS]);
            multRotationY(time*ROTOR_SPEED);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
            pushMatrix();
                pushMatrix();
                    multScale([1/6, 1, 1/3]);
                    multRotationY(360);
                    multTranslation([BLADE_LENGTH/2, ROTOR_HEIGHT/2, 0]);
                    blade();
                popMatrix();
                pushMatrix();
                    multScale([1/6, 1, 1/3]);
                    multRotationY(360/2);
                    multTranslation([BLADE_LENGTH/2, ROTOR_HEIGHT/2, 0]);
                    blade();
                popMatrix();
            popMatrix();
        popMatrix();
    }

    function tailTip() {
        pushMatrix();
            updateColor(BODY_COLOR);
            multScale([TAIL_TIP_LENGTH, TAIL_TIP_HEIGHT, TAIL_TIP_WIDTH]);
            uploadModelView();
            SPHERE.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            multTranslation([0, 0, TAIL_TIP_WIDTH/2]);
            multRotationX(90);
            tailRotor();
        popMatrix();
    }

    function tail() {
        pushMatrix();
            pushMatrix();
                updateColor(BODY_COLOR);
                multScale([TAIL_LENGTH, TAIL_HEIGHT, TAIL_WIDTH]);
                uploadModelView();
                SPHERE.draw(gl, program, mode);
            popMatrix();
            pushMatrix();
                multTranslation([TAIL_LENGTH/2, TAIL_HEIGHT*(2/3), 0]);
                multRotationZ(65);
                tailTip();
            popMatrix();
        popMatrix();
    }

    function supportBeam() {
        updateColor(BEAM_COLOR);
        pushMatrix();
            multScale([LANDING_BEAM_LENGTH, LANDING_BEAM_RADIUS, LANDING_BEAM_RADIUS]);
            multRotationZ(90);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
        popMatrix();
    }

    function landingBeam() {
        updateColor(CYLINDER_COLOR);
        pushMatrix();
            multScale([LANDING_BEAM_LENGTH, LANDING_BEAM_RADIUS, LANDING_BEAM_RADIUS]);
            multRotationZ(90);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
        popMatrix();
    }

    function landingStructure() {
        pushMatrix()
            pushMatrix();
                multTranslation([-LANDING_BEAM_LENGTH/5, SUPPORT_BEAM_LENGTH/3, -SUPPORT_BEAM_WIDTH]);
                multRotationZ(55);
                multRotationY(20);
                supportBeam();
            popMatrix();
            pushMatrix();
                multTranslation([LANDING_BEAM_LENGTH/5, SUPPORT_BEAM_LENGTH/3, -SUPPORT_BEAM_WIDTH]);
                multRotationZ(-55);
                multRotationY(-20);
                supportBeam();
            popMatrix();
            pushMatrix();
                landingBeam();
            popMatrix();
        popMatrix();
    }

    function landingGear() {
        pushMatrix();
            pushMatrix();
                multTranslation([0, -BODY_HEIGHT*(5/7), BODY_WIDTH/2]);
                landingStructure();
            popMatrix();
            pushMatrix();
                multTranslation([0, -BODY_HEIGHT*(5/7), -BODY_WIDTH/2]);
                multScale([-1, 1, -1]);
                landingStructure();
            popMatrix();
        popMatrix();
    }


    function helicopterBody() {
        pushMatrix();
            pushMatrix();
                updateColor(BODY_COLOR);
                multScale([BODY_LENGHT, BODY_HEIGHT, BODY_WIDTH]);
                uploadModelView();
                SPHERE.draw(gl, program, mode);
            popMatrix();
            pushMatrix();
                multTranslation([TAIL_LENGTH*(3/4), BODY_HEIGHT/8, 0]);
                tail();
            popMatrix();
            pushMatrix();
                multTranslation([BODY_LENGHT*(1/14), BODY_HEIGHT/2, 0]);
                rotor();
            popMatrix();
            pushMatrix();
                landingGear();
            popMatrix();
        popMatrix();
    }

    function helicopter()
    {
        pushMatrix();
            multScale([camera.scale, camera.scale, camera.scale]);
            uploadModelView();
            helicopterBody();
        popMatrix();

    }

    function render()
    {
        if(animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);

        //const uColor = gl.getUniformLocation(program, "uColor");
        //gl.uniform3fv(uColor, currColor);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        var transformMatrix = mat4(
            vec4(1, 0, 0, 0),
            vec4(0, 1, 0, 0),
            vec4(0, 0, 0, 0),
            vec4(0, 0, 0, 1));
        
        //loadMatrix(mult(transformMatrix, rotateY(90)));
        axometricView = lookAt([camera.x,camera.y,camera.z], [0, 0, 0], [0, 1, 0]);
        loadMatrix(currentview);

        uploadModelView();

        multScale([world.scale, world.scale, world.scale]);
        
        pushMatrix();
            //floor();
        popMatrix();
        pushMatrix();
            helicopter();
        popMatrix();
    }

    function updateColor(color) {
        gl.useProgram(program);
        const uColor = gl.getUniformLocation(program, "uColor");
        gl.uniform3fv(uColor, color);
    }
    
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))