package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;

import ru.neyvan.hm.HM;

import static com.badlogic.gdx.graphics.GL20.GL_TEXTURE0;
import static com.badlogic.gdx.graphics.GL20.GL_TEXTURE1;

public class ScreenTransition {

    private ShaderProgram shader;
    private SpriteBatch batch;
    private float width;
    private float height;

    public ScreenTransition() {
        batch = new SpriteBatch();
        shader = HM.game.shader.getTransitionShader();
    }

    public void render (Texture currScreen,
                        Texture nextScreen, float percent) {

        Gdx.gl.glClearColor(0,0,0,1);
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);

        Gdx.gl.glActiveTexture(GL_TEXTURE1);
        nextScreen.bind();

        Gdx.gl.glActiveTexture(GL_TEXTURE0);
        currScreen.bind();

        shader.begin();
        shader.setUniformf("percent", percent);
        shader.setUniformf("resolution", width, height);
        shader.end();

        batch.setShader(shader);
        batch.begin();
        batch.draw(currScreen, 0, 0, width, height);
        batch.end();
        batch.setShader(null);

    }

    public void resize(int width, int height){
        batch.getProjectionMatrix().setToOrtho2D(0, 0, width, height);
        this.width = width;
        this.height = height;
        shader.begin();
        shader.setUniformf("resolution", width, height);
        shader.end();
    }
}

