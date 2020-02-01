package ru.neyvan.hm.surprises;

/**
 * Created by AndyGo on 21.02.2018.
 */

public class Rotation extends Surprise {
    private float speed;
    private boolean oneCircle;
    private float rotation; //in degrees 0-360
    public Rotation(float maxTime, float speed, boolean oneCircle) {
        super(maxTime);
        this.speed = speed;
        this.oneCircle = oneCircle;
        rotation = 0;
    }

    @Override
    public void update(float delta) {
        super.update(delta);
        if(rotation > 360) rotation=0;
        if(getTime()<0.5f){
            if(speed*getTime() < 360-rotation){
                speed += (360-rotation)/getTime() * 0.001f;
            }else if(speed*getTime() > 360-rotation){
                speed -= (360-rotation)/getTime() * 0.001f;
            }
        }
        if(oneCircle){
            if(!(179.9f < rotation && rotation < 180.1f)){
                rotation += speed*delta;
            }
        }else{
            rotation += speed*delta;
        }
    }

    @Override
    public void draw(float delta) {

    }

    @Override
    public boolean end() {
        return super.end();

    }

    public float getSpeed() {
        return speed;
    }

    public boolean isOneCircle() {
        return oneCircle;
    }
}
