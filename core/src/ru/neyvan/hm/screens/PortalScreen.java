package ru.neyvan.hm.screens;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.ScreenAdapter;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;
import com.badlogic.gdx.math.MathUtils;

import ru.neyvan.hm.HM;

public class PortalScreen extends ScreenAdapter {
//    SpriteBatch batch;
//    ShaderProgram shader;
//    Texture texture;
//    float time;
//    float deltaX;
//    float deltaY;
//    float width;
//    float height;
//    float maxTime = 3;
//    boolean go = false;
//    boolean load = false;
//
//    public PortalScreen() {
//        batch = new SpriteBatch();
//        shader = HM.game.shader.getShaderPortal();
//        texture = HM.game.texture.shaderTexture;
//        width = Gdx.graphics.getWidth();
//        height = Gdx.graphics.getHeight();
//        batch.getProjectionMatrix().setToOrtho2D(0, 0, width, height);
//        shader.begin();
//        shader.setUniformf("resolution", width, height);
//        shader.end();
//        batch.setShader(shader);
//    }
//    @Override
//    public void render(float delta) {
//        time += delta;
//        if(maxTime < time && !go){
//            if(FS.game.assets.isLoadBackground(FS.game.level.getLevel())) {
//                go = true;
//                ScreenTransition screenTransition = new ScreenTransitionCircle(0.75f);
//                HM.game.setScreen(new PlayScreen(), screenTransition);
//            }
//        }
//        deltaX = (float) (MathUtils.sin(time)/2.0);
//        deltaY = (float) (MathUtils.cos(time)/4.0);
//
//        Gdx.gl.glClearColor(0,0,0,1);
//        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
//
//        shader.begin();
//        shader.setUniformf("globalTime", time);
//        shader.setUniformf("deltaX", deltaX);
//        shader.setUniformf("deltaY", deltaY);
//        shader.end();
//
//        batch.begin();
//        batch.draw(texture, 0, 0, width, height);
//        batch.end();
//    }
//
//    @Override
//    public void resume() {
//        super.resume();
//        if(!load){
//            load = true;
//            FS.game.assets.updateGameBackground(FS.game.level.getOldLevel(), FS.game.level.getLevel());
//        }
//    }
//
//    @Override
//    public void dispose() {
//        batch.dispose();
//        shader = null;
//    }
}
