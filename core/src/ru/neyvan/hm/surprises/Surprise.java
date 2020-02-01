package ru.neyvan.hm.surprises;

import java.io.Serializable;

/**
 * Created by AndyGo on 08.01.2018.
 */

public abstract class Surprise implements Serializable{
    private final float maxTime;
    private float time;
    public Surprise(float maxTime){
        this.maxTime = maxTime;
    }
    public void start(){
        time = maxTime;
    }
    public void update(float delta){
        time -= delta;
    }
    public abstract void draw(float delta);
    public boolean end(){
        return time<0;
    }
    public float getTime(){
        return time;
    }
    public float getMaxTime(){
        return maxTime;
    }
}
