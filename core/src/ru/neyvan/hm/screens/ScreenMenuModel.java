package ru.neyvan.hm.screens;

import com.badlogic.gdx.Application;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputAdapter;
import com.badlogic.gdx.InputMultiplexer;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.Screen;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.utils.viewport.FitViewport;
import com.badlogic.gdx.utils.viewport.StretchViewport;
import com.badlogic.gdx.utils.viewport.ScreenViewport;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.HM;

/**
 * Created by AndyGo on 04.07.2017.
 */

public class ScreenMenuModel implements Screen {
    protected Stage stage;
    protected Skin skin;
    protected boolean pause = true;

    public ScreenMenuModel() {
        stage = new Stage(new ScreenViewport());
        skin = HM.game.texture.skin;
        HM.game.menuFieldPainter.create();
    }

    @Override
    public void show() {
        InputProcessor backProcessor = new InputAdapter() {
            @Override
            public boolean keyDown(int keycode) {
                if ((keycode == Input.Keys.ESCAPE) || (keycode == Input.Keys.BACK)) back();
                return false;
            }
        };
        InputMultiplexer multiplexer = new InputMultiplexer(stage, backProcessor);
        Gdx.input.setInputProcessor(multiplexer);
    }


    public void back() {}

    @Override
    public void render(float delta) {
        HM.game.menuFieldPainter.draw(delta);
        stage.act(delta);
        stage.draw();
    }

    @Override
    public void resize(int width, int height) {
        stage.getViewport().update(width, height, false);
        HM.game.menuFieldPainter.resize(width, height);
    }

    @Override
    public void pause() {pause=true;}

    @Override
    public void resume() {pause=false;}

    @Override
    public void hide() {}

    @Override
    public void dispose() {
        stage.dispose();
    }

    public float posX(Actor actor, float percent){
        return stage.getWidth()*percent-actor.getWidth()/2;
    }
    public static float posX(Stage stage, Actor actor, float percent){
        return stage.getWidth()*percent-actor.getWidth()/2;

    }
    public static float posY(Stage stage, Actor actor, float percent){
        return stage.getHeight()*percent-actor.getHeight()/2;
    }
}
