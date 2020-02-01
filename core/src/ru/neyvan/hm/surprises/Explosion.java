package ru.neyvan.hm.surprises;

/**
 * Created by AndyGo on 21.02.2018.
 */

public class Explosion extends Surprise {
    private int numExplosions;
    private final float maxTimeExplosion;
    public Explosion(float maxTime, int numExplosions) {
        super(maxTime);
        maxTimeExplosion = maxTime/numExplosions;
        this.numExplosions = numExplosions;
    }

    @Override
    public void update(float delta) {
        super.update(delta);
    }

    @Override
    public void draw(float delta) {

    }

    public int getMaxNumberExplosions() {
        return numExplosions;
    }

    public float getMaxTimeExplosion() {
        return maxTimeExplosion;
    }
}
