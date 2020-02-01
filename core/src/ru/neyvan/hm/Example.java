package ru.neyvan.hm;

import com.badlogic.gdx.Game;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.TextureRegion;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Slider;
import com.badlogic.gdx.scenes.scene2d.ui.Table;

import ru.neyvan.hm.screens.ExampleScreen;


/**
 * Created by AndyGo on 02.12.2017.
 */

public class Example  extends Game {

    @Override
    public void create() {
        setScreen(new ExampleScreen());
    }

}
