package ru.neyvan.hm;

import ru.neyvan.hm.levels.Difficult;

/**
 * Created by AndyGo on 04.07.2017.
 */

public class Constants {
    public static int SCORE_DELTA = 50; // add (or remove) for every true(false) turn and multiplied
                        // in game to episode number -> you can have 50, 100, 150 ...

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


}
