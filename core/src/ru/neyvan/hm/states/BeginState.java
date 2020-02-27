package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.screens.PlayScreen;

public class BeginState extends State{

    private boolean displayUpdated = false;

    public BeginState(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
        displayUpdated = false;
        Gdx.app.debug("BeginState", "Begin state with time " + time);
        core.getGui().appear(time);
        core.gamePause();

    }

    @Override
    public void update(float delta) {
        super.update(delta);
        if(!displayUpdated && getLostTime() < 0.5f){
            core.getGui().showStart(2f);
            core.getGui().updateDisplay(getLostTime());
            displayUpdated = true;
        }
    }

    @Override
    public void end() {
        core.nextState(core.getWaitState(), core.getGame().getTimeWait());
    }
}