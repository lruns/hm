package ru.neyvan.hm.surprises;

import com.badlogic.gdx.Gdx;

/**
 * Created by AndyGo on 21.02.2018.
 */

public class Transference extends Surprise {
    private float centreX, centreY;
    private float speedX, speedY;
    private float radius;
    private float maxHeight;
    private float maxWidth;
    public Transference(){super();}
    public Transference(float maxTime, float firstSpeedX, float firstSpeedY) {
        super(maxTime);
        this.speedX = firstSpeedX;
        this.speedY = firstSpeedY;
    }

    @Override
    public void start() {
        super.start();
        radius = 50f;
        maxHeight = 400f;
        maxWidth = 400f;
    }

    @Override
    public void update(float delta) {
        super.update(delta);
        //if pause - circle return to centre. After pause return to position centreX, centreY
        centreX += speedX * delta;
        centreY += speedY * delta;
        if(radius > centreX || centreX > maxWidth-radius){
            speedX = -speedX;
        }
        if (radius > centreY || centreY > maxHeight-radius){
            speedY = -speedY;
        }
    }

    @Override
    public void draw(float delta) {

    }

    public float getSpeedX() {
        return speedX;
    }

    public float getSpeedY() {
        return speedY;
    }
}
