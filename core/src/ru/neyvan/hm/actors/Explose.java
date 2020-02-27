package ru.neyvan.hm.actors;

import com.badlogic.gdx.graphics.g2d.Batch;
import com.badlogic.gdx.graphics.g2d.ParticleEffect;
import com.badlogic.gdx.graphics.g2d.ParticleEffectPool;
import com.badlogic.gdx.scenes.scene2d.Actor;

import ru.neyvan.hm.HM;

public class Explose extends Actor {
    private ParticleEffect exploseEffect;
    private ParticleEffectPool exploseEffectPool;
    private ParticleEffectPool.PooledEffect effect;

    private float speed;
    private int zoom = 1;
    private float xx;
    private float yy;

    public Explose(float speed){
        this.speed = speed;
        exploseEffect = HM.game.manager.get("particles/explosion.p", ParticleEffect.class);
        exploseEffect.reset();
        exploseEffectPool = new ParticleEffectPool(exploseEffect, 1, 5);
    }

    public void setEffectPosition(float xx, float yy){
        this.xx = xx;
        this.yy = yy;
        if(effect != null) effect.setPosition(xx, yy);
    }

    public void start(){
        effect = exploseEffectPool.obtain();
        effect.scaleEffect(zoom);
        effect.setPosition(xx, yy);

    }
    public void stop(){
        if(effect != null){
            effect.free();
            effect = null;
        }
    }
    @Override
    public void draw(Batch batch, float parentAlpha){
        super.draw(batch, parentAlpha);
        if(effect != null) effect.draw(batch);
    }
    @Override
    public void act(float delta){
        super.act(delta);
        if(effect != null) effect.update(delta*speed);
    }

    public void dispose(){
        if(effect != null) effect.dispose();
        effect = null;

        exploseEffectPool.clear();
        exploseEffectPool = null;
        exploseEffect.dispose();
        exploseEffect = null;
    }

    public void setSpeed(float effectSpeed) {
        this.speed = effectSpeed;
    }
}
