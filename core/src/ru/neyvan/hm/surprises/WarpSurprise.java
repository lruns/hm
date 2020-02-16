package ru.neyvan.hm.surprises;

/**
 * Created by AndyGo on 21.02.2018.
 */

public class WarpSurprise extends Surprise {
    public final float speedWarp;

    public WarpSurprise(){super(); speedWarp = 1.0f;}
    public WarpSurprise(float maxTime, float speedWarp) {
        super(maxTime);
        this.speedWarp = speedWarp;
    }

    public float getSpeedWarp() {
        return speedWarp;
    }
}
