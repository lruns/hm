package ru.neyvan.hm.actors;

import com.badlogic.gdx.graphics.g2d.Batch;
import com.badlogic.gdx.graphics.g2d.ParticleEffect;
import com.badlogic.gdx.graphics.g2d.ParticleEffectPool;
import com.badlogic.gdx.scenes.scene2d.Actor;

import ru.neyvan.hm.HM;

public class StreamEnergy extends Actor {

    private ParticleEffect modelEffect;
    private ParticleEffectPool modelEffectPool;
    private ParticleEffectPool.PooledEffect effect1, effect2;
    private float speed;
    private int zoom = 1;
    private float xx;
    private float y1;
    private float y2;

    public StreamEnergy(float speed){
        this.speed = speed;
        modelEffect = HM.game.manager.get("particles/stream_energy.p", ParticleEffect.class);
        modelEffect.reset();
        modelEffectPool = new ParticleEffectPool(modelEffect, 1, 2);
    }

    public void setEffectPosition(float xx, float y1, float y2){
        this.xx = xx;
        this.y1 = y1;
        this.y2 = y2;
        if(effect1 != null) effect1.setPosition(xx, y1);
        if(effect2 != null) effect2.setPosition(xx, y2);
    }

    public void start(){
        effect1 = modelEffectPool.obtain();
        effect1.scaleEffect(zoom);
        effect1.setPosition(xx, y1);

        effect2 = modelEffectPool.obtain();
        effect2.scaleEffect(zoom);
        effect2.setPosition(xx, y2);

    }
    public void stop(){
        if(effect1 != null) effect1.free();
        if(effect2 != null) effect2.free();
    }
    @Override
    public void draw(Batch batch, float parentAlpha){
        super.draw(batch, parentAlpha);
        if(effect1 != null) effect1.draw(batch);
        if(effect2 != null) effect2.draw(batch);
    }
    @Override
    public void act(float delta){
        super.act(delta);
        if(effect1 != null) effect1.update(delta*speed);
        if(effect2 != null) effect2.update(delta*speed);
    }

    public void dispose(){
        if(effect1 != null) effect1.dispose();
        effect1 = null;
        if(effect2 != null) effect2.dispose();
        effect2 = null;
        modelEffectPool.clear();
        modelEffectPool = null;
        modelEffect.dispose();
        modelEffect = null;
    }
    }
