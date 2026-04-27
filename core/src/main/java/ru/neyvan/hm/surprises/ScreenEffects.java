package ru.neyvan.hm.surprises;

/**
 * Created by AndyGo on 21.02.2018.
 */

public class ScreenEffects extends Surprise{
    public static final int COLOR_MUSIC = 1;
    public static final int INVERSION = 2;
    private int type = 0;

    public ScreenEffects(){super();}
    public ScreenEffects(float maxTime, int type) {
        super(maxTime);
        this.type = type;
    }

    public int getType() {
        return type;
    }
}
