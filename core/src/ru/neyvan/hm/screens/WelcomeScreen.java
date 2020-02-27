package ru.neyvan.hm.screens;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.ScreenAdapter;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.utils.Align;
import com.badlogic.gdx.utils.Scaling;
import com.badlogic.gdx.utils.viewport.ExtendViewport;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.HM;


/**
 * Created by AndyGo on 27.06.2017.
 */

public class WelcomeScreen extends ScreenAdapter {
    private Stage stage;
    private Texture texture;
    private Image image;

    public WelcomeScreen() {
        stage = new Stage(new ExtendViewport(Constants.MIN_WIDTH, Constants.MIN_HEIGHT,
                Constants.MAX_WIDTH, Constants.MAX_HEIGHT));
        texture = new Texture(Gdx.files.internal("welcome_screen.jpg"));
        //texture.setFilter(Texture.TextureFilter.Linear, Texture.TextureFilter.Linear);

        image = new Image(texture);
        image.setAlign(Align.center);
        image.setFillParent(true);
        image.setScaling(Scaling.fill);
        stage.addActor(image);
    }

    @Override
    public void resize(int width, int height) {
        super.resize(width, height);
        stage.getViewport().update(width, height, true);
    }

    @Override
    public void show() {
        image.addAction(Actions.sequence(
                Actions.delay(0.2f),
                Actions.fadeIn(0.8f),
                Actions.run(new Runnable() {
                    @Override
                    public void run() {
                        HM.game.initManagers();
                    }
                }),
                Actions.delay(0.5f),
                Actions.fadeOut(1f),
                Actions.run(new Runnable() {
                    @Override
                    public void run() {
                        HM.game.setScreen(new MenuScreen(MenuScreen.APPEARANCE_ELASTIC));
                    }
                })
        ));
    }

    @Override
    public void render(float delta) {
        Gdx.gl.glClearColor(0, 0, 0, 1);
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
        stage.act(delta);
        stage.draw();
    }

    @Override
    public void dispose() {
        stage.dispose();
        texture.dispose();
        image.clear();
    }
}
