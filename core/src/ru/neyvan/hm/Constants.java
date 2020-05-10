package ru.neyvan.hm;

import ru.neyvan.hm.levels.Difficult;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Application.ApplicationType;
import com.badlogic.gdx.Application;

/**
 * Created by AndyGo on 04.07.2017.
 */

public class Constants {
    public static String VERSION = "1.0.2 beta";
    public static String WEBSITE = "www.neyvan.ru";
    public static String EMAIL = "neyvan.development@gmail.com";

    public static final boolean gwt = (Gdx.app.getType() == ApplicationType.WebGL);

    public static int SCORE_DELTA = 10; // add (or remove) for every true(false) turn and multiplied
                        // in game to episode number -> you can have 10, 20, 30 ...

    // Smaller screen height - screen resolution (15:9)
    public static int MIN_WIDTH = 480;
    public static int MIN_HEIGHT = 800;
    // Greater screen height - screen resolution (18:9)
    public static int MAX_WIDTH = 480;
    public static int MAX_HEIGHT = 960;

    public final static int MAX_BACKGROUNDS = 15;

    public final static int MAX_EPISODE = 4;
	public final static int MAX_LEVEL[] = {4, 4, 4, 4};
	public final static int EPISODE_APPEARANCE[] = {0, 0, 0, 0};

    public final static Difficult[] DIFFICULTS = {Difficult.VERY_EASY, Difficult.EASY, Difficult.EASY, Difficult.NORMAL};

	public final static String GAME_DATA_PATH = "bubu.data";
    public final static String PLAYER_PATH = "lulu.data";
    public final static String PREFERENCES_PATH = "mumu.data";

    // For development and testing

    public final static boolean FAST_GAME = false;
    public final static int FAST_GAME_MAX_COUNT = 2;
    public final static boolean IMMORTALITY = false;
    public final static int LOG_LEVEL = Application.LOG_NONE; 



}
