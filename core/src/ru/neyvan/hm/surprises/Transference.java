package ru.neyvan.hm.surprises;

/**
 * Created by AndyGo on 21.02.2018.
 */

public class Transference extends Surprise {
    private float speedX, speedY;

    public Transference(){super();}
    public Transference(float maxTime, float firstSpeedX, float firstSpeedY) {
        super(maxTime);
        this.speedX = firstSpeedX;
        this.speedY = firstSpeedY;
    }

    public float getSpeedX() {
        return speedX;
    }

    public float getSpeedY() {
        return speedY;
    }
}
