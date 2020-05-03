package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;
import com.badlogic.gdx.math.MathUtils;
import com.badlogic.gdx.scenes.scene2d.Stage;

import ru.neyvan.hm.HM;


public class PortalView {
    SpriteBatch batch;
    ShaderProgram shader;
    Texture texture;
    float time;
    float deltaX;
    float deltaY;
    float width, height;
    float x,y;

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
        batch.draw(texture, x, y, width, height);
        batch.end();

    }

    public void resize(Stage stage, int width, int height ){
        this.width = width;
        this.height = height;
        shader.begin();
        shader.setUniformf("resolution", stage.getViewport().getScreenWidth(), stage.getViewport().getScreenHeight());
        shader.setUniformf("position", 0.5f*(width-stage.getViewport().getScreenWidth()),
                0.5f*(height-stage.getViewport().getScreenHeight()));
        shader.end();
    }

    public void dispose() {
        batch.dispose();
    }
}
