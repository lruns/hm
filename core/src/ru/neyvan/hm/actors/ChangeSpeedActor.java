package ru.neyvan.hm.actors;

import com.badlogic.gdx.graphics.g2d.Batch;
import com.badlogic.gdx.graphics.g2d.ParticleEffect;
import com.badlogic.gdx.graphics.g2d.ParticleEffectPool;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.Constants;

public class ChangeSpeedActor  extends Actor {

    private ParticleEffect modelSlowDown;
    private ParticleEffect modelSpeedUp;
    private ParticleEffectPool modelSlowDownPool;
    private ParticleEffectPool modelSpeedUpPool;
    private ParticleEffectPool.PooledEffect effect;
    private float speed;
    private int zoom = 1;
    private float xx;
    private float yy;

    public ChangeSpeedActor(float speed){
        this.speed = speed;
        
        if(Constants.gwt){
            modelSpeedUp = new ParticleEffect();
            modelSpeedUp.load(Gdx.files.internal("particles/fire_speed.p"), HM.game.texture.atlas);
            modelSlowDown = new ParticleEffect();
            modelSlowDown.load(Gdx.files.internal("particles/slow_speed.p"), HM.game.texture.atlas);
        }
        else{
            modelSpeedUp = HM.game.manager.get("particles/fire_speed.p", ParticleEffect.class);
            modelSlowDown = HM.game.manager.get("particles/slow_speed.p", ParticleEffect.class);
        }
        modelSpeedUp.reset();
        modelSlowDown.reset();
        modelSpeedUpPool = new ParticleEffectPool(modelSpeedUp, 1, 1);
        modelSlowDownPool = new ParticleEffectPool(modelSlowDown, 1, 1);
    }

    public void setEffectPosition(float xx, float yy){
        this.xx = xx;
        this.yy = yy;
        if(effect != null) effect.setPosition(xx, yy);
    }

    public void start(boolean isSpeedUp){
        if(isSpeedUp) effect = modelSpeedUpPool.obtain();
        else effect = modelSlowDownPool.obtain();
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

        modelSpeedUpPool.clear();
        modelSpeedUpPool = null;
        modelSpeedUp.dispose();
        modelSpeedUp = null;

        modelSlowDownPool.clear();
        modelSlowDownPool = null;
        modelSlowDown.dispose();
        modelSlowDown = null;
    }

    public void setSpeed(float effectSpeed) {
        this.speed = effectSpeed;
    }
}
