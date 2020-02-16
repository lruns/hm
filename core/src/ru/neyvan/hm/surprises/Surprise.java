package ru.neyvan.hm.surprises;


/**
 * Created by AndyGo on 08.01.2018.
 */

public abstract class Surprise  {
    private final float maxTime;

    public Surprise(){this.maxTime = 1.0f;}
    public Surprise(float maxTime){
        this.maxTime = maxTime;
    }
    public float getMaxTime(){
        return maxTime;
    }
}
