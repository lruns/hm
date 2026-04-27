package ru.neyvan.hm.surprises;

/**
 * Created by AndyGo on 21.02.2018.
 */

public class Transference extends Surprise {
    private float speedX, speedY;

    public Transference(){super();}

    // speed = 1 full screen width(height) / 1 sec; то есть за одну секунду ты можешь пролететь весь экран со скорость 1
    // speed can be < 0
    public Transference(float maxTime, float speedX, float speedY) {
        super(maxTime);
        this.speedX = speedX;
        this.speedY = speedY;
    }

    public float getSpeedX() {
        return speedX;
    }

    public float getSpeedY() {
        return speedY;
    }
}
