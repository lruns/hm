package ru.neyvan.hm.managers;


import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;


/**
 * Created by AndyGo on 26.03.2018.
 */

public class ShaderManager implements Manager {
    private ShaderProgram circle;
    private ShaderProgram fontShader;
    private ShaderProgram transitionShader;
    private ShaderProgram burnShader;
    private ShaderProgram explosionShader;
    @Override
    public void init() {
        circle = new ShaderProgram(Gdx.files.internal("shaders/vertex.glsl"),
                Gdx.files.internal("shaders/circle_fragment.glsl"));
        if(!circle.isCompiled())
            Gdx.app.log("Shader", circle.getLog());
        fontShader = new ShaderProgram(Gdx.files.internal("shaders/font_vertex.glsl"),
                Gdx.files.internal("shaders/font_fragment.glsl"));
        if (!fontShader.isCompiled()) {
            Gdx.app.error("fontShader of Number Text", "compilation failed:\n" + fontShader);
        }
        explosionShader = new ShaderProgram(Gdx.files.internal("shaders/font_vertex.glsl"),
                Gdx.files.internal("shaders/explosion_fragment.glsl"));
        if (!explosionShader.isCompiled()) {
            Gdx.app.error("fontShader of Number Text", "compilation failed:\n" + explosionShader);
        }
    }

    public ShaderProgram getCircle() {
        return circle;
    }
    public ShaderProgram getFontShader() {
        return fontShader;
    }
    public ShaderProgram getExplosionShader() {
        return explosionShader;
    }
    @Override
    public void dispose() {
        circle.dispose();
        fontShader.dispose();
        transitionShader.dispose();
        burnShader.dispose();
        explosionShader.dispose();
    }


}
