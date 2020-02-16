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

    public StreamEnergy(float speed, float posX, float posY, float heightScreen){
        this.speed = speed;
        modelEffect = HM.game.manager.get("particles/stream_energy.p", ParticleEffect.class);
        modelEffect.reset();
        modelEffectPool = new ParticleEffectPool(modelEffect, 1, 2);

        effect1 = modelEffectPool.obtain();
        effect1.scaleEffect(zoom);
        effect1.setPosition(posX, posY);

        effect2 = modelEffectPool.obtain();
        effect2.scaleEffect(zoom);
        effect2.setPosition(posX, heightScreen*0.65f/zoom);
        stop();
    }

    public void start(){
        effect1.start();
        effect2.start();
    }
    public void stop(){
        effect1.allowCompletion();
        effect2.allowCompletion();
    }
    @Override
    public void draw(Batch batch, float parentAlpha){
        super.draw(batch, parentAlpha);
        effect1.draw(batch);
        effect2.draw(batch);
    }
    @Override
    public void act(float delta){
        super.act(delta);
        effect1.update(delta*speed);
        effect2.update(delta*speed);
    }

    public void dispose(){
        effect1.dispose();
        effect1 = null;
        effect2.dispose();
        effect2 = null;
        modelEffectPool.clear();
        modelEffectPool = null;
        modelEffect.dispose();
        modelEffect = null;
    }
    }
