package ru.neyvan.hm;

import com.badlogic.gdx.Game;

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
