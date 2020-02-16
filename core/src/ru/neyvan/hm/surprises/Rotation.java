package ru.neyvan.hm.surprises;

/**
 * Created by AndyGo on 21.02.2018.
 */

public class Rotation extends Surprise {
    private float speed;
    private boolean oneCircle;
    public Rotation(){super();}
    public Rotation(float maxTime, float speed, boolean oneCircle) {
        super(maxTime);
        this.speed = speed;
        this.oneCircle = oneCircle;
    }


    public float getSpeed() {
        return speed;
    }

    public boolean isOneCircle() {
        return oneCircle;
    }
}
