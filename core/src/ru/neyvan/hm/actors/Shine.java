package ru.neyvan.hm.actors;

import com.badlogic.gdx.graphics.g2d.Batch;
import com.badlogic.gdx.graphics.g2d.ParticleEffect;
import com.badlogic.gdx.graphics.g2d.ParticleEffectPool;
import com.badlogic.gdx.scenes.scene2d.Actor;

import ru.neyvan.hm.HM;

/**
 * Created by AndyGo on 12.06.2018.
 */

public class Shine extends Actor {
    private ParticleEffect modelEffect1,modelEffect2;
    private ParticleEffectPool modelEffectPool1, modelEffectPool2;
    private ParticleEffectPool.PooledEffect effect;
    private float speed;

    public Shine(){
        modelEffect1 = HM.game.manager.get("particles/good_shine.p", ParticleEffect.class);
        modelEffectPool1 = new ParticleEffectPool(modelEffect1, 1, 2);
        modelEffect2 = HM.game.manager.get("particles/bad_shine.p", ParticleEffect.class);
        modelEffectPool2 = new ParticleEffectPool(modelEffect2, 1, 2);
    }

    public void create(int posX, int posY, float zoom, float speed, float duration, boolean good){
        this.speed = speed;
        if(good)effect = modelEffectPool1.obtain();
        else effect = modelEffectPool2.obtain();
        effect.scaleEffect(zoom);
        effect.setPosition(posX, posY);
        effect.setDuration((int) (duration*speed*1000));
    }

    @Override
    public void draw(Batch batch, float parentAlpha){
        if(effect!=null)effect.draw(batch);
    }

    @Override
    public void act(float delta){
        if(effect!=null){
            effect.update(delta*speed);
            if (effect.isComplete()) {
                effect.free();
                effect = null;
            }
        }
    }

    public void dispose(){
        effect.dispose();
        effect = null;
        modelEffectPool1.clear();
        modelEffectPool1 = null;
        modelEffectPool2.clear();
        modelEffectPool2 = null;
        modelEffect1.dispose();
        modelEffect1 = null;
        modelEffect2.dispose();
        modelEffect2 = null;
    }
}
