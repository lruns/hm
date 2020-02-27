package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.utils.Timer;

import ru.neyvan.hm.screens.PlayScreen;

public class ExplosionState extends State {
    private int maxNumberExplosion;
    private int numberExplosion;
    private float maxTimeOneExplosion;
    private float timeBeforeExplose;
    private float timeAfterExplose;
    private float oneTime;
    public ExplosionState(PlayScreen core) {
        super(core);
    }

    public void setNumberExplosion(int maxNumberExplosion){
        this.maxNumberExplosion = maxNumberExplosion;
        //this.maxNumberExplosion; //because we must delete current symbol (explosion symbol) on display!!!
        numberExplosion = maxNumberExplosion;
    }

    @Override
    public void start(float time) {
        timeBeforeExplose = core.getGame().getTimeChange();
        timeAfterExplose = core.getGame().getTimeChange();
        super.start(time+timeBeforeExplose+timeAfterExplose);
        maxTimeOneExplosion = time/ (maxNumberExplosion);
        oneTime = timeBeforeExplose;
        core.resetAllImpacts();

        core.getGame().nextTurn();
        core.getGui().updateDisplay(0.9f * timeBeforeExplose);
        core.getGui().resetTimeBar(0.5f * timeBeforeExplose);

        Gdx.app.debug("ExplosionState", "Begin state with time " + time);
        Gdx.app.debug("number of explosions", "num " + maxNumberExplosion);
    }

    @Override
    public void update(float delta) {
        super.update(delta);
        oneTime -= delta;
        if(oneTime < 0){
            if( numberExplosion > 0){
                explose();
            } else if( numberExplosion == 0){
                core.getGame().nextTurn();
                core.getGui().updateDisplay(0.9f * timeAfterExplose);
                core.getGui().resetTimeBar(0.5f * timeAfterExplose);
                oneTime = timeAfterExplose;
                numberExplosion --;
            }
        }
    }

    @Override
    public void end(){
        if(core.getGame().isGameFinished()){
            core.nextState(core.getWinState(), core.winStateTime);
        }else{
            core.nextState(core.getWaitState(), core.getGame().getTimeWait());
        }
    }

    private void explose(){
        if(numberExplosion == 1){
            core.getGui().emptyDisplay(maxTimeOneExplosion);
            core.getGui().explose(maxTimeOneExplosion);

        }else{
            if(numberExplosion == maxNumberExplosion){
                core.getGui().colorTimeBar(maxNumberExplosion*maxTimeOneExplosion, Color.RED);
                core.getGui().fillTimeBar(maxNumberExplosion*maxTimeOneExplosion);
            }
            core.getGame().nextTurn();
            core.getGui().explose(core.getGame().getSymbol(), maxTimeOneExplosion);
        }
        oneTime = maxTimeOneExplosion;
        numberExplosion --;
    }
}
