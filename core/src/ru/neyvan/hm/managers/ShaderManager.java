package ru.neyvan.hm.managers;


import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;


/**
 * Created by AndyGo on 26.03.2018.
 */

public class ShaderManager implements Manager {
    private ShaderProgram circle;
    private ShaderProgram fontShader;
    private ShaderProgram fontTransitionShader;
   // private ShaderProgram explosionShader;
    private ShaderProgram transitionShader; // transition between game and portal
    private ShaderProgram portalShader;
    private ShaderProgram colorMusicShader;
    private ShaderProgram inversionShader;
    @Override
    public void init() {
        ShaderProgram.pedantic = false;
        circle = new ShaderProgram(Gdx.files.internal("shaders/vertex.glsl"),
                Gdx.files.internal("shaders/circle_fragment.glsl"));
        if(!circle.isCompiled())
            Gdx.app.log("circle Shader of main menu", circle.getLog());
        fontShader = new ShaderProgram(Gdx.files.internal("shaders/vertex.glsl"),
                Gdx.files.internal("shaders/font_fragment.glsl"));
        if (!fontShader.isCompiled()) {
            Gdx.app.error("fontShader of Number Text", "compilation failed:\n" + fontShader);
        }
        fontTransitionShader = new ShaderProgram(Gdx.files.internal("shaders/vertex.glsl"),
                Gdx.files.internal("shaders/font_transition_fragment.glsl"));
        if (!fontTransitionShader.isCompiled()) {
            Gdx.app.error("fontTransitionShader of Number Text", "compilation failed:\n" + fontTransitionShader);
        }
//        explosionShader = new ShaderProgram(Gdx.files.internal("shaders/vertex.glsl"),
//                Gdx.files.internal("shaders/explosion_fragment.glsl"));
//        if (!explosionShader.isCompiled()) {
//            Gdx.app.error("explosionShader of Number Text", "compilation failed:\n" + explosionShader);
//        }
        transitionShader = new ShaderProgram(Gdx.files.internal("shaders/vertex.glsl"),
                Gdx.files.internal("shaders/transition_fragment.glsl"));
        if(!transitionShader.isCompiled())
            Gdx.app.log("Shader", transitionShader.getLog());
        transitionShader.begin();
        transitionShader.setUniformi("u_texture1", 1);
        transitionShader.end();

        portalShader = new ShaderProgram(Gdx.files.internal("shaders/vertex.glsl"),
                Gdx.files.internal("shaders/portal_fragment.glsl"));
        if(!portalShader.isCompiled())
            Gdx.app.log("Shader", portalShader.getLog());

        colorMusicShader = new ShaderProgram(Gdx.files.internal("shaders/vertex.glsl"),
                Gdx.files.internal("shaders/color_music_fragment.glsl"));
        if(!portalShader.isCompiled())
            Gdx.app.log("Shader", portalShader.getLog());

        inversionShader = new ShaderProgram(Gdx.files.internal("shaders/vertex.glsl"),
                Gdx.files.internal("shaders/inversion_fragment.glsl"));
        if(!portalShader.isCompiled())
            Gdx.app.log("Shader", portalShader.getLog());
    }

    public ShaderProgram getCircle() {
        return circle;
    }
    public ShaderProgram getFontShader() {
        return fontShader;
    }
 //   public ShaderProgram getExplosionShader() {
//        return explosionShader;
 //   }
    public ShaderProgram getFontTransitionShader() {
        return fontTransitionShader;
    }
    public ShaderProgram getTransitionShader() {
        return transitionShader;
    }
    public ShaderProgram getPortalShader() {
        return portalShader;
    }
    public ShaderProgram getColorMusicShader() {
        return colorMusicShader;
    }
    public ShaderProgram getInversionShader() {
        return inversionShader;
    }
    @Override
    public void dispose() {
        circle.dispose();
        fontShader.dispose();
        fontTransitionShader.dispose();
  //      explosionShader.dispose();
        transitionShader.dispose();
        portalShader.dispose();
        colorMusicShader.dispose();
        inversionShader.dispose();
    }



}
