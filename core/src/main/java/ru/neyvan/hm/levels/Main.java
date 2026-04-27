package ru.neyvan.hm.levels;

import com.badlogic.gdx.Game;

/**
 * Created by AndyGo on 08.01.2018.
 */

public class Main extends Game {
    @Override
    public void create() {
        setScreen(new ScreenLevelEditor());
    }

    @Override
    public void render() {
        super.render();
    }
}
