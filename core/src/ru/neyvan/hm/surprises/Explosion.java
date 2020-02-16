package ru.neyvan.hm.surprises;

/**
 * Created by AndyGo on 21.02.2018.
 */

public class Explosion extends Surprise {
    private int numExplosions;
    private final float maxTimeExplosion;
    public Explosion(){super(); maxTimeExplosion = 1.0f;}
    public Explosion(float maxTime, int numExplosions) {
        super(maxTime);
        maxTimeExplosion = maxTime/numExplosions;
        this.numExplosions = numExplosions;
    }

    public int getMaxNumberExplosions() {
        return numExplosions;
    }

    public float getMaxTimeExplosion() {
        return maxTimeExplosion;
    }

}
