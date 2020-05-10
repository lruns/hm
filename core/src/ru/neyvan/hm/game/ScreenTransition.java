package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;
import com.badlogic.gdx.scenes.scene2d.Stage;


import ru.neyvan.hm.Constants;
import ru.neyvan.hm.HM;
import ru.neyvan.hm.surprises.ScreenEffects;

import static com.badlogic.gdx.graphics.GL20.GL_TEXTURE0;
import static com.badlogic.gdx.graphics.GL20.GL_TEXTURE1;

public class ScreenTransition {

    private ShaderProgram shader;
    private SpriteBatch batch;

    private float width;
    private float height;
    private float width2;
    private float height2;

    public ScreenTransition() {
        batch = new SpriteBatch();
        shader = HM.game.shader.getTransitionShader();
        batch.setShader(shader);
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
        shader.end();


        batch.begin();
        batch.draw(currScreen, 0, 0, width2, height2);
        batch.end();
    }

    public void resize(Stage stage, int width, int height){
        //batch.getProjectionMatrix().setToOrtho2D(0, 0, width, height);
        if(Constants.gwt){
            this.width2 = width;
            this.height2 = height;
        }else{
            this.width2 = stage.getViewport().getWorldWidth();
            this.height2 = stage.getViewport().getWorldHeight();
        }
        this.width = stage.getViewport().getScreenWidth();
        this.height = stage.getViewport().getScreenHeight();
        
        shader.begin();
        shader.setUniformf("resolution", this.width, this.height);
        shader.setUniformf("position", 0.5f*(width-this.width),
                0.5f*(height-this.height));
        shader.end();
    }

    public void dispose() {
        batch.dispose();
    }
}

