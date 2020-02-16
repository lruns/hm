package ru.neyvan.hm.surprises;

/**
 * Created by AndyGo on 22.01.2018.
 */

public class ChangeSpeedTime extends Surprise{
    private float multiplierTime;
    public ChangeSpeedTime(){super();}
    public ChangeSpeedTime(float maxTime, float multiplierTime) {
        super(maxTime);
        this.multiplierTime = multiplierTime;
    }

    public float getMultiplierTime() {
        return multiplierTime;
    }
}
