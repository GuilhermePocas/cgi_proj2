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

const BLADE_LENGTH = 80;
const BLADE_WIDTH = 5;

const ROTOR_RADIUS = 0.08;
const ROTOR_HEIGHT = 0.8;
const ROTOR_SPEED = 60;

const TAIL_ROTOR_SCALE = 0.01;

const TAIL_LENGTH = 5;

const TAIL_TIP_LENGTH = 0.5;

const VP_DISTANCE = 10;
var camera = { x:0, y:0, z:0, scale:1};

const gui = new GUI();
gui.add(camera, "x", -10, 10, 0.1).name("X");
gui.add(camera, "y", -10, 10, 0.1).name("Y");
gui.add(camera, "z", -10, 10, 0.1).name("Z");
gui.add(camera, "scale", 0, 5, 0.1).name("Scale");

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
        }
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    SPHERE.init(gl);
    CYLINDER.init(gl);
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
        multScale([BLADE_LENGTH, 0.3, BLADE_WIDTH]);
        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function rotor() {
        pushMatrix();
            multScale([ROTOR_RADIUS, ROTOR_HEIGHT, ROTOR_RADIUS]);
            multTranslation([5, 1.6, 0]);
            multRotationY(time*ROTOR_SPEED);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
            pushMatrix();
                multRotationY(360/3);
                multTranslation([BLADE_LENGTH/2, 0.2, 0]);
                blade();
            popMatrix();
            pushMatrix();
                multRotationY(360*2/3);
                multTranslation([BLADE_LENGTH/2, 0.2, 0]);
                blade();
            popMatrix();
            pushMatrix();
                multRotationY(360*3/3);
                multTranslation([BLADE_LENGTH/2, 0.2, 0]);
                blade();
            popMatrix();
        popMatrix();
    }

    function tailRotor() {
        multScale([TAIL_ROTOR_SCALE, TAIL_ROTOR_SCALE, TAIL_ROTOR_SCALE]);
        multRotationY(time*ROTOR_SPEED);
        pushMatrix();
            multScale([ROTOR_RADIUS, ROTOR_RADIUS, ROTOR_RADIUS]);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            pushMatrix();
                multRotationY(360);
                multTranslation([BLADE_LENGTH/2, 0, 0]);
                blade();
            popMatrix();
            pushMatrix();
                multRotationY(360/2);
                multTranslation([BLADE_LENGTH/2, 0, 0]);
                blade();
            popMatrix();
        popMatrix();
    }

    function tailTip() {
        pushMatrix();
            multScale([1, TAIL_TIP_LENGTH, 1]);
            uploadModelView();
            SPHERE.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            multTranslation([1, 0, 0])
            multRotationX(90);
            tailRotor();
        popMatrix();
    }

    function tail() {
        multScale([1, 2, 1]);
        multTranslation([3, 0, 0]);
        uploadModelView();
        SPHERE.draw(gl, program, mode);
        tailTip();
    }

    function helicopterBody() {
        pushMatrix();
            multScale([5, 2, 2])
            uploadModelView();
            SPHERE.draw(gl, program, mode);
            multScale([1/5, 1/2, 1/2])
            pushMatrix();
                tail();
            popMatrix();
            pushMatrix();
                rotor();
            popMatrix();
            pushMatrix();
                landingGear();
            popMatrix();
        popMatrix();
    }

    function helicopter()
    {
        // Don't forget to scale the sun, rotate it around the y axis at the correct speed
        multScale([camera.scale, camera.scale, camera.scale]);
        //multRotationY(360*time/TRAJECTORY_RADIUS);

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        helicopterBody();
    }

    function render()
    {
        if(animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        var transformMatrix = mat4(
            vec4(Math.cos(camera.x), 0, 0, 0),
            vec4(0, 1, 0, 0),
            vec4(0, 0, Math.sin(camera.x), 0),
            vec4(0, 0, 0, 1));
        
    
        loadMatrix(lookAt([camera.x, camera.y, camera.z], [0, 0, 0]/*[camera.x, camera.y, camera.z]*/, [0,1,0]));

        uploadModelView();
        
        pushMatrix();
            //floor();
        popMatrix();
        pushMatrix();
            helicopter();
        popMatrix();
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))