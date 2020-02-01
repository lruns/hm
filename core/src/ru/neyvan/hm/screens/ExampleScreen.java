package ru.neyvan.hm.screens;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.ScreenAdapter;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.TextureRegion;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.ProgressBar;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Slider;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.scenes.scene2d.ui.TextButton;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.utils.viewport.FitViewport;

import ru.neyvan.hm.Constants;

/**
 * Created by AndyGo on 02.12.2017.
 */

public class ExampleScreen extends ScreenAdapter {
//    Stage stage;
//    RadialSprite radialSprite;
//    ProgressBar bar;
//    float angle;
    public  ExampleScreen() {

//        stage = new Stage(new FitViewport(Constants.WIDTH, Constants.HEIGHT));
//        Texture texture = new Texture("circle_bar.png");
//        texture.setFilter(Texture.TextureFilter.Linear, Texture.TextureFilter.Linear);
//        radialSprite = new RadialSprite(new TextureRegion(texture));
//       // RadialProgressBar progressBar = new RadialProgressBar();
//        //radialSprite.setColor(Color.GOLD);
//        Image image = new Image(radialSprite);
//        Skin uiSkin = new Skin(Gdx.files.internal("style/hm_skin.json"));
//        final Slider scrollBar = new Slider(-2.0f, 2.0f, 0.001f, false, uiSkin);
//        radialSprite.changeDirection(true);
//        scrollBar.addListener(new ChangeListener() {
//            @Override
//            public void changed(ChangeEvent event, Actor actor) {
//                radialSprite.setAngle((1.0f-scrollBar.getValue())*360);
//                radialSprite.setColor(new Color(0.0f, 1f, 0.0f, 1));
//            }
//        });
//        Table table = new Table();
//        table.debug();
//        table.setFillParent(true);
//        table.add(image).size(300f).row();
//        table.add(scrollBar).width(300f).row();
//        stage.addActor(table);
//        stage.addActor(new TextButton("sdsd", uiSkin));
//        Gdx.input.setInputProcessor(stage);
    }
    @Override
    public void render(float delta) {
//        Gdx.gl.glClearColor(0, 0, 0, 1);
//        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
//        stage.act(Gdx.graphics.getDeltaTime());
//        stage.draw();

    }
}
