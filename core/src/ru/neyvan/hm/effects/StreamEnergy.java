package ru.neyvan.hm.effects;

import com.badlogic.gdx.graphics.g2d.ParticleEffect;
import com.badlogic.gdx.graphics.g2d.ParticleEffectPool;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.utils.Array;

import ru.neyvan.hm.HM;

public class StreamEnergy {

    private ParticleEffect modelEffect;
    private ParticleEffectPool modelEffectPool;
    private ParticleEffectPool.PooledEffect effect1, effect2;
    private float speed;

    public StreamEnergy(){
        modelEffect = HM.game.manager.get("particles/stream_energy.p", ParticleEffect.class);
        modelEffectPool = new ParticleEffectPool(modelEffect, 1, 2);
    }
    public void create(int posX, int posY, float zoom, float speed, float heightScreen){
        this.speed = speed;
        effect1 = modelEffectPool.obtain();
        effect1.scaleEffect(zoom);
        effect1.setPosition(posX, posY);

        effect2 = modelEffectPool.obtain();
        effect2.scaleEffect(zoom);
        effect2.setPosition(posX, heightScreen*0.65f/zoom);

    }
    public void draw(SpriteBatch batch){
        effect1.draw(batch);
        effect2.draw(batch);
    }
    public void update(float delta){
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
