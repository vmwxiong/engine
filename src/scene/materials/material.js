import {
    BLENDMODE_ZERO, BLENDMODE_ONE, BLENDMODE_SRC_COLOR,
    BLENDMODE_DST_COLOR, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_SRC_ALPHA,
    BLENDMODE_ONE_MINUS_SRC_ALPHA,
    BLENDEQUATION_ADD,
    BLENDEQUATION_MIN, BLENDEQUATION_MAX,
    CULLFACE_BACK
} from '../../graphics/constants.js';

import {
    BLEND_ADDITIVE, BLEND_NORMAL, BLEND_NONE, BLEND_PREMULTIPLIED,
    BLEND_MULTIPLICATIVE, BLEND_ADDITIVEALPHA, BLEND_MULTIPLICATIVE2X, BLEND_SCREEN,
    BLEND_MIN, BLEND_MAX
} from '../constants.js';

var id = 0;

/**
 * @class
 * @name Material
 * @classdesc A material determines how a particular mesh instance is rendered. It specifies the shader and render state that is
 * set before the mesh instance is submitted to the graphics device.
 * @description Create a new Material instance.
 * @property {number} alphaTest The alpha test reference value to control which fragments are written to the currently
 * active render target based on alpha value. All fragments with an alpha value of less than the alphaTest reference value
 * will be discarded. alphaTest defaults to 0 (all fragments pass).
 * @property {boolean} alphaToCoverage Enables or disables alpha to coverage (WebGL2 only). When enabled, and if hardware anti-aliasing is on,
 * limited order-independent transparency can be achieved. Quality depends on the number of MSAA samples of the current render target.
 * It can nicely soften edges of otherwise sharp alpha cutouts, but isn't recommended for large area semi-transparent surfaces.
 * Note, that you don't need to enable blending to make alpha to coverage work. It will work without it, just like alphaTest.
 * @property {boolean} alphaWrite If true, the alpha component of fragments generated by the shader of this material is written to
 * the color buffer of the currently active render target. If false, the alpha component will not be written. Defaults to true.
 * @property {number} blendType Controls how primitives are blended when being written to the currently active render target.
 * Can be:
 *
 * * {@link pc.BLEND_SUBTRACTIVE}: Subtract the color of the source fragment from the destination fragment and write the result to the frame buffer.
 * * {@link pc.BLEND_ADDITIVE}: Add the color of the source fragment to the destination fragment and write the result to the frame buffer.
 * * {@link pc.BLEND_NORMAL}: Enable simple translucency for materials such as glass. This is equivalent to enabling a source blend mode of pc.BLENDMODE_SRC_ALPHA and a destination blend mode of pc.BLENDMODE_ONE_MINUS_SRC_ALPHA.
 * * {@link pc.BLEND_NONE}: Disable blending.
 * * {@link pc.BLEND_PREMULTIPLIED}: Similar to pc.BLEND_NORMAL expect the source fragment is assumed to have already been multiplied by the source alpha value.
 * * {@link pc.BLEND_MULTIPLICATIVE}: Multiply the color of the source fragment by the color of the destination fragment and write the result to the frame buffer.
 * * {@link pc.BLEND_ADDITIVEALPHA}: Same as pc.BLEND_ADDITIVE except the source RGB is multiplied by the source alpha.
 *
 * Defaults to pc.BLEND_NONE.
 * @property {boolean} blueWrite If true, the blue component of fragments generated by the shader of this material is written to
 * the color buffer of the currently active render target. If false, the blue component will not be written. Defaults to true.
 * @property {number} cull Controls how triangles are culled based on their face direction with respect to the viewpoint.
 * Can be:
 *
 * * {@link pc.CULLFACE_NONE}: Do not cull triangles based on face direction.
 * * {@link pc.CULLFACE_BACK}: Cull the back faces of triangles (do not render triangles facing away from the view point).
 * * {@link pc.CULLFACE_FRONT}: Cull the front faces of triangles (do not render triangles facing towards the view point).
 * * {@link pc.CULLFACE_FRONTANDBACK}: Cull both front and back faces (triangles will not be rendered).
 *
 * Defaults to pc.CULLFACE_BACK.
 * @property {boolean} depthTest If true, fragments generated by the shader of this material are only written to the
 * current render target if they pass the depth test. If false, fragments generated by the shader of this material are
 * written to the current render target regardless of what is in the depth buffer. Defaults to true.
 * @property {boolean} depthWrite If true, fragments generated by the shader of this material write a depth value to
 * the depth buffer of the currently active render target. If false, no depth value is written. Defaults to true.
 * @property {boolean} greenWrite If true, the green component of fragments generated by the shader of this material is written to
 * the color buffer of the currently active render target. If false, the green component will not be written. Defaults to true.
 * @property {string} name The name of the material.
 * @property {boolean} redWrite If true, the red component of fragments generated by the shader of this material is written to
 * the color buffer of the currently active render target. If false, the red component will not be written. Defaults to true.
 * @property {pc.Shader|null} shader The shader used by this material to render mesh instances (default is null).
 * @property {pc.StencilParameters|null} stencilFront Stencil parameters for front faces (default is null).
 * @property {pc.StencilParameters|null} stencilBack Stencil parameters for back faces (default is null).
 * @property {number} depthBias Offsets the output depth buffer value. Useful for decals to prevent z-fighting.
 * @property {number} slopeDepthBias Same as {@link pc.Material#depthBias}, but also depends on the slope of the triangle relative to the camera.
 */
class Material {
    static defaultMaterial = null;

    constructor() {
        this.name = "Untitled";
        this.id = id++;

        this._shader = null;
        this.variants = {};
        this.parameters = {};

        // Render states
        this.alphaTest = 0;
        this.alphaToCoverage = false;

        this.blend = false;
        this.blendSrc = BLENDMODE_ONE;
        this.blendDst = BLENDMODE_ZERO;
        this.blendEquation = BLENDEQUATION_ADD;

        this.separateAlphaBlend = false;
        this.blendSrcAlpha = BLENDMODE_ONE;
        this.blendDstAlpha = BLENDMODE_ZERO;
        this.blendAlphaEquation = BLENDEQUATION_ADD;

        this.cull = CULLFACE_BACK;

        this.depthTest = true;
        this.depthWrite = true;
        this.stencilFront = null;
        this.stencilBack = null;

        this.depthBias = 0;
        this.slopeDepthBias = 0;

        this.redWrite = true;
        this.greenWrite = true;
        this.blueWrite = true;
        this.alphaWrite = true;

        this.meshInstances = []; // The mesh instances referencing this material

        this._shaderVersion = 0;
        this._scene = null;
        this._dirtyBlend = false;

        this.dirty = true;
    }

    get shader() {
        return this._shader;
    }

    set shader(shader) {
        this._shader = shader;
    }

    get blendType() {
        if ((!this.blend) &&
            (this.blendSrc === BLENDMODE_ONE) &&
            (this.blendDst === BLENDMODE_ZERO) &&
            (this.blendEquation === BLENDEQUATION_ADD)) {
            return BLEND_NONE;
        } else if ((this.blend) &&
                   (this.blendSrc === BLENDMODE_SRC_ALPHA) &&
                   (this.blendDst === BLENDMODE_ONE_MINUS_SRC_ALPHA) &&
                   (this.blendEquation === BLENDEQUATION_ADD)) {
            return BLEND_NORMAL;
        } else if ((this.blend) &&
                   (this.blendSrc === BLENDMODE_ONE) &&
                   (this.blendDst === BLENDMODE_ONE) &&
                   (this.blendEquation === BLENDEQUATION_ADD)) {
            return BLEND_ADDITIVE;
        } else if ((this.blend) &&
                   (this.blendSrc === BLENDMODE_SRC_ALPHA) &&
                   (this.blendDst === BLENDMODE_ONE) &&
                   (this.blendEquation === BLENDEQUATION_ADD)) {
            return BLEND_ADDITIVEALPHA;
        } else if ((this.blend) &&
                   (this.blendSrc === BLENDMODE_DST_COLOR) &&
                   (this.blendDst === BLENDMODE_SRC_COLOR) &&
                   (this.blendEquation === BLENDEQUATION_ADD)) {
            return BLEND_MULTIPLICATIVE2X;
        } else if ((this.blend) &&
                   (this.blendSrc === BLENDMODE_ONE_MINUS_DST_COLOR) &&
                   (this.blendDst === BLENDMODE_ONE) &&
                   (this.blendEquation === BLENDEQUATION_ADD)) {
            return BLEND_SCREEN;
        } else if ((this.blend) &&
                   (this.blendSrc === BLENDMODE_ONE) &&
                   (this.blendDst === BLENDMODE_ONE) &&
                   (this.blendEquation === BLENDEQUATION_MIN)) {
            return BLEND_MIN;
        } else if ((this.blend) &&
                   (this.blendSrc === BLENDMODE_ONE) &&
                   (this.blendDst === BLENDMODE_ONE) &&
                   (this.blendEquation === BLENDEQUATION_MAX)) {
            return BLEND_MAX;
        } else if ((this.blend) &&
                   (this.blendSrc === BLENDMODE_DST_COLOR) &&
                   (this.blendDst === BLENDMODE_ZERO) &&
                   (this.blendEquation === BLENDEQUATION_ADD)) {
            return BLEND_MULTIPLICATIVE;
        } else if ((this.blend) &&
                   (this.blendSrc === BLENDMODE_ONE) &&
                   (this.blendDst === BLENDMODE_ONE_MINUS_SRC_ALPHA) &&
                   (this.blendEquation === BLENDEQUATION_ADD)) {
            return BLEND_PREMULTIPLIED;
        }
        return BLEND_NORMAL;
    }

    set blendType(type) {
        var prevBlend = this.blend;
        switch (type) {
            case BLEND_NONE:
                this.blend = false;
                this.blendSrc = BLENDMODE_ONE;
                this.blendDst = BLENDMODE_ZERO;
                this.blendEquation = BLENDEQUATION_ADD;
                break;
            case BLEND_NORMAL:
                this.blend = true;
                this.blendSrc = BLENDMODE_SRC_ALPHA;
                this.blendDst = BLENDMODE_ONE_MINUS_SRC_ALPHA;
                this.blendEquation = BLENDEQUATION_ADD;
                break;
            case BLEND_PREMULTIPLIED:
                this.blend = true;
                this.blendSrc = BLENDMODE_ONE;
                this.blendDst = BLENDMODE_ONE_MINUS_SRC_ALPHA;
                this.blendEquation = BLENDEQUATION_ADD;
                break;
            case BLEND_ADDITIVE:
                this.blend = true;
                this.blendSrc = BLENDMODE_ONE;
                this.blendDst = BLENDMODE_ONE;
                this.blendEquation = BLENDEQUATION_ADD;
                break;
            case BLEND_ADDITIVEALPHA:
                this.blend = true;
                this.blendSrc = BLENDMODE_SRC_ALPHA;
                this.blendDst = BLENDMODE_ONE;
                this.blendEquation = BLENDEQUATION_ADD;
                break;
            case BLEND_MULTIPLICATIVE2X:
                this.blend = true;
                this.blendSrc = BLENDMODE_DST_COLOR;
                this.blendDst = BLENDMODE_SRC_COLOR;
                this.blendEquation = BLENDEQUATION_ADD;
                break;
            case BLEND_SCREEN:
                this.blend = true;
                this.blendSrc = BLENDMODE_ONE_MINUS_DST_COLOR;
                this.blendDst = BLENDMODE_ONE;
                this.blendEquation = BLENDEQUATION_ADD;
                break;
            case BLEND_MULTIPLICATIVE:
                this.blend = true;
                this.blendSrc = BLENDMODE_DST_COLOR;
                this.blendDst = BLENDMODE_ZERO;
                this.blendEquation = BLENDEQUATION_ADD;
                break;
            case BLEND_MIN:
                this.blend = true;
                this.blendSrc = BLENDMODE_ONE;
                this.blendDst = BLENDMODE_ONE;
                this.blendEquation = BLENDEQUATION_MIN;
                break;
            case BLEND_MAX:
                this.blend = true;
                this.blendSrc = BLENDMODE_ONE;
                this.blendDst = BLENDMODE_ONE;
                this.blendEquation = BLENDEQUATION_MAX;
                break;
        }
        if (prevBlend !== this.blend) {
            if (this._scene) {
                this._scene.layers._dirtyBlend = true;
            } else {
                this._dirtyBlend = true;
            }
        }
        this._updateMeshInstanceKeys();
    }

    _cloneInternal(clone) {
        clone.name = this.name;
        clone.shader = this.shader;

        // Render states
        clone.alphaTest = this.alphaTest;
        clone.alphaToCoverage = this.alphaToCoverage;

        clone.blend = this.blend;
        clone.blendSrc = this.blendSrc;
        clone.blendDst = this.blendDst;
        clone.blendEquation = this.blendEquation;

        clone.separateAlphaBlend = this.separateAlphaBlend;
        clone.blendSrcAlpha = this.blendSrcAlpha;
        clone.blendDstAlpha = this.blendDstAlpha;
        clone.blendAlphaEquation = this.blendAlphaEquation;

        clone.cull = this.cull;

        clone.depthTest = this.depthTest;
        clone.depthWrite = this.depthWrite;
        clone.depthBias = this.depthBias;
        clone.slopeDepthBias = this.slopeDepthBias;
        if (this.stencilFront) clone.stencilFront = this.stencilFront.clone();
        if (this.stencilBack) {
            if (this.stencilFront === this.stencilBack) {
                clone.stencilBack = clone.stencilFront;
            } else {
                clone.stencilBack = this.stencilBack.clone();
            }
        }

        clone.redWrite = this.redWrite;
        clone.greenWrite = this.greenWrite;
        clone.blueWrite = this.blueWrite;
        clone.alphaWrite = this.alphaWrite;
    }

    clone() {
        var clone = new Material();
        this._cloneInternal(clone);
        return clone;
    }

    _updateMeshInstanceKeys() {
        var i, meshInstances = this.meshInstances;
        for (i = 0; i < meshInstances.length; i++) {
            meshInstances[i].updateKey();
        }
    }

    updateUniforms() {
    }

    updateShader(device, scene, objDefs) {
        // For vanilla materials, the shader can only be set by the user
    }

    /**
     * @function
     * @name Material#update
     * @description Applies any changes made to the material's properties.
     */
    update() {
        this.dirty = true;
        if (this._shader) this._shader.failed = false;
    }

    // Parameter management
    clearParameters() {
        this.parameters = {};
    }

    getParameters() {
        return this.parameters;
    }

    clearVariants() {
        var meshInstance;
        this.variants = {};
        var j;
        for (var i = 0; i < this.meshInstances.length; i++) {
            meshInstance = this.meshInstances[i];
            for (j = 0; j < meshInstance._shader.length; j++) {
                meshInstance._shader[j] = null;
            }
        }
    }

    /**
     * @function
     * @name Material#getParameter
     * @description Retrieves the specified shader parameter from a material.
     * @param {string} name - The name of the parameter to query.
     * @returns {object} The named parameter.
     */
    getParameter(name) {
        return this.parameters[name];
    }

    /**
     * @function
     * @name Material#setParameter
     * @description Sets a shader parameter on a material.
     * @param {string} name - The name of the parameter to set.
     * @param {number|number[]|pc.Texture} data - The value for the specified parameter.
     */
    setParameter(name, data) {

        if (data === undefined && typeof name === 'object') {
            var uniformObject = name;
            if (uniformObject.length) {
                for (var i = 0; i < uniformObject.length; i++) {
                    this.setParameter(uniformObject[i]);
                }
                return;
            }
            name = uniformObject.name;
            data = uniformObject.value;
        }

        var param = this.parameters[name];
        if (param) {
            param.data = data;
        } else {
            this.parameters[name] = {
                scopeId: null,
                data: data
            };
        }
    }

    /**
     * @function
     * @name Material#deleteParameter
     * @description Deletes a shader parameter on a material.
     * @param {string} name - The name of the parameter to delete.
     */
    deleteParameter(name) {
        if (this.parameters[name]) {
            delete this.parameters[name];
        }
    }

    // used to apply parameters from this material into scope of uniforms, called internally by forward-renderer
    // optional list of parameter names to be set can be specified, otherwise all parameters are set
    setParameters(device, names) {
        var parameter, parameters = this.parameters;
        if (names === undefined) names = parameters;
        for (var paramName in names) {
            parameter = parameters[paramName];
            if (parameter) {
                if (!parameter.scopeId) {
                    parameter.scopeId = device.scope.resolve(paramName);
                }
                parameter.scopeId.setValue(parameter.data);
            }
        }
    }

    /**
     * @function
     * @name Material#destroy
     * @description Removes this material from the scene and possibly frees up memory from its shaders (if there are no other materials using it).
     */
    destroy() {
        this.variants = {};
        this.shader = null;

        var meshInstance, j;
        for (var i = 0; i < this.meshInstances.length; i++) {
            meshInstance = this.meshInstances[i];
            for (j = 0; j < meshInstance._shader.length; j++) {
                meshInstance._shader[j] = null;
            }
            meshInstance._material = null;
            var defaultMaterial = Material.defaultMaterial;
            if (this !== defaultMaterial) {
                meshInstance.material = defaultMaterial;
            }
        }
    }
}

export { Material };
