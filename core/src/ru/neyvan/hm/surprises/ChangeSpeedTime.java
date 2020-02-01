package ru.neyvan.hm.surprises;

import com.badlogic.gdx.Gdx;

/**
 * Created by AndyGo on 22.01.2018.
 */

public class ChangeSpeedTime extends Surprise{
    private float multiplierTime;
    public ChangeSpeedTime(float maxTime, float multiplierTime) {
        super(maxTime);
        this.multiplierTime = multiplierTime;
    }

    @Override
    public void update(float delta) {
        super.update(Gdx.graphics.getDeltaTime());
        //slow or speed up time on screen for multiplierTime
    }

    @Override
    public void draw(float delta) {
        if(multiplierTime > 1f){
            //DRAW SPEED UP TIME
        }else{
            //DRAW SLOW TIME
        }
    }

    public float getMultiplierTime() {
        return multiplierTime;
    }
}
