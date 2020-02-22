package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.screens.PlayScreen;

public class ChangeState extends State {

    public ChangeState(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
        Gdx.app.debug("ChangeState", "Begin state with time " + time);
        core.getGui().resetTimeBar(0.5f * time);

        if(core.getGame().isPlayerLose()){
            core.nextState(core.getChanceState(), core.chanceStateTime);
        }else if(core.getGame().isGameFinished()){
            core.nextState(core.getWinState(), core.winStateTime);
        }else{
            core.getGame().nextTurn();
            core.getGui().updateDisplay(time);
        }
    }

    @Override
    public void end() {
        core.nextState(core.getWaitState(), core.getGame().getTimeWait());
    }
}
