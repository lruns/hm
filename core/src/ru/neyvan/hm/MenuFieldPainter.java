package ru.neyvan.hm;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;
import com.badlogic.gdx.math.MathUtils;

/**
 * Created by AndyGo on 08.07.2017.
 */

public class MenuFieldPainter {
    SpriteBatch batch;
    ShaderProgram shader;
    Texture texture;
    float time, timePaint, timeChange, maxTimeChange;
    int width, height;
    boolean init, changePainter, appeare;
    float light;

    public void create(){
        if(init) return;
        shader = new ShaderProgram(Gdx.files.internal("shaders/vertex.glsl"),
                Gdx.files.internal("shaders/fragment.glsl"));
        if(!shader.isCompiled())
            Gdx.app.log("Shader", shader.getLog());

        batch = new SpriteBatch();
        batch.setShader(shader);

        texture = new Texture("shaders/shader.png");
        texture.setWrap(Texture.TextureWrap.Repeat, Texture.TextureWrap.Repeat);
        texture.setFilter(Texture.TextureFilter.Nearest, Texture.TextureFilter.Nearest);

        time = 0;
        init = true;
        fadeIn(1.0f);
    }
    public void resize(int width, int height){
        if(!init) return;

        this.width = width;
        this.height = height;
        batch.getProjectionMatrix().setToOrtho2D(0, 0, width, height);
        shader.begin();
        shader.setUniformf("resolution", width, height);
        shader.end();
    }
    public void draw(float delta){
        if(!init) return;

        if(changePainter){
            timeChange += delta;
            if(appeare){
                if(timeChange > maxTimeChange){
                    changePainter = false;
                    light = 1;
                }
                light = timeChange/maxTimeChange;
            }else{
                if(timeChange > maxTimeChange) timeChange = maxTimeChange;
                light = 1.0f - timeChange/maxTimeChange;
            }
        }

        time += delta;
        timePaint = 0.12f*MathUtils.sin(time)+0.25f;
        Gdx.gl.glClearColor(0.05f*light, 0.01f*light, timePaint*light, 1);
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
        shader.begin();
        shader.setUniformf("time", time);
        shader.setUniformf("sinX", timePaint);
        shader.setUniformf("light", light);
        shader.end();

        batch.begin();
        batch.draw(texture, 0, 0 , width, height);
        batch.end();

    }
    public void dispose(){
        batch.dispose();
        shader.dispose();
        texture.dispose();
        init = false;
    }
    public void fadeOut(float timeChange){
        this.timeChange = 0;
        this.maxTimeChange = timeChange;
        appeare = false;
        changePainter = true;
    }
    private void fadeIn(float timeChange){
        this.timeChange = 0;
        this.maxTimeChange = timeChange;
        appeare = true;
        changePainter = true;
    }

}
