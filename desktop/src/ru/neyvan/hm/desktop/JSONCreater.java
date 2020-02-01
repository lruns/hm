package ru.neyvan.hm.desktop;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.lwjgl.LwjglApplication;
import com.badlogic.gdx.backends.lwjgl.LwjglApplicationConfiguration;
import com.badlogic.gdx.utils.Json;
import com.badlogic.gdx.utils.JsonWriter;

import org.lwjgl.Sys;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.json_creater.Main;


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
