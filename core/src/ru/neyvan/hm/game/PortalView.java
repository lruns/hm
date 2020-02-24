package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;
import com.badlogic.gdx.math.MathUtils;

import ru.neyvan.hm.HM;


public class PortalView {
    SpriteBatch batch;
    ShaderProgram shader;
    Texture texture;
    float time;
    float deltaX;
    float deltaY;
    float width;
    float height;


    public PortalView() {
        batch = new SpriteBatch();
        shader = HM.game.shader.getPortalShader();
        texture = HM.game.texture.getTranstionShaderTexture();
        batch.setShader(shader);
    }

    public void render(float delta) {
        time += delta;

        deltaX = (float) (MathUtils.sin(time)/2.0);
        deltaY = (float) (MathUtils.cos(time)/4.0);

        Gdx.gl.glClearColor(0,0,0,1);
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);

        shader.begin();
        shader.setUniformf("globalTime", time);
        shader.setUniformf("deltaX", deltaX);
        shader.setUniformf("deltaY", deltaY);
        shader.end();

        batch.begin();
        batch.draw(texture, 0, 0, width, height);
        batch.end();

    }

    public void resize(int width, int height){
        this.width = width;
        this.height = height;
        batch.getProjectionMatrix().setToOrtho2D(0, 0, width, height);
        shader.begin();
        shader.setUniformf("resolution", width, height);
        shader.end();
    }

    public void dispose() {
        batch.dispose();
    }
}
