package ru.neyvan.hm.surprises;


import com.badlogic.gdx.utils.Json;

/**
 * Created by AndyGo on 08.01.2018.
 */

public abstract class Surprise  {
    private final float maxTime;
    private float time;

    public Surprise(){this.maxTime = 1.0f;}
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
