package ru.neyvan.hm.desktop;

import com.badlogic.gdx.backends.lwjgl.LwjglApplication;
import com.badlogic.gdx.backends.lwjgl.LwjglApplicationConfiguration;

import java.io.IOException;

import ru.neyvan.hm.levels.Main;


/**
 * Created by AndyGo on 08.01.2018.
 */

public class JSONCreater {
    public static void main(String[] args) throws IOException {
        LwjglApplicationConfiguration config = new LwjglApplicationConfiguration();
        config.width = (int) (1200);
        config.height = (int) (700);
        config.title = "Level Creater";
        new LwjglApplication(new Main(), config);

    }

}
