package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.screens.PlayScreen;

public class ExplosionState extends State {
    private int maxNumberExplosion;
    private int numberExplosion;
    private float maxTimeOneExplosion;
    private float timeOneExplosion;

    public ExplosionState(PlayScreen core) {
        super(core);
    }

    public void setNumberExplosion(int maxNumberExplosion){
        this.maxNumberExplosion = maxNumberExplosion;
        numberExplosion = maxNumberExplosion;
    }

    @Override
    public void start(float time) {
        super.start(time);
        maxTimeOneExplosion = 0.9f * time/ maxNumberExplosion;
        timeOneExplosion = time * 0.05f;
        Gdx.app.debug("ExplosionState", "Begin state with time " + time);
    }

    @Override
    public void update(float delta) {
        super.update(delta);
        timeOneExplosion -= delta;
        if( numberExplosion > 0 && timeOneExplosion < 0){
            explose();
        }
    }

    @Override
    public void end() {
        core.getGame().nextTurn();
        core.getGui().updateDisplay();
        core.nextState(core.getChangeState(), core.getGame().getTimeChange());
    }

    private void explose(){
        timeOneExplosion = maxTimeOneExplosion;
        core.getGui().explose();
        core.getGame().nextTurn();
        numberExplosion --;
    }
}
