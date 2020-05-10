package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;
import com.badlogic.gdx.math.MathUtils;
import com.badlogic.gdx.scenes.scene2d.Stage;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.HM;


public class PortalView {
    SpriteBatch batch;
    ShaderProgram shader;
    Texture texture;
    float time;
    float deltaX;
    float deltaY;
    float width, height;
    float width2, height2;
    float x, y;

    public PortalView() {
        batch = new SpriteBatch();
        shader = HM.game.shader.getPortalShader();
        texture = HM.game.texture.getTranstionShaderTexture();
        batch.setShader(shader);
    }

    public void render(float delta){
        this.render(delta, false);
    }

    public void render(float delta, boolean offReposition) {
        time += delta;

        deltaX = (float) (MathUtils.sin(time)/2.0);
        deltaY = (float) (MathUtils.cos(time)/4.0);

        Gdx.gl.glClearColor(0,0,0,1);
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);

        shader.begin();
        shader.setUniformf("globalTime", time);
        shader.setUniformf("deltaX", deltaX);
        shader.setUniformf("deltaY", deltaY);
        if(offReposition){
            shader.setUniformf("position", 0, 0);
        }else{
            shader.setUniformf("position", x, y);
        }
        shader.end();


        batch.begin();
        batch.draw(texture, 0,0, width2, height2);
        batch.end();

    }

    public void resize(Stage stage, int width, int height ){
        if(Constants.gwt){
            this.width2 = width;
            this.height2 = height;           
        }else{
            this.width2 = stage.getViewport().getWorldWidth();
            this.height2 = stage.getViewport().getWorldHeight();
        }
        
        this.width = stage.getViewport().getScreenWidth();
        this.height = stage.getViewport().getScreenHeight();
        
        x = 0.5f*(width-this.width);
        y = 0.5f*(height-this.height);

        shader.begin();
        shader.setUniformf("resolution", this.width, this.height);
        shader.setUniformf("position",x, y);
        shader.end();
    }

    public void dispose() {
        batch.dispose();
    }
}
